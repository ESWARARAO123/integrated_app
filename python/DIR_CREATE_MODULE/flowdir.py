#!/usr/local/bin/python3.9
import os,getpass,json,time,sys
from os.path import join as pj 
import subprocess
#######
os.chdir('/nas/nas_v1/Innovus_trials/users')  #top work area location
central_directory_path ="/nas/nas_v1/Innovus_trials/users/central_scripts"  #realpath of the central scripts path
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
	if "user_data_storage" in os.listdir() and open("user_data_storage",'r').read().strip()!='':
		os.system("chmod 777 user_data_storage 2>/dev/null ")
		pname,block_name,user_name=user_data_storage()
	else:
		pname = str.strip(input("Enter the name of your project: "))
		block_name = str.strip(input("Enter the name of your block : "))
		user_name=getpass.getuser()
		b=open("user_data_storage",'a+')
		os.system("chmod 777 user_data_storage 2>/dev/null")
		if b.read().strip()=='':
			strr='{"'+user_name+'":'+'[{'+f'"project":"{pname}","block":"{block_name}"' +'}]}'
			b.write(strr)
		else:
			try:
				v=json.loads(b)
				try:
					v[user]
					v[user].append(json.loads('{"project":"{pname}","block":"{block_name}"'))
					open("user_data_storage",'w').write(json.dumps(v))
				except KeyError:
					v=json.loads(b)
					v[user]=json.loads('{"project":"{pname}","block":"{block_name}"')
			except Exception as e:
				print('Check json file',e)
				exit()

		

	tool_used = input ("Enter the tool to be used ( cadence , synopsys ) : ")
	if tool_used not in ["cadence" , "synopsys"] :
		print('Enter correct tool')
		tool_used = input ("Enter the tool to be used ( cadence , synopsys ) : ")
		if tool_used not in ["cadence" , "synopsys"] :exit()

	stage_in_flow = input("Enter the stage in flow (ex: all Synthesis PD LEC STA ): ")
	steps=''
	if (stage_in_flow=='PD'):
		flowsc=[stage_in_flow]
		text=input('Enter stages Floorplan Place CTS Route all : ')
		if (text=='all'):
			steps="Floorplan Place CTS Route".split(' ')
		else:
			steps=text.replace('all','').replace('  ',' ').split(' ')
	elif stage_in_flow == 'Synthesis':flowsc=['SYNTH']
	elif stage_in_flow == 'all':
		flowsc=['SYNTH','PD','LEC','STA']
		steps=['Floorplan', 'Place', 'CTS', 'Route']
	else: flowsc=[item for item in stage_in_flow.replace('all','').replace('Synthesis','SYNTH').split(' ') if item.strip()]
	run=input('Enter run name : ')
	if not run :
		run=input('Enter run name : ')
		if not run : exit()

	for flwext in flowsc:
		
		c=subprocess.check_output(f'find {pj(pname,rtlv,block_name,flwext,user_name)} -maxdepth 1 -type d -name "run_{tool_used}_{run}" | wc -l',shell=True,stderr=subprocess.DEVNULL)
		if int(c.strip()) == 0:
			pass
		else :
			print(f"directory {pj(pname,rtlv,block_name,flwext,user_name,f'run_{tool_used}_{run}')} already found \n create with another run"  )
			exit()

	runlink=input('Enter ref run path  (to skip press enter) :')

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
					print('run name doesnot exists')
					runlink=input('Enter ref run name (to skip press enter) :')
					for sf in ref_flowsc:
						if f'{runlink}'  in os.listdir(f'{pname}/{rtlv}/{block_name}/{sf}/{namess}/'):
							exists=1
						else: exists=0
			except FileNotFoundError:
				print(f'run name does not exists in "{pname}/{rtlv}/{block_name}/{sf}/{namess}/" ')
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
				p=os.path.join(central_directory_path,project[0],tool,flow,plug)
				os.system(f'mkdir -p {p}')
#main()
tool_used ,pname,block_name ,user_name,flowsc,run,steps,runlink,exists,namess,ref_flowsc=get_user_input()


