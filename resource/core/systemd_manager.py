#!/usr/bin/env python3.12
"""
Systemd service management module
"""

import subprocess
import logging
from typing import Dict, Optional

logger = logging.getLogger('ResourceManager')

class SystemdManager:
    """Manage systemd services and resource control"""

    def set_service_resources(self, service_name: str, cpu_shares: Optional[int] = None,
                            memory_limit: Optional[str] = None) -> bool:
        """Set resource limits for a systemd service"""
        try:
            commands = []

            if cpu_shares:
                commands.append(f"systemctl set-property {service_name} CPUShares={cpu_shares}")

            if memory_limit:
                commands.append(f"systemctl set-property {service_name} MemoryLimit={memory_limit}")

            for cmd in commands:
                result = subprocess.run(cmd.split(), capture_output=True, text=True)
                if result.returncode != 0:
                    logger.error(f"Failed to execute: {cmd}")
                    logger.error(f"Error: {result.stderr}")
                    return False

            logger.info(f"Set resource limits for service '{service_name}'")
            return True

        except Exception as e:
            logger.error(f"Error setting service resources: {e}")
            return False

    def get_service_status(self, service_name: str) -> Dict:
        """Get status of a systemd service"""
        try:
            result = subprocess.run(
                ['systemctl', 'show', service_name, '--property=MainPID,CPUShares,MemoryLimit,ActiveState'],
                capture_output=True, text=True
            )

            if result.returncode != 0:
                return {}

            status = {}
            for line in result.stdout.strip().split('\n'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    status[key] = value

            return status

        except Exception as e:
            logger.error(f"Error getting service status: {e}")
            return {} 