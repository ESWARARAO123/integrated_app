#!/usr/bin/env python3
"""
Quick Network Scanner for SSH-accessible servers
Fast version for testing - only scans a few IPs
"""

import subprocess
import os
import json
from typing import List, Dict
from datetime import datetime

class QuickNetworkScanner:
    def __init__(self):
        self.scan_results = []
    
    def quick_scan(self, network_range: str, username: str = None, max_ips: int = 10, start_ip: int = 1) -> List[Dict]:
        """
        Quick scan of network for SSH-accessible servers
        
        Args:
            network_range: Network range (e.g., "172.16.16")
            username: SSH username (defaults to current user)
            max_ips: Maximum number of IPs to scan (default: 10)
            start_ip: Starting IP number (default: 1)
        
        Returns:
            List of dictionaries with server information
        """
        if not username:
            username = os.getenv('USER', 'root')
        
        end_ip = min(start_ip + max_ips - 1, 254)
        print(f"🔍 Quick scanning network {network_range}.x (IPs {start_ip}-{end_ip})...")
        print(f"👤 Using username: {username}")
        
        discovered_servers = []
        
        # Get current machine's IP to skip it
        current_ips = []
        try:
            # Get all IP addresses of current machine
            result = subprocess.run(['hostname', '-I'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                current_ips = result.stdout.strip().split()
        except:
            pass
        
        # Also add localhost variants
        current_ips.extend(['127.0.0.1', 'localhost'])
        
        # Scan IPs from start_ip to start_ip + max_ips
        for i in range(start_ip, min(start_ip + max_ips, 255)):
            ip = f"{network_range}.{i}"
            
            # Skip if it's the current machine
            if ip in current_ips:
                print(f"  Skipping {ip} (current machine)")
                continue
            
            print(f"  Testing {ip}...", end=' ', flush=True)
            
            # First try ping to see if host is reachable
            ping_success = False
            try:
                # Use a more reliable ping approach
                ping_result = subprocess.run([
                    'ping', '-c', '1', '-W', '2', ip
                ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5)
                
                if ping_result.returncode == 0:
                    ping_success = True
                    print("✅ Ping OK", end=' ')
                else:
                    print("❌ No ping", end=' ')
            except:
                print("❌ Ping failed", end=' ')
            
            # If ping failed, still try SSH (some servers might not respond to ping)
            if not ping_success:
                print("(trying SSH anyway)", end=' ')
            
            # Test SSH connection (non-interactive)
            try:
                # Try key-based authentication first
                result = subprocess.run([
                    'ssh', '-o', 'ConnectTimeout=5',
                    '-o', 'BatchMode=yes',
                    '-o', 'StrictHostKeyChecking=no',
                    '-o', 'UserKnownHostsFile=/dev/null',
                    f'{username}@{ip}',
                    'echo OK'
                ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
                
                # If key-based auth fails, try without BatchMode (allows password prompt)
                if result.returncode != 0:
                    result = subprocess.run([
                        'ssh', '-o', 'ConnectTimeout=5',
                        '-o', 'StrictHostKeyChecking=no',
                        '-o', 'UserKnownHostsFile=/dev/null',
                        f'{username}@{ip}',
                        'echo OK'
                    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
                
                if result.returncode == 0:
                    print("✅ SSH OK")
                    
                    # Get server information
                    server_info = self._get_server_info(ip, username)
                    discovered_servers.append(server_info)
                else:
                    print("❌ No SSH")
                    
            except subprocess.TimeoutExpired:
                print("⏰ SSH Timeout")
            except Exception as e:
                print(f"❌ SSH Error: {e}")
        
        print(f"\n✅ Quick scan completed! Found {len(discovered_servers)} SSH-accessible servers")
        return discovered_servers
    
    def _get_server_info(self, ip: str, username: str) -> Dict:
        """Get basic server information"""
        try:
            # Get hostname
            hostname_result = subprocess.run([
                'ssh', '-o', 'ConnectTimeout=3', f'{username}@{ip}', 'hostname'
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5, universal_newlines=True)
            
            hostname = hostname_result.stdout.strip() if hostname_result.returncode == 0 else 'Unknown'
            
            # Get OS info
            os_result = subprocess.run([
                'ssh', '-o', 'ConnectTimeout=3', f'{username}@{ip}', 
                'grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d\\" -f2 || echo "Unknown"'
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5, universal_newlines=True)
            
            os_info = os_result.stdout.strip() if os_result.returncode == 0 else 'Unknown'
            
            # Get CPU cores
            cpu_result = subprocess.run([
                'ssh', '-o', 'ConnectTimeout=3', f'{username}@{ip}', 'nproc 2>/dev/null || echo "Unknown"'
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5, universal_newlines=True)
            
            cpu_cores = cpu_result.stdout.strip() if cpu_result.returncode == 0 else 'Unknown'
            
            # Get memory info
            mem_result = subprocess.run([
                'ssh', '-o', 'ConnectTimeout=3', f'{username}@{ip}', 
                'free -h 2>/dev/null | grep "^Mem:" | awk "{print \\$2}" || echo "Unknown"'
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5, universal_newlines=True)
            
            memory = mem_result.stdout.strip() if mem_result.returncode == 0 else 'Unknown'
            
            return {
                'ip': ip,
                'hostname': hostname,
                'os': os_info,
                'cpu_cores': cpu_cores,
                'memory': memory,
                'ssh_accessible': True,
                'discovered_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error getting info for {ip}: {e}")
            return {
                'ip': ip,
                'hostname': 'Unknown',
                'os': 'Unknown',
                'cpu_cores': 'Unknown',
                'memory': 'Unknown',
                'ssh_accessible': True,
                'discovered_at': datetime.now().isoformat()
            }

def quick_scan_network(network_range: str, username: str = None, max_ips: int = 10) -> List[Dict]:
    """Convenience function to quick scan a network range"""
    scanner = QuickNetworkScanner()
    return scanner.quick_scan(network_range, username, max_ips)

if __name__ == "__main__":
    # Test the quick scanner
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 quick_network_scanner.py <network_range> [username] [max_ips]")
        print("Example: python3 quick_network_scanner.py 172.16.16 root 5")
        sys.exit(1)
    
    network = sys.argv[1]
    username = sys.argv[2] if len(sys.argv) > 2 else None
    max_ips = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    
    scanner = QuickNetworkScanner()
    results = scanner.quick_scan(network, username, max_ips)
    
    print(f"\n📊 Quick Scan Results:")
    print(f"Total servers found: {len(results)}")
    
    for server in results:
        print(f"  {server['ip']} - {server['hostname']} ({server['os']})")
        print(f"    CPU: {server['cpu_cores']} cores, Memory: {server['memory']}") 