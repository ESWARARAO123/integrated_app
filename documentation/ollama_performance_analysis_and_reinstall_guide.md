# 🔍 Ollama Performance Analysis & Reinstallation Guide

## 📊 **Performance Analysis Results (2025-06-06)**

### **Timeline Analysis: Multi-User Upload Test**

**Test Period:** 20:41 - 20:46  
**Users:** 2 simultaneous uploads  
**Documents:** 
- User 1: RAGINTEGRATION.pdf (175 chunks)
- User 2: aiagents.pdf (9 chunks)

#### **Performance Results:**

| User | Document | Chunks | Expected Time | Actual Time | Status |
|------|----------|--------|---------------|-------------|--------|
| User 1 | RAGINTEGRATION.pdf | 175 | ~30 seconds | 6+ minutes | ❌ Still processing |
| User 2 | aiagents.pdf | 9 | ~5 seconds | 3+ minutes | ✅ Completed |

#### **Single vs Multi-User Performance:**
- **Single User**: Fast, efficient processing
- **Multi-User**: 10-12x slower, system overload
- **Root Cause**: Resource contention and CPU saturation

---

## 🚨 **Critical System Issues Identified**

### **1. CPU Overload**
```bash
Load Average: 43.36 (Critical - should be ≤24 for 24-core system)
CPU Usage: 98.3% sustained

Ollama Processes:
- PID 2962249: 788.9% CPU (8 cores)
- PID 2957458: 722.2% CPU (7 cores) 
- PID 2957956: 477.8% CPU (5 cores)
Total: ~1988% CPU = 20 cores at 100%!
```

### **2. Multiple Runner Processes**
- **Problem**: Ollama spawning separate runners for each model
- **Impact**: Resource fragmentation and context switching overhead
- **Evidence**: 3 concurrent ollama runners with different parallel settings

### **3. No Resource Limits**
- **Threads**: 12 per runner (36 total)
- **Parallel**: Inconsistent settings (1, 4, 4)
- **Memory**: 11.7GB for main process + ~4GB for runners

---

## 💡 **Root Cause Analysis**

### **Why Single User Works vs Multi-User Fails:**

1. **Single User:**
   - One model instance
   - Sequential embedding requests
   - Manageable CPU load

2. **Multi-User:**
   - Multiple model instances compete
   - Parallel requests overwhelm Ollama
   - CPU thrashing between processes

### **Ollama Behavior Under Load:**
- ✅ **Designed for**: Sequential requests with occasional parallelism
- ❌ **Not optimized for**: High-throughput batch processing
- ❌ **Issue**: No built-in request queuing or rate limiting

---

## 🛠️ **Complete Ollama Reinstallation Guide**

### **Phase 1: Clean Removal**

#### **Stop Ollama Service:**
```bash
sudo systemctl stop ollama
sudo systemctl disable ollama
```

#### **Remove Ollama Installation:**
```bash
# Remove binary
sudo rm -f /usr/local/bin/ollama

# Remove service file
sudo rm -f /etc/systemd/system/ollama.service

# Remove user data (WARNING: This removes all models!)
rm -rf ~/.ollama

# For system-wide removal (if installed for all users)
sudo rm -rf /usr/share/ollama
sudo rm -rf /var/lib/ollama
```

#### **Clean Process Tree:**
```bash
# Kill any remaining ollama processes
sudo pkill -f ollama

# Verify all processes are gone
ps aux | grep ollama
```

### **Phase 2: Optimized Reinstallation**

#### **Install Ollama with Resource Limits:**
```bash
# Download and install Ollama
curl -fsSL https://ollama.ai/install.sh | sh
```

#### **Create Optimized Service Configuration:**
```bash
sudo tee /etc/systemd/system/ollama.service > /dev/null <<EOF
[Unit]
Description=Ollama Server
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_NUM_PARALLEL=2"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
Environment="OLLAMA_FLASH_ATTENTION=1"
Environment="OLLAMA_KEEP_ALIVE=5m"

# Resource Limits
MemoryLimit=16G
CPUQuota=800%
TasksMax=50

[Install]
WantedBy=default.target
EOF
```

#### **Create Ollama User:**
```bash
sudo useradd -r -s /bin/false -d /usr/share/ollama ollama
sudo mkdir -p /usr/share/ollama
sudo chown ollama:ollama /usr/share/ollama
```

#### **Configure Resource Limits:**
```bash
# Create limits configuration
sudo tee /etc/security/limits.d/ollama.conf > /dev/null <<EOF
ollama soft nproc 50
ollama hard nproc 100
ollama soft nofile 65536
ollama hard nofile 65536
EOF
```

### **Phase 3: Multi-Instance Setup (Optional)**

