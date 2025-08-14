import React, { useState, useEffect } from 'react';
import { 
  ServerIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ClockIcon,
  ChartBarIcon,
  CpuChipIcon,
  CircleStackIcon,
  ComputerDesktopIcon,
  SignalIcon,
  CogIcon
} from '@heroicons/react/24/outline';

interface TableData {
  columns: string[];
  data: any[][];
}

interface DatabaseTable {
  name: string;
  rowCount: number;
  columnCount: number;
}

interface ResourceBlock {
  title: string;
  icon: any;
  data: { [key: string]: any };
  color: string;
}

export default function Resource() {
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const resourceMonitorUrl = (process.env as any).REACT_APP_RESOURCE_MONITOR_URL || 'http://localhost:8005';

  // Fetch available tables
  const fetchTables = async () => {
    try {
      setError(null);
      const response = await fetch(`${resourceMonitorUrl}/api/tables`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        setTables(result.tables.map((table: string) => ({
          name: table,
          rowCount: 0,
          columnCount: 0
        })));
      }
    } catch (err) {
      setError('Failed to fetch tables');
      console.error('Error fetching tables:', err);
    }
  };

  // Fetch table data
  const fetchTableData = async (tableName: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${resourceMonitorUrl}/api/table-data?table=${encodeURIComponent(tableName)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        setTableData({
          columns: result.columns,
          data: result.data
        });
        setLastUpdate(new Date());
      }
    } catch (err) {
      setError('Failed to fetch table data');
      console.error('Error fetching table data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle table selection
  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    if (tableName) {
      fetchTableData(tableName);
    } else {
      setTableData(null);
    }
  };

  // Refresh data
  const refreshData = () => {
    if (selectedTable) {
      fetchTableData(selectedTable);
    }
  };

  // Load tables on component mount
  useEffect(() => {
    fetchTables();
  }, []);

  // Format cell value for display
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'number') {
      if (value % 1 === 0) {
        return value.toLocaleString();
      } else {
        return value.toFixed(2);
      }
    }
    
    if (typeof value === 'string') {
      if (value.length > 50) {
        return value.substring(0, 47) + '...';
      }
      return value;
    }
    
    return String(value);
  };

  // Get status color based on value
  const getStatusColor = (value: any, columnName: string): string => {
    if (typeof value === 'number') {
      if (columnName.includes('usage') || columnName.includes('percent')) {
        if (value >= 90) return 'var(--color-error)';
        if (value >= 70) return 'var(--color-warning)';
        return 'var(--color-success)';
      }
    }
    return 'var(--color-text)';
  };

  // Transform table data into resource blocks
  const getResourceBlocks = (): ResourceBlock[] => {
    if (!tableData || !tableData.data || tableData.data.length === 0) {
      return [];
    }

    const row = tableData.data[0]; // Get the first row (most recent data)
    const columns = tableData.columns;
    const dataMap: { [key: string]: any } = {};

    // Create a map of column names to values
    columns.forEach((column, index) => {
      if (column !== 'id' && column !== 'entry_type') {
        dataMap[column] = row[index];
      }
    });

    // Define resource blocks
    const blocks: ResourceBlock[] = [
      {
        title: 'CPU Information',
        icon: CpuChipIcon,
        data: {
          'CPU Cores': dataMap.cpu_cores,
          'CPU Threads': dataMap.cpu_threads,
          'Frequency (MHz)': dataMap.cpu_frequency_mhz,
          'Usage (%)': dataMap.cpu_usage_percent
        },
        color: 'var(--color-primary)'
      },
      {
        title: 'Memory Information',
        icon: CircleStackIcon,
        data: {
          'Total (GB)': dataMap.memory_total_gb,
          'Used (GB)': dataMap.memory_used_gb,
          'Free (GB)': dataMap.memory_free_gb,
          'Usage (%)': dataMap.memory_usage_percent
        },
        color: 'var(--color-success)'
      },
      {
        title: 'Disk Information',
        icon: ComputerDesktopIcon,
        data: {
          'Total (GB)': dataMap.disk_total_gb,
          'Used (GB)': dataMap.disk_used_gb,
          'Free (GB)': dataMap.disk_free_gb,
          'Usage (%)': dataMap.disk_usage_percent
        },
        color: 'var(--color-warning)'
      },
      {
        title: 'Network Information',
        icon: SignalIcon,
        data: {
          'Bytes Sent (GB)': dataMap.network_bytes_sent_gb,
          'Bytes Received (GB)': dataMap.network_bytes_recv_gb
        },
        color: 'var(--color-info)'
      },
      {
        title: 'System Information',
        icon: CogIcon,
        data: {
          'Load (1min)': dataMap.load_1min,
          'Load (5min)': dataMap.load_5min,
          'Load (15min)': dataMap.load_15min,
          'Uptime (seconds)': dataMap.uptime_seconds,
          'Running Processes': dataMap.running_processes
        },
        color: 'var(--color-secondary)'
      }
    ];

    return blocks;
  };

  // Format uptime from seconds to human readable
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const resourceBlocks = getResourceBlocks();

  return (
    <div className="flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <ServerIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Database Table Viewer</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <ClockIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {lastUpdate ? `Last updated: ${lastUpdate.toLocaleTimeString()}` : 'No data loaded'}
            </span>
          </div>
          
          <button
            onClick={refreshData}
            disabled={isLoading || !selectedTable}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-destructive" />
              <span className="text-destructive font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Table Selector */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <label htmlFor="table-select" className="text-sm font-medium">
              Select Database Table:
            </label>
            <select
              id="table-select"
              value={selectedTable}
              onChange={(e) => handleTableSelect(e.target.value)}
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground min-w-[200px]"
            >
              <option value="">Choose a table...</option>
              {tables.map((table) => (
                <option key={table.name} value={table.name}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3">
              <ArrowPathIcon className="w-6 h-6 animate-spin text-primary" />
              <span className="text-lg">Loading table data...</span>
            </div>
          </div>
        )}

        {/* Resource Blocks */}
        {resourceBlocks.length > 0 && !isLoading && (
          <div className="space-y-6">
            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-4 text-sm">
                <span className="font-medium">Table: {selectedTable}</span>
                <span>• Data from most recent entry</span>
                {tableData && (
                  <span>• Total rows: {tableData.data.length}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resourceBlocks.map((block, index) => (
                <div
                  key={index}
                  className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <block.icon className="w-6 h-6" style={{ color: block.color }} />
                    <h3 className="text-lg font-semibold">{block.title}</h3>
                  </div>
                  
                  <div className="space-y-3">
                    {Object.entries(block.data).map(([key, value]) => {
                      // Special formatting for certain fields
                      let displayValue = formatCellValue(value);
                      let displayKey = key;
                      
                      if (key === 'Uptime (seconds)' && typeof value === 'number') {
                        displayValue = formatUptime(value);
                        displayKey = 'Uptime';
                      } else if (key === 'Timestamp' && typeof value === 'string') {
                        displayValue = new Date(value).toLocaleString();
                        displayKey = 'Last Updated';
                      } else if (key.includes('Usage (%)')) {
                        displayKey = 'Usage';
                      }
                      
                      return (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">{displayKey}:</span>
                          <span 
                            className="text-sm font-medium"
                            style={{ color: getStatusColor(value, key.toLowerCase()) }}
                          >
                            {displayValue}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!selectedTable && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ServerIcon className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Table Selected</h3>
            <p className="text-muted-foreground max-w-md">
              Select a table from the dropdown above to view its data. The data will be displayed in organized blocks showing CPU, Memory, Disk, Network, and System information.
            </p>
          </div>
        )}

        {/* No Data State */}
        {selectedTable && resourceBlocks.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ChartBarIcon className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Data Found</h3>
            <p className="text-muted-foreground">
              The selected table '{selectedTable}' contains no data or doesn't have the expected column structure.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 