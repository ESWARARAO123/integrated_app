#!/usr/bin/env python3
"""
PinnacleAi Resource Management Server
Dedicated resource monitoring and server management for PinnacleAi
"""

import json
import time
import threading
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import psutil
import os
import sys

# Add the resource directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.server_discovery import ServerDiscovery
from utils.network_scanner import NetworkScanner
from config.settings import DEFAULT_CONFIG

class ResourceData:
    """Manages resource monitoring data"""
    
    def __init__(self):
        self.server_discovery = ServerDiscovery()
        self.network_scanner = NetworkScanner()
        self.config = DEFAULT_CONFIG.copy()
        self.monitoring_active = False
        self.monitoring_thread = None
        
    def start_monitoring(self):
        """Start background monitoring"""
        if not self.monitoring_active:
            self.monitoring_active = True
            self.monitoring_thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self.monitoring_thread.start()
    
    def stop_monitoring(self):
        """Stop background monitoring"""
        self.monitoring_active = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=1)
    
    def _monitor_loop(self):
        """Background monitoring loop"""
        while self.monitoring_active:
            try:
                self.update_data()
                time.sleep(self.config['monitoring']['interval'])
            except Exception as e:
                print(f"Monitoring error: {e}")
                time.sleep(5)
    
    def update_data(self):
        """Update resource data"""
        try:
            # Update server discovery data if method exists
            if self.server_discovery and hasattr(self.server_discovery, 'update_connected_servers'):
                self.server_discovery.update_connected_servers()
        except Exception as e:
            print(f"Error updating data: {e}")
    
    def get_system_info(self):
        """Get current system information"""
        try:
            # CPU info
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            
            # Memory info
            memory = psutil.virtual_memory()
            
            # Disk info
            disk = psutil.disk_usage('/')
            
            # Network info
            network = psutil.net_io_counters()
            
            # System info
            boot_time = datetime.fromtimestamp(psutil.boot_time())
            uptime = datetime.now() - boot_time
            
            # Load average (Linux only)
            try:
                load_avg = os.getloadavg()
            except:
                load_avg = [0, 0, 0]
            
            # Process count
            process_count = len(psutil.pids())
            
            return {
                'cpu': {
                    'percent': cpu_percent,
                    'count': cpu_count,
                    'temperature': None  # Would need additional library
                },
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'used': memory.used,
                    'percent': memory.percent
                },
                'disk': {
                    'total': disk.total,
                    'used': disk.used,
                    'free': disk.free,
                    'percent': (disk.used / disk.total) * 100
                },
                'network': {
                    'bytes_sent': network.bytes_sent,
                    'bytes_recv': network.bytes_recv,
                    'packets_sent': network.packets_sent,
                    'packets_recv': network.packets_recv
                },
                'system': {
                    'uptime': str(uptime).split('.')[0],
                    'boot_time': boot_time.isoformat(),
                    'load_average': list(load_avg),
                    'process_count': process_count
                }
            }
        except Exception as e:
            print(f"Error getting system info: {e}")
            return {}
    
    def get_alerts(self):
        """Get system alerts"""
        alerts = []
        try:
            system_info = self.get_system_info()
            
            # CPU alert
            if system_info.get('cpu', {}).get('percent', 0) > self.config['monitoring']['cpu_threshold']:
                alerts.append({
                    'type': 'warning',
                    'message': f"High CPU usage: {system_info['cpu']['percent']:.1f}%",
                    'timestamp': datetime.now().isoformat()
                })
            
            # Memory alert
            if system_info.get('memory', {}).get('percent', 0) > self.config['monitoring']['memory_threshold']:
                alerts.append({
                    'type': 'warning',
                    'message': f"High memory usage: {system_info['memory']['percent']:.1f}%",
                    'timestamp': datetime.now().isoformat()
                })
            
            # Disk alert
            if system_info.get('disk', {}).get('percent', 0) > 90:
                alerts.append({
                    'type': 'warning',
                    'message': f"High disk usage: {system_info['disk']['percent']:.1f}%",
                    'timestamp': datetime.now().isoformat()
                })
                
        except Exception as e:
            print(f"Error getting alerts: {e}")
        
        return alerts

