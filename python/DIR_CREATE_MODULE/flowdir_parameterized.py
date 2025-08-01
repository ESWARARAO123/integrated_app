#!/usr/local/bin/python3.9
import os,getpass,json,time,sys,argparse
from os.path import join as pj 
import subprocess

# Parse command line arguments
parser = argparse.ArgumentParser(description='VLSI Flow Directory Creator - Parameterized Version')
parser.add_argument('--project-name', required=True, help='Project name (e.g., Bigendian)')
parser.add_argument('--block-name', required=True, help='Block name (e.g., Top_encoder_01)')
parser.add_argument('--tool-name', required=True, choices=['cadence', 'synopsys'], help='Tool name')
parser.add_argument('--stage', required=True, help='Stage in flow (all, Synthesis, PD, LEC, STA)')
parser.add_argument('--run-name', required=True, help='Run name (e.g., run-yaswanth-01)')
parser.add_argument('--reference-run', default='', help='Reference run name (optional)')
parser.add_argument('--working-directory', default='/mnt/projects_107/vasu_backend', help='Working directory path')
parser.add_argument('--central-scripts', default='/mnt/projects_107/vasu_backend/flow/central_scripts', help='Central scripts directory path')
parser.add_argument('--pd-steps', default='all', help='PD steps when stage=PD (Floorplan,Place,CTS,Route,all)')

args = parser.parse_args()

# Global variables for tracking created paths
created_directories = []
created_files = []
created_symlinks = []

def log_action(action_type, path, status="SUCCESS"):
    """Structured logging for frontend parsing"""
    print(f"FLOWDIR_LOG:{action_type}:{status}:{path}")
    if status == "SUCCESS":
        if action_type == "DIR_CREATED":
            created_directories.append(path)
        elif action_type == "FILE_CREATED":
            created_files.append(path)
        elif action_type == "SYMLINK_CREATED":
            created_symlinks.append(path)

def log_progress(current_step, total_steps, description):
    """Progress tracking for frontend"""
    print(f"FLOWDIR_PROGRESS:{current_step}/{total_steps}:{description}")

def log_summary():
    """Final summary for frontend display"""
    print(f"FLOWDIR_SUMMARY:PROJECT:{args.project_name}")
    print(f"FLOWDIR_SUMMARY:BLOCK:{args.block_name}")
    print(f"FLOWDIR_SUMMARY:RUN:{args.run_name}")
    print(f"FLOWDIR_SUMMARY:TOOL:{args.tool_name}")
    print(f"FLOWDIR_SUMMARY:TOTAL_DIRS:{len(created_directories)}")
    print(f"FLOWDIR_SUMMARY:TOTAL_FILES:{len(created_files)}")
    print(f"FLOWDIR_SUMMARY:TOTAL_SYMLINKS:{len(created_symlinks)}")
    
    # Output all created paths for tracking
    for path in created_directories:
        print(f"FLOWDIR_SUMMARY:DIR_PATH:{path}")
    for path in created_files:
        print(f"FLOWDIR_SUMMARY:FILE_PATH:{path}")
    for path in created_symlinks:
        print(f"FLOWDIR_SUMMARY:SYMLINK_PATH:{path}")

#######
os.chdir(args.working_directory)  #top work area location
central_directory_path = args.central_scripts  #realpath of the central scripts path
#######

rtlv='Phase-0'
project = ['project']

def user_data_storage():
	#rtlv='Phase-0'
	a=json.loads(open("user_data_storage",'r').read())
	user=getpass.getuser()
	if user in a.keys():
		for i in (a[user]):print(a[user].index(i)+1,i)
		val=int(input('Enter number (0 to add) :'))
		if val==0:
			pname = str.strip(input("Enter the name of your project: "))
			block_name = str.strip(input("Enter the name of your block : "))
			a[user].append({"project":pname,"block":block_name})
			open("user_data_storage",'w').write(json.dumps(a))
			return(pname,block_name,user)
		else:
			return(a[user][val-1]['project'],a[user][val-1]['block'],user)
	else:
		a[user]=[]
		pname = str.strip(input("Enter the name of your project: "))
		block_name = str.strip(input("Enter the name of your block : "))
		a[user].append({"project":pname,"block":block_name})
		open("user_data_storage",'w').write(json.dumps(a))
		return(pname,block_name,user)


