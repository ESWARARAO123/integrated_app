#!/usr/bin/env python3.12
"""
Web-based Dashboard for RHEL Resource Manager
Automated dashboard that updates every 5 seconds
"""

import os
import sys
import time
import json
import threading
import webbrowser
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import psutil
import subprocess

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from scripts.real_time_charts import RealTimeCharts
    from scripts.chart_generator import ChartGenerator
except ImportError:
    try:
        from scripts.real_time_charts import RealTimeCharts
        from scripts.chart_generator import ChartGenerator
    except ImportError:
        print("Warning: Chart modules not found. Some features may not work.")

class DashboardData:
    """Manages dashboard data and updates"""
    
    def __init__(self):
        try:
            self.charts = RealTimeCharts()
        except Exception as e:
            print(f"Warning: Could not initialize charts: {e}")
            self.charts = None
        
        # Initialize server discovery
        try:
            from core.server_discovery import ServerDiscovery
            self.server_discovery = ServerDiscovery()
            self.server_discovery.load_configuration()  # Load existing configuration
            print("✅ Server discovery initialized")
        except ImportError as e:
            print(f"Warning: Server discovery module not available: {e}")
            self.server_discovery = None
        except Exception as e:
            print(f"Warning: Could not initialize server discovery: {e}")
            self.server_discovery = None
        
        # Initialize network scanner
        try:
            from utils.quick_network_scanner import QuickNetworkScanner
            self.network_scanner = QuickNetworkScanner()
            print("✅ Quick network scanner initialized")
        except ImportError as e:
            print(f"Warning: Quick network scanner module not available: {e}")
            self.network_scanner = None
        except Exception as e:
            print(f"Warning: Could not initialize quick network scanner: {e}")
            self.network_scanner = None
        
        self.data = {}
        self.update_interval = 5  # seconds
        self.running = False
        self.update_thread = None
        self.current_server = None  # Track current server selection
        
    def start_monitoring(self):
        """Start continuous monitoring"""
        # Initialize current server to local IP
        try:
            from utils.network_utils import get_local_ip
            self.current_server = get_local_ip()
        except:
            self.current_server = '127.0.0.1'
        
        self.running = True
        self.update_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.update_thread.start()
        
    def stop_monitoring(self):
        """Stop monitoring"""
        self.running = False
        if self.update_thread:
            self.update_thread.join(timeout=1)
    
    def set_current_server(self, server_ip):
        """Set the current server and refresh data"""
        from utils.network_utils import get_local_ip
        local_ip = get_local_ip()
        
        if server_ip == 'LOCAL_IP' or server_ip == local_ip:
            self.current_server = local_ip
        else:
            self.current_server = server_ip
        
        # Refresh data for the new server
        self.update_data()
        print(f"✅ Switched to server: {self.current_server}")
    
    def _monitor_loop(self):
        """Main monitoring loop"""
        while self.running:
            self.update_data()
            time.sleep(self.update_interval)
    
    def update_data(self):
        """Update all dashboard data"""
        try:
            # System information
            self.data['timestamp'] = datetime.now().isoformat()
            self.data['system_info'] = self._get_system_info()
            self.data['resource_usage'] = self._get_resource_usage()
            self.data['processes'] = self._get_top_processes()
            self.data['network_info'] = self._get_network_info()
            self.data['disk_info'] = self._get_disk_info()
            self.data['alerts'] = self._get_alerts()
            self.data['multi_server'] = self._get_multi_server_info()
            
            # Update charts data
            if self.charts:
                try:
                    self.charts.update_data()
                except Exception as e:
                    print(f"Error updating charts: {e}")
            
        except Exception as e:
            print(f"Error updating data: {e}")
    
    def _get_system_info(self):
        """Get basic system information"""
        try:
            import platform
            import os
            
            # Get system information
            hostname = platform.node()
            platform_info = platform.platform()
            cpu_count = psutil.cpu_count()
            
            # Get CPU frequency
            cpu_freq = None
            try:
                freq = psutil.cpu_freq()
                if freq:
                    cpu_freq = {
                        'current': freq.current,
                        'min': freq.min,
                        'max': freq.max
                    }
            except:
                pass
            
            # Get boot time and uptime
            boot_time = psutil.boot_time()
            boot_time_str = datetime.fromtimestamp(boot_time).isoformat()
            uptime = datetime.now() - datetime.fromtimestamp(boot_time)
            uptime_str = str(uptime).split('.')[0]  # Remove microseconds
            
            # Get load average
            try:
                load_avg = psutil.getloadavg()
            except (AttributeError, OSError):
                # Fallback for systems without getloadavg
                load_avg = [0.0, 0.0, 0.0]
            
            return {
                'hostname': hostname,
                'platform': platform_info,
                'cpu_count': cpu_count,
                'cpu_freq': cpu_freq,
                'boot_time': boot_time_str,
                'uptime': uptime_str,
                'load_avg': load_avg
            }
        except Exception as e:
            print(f"Error getting system info: {e}")
            return {
                'hostname': 'Unknown',
                'platform': 'Unknown',
                'cpu_count': 0,
                'cpu_freq': {},
                'boot_time': 'Unknown',
                'uptime': 'Unknown',
                'load_avg': [0, 0, 0]
            }
    
    def _get_resource_usage(self):
        """Get current resource usage"""
        try:
            # Get CPU usage
            cpu_percent = psutil.cpu_percent(interval=0.1)  # Reduced interval for faster response
            
            # Get memory information
            memory = psutil.virtual_memory()
            
            # Get swap information
            swap_percent = 0
            try:
                swap = psutil.swap_memory()
                swap_percent = swap.percent
            except:
                pass
            
            return {
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'memory_used': memory.used,
                'memory_total': memory.total,
                'memory_available': memory.available,
                'swap_percent': swap_percent
            }
        except Exception as e:
            print(f"Error getting resource usage: {e}")
            return {
                'cpu_percent': 0,
                'memory_percent': 0,
                'memory_used': 0,
                'memory_total': 0,
                'memory_available': 0,
                'swap_percent': 0
            }
    
    def _get_top_processes(self):
        """Get top processes by resource usage"""
        try:
            # Check if we have a remote server selected
            if hasattr(self, 'current_server') and self.current_server:
                from utils.network_utils import is_local_server
                if not is_local_server(self.current_server) and self.server_discovery:
                    # Get remote server processes
                    if self.current_server in self.server_discovery.connected_servers:
                        server_info = self.server_discovery.connected_servers[self.current_server]
                        if 'info' in server_info and 'processes' in server_info['info']:
                            return server_info['info']['processes']
            
            # Local server or fallback - use psutil
            processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status']):
                try:
                    proc_info = proc.info
                    # Ensure all required fields are present
                    proc_info['cpu_percent'] = proc_info.get('cpu_percent', 0)
                    proc_info['memory_percent'] = proc_info.get('memory_percent', 0)
                    proc_info['name'] = proc_info.get('name', 'Unknown')
                    proc_info['pid'] = proc_info.get('pid', 0)
                    proc_info['status'] = proc_info.get('status', 'Unknown')
                    processes.append(proc_info)
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
            
            # Sort by CPU usage and get top 10
            processes.sort(key=lambda x: x['cpu_percent'], reverse=True)
            return processes[:10]
        except Exception as e:
            print(f"Error getting processes: {e}")
            return []
    
    def _get_network_info(self):
        """Get network information"""
        try:
            net_io = psutil.net_io_counters()
            net_if = psutil.net_if_addrs()
            
            return {
                'bytes_sent': net_io.bytes_sent,
                'bytes_recv': net_io.bytes_recv,
                'packets_sent': net_io.packets_sent,
                'packets_recv': net_io.packets_recv,
                'interfaces': list(net_if.keys())
            }
        except Exception as e:
            print(f"Error getting network info: {e}")
            return {
                'bytes_sent': 0,
                'bytes_recv': 0,
                'packets_sent': 0,
                'packets_recv': 0,
                'interfaces': []
            }
    
    def _get_disk_info(self):
        """Get disk information"""
        try:
            # Check if we have a remote server selected
            if hasattr(self, 'current_server') and self.current_server:
                from utils.network_utils import is_local_server
                if not is_local_server(self.current_server) and self.server_discovery:
                    # Get remote server disk info
                    if self.current_server in self.server_discovery.connected_servers:
                        server_info = self.server_discovery.connected_servers[self.current_server]
                        if 'info' in server_info and 'disk_partitions' in server_info['info']:
                            partitions = server_info['info']['disk_partitions']
                            root_usage = None
                            
                            # Find root partition
                            for partition in partitions:
                                if partition.get('mountpoint') == '/':
                                    root_usage = partition.get('usage', {})
                                    break
                            
                            if not root_usage:
                                # Use first partition as fallback
                                root_usage = partitions[0].get('usage', {}) if partitions else {}
                            
                            return {
                                'root_usage': root_usage,
                                'partitions': partitions
                            }
            
            # Local server or fallback - use psutil
            disk_usage = psutil.disk_usage('/')
            disk_partitions = psutil.disk_partitions()
            
            partitions = []
            for p in disk_partitions[:5]:  # Limit to 5 partitions
                try:
                    if os.path.exists(p.mountpoint):
                        usage = psutil.disk_usage(p.mountpoint)
                        partitions.append({
                            'device': p.device,
                            'mountpoint': p.mountpoint,
                            'fstype': p.fstype,
                            'usage': {
                                'total': usage.total,
                                'used': usage.used,
                                'free': usage.free,
                                'percent': usage.percent
                            }
                        })
                except:
                    continue
            
            return {
                'root_usage': {
                    'total': disk_usage.total,
                    'used': disk_usage.used,
                    'free': disk_usage.free,
                    'percent': disk_usage.percent
                },
                'partitions': partitions
            }
        except Exception as e:
            print(f"Error getting disk info: {e}")
            return {
                'root_usage': {
                    'total': 0,
                    'used': 0,
                    'free': 0,
                    'percent': 0
                },
                'partitions': []
            }
    
    def _get_alerts(self):
        """Get system alerts"""
        alerts = []
        try:
            # CPU alert
            if self.data.get('resource_usage', {}).get('cpu_percent', 0) > 80:
                alerts.append({
                    'type': 'warning',
                    'message': f"High CPU usage: {self.data['resource_usage']['cpu_percent']:.1f}%",
                    'timestamp': datetime.now().isoformat()
                })
            
            # Memory alert
            if self.data.get('resource_usage', {}).get('memory_percent', 0) > 80:
                alerts.append({
                    'type': 'warning',
                    'message': f"High memory usage: {self.data['resource_usage']['memory_percent']:.1f}%",
                    'timestamp': datetime.now().isoformat()
                })
            
            # Disk alert
            if self.data.get('disk_info', {}).get('root_usage', {}).get('percent', 0) > 80:
                alerts.append({
                    'type': 'warning',
                    'message': f"High disk usage: {self.data['disk_info']['root_usage']['percent']:.1f}%",
                    'timestamp': datetime.now().isoformat()
                })
                
        except Exception as e:
            alerts.append({
                'type': 'error',
                'message': f"Error checking alerts: {e}",
                'timestamp': datetime.now().isoformat()
            })
        
        return alerts
    
    def _get_multi_server_info(self):
        """Get multi-server information"""
        server_status = {}
        
        # Local server (always available)
        try:
            import psutil
            from utils.network_utils import get_local_ip, get_hostname
            
            local_ip = get_local_ip()
            hostname = get_hostname()
            
            server_status[local_ip] = {
                'name': f'Local Server ({hostname})',
                'ip': local_ip,
                'status': 'Online',
                'cpu_percent': psutil.cpu_percent(interval=0.1),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent,
                'load_avg': psutil.getloadavg()[0] if hasattr(psutil, 'getloadavg') else 0.0
            }
        except Exception as e:
            from utils.network_utils import get_local_ip, get_hostname
            local_ip = get_local_ip()
            hostname = get_hostname()
            
            server_status[local_ip] = {
                'name': f'Local Server ({hostname})',
                'ip': local_ip,
                'status': 'Error',
                'error': str(e)
            }
        
        # Connected servers from server discovery
        if self.server_discovery:
            try:
                connected_servers = self.server_discovery.get_connected_servers_info()
                for ip, server_info in connected_servers.items():
                    if server_info.get('ssh_connected'):
                        # Format the data to match the expected structure
                        system_info = server_info.get('system_info', {})
                        server_status[ip] = {
                            'name': server_info.get('name', ip),
                            'ip': ip,
                            'status': 'Online',
                            'cpu_percent': system_info.get('cpu_percent', 0),
                            'memory_percent': system_info.get('memory_percent', 0),
                            'disk_percent': system_info.get('disk_percent', 0),
                            'load_avg': system_info.get('load_avg', 0)
                        }
                        print(f"✅ Added connected server {ip} with CPU: {system_info.get('cpu_percent', 0)}%, Memory: {system_info.get('memory_percent', 0)}%")
            except Exception as e:
                print(f"Error getting connected servers info: {e}")
                # Also try to get data directly from connected_servers
                try:
                    for ip, connection in self.server_discovery.connected_servers.items():
                        if connection.get('ssh_connected'):
                            info = connection.get('info', {})
                            server_status[ip] = {
                                'name': info.get('hostname', ip),
                                'ip': ip,
                                'status': 'Online',
                                'cpu_percent': info.get('cpu_percent', 0),
                                'memory_percent': info.get('memory_percent', 0),
                                'disk_percent': info.get('disk_percent', 0),
                                'load_avg': info.get('load_avg', 0)
                            }
                            print(f"✅ Added connected server {ip} from direct info")
                except Exception as e2:
                    print(f"Error getting direct connected servers info: {e2}")
        
        return server_status
    
    def _get_remote_server_details(self, ip):
        """Get detailed remote server information via SSH"""
        try:
            # Test SSH connectivity first
            ssh_test = subprocess.run(
                ['ssh', '-o', 'ConnectTimeout=3', '-o', 'BatchMode=yes', f'root@{ip}', 'echo "test"'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if ssh_test.returncode != 0:
                # SSH not available, use ping only
                ping_result = subprocess.run(
                    ['ping', '-c', '1', '-W', '1', ip],
                    capture_output=True,
                    text=True,
                    timeout=3
                )
                return {
                    'name': 'Remote Server',
                    'ip': ip,
                    'status': 'Online' if ping_result.returncode == 0 else 'Offline',
                    'note': 'SSH not available - use manual connection'
                }
            
            # SSH available, get detailed info
            # CPU usage
            cpu_cmd = "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1"
            cpu_result = subprocess.run(
                ['ssh', f'root@{ip}', cpu_cmd],
                capture_output=True,
                text=True,
                timeout=10
            )
            cpu_usage = float(cpu_result.stdout.strip()) if cpu_result.stdout.strip() else 0.0
            
            # Memory usage
            mem_cmd = "free -m | grep '^Mem:' | awk '{print $2, $3, $4, $3/$2*100}'"
            mem_result = subprocess.run(
                ['ssh', f'root@{ip}', mem_cmd],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            memory_percent = 0.0
            if mem_result.stdout.strip():
                parts = mem_result.stdout.strip().split()
                memory_percent = float(parts[3]) if len(parts) > 3 else 0.0
            
            # Disk usage
            disk_cmd = "df -h / | tail -1 | awk '{print $5}' | cut -d'%' -f1"
            disk_result = subprocess.run(
                ['ssh', f'root@{ip}', disk_cmd],
                capture_output=True,
                text=True,
                timeout=10
            )
            disk_percent = int(disk_result.stdout.strip()) if disk_result.stdout.strip() else 0
            
            # Load average
            load_cmd = "cat /proc/loadavg | awk '{print $1}'"
            load_result = subprocess.run(
                ['ssh', f'root@{ip}', load_cmd],
                capture_output=True,
                text=True,
                timeout=10
            )
            load_avg = float(load_result.stdout.strip()) if load_result.stdout.strip() else 0.0
            
            return {
                'name': 'Remote Server',
                'ip': ip,
                'status': 'Online',
                'cpu_percent': cpu_usage,
                'memory_percent': memory_percent,
                'disk_percent': disk_percent,
                'load_avg': load_avg
            }
            
        except Exception as e:
            return {
                'name': 'Remote Server',
                'ip': ip,
                'status': 'Error',
                'error': str(e)
            }

class DashboardHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the dashboard"""
    
    def __init__(self, *args, dashboard_data=None, **kwargs):
        self.dashboard_data = dashboard_data
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        if path == '/':
            self.send_dashboard_page()
        elif path == '/api/data':
            self.send_json_data()
        elif path == '/api/charts':
            self.send_chart_data()
        elif path == '/api/server-status':
            self.send_server_status()
        elif path == '/api/local-ip':
            self.send_local_ip()
        elif path.startswith('/static/'):
            self.send_static_file(path[8:])  # Remove '/static/' prefix
        else:
            self.send_error(404, "Not Found")
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        if path == '/api/scan-network':
            self.handle_scan_network()
        elif path == '/api/stop-scan':
            self.handle_stop_scan()
        elif path == '/api/connect-server':
            self.handle_connect_server()
        elif path == '/api/disconnect-server':
            self.handle_disconnect_server()
        elif path == '/api/save-config':
            self.handle_save_config()
        elif path == '/api/load-config':
            self.handle_load_config()
        elif path == '/api/switch-server':
            self.handle_switch_server()
        else:
            self.send_error(404, "Not Found")
    
    def send_dashboard_page(self):
        """Send the main dashboard HTML page"""
        html = self._get_dashboard_html()
        
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))
    
    def send_json_data(self):
        """Send JSON data for AJAX requests"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        data = self.dashboard_data.data if self.dashboard_data else {}
        self.wfile.write(json.dumps(data, default=str).encode('utf-8'))
    
    def send_chart_data(self):
        """Send chart data"""
        try:
            if self.dashboard_data and self.dashboard_data.charts:
                # Create a simple chart data
                chart_data = {
                    'cpu_data': list(self.dashboard_data.charts.cpu_data),
                    'memory_data': list(self.dashboard_data.charts.memory_data),
                    'timestamps': [str(ts) for ts in self.dashboard_data.charts.timestamps]
                }
            else:
                # Create dummy chart data if charts are not available
                chart_data = {
                    'cpu_data': [0, 0, 0, 0, 0],
                    'memory_data': [0, 0, 0, 0, 0],
                    'timestamps': [str(datetime.now()) for _ in range(5)]
                }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(chart_data, default=str).encode('utf-8'))
            
        except Exception as e:
            print(f"Error sending chart data: {e}")
            self.send_error(500, str(e))
    
    def send_static_file(self, filename):
        """Send static files (CSS, JS, images)"""
        try:
            if filename == 'style.css':
                content = self._get_css()
                content_type = 'text/css'
            elif filename == 'script.js':
                content = self._get_javascript()
                content_type = 'application/javascript'
            else:
                self.send_error(404, "File not found")
                return
            
            self.send_response(200)
            self.send_header('Content-type', content_type)
            self.end_headers()
            self.wfile.write(content.encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def send_server_status(self):
        """Send server discovery status"""
        try:
            if self.dashboard_data and self.dashboard_data.server_discovery:
                status = self.dashboard_data.server_discovery.get_status_summary()
                connected_servers = self.dashboard_data.server_discovery.connected_servers
                discovered_servers = self.dashboard_data.server_discovery.discovered_servers
                
                response = {
                    'success': True,
                    'status': status,
                    'connected_servers': connected_servers,
                    'discovered_servers': discovered_servers
                }
            else:
                response = {
                    'success': False,
                    'error': 'Server discovery not available'
                }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response, default=str).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def send_local_ip(self):
        """Send local IP address"""
        try:
            from utils.network_utils import get_local_ip, get_hostname
            
            response = {
                'success': True,
                'local_ip': get_local_ip(),
                'hostname': get_hostname()
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_scan_network(self):
        """Handle network scanning request"""
        try:
            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                post_data = self.rfile.read(content_length)
                request_data = json.loads(post_data.decode('utf-8'))
                network_range = request_data.get('network_range', '172.16.16')
                username = request_data.get('username', 'root')
                max_ips = request_data.get('max_ips', 50)
                start_ip = request_data.get('start_ip', 1)
            else:
                network_range = '172.16.16'
                username = 'root'
                max_ips = 50
                start_ip = 1
            
            # Use the network scanner from dashboard data
            if self.dashboard_data and self.dashboard_data.network_scanner:
                # Perform the scan synchronously to get immediate results
                try:
                    discovered = self.dashboard_data.network_scanner.quick_scan(network_range, username, max_ips=max_ips, start_ip=start_ip)
                    print(f"Network scan completed. Found {len(discovered)} SSH-accessible servers.")
                    
                    # Update server discovery with results
                    if self.dashboard_data and self.dashboard_data.server_discovery:
                        for server in discovered:
                            self.dashboard_data.server_discovery.discovered_servers[server['ip']] = {
                                'status': 'discovered',
                                'ssh_connected': False,
                                'info': server,
                                'discovered_at': server['discovered_at']
                            }
                    
                    response = {
                        'success': True,
                        'message': f'✅ Scan completed. Found {len(discovered)} SSH-accessible servers.',
                        'discovered_count': len(discovered),
                        'discovered_servers': self.dashboard_data.server_discovery.discovered_servers if self.dashboard_data and self.dashboard_data.server_discovery else {}
                    }
                except Exception as e:
                    print(f"Error during network scan: {e}")
                    response = {
                        'success': False,
                        'error': f'Scan failed: {str(e)}',
                        'discovered_count': 0,
                        'discovered_servers': {}
                    }
            else:
                # Fallback to old method
                if self.dashboard_data and self.dashboard_data.server_discovery:
                    try:
                        discovered = self.dashboard_data.server_discovery.scan_network()
                        print(f"Network scan completed. Found {len(discovered)} servers.")
                        
                        response = {
                            'success': True,
                            'message': f'✅ Scan completed. Found {len(discovered)} servers.',
                            'discovered_count': len(discovered),
                            'discovered_servers': self.dashboard_data.server_discovery.discovered_servers
                        }
                    except Exception as e:
                        print(f"Error during network scan: {e}")
                        response = {
                            'success': False,
                            'error': f'Scan failed: {str(e)}',
                            'discovered_count': 0,
                            'discovered_servers': {}
                        }
                else:
                    response = {
                        'success': False,
                        'error': 'Network scanner not available',
                        'discovered_count': 0,
                        'discovered_servers': {}
                    }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response, default=str).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_stop_scan(self):
        """Handle stop scanning request"""
        try:
            if self.dashboard_data and self.dashboard_data.server_discovery:
                self.dashboard_data.server_discovery.stop_scanning()
                response = {'success': True, 'message': 'Scan stopped'}
            else:
                response = {'success': False, 'error': 'Server discovery not available'}
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_connect_server(self):
        """Handle server connection request"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            ip = request_data.get('ip')
            username = request_data.get('username', 'root')
            password = request_data.get('password', '')
            
            if not ip:
                response = {'success': False, 'error': 'IP address is required'}
            elif self.dashboard_data and self.dashboard_data.server_discovery:
                success = self.dashboard_data.server_discovery.connect_to_server(ip, username, password)
                
                # If connection successful, fetch server information
                if success:
                    try:
                        # Get real-time system information
                        system_info = self.dashboard_data.server_discovery._get_system_info(ip, username, password)
                        if system_info:
                            # Update the connected servers list with real-time data
                            if ip in self.dashboard_data.server_discovery.connected_servers:
                                self.dashboard_data.server_discovery.connected_servers[ip]['info'].update(system_info)
                                self.dashboard_data.server_discovery.connected_servers[ip]['last_check'] = datetime.now().isoformat()
                            print(f"✅ Successfully connected to {ip} and fetched real-time system info")
                            print(f"   CPU: {system_info.get('cpu_percent', 0)}%, Memory: {system_info.get('memory_percent', 0)}%, Disk: {system_info.get('disk_percent', 0)}%")
                            print(f"   Processes: {len(system_info.get('processes', []))}, Partitions: {len(system_info.get('disk_partitions', []))}")
                        else:
                            print(f"⚠️  Connected to {ip} but couldn't fetch real-time system info")
                    except Exception as info_error:
                        print(f"⚠️  Connected to {ip} but error fetching real-time info: {info_error}")
                
                response = {
                    'success': success,
                    'message': f"Connection {'successful' if success else 'failed'} to {ip}"
                }
            else:
                response = {'success': False, 'error': 'Server discovery not available'}
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_disconnect_server(self):
        """Handle server disconnection request"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            ip = request_data.get('ip')
            
            if not ip:
                response = {'success': False, 'error': 'IP address is required'}
            elif self.dashboard_data and self.dashboard_data.server_discovery:
                success = self.dashboard_data.server_discovery.disconnect_from_server(ip)
                response = {
                    'success': success,
                    'message': f"Disconnection {'successful' if success else 'failed'} from {ip}"
                }
            else:
                response = {'success': False, 'error': 'Server discovery not available'}
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_save_config(self):
        """Handle save configuration request"""
        try:
            if self.dashboard_data and self.dashboard_data.server_discovery:
                success = self.dashboard_data.server_discovery.save_configuration()
                response = {
                    'success': success,
                    'message': 'Configuration saved successfully' if success else 'Failed to save configuration'
                }
            else:
                response = {'success': False, 'error': 'Server discovery not available'}
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_load_config(self):
        """Handle load configuration request"""
        try:
            if self.dashboard_data and self.dashboard_data.server_discovery:
                success = self.dashboard_data.server_discovery.load_configuration()
                response = {
                    'success': success,
                    'message': 'Configuration loaded successfully' if success else 'Failed to load configuration'
                }
            else:
                response = {'success': False, 'error': 'Server discovery not available'}
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_switch_server(self):
        """Handle switch server request"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            ip = request_data.get('ip')
            
            if not ip:
                response = {'success': False, 'error': 'IP address is required'}
            elif self.dashboard_data:
                self.dashboard_data.set_current_server(ip)
                response = {
                    'success': True,
                    'message': f"Switched to server {ip}"
                }
            else:
                response = {'success': False, 'error': 'Dashboard data not available'}
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def _get_dashboard_html(self):
        """Generate the main dashboard HTML"""
        return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RHEL Resource Manager - Live Dashboard</title>
    <link rel="stylesheet" href="/static/style.css">
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
</head>
<body>
    <div class="dashboard">
        <header class="dashboard-header">
            <h1>🚀 RHEL Resource Manager - Live Dashboard</h1>
            <div class="header-info">
                <div class="server-selector">
                    <label for="server-select">Server:</label>
                    <select id="server-select" onchange="changeServer()">
                        <option value="LOCAL_IP">Local Server (LOCAL_IP)</option>
                    </select>
                </div>
                <span id="last-update">Last Update: Loading...</span>
                <span id="status" class="status-indicator">🟢 Online</span>
                <button id="settings-btn" class="settings-btn" onclick="openSettings()">⚙️ Settings</button>
            </div>
        </header>
        
        <div class="dashboard-content">
            <!-- Quick Stats -->
            <div class="stats-grid">
                <div class="stat-card" id="cpu-card">
                    <h3>CPU Usage</h3>
                    <div class="stat-value" id="cpu-value">--</div>
                    <div class="stat-bar">
                        <div class="stat-bar-fill" id="cpu-bar"></div>
                    </div>
                </div>
                
                <div class="stat-card" id="memory-card">
                    <h3>Memory Usage</h3>
                    <div class="stat-value" id="memory-value">--</div>
                    <div class="stat-bar">
                        <div class="stat-bar-fill" id="memory-bar"></div>
                    </div>
                </div>
                
                <div class="stat-card" id="disk-card">
                    <h3>Disk Usage</h3>
                    <div class="stat-value" id="disk-value">--</div>
                    <div class="stat-bar">
                        <div class="stat-bar-fill" id="disk-bar"></div>
                    </div>
                </div>
                
                <div class="stat-card" id="process-card">
                    <h3>Active Processes</h3>
                    <div class="stat-value" id="process-value">--</div>
                    <div class="stat-subtitle">Running</div>
                </div>
            </div>
            
            <!-- Charts Section -->
            <div class="charts-section">
                <div class="chart-container">
                    <h3>Resource Usage Over Time</h3>
                    <div id="resource-chart"></div>
                </div>
            </div>
            
            <!-- System Information -->
            <div class="info-grid">
                <div class="info-card">
                    <h3>System Information</h3>
                    <div id="system-info"></div>
                </div>
                
                <div class="info-card">
                    <h3>Top Processes</h3>
                    <div id="process-list"></div>
                </div>
                
                <div class="info-card">
                    <h3>Network Information</h3>
                    <div id="network-info"></div>
                </div>
                
                <div class="info-card">
                    <h3>Alerts</h3>
                    <div id="alerts-list"></div>
                </div>
                
                <div class="info-card">
                    <h3>Multi-Server Status</h3>
                    <div id="multi-server-list"></div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Settings Modal -->
    <div id="settings-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>⚙️ Server Management Settings</h2>
                <span class="close" onclick="closeSettings()">&times;</span>
            </div>
            <div class="modal-body">
                <!-- Network Discovery Section -->
                <div class="settings-section">
                    <h3>🔍 Network Discovery</h3>
                    <div class="network-config">
                        <div class="form-group">
                            <label for="network-range">Network Range:</label>
                            <input type="text" id="network-range" class="form-input" placeholder="172.16.16" value="172.16.16">
                        </div>
                        <div class="form-group">
                            <label for="ssh-username">SSH Username:</label>
                            <input type="text" id="ssh-username" class="form-input" placeholder="root" value="root">
                        </div>
                        <div class="form-group">
                            <label for="max-ips">Max IPs to Scan:</label>
                            <input type="number" id="max-ips" class="form-input" placeholder="50" value="50" min="1" max="254">
                        </div>
                        <div class="form-group">
                            <label for="start-ip">Start IP (optional):</label>
                            <input type="number" id="start-ip" class="form-input" placeholder="1" value="1" min="1" max="254">
                        </div>
                    </div>
                    <div class="discovery-controls">
                        <button id="scan-btn" onclick="startNetworkScan()" class="btn btn-primary">🔍 Scan Network</button>
                        <button id="stop-scan-btn" onclick="stopNetworkScan()" class="btn btn-secondary" style="display: none;">🛑 Stop Scan</button>
                        <span id="scan-status" class="scan-status"></span>
                    </div>
                    <div id="discovered-servers" class="server-list">
                        <p>No servers discovered yet. Click "Scan Network" to start discovery.</p>
                    </div>
                </div>
                
                <!-- Server Connections Section -->
                <div class="settings-section">
                    <h3>🔗 Server Connections</h3>
                    <div id="connected-servers" class="server-list">
                        <p>No servers connected yet.</p>
                    </div>
                </div>
                
                <!-- Add Server Section -->
                <div class="settings-section">
                    <h3>➕ Add Server Manually</h3>
                    <div class="add-server-form">
                        <input type="text" id="server-ip" placeholder="Server IP Address" class="form-input">
                        <input type="text" id="server-username" placeholder="Username (default: root)" value="root" class="form-input">
                        <input type="password" id="server-password" placeholder="Password (optional for key auth)" class="form-input">
                        <button onclick="addServer()" class="btn btn-success">➕ Add Server</button>
                    </div>
                </div>
                
                <!-- Configuration Section -->
                <div class="settings-section">
                    <h3>💾 Configuration</h3>
                    <div class="config-controls">
                        <button onclick="saveConfiguration()" class="btn btn-primary">💾 Save Configuration</button>
                        <button onclick="loadConfiguration()" class="btn btn-secondary">📂 Load Configuration</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script src="/static/script.js"></script>
</body>
</html>
"""
    
    def _get_css(self):
        """Generate CSS styles"""
        return """
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
}

.dashboard {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}

.dashboard-header {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.dashboard-header h1 {
    color: #2c3e50;
    font-size: 2rem;
    font-weight: 700;
}

.header-info {
    display: flex;
    gap: 20px;
    align-items: center;
}

.server-selector {
    display: flex;
    align-items: center;
    gap: 10px;
}

.server-selector label {
    font-weight: 600;
    color: #2c3e50;
}

.server-selector select {
    padding: 8px 12px;
    border: 2px solid #3498db;
    border-radius: 6px;
    background: white;
    color: #2c3e50;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
}

.server-selector select:hover {
    border-color: #2980b9;
    box-shadow: 0 2px 8px rgba(52, 152, 219, 0.2);
}

.server-selector select:focus {
    outline: none;
    border-color: #2980b9;
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.status-indicator {
    font-size: 1.2rem;
    font-weight: bold;
}

.dashboard-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
}

.stat-card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 25px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease;
}

.stat-card:hover {
    transform: translateY(-5px);
}

.stat-card h3 {
    color: #2c3e50;
    margin-bottom: 15px;
    font-size: 1.1rem;
}

.stat-value {
    font-size: 2.5rem;
    font-weight: bold;
    color: #3498db;
    margin-bottom: 10px;
}

.stat-subtitle {
    font-size: 0.9rem;
    color: #7f8c8d;
}

.stat-bar {
    width: 100%;
    height: 8px;
    background: #ecf0f1;
    border-radius: 4px;
    overflow: hidden;
}

.stat-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #2ecc71, #f39c12, #e74c3c);
    transition: width 0.5s ease;
    border-radius: 4px;
}

.charts-section {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 30px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    margin: 20px 0;
}

.chart-container h3 {
    color: #2c3e50;
    margin-bottom: 25px;
    font-size: 1.4rem;
    font-weight: 600;
    text-align: center;
    border-bottom: 2px solid #ecf0f1;
    padding-bottom: 10px;
}

#resource-chart {
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
}

.info-card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 25px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.info-card h3 {
    color: #2c3e50;
    margin-bottom: 15px;
    font-size: 1.2rem;
}

.info-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #ecf0f1;
}

.info-item:last-child {
    border-bottom: none;
}

.info-label {
    font-weight: 500;
    color: #34495e;
}

.info-value {
    color: #7f8c8d;
    font-family: 'Courier New', monospace;
}

.process-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #ecf0f1;
}

.process-name {
    font-weight: 500;
    color: #2c3e50;
}

.process-stats {
    display: flex;
    gap: 15px;
    font-size: 0.9rem;
}

.alert-item {
    padding: 10px;
    margin: 5px 0;
    border-radius: 8px;
    border-left: 4px solid;
}

.alert-warning {
    background: #fff3cd;
    border-color: #ffc107;
    color: #856404;
}

.alert-error {
    background: #f8d7da;
    border-color: #dc3545;
    color: #721c24;
}

.server-item {
    border: 1px solid #ecf0f1;
    border-radius: 8px;
    margin: 10px 0;
    padding: 15px;
    background: #f8f9fa;
}

.server-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

.server-name {
    font-weight: 600;
    color: #2c3e50;
}

.server-ip {
    font-family: 'Courier New', monospace;
    color: #7f8c8d;
    font-size: 0.9rem;
}

.server-status {
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.9rem;
}

.server-status.online {
    background: #d4edda;
    color: #155724;
}

.server-status.offline {
    background: #f8d7da;
    color: #721c24;
}

.server-status.error {
    background: #fff3cd;
    color: #856404;
}

.server-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 10px;
    font-size: 0.85rem;
    color: #6c757d;
}

.server-note {
    font-size: 0.85rem;
    color: #6c757d;
    font-style: italic;
    margin-top: 5px;
}

@media (max-width: 768px) {
    .dashboard-header {
        flex-direction: column;
        gap: 15px;
        text-align: center;
    }
    
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .info-grid {
        grid-template-columns: 1fr;
    }
}

/* Settings Button */
.settings-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.settings-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

/* Modal Styles */
.modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(5px);
}

.modal-content {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    margin: 5% auto;
    padding: 0;
    border-radius: 15px;
    width: 80%;
    max-width: 800px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-50px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.modal-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 15px 15px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
}

.close {
    color: white;
    font-size: 28px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
}

.close:hover {
    transform: scale(1.2);
}

.modal-body {
    padding: 20px;
}

/* Settings Sections */
.settings-section {
    margin-bottom: 30px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 10px;
    border: 1px solid rgba(0, 0, 0, 0.1);
}

.settings-section h3 {
    margin: 0 0 15px 0;
    color: #2c3e50;
    font-size: 1.2rem;
    border-bottom: 2px solid #667eea;
    padding-bottom: 8px;
}

/* Buttons */
.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
    margin: 5px;
    font-size: 14px;
}

.btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.btn-secondary {
    background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
    color: white;
}

.btn-success {
    background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
    color: white;
}

.btn-danger {
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    color: white;
}

.btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

/* Form Inputs */
.form-input {
    width: 100%;
    padding: 12px;
    margin: 5px 0;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.3s ease;
}

.form-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 10px rgba(102, 126, 234, 0.3);
}

.network-config {
    margin-bottom: 20px;
    padding: 15px;
    background: rgba(52, 152, 219, 0.1);
    border-radius: 8px;
    border-left: 4px solid #3498db;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
    color: #2c3e50;
}

.add-server-form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: end;
}

.add-server-form .btn {
    grid-column: span 2;
}

/* Server Lists */
.server-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.8);
}

.server-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    margin: 5px 0;
    background: white;
    border-radius: 8px;
    border: 1px solid #eee;
    transition: all 0.3s ease;
}

.server-item:hover {
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
}

.server-info {
    flex: 1;
}

.server-name {
    font-weight: 600;
    color: #2c3e50;
}

.server-details {
    font-size: 12px;
    color: #7f8c8d;
    margin-top: 2px;
}

.server-actions {
    display: flex;
    gap: 5px;
}

.server-status {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
}

.status-online {
    background: #27ae60;
    color: white;
}

.status-offline {
    background: #e74c3c;
    color: white;
}

.status-connecting {
    background: #f39c12;
    color: white;
}

/* Discovery Controls */
.discovery-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
}

.scan-status {
    font-size: 14px;
    color: #7f8c8d;
    font-style: italic;
}

/* Configuration Controls */
.config-controls {
    display: flex;
    gap: 10px;
}
"""
    
    def _get_javascript(self):
        """Generate JavaScript for dashboard functionality"""
        return """
// Dashboard JavaScript
let updateInterval = 5000; // 5 seconds
let chartData = {
    cpu: [],
    memory: [],
    timestamps: []
};
let chartInitialized = false;
let currentServer = 'LOCAL_IP'; // Default to local server - will be replaced dynamically

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Replace LOCAL_IP placeholder with actual local IP
    replaceLocalIPPlaceholder();
    
    updateDashboard();
    setInterval(updateDashboard, updateInterval);
    
    // Initialize chart after a short delay to ensure DOM is ready
    setTimeout(() => {
        initializeChart();
        chartInitialized = true;
        console.log('Chart initialized successfully');
    }, 1000);
});

// Replace LOCAL_IP placeholder with actual local IP
async function replaceLocalIPPlaceholder() {
    try {
        const response = await fetch('/api/local-ip');
        const data = await response.json();
        if (data.success && data.local_ip) {
            const localIP = data.local_ip;
            
            // Update server selector
            const selector = document.getElementById('server-select');
            if (selector) {
                selector.innerHTML = `<option value="${localIP}">Local Server (${localIP})</option>`;
            }
            
            // Update current server if it's still the placeholder
            if (currentServer === 'LOCAL_IP') {
                currentServer = localIP;
            }
            
            // Replace any remaining LOCAL_IP placeholders in the page
            document.body.innerHTML = document.body.innerHTML.replace(/LOCAL_IP/g, localIP);
        }
    } catch (error) {
        console.error('Error getting local IP:', error);
    }
}

// Check if a server is the local server
function isLocalServer(ip) {
    return ip === '127.0.0.1' || ip === 'localhost' || ip === currentServer || ip === 'LOCAL_IP';
}

// Server change function
function changeServer() {
    currentServer = document.getElementById('server-select').value;
    console.log('Switching to server:', currentServer);
    
    // Call the API to switch servers
    fetch('/api/switch-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: currentServer })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            console.log('Successfully switched to server:', currentServer);
            // Clear chart data when switching servers
            chartData = {
                cpu: [],
                memory: [],
                timestamps: []
            };
            
            // Update dashboard immediately
            updateDashboard();
        } else {
            console.error('Failed to switch server:', result.error);
        }
    })
    .catch(error => {
        console.error('Error switching server:', error);
    });
}

async function updateDashboard() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        
        if (data.error) {
            console.error('Error fetching data:', data.error);
            return;
        }
        
        updateStats(data);
        updateSystemInfo(data);
        updateProcessList(data);
        updateNetworkInfo(data);
        updateAlerts(data);
        updateMultiServerStatus(data);
        // Chart is now updated in updateStats function
        
        // Update timestamp
        document.getElementById('last-update').textContent = 
            'Last Update: ' + new Date().toLocaleTimeString();
        
    } catch (error) {
        console.error('Error updating dashboard:', error);
        document.getElementById('status').textContent = '🔴 Offline';
        document.getElementById('status').className = 'status-indicator error';
    }
}

function updateStats(data) {
    const multiServer = data.multi_server || {};
    const selectedServer = multiServer[currentServer];
    
    if (selectedServer && selectedServer.status === 'Online') {
        // Use selected server data
        const cpuPercent = selectedServer.cpu_percent || 0;
        const memoryPercent = selectedServer.memory_percent || 0;
        const diskPercent = selectedServer.disk_percent || 0;
        const loadAvg = selectedServer.load_avg || 0;
        
        // Update stats
        document.getElementById('cpu-value').textContent = cpuPercent.toFixed(1) + '%';
        document.getElementById('cpu-bar').style.width = cpuPercent + '%';
        
        document.getElementById('memory-value').textContent = memoryPercent.toFixed(1) + '%';
        document.getElementById('memory-bar').style.width = memoryPercent + '%';
        
        document.getElementById('disk-value').textContent = diskPercent.toFixed(1) + '%';
        document.getElementById('disk-bar').style.width = diskPercent + '%';
        
        // Update process count (use load average as approximation for remote server)
        const processCount = isLocalServer(currentServer) ? (data.processes?.length || 0) : Math.round(loadAvg * 10);
        document.getElementById('process-value').textContent = processCount;
        
        // Update colors based on usage
        updateStatColors('cpu', cpuPercent);
        updateStatColors('memory', memoryPercent);
        updateStatColors('disk', diskPercent);
        
        // Update chart with selected server data
        if (chartInitialized) {
            updateChart({
                resource_usage: {
                    cpu_percent: cpuPercent,
                    memory_percent: memoryPercent
                }
            });
        }
    } else {
        // Fallback to local server data if selected server is not available
        const resourceUsage = data.resource_usage || {};
        const diskInfo = data.disk_info || {};
        
        const cpuPercent = resourceUsage.cpu_percent || 0;
        const memoryPercent = resourceUsage.memory_percent || 0;
        const diskPercent = diskInfo.root_usage?.percent || 0;
        
        document.getElementById('cpu-value').textContent = cpuPercent.toFixed(1) + '%';
        document.getElementById('cpu-bar').style.width = cpuPercent + '%';
        
        document.getElementById('memory-value').textContent = memoryPercent.toFixed(1) + '%';
        document.getElementById('memory-bar').style.width = memoryPercent + '%';
        
        document.getElementById('disk-value').textContent = diskPercent.toFixed(1) + '%';
        document.getElementById('disk-bar').style.width = diskPercent + '%';
        
        const processCount = data.processes?.length || 0;
        document.getElementById('process-value').textContent = processCount;
        
        updateStatColors('cpu', cpuPercent);
        updateStatColors('memory', memoryPercent);
        updateStatColors('disk', diskPercent);
    }
}

function updateStatColors(type, percent) {
    const card = document.getElementById(type + '-card');
    const value = document.getElementById(type + '-value');
    
    if (percent >= 90) {
        card.style.borderLeft = '4px solid #e74c3c';
        value.style.color = '#e74c3c';
    } else if (percent >= 70) {
        card.style.borderLeft = '4px solid #f39c12';
        value.style.color = '#f39c12';
    } else {
        card.style.borderLeft = '4px solid #2ecc71';
        value.style.color = '#3498db';
    }
}

function updateSystemInfo(data) {
    const multiServer = data.multi_server || {};
    const selectedServer = multiServer[currentServer];
    const systemInfo = data.system_info || {};
    const container = document.getElementById('system-info');
    
    let info = [];
    
    if (currentServer === '172.16.16.21') {
        // Local server - use system info
        info = [
            ['Hostname', systemInfo.hostname || 'N/A'],
            ['Platform', systemInfo.platform || 'N/A'],
            ['CPU Cores', systemInfo.cpu_count || 'N/A'],
            ['Uptime', systemInfo.uptime || 'N/A'],
            ['Load Average', systemInfo.load_avg ? systemInfo.load_avg.join(', ') : 'N/A']
        ];
    } else {
        // Remote server - use server-specific info
        const serverName = selectedServer?.name || 'Remote Server';
        const serverIP = currentServer;
        const serverStatus = selectedServer?.status || 'Unknown';
        const loadAvg = selectedServer?.load_avg || 'N/A';
        
        info = [
            ['Server Name', serverName],
            ['IP Address', serverIP],
            ['Status', serverStatus],
            ['Load Average', loadAvg],
            ['Connection', selectedServer?.note || 'SSH required for details']
        ];
    }
    
    container.innerHTML = info.map(([label, value]) => 
        `<div class="info-item">
            <span class="info-label">${label}:</span>
            <span class="info-value">${value}</span>
        </div>`
    ).join('');
}

function updateProcessList(data) {
    const multiServer = data.multi_server || {};
    const selectedServer = multiServer[currentServer];
    const processes = data.processes || [];
    const container = document.getElementById('process-list');
    
    if (isLocalServer(currentServer)) {
        // Local server - show process list
        container.innerHTML = processes.map(proc => 
            `<div class="process-item">
                <div class="process-name">${proc.name || 'Unknown'}</div>
                <div class="process-stats">
                    <span>CPU: ${proc.cpu_percent?.toFixed(1) || 0}%</span>
                    <span>MEM: ${proc.memory_percent?.toFixed(1) || 0}%</span>
                </div>
            </div>`
        ).join('');
    } else {
        // Remote server - show server status info
        if (selectedServer && selectedServer.status === 'Online') {
            container.innerHTML = `
                <div class="process-item">
                    <div class="process-name">🟢 Server Online</div>
                    <div class="process-stats">
                        <span>CPU: ${selectedServer.cpu_percent?.toFixed(1) || 'N/A'}%</span>
                        <span>MEM: ${selectedServer.memory_percent?.toFixed(1) || 'N/A'}%</span>
                    </div>
                </div>
                <div class="process-item">
                    <div class="process-name">💾 Disk Usage</div>
                    <div class="process-stats">
                        <span>Usage: ${selectedServer.disk_percent || 'N/A'}%</span>
                    </div>
                </div>
                <div class="process-item">
                    <div class="process-name">📊 Load Average</div>
                    <div class="process-stats">
                        <span>Load: ${selectedServer.load_avg?.toFixed(2) || 'N/A'}</span>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="process-item">
                    <div class="process-name">❌ Server Offline</div>
                    <div class="process-stats">
                        <span>Status: ${selectedServer?.status || 'Unknown'}</span>
                    </div>
                </div>
            `;
        }
    }
}

function updateNetworkInfo(data) {
    const networkInfo = data.network_info || {};
    const container = document.getElementById('network-info');
    
    const bytesSent = formatBytes(networkInfo.bytes_sent || 0);
    const bytesRecv = formatBytes(networkInfo.bytes_recv || 0);
    
    container.innerHTML = `
        <div class="info-item">
            <span class="info-label">Bytes Sent:</span>
            <span class="info-value">${bytesSent}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Bytes Received:</span>
            <span class="info-value">${bytesRecv}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Interfaces:</span>
            <span class="info-value">${networkInfo.interfaces?.length || 0}</span>
        </div>
    `;
}

function updateAlerts(data) {
    const alerts = data.alerts || [];
    const container = document.getElementById('alerts-list');
    
    if (alerts.length === 0) {
        container.innerHTML = '<div class="info-item">No alerts</div>';
        return;
    }
    
    container.innerHTML = alerts.map(alert => 
        `<div class="alert-item alert-${alert.type}">
            <strong>${alert.type.toUpperCase()}:</strong> ${alert.message}
        </div>`
    ).join('');
}

function updateMultiServerStatus(data) {
    const multiServer = data.multi_server || {};
    const container = document.getElementById('multi-server-list');
    
    if (Object.keys(multiServer).length === 0) {
        container.innerHTML = '<div class="info-item">No server data available</div>';
        return;
    }
    
    container.innerHTML = Object.values(multiServer).map(server => {
        const statusColor = server.status === 'Online' ? '🟢' : server.status === 'Offline' ? '🔴' : '🟡';
        const statusText = server.status;
        
        let details = '';
        if (server.cpu_percent !== null && server.cpu_percent !== undefined) {
            details = `
                <div class="server-details">
                    <span>CPU: ${server.cpu_percent?.toFixed(1) || 'N/A'}%</span>
                    <span>Memory: ${server.memory_percent?.toFixed(1) || 'N/A'}%</span>
                    <span>Disk: ${server.disk_percent || 'N/A'}%</span>
                    <span>Load: ${server.load_avg?.toFixed(2) || 'N/A'}</span>
                </div>
            `;
        } else if (server.note) {
            details = `
                <div class="server-note">
                    <span>💡 ${server.note}</span>
                </div>
            `;
        }
        
        return `
            <div class="server-item">
                <div class="server-header">
                    <span class="server-name">${server.name}</span>
                    <span class="server-ip">${server.ip}</span>
                    <span class="server-status ${server.status.toLowerCase()}">${statusColor} ${statusText}</span>
                </div>
                ${details}
            </div>
        `;
    }).join('');
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function initializeChart() {
    if (typeof Plotly === 'undefined') {
        console.error('Plotly not loaded');
        document.getElementById('resource-chart').innerHTML = 
            '<div style="text-align: center; padding: 50px; color: #7f8c8d;">Chart loading...</div>';
        return;
    }
    
    const layout = {
        title: {
            text: 'Resource Usage Over Time',
            font: { size: 18, color: '#2c3e50' }
        },
        xaxis: { 
            title: 'Time',
            showgrid: true,
            gridcolor: '#ecf0f1',
            zeroline: false
        },
        yaxis: { 
            title: 'Usage %', 
            range: [0, 100],
            showgrid: true,
            gridcolor: '#ecf0f1',
            zeroline: false
        },
        height: 400,
        margin: { t: 60, b: 60, l: 60, r: 40 },
        plot_bgcolor: 'rgba(255, 255, 255, 0.8)',
        paper_bgcolor: 'rgba(255, 255, 255, 0.8)',
        font: { color: '#2c3e50' },
        showlegend: true,
        legend: {
            x: 0.02,
            y: 0.98,
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: '#ecf0f1'
        }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
    };
    
    try {
        Plotly.newPlot('resource-chart', [], layout, config);
    } catch (error) {
        console.error('Error initializing chart:', error);
        document.getElementById('resource-chart').innerHTML = 
            '<div style="text-align: center; padding: 50px; color: #e74c3c;">Chart initialization failed</div>';
    }
}

function updateChart(data) {
    if (typeof Plotly === 'undefined') {
        console.log('Plotly not available');
        return;
    }
    
    const resourceUsage = data.resource_usage || {};
    const timestamp = new Date();
    
    console.log('Updating chart with data:', resourceUsage);
    
    // Add new data points
    chartData.cpu.push(resourceUsage.cpu_percent || 0);
    chartData.memory.push(resourceUsage.memory_percent || 0);
    chartData.timestamps.push(timestamp);
    
    // Keep only last 30 points for better visualization
    if (chartData.cpu.length > 30) {
        chartData.cpu.shift();
        chartData.memory.shift();
        chartData.timestamps.shift();
    }
    
    // Only update if we have data
    if (chartData.cpu.length === 0) {
        return;
    }
    
    const traces = [
        {
            x: chartData.timestamps,
            y: chartData.cpu,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'CPU Usage',
            line: { 
                color: '#3498db', 
                width: 3,
                shape: 'spline'
            },
            marker: { 
                size: 6,
                color: '#3498db',
                line: { width: 1, color: '#2980b9' }
            },
            fill: 'tonexty',
            fillcolor: 'rgba(52, 152, 219, 0.1)',
            hovertemplate: '<b>CPU</b><br>Time: %{x}<br>Usage: %{y:.1f}%<extra></extra>'
        },
        {
            x: chartData.timestamps,
            y: chartData.memory,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Memory Usage',
            line: { 
                color: '#e74c3c', 
                width: 3,
                shape: 'spline'
            },
            marker: { 
                size: 6,
                color: '#e74c3c',
                line: { width: 1, color: '#c0392b' }
            },
            fill: 'tonexty',
            fillcolor: 'rgba(231, 76, 60, 0.1)',
            hovertemplate: '<b>Memory</b><br>Time: %{x}<br>Usage: %{y:.1f}%<extra></extra>'
        }
    ];
    
    const currentCPU = chartData.cpu[chartData.cpu.length - 1] || 0;
    const currentMemory = chartData.memory[chartData.memory.length - 1] || 0;
    
    const serverName = isLocalServer(currentServer) ? 'Local Server' : 'Remote Server';
    
    const layout = {
        title: {
            text: `${serverName} - Resource Usage Over Time (CPU: ${currentCPU.toFixed(1)}% | Memory: ${currentMemory.toFixed(1)}%)`,
            font: { size: 16, color: '#2c3e50' }
        },
        xaxis: { 
            title: 'Time',
            showgrid: true,
            gridcolor: '#ecf0f1',
            zeroline: false,
            tickformat: '%H:%M:%S'
        },
        yaxis: { 
            title: 'Usage %', 
            range: [0, 100],
            showgrid: true,
            gridcolor: '#ecf0f1',
            zeroline: false
        },
        height: 400,
        margin: { t: 60, b: 60, l: 60, r: 40 },
        plot_bgcolor: 'rgba(255, 255, 255, 0.8)',
        paper_bgcolor: 'rgba(255, 255, 255, 0.8)',
        font: { color: '#2c3e50' },
        showlegend: true,
        legend: {
            x: 0.02,
            y: 0.98,
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: '#ecf0f1'
        },
        hovermode: 'x unified'
    };
    
    try {
        Plotly.react('resource-chart', traces, layout, {
            transition: {
                duration: 500,
                easing: 'cubic-in-out'
            }
        });
    } catch (error) {
        console.error('Error updating chart:', error);
    }
}

// Settings Modal Functions
function openSettings() {
    document.getElementById('settings-modal').style.display = 'block';
    loadServerStatus();
}

function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('settings-modal');
    if (event.target === modal) {
        closeSettings();
    }
}

// Network Discovery Functions
async function startNetworkScan() {
    const scanBtn = document.getElementById('scan-btn');
    const stopBtn = document.getElementById('stop-scan-btn');
    const status = document.getElementById('scan-status');
    const networkRange = document.getElementById('network-range').value;
    const sshUsername = document.getElementById('ssh-username').value;
    const maxIps = parseInt(document.getElementById('max-ips').value) || 50;
    const startIp = parseInt(document.getElementById('start-ip').value) || 1;
    
    if (!networkRange) {
        alert('Please enter a network range (e.g., 172.16.16)');
        return;
    }
    
    scanBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    status.textContent = `🔍 Scanning network ${networkRange}.x (IPs ${startIp}-${startIp + maxIps - 1})...`;
    
    try {
        const response = await fetch('/api/scan-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                network_range: networkRange,
                username: sshUsername,
                max_ips: maxIps,
                start_ip: startIp
            })
        });
        const result = await response.json();
        
        if (result.success) {
            status.textContent = result.message || `✅ Scan completed. Found ${result.discovered_count} servers.`;
            updateDiscoveredServers(result.discovered_servers);
        } else {
            status.textContent = `❌ Scan failed: ${result.error}`;
        }
    } catch (error) {
        status.textContent = `❌ Scan error: ${error.message}`;
    } finally {
        scanBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
    }
}

async function stopNetworkScan() {
    try {
        await fetch('/api/stop-scan', { method: 'POST' });
        document.getElementById('scan-status').textContent = '🛑 Scan stopped by user.';
        document.getElementById('scan-btn').style.display = 'inline-block';
        document.getElementById('stop-scan-btn').style.display = 'none';
    } catch (error) {
        console.error('Error stopping scan:', error);
    }
}

function updateDiscoveredServers(servers) {
    const container = document.getElementById('discovered-servers');
    
    if (!servers || Object.keys(servers).length === 0) {
        container.innerHTML = '<p>No servers discovered.</p>';
        return;
    }
    
    container.innerHTML = Object.entries(servers).map(([ip, info]) => {
        const serverInfo = info.info || {};
        const hostname = serverInfo.hostname || 'Unknown';
        const os = serverInfo.os || 'Unknown';
        const cpuCores = serverInfo.cpu_cores || 'Unknown';
        const memory = serverInfo.memory || 'Unknown';
        
        return `
            <div class="server-item">
                <div class="server-info">
                    <div class="server-name">${ip}</div>
                    <div class="server-details">
                        <strong>Hostname:</strong> ${hostname}<br>
                        <strong>OS:</strong> ${os}<br>
                        <strong>CPU:</strong> ${cpuCores} cores<br>
                        <strong>Memory:</strong> ${memory}<br>
                        <strong>Discovered:</strong> ${new Date(info.discovered_at || Date.now()).toLocaleString()}
                    </div>
                </div>
                <div class="server-actions">
                    <button onclick="connectToServer('${ip}')" class="btn btn-success">🔗 Connect</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Also update the server selector dropdown with discovered servers
    updateServerSelectorWithDiscovered(servers);
}

function updateServerSelectorWithDiscovered(servers) {
    const selector = document.getElementById('server-select');
    const currentValue = selector.value;
    
    // Keep local server as first option
    selector.innerHTML = '<option value="LOCAL_IP">Local Server (LOCAL_IP)</option>';
    
    // Add discovered servers to dropdown
    if (servers && Object.keys(servers).length > 0) {
        Object.entries(servers).forEach(([ip, info]) => {
            const serverInfo = info.info || {};
            const hostname = serverInfo.hostname || ip;
            const option = document.createElement('option');
            option.value = ip;
            option.textContent = `${hostname} (${ip}) - Discovered`;
            selector.appendChild(option);
        });
    }
    
    // Add connected servers (these will appear after discovered servers)
    fetch('/api/server-status')
        .then(response => response.json())
        .then(result => {
            if (result.success && result.connected_servers) {
                Object.entries(result.connected_servers).forEach(([ip, info]) => {
                    // Check if this server is already in the dropdown
                    if (!selector.querySelector(`option[value="${ip}"]`)) {
                        const option = document.createElement('option');
                        option.value = ip;
                        option.textContent = `${info.info?.hostname || ip} (${ip}) - Connected`;
                        selector.appendChild(option);
                    }
                });
                
                // Restore current selection if it still exists
                if (currentValue && selector.querySelector(`option[value="${currentValue}"]`)) {
                    selector.value = currentValue;
                }
            }
        })
        .catch(error => console.error('Error updating server selector:', error));
}

// Server Connection Functions
async function connectToServer(ip) {
    const username = prompt(`Enter username for ${ip} (default: root):`) || 'root';
    const password = prompt(`Enter password for ${ip} (leave empty for key auth):`);
    
    try {
        const response = await fetch('/api/connect-server', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Successfully connected to ${ip}`);
            loadServerStatus();
            updateServerSelector();
            
            // Add the new server to the selector dropdown
            const selector = document.getElementById('server-select');
            const option = document.createElement('option');
            option.value = ip;
            option.textContent = `${ip} - Connected`;
            selector.appendChild(option);
        } else {
            alert(`❌ Failed to connect to ${ip}: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ Connection error: ${error.message}`);
    }
}

async function disconnectFromServer(ip) {
    if (!confirm(`Are you sure you want to disconnect from ${ip}?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/disconnect-server', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Disconnected from ${ip}`);
            loadServerStatus();
            updateServerSelector();
        } else {
            alert(`❌ Failed to disconnect: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ Disconnect error: ${error.message}`);
    }
}

// Manual Server Addition
async function addServer() {
    const ip = document.getElementById('server-ip').value.trim();
    const username = document.getElementById('server-username').value.trim() || 'root';
    const password = document.getElementById('server-password').value;
    
    if (!ip) {
        alert('Please enter a server IP address.');
        return;
    }
    
    try {
        const response = await fetch('/api/connect-server', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Successfully connected to ${ip}`);
            document.getElementById('server-ip').value = '';
            document.getElementById('server-password').value = '';
            loadServerStatus();
            updateServerSelector();
            
            // Add the new server to the selector dropdown
            const selector = document.getElementById('server-select');
            const option = document.createElement('option');
            option.value = ip;
            option.textContent = `${ip} - Connected`;
            selector.appendChild(option);
        } else {
            alert(`❌ Failed to connect to ${ip}: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ Connection error: ${error.message}`);
    }
}

// Configuration Functions
async function saveConfiguration() {
    try {
        const response = await fetch('/api/save-config', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Configuration saved successfully!');
        } else {
            alert(`❌ Failed to save configuration: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ Save error: ${error.message}`);
    }
}

async function loadConfiguration() {
    try {
        const response = await fetch('/api/load-config', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Configuration loaded successfully!');
            loadServerStatus();
            updateServerSelector();
        } else {
            alert(`❌ Failed to load configuration: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ Load error: ${error.message}`);
    }
}

// Server Status Loading
async function loadServerStatus() {
    try {
        const response = await fetch('/api/server-status');
        const result = await response.json();
        
        if (result.success) {
            updateConnectedServers(result.connected_servers);
            updateDiscoveredServers(result.discovered_servers);
        }
    } catch (error) {
        console.error('Error loading server status:', error);
    }
}

function updateConnectedServers(servers) {
    const container = document.getElementById('connected-servers');
    
    if (!servers || Object.keys(servers).length === 0) {
        container.innerHTML = '<p>No servers connected.</p>';
        return;
    }
    
    container.innerHTML = Object.entries(servers).map(([ip, info]) => `
        <div class="server-item">
            <div class="server-info">
                <div class="server-name">${info.info?.hostname || ip}</div>
                <div class="server-details">
                    ${info.info?.os || 'Unknown OS'} | 
                    CPU: ${info.info?.cpu_cores || 'Unknown'} cores |
                    Connected: ${new Date(info.connected_at).toLocaleString()}
                </div>
            </div>
            <div class="server-actions">
                <span class="server-status status-online">🟢 Online</span>
                <button onclick="disconnectFromServer('${ip}')" class="btn btn-danger">❌ Disconnect</button>
            </div>
        </div>
    `).join('');
}

// Update server selector dropdown
function updateServerSelector() {
    const selector = document.getElementById('server-select');
    const currentValue = selector.value;
    
    // Keep local server as first option - will be updated dynamically
    selector.innerHTML = '<option value="LOCAL_IP">Local Server (LOCAL_IP)</option>';
    
    // Add connected servers
    fetch('/api/server-status')
        .then(response => response.json())
        .then(result => {
            if (result.success && result.connected_servers) {
                Object.entries(result.connected_servers).forEach(([ip, info]) => {
                    const option = document.createElement('option');
                    option.value = ip;
                    option.textContent = `${info.info?.hostname || ip} (${ip})`;
                    selector.appendChild(option);
                });
                
                // Restore current selection if it still exists
                if (currentValue && selector.querySelector(`option[value="${currentValue}"]`)) {
                    selector.value = currentValue;
                }
            }
        })
        .catch(error => console.error('Error updating server selector:', error));
}
"""

def create_dashboard_handler(dashboard_data):
    """Create a handler class with dashboard data"""
    class Handler(DashboardHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, dashboard_data=dashboard_data, **kwargs)
    return Handler

def start_dashboard(port=8005, host='localhost'):
    """Start the web dashboard"""
    dashboard_data = DashboardData()
    dashboard_data.start_monitoring()
    
    # Create handler with dashboard data
    handler_class = create_dashboard_handler(dashboard_data)
    
    # Start server
    server = HTTPServer((host, port), handler_class)
    
    print(f"🚀 Starting RHEL Resource Manager Dashboard...")
    print(f"📊 Dashboard URL: http://{host}:{port}")
    print(f"⏱️  Auto-refresh: Every {dashboard_data.update_interval} seconds")
    print(f"🔄 Press Ctrl+C to stop")
    
    # Open browser
    try:
        webbrowser.open(f"http://{host}:{port}")
    except:
        print("Could not open browser automatically. Please open manually.")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Stopping dashboard...")
        dashboard_data.stop_monitoring()
        server.shutdown()
        print("✅ Dashboard stopped")

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='RHEL Resource Manager Web Dashboard')
    parser.add_argument('--port', type=int, default=8005, help='Port to run the dashboard on')
    parser.add_argument('--host', default='localhost', help='Host to bind to')
    
    args = parser.parse_args()
    
    start_dashboard(args.port, args.host)

if __name__ == "__main__":
    main() 