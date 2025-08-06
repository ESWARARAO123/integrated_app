#!/usr/bin/env python3.12
"""
System monitoring and data collection module
"""

import os
import psutil
import logging
from datetime import datetime
from collections import deque
from typing import Dict, List

logger = logging.getLogger('ResourceManager')

class SystemMonitor:
    """System monitoring and data collection"""

    def __init__(self, history_size: int = 1000):
        self.history_size = history_size
        self.cpu_history = deque(maxlen=history_size)
        self.memory_history = deque(maxlen=history_size)
        self.process_data = {}

    def collect_system_metrics(self) -> Dict:
        """Collect current system metrics"""
        try:
            # CPU metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            cpu_freq = psutil.cpu_freq()
            load_avg = os.getloadavg()

            # Memory metrics
            memory = psutil.virtual_memory()
            swap = psutil.swap_memory()

            # Disk I/O metrics
            disk_io = psutil.disk_io_counters()

            # Network metrics
            network_io = psutil.net_io_counters()

            metrics = {
                'timestamp': datetime.now().isoformat(),
                'cpu': {
                    'percent': cpu_percent,
                    'count': cpu_count,
                    'frequency': cpu_freq._asdict() if cpu_freq else None,
                    'load_avg': load_avg
                },
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'used': memory.used,
                    'percent': memory.percent,
                    'free': memory.free,
                    'buffers': memory.buffers,
                    'cached': memory.cached
                },
                'swap': {
                    'total': swap.total,
                    'used': swap.used,
                    'free': swap.free,
                    'percent': swap.percent
                },
                'disk_io': disk_io._asdict() if disk_io else None,
                'network_io': network_io._asdict() if network_io else None
            }

            # Store in history
            self.cpu_history.append((datetime.now(), cpu_percent))
            self.memory_history.append((datetime.now(), memory.percent))

            return metrics

        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")
            return {}

    def get_top_processes(self, sort_by: str = 'cpu', limit: int = 10) -> List[Dict]:
        """Get top processes by CPU or memory usage"""
        try:
            processes = []
            for proc in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_percent', 'create_time']):
                try:
                    processes.append(proc.info)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

            # Sort by specified metric
            key = 'cpu_percent' if sort_by == 'cpu' else 'memory_percent'
            processes.sort(key=lambda x: x.get(key, 0), reverse=True)

            return processes[:limit]

        except Exception as e:
            logger.error(f"Error getting top processes: {e}")
            return [] 