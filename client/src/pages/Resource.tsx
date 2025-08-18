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
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,      // <-- Add this
  LineController,   // <-- Add this
} from 'chart.js';

// Register the required components
Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,      // <-- Add this
  LineController    // <-- Add this
);

interface TableData {
  columns: string[];
  data: any[][];
}

interface DatabaseTable {
  name: string;
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
  const [allServersData, setAllServersData] = useState<{ [server: string]: TableData | null }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Use environment variable or fallback
  const resourceMonitorUrl =
    (import.meta as any).env?.VITE_RESOURCE_MONITOR_URL || 'http://localhost:8005';

  // Fetch all tables and pre-load all server data
  const fetchAllData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch list of tables (servers)
      const tablesRes = await fetch(`${resourceMonitorUrl}/api/tables`);
      if (!tablesRes.ok) throw new Error('Failed to fetch tables');
      const tablesData = await tablesRes.json();
      if (!tablesData.success) throw new Error('Invalid response');

      const tableList = tablesData.tables.map((name: string) => ({ name }));
      setTables(tableList);

      // Fetch data for all servers in parallel
      const allData: { [server: string]: TableData | null } = {};
      await Promise.all(
        tableList.map(async (table) => {
          try {
            const res = await fetch(
              `${resourceMonitorUrl}/api/table-data?table=${encodeURIComponent(table.name)}`
            );
            if (!res.ok) {
              allData[table.name] = null;
              return;
            }
            const data = await res.json();
            if (data.success) {
              allData[table.name] = { columns: data.columns, data: data.data };
            } else {
              allData[table.name] = null;
            }
          } catch (err) {
            allData[table.name] = null;
          }
        })
      );