def get_user_input():
	# Use CLI arguments instead of interactive input
	pname = args.project_name
	block_name = args.block_name
	user_name = getpass.getuser()
	tool_used = args.tool_name
	stage_in_flow = args.stage
	run = args.run_name
	runlink = args.reference_run

	log_progress(1, 10, f"Processing parameters: {pname}/{block_name}")

	steps=''
	if (stage_in_flow=='PD'):
		flowsc=[stage_in_flow]
		text=args.pd_steps  # Use CLI argument for PD steps
		if (text=='all'):
			steps="Floorplan Place CTS Route".split(' ')
		else:
			steps=text.replace('all','').replace('  ',' ').split(' ')
	elif stage_in_flow == 'Synthesis':flowsc=['SYNTH']
	elif stage_in_flow == 'all':
		flowsc=['SYNTH','PD','LEC','STA']
		steps=['Floorplan', 'Place', 'CTS', 'Route']
	else: flowsc=[item for item in stage_in_flow.replace('all','').replace('Synthesis','SYNTH').split(' ') if item.strip()]

	log_progress(2, 10, f"Flow stages: {', '.join(flowsc)}")

	for flwext in flowsc:
		
		c=subprocess.check_output(f'find {pj(pname,rtlv,block_name,flwext,user_name)} -maxdepth 1 -type d -name "run_{tool_used}_{run}" | wc -l',shell=True,stderr=subprocess.DEVNULL)
		if int(c.strip()) == 0:
			pass
		else :
			print(f"FLOWDIR_ERROR:directory {pj(pname,rtlv,block_name,flwext,user_name,f'run_{tool_used}_{run}')} already found - create with another run")
			exit()

	if runlink:
		ref_run_parts=runlink.split("/")
		kkk = [item for item in ref_run_parts if item and item.strip()]
		pname = kkk[-6]
		#rtlv = kkk[-5]
		block_name = kkk[-4]
		ref_flowsc = kkk[-3].split(',')			       
		namess = kkk[-2]
		runlink = kkk[-1]
		for sf in ref_flowsc:
			try:
				if f'{runlink}'  in os.listdir(f'{pname}/{rtlv}/{block_name}/{sf}/{namess}/'):
					exists=1
				else:
					print('FLOWDIR_ERROR:run name doesnot exists')
					exists=0
			except FileNotFoundError:
				print(f'FLOWDIR_ERROR:run name does not exists in "{pname}/{rtlv}/{block_name}/{sf}/{namess}/" ')
				exists=0
	else:exists=0

	return  tool_used ,pname,block_name ,user_name,flowsc,run,steps,runlink,exists,namess if runlink else '',ref_flowsc if runlink else ''
	
def main():
	
	tools = ["cadence","synopsys"]
	flows = ["PD", "SYNTH", "LEC", "LV", "EMIR", "PARASITIC_EXTRACTION","STA"]
	sub_plug = ["scripts", "inputs", "customscripts" ,"user_plugin"]
	stages = ['Floorplan', 'Place', 'CTS', 'Route']
	for tool in tools:
		for flow in flows:
			for plug in sub_plug:
				for stage in stages:
					if ((flow=='PD') and (plug == 'scripts')):
						p=os.path.join(central_directory_path,project[0],tool,flow,plug,stage)
						os.system(f'mkdir -p {p}')
						log_action("DIR_CREATED", p)
				p=os.path.join(central_directory_path,project[0],tool,flow,plug)
				os.system(f'mkdir -p {p}')
				log_action("DIR_CREATED", p)

#main()
log_progress(0, 10, "Starting VLSI directory structure creation")
tool_used ,pname,block_name ,user_name,flowsc,run,steps,runlink,exists,namess,ref_flowsc=get_user_input()

log_progress(3, 10, "Creating base directory structure")

