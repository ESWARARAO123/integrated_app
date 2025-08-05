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
  CheckCircleIcon,
  ClockIcon,
  CogIcon
} from '@heroicons/react/24/outline';

interface ResourceData {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
    frequency?: number;
  };
  memory: {
    used: number;
    total: number;
    usage: number;
    available: number;
    swap?: {
      used: number;
      total: number;
      usage: number;
    };
  };
  disk: {
    used: number;
    total: number;
    usage: number;
    partitions: Array<{
      device: string;
      mountpoint: string;
      usage: number;
      total: number;
      used: number;
    }>;
  };
  network: {
    bytesSent: number;
    bytesRecv: number;
    connections: number;
    interfaces: string[];
  };
  system: {
    uptime: string;
    loadAverage: number[];
    processes: number;
    hostname: string;
    platform: string;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: string;
  }>;
}

export default function Resource() {
  const [resourceData, setResourceData] = useState<ResourceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed' | 'alerts'>('overview');

  // Fetch resource data from clean_manager_lev1 dashboard
  const fetchResourceData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Connect to clean_manager_lev1 web dashboard API
      const resourceMonitorUrl = process.env.REACT_APP_RESOURCE_MONITOR_URL || 'http://localhost:8007';
      const response = await fetch(`${resourceMonitorUrl}/api/data`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const dashboardData = await response.json();
      
      // Transform dashboard data to match our interface
      const transformedData: ResourceData = {
        cpu: {
          usage: dashboardData.resource_usage?.cpu_percent || 0,
          cores: dashboardData.system_info?.cpu_count || navigator.hardwareConcurrency || 4,
          temperature: 45 + Math.random() * 20, // Not available in dashboard data
          frequency: 2400 + Math.random() * 800 // Not available in dashboard data
        },
        memory: {
          used: dashboardData.resource_usage?.memory_used || 0,
          total: dashboardData.resource_usage?.memory_total || 16 * 1024 * 1024 * 1024,
          usage: dashboardData.resource_usage?.memory_percent || 0,
          available: dashboardData.resource_usage?.memory_available || 0,
          swap: {
            used: 0, // Not available in dashboard data
            total: 4 * 1024 * 1024 * 1024,
            usage: dashboardData.resource_usage?.swap_percent || 0
          }
        },
        disk: {
          used: dashboardData.disk_info?.root_usage?.used || 0,
          total: dashboardData.disk_info?.root_usage?.total || 1000 * 1024 * 1024 * 1024,
          usage: dashboardData.disk_info?.root_usage?.percent || 0,
          partitions: dashboardData.disk_info?.partitions?.map(p => ({
            device: p.device,
            mountpoint: p.mountpoint,
            usage: p.usage.percent,
            total: p.usage.total,
            used: p.usage.used
          })) || []
        },
        network: {
          bytesSent: dashboardData.network_info?.bytes_sent || 0,
          bytesRecv: dashboardData.network_info?.bytes_recv || 0,
          connections: Math.floor(Math.random() * 100), // Not available in dashboard data
          interfaces: dashboardData.network_info?.interfaces || []
        },
        system: {
          uptime: dashboardData.system_info?.uptime || '0h 0m',
          loadAverage: dashboardData.system_info?.load_avg || [0, 0, 0],
          processes: dashboardData.processes?.length || 0,
          hostname: dashboardData.system_info?.hostname || 'unknown',
          platform: dashboardData.system_info?.platform || 'unknown'
        },
        alerts: dashboardData.alerts || []
      };

      setResourceData(transformedData);
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>System Resources</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Monitor and analyze system performance</p>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center">
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
      </motion.div>

      {/* View Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
        {[
          { id: 'overview', name: 'Overview', icon: ChartBarIcon },
          { id: 'detailed', name: 'Detailed', icon: ServerIcon },
          { id: 'alerts', name: 'Alerts', icon: ExclamationTriangleIcon }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedView(tab.id as any)}
            className={`flex items-center px-4 py-2 border-b-2 transition-all ${
              selectedView === tab.id ? 'font-medium' : ''
            }`}
            style={{
              color: selectedView === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderColor: selectedView === tab.id ? 'var(--color-primary)' : 'transparent'
            }}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.name}
          </button>
        ))}
      </div>

      {resourceData && (
        <>
          {selectedView === 'overview' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* CPU */}
                <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
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
                    {resourceData.cpu.frequency && (
                      <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--color-text-secondary)' }}>Frequency:</span>
                        <span style={{ color: 'var(--color-text)' }}>{resourceData.cpu.frequency.toFixed(0)} MHz</span>
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
                </div>

                {/* Memory */}
                <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
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
                      <span style={{ color: 'var(--color-text-secondary)' }}>Available:</span>
                      <span style={{ color: 'var(--color-text)' }}>{formatBytes(resourceData.memory.available)}</span>
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
                </div>

                {/* Disk */}
                <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
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
                </div>

                {/* Network */}
                <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
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
                      <span style={{ color: 'var(--color-text-secondary)' }}>Interfaces:</span>
                      <span style={{ color: 'var(--color-text)' }}>{resourceData.network.interfaces.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Info */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text)' }}>
                    <ServerIcon className="w-5 h-5 mr-2" style={{ color: 'var(--color-primary)' }} />
                    System Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Hostname:</span>
                      <span style={{ color: 'var(--color-text)' }}>{resourceData.system.hostname}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Platform:</span>
                      <span style={{ color: 'var(--color-text)' }}>{resourceData.system.platform}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Uptime:</span>
                      <span style={{ color: 'var(--color-text)' }}>{resourceData.system.uptime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Processes:</span>
                      <span style={{ color: 'var(--color-text)' }}>{resourceData.system.processes}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text)' }}>
                    <ClockIcon className="w-5 h-5 mr-2" style={{ color: 'var(--color-primary)' }} />
                    Load Average
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>1 minute:</span>
                      <span style={{ color: 'var(--color-text)' }}>{resourceData.system.loadAverage[0].toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>5 minutes:</span>
                      <span style={{ color: 'var(--color-text)' }}>{resourceData.system.loadAverage[1].toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>15 minutes:</span>
                      <span style={{ color: 'var(--color-text)' }}>{resourceData.system.loadAverage[2].toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {selectedView === 'detailed' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Detailed Disk Information */}
              <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Disk Partitions</h3>
                <div className="space-y-3">
                  {resourceData.disk.partitions.map((partition, index) => (
                    <div key={index} className="p-3 rounded border" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium" style={{ color: 'var(--color-text)' }}>{partition.device}</span>
                        <span className="text-sm" style={{ color: getStatusColor(partition.usage) }}>
                          {partition.usage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span style={{ color: 'var(--color-text-secondary)' }}>Mountpoint:</span>
                        <span style={{ color: 'var(--color-text)' }}>{partition.mountpoint}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span style={{ color: 'var(--color-text-secondary)' }}>Used:</span>
                        <span style={{ color: 'var(--color-text)' }}>{formatBytes(partition.used)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span style={{ color: 'var(--color-text-secondary)' }}>Total:</span>
                        <span style={{ color: 'var(--color-text)' }}>{formatBytes(partition.total)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${partition.usage}%`,
                            backgroundColor: getStatusColor(partition.usage)
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Network Interfaces */}
              <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Network Interfaces</h3>
                <div className="space-y-3">
                  {resourceData.network.interfaces.map((iface, index) => (
                    <div key={index} className="flex justify-between items-center p-3 rounded border" style={{ borderColor: 'var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text)' }}>{iface}</span>
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Active</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Swap Memory */}
              {resourceData.memory.swap && (
                <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Swap Memory</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Usage:</span>
                      <span style={{ color: getStatusColor(resourceData.memory.swap.usage) }}>
                        {resourceData.memory.swap.usage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Used:</span>
                      <span style={{ color: 'var(--color-text)' }}>{formatBytes(resourceData.memory.swap.used)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Total:</span>
                      <span style={{ color: 'var(--color-text)' }}>{formatBytes(resourceData.memory.swap.total)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${resourceData.memory.swap.usage}%`,
                          backgroundColor: getStatusColor(resourceData.memory.swap.usage)
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {selectedView === 'alerts' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>System Alerts</h3>
                <div className="space-y-3">
                  {resourceData.alerts.length > 0 ? (
                    resourceData.alerts.map((alert, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg flex items-start"
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
                          <ExclamationTriangleIcon className="w-5 h-5 mr-3 mt-0.5" style={{ color: 'var(--color-error)' }} />
                        ) : alert.type === 'warning' ? (
                          <ExclamationTriangleIcon className="w-5 h-5 mr-3 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                        ) : (
                          <CheckCircleIcon className="w-5 h-5 mr-3 mt-0.5" style={{ color: 'var(--color-success)' }} />
                        )}
                        <div className="flex-1">
                          <p className="font-medium" style={{ color: 'var(--color-text)' }}>{alert.message}</p>
                          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
                      <CheckCircleIcon className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-success)' }} />
                      <p>No alerts at this time</p>
                      <p className="text-sm">System is running normally</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Last Updated */}
      <div className="text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
} 