      setAllServersData(allData);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to load server data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle table selection
  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    if (tableName && allServersData[tableName]) {
      setTableData(allServersData[tableName]);
    } else {
      setTableData(null);
    }
  };

  // Refresh all data
  const refreshData = () => {
    fetchAllData();
  };

  // Load data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  // Format cell value
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      return value % 1 === 0 ? value.toLocaleString() : value.toFixed(2);
    }
    if (typeof value === 'string' && value.length > 50) return value.substring(0, 47) + '...';
    return String(value);
  };

  // Extract metric from table data
  const getMetric = (table: TableData | null, column: string) => {
    if (!table?.data?.[0]) return null;
    const idx = table.columns.indexOf(column);
    return idx !== -1 ? table.data[0][idx] : null;
  };

  // Format uptime
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Get status color
  const getStatusColor = (value: any, columnName: string): string => {
    if (typeof value === 'number' && (columnName.includes('usage') || columnName.includes('percent'))) {
      if (value >= 90) return '#ef4444';   // red-500
      if (value >= 70) return '#f59e0b';   // amber-500
      return '#10B981';                    // emerald-500
    }
    return '#374151'; // gray-700
  };

  // Generate dummy trend data
  const generateTrend = (current: number) =>
    Array.from({ length: 60 }, (_, i) => current * 0.8 + (Math.random() * 20 - 10));

  // === DEFAULT DASHBOARD: All Servers View ===
  const renderMultiServerDashboard = () => {
    const activeServers = Object.keys(allServersData).filter(
      (name) => allServersData[name] && allServersData[name]?.data?.length > 0
    );

    if (activeServers.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ServerIcon className="w-20 h-20 text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600">No Data Available</h3>
          <p className="text-gray-500 mt-2">No servers have reported resource usage yet.</p>
        </div>
      );
    }

    // Collect metrics
    const cpuData = activeServers.map((s) => getMetric(allServersData[s], 'cpu_usage_percent') ?? 0);
    const memData = activeServers.map((s) => getMetric(allServersData[s], 'memory_usage_percent') ?? 0);
    const diskData = activeServers.map((s) => getMetric(allServersData[s], 'disk_usage_percent') ?? 0);

    const barOptions = {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100, title: { display: true, text: 'Usage (%)' } } },
    };

    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">Resource Overview</h2>
          <p className="text-gray-600">Aggregated metrics across {activeServers.length} server(s)</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <CpuChipIcon className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">CPU Usage (%)</h3>
            </div>
            <Bar
              data={{
                labels: activeServers,
                datasets: [{ label: 'CPU', data: cpuData, backgroundColor: '#3B82F6' }],
              }}
              options={barOptions}
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <CircleStackIcon className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-800">Memory Usage (%)</h3>
            </div>
            <Bar
              data={{
                labels: activeServers,
                datasets: [{ label: 'Memory', data: memData, backgroundColor: '#10B981' }],
              }}
              options={barOptions}
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <ComputerDesktopIcon className="w-6 h-6 text-yellow-600" />
              <h3 className="text-lg font-semibold text-gray-800">Disk Usage (%)</h3>
            </div>
            <Bar
              data={{
                labels: activeServers,
                datasets: [{ label: 'Disk', data: diskData, backgroundColor: '#F59E0B' }],
              }}
              options={barOptions}
            />
          </div>
        </div>

        {/* Summary Table */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Server Summary</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Server</th>
                  <th className="text-center py-2">CPU</th>
                  <th className="text-center py-2">Memory</th>
                  <th className="text-center py-2">Disk</th>
                  <th className="text-center py-2">Processes</th>
                  <th className="text-center py-2">Uptime</th>
                </tr>
              </thead>
              <tbody>
                {activeServers.map((name) => {
                  const data = allServersData[name];
                  const cpu = getMetric(data, 'cpu_usage_percent');
                  const mem = getMetric(data, 'memory_usage_percent');
                  const disk = getMetric(data, 'disk_usage_percent');
                  const procs = getMetric(data, 'running_processes');
                  const uptime = getMetric(data, 'uptime_seconds');

                  return (
                    <tr key={name} className="border-b hover:bg-gray-50">
                      <td className="py-2 font-medium">{name}</td>
                      <td className="py-2 text-center" style={{ color: getStatusColor(cpu, 'usage') }}>
                        {formatCellValue(cpu)}%
                      </td>
                      <td className="py-2 text-center" style={{ color: getStatusColor(mem, 'usage') }}>
                        {formatCellValue(mem)}%
                      </td>
                      <td className="py-2 text-center" style={{ color: getStatusColor(disk, 'usage') }}>
                        {formatCellValue(disk)}%
                      </td>
                      <td className="py-2 text-center">{formatCellValue(procs)}</td>
                      <td className="py-2 text-center text-gray-600">{formatUptime(uptime || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // === PER-SERVER VIEW: Detailed Metrics ===
  const getResourceBlocks = (): ResourceBlock[] => {
    if (!tableData || !tableData.data[0]) return [];

    const row = tableData.data[0];
    const columns = tableData.columns;
    const dataMap: { [key: string]: any } = {};
    columns.forEach((col, idx) => {
      if (!['id', 'entry_type', 'timestamp'].includes(col)) {
        dataMap[col] = row[idx];
      }
    });

    const cpuTrend = generateTrend(dataMap.cpu_usage_percent || 0);
    const memTrend = generateTrend(dataMap.memory_usage_percent || 0);
    const diskTrend = generateTrend(dataMap.disk_usage_percent || 0);

    const lineOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false } },
    };

    return [
      {
        title: 'CPU Information',
        icon: CpuChipIcon,
        color: '#3B82F6',
        data: {
          'Cores': dataMap.cpu_cores,
          'Threads': dataMap.cpu_threads,
          'Frequency (MHz)': dataMap.cpu_frequency_mhz,
          'Usage (%)': dataMap.cpu_usage_percent,
        },
        chart: (
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative w-full md:w-1/2 h-40 flex items-center justify-center">
              <Doughnut
                data={{
                  datasets: [
                    {
                      data: [dataMap.cpu_usage_percent || 0, 100 - (dataMap.cpu_usage_percent || 0)],
                      backgroundColor: ['#3B82F6', '#E5E7EB'],
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{ cutout: '75%', plugins: { legend: { display: false } } }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-blue-600">
                  {formatCellValue(dataMap.cpu_usage_percent)}%
                </span>
                <span className="text-xs text-gray-500 mt-1">Used</span>
              </div>
            </div>
            <div className="w-full md:w-1/2 h-40 flex flex-col justify-center">
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Cores:</span> {dataMap.cpu_cores}
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Threads:</span> {dataMap.cpu_threads}
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Frequency:</span> {formatCellValue(dataMap.cpu_frequency_mhz)} MHz
              </div>
              <div className="mt-4 h-16">
                <Line
                  data={{
                    labels: Array(cpuTrend.length).fill(''),
                    datasets: [{ data: cpuTrend, borderColor: '#3B82F6', fill: true, backgroundColor: 'rgba(59,130,246,0.1)' }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { display: false }, y: { display: false } },
                  }}
                />
              </div>
            </div>
          </div>
        ),
      },
      {
        title: 'Memory Information',
        icon: CircleStackIcon,
        color: '#10B981',
        data: {
          'Total (GB)': dataMap.memory_total_gb,
          'Used (GB)': dataMap.memory_used_gb,
          'Free (GB)': dataMap.memory_free_gb,
          'Usage (%)': dataMap.memory_usage_percent,
        },
        chart: (
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative w-full md:w-1/2 h-40 flex items-center justify-center">
              <Doughnut
                data={{
                  datasets: [
                    {
                      data: [dataMap.memory_usage_percent || 0, 100 - (dataMap.memory_usage_percent || 0)],
                      backgroundColor: ['#10B981', '#E5E7EB'],
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{ cutout: '75%', plugins: { legend: { display: false } } }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-green-600">
                  {formatCellValue(dataMap.memory_usage_percent)}%
                </span>
                <span className="text-xs text-gray-500 mt-1">Used</span>
              </div>
            </div>
            <div className="w-full md:w-1/2 h-40 flex flex-col justify-center">
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Total:</span> {formatCellValue(dataMap.memory_total_gb)} GB
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Used:</span> {formatCellValue(dataMap.memory_used_gb)} GB
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Free:</span> {formatCellValue(dataMap.memory_free_gb)} GB
              </div>
              <div className="mt-4 h-16">
                <Line
                  data={{
                    labels: Array(memTrend.length).fill(''),
                    datasets: [{ data: memTrend, borderColor: '#10B981', fill: true, backgroundColor: 'rgba(16,185,129,0.1)' }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { display: false }, y: { display: false } },
                  }}
                />
              </div>
            </div>
          </div>
        ),
      },
      {
        title: 'Disk Information',
        icon: ComputerDesktopIcon,
        color: '#F59E0B',
        data: {
          'Total (GB)': dataMap.disk_total_gb,
          'Used (GB)': dataMap.disk_used_gb,
          'Free (GB)': dataMap.disk_free_gb,
          'Usage (%)': dataMap.disk_usage_percent,
        },
        chart: (
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative w-full md:w-1/2 h-40 flex items-center justify-center">
              <Doughnut
                data={{
                  datasets: [
                    {
                      data: [dataMap.disk_usage_percent || 0, 100 - (dataMap.disk_usage_percent || 0)],
                      backgroundColor: ['#F59E0B', '#E5E7EB'],
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{ cutout: '75%', plugins: { legend: { display: false } } }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-yellow-600">
                  {formatCellValue(dataMap.disk_usage_percent)}%
                </span>
                <span className="text-xs text-gray-500 mt-1">Used</span>
              </div>
            </div>
            <div className="w-full md:w-1/2 h-40 flex flex-col justify-center">
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Total:</span> {formatCellValue(dataMap.disk_total_gb)} GB
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Used:</span> {formatCellValue(dataMap.disk_used_gb)} GB
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Free:</span> {formatCellValue(dataMap.disk_free_gb)} GB
              </div>
              <div className="mt-4 h-16">
                <Line
                  data={{
                    labels: Array(diskTrend.length).fill(''),
                    datasets: [{ data: diskTrend, borderColor: '#F59E0B', fill: true, backgroundColor: 'rgba(245,158,11,0.1)' }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { display: false }, y: { display: false } },
                  }}
                />
              </div>
            </div>
          </div>
        ),
      },
      {
        title: 'System Information',
        icon: CogIcon,
        color: '#6B7280',
        data: {
          'Load (1min)': dataMap.load_1min,
          'Load (5min)': dataMap.load_5min,
          'Load (15min)': dataMap.load_15min,
          'Uptime': formatUptime(dataMap.uptime_seconds || 0),
          'Processes': dataMap.running_processes,
        },
      },
      {
        title: 'License Information',
        icon: ChartBarIcon,
        color: '#8B5CF6',
        data: {
          'License Info': dataMap.license_info || 'Not Available',
        },
      },
    ];
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
            <span>
              {lastUpdate ? `Last updated: ${lastUpdate.toLocaleTimeString()}` : 'Loading...'}
            </span>
          </div>
          <button
            onClick={refreshData}
            disabled={isLoading}
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
          <label htmlFor="server-select" className="block text-sm font-medium text-gray-700 mb-2">
            View Details For:
          </label>
          <select
            id="server-select"
            value={selectedTable}
            onChange={(e) => handleTableSelect(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 min-w-[250px]"
          >
            <option value="">🌐 Show Dashboard (All Servers)</option>
            {tables.map((table) => (
              <option key={table.name} value={table.name}>
                {table.name}
              </option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3">
              <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-lg">Loading server data...</span>
            </div>
          </div>
        )}

        {/* Multi-Server Dashboard (Default) */}
        {!selectedTable && !isLoading && renderMultiServerDashboard()}

        {/* Per-Server Detail View */}
        {selectedTable && !isLoading && resourceBlocks.length > 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800">Detailed View: {selectedTable}</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {resourceBlocks.map((block, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <block.icon className="w-6 h-6" style={{ color: block.color }} />
                    <h3 className="text-lg font-semibold text-gray-800">{block.title}</h3>
                  </div>
                  {block.chart && <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">{block.chart}</div>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(block.data).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{key}:</span>
                        <span
                          className="text-sm font-medium"
                          style={{ color: getStatusColor(value, key.toLowerCase()) }}
                        >
                          {key === 'Uptime' ? formatUptime(value) : formatCellValue(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Data for Selected Server */}
        {selectedTable && !isLoading && resourceBlocks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ChartBarIcon className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Data for {selectedTable}</h3>
            <p className="text-gray-600">This server has not reported any metrics yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}