flow=["SYNTH","PD", "EMIR", "PV", "LEC","STA"]
default_flow = ['RTL', 'centroid_inputs','config']
level1 = ['logs', 'reports', 'outputs', 'design_db','snapshots', 'scripts', 'inputs', 'customscripts', 'run_database','user_plugin']
pdsteps=['Floorplan','Place','CTS','Route']
kk=default_flow
kk.extend(flowsc)
for df in kk:
	os.system(f'mkdir -p {pj(pname,rtlv,block_name,df)}')
	if df in ['SYNTH','PD']:
		k=(pj(pname,rtlv,block_name,df,user_name,f'run_{tool_used}_{run}'))
		for lv1 in level1:
			if (df=='PD'):
				if lv1 in ['logs', 'reports', 'outputs', 'design_db','snapshots', 'scripts']:
					for step in pdsteps:
						if (lv1 == 'reports'):
							os.system(f'mkdir -p  {pj(k,lv1,step,"csv")}')
						else:
							os.system(f'mkdir -p  {pj(k,lv1,step)}')
				else:
					os.system(f'mkdir -p  {pj(k,lv1)} ')

			elif (df=='SYNTH'):
				if (lv1 == 'reports'):
					os.system(f'mkdir -p  {pj(k,lv1,"Synthesis","csv")}')
				else:
					os.system(f'mkdir -p  {pj(k,lv1)}')
			else:
				os.system(f'mkdir -p  {pj(k,lv1)} ')
### for LEC & STA:
	if df in ["LEC", "STA"]:
		for dff in ["SYNTH","PD"]:
			k=(pj(pname,rtlv,block_name,df,user_name,f'run_{tool_used}_{run}',dff))
			for lv1 in level1:
				if (dff=='PD'):
					if lv1 in ['logs', 'reports', 'outputs', 'design_db','snapshots', 'scripts','inputs']:
						for step in pdsteps:
							if (lv1 == 'reports'):
								os.system(f'mkdir -p  {pj(k,lv1,step,"csv")}')
							else:
								os.system(f'mkdir -p  {pj(k,lv1,step)}')
					else:
						os.system(f'mkdir -p  {pj(k,lv1)} ')

				os.system(f'mkdir -p  {pj(k,lv1)} ')

os.system(f'find {pname} -maxdepth 3 -type d -exec chmod 777 {{}} + > /dev/null 2>&1')


if (exists):
	for stage in ref_flowsc:
		for  stg in flowsc :
			for lv1 in [ 'reports', 'outputs', 'design_db','snapshots', 'scripts','customscripts','inputs',"user_plugin"]:
				if ((stage == "PD") and (stg == "PD") ):
					for pdstep in pdsteps:
						if pdstep in steps:
							if lv1 in [  'outputs', 'design_db','snapshots', 'scripts']:
								os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}",lv1,pdstep)}/*  {pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{run}",lv1,pdstep)}  > /dev/null 2>&1')

							if lv1 in ['inputs' , 'customscripts','user_plugin' ,'reports']:
								os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}",lv1)}/*  {pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{run}",lv1)}  > /dev/null 2>&1')
							
						else:
							if lv1 in [ 'reports', 'outputs','snapshots', 'scripts']:
								os.system(f'find {pj(pname,rtlv,block_name,stage,namess,f"{runlink}",lv1,pdstep)}/ -type f  -exec ln -f {{}} {pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{run}",lv1,pdstep)} \;')
							if lv1 in ['design_db']:
								os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}",lv1,pdstep)}/*  {pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{run}",lv1,pdstep)}  > /dev/null 2>&1')

			
################################# for LEC
			
				if ((stage == "SYNTH") and (stg == "LEC") ):
					for lv1 in ['scripts','outputs' ]:
						try:
							os.system(f'cp -rf {pj(pname, rtlv, block_name, stage, namess, f"{runlink}", lv1, "Synthesis")}/*do  {pj(pname, rtlv, block_name, stg,user_name, f"run_{tool_used}_{run}", "SYNTH","scripts")} > /dev/null 2>&1')
							os.system(f' mkdir -p {pj(pname, rtlv, block_name, stg,user_name, f"run_{tool_used}_{run}", "SYNTH","scripts","LEC")}')
						except Exception as e:
							print(f"Error copying .do files: {e}")
						try:
							os.system(f'cp -rf {pj(pname, rtlv, block_name, stage, namess, f"{runlink}", lv1, "Synthesis")}/*v  {pj(pname, rtlv, block_name, stg, user_name, f"run_{tool_used}_{run}", "SYNTH","scripts")} > /dev/null 2>&1')
						except Exception as e:
							print(f"Error copying .v files: {e}")
				if ((stage == "PD") and (stg == "LEC") ):
					for pdstep in pdsteps:
						    os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}","outputs",pdstep)}/*v  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","PD","scripts",pdstep)}  > /dev/null 2>&1')
