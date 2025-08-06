import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, ServerIcon, KeyIcon } from '@heroicons/react/24/outline';

interface SSHConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (ip: string, username: string, password: string) => Promise<void>;
  server: {
    ip: string;
    hostname?: string;
    os?: string;
  } | null;
}

export default function SSHConnectionModal({ isOpen, onClose, onConnect, server }: SSHConnectionModalProps) {
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!server) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      await onConnect(server.ip, username, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    setUsername('root');
    setPassword('');
    setError(null);
    onClose();
  };

  if (!server) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)'
            }}
          >
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center space-x-3">
                <ServerIcon className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                  Connect to Server
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                  Server
                </label>
                <div className="flex items-center space-x-2 p-3 rounded border" style={{ backgroundColor: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)' }}>
                  <ServerIcon className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                  <span style={{ color: 'var(--color-text)' }}>
                    {server.ip} {server.hostname && `(${server.hostname})`}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  placeholder="root"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  placeholder="Enter password"
                />
              </div>

              {error && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border rounded-md transition-colors"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnect}
                  disabled={isConnecting || !username || !password}
                  className="flex-1 px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'white'
                  }}
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 