flow=["SYNTH","PD", "EMIR", "PV", "LEC","STA"]
default_flow = ['RTL', 'centroid_inputs','config']
level1 = ['logs', 'reports', 'outputs', 'design_db','snapshots', 'scripts', 'inputs', 'customscripts', 'run_database','user_plugin']
pdsteps=['Floorplan','Place','CTS','Route']
kk=default_flow
kk.extend(flowsc)
for df in kk:
	path = pj(pname,rtlv,block_name,df)
	os.system(f'mkdir -p {path}')
	log_action("DIR_CREATED", path)
	if df in ['SYNTH','PD']:
		k=(pj(pname,rtlv,block_name,df,user_name,f'run_{tool_used}_{run}'))
		for lv1 in level1:
			if (df=='PD'):
				if lv1 in ['logs', 'reports', 'outputs', 'design_db','snapshots', 'scripts']:
					for step in pdsteps:
						if (lv1 == 'reports'):
							path = pj(k,lv1,step,"csv")
							os.system(f'mkdir -p  {path}')
							log_action("DIR_CREATED", path)
						else:
							path = pj(k,lv1,step)
							os.system(f'mkdir -p  {path}')
							log_action("DIR_CREATED", path)
				else:
					path = pj(k,lv1)
					os.system(f'mkdir -p  {path} ')
					log_action("DIR_CREATED", path)

			elif (df=='SYNTH'):
				if (lv1 == 'reports'):
					path = pj(k,lv1,"Synthesis","csv")
					os.system(f'mkdir -p  {path}')
					log_action("DIR_CREATED", path)
				else:
					path = pj(k,lv1)
					os.system(f'mkdir -p  {path}')
					log_action("DIR_CREATED", path)
			else:
				path = pj(k,lv1)
				os.system(f'mkdir -p  {path} ')
				log_action("DIR_CREATED", path)

### for LEC & STA:
	if df in ["LEC", "STA"]:
		for dff in ["SYNTH","PD"]:
			k=(pj(pname,rtlv,block_name,df,user_name,f'run_{tool_used}_{run}',dff))
			for lv1 in level1:
				if (dff=='PD'):
					if lv1 in ['logs', 'reports', 'outputs', 'design_db','snapshots', 'scripts','inputs']:
						for step in pdsteps:
							if (lv1 == 'reports'):
								path = pj(k,lv1,step,"csv")
								os.system(f'mkdir -p  {path}')
								log_action("DIR_CREATED", path)
							else:
								path = pj(k,lv1,step)
								os.system(f'mkdir -p  {path}')
								log_action("DIR_CREATED", path)
					else:
						path = pj(k,lv1)
						os.system(f'mkdir -p  {path} ')
						log_action("DIR_CREATED", path)

				path = pj(k,lv1)
				os.system(f'mkdir -p  {path} ')
				log_action("DIR_CREATED", path)

log_progress(4, 10, "Setting directory permissions")
os.system(f'find {pname} -maxdepth 3 -type d -exec chmod 777 {{}} + > /dev/null 2>&1')

log_progress(5, 10, "Processing reference run data")

if (exists):
	for stage in ref_flowsc:
		for  stg in flowsc :
			for lv1 in [ 'reports', 'outputs', 'design_db','snapshots', 'scripts','customscripts','inputs',"user_plugin"]:
				if ((stage == "PD") and (stg == "PD") ):
					for pdstep in pdsteps:
						if pdstep in steps:
							if lv1 in [  'outputs', 'design_db','snapshots', 'scripts']:
								os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}",lv1,pdstep)}/*  {pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{run}",lv1,pdstep)}  > /dev/null 2>&1')
								log_action("FILE_COPIED", f"{pj(pname,rtlv,block_name,stage,namess,f'{runlink}',lv1,pdstep)} -> {pj(pname,rtlv,block_name,stage,user_name,f'run_{tool_used}_{run}',lv1,pdstep)}")

							if lv1 in ['inputs' , 'customscripts','user_plugin' ,'reports']:
								os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}",lv1)}/*  {pj(pname,rtlv,block_name,stage,user_name,f'run_{tool_used}_{run}',lv1)}  > /dev/null 2>&1')
								log_action("FILE_COPIED", f"{pj(pname,rtlv,block_name,stage,namess,f'{runlink}',lv1)} -> {pj(pname,rtlv,block_name,stage,user_name,f'run_{tool_used}_{run}',lv1)}")
							
						else:
							if lv1 in [ 'reports', 'outputs','snapshots', 'scripts']:
								os.system(f'find {pj(pname,rtlv,block_name,stage,namess,f"{runlink}",lv1,pdstep)}/ -type f  -exec ln -f {{}} {pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{run}",lv1,pdstep)} \\\\;')
								log_action("SYMLINK_CREATED", f"{pj(pname,rtlv,block_name,stage,namess,f'{runlink}',lv1,pdstep)} -> {pj(pname,rtlv,block_name,stage,user_name,f'run_{tool_used}_{run}',lv1,pdstep)}")
							if lv1 in ['design_db']:
								os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}",lv1,pdstep)}/*  {pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{run}",lv1,pdstep)}  > /dev/null 2>&1')
								log_action("FILE_COPIED", f"{pj(pname,rtlv,block_name,stage,namess,f'{runlink}',lv1,pdstep)} -> {pj(pname,rtlv,block_name,stage,user_name,f'run_{tool_used}_{run}',lv1,pdstep)}")

		
