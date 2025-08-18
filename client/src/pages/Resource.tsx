
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
  CogIcon,
} from '@heroicons/react/24/outline';

// Chart.js
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend
);

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
  chart?: React.ReactNode;
}

export default function Resource() {
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Use environment variable if available, otherwise fallback
  // Use environment variable if available, otherwise fallback
  // @ts-ignore
  const resourceMonitorUrl = (import.meta as any).env && (import.meta as any).env.VITE_RESOURCE_MONITOR_URL
    ? (import.meta as any).env.VITE_RESOURCE_MONITOR_URL
    : 'http://localhost:8005';

  // Fetch tables
  const fetchTables = async () => {
    try {
      setError(null);
      const response = await fetch(`${resourceMonitorUrl}/api/tables`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
      console.error(err);
    }
  };

  // Fetch table data
  const fetchTableData = async (tableName: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${resourceMonitorUrl}/api/table-data?table=${encodeURIComponent(tableName)}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    if (tableName) fetchTableData(tableName);
    else setTableData(null);
  };

  const refreshData = () => {
    if (selectedTable) fetchTableData(selectedTable);
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // Format cell value
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      if (value % 1 === 0) return value.toLocaleString();
      return value.toFixed(2);
    }
    if (typeof value === 'string' && value.length > 50) return value.substring(0, 47) + '...';
    return String(value);
  };

  // Get status color
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

  // Generate dummy trend data for charts (in real app, pull from DB history)
  const generateTrendData = (currentValue: number, length: number = 60): number[] => {
    const data: number[] = [];
    let base = currentValue * 0.8;
    for (let i = 0; i < length; i++) {
      const noise = Math.random() * 20 - 10;
      data.push(base + noise);
    }
    return data;
  };

  // Transform data into chart-ready format
  const getResourceBlocks = (): ResourceBlock[] => {
    if (!tableData || !tableData.data || tableData.data.length === 0) return [];

    const row = tableData.data[0];
    const columns = tableData.columns;
    const dataMap: { [key: string]: any } = {};

    columns.forEach((col, idx) => {
      if (col !== 'id' && col !== 'entry_type') {
        dataMap[col] = row[idx];
      }
    });

    // Create chart data
    const cpuUsageTrend = generateTrendData(dataMap.cpu_usage_percent || 0);
    const memUsageTrend = generateTrendData(dataMap.memory_usage_percent || 0);
    const diskUsageTrend = generateTrendData(dataMap.disk_usage_percent || 0);

    // CPU Chart Data
    const cpuChartData = {
      labels: Array.from({ length: 60 }, (_, i) => `${i + 1}s`),
      datasets: [
        {
          label: 'CPU Usage (%)',
          data: cpuUsageTrend,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };

    // Memory Chart Data
    const memChartData = {
      labels: Array.from({ length: 60 }, (_, i) => `${i + 1}s`),
      datasets: [
        {
          label: 'Memory Usage (%)',
          data: memUsageTrend,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };

    // Disk Chart Data
    const diskChartData = {
      labels: Array.from({ length: 60 }, (_, i) => `${i + 1}s`),
      datasets: [
        {
          label: 'Disk Usage (%)',
          data: diskUsageTrend,
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };

    return [
      {
        title: 'CPU Information',
        icon: CpuChipIcon,
        data: {
          'Cores': dataMap.cpu_cores,
          'Threads': dataMap.cpu_threads,
          'Frequency': dataMap.cpu_frequency_mhz,
          'Usage (%)': dataMap.cpu_usage_percent,
        },
        color: 'var(--color-primary)',
        chart: (
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
            <div className="w-full md:w-1/2 h-40 flex items-center justify-center">
              <Doughnut
                data={{
                  labels: ['Used', 'Free'],
                  datasets: [
                    {
                      data: [dataMap.cpu_usage_percent || 0, 100 - (dataMap.cpu_usage_percent || 0)],
                      backgroundColor: ['#3B82F6', '#E5E7EB'],
                      borderColor: ['#3B82F6', '#E5E7EB'],
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{
                  cutout: '70%',
                  plugins: {
                    legend: { display: false },
                  },
                  responsive: true,
                  maintainAspectRatio: false,
                }}
              />
            </div>
            <div className="w-full md:w-1/2 h-40 flex items-center justify-center">
              <Line data={cpuChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { display: false } } }} />
            </div>
          </div>
        ),
      },
      {
        title: 'Memory Information',
        icon: CircleStackIcon,
        data: {
          'Total (GB)': dataMap.memory_total_gb,
          'Used (GB)': dataMap.memory_used_gb,
          'Free (GB)': dataMap.memory_free_gb,
          'Usage (%)': dataMap.memory_usage_percent,
        },
        color: 'var(--color-success)',
        chart: (
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
            <div className="w-full md:w-1/2 h-40 flex items-center justify-center">
              <Doughnut
                data={{
                  labels: ['Used', 'Free'],
                  datasets: [
                    {
                      data: [dataMap.memory_usage_percent || 0, 100 - (dataMap.memory_usage_percent || 0)],
                      backgroundColor: ['#10B981', '#E5E7EB'],
                      borderColor: ['#10B981', '#E5E7EB'],
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{
                  cutout: '70%',
                  plugins: {
                    legend: { display: false },
                  },
                  responsive: true,
                  maintainAspectRatio: false,
                }}
              />
            </div>
            <div className="w-full md:w-1/2 h-40 flex items-center justify-center">
              <Line data={memChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { display: false } } }} />
            </div>
          </div>
        ),
      },
      {
        title: 'Disk Information',
        icon: ComputerDesktopIcon,
        data: {
          'Total (GB)': dataMap.disk_total_gb,
          'Used (GB)': dataMap.disk_used_gb,
          'Free (GB)': dataMap.disk_free_gb,
          'Usage (%)': dataMap.disk_usage_percent,
        },
        color: 'var(--color-warning)',
        chart: (
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
            <div className="w-full md:w-1/2 h-40 flex items-center justify-center">
              <Doughnut
                data={{
                  labels: ['Used', 'Free'],
                  datasets: [
                    {
                      data: [dataMap.disk_usage_percent || 0, 100 - (dataMap.disk_usage_percent || 0)],
                      backgroundColor: ['#F59E0B', '#E5E7EB'],
                      borderColor: ['#F59E0B', '#E5E7EB'],
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{
                  cutout: '70%',
                  plugins: {
                    legend: { display: false },
                  },
                  responsive: true,
                  maintainAspectRatio: false,
                }}
              />
            </div>
            <div className="w-full md:w-1/2 h-40 flex items-center justify-center">
              <Line data={diskChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { display: false } } }} />
            </div>
          </div>
        ),
      },
      {
        title: 'Network Information',
        icon: SignalIcon,
        data: {
          'Bytes Sent (GB)': dataMap.network_bytes_sent_gb,
          'Bytes Received (GB)': dataMap.network_bytes_recv_gb,
        },
        color: 'var(--color-info)',
        chart: null,
      },
      {
        title: 'System Information',
        icon: CogIcon,
        data: {
          'Load (1min)': dataMap.load_1min,
          'Load (5min)': dataMap.load_5min,
          'Load (15min)': dataMap.load_15min,
          'Uptime': formatUptime(dataMap.uptime_seconds),
          'Processes': dataMap.running_processes,
        },
        color: 'var(--color-secondary)',
        chart: null,
      },
      {
        title: 'License Information',
        icon: ChartBarIcon,
        data: {
          'License Info': dataMap.license_info || 'Not Available',
        },
        color: 'var(--color-accent)',
        chart: null,
      },
    ];
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const resourceBlocks = getResourceBlocks();

  return (
    <div className="flex-1 overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <ServerIcon className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">OpsIntel</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <ClockIcon className="w-4 h-4" />
            <span>{lastUpdate ? `Last updated: ${lastUpdate.toLocaleTimeString()}` : 'No data loaded'}</span>
          </div>
          
          <button
            onClick={refreshData}
            disabled={isLoading || !selectedTable}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Table Selector */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <label htmlFor="table-select" className="text-sm font-medium text-gray-700">
              Select Server:
            </label>
            <select
              id="table-select"
              value={selectedTable}
              onChange={(e) => handleTableSelect(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 min-w-[200px]"
            >
              <option value="">Choose a server...</option>
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
              <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-lg">Loading data...</span>
            </div>
          </div>
        )}

        {/* Resource Blocks */}
        {resourceBlocks.length > 0 && !isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {resourceBlocks.map((block, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <block.icon className="w-6 h-6" style={{ color: block.color }} />
                  <h3 className="text-lg font-semibold text-gray-800">{block.title}</h3>
                </div>
                
                <div className="space-y-4">
                  {block.chart && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      {block.chart}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(block.data).map(([key, value]) => {
                      let displayValue = formatCellValue(value);
                      let displayKey = key;

                      if (key === 'Uptime') {
                        displayValue = formatUptime(value as number);
                        displayKey = 'Uptime';
                      }

                      return (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{displayKey}:</span>
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
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!selectedTable && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ServerIcon className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Server Selected</h3>
            <p className="text-gray-600 max-w-md">
              Select a server from the dropdown above to view its resource details.
            </p>
          </div>
        )}

        {/* No Data State */}
        {selectedTable && resourceBlocks.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ChartBarIcon className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Data Found</h3>
            <p className="text-gray-600">
              The selected server '{selectedTable}' has no data or doesn't have expected metrics.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}