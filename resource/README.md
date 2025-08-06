# PinnacleAi Resource Management Module

This module provides resource monitoring and server management functionality for PinnacleAi, eliminating the dependency on external `clean_manager_lev1`.

## 🎯 **Overview**

The resource management module is a self-contained Python application that provides:
- **System Resource Monitoring** (CPU, Memory, Disk, Network)
- **Server Discovery** (Network scanning for SSH-accessible servers)
- **Server Management** (Connect/disconnect to remote servers)
- **Configuration Management** (Save/load server configurations)

## 📁 **File Structure**

```
resource/
├── core/                    # Core server management logic
│   ├── server_discovery.py  # Server discovery and connection management
│   └── network_scanner.py   # Network scanning functionality
├── utils/                   # Utility functions
│   └── network_utils.py     # Network utility functions
├── config/                  # Configuration files
│   ├── settings.py          # Default configuration settings
│   └── server_config.py     # Server configuration
├── resource_server.py       # Main API server
├── start_resource_server.sh # Startup script
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## 🚀 **Quick Start**

### **Option 1: Direct Python Execution**
```bash
cd resource
pip install -r requirements.txt
python resource_server.py --host 0.0.0.0 --port 8005
```

### **Option 2: Using Startup Script**
```bash
cd resource
chmod +x start_resource_server.sh
./start_resource_server.sh
```

### **Option 3: Docker (Recommended)**
```bash
cd Docker
docker compose up resource-server -d
```

## 📊 **API Endpoints**

### **Resource Data**
- `GET /api/data` - Get combined resource data (system info + alerts)

### **System Information**
- `GET /api/system-info` - Get system information (CPU, Memory, Disk, Network)
- `GET /api/alerts` - Get system alerts

### **Server Management**
- `GET /api/server-status` - Get server discovery status
- `POST /api/scan-network` - Start network scanning
- `POST /api/stop-scan` - Stop network scanning
- `POST /api/connect-server` - Connect to a server
- `POST /api/disconnect-server` - Disconnect from a server

### **Configuration**
- `POST /api/save-config` - Save server configuration
- `POST /api/load-config` - Load server configuration

## 🔧 **Configuration**

### **Default Settings** (`config/settings.py`)
```python
DEFAULT_CONFIG = {
    'monitoring': {
        'interval': 30,           # Monitoring interval in seconds
        'cpu_threshold': 80.0,    # CPU alert threshold (%)
        'memory_threshold': 80.0, # Memory alert threshold (%)
        'history_size': 1000      # Data history size
    },
    'alerts': {
        'enable_email': False,    # Enable email alerts
        'enable_syslog_alerts': True  # Enable syslog alerts
    }
}
```

## 🔗 **Integration with PinnacleAi**

The resource server is integrated with PinnacleAi through:

1. **Environment Variable**: `REACT_APP_RESOURCE_MONITOR_URL=http://localhost:8005`
2. **Docker Service**: Runs as `resource-server` container
3. **API Calls**: PinnacleAi client makes HTTP requests to the resource server

### **Client Integration Example**
```typescript
// In PinnacleAi client code
const resourceMonitorUrl = process.env.REACT_APP_RESOURCE_MONITOR_URL || 'http://localhost:8005';

// Get resource data
const response = await fetch(`${resourceMonitorUrl}/api/data`);
const data = await response.json();

// Scan network
const scanResponse = await fetch(`${resourceMonitorUrl}/api/scan-network`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        network_range: '172.16.16',
        username: 'root',
        max_ips: 50
    })
});
```

## 🐳 **Docker Integration**

### **Dockerfile** (`Docker/Dockerfile.resource-server`)
- Based on Python 3.12-slim
- Installs system dependencies (SSH client, procps)
- Runs as non-root user for security
- Exposes port 8005
- Includes health checks

### **Docker Compose** (`Docker/docker-compose.yml`)
```yaml
resource-server:
  build:
    context: ..
    dockerfile: Docker/Dockerfile.resource-server
  container_name: productdemo-resource-server
  ports:
    - "8005:8005"
  volumes:
    - /proc:/host/proc:ro
    - /sys:/host/sys:ro
  environment:
    - PYTHONUNBUFFERED=1
```

## 🔒 **Security Features**

- **Non-root User**: Runs as `resourceuser` instead of root
- **Read-only Volumes**: `/proc` and `/sys` mounted as read-only
- **SSH Key Authentication**: Supports SSH key-based authentication
- **Network Isolation**: Runs in Docker network with controlled access

## 📈 **Monitoring Features**

### **System Metrics**
- **CPU Usage**: Percentage and core count
- **Memory Usage**: Used, available, and percentage
- **Disk Usage**: Used, free, and percentage
- **Network**: Bytes sent/received, packet counts
- **System Info**: Uptime, load average, process count

### **Alerts**
- **High CPU Usage**: Configurable threshold (default: 80%)
- **High Memory Usage**: Configurable threshold (default: 80%)
- **High Disk Usage**: Fixed threshold (90%)
- **Real-time Monitoring**: Continuous background monitoring

## 🚀 **Server Management Features**

### **Network Discovery**
- **IP Range Scanning**: Configurable network ranges
- **SSH Detection**: Finds SSH-accessible servers
- **Hostname Resolution**: Attempts to resolve hostnames
- **Connection Testing**: Tests SSH connectivity

### **Server Connections**
- **SSH Authentication**: Password and key-based authentication
- **Real-time Monitoring**: Monitor connected servers
- **Resource Tracking**: CPU, memory, disk usage of remote servers
- **Connection Management**: Connect/disconnect servers

## 🔄 **Migration from clean_manager_lev1**

This module replaces the external `clean_manager_lev1` dependency by:

1. **Self-contained**: All functionality included in PinnacleAi
2. **Same API**: Compatible API endpoints
3. **Enhanced Security**: Better Docker security practices
4. **Simplified Deployment**: Single application deployment

## ✅ **Benefits**

- **No External Dependencies**: Self-contained within PinnacleAi
- **Consistent API**: Same endpoints as before
- **Better Integration**: Tighter integration with PinnacleAi
- **Enhanced Security**: Improved security practices
- **Easier Maintenance**: Single codebase to maintain
- **Docker Native**: Optimized for Docker deployment

## 🎉 **Status: Complete**

The resource management module is now fully integrated into PinnacleAi, providing all the functionality previously available through `clean_manager_lev1` while eliminating the external dependency. 