################################# for LEC
		
			if ((stage == "SYNTH") and (stg == "LEC") ):
				for lv1 in ['scripts','outputs' ]:
					try:
						os.system(f'cp -rf {pj(pname, rtlv, block_name, stage, namess, f"{runlink}", lv1, "Synthesis")}/*do  {pj(pname, rtlv, block_name, stg,user_name, f"run_{tool_used}_{run}", "SYNTH","scripts")} > /dev/null 2>&1')
						os.system(f' mkdir -p {pj(pname, rtlv, block_name, stg,user_name, f"run_{tool_used}_{run}", "SYNTH","scripts","LEC")}')
						log_action("FILE_COPIED", f"LEC .do files copied")
					except Exception as e:
						print(f"FLOWDIR_ERROR:Error copying .do files: {e}")
					try:
						os.system(f'cp -rf {pj(pname, rtlv, block_name, stage, namess, f"{runlink}", lv1, "Synthesis")}/*v  {pj(pname, rtlv, block_name, stg, user_name, f"run_{tool_used}_{run}", "SYNTH","scripts")} > /dev/null 2>&1')
						log_action("FILE_COPIED", f"LEC .v files copied")
					except Exception as e:
						print(f"FLOWDIR_ERROR:Error copying .v files: {e}")
			if ((stage == "PD") and (stg == "LEC") ):
				for pdstep in pdsteps:
					    os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}","outputs",pdstep)}/*v  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","PD","scripts",pdstep)}  > /dev/null 2>&1')
					    log_action("FILE_COPIED", f"PD LEC files copied for {pdstep}")
############################### for STA
			if ((stage == "SYNTH") and (stg == "STA") ):						
				os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}","outputs","Synthesis")}/  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","SYNTH","inputs")}  > /dev/null 2>&1')
				log_action("FILE_COPIED", f"STA SYNTH files copied")
				os.system(f'cp -rf {pj(central_directory_path,project[0],tool_used,stg,"customscripts")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","SYNTH","customscripts")}  > /dev/null 2>&1')
				os.system(f'cp -rf {pj(central_directory_path,project[0],tool_used,stg,"scripts","STA")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","SYNTH","scripts")}  > /dev/null 2>&1')
				os.system(f'cp -rf {pj(central_directory_path,project[0],tool_used,stg,"user_plugin")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","SYNTH","user_plugin")}  > /dev/null 2>&1')

			if ((stage == "PD") and (stg == "STA") ):
				for pdstep in pdsteps:
					os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}","outputs",pdstep)}/  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","PD","inputs",pdstep)}  > /dev/null 2>&1')	
					log_action("FILE_COPIED", f"STA PD files copied for {pdstep}")
					os.system(f'cp -rf {pj(central_directory_path,project[0],tool_used,stg,"customscripts")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","PD","customscripts")}  > /dev/null 2>&1')
					os.system(f'cp -rf {pj(central_directory_path,project[0],tool_used,stg,"user_plugin")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","PD","user_plugin")}  > /dev/null 2>&1')
					os.system(f'cp -rf {pj(central_directory_path,project[0],tool_used,stg,"scripts","STA")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","PD","scripts",pdstep)}  > /dev/null 2>&1')

#############################################################################
			if ((stage == "STA") and (stg == "STA") ):
					
			    	os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}")}  > /dev/null 2>&1')	
			    	log_action("FILE_COPIED", f"STA to STA files copied")
			if ((stage == "LEC") and (stg == "LEC") ):
				for pdstep in pdsteps:
					    os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}")}/  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}")}  > /dev/null 2>&1')
					    log_action("FILE_COPIED", f"LEC to LEC files copied")
###################################################			
			else:
				os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}",lv1)}/*  {pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{run}",lv1)} > /dev/null 2>&1')
				log_action("FILE_COPIED", f"General files copied")
			
				
else:
	log_progress(6, 10, "Copying from central scripts")
	for stage in flowsc:
		if stage in ("LEC","STA"):
		    pass
		else:
			os.system(f'find {pj(central_directory_path,project[0],tool_used,stage)}/* -maxdepth 0 -type d  -exec cp -rf  {{}} {pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{run}")}/ \\\\; ')
			log_action("FILE_COPIED", f"Central scripts copied for {stage}")