############################### for STA
				if ((stage == "SYNTH") and (stg == "STA") ):						
					os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}","outputs","Synthesis")}/  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","SYNTH","inputs")}  > /dev/null 2>&1')
					os.system(f'cp -rf {pj(central_directory_path,project[0],tool_used,stg,"customscripts")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","SYNTH","customscripts")}  > /dev/null 2>&1')
					os.system(f'cp -rf {pj(central_directory_path,project[0],tool_used,stg,"scripts","STA")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","SYNTH","scripts")}  > /dev/null 2>&1')
					os.system(f'cp -rf {pj(central_directory_path,project[0],tool_used,stg,"user_plugin")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","SYNTH","user_plugin")}  > /dev/null 2>&1')

				if ((stage == "PD") and (stg == "STA") ):
					for pdstep in pdsteps:
						os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}","outputs",pdstep)}/  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","PD","inputs",pdstep)}  > /dev/null 2>&1')	
						os.system(f'cp -rf {pj(central_directory_path,project[0],tool_used,stg,"customscripts")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","PD","customscripts")}  > /dev/null 2>&1')
						os.system(f'cp -rf {pj(central_directory_path,project[0],tool_used,stg,"user_plugin")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","PD","user_plugin")}  > /dev/null 2>&1')
						os.system(f'cp -rf {pj(central_directory_path,project[0],tool_used,stg,"scripts","STA")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}","PD","scripts",pdstep)}  > /dev/null 2>&1')

#############################################################################
				if ((stage == "STA") and (stg == "STA") ):
						
				    	os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}")}/*  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}")}  > /dev/null 2>&1')	
				if ((stage == "LEC") and (stg == "LEC") ):
					for pdstep in pdsteps:
						    os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}")}/  {pj(pname,rtlv,block_name,stg,user_name,f"run_{tool_used}_{run}")}  > /dev/null 2>&1')
###################################################			
				else:
					os.system(f'cp -rf {pj(pname,rtlv,block_name,stage,namess,f"{runlink}",lv1)}/*  {pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{run}",lv1)} > /dev/null 2>&1')
				
					
else:
	for stage in flowsc:
		if stage in ("LEC","STA"):
		    pass
		else:
			os.system(f'find {pj(central_directory_path,project[0],tool_used,stage)}/* -maxdepth 0 -type d  -exec cp -rf  {{}} {pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{run}")}/ \; ')
	

# Check if the directory exists 
if os.listdir(pj(pname, rtlv, block_name, 'centroid_inputs')):
	pass  # Directory exists and is not empty
else:
	os.system(f"cp -rf {pj(central_directory_path, project[0], tool_used, 'centroid_inputs')}/* {pj(pname, rtlv, block_name, 'centroid_inputs')}/")




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

				if (stage=='SYNTH'):
					os.system(f"ln -sf {os.path.realpath(dst)} {pj(pname,rtlv,block_name,'SYNTH',user_name,f'run_{tool_used}_{run}','config.tcl')}")
				if (stage=="PD"):
					os.system(f"ln -sf {os.path.realpath(dst)} {pj(pname,rtlv,block_name,'PD',user_name,f'run_{tool_used}_{run}','config.tcl')}")
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

			if (stage=='SYNTH'):
				os.system(f"ln -sf {os.path.realpath(dst)} {pj(pname,rtlv,block_name,'SYNTH',user_name,f'run_{tool_used}_{rund}','config.tcl')}")
			if (stage=="PD"):
				os.system(f"ln -sf {os.path.realpath(dst)} {pj(pname,rtlv,block_name,'PD',user_name,f'run_{tool_used}_{rund}','config.tcl')}")
	

rund =run
if (stage=='SYNTH'):
	k=pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{rund}","scripts","Synthesis")
	with open(f"{k}/../../{flname}",'w') as f:f.write(f"cd {os.path.realpath(k)}\nsource make_synthesis.csh")
	print(os.path.realpath(f"{k}/../../{flname}"))


if (stage=="PD"):
	k=open(f'{pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{rund}",flname)}','w')
	for ste in steps:
		kk=pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{rund}","scripts",ste)
		k.write(f"cd {os.path.realpath(kk)}\nsource make_{ste.lower()}.csh\n")
	k.close()
	print(f'{os.path.realpath(pj(pname,rtlv,block_name,stage,user_name,f"run_{tool_used}_{rund}",flname))}')
