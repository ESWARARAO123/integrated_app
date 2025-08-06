import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ServerIcon,
  ChartBarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export default function ResourceDetails() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server Management State
  const [serverManagement, setServerManagement] = useState({
    networkRange: '172.16.16',
    sshUsername: 'root',
    maxIps: 30,
    startIp: 1,
    isScanning: false,
    discoveredServers: {},
    connectedServers: {},
    scanStatus: ''
  });

  const [manualServer, setManualServer] = useState({
    ip: '',
    username: 'root',
    password: ''
  });

  // Server Management Functions
  const fetchServerStatus = async () => {
    try {
      const resourceMonitorUrl = process.env.REACT_APP_RESOURCE_MONITOR_URL || 'http://localhost:8005';
      console.log('📡 Fetching server status from:', resourceMonitorUrl);
      
      const response = await fetch(`${resourceMonitorUrl}/api/server-status`);
      console.log('📡 Server status response:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📡 Server status data:', data);
        
        if (data.success) {
          console.log('📡 Updating server management state with:', {
            discovered_servers: data.discovered_servers,
            connected_servers: data.connected_servers
          });
          
          setServerManagement(prev => ({
            ...prev,
            discoveredServers: data.discovered_servers || {},
            connectedServers: data.connected_servers || {}
          }));
        }
      } else {
        console.error('📡 Failed to fetch server status:', response.status);
      }
    } catch (err) {
      console.error('📡 Error fetching server status:', err);
    }
  };

  const startNetworkScan = async () => {
    try {
      setServerManagement(prev => ({ ...prev, isScanning: true, scanStatus: 'Scanning network...' }));
      
      const resourceMonitorUrl = process.env.REACT_APP_RESOURCE_MONITOR_URL || 'http://localhost:8005';
      console.log('🔍 Starting network scan with URL:', resourceMonitorUrl);
      console.log('🔍 Scan parameters:', {
        network_range: serverManagement.networkRange,
        username: serverManagement.sshUsername,
        max_ips: serverManagement.maxIps,
        start_ip: serverManagement.startIp
      });
      
      const response = await fetch(`${resourceMonitorUrl}/api/scan-network`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network_range: serverManagement.networkRange,
          username: serverManagement.sshUsername,
          max_ips: serverManagement.maxIps,
          start_ip: serverManagement.startIp
        })
      });

      console.log('🔍 Response status:', response.status);
      console.log('🔍 Response headers:', response.headers);

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Response data:', data);
        
        if (data.success) {
          console.log('🔍 Scan successful, discovered servers:', data.discovered_servers);
          setServerManagement(prev => ({
            ...prev,
            discoveredServers: data.discovered_servers || {},
            scanStatus: data.message
          }));
          
          // Also refresh the server status to get the latest data
          await fetchServerStatus();
        } else {
          console.error('🔍 Scan failed:', data.error);
          setServerManagement(prev => ({ ...prev, scanStatus: data.error || 'Scan failed' }));
        }
      } else {
        const errorText = await response.text();
        console.error('🔍 HTTP error:', response.status, errorText);
        setServerManagement(prev => ({ ...prev, scanStatus: `HTTP error: ${response.status}` }));
      }
    } catch (err) {
      console.error('🔍 Network scan error:', err);
      setServerManagement(prev => ({ ...prev, scanStatus: 'Scan failed: ' + err.message }));
    } finally {
      setServerManagement(prev => ({ ...prev, isScanning: false }));
    }
  };

  const stopNetworkScan = async () => {
    try {
      const resourceMonitorUrl = process.env.REACT_APP_RESOURCE_MONITOR_URL || 'http://localhost:8005';
      await fetch(`${resourceMonitorUrl}/api/stop-scan`, { method: 'POST' });
      setServerManagement(prev => ({ ...prev, isScanning: false, scanStatus: 'Scan stopped' }));
    } catch (err) {
      console.error('Error stopping scan:', err);
    }
  };

  const connectToServer = async (ip: string, username: string, password: string) => {
    try {
      const resourceMonitorUrl = process.env.REACT_APP_RESOURCE_MONITOR_URL || 'http://localhost:8005';
      const response = await fetch(`${resourceMonitorUrl}/api/connect-server`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, username, password })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          await fetchServerStatus(); // Refresh server list
        }
        return data;
      }
    } catch (err) {
      console.error('Error connecting to server:', err);
      return { success: false, error: err.message };
    }
  };

  const disconnectFromServer = async (ip: string) => {
    try {
      const resourceMonitorUrl = process.env.REACT_APP_RESOURCE_MONITOR_URL || 'http://localhost:8005';
      const response = await fetch(`${resourceMonitorUrl}/api/disconnect-server`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          await fetchServerStatus(); // Refresh server list
        }
        return data;
      }
    } catch (err) {
      console.error('Error disconnecting from server:', err);
      return { success: false, error: err.message };
    }
  };

  const saveConfiguration = async () => {
    try {
      const resourceMonitorUrl = process.env.REACT_APP_RESOURCE_MONITOR_URL || 'http://localhost:8005';
      const response = await fetch(`${resourceMonitorUrl}/api/save-config`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (err) {
      console.error('Error saving configuration:', err);
      return { success: false, error: err.message };
    }
  };

  const loadConfiguration = async () => {
    try {
      const resourceMonitorUrl = process.env.REACT_APP_RESOURCE_MONITOR_URL || 'http://localhost:8005';
      const response = await fetch(`${resourceMonitorUrl}/api/load-config`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          await fetchServerStatus(); // Refresh server list
        }
        return data;
      }
    } catch (err) {
      console.error('Error loading configuration:', err);
      return { success: false, error: err.message };
    }
  };

  // Load server status on component mount
  useEffect(() => {
    fetchServerStatus();
  }, []);

  // Debug: Log state changes
  useEffect(() => {
    console.log('🔄 Server management state updated:', {
      discoveredServers: serverManagement.discoveredServers,
      connectedServers: serverManagement.connectedServers,
      scanStatus: serverManagement.scanStatus,
      isScanning: serverManagement.isScanning
    });
  }, [serverManagement.discoveredServers, serverManagement.connectedServers, serverManagement.scanStatus, serverManagement.isScanning]);

  if (isLoading) {
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
      {/* Server Management Settings */}
      <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text)' }}>
          <ServerIcon className="w-5 h-5 mr-2" style={{ color: 'var(--color-primary)' }} />
          ⚙️ Server Management Settings
        </h3>
        
        <div className="space-y-6">
          {/* Network Discovery Section */}
          <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-dark)', borderColor: 'var(--color-border)' }}>
            <h4 className="text-md font-semibold mb-3 flex items-center" style={{ color: 'var(--color-text)' }}>
              🔍 Network Discovery
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Network Range:
                </label>
                <input
                  type="text"
                  value={serverManagement.networkRange}
                  onChange={(e) => setServerManagement(prev => ({ ...prev, networkRange: e.target.value }))}
                  className="w-full px-3 py-2 rounded border"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  placeholder="172.16.16"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  SSH Username:
                </label>
                <input
                  type="text"
                  value={serverManagement.sshUsername}
                  onChange={(e) => setServerManagement(prev => ({ ...prev, sshUsername: e.target.value }))}
                  className="w-full px-3 py-2 rounded border"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  placeholder="root"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Max IPs to Scan:
                </label>
                <input
                  type="number"
                  value={serverManagement.maxIps}
                  onChange={(e) => setServerManagement(prev => ({ ...prev, maxIps: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 rounded border"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  min="1"
                  max="254"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Start IP (optional):
                </label>
                <input
                  type="number"
                  value={serverManagement.startIp}
                  onChange={(e) => setServerManagement(prev => ({ ...prev, startIp: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 rounded border"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  min="1"
                  max="254"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={startNetworkScan}
                disabled={serverManagement.isScanning}
                className="px-4 py-2 rounded-lg transition-all"
                style={{
                  backgroundColor: serverManagement.isScanning ? 'var(--color-border)' : 'var(--color-primary)',
                  color: 'white',
                  opacity: serverManagement.isScanning ? 0.7 : 1
                }}
              >
                {serverManagement.isScanning ? '🔄 Scanning...' : '🔍 Scan Network'}
              </button>
              {serverManagement.isScanning && (
                <button
                  onClick={stopNetworkScan}
                  className="px-4 py-2 rounded-lg transition-all border"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-warning)',
                    color: 'var(--color-warning)'
                  }}
                >
                  🛑 Stop Scan
                </button>
              )}
              {serverManagement.scanStatus && (
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {serverManagement.scanStatus}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <h5 className="font-medium" style={{ color: 'var(--color-text)' }}>Discovered Servers:</h5>
              {Object.keys(serverManagement.discoveredServers).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(serverManagement.discoveredServers).map(([ip, server]: [string, any]) => (
                    <div key={ip} className="p-3 rounded border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium" style={{ color: 'var(--color-text)' }}>{ip}</span>
                          <span className="text-sm ml-2" style={{ color: 'var(--color-text-secondary)' }}>
                            {server.info?.hostname || 'Unknown'}
                          </span>
                        </div>
                        <button
                          onClick={() => connectToServer(ip, serverManagement.sshUsername, '')}
                          className="px-3 py-1 rounded text-sm transition-all"
                          style={{
                            backgroundColor: 'var(--color-success)',
                            color: 'white'
                          }}
                        >
                          Connect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No servers discovered yet. Click "Scan Network" to start discovery.
                </p>
              )}
            </div>
          </div>

          {/* Server Connections Section */}
          <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-dark)', borderColor: 'var(--color-border)' }}>
            <h4 className="text-md font-semibold mb-3 flex items-center" style={{ color: 'var(--color-text)' }}>
              🔗 Server Connections
            </h4>
            <div className="space-y-2">
              {Object.keys(serverManagement.connectedServers).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(serverManagement.connectedServers).map(([ip, server]: [string, any]) => (
                    <div key={ip} className="p-3 rounded border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium" style={{ color: 'var(--color-text)' }}>{ip}</span>
                          <span className="text-sm ml-2" style={{ color: 'var(--color-text-secondary)' }}>
                            {server.info?.hostname || 'Unknown'}
                          </span>
                          <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                            CPU: {server.info?.cpu_percent || 0}% | 
                            Memory: {server.info?.memory_percent || 0}% | 
                            Disk: {server.info?.disk_percent || 0}%
                          </div>
                        </div>
                        <button
                          onClick={() => disconnectFromServer(ip)}
                          className="px-3 py-1 rounded text-sm transition-all border"
                          style={{
                            backgroundColor: 'var(--color-surface)',
                            borderColor: 'var(--color-error)',
                            color: 'var(--color-error)'
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No servers connected yet.
                </p>
              )}
            </div>
          </div>

          {/* Add Server Manually Section */}
          <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-dark)', borderColor: 'var(--color-border)' }}>
            <h4 className="text-md font-semibold mb-3 flex items-center" style={{ color: 'var(--color-text)' }}>
              ➕ Add Server Manually
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Server IP Address
                </label>
                <input
                  type="text"
                  value={manualServer.ip}
                  onChange={(e) => setManualServer(prev => ({ ...prev, ip: e.target.value }))}
                  className="w-full px-3 py-2 rounded border"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={manualServer.username}
                  onChange={(e) => setManualServer(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 rounded border"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  placeholder="root"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Password (optional for key auth)
                </label>
                <input
                  type="password"
                  value={manualServer.password}
                  onChange={(e) => setManualServer(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 rounded border"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  placeholder="Password"
                />
              </div>
            </div>
            <button
              onClick={() => connectToServer(manualServer.ip, manualServer.username, manualServer.password)}
              disabled={!manualServer.ip}
              className="px-4 py-2 rounded-lg transition-all"
              style={{
                backgroundColor: !manualServer.ip ? 'var(--color-border)' : 'var(--color-success)',
                color: 'white',
                opacity: !manualServer.ip ? 0.7 : 1
              }}
            >
              ➕ Add Server
            </button>
          </div>

          {/* Configuration Section */}
          <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-dark)', borderColor: 'var(--color-border)' }}>
            <h4 className="text-md font-semibold mb-3 flex items-center" style={{ color: 'var(--color-text)' }}>
              💾 Configuration
            </h4>
            <div className="flex gap-4">
              <button
                onClick={saveConfiguration}
                className="px-4 py-2 rounded-lg transition-all"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'white'
                }}
              >
                💾 Save Configuration
              </button>
              <button
                onClick={loadConfiguration}
                className="px-4 py-2 rounded-lg transition-all border"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
              >
                📂 Load Configuration
              </button>
              <button
                onClick={fetchServerStatus}
                className="px-4 py-2 rounded-lg transition-all border"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-primary)',
                  color: 'var(--color-primary)'
                }}
              >
                🔄 Refresh Status
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 