log_progress(7, 10, "Setting up centroid inputs")

# Check if the directory exists 
if os.path.exists(pj(pname, rtlv, block_name, 'centroid_inputs')) and os.listdir(pj(pname, rtlv, block_name, 'centroid_inputs')):
	pass  # Directory exists and is not empty
else:
	os.system(f"cp -rf {pj(central_directory_path, project[0], tool_used, 'centroid_inputs')}/* {pj(pname, rtlv, block_name, 'centroid_inputs')}/")
	log_action("FILE_COPIED", f"Centroid inputs copied")

log_progress(8, 10, "Creating configuration files")

if (exists):
	rund=runlink.split("_")[-1]
	for  stage in flowsc :
		for stg in ref_flowsc:
			if ((( stg == "SYNTH") and (stage == "SYNTH")) or ((stg =="PD") and (stage == "PD"))):
				flname="complete_make.csh"
				src=pj(pname,rtlv,block_name,'config',f'config_{namess}_{tool_used}_{rund}.tcl')
				dst=pj(pname,rtlv,block_name,'config',f'config_{user_name}_{tool_used}_{run}.tcl')
				if os.path.isfile(dst):
					pass
				else:
					os.system(f"cp -f {src} {dst}")
					log_action("FILE_CREATED", dst)

				if (stage=='SYNTH'):
					link_target = pj(pname,rtlv,block_name,'SYNTH',user_name,f'run_{tool_used}_{run}','config.tcl')
					os.system(f"ln -sf {os.path.realpath(dst)} {link_target}")
					log_action("SYMLINK_CREATED", f"{dst} -> {link_target}")
				if (stage=="PD"):
					link_target = pj(pname,rtlv,block_name,'PD',user_name,f'run_{tool_used}_{run}','config.tcl')
					os.system(f"ln -sf {os.path.realpath(dst)} {link_target}")
					log_action("SYMLINK_CREATED", f"{dst} -> {link_target}")
else:
	rund=run
	for stage in flowsc:
		if (( stage == "SYNTH") or(stage =="PD")):
			flname="complete_make.csh"
			src=pj(central_directory_path,project[0],tool_used,'SYNTH','config.tcl')
			dst=pj(pname,rtlv,block_name,'config',f'config_{user_name}_{tool_used}_{rund}.tcl')
			if os.path.isfile(dst):
				pass
			else:
				os.system(f"cp -f {src} {dst}")
				log_action("FILE_CREATED", dst)

			if (stage=='SYNTH'):
				link_target = pj(pname,rtlv,block_name,'SYNTH',user_name,f'run_{tool_used}_{rund}','config.tcl')
				os.system(f"ln -sf {os.path.realpath(dst)} {link_target}")
				log_action("SYMLINK_CREATED", f"{dst} -> {link_target}")
			if (stage=="PD"):
				link_target = pj(pname,rtlv,block_name,'PD',user_name,f'run_{tool_used}_{rund}','config.tcl')
				os.system(f"ln -sf {os.path.realpath(dst)} {link_target}")
				log_action("SYMLINK_CREATED", f"{dst} -> {link_target}")

log_progress(9, 10, "Creating execution scripts")

rund =run
if (stage=='SYNTH'):
	k=pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{rund}","scripts","Synthesis")
	script_path = f"{k}/../../{flname}"
	with open(script_path,'w') as f:
		f.write(f"cd {os.path.realpath(k)}\nsource make_synthesis.csh")
	log_action("FILE_CREATED", script_path)
	print(f"FLOWDIR_LOG:EXEC_SCRIPT:SUCCESS:{os.path.realpath(script_path)}")

if (stage=="PD"):
	script_path = f'{pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{rund}",flname)}'
	k=open(script_path,'w')
	for ste in steps:
		kk=pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{rund}","scripts",ste)
		k.write(f"cd {os.path.realpath(kk)}\nsource make_{ste.lower()}.csh\n")
	k.close()
	log_action("FILE_CREATED", script_path)
	print(f"FLOWDIR_LOG:EXEC_SCRIPT:SUCCESS:{os.path.realpath(script_path)}")

log_progress(10, 10, "Directory structure creation completed")

# Final summary
log_summary()

print("FLOWDIR_LOG:COMPLETION:SUCCESS:VLSI directory structure created successfully") 