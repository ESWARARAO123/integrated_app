#!/usr/bin/env python3.12
"""
Configuration settings for RHEL Resource Manager
"""

import os
import json
from typing import Dict, Any

# Default configuration
DEFAULT_CONFIG = {
    'monitoring': {
        'interval': 30,
        'cpu_threshold': 80.0,
        'memory_threshold': 80.0,
        'history_size': 1000
    },
    'cgroups': {
        'default_cpu_shares': 1024,
        'default_memory_limit': '1G',
        'enable_cgroups': True
    },
    'logging': {
        'log_level': 'INFO',
        'log_file': '/var/log/resource_manager.log',
        'enable_syslog': True
    },
    'alerts': {
        'enable_email': False,
        'enable_syslog_alerts': True
    },
    'gui': {
        'update_interval': 5,
        'theme': 'default',
        'window_size': '1200x800'
    }
}

class ConfigManager:
    """Configuration management class"""
    
    def __init__(self, config_file: str = '/opt/resource_manager/resource-manager.conf'):
        self.config_file = config_file
        self.config = self.load_config()
    
    def load_config(self) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                # Merge with defaults for any missing keys
                return self._merge_configs(DEFAULT_CONFIG, config)
            else:
                return DEFAULT_CONFIG.copy()
        except Exception as e:
            print(f"Warning: Could not load config file: {e}")
            return DEFAULT_CONFIG.copy()
    
    def save_config(self, config: Dict[str, Any]) -> bool:
        """Save configuration to file"""
        try:
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key (supports dot notation)"""
        keys = key.split('.')
        value = self.config
        
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        
        return value
    
    def set(self, key: str, value: Any) -> bool:
        """Set configuration value by key (supports dot notation)"""
        keys = key.split('.')
        config = self.config
        
        # Navigate to the parent of the target key
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        
        # Set the value
        config[keys[-1]] = value
        return self.save_config(self.config)
    
    def _merge_configs(self, default: Dict, user: Dict) -> Dict:
        """Recursively merge user config with defaults"""
        result = default.copy()
        
        for key, value in user.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_configs(result[key], value)
            else:
                result[key] = value
        
        return result 