#### **For High-Throughput Requirements:**
```bash
# Create multiple Ollama instances
for i in {1..3}; do
    sudo tee /etc/systemd/system/ollama-$i.service > /dev/null <<EOF
[Unit]
Description=Ollama Server Instance $i
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=0.0.0.0:1143$i"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
MemoryLimit=8G
CPUQuota=600%

[Install]
WantedBy=default.target
EOF
done
```

### **Phase 4: Application Integration**

#### **Update Application Configuration:**

1. **Single Instance Setup:**
```javascript
// conf/config.ini
[Docker]
docker-chromadb-protocol = http
docker-chromadb-host = localhost
docker-chromadb-port = 8001

[Ollama]
ollama-host = localhost
ollama-port = 11434
ollama-max-concurrent-requests = 3
ollama-request-timeout = 30000
```

2. **Multi-Instance Setup:**
```javascript
// Enable load balancer in application
const ollamaLoadBalancer = require('./src/services/ollamaLoadBalancer');

// Configure multiple instances
ollamaLoadBalancer.enableMultiInstance([
    'http://localhost:11431',
    'http://localhost:11432', 
    'http://localhost:11433'
]);
```

### **Phase 5: Performance Optimization**

#### **Model Pre-loading:**
```bash
# Start service
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama

# Pre-load embedding model
ollama pull nomic-embed-text

# Verify model is loaded and warm
curl -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "test"}'
```

#### **Performance Tuning:**
```bash
# Check optimal settings for your hardware
echo "Checking CPU cores:"
nproc

echo "Checking available memory:"
free -h

echo "Recommended Ollama settings for your system:"
echo "OLLAMA_NUM_PARALLEL = $(( $(nproc) / 8 ))"
echo "OLLAMA_MAX_LOADED_MODELS = 2"
echo "CPUQuota = $(( $(nproc) * 50 ))%"
```

---

## 🎯 **Expected Performance Improvements**

### **Single Instance Optimized:**
- **Parallel Users**: 2-3 users simultaneously
- **Processing Time**: 175 chunks in ~45 seconds
- **CPU Usage**: ≤50% sustained
- **Memory Usage**: ≤8GB

### **Multi-Instance Setup:**
- **Parallel Users**: 6-9 users simultaneously  
- **Processing Time**: 175 chunks in ~20 seconds
- **Throughput**: 3x improvement
- **Load Distribution**: Balanced across instances

### **Application Benefits:**
- ✅ RAG toggle activates immediately after upload
- ✅ Real-time progress updates work smoothly
- ✅ No system freezing or timeouts
- ✅ Predictable performance under load

---

## 📋 **Monitoring & Maintenance**

### **Performance Monitoring:**
```bash
# Monitor Ollama service
sudo systemctl status ollama

# Check resource usage
top -p $(pgrep ollama)

# Monitor API response times
curl -w "@curl-format.txt" -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "test"}'
```

### **curl-format.txt:**
```
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
```

### **Health Checks:**
```bash
# Daily health check script
#!/bin/bash
echo "$(date): Ollama Health Check"
curl -f http://localhost:11434/api/version || echo "ERROR: Ollama not responding"
echo "Load Average: $(uptime | awk -F'load average:' '{print $2}')"
echo "Ollama Memory: $(ps -p $(pgrep ollama) -o rss= | awk '{sum+=$1} END {print sum/1024 "MB"}')"
```

---

## 🚀 **Implementation Timeline**

### **Phase 1: Immediate (30 minutes)**
1. Stop current Ollama service
2. Clean removal of existing installation
3. Kill all running processes

### **Phase 2: Installation (30 minutes)**
1. Fresh Ollama installation
2. Optimized service configuration
3. Resource limits setup

### **Phase 3: Testing (30 minutes)**
1. Single-user test
2. Multi-user test
3. Performance validation

### **Phase 4: Production (15 minutes)**
1. Enable service
2. Pre-load models
3. Application integration

**Total Time: ~2 hours for complete setup**

---

## ⚠️ **Important Notes**

### **Before Starting:**
- ✅ Backup any important models or configurations
- ✅ Plan for temporary service downtime (1-2 hours)
- ✅ Test in development environment first

### **Resource Requirements:**
- **Minimum**: 8GB RAM, 4 CPU cores
- **Recommended**: 16GB RAM, 8+ CPU cores  
- **Your System**: 125GB RAM, 24 cores ✅ Excellent

### **Troubleshooting:**
If issues persist after reinstallation:
1. Check system logs: `journalctl -u ollama -f`
2. Verify resource limits: `systemctl show ollama`
3. Monitor CPU/memory: `top -p $(pgrep ollama)`
4. Test API directly: `curl http://localhost:11434/api/version`

This guide should resolve the parallel processing bottleneck and provide stable, scalable performance for your multi-user RAG application. 