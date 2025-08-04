#!/usr/bin/env python3.12
"""
Network Utilities for Dynamic IP Detection
Provides functions to detect local and remote IP addresses dynamically
"""

import socket
import subprocess
import psutil
import ipaddress
from typing import List, Dict, Optional

def get_local_ip() -> str:
    """Get the local IP address of the current server"""
    try:
        # Try to connect to a remote address to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        # Fallback: get first non-loopback IP
        try:
            for interface, addrs in psutil.net_if_addrs().items():
                for addr in addrs:
                    if addr.family == socket.AF_INET and not addr.address.startswith('127.'):
                        return addr.address
        except Exception:
            pass
        return "127.0.0.1"

def get_hostname() -> str:
    """Get the hostname of the current server"""
    try:
        return socket.gethostname()
    except Exception:
        return "unknown"

def get_network_interfaces() -> List[Dict]:
    """Get all network interfaces and their IP addresses"""
    interfaces = []
    try:
        for interface, addrs in psutil.net_if_addrs().items():
            interface_info = {
                'name': interface,
                'ips': [],
                'mac': None
            }
            
            for addr in addrs:
                if addr.family == socket.AF_INET:
                    interface_info['ips'].append(addr.address)
                elif addr.family == socket.AF_LINK:
                    interface_info['mac'] = addr.address
            
            if interface_info['ips']:
                interfaces.append(interface_info)
    except Exception as e:
        print(f"Error getting network interfaces: {e}")
    
    return interfaces

def get_network_ranges() -> List[str]:
    """Get network ranges based on local IP addresses"""
    ranges = []
    try:
        for interface in get_network_interfaces():
            for ip in interface['ips']:
                if not ip.startswith('127.'):  # Skip loopback
                    try:
                        # Get network range for this IP
                        ip_obj = ipaddress.IPv4Address(ip)
                        network = ipaddress.IPv4Network(f"{ip}/24", strict=False)
                        ranges.append(str(network))
                    except Exception:
                        continue
    except Exception as e:
        print(f"Error getting network ranges: {e}")
    
    # Add some common ranges if none found
    if not ranges:
        ranges = ['192.168.1.0/24', '10.0.0.0/8', '172.16.0.0/12']
    
    return list(set(ranges))  # Remove duplicates

def discover_servers_in_network(network_range: str, timeout: int = 1) -> List[str]:
    """Discover servers in a specific network range"""
    discovered = []
    try:
        network = ipaddress.IPv4Network(network_range, strict=False)
        local_ip = get_local_ip()
        
        for ip in network.hosts():
            ip_str = str(ip)
            if ip_str == local_ip:
                continue  # Skip local IP
                
            try:
                result = subprocess.run(
                    ['ping', '-c', '1', '-W', str(timeout), ip_str],
                    capture_output=True,
                    text=True,
                    timeout=timeout + 1
                )
                if result.returncode == 0:
                    discovered.append(ip_str)
            except Exception:
                continue
    except Exception as e:
        print(f"Error discovering servers in {network_range}: {e}")
    
    return discovered

def get_server_info() -> Dict:
    """Get comprehensive server information"""
    return {
        'hostname': get_hostname(),
        'local_ip': get_local_ip(),
        'interfaces': get_network_interfaces(),
        'network_ranges': get_network_ranges()
    }

def is_local_server(ip: str) -> bool:
    """Check if an IP address belongs to the local server"""
    local_ip = get_local_ip()
    return ip == local_ip or ip == "127.0.0.1" or ip == "localhost"

def get_server_display_name(ip: str) -> str:
    """Get a display name for a server based on its IP"""
    if is_local_server(ip):
        hostname = get_hostname()
        return f"Local Server ({hostname})"
    else:
        return f"Remote Server ({ip})"

def format_server_list(servers: List[str]) -> str:
    """Format a list of servers for display"""
    if not servers:
        return "No servers found"
    
    formatted = []
    for server in servers:
        if is_local_server(server):
            formatted.append(f"🖥️  {get_server_display_name(server)}")
        else:
            formatted.append(f"🌐 {get_server_display_name(server)}")
    
    return "\n".join(formatted)

def validate_ip(ip: str) -> bool:
    """Validate if a string is a valid IP address"""
    try:
        ipaddress.IPv4Address(ip)
        return True
    except ipaddress.AddressValueError:
        return False

def get_default_ssh_username() -> str:
    """Get default SSH username based on current user"""
    try:
        import os
        return os.getenv('USER', 'root')
    except Exception:
        return 'root' 