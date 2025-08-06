#!/usr/bin/env python3.12
"""
RHEL CPU and Memory Resource Manager
Main resource manager class that coordinates all components
"""

import sys
import time
import json
import logging
import threading
from datetime import datetime
from typing import Dict

# Import our modular components
try:
    from .system_monitor import SystemMonitor
    from .cgroup_manager import CgroupManager
    from .systemd_manager import SystemdManager
    from .alert_manager import AlertManager
except ImportError:
    # Fallback for direct execution
    from system_monitor import SystemMonitor
    from cgroup_manager import CgroupManager
    from systemd_manager import SystemdManager
    from alert_manager import AlertManager

# Configure logging
try:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('/var/log/resource_manager.log'),
            logging.StreamHandler(sys.stdout)
        ]
    )
except PermissionError:
    # Fallback to console-only logging if file logging fails
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

logger = logging.getLogger('ResourceManager')

class ResourceManager:
    """Main resource manager class"""

    def __init__(self):
        self.monitor = SystemMonitor()
        self.cgroup_manager = CgroupManager()
        self.systemd_manager = SystemdManager()
        self.alert_manager = AlertManager()
        self.running = False
        self.monitor_thread = None

    def start_monitoring(self, interval: int = 60):
        """Start continuous system monitoring"""
        self.running = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop, args=(interval,))
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        logger.info("Started resource monitoring")

    def stop_monitoring(self):
        """Stop system monitoring"""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join()
        logger.info("Stopped resource monitoring")

    def _monitor_loop(self, interval: int):
        """Main monitoring loop"""
        while self.running:
            try:
                # Collect metrics
                metrics = self.monitor.collect_system_metrics()

                if metrics:
                    # Check for alerts
                    alerts = self.alert_manager.check_thresholds(metrics)

                    # Send alerts
                    for alert in alerts:
                        self.alert_manager.send_alert(alert)

                    # Log metrics
                    logger.info(f"CPU: {metrics['cpu']['percent']:.1f}%, "
                              f"Memory: {metrics['memory']['percent']:.1f}%")

                time.sleep(interval)

            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(interval)

    def create_resource_group(self, name: str, cpu_limit: int, memory_limit: str) -> bool:
        """Create a new resource group with limits"""
        return self.cgroup_manager.create_cgroup(name, cpu_limit, memory_limit)

    def assign_process_to_group(self, group_name: str, pid: int) -> bool:
        """Assign a process to a resource group"""
        return self.cgroup_manager.add_process_to_cgroup(group_name, pid)

    def set_service_limits(self, service_name: str, cpu_shares: int, memory_limit: str) -> bool:
        """Set resource limits for a systemd service"""
        return self.systemd_manager.set_service_resources(service_name, cpu_shares, memory_limit)

    def get_system_status(self) -> Dict:
        """Get comprehensive system status"""
        metrics = self.monitor.collect_system_metrics()
        top_cpu_processes = self.monitor.get_top_processes('cpu', 5)
        top_memory_processes = self.monitor.get_top_processes('memory', 5)

        return {
            'system_metrics': metrics,
            'top_cpu_processes': top_cpu_processes,
            'top_memory_processes': top_memory_processes,
            'recent_alerts': list(self.alert_manager.alert_history)[-10:],
            'cgroups': list(self.cgroup_manager.custom_groups.keys())
        }
