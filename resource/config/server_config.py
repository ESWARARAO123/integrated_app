#!/usr/bin/env python3.12
"""
Server Configuration for Multi-Server Monitoring
Defines known servers and their connection details
"""

# Known servers in the network - will be populated dynamically
KNOWN_SERVERS = {}

def get_dynamic_known_servers():
    """Get dynamically discovered servers"""
    try:
        from utils.network_utils import get_local_ip, get_hostname
        
        local_ip = get_local_ip()
        hostname = get_hostname()
        
        return {
            local_ip: {
                "name": f"Local Server ({hostname})",
                "description": "Current server running the monitoring tool",
                "type": "local",
                "ssh_username": "root",
                "ssh_password": None,  # Will use current user's credentials
                "enabled": True
            }
        }
    except ImportError:
        # Fallback if network utils not available
        return {
            "127.0.0.1": {
                "name": "Local Server",
                "description": "Current server running the monitoring tool",
                "type": "local",
                "ssh_username": "root",
                "ssh_password": None,
                "enabled": True
            }
        }

# Network configuration
NETWORK_CONFIG = {
    "network_range": "172.16.16.0/24",
    "scan_timeout": 2,
    "ssh_timeout": 10,
    "monitoring_interval": 30
}

# SSH Configuration
SSH_CONFIG = {
    "default_username": "root",
    "key_file": None,  # Path to SSH key file if using key-based auth
    "banner_timeout": 10,
    "auth_timeout": 10
}

def get_known_servers():
    """Get list of known servers"""
    dynamic_servers = get_dynamic_known_servers()
    return [ip for ip, config in dynamic_servers.items() if config.get('enabled', True)]

def get_server_config(ip):
    """Get configuration for a specific server"""
    dynamic_servers = get_dynamic_known_servers()
    return dynamic_servers.get(ip, {})

def get_network_range():
    """Get the network range to scan"""
    try:
        from utils.network_utils import get_network_ranges
        ranges = get_network_ranges()
        return ranges[0] if ranges else "192.168.1.0/24"
    except ImportError:
        return NETWORK_CONFIG.get("network_range", "192.168.1.0/24")

def get_ssh_config():
    """Get SSH configuration"""
    return SSH_CONFIG.copy() 