#!/usr/bin/env python3.12
"""
Network Discovery and Multi-Server Monitoring
Discovers and monitors multiple servers across the network
"""

import socket
import subprocess
import threading
import time
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import concurrent.futures
import paramiko
import psutil

logger = logging.getLogger('NetworkDiscovery')

class NetworkDiscovery:
    """Discovers and monitors multiple servers across the network"""
    
    def __init__(self):
        self.discovered_servers = {}
        self.accessible_servers = {}
        self.credentials = {}
        self.scan_results = {}
        self.running = False
        self.scan_thread = None
        
    def set_credentials(self, username: str, password: str = None, key_file: str = None):
        """Set credentials for server access"""
        self.credentials = {
            'username': username,
            'password': password,
            'key_file': key_file
        }
    
    def discover_network(self, network_range: str = "192.168.2.0/24", timeout: int = 2):
        """Discover servers in the network range"""
        logger.info(f"Starting network discovery for range: {network_range}")
        
        # Parse network range
        base_ip = network_range.split('/')[0]
        base_parts = base_ip.split('.')
        base_parts[-1] = '0'  # Start from .0
        
        discovered = []
        
        # Scan common ranges
        for i in range(1, 255):
            ip = f"{base_parts[0]}.{base_parts[1]}.{base_parts[2]}.{i}"
            
            if self._ping_host(ip, timeout):
                discovered.append(ip)
                logger.info(f"Discovered server: {ip}")
        
        self.discovered_servers = {ip: {'discovered_at': datetime.now()} for ip in discovered}
        logger.info(f"Network discovery completed. Found {len(discovered)} servers")
        return discovered
    
    def _ping_host(self, ip: str, timeout: int) -> bool:
        """Ping a host to check if it's reachable"""
        try:
            # Use subprocess for ping
            result = subprocess.run(
                ['ping', '-c', '1', '-W', str(timeout), ip],
                capture_output=True,
                text=True,
                timeout=timeout + 2
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False
    
    def check_server_accessibility(self, servers: List[str] = None) -> Dict[str, Dict]:
        """Check which servers are accessible with SSH"""
        if servers is None:
            servers = list(self.discovered_servers.keys())
        
        accessible = {}
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_ip = {executor.submit(self._check_ssh_access, ip): ip for ip in servers}
            
            for future in concurrent.futures.as_completed(future_to_ip):
                ip = future_to_ip[future]
                try:
                    result = future.result()
                    if result['accessible']:
                        accessible[ip] = result
                        logger.info(f"Server {ip} is accessible via SSH")
                    else:
                        logger.warning(f"Server {ip} is not accessible: {result.get('error', 'Unknown error')}")
                except Exception as e:
                    logger.error(f"Error checking {ip}: {e}")
        
        self.accessible_servers = accessible
        return accessible
    
    def _check_ssh_access(self, ip: str) -> Dict:
        """Check SSH access to a specific server"""
        result = {
            'ip': ip,
            'accessible': False,
            'checked_at': datetime.now(),
            'error': None,
            'system_info': None
        }
        
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Try to connect
            ssh.connect(
                ip,
                username=self.credentials.get('username', 'root'),
                password=self.credentials.get('password'),
                key_filename=self.credentials.get('key_file'),
                timeout=10,
                banner_timeout=10
            )
            
            result['accessible'] = True
            
            # Get basic system info
            try:
                stdin, stdout, stderr = ssh.exec_command('uname -a', timeout=5)
                system_info = stdout.read().decode().strip()
                result['system_info'] = system_info
            except:
                result['system_info'] = "Unknown"
            
            ssh.close()
            
        except Exception as e:
            result['error'] = str(e)
        
        return result
    
    def get_server_status(self, ip: str) -> Optional[Dict]:
        """Get detailed status of a specific server"""
        if ip not in self.accessible_servers:
            return None
        
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            ssh.connect(
                ip,
                username=self.credentials.get('username', 'root'),
                password=self.credentials.get('password'),
                key_filename=self.credentials.get('key_file'),
                timeout=10
            )
            
            # Get system metrics
            status = {
                'ip': ip,
                'timestamp': datetime.now(),
                'cpu_usage': self._get_remote_cpu_usage(ssh),
                'memory_usage': self._get_remote_memory_usage(ssh),
                'disk_usage': self._get_remote_disk_usage(ssh),
                'load_average': self._get_remote_load_average(ssh),
                'uptime': self._get_remote_uptime(ssh),
                'network_interfaces': self._get_remote_network_info(ssh)
            }
            
            ssh.close()
            return status
            
        except Exception as e:
            logger.error(f"Error getting status for {ip}: {e}")
            return None
    
    def _get_remote_cpu_usage(self, ssh) -> float:
        """Get CPU usage from remote server"""
        try:
            stdin, stdout, stderr = ssh.exec_command("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1", timeout=5)
            cpu_str = stdout.read().decode().strip()
            return float(cpu_str) if cpu_str else 0.0
        except:
            return 0.0
    
    def _get_remote_memory_usage(self, ssh) -> Dict:
        """Get memory usage from remote server"""
        try:
            stdin, stdout, stderr = ssh.exec_command("free -m | grep '^Mem:'", timeout=5)
            mem_line = stdout.read().decode().strip()
            parts = mem_line.split()
            
            total = int(parts[1])
            used = int(parts[2])
            free = int(parts[3])
            
            return {
                'total_mb': total,
                'used_mb': used,
                'free_mb': free,
                'percent': (used / total) * 100 if total > 0 else 0
            }
        except:
            return {'total_mb': 0, 'used_mb': 0, 'free_mb': 0, 'percent': 0}
    
    def _get_remote_disk_usage(self, ssh) -> Dict:
        """Get disk usage from remote server"""
        try:
            stdin, stdout, stderr = ssh.exec_command("df -h / | tail -1", timeout=5)
            disk_line = stdout.read().decode().strip()
            parts = disk_line.split()
            
            return {
                'filesystem': parts[0],
                'total': parts[1],
                'used': parts[2],
                'available': parts[3],
                'percent': int(parts[4].rstrip('%'))
            }
        except:
            return {'filesystem': 'Unknown', 'total': '0', 'used': '0', 'available': '0', 'percent': 0}
    
    def _get_remote_load_average(self, ssh) -> List[float]:
        """Get load average from remote server"""
        try:
            stdin, stdout, stderr = ssh.exec_command("cat /proc/loadavg", timeout=5)
            load_str = stdout.read().decode().strip()
            parts = load_str.split()
            return [float(parts[0]), float(parts[1]), float(parts[2])]
        except:
            return [0.0, 0.0, 0.0]
    
    def _get_remote_uptime(self, ssh) -> str:
        """Get uptime from remote server"""
        try:
            stdin, stdout, stderr = ssh.exec_command("uptime -p", timeout=5)
            return stdout.read().decode().strip()
        except:
            return "Unknown"
    
    def _get_remote_network_info(self, ssh) -> Dict:
        """Get network interface information from remote server"""
        try:
            stdin, stdout, stderr = ssh.exec_command("ip addr show", timeout=5)
            return {'interfaces': stdout.read().decode().strip()}
        except:
            return {'interfaces': 'Unknown'}
    
    def start_monitoring(self, interval: int = 60):
        """Start continuous monitoring of all accessible servers"""
        self.running = True
        self.scan_thread = threading.Thread(target=self._monitor_loop, args=(interval,))
        self.scan_thread.daemon = True
        self.scan_thread.start()
        logger.info("Started multi-server monitoring")
    
    def stop_monitoring(self):
        """Stop monitoring"""
        self.running = False
        if self.scan_thread:
            self.scan_thread.join(timeout=1)
        logger.info("Stopped multi-server monitoring")
    
    def _monitor_loop(self, interval: int):
        """Main monitoring loop"""
        while self.running:
            try:
                # Get status of all accessible servers
                for ip in list(self.accessible_servers.keys()):
                    status = self.get_server_status(ip)
                    if status:
                        self.scan_results[ip] = status
                
                time.sleep(interval)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(interval)
    
    def get_all_servers_status(self) -> Dict:
        """Get status of all monitored servers"""
        return {
            'discovered_servers': len(self.discovered_servers),
            'accessible_servers': len(self.accessible_servers),
            'server_status': self.scan_results,
            'last_scan': datetime.now()
        }
    
    def export_results(self, filename: str = None):
        """Export discovery and monitoring results"""
        if filename is None:
            filename = f"network_discovery_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        data = {
            'discovery_info': {
                'discovered_servers': self.discovered_servers,
                'accessible_servers': self.accessible_servers,
                'scan_results': self.scan_results
            },
            'exported_at': datetime.now().isoformat()
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        
        logger.info(f"Results exported to {filename}")
        return filename 