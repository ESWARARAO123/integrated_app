#!/usr/bin/env python3.12
"""
Cgroup management module for resource control
"""

import os
import logging
from typing import Dict, Optional

logger = logging.getLogger('ResourceManager')

class CgroupManager:
    """Manage cgroups for resource control"""

    def __init__(self):
        self.cgroup_root = "/sys/fs/cgroup"
        self.custom_groups = {}

    def create_cgroup(self, name: str, cpu_limit: Optional[int] = None, 
                     memory_limit: Optional[str] = None) -> bool:
        """Create a new cgroup with specified limits"""
        try:
            # Create cgroup directories
            cpu_path = f"{self.cgroup_root}/cpu/{name}"
            memory_path = f"{self.cgroup_root}/memory/{name}"

            os.makedirs(cpu_path, exist_ok=True)
            os.makedirs(memory_path, exist_ok=True)

            # Set CPU limit (CPU shares)
            if cpu_limit:
                with open(f"{cpu_path}/cpu.shares", 'w') as f:
                    f.write(str(cpu_limit))

            # Set memory limit
            if memory_limit:
                with open(f"{memory_path}/memory.limit_in_bytes", 'w') as f:
                    f.write(memory_limit)

                # Disable swap for this cgroup
                with open(f"{memory_path}/memory.swappiness", 'w') as f:
                    f.write("0")

            self.custom_groups[name] = {
                'cpu_path': cpu_path,
                'memory_path': memory_path,
                'cpu_limit': cpu_limit,
                'memory_limit': memory_limit
            }

            logger.info(f"Created cgroup '{name}' with CPU: {cpu_limit}, Memory: {memory_limit}")
            return True

        except Exception as e:
            logger.error(f"Error creating cgroup '{name}': {e}")
            return False

    def add_process_to_cgroup(self, cgroup_name: str, pid: int) -> bool:
        """Add a process to a cgroup"""
        try:
            if cgroup_name not in self.custom_groups:
                logger.error(f"Cgroup '{cgroup_name}' does not exist")
                return False

            group = self.custom_groups[cgroup_name]

            # Add to CPU cgroup
            with open(f"{group['cpu_path']}/cgroup.procs", 'w') as f:
                f.write(str(pid))

            # Add to memory cgroup
            with open(f"{group['memory_path']}/cgroup.procs", 'w') as f:
                f.write(str(pid))

            logger.info(f"Added process {pid} to cgroup '{cgroup_name}'")
            return True

        except Exception as e:
            logger.error(f"Error adding process {pid} to cgroup '{cgroup_name}': {e}")
            return False

    def get_cgroup_stats(self, cgroup_name: str) -> Dict:
        """Get statistics for a cgroup"""
        try:
            if cgroup_name not in self.custom_groups:
                return {}

            group = self.custom_groups[cgroup_name]
            stats = {}

            # CPU stats
            try:
                with open(f"{group['cpu_path']}/cpuacct.usage", 'r') as f:
                    stats['cpu_usage_ns'] = int(f.read().strip())
            except:
                stats['cpu_usage_ns'] = 0

            # Memory stats
            try:
                with open(f"{group['memory_path']}/memory.usage_in_bytes", 'r') as f:
                    stats['memory_usage_bytes'] = int(f.read().strip())
            except:
                stats['memory_usage_bytes'] = 0

            try:
                with open(f"{group['memory_path']}/memory.limit_in_bytes", 'r') as f:
                    stats['memory_limit_bytes'] = int(f.read().strip())
            except:
                stats['memory_limit_bytes'] = 0

            return stats

        except Exception as e:
            logger.error(f"Error getting cgroup stats for '{cgroup_name}': {e}")
            return {} 