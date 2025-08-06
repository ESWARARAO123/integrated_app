import React, { useState } from 'react';
import { ChevronDownIcon, ServerIcon, CheckIcon } from '@heroicons/react/24/outline';

interface Server {
  ip: string;
  hostname?: string;
  status?: string;
  connected_at?: string;
}

interface ServerSelectorProps {
  currentServer: Server;
  connectedServers: { [key: string]: Server };
  onServerSelect: (server: Server) => void;
}

export default function ServerSelector({ currentServer, connectedServers, onServerSelect }: ServerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const allServers = [
    currentServer,
    ...Object.values(connectedServers)
  ];

  const handleServerSelect = (server: Server) => {
    onServerSelect(server);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 border rounded-md hover:bg-gray-50 transition-colors"
        style={{
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)'
        }}
      >
        <ServerIcon className="h-4 w-4" />
        <span className="text-sm font-medium">
          {currentServer.hostname || currentServer.ip}
        </span>
        <ChevronDownIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-md shadow-lg z-50"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)'
          }}
        >
          <div className="py-1">
            {allServers.map((server, index) => (
              <button
                key={server.ip}
                onClick={() => handleServerSelect(server)}
                className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                style={{
                  color: 'var(--color-text)',
                  borderBottom: index < allServers.length - 1 ? '1px solid var(--color-border)' : 'none'
                }}
              >
                <div className="flex items-center space-x-2">
                  <ServerIcon className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
                  <div>
                    <div className="text-sm font-medium">
                      {server.hostname || server.ip}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {server.status === 'current' ? 'Current Server' : 'Connected'}
                    </div>
                  </div>
                </div>
                {server.status === 'current' && (
                  <CheckIcon className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 