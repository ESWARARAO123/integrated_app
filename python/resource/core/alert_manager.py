#!/usr/bin/env python3.12
"""
Alert management module for resource monitoring
"""

import os
import logging
from datetime import datetime
from collections import deque
from typing import Dict, List

logger = logging.getLogger('ResourceManager')

class AlertManager:
    """Handle alerting for resource thresholds"""

    def __init__(self, cpu_threshold: float = 80.0, memory_threshold: float = 80.0):
        self.cpu_threshold = cpu_threshold
        self.memory_threshold = memory_threshold
        self.alert_history = deque(maxlen=100)

    def check_thresholds(self, metrics: Dict) -> List[Dict]:
        """Check if metrics exceed thresholds and generate alerts"""
        alerts = []

        # Check CPU threshold
        if metrics.get('cpu', {}).get('percent', 0) > self.cpu_threshold:
            alert = {
                'type': 'cpu_high',
                'timestamp': datetime.now().isoformat(),
                'value': metrics['cpu']['percent'],
                'threshold': self.cpu_threshold,
                'message': f"High CPU usage: {metrics['cpu']['percent']:.1f}%"
            }
            alerts.append(alert)
            self.alert_history.append(alert)

        # Check memory threshold
        if metrics.get('memory', {}).get('percent', 0) > self.memory_threshold:
            alert = {
                'type': 'memory_high',
                'timestamp': datetime.now().isoformat(),
                'value': metrics['memory']['percent'],
                'threshold': self.memory_threshold,
                'message': f"High memory usage: {metrics['memory']['percent']:.1f}%"
            }
            alerts.append(alert)
            self.alert_history.append(alert)

        return alerts

    def send_alert(self, alert: Dict):
        """Send alert notification"""
        # This could be extended to send emails, SMS, or other notifications
        logger.warning(f"ALERT: {alert['message']}")

        # Log to syslog
        os.system(f"logger -t ResourceManager 'ALERT: {alert['message']}'") 