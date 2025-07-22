import React, { useState } from 'react';
import { DatabaseConnection } from '../../services/flowtrackService';
import { useTheme } from '../../contexts/ThemeContext';

interface DatabaseConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (connection: DatabaseConnection) => void;
  isConnecting: boolean;
}

const DatabaseConnectionModal: React.FC<DatabaseConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  isConnecting
}) => {
  const { currentTheme } = useTheme();
  const [connection, setConnection] = useState<DatabaseConnection>({
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<keyof DatabaseConnection, string>>>({});

  const handleInputChange = (field: keyof DatabaseConnection, value: string | number | boolean | object) => {
    setConnection(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof DatabaseConnection, string>> = {};
    
    if (!connection.host.trim()) {
      newErrors.host = 'Host is required';
    }
    
    if (!connection.port || connection.port <= 0 || connection.port > 65535) {
      newErrors.port = 'Valid port number is required';
    }
    
    if (!connection.database.trim()) {
      newErrors.database = 'Database name is required';
    }
    
    if (!connection.username.trim()) {
      newErrors.username = 'Username is required';
    }
    
    if (!connection.password.trim()) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onConnect(connection);
    }
  };

  const handleClose = () => {
    if (!isConnecting) {
      onClose();
      setErrors({});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(8px)'
    }}>
      <div 
        className="rounded-2xl p-8 w-full max-w-lg mx-4 shadow-2xl"
        style={{
          background: `linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-light) 100%)`,
          border: '2px solid var(--color-border)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(15px)'
        }}
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold" style={{ 
            color: 'var(--color-text)',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
          }}>
            Connect to Database
          </h2>
          <button
            onClick={handleClose}
            disabled={isConnecting}
            className="p-2 rounded-full transition-colors disabled:opacity-50"
            style={{
              color: 'var(--color-text-muted)',
              background: 'rgba(0, 0, 0, 0.05)',
              border: '1px solid var(--color-border)'
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Host */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
              Host / IP Address
            </label>
            <input
              type="text"
              value={connection.host}
              onChange={(e) => handleInputChange('host', e.target.value)}
              disabled={isConnecting}
              className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none transition-all duration-200"
              style={{
                background: `linear-gradient(135deg, var(--color-background) 0%, var(--color-surface-light) 100%)`,
                borderColor: errors.host ? '#ef4444' : 'var(--color-border)',
                color: 'var(--color-text)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                fontWeight: '500'
              }}
              placeholder="e.g., localhost, 192.168.1.100, db.example.com"
            />
            {errors.host && (
              <p className="text-red-500 text-xs mt-1">{errors.host}</p>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Enter localhost, IP address, or domain name
            </p>
          </div>

          {/* Port */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
              Port
            </label>
            <input
              type="number"
              value={connection.port}
              onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 0)}
              disabled={isConnecting}
              className="w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: errors.port ? '#ef4444' : 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="5432"
              min="1"
              max="65535"
            />
            {errors.port && (
              <p className="text-red-500 text-xs mt-1">{errors.port}</p>
            )}
          </div>

          {/* Database */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
              Database
            </label>
            <input
              type="text"
              value={connection.database}
              onChange={(e) => handleInputChange('database', e.target.value)}
              disabled={isConnecting}
              className="w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: errors.database ? '#ef4444' : 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="e.g., mydb, flowtrack, production"
            />
            {errors.database && (
              <p className="text-red-500 text-xs mt-1">{errors.database}</p>
            )}
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
              Username
            </label>
            <input
              type="text"
              value={connection.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              disabled={isConnecting}
              className="w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: errors.username ? '#ef4444' : 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="e.g., postgres, admin, user"
            />
            {errors.username && (
              <p className="text-red-500 text-xs mt-1">{errors.username}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
              Password
            </label>
            <input
              type="password"
              value={connection.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              disabled={isConnecting}
              className="w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: errors.password ? '#ef4444' : 'var(--color-border)',
                color: 'var(--color-text)'
              }}
              placeholder="Enter password"
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {/* Advanced Options Toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={isConnecting}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center"
            >
              <svg 
                className={`w-4 h-4 mr-1 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced Options
            </button>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              {/* SSL */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                  SSL Mode
                </label>
                <select
                  value={connection.ssl?.toString() || 'false'}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleInputChange('ssl', value === 'true' ? true : value === 'false' ? false : value);
                  }}
                  disabled={isConnecting}
                  className="w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                >
                  <option value="false">Disable</option>
                  <option value="true">Require</option>
                  <option value="prefer">Prefer</option>
                </select>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Use SSL for secure connections (required for cloud databases)
                </p>
              </div>

              {/* Connection Timeout */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                  Connection Timeout (ms)
                </label>
                <input
                  type="number"
                  value={connection.connectionTimeoutMillis || 10000}
                  onChange={(e) => handleInputChange('connectionTimeoutMillis', parseInt(e.target.value) || 10000)}
                  disabled={isConnecting}
                  className="w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  min="1000"
                  max="60000"
                />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Timeout for establishing connection (increase for slow networks)
                </p>
              </div>

              {/* Max Connections */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                  Max Connections
                </label>
                <input
                  type="number"
                  value={connection.max || 10}
                  onChange={(e) => handleInputChange('max', parseInt(e.target.value) || 10)}
                  disabled={isConnecting}
                  className="w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  min="1"
                  max="50"
                />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Maximum number of concurrent connections
                </p>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isConnecting}
              className="px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-50"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isConnecting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {isConnecting && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 rounded" style={{ backgroundColor: 'var(--color-background)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <strong>Note:</strong> This will connect to your PostgreSQL database to analyze data and generate flow chart visualizations. Supports local, remote, and cloud databases.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DatabaseConnectionModal;