#!/usr/bin/env python3
# Auto-generated wrapper script for FlowDir execution
import sys
import subprocess
import tempfile
import os

# The original parameterized script content
original_script = '''#!/usr/local/bin/python3.9
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

# INJECTED PARAMETERS - Replace with actual values
sys.argv = [
    'flowdir_parameterized.py',
    '--project-name', 'Bigendian',
    '--block-name', 'Top_encoder01', 
    '--tool-name', 'cadence',
    '--stage', 'all',
    '--run-name', 'run-Yaswanth-testpinnacle',
    '--pd-steps', 'all',
    '--working-directory', '/mnt/projects_107/vasu_backend',
    '--central-scripts', '/mnt/projects/vasu_backend/flow/central_scripts'
]

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

print("FLOWDIR_LOG:TESTING:SUCCESS:Base64 execution test starting")
print("FLOWDIR_LOG:COMPLETION:SUCCESS:Base64 wrapper test completed")
'''

# Execute the script content
exec(original_script)
