#!/usr/bin/env python3
"""
Simple test script for MCP shell command testing
"""

import sys
import os
from datetime import datetime

def main():
    print("=" * 50)
    print("TEST SCRIPT EXECUTION")
    print("=" * 50)
    
    print(f"Python version: {sys.version}")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Script location: {os.path.abspath(__file__)}")
    print(f"Execution time: {datetime.now()}")
    
    print("\nEnvironment variables:")
    for key in ['PATH', 'HOME', 'USER', 'PWD']:
        value = os.environ.get(key, 'Not set')
        print(f"  {key}: {value}")
    
    print("\nDirectory contents:")
    try:
        files = os.listdir('.')
        for file in sorted(files)[:10]:  # Show first 10 files
            print(f"  {file}")
        if len(files) > 10:
            print(f"  ... and {len(files) - 10} more files")
    except Exception as e:
        print(f"  Error listing directory: {e}")
    
    print("\nTest completed successfully!")
    print("=" * 50)

if __name__ == "__main__":
    main()
