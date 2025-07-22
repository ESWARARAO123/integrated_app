import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import {
  CircleStackIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface RunStatusDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface ConnectionStatus {
  isConnected: boolean;
  host: string;
  port: number;
  database: string;
  lastRefresh: string | null;
  totalTables: number;
  refreshInterval: number;
}

interface RunStatusDbSettingsProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function RunStatusDbSettings({ onSuccess, onError }: RunStatusDbSettingsProps) {
  const { currentTheme } = useTheme();
  const [config, setConfig] = useState<RunStatusDbConfig>({
    host: '',
    port: 5432,
    database: '',
    user: '',
    password: ''
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Load current configuration on component mount
  useEffect(() => {
    loadCurrentConfig();
    loadConnectionStatus();
  }, []);

  const loadCurrentConfig = async () => {
    try {
      console.log('Loading RunStatus DB configuration...');
      const response = await fetch('/api/settings/runstatus-db/config');
      
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded config:', data);
        if (data.success && data.config) {
          setConfig(data.config);
        }
      } else {
        console.warn('Failed to load config, response not ok:', response.status);
      }
    } catch (error) {
      console.error('Error loading user database config:', error);
    }
  };

  const loadConnectionStatus = async () => {
    try {
      console.log('Loading RunStatus DB connection status...');
      const response = await fetch('/api/runstatus-db/status');
      
      if (response.ok) {
        const data = await response.json();
        console.log('Connection status response:', data);
        
        if (data.success && data.connection) {
          setConnectionStatus(data.connection);
        } else {
          console.warn('No connection data in response');
          setConnectionStatus(null);
        }
      } else {
        console.warn('Failed to load connection status, response not ok:', response.status);
        setConnectionStatus(null);
      }
    } catch (error) {
      console.error('Error loading connection status:', error);
      setConnectionStatus(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value) || 5432 : value
    }));
  };

  const disconnectDatabase = async () => {
    setIsDisconnecting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      console.log('Attempting to disconnect RunStatus database...');
      
      const response = await fetch('/api/settings/runstatus-db/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Disconnect response status:', response.status);
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const data = await response.json();
      console.log('Disconnect response data:', data);

      if (response.ok && data.success) {
        setSuccessMessage(data.message || 'Database disconnected successfully!');
        setConnectionStatus(null);
        // Clear the form
        setConfig({
          host: '',
          port: 5432,
          database: '',
          user: '',
          password: ''
        });
        
        // Reload connection status after a short delay
        setTimeout(() => {
          loadConnectionStatus();
        }, 1000);
      } else {
        const errorMsg = data.error || data.details || 'Failed to disconnect database';
        console.error('Disconnect failed:', errorMsg);
        setErrorMessage(errorMsg);
      }
    } catch (error: any) {
      console.error('Disconnect error:', error);
      setErrorMessage(`Failed to disconnect: ${error.message || 'Network or server error'}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const saveConfiguration = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/settings/runstatus-db/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage('Connected Successfully! Database configuration saved.');
        // Reload connection status after a short delay
        setTimeout(() => {
          loadConnectionStatus();
        }, 2000);
      } else {
        setErrorMessage(data.error || 'Failed to save configuration');
      }
    } catch (error: any) {
      setErrorMessage(`Failed to save configuration: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/settings/runstatus-db/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage('Connection test successful! You can now save the configuration.');
      } else {
        setErrorMessage(data.error || 'Connection test failed');
      }
    } catch (error: any) {
      setErrorMessage(`Connection test failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 3000);

    // Call the parent component's onSuccess handler if provided
    if (onSuccess) {
      onSuccess(message);
    }
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setTimeout(() => setErrorMessage(''), 5000);

    // Call the parent component's onError handler if provided
    if (onError) {
      onError(message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl p-6 backdrop-blur-sm"
      style={{
        background: 'linear-gradient(to-r, var(--color-surface), var(--color-surface-dark))',
        border: '1px solid var(--color-border)',
        boxShadow: '0 10px 25px -5px var(--color-shadow), 0 8px 10px -6px var(--color-shadow-light)',
      }}
    >
      {/* Header */}
      <div className="flex items-center mb-6">
        <CircleStackIcon className="w-6 h-6 mr-3" style={{ color: 'var(--color-primary)' }} />
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            RunStatus DB Settings
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Configure connection to the RunStatus database
          </p>
        </div>
      </div>

      {/* Connection Status */}
      {connectionStatus && (
        <div className="mb-6 p-4 rounded-lg" style={{
          backgroundColor: connectionStatus.isConnected ? 'var(--color-success)10' : 'var(--color-error)10',
          border: `1px solid ${connectionStatus.isConnected ? 'var(--color-success)' : 'var(--color-error)'}`,
        }}>
          <div className="flex items-center">
            {connectionStatus.isConnected ? (
              <CheckCircleIcon className="w-5 h-5 mr-2" style={{ color: 'var(--color-success)' }} />
            ) : (
              <XCircleIcon className="w-5 h-5 mr-2" style={{ color: 'var(--color-error)' }} />
            )}
            <span style={{ color: connectionStatus.isConnected ? 'var(--color-success)' : 'var(--color-error)' }}>
              {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {connectionStatus.isConnected && (
            <div className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <p>Host: {connectionStatus.host}:{connectionStatus.port}</p>
              <p>Database: {connectionStatus.database}</p>
              <p>Tables: {connectionStatus.totalTables}</p>
              {connectionStatus.lastRefresh && (
                <p>Last Refresh: {new Date(connectionStatus.lastRefresh).toLocaleString()}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Success/Error Messages */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-lg"
          style={{
            background: 'var(--color-success)10',
            border: '1px solid var(--color-success)',
            color: 'var(--color-success)',
          }}
        >
          <div className="flex items-center">
            <CheckCircleIcon className="w-5 h-5 mr-2" />
            {successMessage}
          </div>
        </motion.div>
      )}

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-lg"
          style={{
            background: 'var(--color-error)10',
            border: '1px solid var(--color-error)',
            color: 'var(--color-error)',
          }}
        >
          <div className="flex items-center">
            <XCircleIcon className="w-5 h-5 mr-2" />
            {errorMessage}
          </div>
        </motion.div>
      )}

      {/* Configuration Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Host */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Host
            </label>
            <input
              type="text"
              name="host"
              value={config.host}
              onChange={handleInputChange}
              placeholder="Enter database host"
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{
                backgroundColor: 'var(--color-surface-dark)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {/* Port */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Port
            </label>
            <input
              type="number"
              name="port"
              value={config.port}
              onChange={handleInputChange}
              placeholder="Enter port number"
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{
                backgroundColor: 'var(--color-surface-dark)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>
        </div>

        {/* Database Name */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
            DB Name
          </label>
          <input
            type="text"
            name="database"
            value={config.database}
            onChange={handleInputChange}
            placeholder="Enter database name"
            className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-opacity-50"
            style={{
              backgroundColor: 'var(--color-surface-dark)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
        </div>

        {/* Database User */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
            DB User
          </label>
          <input
            type="text"
            name="user"
            value={config.user}
            onChange={handleInputChange}
            placeholder="Enter database username"
            className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-opacity-50"
            style={{
              backgroundColor: 'var(--color-surface-dark)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
            Password
          </label>
          <input
            type="password"
            name="password"
            value={config.password}
            onChange={handleInputChange}
            placeholder="Enter database password"
            className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-opacity-50"
            style={{
              backgroundColor: 'var(--color-surface-dark)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          {connectionStatus?.isConnected && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={disconnectDatabase}
              disabled={isDisconnecting}
              className="flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'var(--color-error)',
                color: 'white',
                opacity: isDisconnecting ? 0.7 : 1,
              }}
            >
              {isDisconnecting ? (
                <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircleIcon className="w-4 h-4 mr-2" />
              )}
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={testConnection}
            disabled={isLoading || !config.host || !config.database || !config.user || !config.password}
            className="flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors mr-3"
            style={{
              backgroundColor: 'var(--color-secondary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              opacity: (isLoading || !config.host || !config.database || !config.user || !config.password) ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CircleStackIcon className="w-4 h-4 mr-2" />
            )}
            {isLoading ? 'Testing...' : 'Test Connection'}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={saveConfiguration}
            disabled={isLoading || !config.host || !config.database || !config.user || !config.password}
            className="flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              opacity: (isLoading || !config.host || !config.database || !config.user || !config.password) ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircleIcon className="w-4 h-4 mr-2" />
            )}
            {isLoading ? 'Connecting...' : 'Save Configuration'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}