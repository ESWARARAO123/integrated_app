import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CpuChipIcon,
  CircleStackIcon,
  ComputerDesktopIcon,
  SignalIcon,
  ServerIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface ResourceData {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
  };
  memory: {
    used: number;
    total: number;
    usage: number;
  };
  disk: {
    used: number;
    total: number;
    usage: number;
  };
  network: {
    bytesSent: number;
    bytesRecv: number;
    connections: number;
  };
  system: {
    uptime: string;
    loadAverage: number[];
    processes: number;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
  }>;
}

export default function ResourceDetails() {
  const [resourceData, setResourceData] = useState<ResourceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5);

  // Fetch resource data
  const fetchResourceData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // For now, we'll simulate resource data
      // In a real implementation, this would call your backend API
      const mockData: ResourceData = {
        cpu: {
          usage: Math.random() * 100,
          cores: navigator.hardwareConcurrency || 4,
          temperature: 45 + Math.random() * 20
        },
        memory: {
          used: Math.random() * 8 * 1024 * 1024 * 1024, // Random usage up to 8GB
          total: 16 * 1024 * 1024 * 1024, // 16GB total
          usage: Math.random() * 100
        },
        disk: {
          used: Math.random() * 500 * 1024 * 1024 * 1024, // Random usage up to 500GB
          total: 1000 * 1024 * 1024 * 1024, // 1TB total
          usage: Math.random() * 100
        },
        network: {
          bytesSent: Math.random() * 1024 * 1024 * 1024, // Random bytes sent
          bytesRecv: Math.random() * 1024 * 1024 * 1024, // Random bytes received
          connections: Math.floor(Math.random() * 100)
        },
        system: {
          uptime: `${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`,
          loadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2],
          processes: Math.floor(Math.random() * 200) + 50
        },
        alerts: [
          {
            type: 'warning',
            message: 'CPU usage is above 80%',
            timestamp: new Date().toISOString()
          },
          {
            type: 'info',
            message: 'System running normally',
            timestamp: new Date().toISOString()
          }
        ]
      };

      setResourceData(mockData);
    } catch (err) {
      setError('Failed to fetch resource data');
      console.error('Error fetching resource data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchResourceData();

    if (autoRefresh) {
      const interval = setInterval(fetchResourceData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get status color based on usage
  const getStatusColor = (usage: number): string => {
    if (usage >= 90) return 'var(--color-error)';
    if (usage >= 70) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  if (isLoading && !resourceData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-error)10', border: '1px solid var(--color-error)' }}>
        <div className="flex items-center">
          <ExclamationTriangleIcon className="w-5 h-5 mr-2" style={{ color: 'var(--color-error)' }} />
          <span style={{ color: 'var(--color-error)' }}>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface-dark)' }}>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchResourceData}
            disabled={isLoading}
            className="flex items-center px-4 py-2 rounded-lg transition-all"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            <ChartBarIcon className="w-4 h-4 mr-2" />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span style={{ color: 'var(--color-text)' }}>Auto-refresh</span>
          </label>
          
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="px-3 py-1 rounded border"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
            >
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
            </select>
          )}
        </div>
        
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {resourceData && (
        <>
          {/* Resource Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CPU Card */}
            <motion.div
              whileHover={{ y: -2 }}
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <CpuChipIcon className="w-6 h-6 mr-2" style={{ color: 'var(--color-primary)' }} />
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>CPU</span>
                </div>
                <span className="text-lg font-bold" style={{ color: getStatusColor(resourceData.cpu.usage) }}>
                  {resourceData.cpu.usage.toFixed(1)}%
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Cores:</span>
                  <span style={{ color: 'var(--color-text)' }}>{resourceData.cpu.cores}</span>
                </div>
                {resourceData.cpu.temperature && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Temperature:</span>
                    <span style={{ color: 'var(--color-text)' }}>{resourceData.cpu.temperature.toFixed(1)}°C</span>
                  </div>
                )}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${resourceData.cpu.usage}%`,
                      backgroundColor: getStatusColor(resourceData.cpu.usage)
                    }}
                  ></div>
                </div>
              </div>
            </motion.div>

            {/* Memory Card */}
            <motion.div
              whileHover={{ y: -2 }}
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <CircleStackIcon className="w-6 h-6 mr-2" style={{ color: 'var(--color-primary)' }} />
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>Memory</span>
                </div>
                <span className="text-lg font-bold" style={{ color: getStatusColor(resourceData.memory.usage) }}>
                  {resourceData.memory.usage.toFixed(1)}%
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Used:</span>
                  <span style={{ color: 'var(--color-text)' }}>{formatBytes(resourceData.memory.used)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Total:</span>
                  <span style={{ color: 'var(--color-text)' }}>{formatBytes(resourceData.memory.total)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${resourceData.memory.usage}%`,
                      backgroundColor: getStatusColor(resourceData.memory.usage)
                    }}
                  ></div>
                </div>
              </div>
            </motion.div>

            {/* Disk Card */}
            <motion.div
              whileHover={{ y: -2 }}
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <ComputerDesktopIcon className="w-6 h-6 mr-2" style={{ color: 'var(--color-primary)' }} />
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>Disk</span>
                </div>
                <span className="text-lg font-bold" style={{ color: getStatusColor(resourceData.disk.usage) }}>
                  {resourceData.disk.usage.toFixed(1)}%
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Used:</span>
                  <span style={{ color: 'var(--color-text)' }}>{formatBytes(resourceData.disk.used)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Total:</span>
                  <span style={{ color: 'var(--color-text)' }}>{formatBytes(resourceData.disk.total)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${resourceData.disk.usage}%`,
                      backgroundColor: getStatusColor(resourceData.disk.usage)
                    }}
                  ></div>
                </div>
              </div>
            </motion.div>

            {/* Network Card */}
            <motion.div
              whileHover={{ y: -2 }}
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <SignalIcon className="w-6 h-6 mr-2" style={{ color: 'var(--color-primary)' }} />
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>Network</span>
                </div>
                <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                  {resourceData.network.connections}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Sent:</span>
                  <span style={{ color: 'var(--color-text)' }}>{formatBytes(resourceData.network.bytesSent)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Received:</span>
                  <span style={{ color: 'var(--color-text)' }}>{formatBytes(resourceData.network.bytesRecv)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Connections:</span>
                  <span style={{ color: 'var(--color-text)' }}>{resourceData.network.connections}</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* System Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Stats */}
            <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text)' }}>
                <ServerIcon className="w-5 h-5 mr-2" style={{ color: 'var(--color-primary)' }} />
                System Information
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Uptime:</span>
                  <span style={{ color: 'var(--color-text)' }}>{resourceData.system.uptime}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Load Average:</span>
                  <span style={{ color: 'var(--color-text)' }}>
                    {resourceData.system.loadAverage.map((load, i) => `${load.toFixed(2)}`).join(', ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Processes:</span>
                  <span style={{ color: 'var(--color-text)' }}>{resourceData.system.processes}</span>
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text)' }}>
                <ExclamationTriangleIcon className="w-5 h-5 mr-2" style={{ color: 'var(--color-primary)' }} />
                System Alerts
              </h3>
              <div className="space-y-2">
                {resourceData.alerts.length > 0 ? (
                  resourceData.alerts.map((alert, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg flex items-start"
                      style={{
                        backgroundColor: alert.type === 'error' ? 'var(--color-error)10' :
                                       alert.type === 'warning' ? 'var(--color-warning)10' :
                                       'var(--color-success)10',
                        border: `1px solid ${
                          alert.type === 'error' ? 'var(--color-error)' :
                          alert.type === 'warning' ? 'var(--color-warning)' :
                          'var(--color-success)'
                        }`
                      }}
                    >
                      {alert.type === 'error' ? (
                        <ExclamationTriangleIcon className="w-4 h-4 mr-2 mt-0.5" style={{ color: 'var(--color-error)' }} />
                      ) : alert.type === 'warning' ? (
                        <ExclamationTriangleIcon className="w-4 h-4 mr-2 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                      ) : (
                        <CheckCircleIcon className="w-4 h-4 mr-2 mt-0.5" style={{ color: 'var(--color-success)' }} />
                      )}
                      <div>
                        <p className="text-sm" style={{ color: 'var(--color-text)' }}>{alert.message}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
                    No alerts at this time
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 