class ResourceAPIHandler(BaseHTTPRequestHandler):
    """HTTP request handler for resource management API"""
    
    def __init__(self, *args, resource_data=None, **kwargs):
        self.resource_data = resource_data
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        """Handle GET requests"""
        try:
            parsed_url = urlparse(self.path)
            path = parsed_url.path
            
            if path == '/api/data':
                self.send_resource_data()
            elif path == '/api/server-status':
                self.send_server_status()
            elif path == '/api/system-info':
                self.send_system_info()
            elif path == '/api/alerts':
                self.send_alerts()
            else:
                self.send_error(404, "Not Found")
                
        except Exception as e:
            self.send_error(500, str(e))
    
    def do_POST(self):
        """Handle POST requests"""
        try:
            parsed_url = urlparse(self.path)
            path = parsed_url.path
            
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
            else:
                self.send_error(404, "Not Found")
                
        except Exception as e:
            self.send_error(500, str(e))
    
    def send_response_headers(self, content_type='application/json'):
        """Send response headers"""
        self.send_response(200)
        self.send_header('Content-type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def send_resource_data(self):
        """Send combined resource data in the format expected by the client"""
        try:
            system_info = self.resource_data.get_system_info()
            alerts = self.resource_data.get_alerts()
            
            # Transform data to match the expected client format
            data = {
                'resource_usage': {
                    'cpu_percent': system_info.get('cpu', {}).get('percent', 0),
                    'memory_used': system_info.get('memory', {}).get('used', 0),
                    'memory_total': system_info.get('memory', {}).get('total', 0),
                    'memory_percent': system_info.get('memory', {}).get('percent', 0),
                    'memory_available': system_info.get('memory', {}).get('available', 0),
                    'swap_percent': 0  # Not implemented yet
                },
                'system_info': {
                    'cpu_count': system_info.get('cpu', {}).get('count', 0),
                    'uptime': system_info.get('system', {}).get('uptime', '0h 0m'),
                    'load_avg': system_info.get('system', {}).get('load_average', [0, 0, 0]),
                    'hostname': 'localhost',  # Default value
                    'platform': 'linux'  # Default value
                },
                'disk_info': {
                    'root_usage': {
                        'used': system_info.get('disk', {}).get('used', 0),
                        'total': system_info.get('disk', {}).get('total', 0),
                        'percent': system_info.get('disk', {}).get('percent', 0)
                    },
                    'partitions': []  # Not implemented yet
                },
                'network_info': {
                    'bytes_sent': system_info.get('network', {}).get('bytes_sent', 0),
                    'bytes_recv': system_info.get('network', {}).get('bytes_recv', 0),
                    'interfaces': []  # Not implemented yet
                },
                'processes': [],  # Not implemented yet
                'alerts': alerts,
                'timestamp': datetime.now().isoformat()
            }
            
            self.send_response_headers()
            self.wfile.write(json.dumps(data, default=str).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def send_server_status(self):
        """Send server discovery status"""
        try:
            if self.resource_data.server_discovery:
                status = self.resource_data.server_discovery.get_status_summary()
                connected_servers = self.resource_data.server_discovery.connected_servers
                discovered_servers = self.resource_data.server_discovery.discovered_servers
                
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
            
            self.send_response_headers()
            self.wfile.write(json.dumps(response, default=str).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def send_system_info(self):
        """Send system information"""
        try:
            system_info = self.resource_data.get_system_info()
            self.send_response_headers()
            self.wfile.write(json.dumps(system_info, default=str).encode('utf-8'))
        except Exception as e:
            self.send_error(500, str(e))
    
    def send_alerts(self):
        """Send system alerts"""
        try:
            alerts = self.resource_data.get_alerts()
            self.send_response_headers()
            self.wfile.write(json.dumps(alerts, default=str).encode('utf-8'))
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_scan_network(self):
        """Handle network scanning request"""
        try:
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
            
            if self.resource_data.network_scanner:
                try:
                    discovered = self.resource_data.network_scanner.quick_scan(
                        network_range, username, max_ips=max_ips, start_ip=start_ip
                    )
                    print(f"Network scan completed. Found {len(discovered)} SSH-accessible servers.")
                    
                    if self.resource_data.server_discovery:
                        for server in discovered:
                            self.resource_data.server_discovery.discovered_servers[server['ip']] = {
                                'status': 'discovered',
                                'ssh_connected': False,
                                'info': server,
                                'discovered_at': server['discovered_at']
                            }
                    
                    response = {
                        'success': True,
                        'message': f'✅ Scan completed. Found {len(discovered)} SSH-accessible servers.',
                        'discovered_count': len(discovered),
                        'discovered_servers': self.resource_data.server_discovery.discovered_servers
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
            
            self.send_response_headers()
            self.wfile.write(json.dumps(response, default=str).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_stop_scan(self):
        """Handle stop scanning request"""
        try:
            if self.resource_data.server_discovery:
                self.resource_data.server_discovery.stop_scanning()
                response = {'success': True, 'message': 'Scan stopped'}
            else:
                response = {'success': False, 'error': 'Server discovery not available'}
            
            self.send_response_headers()
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
            elif self.resource_data.server_discovery:
                success = self.resource_data.server_discovery.connect_to_server(ip, username, password)
                response = {
                    'success': success,
                    'message': f"Connection {'successful' if success else 'failed'} to {ip}"
                }
            else:
                response = {'success': False, 'error': 'Server discovery not available'}
            
            self.send_response_headers()
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
            elif self.resource_data.server_discovery:
                success = self.resource_data.server_discovery.disconnect_from_server(ip)
                response = {
                    'success': success,
                    'message': f"Disconnection {'successful' if success else 'failed'} from {ip}"
                }
            else:
                response = {'success': False, 'error': 'Server discovery not available'}
            
            self.send_response_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_save_config(self):
        """Handle save configuration request"""
        try:
            if self.resource_data.server_discovery:
                success = self.resource_data.server_discovery.save_configuration()
                response = {
                    'success': success,
                    'message': 'Configuration saved successfully' if success else 'Failed to save configuration'
                }
            else:
                response = {'success': False, 'error': 'Server discovery not available'}
            
            self.send_response_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def handle_load_config(self):
        """Handle load configuration request"""
        try:
            if self.resource_data.server_discovery:
                success = self.resource_data.server_discovery.load_configuration()
                response = {
                    'success': success,
                    'message': 'Configuration loaded successfully' if success else 'Failed to load configuration'
                }
            else:
                response = {'success': False, 'error': 'Server discovery not available'}
            
            self.send_response_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response_headers()

def create_resource_handler(resource_data):
    """Create handler class with resource data"""
    class Handler(ResourceAPIHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, resource_data=resource_data, **kwargs)
    return Handler

def start_resource_server(port=8005, host='0.0.0.0'):
    """Start the resource management server"""
    try:
        # Initialize resource data
        resource_data = ResourceData()
        resource_data.start_monitoring()
        
        # Create server
        handler_class = create_resource_handler(resource_data)
        server = HTTPServer((host, port), handler_class)
        
        print(f"🚀 PinnacleAi Resource Server started on {host}:{port}")
        print(f"📊 API endpoints available:")
        print(f"   GET  /api/data              - Get resource data")
        print(f"   GET  /api/server-status     - Get server status")
        print(f"   GET  /api/system-info       - Get system info")
        print(f"   GET  /api/alerts            - Get alerts")
        print(f"   POST /api/scan-network      - Scan network")
        print(f"   POST /api/stop-scan         - Stop scan")
        print(f"   POST /api/connect-server    - Connect to server")
        print(f"   POST /api/disconnect-server - Disconnect from server")
        print(f"   POST /api/save-config       - Save configuration")
        print(f"   POST /api/load-config       - Load configuration")
        print(f"")
        print(f"🔄 Press Ctrl+C to stop the server")
        
        # Start server
        server.serve_forever()
        
    except KeyboardInterrupt:
        print(f"\n🛑 Stopping PinnacleAi Resource Server...")
        if resource_data:
            resource_data.stop_monitoring()
        server.shutdown()
        print(f"✅ PinnacleAi Resource Server stopped")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        if resource_data:
            resource_data.stop_monitoring()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='PinnacleAi Resource Management Server')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=8005, help='Port to bind to (default: 8005)')
    
    args = parser.parse_args()
    start_resource_server(args.port, args.host) 