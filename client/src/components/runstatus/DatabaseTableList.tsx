import React, { useState } from 'react';
import { TableCellsIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../contexts/ThemeContext';

interface DatabaseTableListProps {
  tables: string[];
  onSelectTable: (tableName: string) => void;
  isDarkTheme?: boolean;
}

const DatabaseTableList: React.FC<DatabaseTableListProps> = ({
  tables,
  onSelectTable,
  isDarkTheme = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { currentTheme } = useTheme();

  const filteredTables = tables.filter(table => 
    table.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="database-table-list" style={{
      border: '2px solid var(--color-border)',
      borderRadius: '1rem',
      overflow: 'hidden',
      background: `linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-light) 100%)`,
      marginBottom: '1.5rem',
      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
      backdropFilter: 'blur(10px)'
    }}>
      <div className="table-list-header" style={{
        padding: '1rem 1.5rem',
        background: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)`,
        borderBottom: '1px solid var(--color-primary-light)',
      }}>
        <h3 style={{ 
          margin: '0 0 0.75rem 0', 
          fontSize: '1.1rem', 
          fontWeight: 700,
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
        }}>
          <TableCellsIcon className="w-5 h-5" style={{ color: 'rgba(255, 255, 255, 0.9)' }} />
          Database Tables ({tables.length})
        </h3>
        <input
          type="text"
          placeholder="Search tables..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.375rem 0.75rem',
            borderRadius: '0.375rem',
            border: isDarkTheme ? '1px solid #4b5563' : '1px solid #d1d5db',
            backgroundColor: isDarkTheme ? '#111827' : '#ffffff',
            color: isDarkTheme ? '#e5e7eb' : '#111827',
            fontSize: '0.875rem',
          }}
        />
      </div>
      
      <div style={{
        maxHeight: '300px',
        overflowY: 'auto',
      }}>
        {filteredTables.length > 0 ? (
          <ul style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}>
            {filteredTables.map((table, index) => (
              <li key={index}>
                <button
                  onClick={() => onSelectTable(table)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: index < filteredTables.length - 1 
                      ? (isDarkTheme ? '1px solid #2d3748' : '1px solid #e5e7eb')
                      : 'none',
                    color: isDarkTheme ? '#d1d5db' : '#374151',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkTheme ? '#1f2937' : '#f9fafb';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>{table}</span>
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{
            padding: '1rem',
            textAlign: 'center',
            color: isDarkTheme ? '#9ca3af' : '#6b7280',
            fontStyle: 'italic',
          }}>
            No tables found
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseTableList;