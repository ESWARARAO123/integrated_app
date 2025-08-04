#!/usr/bin/env python3.12
"""RHEL Resource Manager CLI Tool"""

import sys
import argparse
import subprocess
import json

class ResourceManagerCLI:
    def __init__(self):
        self.rm_path = "/opt/resource_manager/rhel_resource_manager.py"

    def show_status(self):
        """Show system resource status"""
        try:
            result = subprocess.run([sys.executable, self.rm_path, "--status"], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                status = json.loads(result.stdout)
                self.print_status(status)
            else:
                print(f"Error: {result.stderr}")
        except Exception as e:
            print(f"Error getting status: {e}")

    def print_status(self, status):
        """Print formatted status"""
        metrics = status.get('system_metrics', {})

        print("🖥️  RHEL System Resource Status")
        print("=" * 40)

        # CPU Info
        cpu = metrics.get('cpu', {})
        print(f"💻 CPU Usage: {cpu.get('percent', 0):.1f}%")
        print(f"   Cores: {cpu.get('count', 0)}")

        # Memory Info
        memory = metrics.get('memory', {})
        total_gb = memory.get('total', 0) / (1024**3)
        used_gb = memory.get('used', 0) / (1024**3)
        print(f"🧠 Memory Usage: {memory.get('percent', 0):.1f}%")
        print(f"   Used: {used_gb:.1f}GB / {total_gb:.1f}GB")

def main():
    parser = argparse.ArgumentParser(description="RHEL Resource Manager CLI")
    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Status command
    status_parser = subparsers.add_parser('status', help='Show system status')

    # Create group command  
    create_parser = subparsers.add_parser('create-group', help='Create resource group')
    create_parser.add_argument('name', help='Group name')
    create_parser.add_argument('--cpu', type=int, default=512, help='CPU shares')
    create_parser.add_argument('--memory', default='1G', help='Memory limit')

    args = parser.parse_args()
    cli = ResourceManagerCLI()

    if args.command == 'status':
        cli.show_status()
    elif args.command == 'create-group':
        print(f"Creating group {args.name} with CPU: {args.cpu}, Memory: {args.memory}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
