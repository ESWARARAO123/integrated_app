import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CircleStackIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import predictionDbService, { PredictionDbConfig, PredictionConnectionStatus } from '../../services/predictionDbService';

export default function PredictionDBSettings() {
  const [config, setConfig] = useState<PredictionDbConfig>({ host: '', port: 5432, database: '', user: '', password: '' });
  const [connectionStatus, setConnectionStatus] = useState<PredictionConnectionStatus | null>(null);
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
      const data = await predictionDbService.getConfig();
      if (data.config) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Error loading prediction database config:', error);
    }
  };

  const loadConnectionStatus = async () => {
    try {
      const status = await predictionDbService.getStatus();
      console.log('Prediction DB Status:', status);
      setConnectionStatus(status.connection);
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
      const result = await predictionDbService.disconnect();
      if (result.success) {
        setSuccessMessage('Database disconnected successfully!');
        setConnectionStatus(null);
        // Clear the form
        setConfig({ host: '', port: 5432, database: '', user: '', password: '' });
      } else {
        setErrorMessage(result.message || 'Failed to disconnect');
      }
    } catch (error: any) {
      setErrorMessage(`Failed to disconnect: ${error.message}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const saveConfiguration = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await predictionDbService.saveConfig(config);
      if (result.success) {
        setSuccessMessage('Connected Successfully! Database configuration saved.');
        // Reload connection status after a short delay
        setTimeout(async () => {
          await loadConnectionStatus();
        }, 1000);
      } else {
        setErrorMessage(result.message || 'Failed to save configuration');
      }
    } catch (error: any) {
      setErrorMessage(`Failed to save configuration: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-primary-alpha)' }}>
          <CircleStackIcon className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
        </div>
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Prediction Database Settings
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Configure the PostgreSQL database connection for the prediction system
          </p>
        </div>
      </div>

      {/* Connection Status */}
      {connectionStatus && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-lg border"
          style={{ 
            backgroundColor: 'var(--color-surface)', 
            borderColor: 'var(--color-border)' 
          }}
        >
          <div className="flex items-center space-x-3 mb-3">
            {connectionStatus.isConnected ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
            ) : (
              <XCircleIcon className="h-5 w-5 text-red-500" />
            )}
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>
              {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {connectionStatus.isConnected && (
            <div className="space-y-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <div>
                <strong>Host:</strong> {connectionStatus.host}:{connectionStatus.port}
              </div>
              <div>
                <strong>Database:</strong> {connectionStatus.database}
              </div>
              <div>
                <strong>Tables:</strong> {connectionStatus.totalTables}
              </div>
              {connectionStatus.lastRefresh && (
                <div>
                  <strong>Last Refresh:</strong> {new Date(connectionStatus.lastRefresh).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Success/Error Messages */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-green-50 border border-green-200"
        >
          <p className="text-green-800 text-sm">{successMessage}</p>
        </motion.div>
      )}

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-red-50 border border-red-200"
        >
          <p className="text-red-800 text-sm">{errorMessage}</p>
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
              className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="localhost"
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
              className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="5432"
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
            className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)'
            }}
            placeholder="prediction_db"
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
            className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)'
            }}
            placeholder="postgres"
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
            className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)'
            }}
            placeholder="Enter password"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {connectionStatus?.isConnected && (
            <button
              onClick={disconnectDatabase}
              disabled={isDisconnecting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isDisconnecting ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <XCircleIcon className="h-4 w-4" />
              )}
              <span>{isDisconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
            </button>
          )}

          <button
            onClick={saveConfiguration}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoading ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircleIcon className="h-4 w-4" />
            )}
            <span>{isLoading ? 'Connecting...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}