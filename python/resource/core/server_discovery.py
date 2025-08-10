#!/usr/bin/env python3.12
"""
Server Discovery and Management Module
Discovers servers in the network and manages SSH connections
"""

import subprocess
import socket
import threading
import time
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import ipaddress

class ServerDiscovery:
    def __init__(self):
        self.discovered_servers = {}  # {ip: {'status': 'discovered', 'ssh_connected': False, 'info': {}}}
        self.connected_servers = {}   # {ip: {'ssh_connected': True, 'info': {}, 'last_check': datetime}}
        self.scanning = False
        
        # Get dynamic network ranges
        try:
            from utils.network_utils import get_network_ranges
            self.network_ranges = get_network_ranges()
        except ImportError:
            # Fallback to default ranges
            self.network_ranges = ['192.168.1.0/24', '10.0.0.0/8', '172.16.0.0/12']
        
    def scan_network(self, network_range: str = None) -> Dict[str, dict]:
        """Scan network for active servers"""
        if network_range:
            ranges = [network_range]
        else:
            ranges = self.network_ranges
            
        self.scanning = True
        discovered = {}
        
        print(f"🔍 Scanning networks: {ranges}")
        
        for network in ranges:
            try:
                network_obj = ipaddress.IPv4Network(network, strict=False)
                print(f"📡 Scanning {network} ({network_obj.num_addresses} addresses)")
                
                # Use threading to speed up scanning
                threads = []
                results = {}
                
                def scan_ip(ip):
                    if self._ping_host(str(ip)):
                        results[str(ip)] = {
                            'status': 'discovered',
                            'ssh_connected': False,
                            'discovered_at': datetime.now().isoformat(),
                            'network': network
                        }
                
                # Create threads for each IP
                for ip in network_obj.hosts():
                    if not self.scanning:  # Allow stopping the scan
                        break
                    thread = threading.Thread(target=scan_ip, args=(ip,))
                    threads.append(thread)
                    thread.start()
                    
                    # Limit concurrent threads
                    if len(threads) >= 50:
                        for t in threads:
                            t.join()
                        threads = []
                
                # Wait for remaining threads
                for t in threads:
                    t.join()
                
                discovered.update(results)
                
            except Exception as e:
                print(f"❌ Error scanning {network}: {e}")
        
        self.scanning = False
        self.discovered_servers.update(discovered)
        
        print(f"✅ Discovered {len(discovered)} servers")
        return discovered
    
    def _ping_host(self, ip: str) -> bool:
        """Ping a single host to check if it's alive"""
        try:
            result = subprocess.run(
                ['ping', '-c', '1', '-W', '1', ip],
                capture_output=True,
                text=True,
                timeout=3
            )
            return result.returncode == 0
        except:
            return False
    
    def test_ssh_connection(self, ip: str, username: str = 'root', password: str = None) -> bool:
        """Test SSH connection to a server"""
        try:
            if password:
                # Use sshpass for password authentication
                result = subprocess.run([
                    'sshpass', '-p', password,
                    'ssh', '-o', 'ConnectTimeout=5',
                    '-o', 'StrictHostKeyChecking=no',
                    f'{username}@{ip}', 'echo "SSH test successful"'
                ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            else:
                # Try key-based authentication first
                result = subprocess.run([
                    'ssh', '-o', 'ConnectTimeout=5',
                    '-o', 'BatchMode=yes',
                    '-o', 'StrictHostKeyChecking=no',
                    f'{username}@{ip}', 'echo "SSH test successful"'
                ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
                
                # If key-based auth fails, try without BatchMode (allows password prompt)
                if result.returncode != 0:
                    result = subprocess.run([
                        'ssh', '-o', 'ConnectTimeout=5',
                        '-o', 'StrictHostKeyChecking=no',
                        f'{username}@{ip}', 'echo "SSH test successful"'
                    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            
            return result.returncode == 0
        except Exception as e:
            print(f"SSH test error: {e}")
            return False
    
    def connect_to_server(self, ip: str, username: str = 'root', password: str = None) -> bool:
        """Establish SSH connection to a server"""
        # Special handling for Docker containers
        if ip.startswith('docker://'):
            print(f"🐳 Connecting to Docker container ({ip})")
            try:
                container_id = ip.replace('docker://', '')
                
                # Get container information
                import subprocess
                import json
                
                # Get container details
                result = subprocess.run([
                    'docker', 'inspect', container_id
                ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
                
                if result.returncode == 0:
                    container_data = json.loads(result.stdout)[0]
                    container_name = container_data.get('Name', '').lstrip('/')
                    container_image = container_data.get('Config', {}).get('Image', 'Unknown')
                    container_status = container_data.get('State', {}).get('Status', 'Unknown')
                    
                    # Get container resource usage
                    stats_result = subprocess.run([
                        'docker', 'stats', container_id, '--no-stream', '--format', 'json'
                    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=5)
                    
                    cpu_percent = 0
                    memory_percent = 0
                    memory_usage = 'Unknown'
                    
                    if stats_result.returncode == 0:
                        stats = json.loads(stats_result.stdout.strip())
                        cpu_percent = float(stats.get('CPUPerc', '0%').rstrip('%'))
                        memory_percent = float(stats.get('MemPerc', '0%').rstrip('%'))
                        memory_usage = stats.get('MemUsage', '0B / 0B')
                    
                    # Create container info
                    container_info = {
                        'id': container_id,
                        'name': container_name,
                        'status': container_status,
                        'image': container_image,
                        'cpu_percent': cpu_percent,
                        'memory_percent': memory_percent,
                        'memory_usage': memory_usage
                    }
                    
                    system_info = {
                        'cpu_percent': cpu_percent,
                        'memory_percent': memory_percent,
                        'disk_percent': 0,
                        'load_avg': 0
                    }
                    
                    self.connected_servers[ip] = {
                        'ssh_connected': False,  # Containers don't use SSH
                        'username': 'container',
                        'password': '',
                        'info': {
                            'hostname': container_name,
                            'os': f"Docker Container ({container_image})",
                            'cpu_cores': 'Container',
                            'ip': ip,
                            'status': 'Online'
                        },
                        'container_info': container_info,
                        'system_info': system_info,
                        'connected_at': datetime.now().isoformat(),
                        'last_check': datetime.now().isoformat(),
                        'type': 'docker_container'
                    }
                    
                    print(f"✅ Connected to container {container_name} with CPU: {cpu_percent}%, Memory: {memory_percent}%")
                    return True
                else:
                    print(f"❌ Failed to get container info for {ip}")
                    return False
                    
            except Exception as e:
                print(f"❌ Failed to connect to container {ip}: {e}")
                return False
        
        # Special handling for localhost
        if ip in ['127.0.0.1', 'localhost']:
            print(f"🔗 Connecting to localhost ({ip})")
            try:
                # For localhost, we can get info directly without SSH
                import psutil
                import platform
                
                server_info = {
                    'hostname': platform.node(),
                    'os': platform.platform(),
                    'cpu_cores': psutil.cpu_count(),
                    'ip': ip,
                    'status': 'Online'
                }
                
                # Get real-time system information
                system_info = {
                    'cpu_percent': psutil.cpu_percent(interval=1),
                    'memory_percent': psutil.virtual_memory().percent,
                    'disk_percent': psutil.disk_usage('/').percent,
                    'load_avg': psutil.getloadavg()[0] if hasattr(psutil, 'getloadavg') else 0.0
                }
                
                # Merge the information
                server_info.update(system_info)
                
                self.connected_servers[ip] = {
                    'ssh_connected': True,
                    'username': username,
                    'password': password,
                    'info': server_info,
                    'connected_at': datetime.now().isoformat(),
                    'last_check': datetime.now().isoformat()
                }
                
                # Update discovered servers
                if ip in self.discovered_servers:
                    self.discovered_servers[ip]['ssh_connected'] = True
                    self.discovered_servers[ip]['info'] = server_info
                
                print(f"✅ Connected to localhost with CPU: {system_info.get('cpu_percent', 0)}%, Memory: {system_info.get('memory_percent', 0)}%")
                return True
                
            except Exception as e:
                print(f"❌ Failed to connect to localhost: {e}")
                return False
        
        # Regular SSH connection for remote servers
        if self.test_ssh_connection(ip, username, password):
            print(f"Debug: SSH test passed for {ip}")
            # Get server information
            server_info = self._get_server_info(ip, username, password)
            print(f"Debug: Got server info: {server_info}")
            
            # Get real-time system information
            print(f"Debug: Getting system info for {ip}")
            system_info = self._get_system_info(ip, username, password)
            print(f"Debug: Got system info: {system_info}")
            
            # Merge the information
            server_info.update(system_info)
            
            self.connected_servers[ip] = {
                'ssh_connected': True,
                'username': username,
                'password': password,  # Store for future use
                'info': server_info,
                'connected_at': datetime.now().isoformat(),
                'last_check': datetime.now().isoformat()
            }
            
            # Update discovered servers
            if ip in self.discovered_servers:
                self.discovered_servers[ip]['ssh_connected'] = True
                self.discovered_servers[ip]['info'] = server_info
            
            print(f"✅ Connected to {ip} with CPU: {system_info.get('cpu_percent', 0)}%, Memory: {system_info.get('memory_percent', 0)}%")
            return True
        else:
            print(f"❌ Failed to connect to {ip}")
            return False
    
    def _get_server_info(self, ip: str, username: str, password: str = None) -> dict:
        """Get basic server information via SSH"""
        try:
            if password:
                ssh_prefix = f'sshpass -p "{password}" ssh -o StrictHostKeyChecking=no {username}@{ip}'
            else:
                ssh_prefix = f'ssh -o BatchMode=yes {username}@{ip}'
            
            # Get hostname
            hostname_cmd = f'{ssh_prefix} "hostname"'
            hostname_result = subprocess.run(hostname_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            hostname = hostname_result.stdout.strip() if hostname_result.returncode == 0 else ip
            
            # Get OS info
            os_cmd = f'{ssh_prefix} "cat /etc/os-release | grep PRETTY_NAME | cut -d\\"\\" -f2"'
            os_result = subprocess.run(os_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            os_info = os_result.stdout.strip() if os_result.returncode == 0 else "Unknown"
            
            # Get CPU info
            cpu_cmd = f'{ssh_prefix} "nproc"'
            cpu_result = subprocess.run(cpu_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            cpu_cores = cpu_result.stdout.strip() if cpu_result.returncode == 0 else "Unknown"
            
            return {
                'hostname': hostname,
                'os': os_info,
                'cpu_cores': cpu_cores,
                'ip': ip,
                'status': 'Online'
            }
            
        except Exception as e:
            return {
                'hostname': ip,
                'os': 'Unknown',
                'cpu_cores': 'Unknown',
                'ip': ip,
                'status': 'Error',
                'error': str(e)
            }
    
    def disconnect_from_server(self, ip: str) -> bool:
        """Disconnect from a server"""
        if ip in self.connected_servers:
            del self.connected_servers[ip]
            
            if ip in self.discovered_servers:
                self.discovered_servers[ip]['ssh_connected'] = False
            
            print(f"✅ Disconnected from {ip}")
            return True
        return False
    
    def get_connected_servers_info(self) -> dict:
        """Get information from all connected servers"""
        servers_info = {}
        
        for ip, connection in self.connected_servers.items():
            try:
                # Get real-time system information
                system_info = self._get_system_info(ip, connection['username'], connection.get('password'))
                
                servers_info[ip] = {
                    'name': connection['info'].get('hostname', ip),
                    'ip': ip,
                    'status': 'Online',
                    'ssh_connected': True,
                    'system_info': system_info,
                    'last_check': datetime.now().isoformat()
                }
                
                # Update last check time
                self.connected_servers[ip]['last_check'] = datetime.now().isoformat()
                
            except Exception as e:
                servers_info[ip] = {
                    'name': connection['info'].get('hostname', ip),
                    'ip': ip,
                    'status': 'Error',
                    'ssh_connected': False,
                    'error': str(e),
                    'last_check': datetime.now().isoformat()
                }
        
        # Add Docker containers information
        docker_containers = self._get_docker_containers_info()
        servers_info.update(docker_containers)
        
        return servers_info
    
    def _get_docker_containers_info(self) -> dict:
        """Get information about running Docker containers"""
        containers_info = {}
        
        try:
            import subprocess
            import json
            
            # Get running containers
            result = subprocess.run([
                'docker', 'ps', '--format', 'json'
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            
            if result.returncode == 0:
                containers = []
                for line in result.stdout.strip().split('\n'):
                    if line.strip():
                        try:
                            container = json.loads(line)
                            containers.append(container)
                        except:
                            continue
                
                for container in containers:
                    container_id = container.get('ID', '')[:12]  # Short ID
                    container_name = container.get('Names', 'Unknown')
                    container_status = container.get('Status', 'Unknown')
                    container_image = container.get('Image', 'Unknown')
                    
                    # Get container resource usage
                    try:
                        stats_result = subprocess.run([
                            'docker', 'stats', container_id, '--no-stream', '--format', 'json'
                        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=5)
                        
                        if stats_result.returncode == 0:
                            stats = json.loads(stats_result.stdout.strip())
                            cpu_percent = stats.get('CPUPerc', '0%').rstrip('%')
                            memory_percent = stats.get('MemPerc', '0%').rstrip('%')
                            memory_usage = stats.get('MemUsage', '0B / 0B')
                        else:
                            cpu_percent = 0
                            memory_percent = 0
                            memory_usage = 'Unknown'
                    except:
                        cpu_percent = 0
                        memory_percent = 0
                        memory_usage = 'Unknown'
                    
                    # Create container info
                    container_ip = f"docker://{container_id}"
                    containers_info[container_ip] = {
                        'name': f"Container: {container_name}",
                        'ip': container_ip,
                        'status': 'Online' if 'Up' in container_status else 'Stopped',
                        'ssh_connected': False,  # Containers don't use SSH
                        'container_info': {
                            'id': container_id,
                            'name': container_name,
                            'status': container_status,
                            'image': container_image,
                            'cpu_percent': float(cpu_percent) if cpu_percent.isdigit() else 0,
                            'memory_percent': float(memory_percent) if memory_percent.isdigit() else 0,
                            'memory_usage': memory_usage
                        },
                        'system_info': {
                            'cpu_percent': float(cpu_percent) if cpu_percent.isdigit() else 0,
                            'memory_percent': float(memory_percent) if memory_percent.isdigit() else 0,
                            'disk_percent': 0,
                            'load_avg': 0
                        },
                        'last_check': datetime.now().isoformat(),
                        'type': 'docker_container'
                    }
                    
        except Exception as e:
            print(f"Error getting Docker containers info: {e}")
        
        return containers_info
    
    def _get_system_info(self, ip: str, username: str, password: str = None) -> dict:
        """Get real-time system information from server"""
        try:
            if password:
                ssh_prefix = f'sshpass -p "{password}" ssh -o StrictHostKeyChecking=no {username}@{ip}'
            else:
                ssh_prefix = f'ssh -o BatchMode=yes {username}@{ip}'
            
            # Get CPU usage - using mpstat for better reliability
            cpu_cmd = f'{ssh_prefix} "mpstat 1 1 | tail -1"'
            print(f"Debug: Running CPU command: {cpu_cmd}")
            cpu_result = subprocess.run(cpu_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            print(f"Debug: CPU result stdout: '{cpu_result.stdout.strip()}'")
            print(f"Debug: CPU result stderr: '{cpu_result.stderr.strip()}'")
            
            cpu_usage = 0.0
            if cpu_result.stdout.strip():
                # Parse the mpstat output: "Average: all 2.77 8.52 0.82 0.00 0.11 0.15 0.00 0.00 0.00 87.62"
                parts = cpu_result.stdout.strip().split()
                print(f"Debug: mpstat parts: {parts}")
                if len(parts) >= 12:
                    idle_percent = float(parts[11])  # The last number is idle percentage
                    cpu_usage = 100.0 - idle_percent
                    print(f"Debug: Idle percent: {idle_percent}, CPU usage: {cpu_usage}")
            
            print(f"Debug: CPU usage: {cpu_usage}")
            
            # Get memory usage - using shell=True with simpler command
            mem_cmd = f'{ssh_prefix} "free | grep Mem"'
            mem_result = subprocess.run(mem_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            print(f"Debug: Memory result stdout: '{mem_result.stdout.strip()}'")
            print(f"Debug: Memory result stderr: '{mem_result.stderr.strip()}'")
            
            memory_info = {}
            if mem_result.stdout.strip():
                # Parse manually: "Mem: 263485608 95417240 134056472 0 0 0"
                parts = mem_result.stdout.strip().split()
                if len(parts) >= 4:
                    total = int(parts[1])
                    used = int(parts[2])
                    free = int(parts[3])
                    mem_percent = (used / total) * 100 if total > 0 else 0
                    memory_info = {
                        'total_mb': total // 1024 // 1024,  # Convert to MB
                        'used_mb': used // 1024 // 1024,
                        'free_mb': free // 1024 // 1024,
                        'percent': mem_percent
                    }
                    print(f"Debug: Memory calculation: {mem_percent:.1f}%")
            
            # Get disk usage - using shell=True
            disk_cmd = f'{ssh_prefix} "df -h / | tail -1"'
            print(f"Debug: Running disk command: {disk_cmd}")
            disk_result = subprocess.run(disk_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            print(f"Debug: Disk result stdout: '{disk_result.stdout.strip()}'")
            print(f"Debug: Disk result stderr: '{disk_result.stderr.strip()}'")
            
            disk_info = {}
            if disk_result.stdout.strip():
                parts = disk_result.stdout.strip().split()
                if len(parts) >= 5:
                    disk_info = {
                        'total': parts[1],
                        'used': parts[2],
                        'available': parts[3],
                        'percent': int(parts[4].rstrip('%')) if parts[4].endswith('%') else 0
                    }
            
            # Get detailed disk information (partitions)
            disk_partitions_cmd = f'{ssh_prefix} "df -h | grep -E \'^/dev/\' | head -5"'
            disk_partitions_result = subprocess.run(disk_partitions_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            
            partitions = []
            if disk_partitions_result.stdout.strip():
                for line in disk_partitions_result.stdout.strip().split('\n'):
                    if line.strip():
                        parts = line.split()
                        if len(parts) >= 6:
                            partitions.append({
                                'device': parts[0],
                                'mountpoint': parts[5],
                                'fstype': 'unknown',
                                'usage': {
                                    'total': parts[1],
                                    'used': parts[2],
                                    'available': parts[3],
                                    'percent': int(parts[4].rstrip('%')) if parts[4].endswith('%') else 0
                                }
                            })
            
            # Get top processes
            processes_cmd = f'{ssh_prefix} "ps aux --sort=-%cpu | head -11 | tail -10"'
            processes_result = subprocess.run(processes_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            
            processes = []
            if processes_result.stdout.strip():
                for line in processes_result.stdout.strip().split('\n'):
                    if line.strip():
                        parts = line.split()
                        if len(parts) >= 11:
                            try:
                                processes.append({
                                    'pid': int(parts[1]),
                                    'name': parts[10][:20],  # Truncate long process names
                                    'cpu_percent': float(parts[2]),
                                    'memory_percent': float(parts[3]),
                                    'status': 'R'  # Assume running
                                })
                            except (ValueError, IndexError):
                                continue
            
            # Get load average - using shell=True with simpler command
            load_cmd = f'{ssh_prefix} "cat /proc/loadavg | awk \'{{print $1}}\'"'
            load_result = subprocess.run(load_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            print(f"Debug: Load result stdout: '{load_result.stdout.strip()}'")
            print(f"Debug: Load result stderr: '{load_result.stderr.strip()}'")
            # Extract just the first number from the loadavg output
            load_output = load_result.stdout.strip()
            if load_output:
                load_parts = load_output.split()
                load_avg = float(load_parts[0]) if load_parts else 0.0
            else:
                load_avg = 0.0
            print(f"Debug: Load average: {load_avg}")
            
            return {
                'cpu_percent': cpu_usage,
                'memory_percent': memory_info.get('percent', 0),
                'disk_percent': disk_info.get('percent', 0),
                'load_avg': load_avg,
                'memory_info': memory_info,
                'disk_info': disk_info,
                'disk_partitions': partitions,
                'processes': processes
            }
            
        except Exception as e:
            print(f"Debug: Error in _get_system_info: {e}")
            return {
                'cpu_percent': 0,
                'memory_percent': 0,
                'disk_percent': 0,
                'load_avg': 0,
                'disk_partitions': [],
                'processes': [],
                'error': str(e)
            }
    
    def save_configuration(self, filename: str = 'server_config.json'):
        """Save server configuration to file"""
        config = {
            'discovered_servers': self.discovered_servers,
            'connected_servers': {ip: {k: v for k, v in info.items() if k != 'password'} 
                                for ip, info in self.connected_servers.items()},
            'network_ranges': self.network_ranges,
            'last_updated': datetime.now().isoformat()
        }
        
        try:
            with open(filename, 'w') as f:
                json.dump(config, f, indent=2, default=str)
            print(f"✅ Configuration saved to {filename}")
            return True
        except Exception as e:
            print(f"❌ Error saving configuration: {e}")
            return False
    
    def load_configuration(self, filename: str = 'server_config.json'):
        """Load server configuration from file"""
        try:
            if os.path.exists(filename):
                with open(filename, 'r') as f:
                    config = json.load(f)
                
                self.discovered_servers = config.get('discovered_servers', {})
                self.connected_servers = config.get('connected_servers', {})
                self.network_ranges = config.get('network_ranges', self.network_ranges)
                
                print(f"✅ Configuration loaded from {filename}")
                return True
            else:
                print(f"📄 No configuration file found: {filename}")
                return False
        except Exception as e:
            print(f"❌ Error loading configuration: {e}")
            return False
    
    def stop_scanning(self):
        """Stop network scanning"""
        self.scanning = False
        print("🛑 Network scanning stopped")
    
    def get_status_summary(self) -> dict:
        """Get summary of discovery and connection status"""
        return {
            'scanning': self.scanning,
            'discovered_count': len(self.discovered_servers),
            'connected_count': len(self.connected_servers),
            'network_ranges': self.network_ranges,
            'discovered_servers': list(self.discovered_servers.keys()),
            'connected_servers': list(self.connected_servers.keys())
        } 