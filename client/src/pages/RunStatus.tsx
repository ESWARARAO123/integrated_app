import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PauseIcon,
  TableCellsIcon,
  UserIcon,
  CpuChipIcon,
  ShareIcon,
  CircleStackIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import runService from '../services/runService';
import userService from '../services/userService';
import flowtrackService, { DatabaseConnection, DatabaseFile, SimpleFlowAnalysisResult, BranchFlowAnalysisResult, RTLFlowAnalysisResult } from '../services/flowtrackService';
import runStatusDbService, { RunStatusTable, RunStatusDbStatus, SimpleFlowAnalysisResult as RunStatusSimpleFlowResult, BranchFlowAnalysisResult as RunStatusBranchFlowResult, RTLFlowAnalysisResult as RunStatusRTLFlowResult } from '../services/runStatusDbService';
import DatabaseConnectionModal from '../components/runstatus/DatabaseConnectionModal';
import SimpleFlowVisualization from '../components/runstatus/SimpleFlowVisualization';
import BranchFlowVisualization from '../components/runstatus/BranchFlowVisualization';
import RTLFlowVisualization from '../components/runstatus/RTLFlowVisualization';

// Types for our run data
interface RunStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'warning';
  startTime?: Date;
  endTime?: Date;
  logs?: string[];
  errorMessage?: string;
}

interface Run {
  id: string;
  name: string;
  userId: number;
  username: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  startTime: Date;
  endTime?: Date;
  steps: RunStep[];
  description?: string;
  type: string;
}

// Add user type
interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

export default function RunStatus() {
  const { user, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const [runs, setRuns] = useState<Run[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [selectedRunType, setSelectedRunType] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'simple-flow' | 'branch-flow' | 'rtl-flow'>('simple-flow');
  
  // Database connection state (legacy - for manual connections)
  const [showDbModal, setShowDbModal] = useState(false);
  const [dbConnection, setDbConnection] = useState<DatabaseConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [dbFiles, setDbFiles] = useState<DatabaseFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<DatabaseFile | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Automated Run Status database state
  const [runStatusTables, setRunStatusTables] = useState<RunStatusTable[]>([]);
  const [runStatusDbStatus, setRunStatusDbStatus] = useState<RunStatusDbStatus | null>(null);
  const [isRunStatusConnected, setIsRunStatusConnected] = useState(false);
  const [runStatusError, setRunStatusError] = useState<string | null>(null);
  const [selectedRunStatusTable, setSelectedRunStatusTable] = useState<RunStatusTable | null>(null);

  
  // User-specific Run Status data
  const [runStatusUsers, setRunStatusUsers] = useState<any[]>([]);
  const [selectedRunStatusUser, setSelectedRunStatusUser] = useState<any | null>(null);
  const [userSpecificTables, setUserSpecificTables] = useState<RunStatusTable[]>([]);
  
  // Simple Flow related state
  const [simpleFlowData, setSimpleFlowData] = useState<SimpleFlowAnalysisResult | null>(null);
  const [isSimpleAnalyzing, setIsSimpleAnalyzing] = useState(false);
  
  // Branch Flow related state
  const [branchFlowData, setBranchFlowData] = useState<BranchFlowAnalysisResult | null>(null);
  const [isBranchAnalyzing, setIsBranchAnalyzing] = useState(false);

  // RTL Flow related state
  const [rtlFlowData, setRtlFlowData] = useState<RTLFlowAnalysisResult | null>(null);
  const [isRtlAnalyzing, setIsRtlAnalyzing] = useState(false);
  const [availableRtlFiles, setAvailableRtlFiles] = useState<DatabaseFile[]>([]);

  // Live Analytics and Admin View state
  const [isLiveAnalyticsEnabled, setIsLiveAnalyticsEnabled] = useState(true);
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'user'>('admin');

  // Success notification state
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  /// Docker environment detection
const isDockerEnvironment = () => {
  // Check if we're in Docker environment by looking for production mode and specific Docker indicators
  const hostname: string = window.location.hostname;
  const isDocker = process.env.NODE_ENV === 'production' ||
         hostname !== 'localhost' ||
         window.location.port === '5643' || // Docker port
         hostname.includes('docker') ||
         // Check if we're accessing via IP address (common in Docker)
         /^\d+\.\d+\.\d+\.\d+$/.test(hostname);

  console.log(`?? Docker Environment Check: ${isDocker} (NODE_ENV: ${process.env.NODE_ENV}, hostname: ${window.location.hostname}, port: ${window.location.port})`);
  return isDocker;
};



  // Fetch users if admin - but only show them if no database is connected
  useEffect(() => {
    const fetchUsers = async () => {
      if (isAdmin() && !isRunStatusConnected) {
        try {
          const fetchedUsers = await userService.getUsers();
          setUsers(fetchedUsers);
        } catch (error) {
          console.error('Error fetching users:', error);
        }
      } else {
        setUsers([]);
        setSelectedUserId(null);
        setSelectedUser(null);
      }
    };
    
    fetchUsers();
  }, [isAdmin, isRunStatusConnected]);

  // Fetch Run Status database status and users
  useEffect(() => {
    const fetchRunStatusDb = async () => {
      try {
        console.log('Fetching Run Status database status...');
        const status = await runStatusDbService.getStatus();
        setRunStatusDbStatus(status);
        setIsRunStatusConnected(status.connection.isConnected);
        setRunStatusTables(status.tables);
        setRunStatusError(null);
        
        if (status.connection.isConnected) {
          console.log(`Connected to Run Status database with ${status.totalTables} tables`);
          
          // Fetch users with data for UI display
          try {
            const usersData = await runStatusDbService.getUsersWithData();
            setRunStatusUsers(usersData.users);
            console.log(`Found ${usersData.users.length} users with data in Run Status database`);
          } catch (userError: any) {
            console.error('Error fetching users with data:', userError);
            setRunStatusUsers([]);
          }
        } else {
          console.log('Run Status database not connected');
          setRunStatusUsers([]);
        }
      } catch (error: any) {
        console.error('Error fetching Run Status database status:', error);
        setRunStatusError(error.response?.data?.details || error.message || 'Failed to connect to Run Status database');
        setIsRunStatusConnected(false);
        setRunStatusTables([]);
        setRunStatusUsers([]);
      }
    };

    fetchRunStatusDb();
  }, []);

  // Separate useEffect for Live Analytics polling
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isLiveAnalyticsEnabled && isRunStatusConnected) {
      console.log('Starting Live Analytics auto-refresh every 30 seconds');
      interval = setInterval(() => {
        console.log('Live Analytics: Auto-refreshing database tables...');
        handleRefreshRunStatusTables();
      }, 30000);
    } else {
      console.log('Live Analytics disabled or database not connected');
    }

    return () => {
      if (interval) {
        console.log('Stopping Live Analytics auto-refresh');
        clearInterval(interval);
      }
    };
  }, [isLiveAnalyticsEnabled, isRunStatusConnected]);

  // Fetch runs data
  useEffect(() => {
    const fetchRuns = async () => {
      setLoading(true);
      try {
        let fetchedRuns: Run[] = [];
        
        if (isAdmin()) {
          if (selectedUserId) {
            fetchedRuns = await runService.getUserRuns(selectedUserId);
            const selectedUserData = users.find(u => u.id === selectedUserId) || null;
            setSelectedUser(selectedUserData);
          } else {
            fetchedRuns = await runService.getRuns();
            setSelectedUser(null);
          }
        } else if (user?.id) {
          fetchedRuns = await runService.getUserRuns(user.id);
        }
        
        setRuns(fetchedRuns);
      } catch (error) {
        console.error('Error fetching runs:', error);
        setRuns([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
  }, [user, isAdmin, selectedUserId, users]);

  // Filter runs based on selected filters and search term
  const filteredRuns = runs.filter(run => {
    const matchesType = selectedRunType ? run.type === selectedRunType : true;
    const matchesStatus = selectedStatus ? run.status === selectedStatus : true;
    const matchesSearch = searchTerm 
      ? run.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.username.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    
    return matchesType && matchesStatus && matchesSearch;
  });

  const toggleRunExpansion = (runId: string) => {
    setExpandedRun(expandedRun === runId ? null : runId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5" style={{ color: 'var(--color-success)' }} />;
      case 'running':
        return <ArrowPathIcon className="w-5 h-5 animate-spin" style={{ color: 'var(--color-primary)' }} />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5" style={{ color: 'var(--color-error)' }} />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />;
      case 'paused':
        return <PauseIcon className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />;
      default:
        return <ClockIcon className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />;
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const calculateDuration = (start?: Date, end?: Date) => {
    if (!start) return 'N/A';
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

    return `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;
  };

  // Database connection handlers
  const handleDatabaseConnect = async (connection: DatabaseConnection) => {
    setIsConnecting(true);
    setDbError(null);

    try {
      // Test connection first
      const connectionResult = await flowtrackService.testConnection(connection);
      
      if (connectionResult.success) {
        setDbConnection(connection);
        setIsConnected(true);

        // Fetch files from database
        const files = await flowtrackService.getFiles(connection);
        setDbFiles(files);
        setShowDbModal(false);
      } else {
        // Format error message with suggestions
        let errorMessage = connectionResult.error || 'Failed to connect to database';
        if (connectionResult.suggestions && connectionResult.suggestions.length > 0) {
          errorMessage += '\n\nSuggestions:\n' + connectionResult.suggestions.map(s => `? ${s}`).join('\n');
        }
        setDbError(errorMessage);
      }
    } catch (error: any) {
      console.error('Database connection error:', error);
      setDbError(error.response?.data?.details || error.message || 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDatabaseDisconnect = () => {
    setDbConnection(null);
    setIsConnected(false);
    setDbFiles([]);
    setSelectedFile(null);
    setSimpleFlowData(null);
    setBranchFlowData(null);
    setRtlFlowData(null);
    setDbError(null);
    setIsSimpleAnalyzing(false);
    setIsBranchAnalyzing(false);
    setIsRtlAnalyzing(false);
  };

  const handleSimpleAnalyze = async (file: DatabaseFile) => {
    if (!dbConnection) return;
    
    setIsSimpleAnalyzing(true);
    setDbError(null);
    
    try {
      console.log('Starting simple analysis for file:', file.filename);
      const analysisResult = await flowtrackService.analyzeSimple(dbConnection, file.id);
      
      setSimpleFlowData(analysisResult);
      setSelectedFile(file);
    } catch (error: any) {
      console.error('Simple analysis error:', error);
      setDbError(error.response?.data?.details || error.message || 'Simple analysis failed');
    } finally {
      setIsSimpleAnalyzing(false);
    }
  };

  const handleBranchAnalyze = async (file: DatabaseFile) => {
    if (!dbConnection) return;
    
    setIsBranchAnalyzing(true);
    setDbError(null);
    
    try {
      console.log('Starting branch analysis for file:', file.filename);
      const analysisResult = await flowtrackService.analyzeBranch(dbConnection, file.id);
      
      setBranchFlowData(analysisResult);
      setSelectedFile(file);
    } catch (error: any) {
      console.error('Branch analysis error:', error);
      setDbError(error.response?.data?.details || error.message || 'Branch analysis failed');
    } finally {
      setIsBranchAnalyzing(false);
    }
  };

  const handleRtlAnalyze = async (file: DatabaseFile) => {
    if (!dbConnection) return;
    
    setIsRtlAnalyzing(true);
    setDbError(null);
    
    try {
      console.log('Starting RTL analysis for file:', file.filename);
      const analysisResult = await flowtrackService.analyzeRTL(dbConnection, file.id);
      
      setRtlFlowData(analysisResult);
      setSelectedFile(file);
    } catch (error: any) {
      console.error('RTL analysis error:', error);
      setDbError(error.response?.data?.details || error.message || 'RTL analysis failed');
    } finally {
      setIsRtlAnalyzing(false);
    }
  };

  const handleViewModeChange = (mode: 'simple-flow' | 'branch-flow' | 'rtl-flow') => {
    setViewMode(mode);
    
    // Clear previous analysis data when switching modes
    setSimpleFlowData(null);
    setBranchFlowData(null);
    setRtlFlowData(null);
    setSelectedRunStatusTable(null);
    
    // If switching to flow modes and no automated connection exists, show modal for manual connection
    if (!isRunStatusConnected && !dbConnection) {
      setShowDbModal(true);
    }
  };

  // Handle automated database table analysis
  const handleRunStatusSimpleAnalyze = async (table: RunStatusTable) => {
    setIsSimpleAnalyzing(true);
    setRunStatusError(null);
    
    try {
      console.log('Starting automated simple analysis for table:', table.table_name);
      const analysisResult = await runStatusDbService.analyzeSimple(table.table_name);
      
      console.log('Simple Flow Analysis Result:', analysisResult);
      console.log('Flow Data Structure:', analysisResult.flow_data);
      
      setSimpleFlowData(analysisResult as any); // Type compatibility
      setSelectedRunStatusTable(table);
    } catch (error: any) {
      console.error('Automated simple analysis error:', error);
      setRunStatusError(error.response?.data?.details || error.message || 'Simple analysis failed');
    } finally {
      setIsSimpleAnalyzing(false);
    }
  };

  const handleRunStatusBranchAnalyze = async (table: RunStatusTable) => {
    setIsBranchAnalyzing(true);
    setRunStatusError(null);
    
    try {
      console.log('Starting automated branch analysis for table:', table.table_name);
      const analysisResult = await runStatusDbService.analyzeBranch(table.table_name);
      
      setBranchFlowData(analysisResult as any); // Type compatibility
      setSelectedRunStatusTable(table);

      // Show success notification
      setSuccessMessage(`Branch analysis completed for ${table.table_name}`);
      setShowSuccessNotification(true);
      setTimeout(() => setShowSuccessNotification(false), 4000);
    } catch (error: any) {
      console.error('Automated branch analysis error:', error);
      setRunStatusError(error.response?.data?.details || error.message || 'Branch analysis failed');
    } finally {
      setIsBranchAnalyzing(false);
    }
  };

  const handleRunStatusRtlAnalyze = async (table: RunStatusTable) => {
    setIsRtlAnalyzing(true);
    setRunStatusError(null);
    
    try {
      console.log('Starting automated RTL analysis for table:', table.table_name);
      const analysisResult = await runStatusDbService.analyzeRTL(table.table_name);
      
      setRtlFlowData(analysisResult as any); // Type compatibility
      setSelectedRunStatusTable(table);

      // Show success notification
      setSuccessMessage(`RTL analysis completed for ${table.table_name}`);
      setShowSuccessNotification(true);
      setTimeout(() => setShowSuccessNotification(false), 4000);
    } catch (error: any) {
      console.error('Automated RTL analysis error:', error);
      setRunStatusError(error.response?.data?.details || error.message || 'RTL analysis failed');
    } finally {
      setIsRtlAnalyzing(false);
    }
  };

  // Handle manual refresh of automated database tables (simplified)
  const handleRefreshRunStatusTables = async () => {
    setRunStatusError(null);

    try {
      console.log('Refreshing Run Status database tables...');
      // Use getTables instead of refreshTables to avoid the error
      const result = await runStatusDbService.getTables();
      setRunStatusTables(result.tables);

      // Also refresh users
      try {
        const usersData = await runStatusDbService.getUsersWithData();
        setRunStatusUsers(usersData.users);
        console.log(`Refreshed ${result.totalTables} tables and ${usersData.users.length} users`);
      } catch (userError) {
        console.error('Error refreshing users:', userError);
        console.log(`Refreshed ${result.totalTables} tables`);
      }
    } catch (error: any) {
      console.error('Error refreshing tables:', error);
      setRunStatusError(error.response?.data?.details || error.message || 'Failed to refresh tables');
    }
  };

  // Handle Live Analytics toggle
  const handleLiveAnalyticsToggle = () => {
    const newState = !isLiveAnalyticsEnabled;
    setIsLiveAnalyticsEnabled(newState);

    if (newState && isRunStatusConnected) {
      // If enabling and database is connected, trigger immediate refresh
      console.log('Live Analytics enabled - triggering immediate refresh');
      handleRefreshRunStatusTables();
    } else if (newState && !isRunStatusConnected) {
      console.log('Live Analytics enabled but no database connected');
    } else {
      console.log('Live Analytics disabled');
    }
  };

  // Handle Admin View toggle - only for admin users
  const handleAdminViewToggle = () => {
    if (isAdmin()) {
      const newMode = adminViewMode === 'admin' ? 'user' : 'admin';
      setAdminViewMode(newMode);

      console.log(`Admin switching to ${newMode} view mode`);

      // Reset selections when switching modes to avoid confusion
      setSelectedUserId(null);
      setSelectedUser(null);
      setSelectedRunStatusUser(null);

      // Clear any existing analysis data
      setSimpleFlowData(null);
      setBranchFlowData(null);
      setRtlFlowData(null);
    }
  };

  // Handle user selection to show their specific tables
  const handleUserSelection = (user: any) => {
    setSelectedRunStatusUser(user);
    setUserSpecificTables(user.tables || []);
    console.log(`Selected user: ${user.username} with ${user.tables?.length || 0} tables`);
  };

  // Handle going back to user list
  const handleBackToUsers = () => {
    setSelectedRunStatusUser(null);
    setUserSpecificTables([]);
  };

  // Filter dbFiles for RTL_version column when in RTL view and dbFiles change
  useEffect(() => {
    if (viewMode === 'rtl-flow' && dbFiles.length > 0) {
      // Only show tables that have RTL_version column (case insensitive)
      const filtered = dbFiles.filter(f =>
        Array.isArray(f.columns) && f.columns.some(col => 
          col.toLowerCase().replace('_', '').replace(' ', '') === 'rtlversion'
        )
      );
      setAvailableRtlFiles(filtered);
    } else {
      setAvailableRtlFiles([]);
    }
  }, [viewMode, dbFiles]);

  // Get RTL-compatible tables from automated database
  const getAvailableRtlTables = () => {
    if (viewMode === 'rtl-flow' && runStatusTables.length > 0) {
      return runStatusTables.filter(table =>
        Array.isArray(table.columns) && table.columns.some(col => 
          col.toLowerCase().replace('_', '').replace(' ', '') === 'rtlversion'
        )
      );
    }
    return [];
  };

  return (
    <div
      className="min-h-screen p-4 md:p-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--color-bg) 0%, var(--color-bg-dark) 100%)',
      }}
    >
      {/* Enhanced Background Pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle at 25% 25%, var(--color-primary) 2px, transparent 2px), radial-gradient(circle at 75% 75%, var(--color-secondary) 1px, transparent 1px)',
        backgroundSize: '60px 60px, 40px 40px',
      }} />

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        {/* Modern Productized Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl backdrop-blur-xl"
          style={{
            background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-light) 50%, var(--color-surface-dark) 100%)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0" style={{
              backgroundImage: `
                radial-gradient(circle at 20% 50%, var(--color-primary) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, var(--color-secondary) 0%, transparent 50%),
                radial-gradient(circle at 40% 80%, var(--color-primary-light) 0%, transparent 50%)
              `,
              backgroundSize: '100% 100%',
              filter: 'blur(60px)',
            }} />
          </div>

          <div className="relative z-10 p-8 md:p-12">
            <div className="flex items-center justify-between mb-6">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="flex items-center space-x-4"
              >
                <div className="p-3 rounded-2xl" style={{
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                  boxShadow: '0 8px 32px rgba(79, 139, 255, 0.3)',
                }}>
                  <CpuChipIcon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{
                    background: 'linear-gradient(135deg, var(--color-text), var(--color-primary))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    Data Flow Visualization Studio
                  </h1>
                  <p className="text-lg font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {isAdmin()
                      ? adminViewMode === 'admin'
                        ? selectedUser
                          ? `Admin Dashboard: ${selectedUser.name}'s Data Flows`
                          : 'Admin Dashboard: Enterprise Data Flow Management'
                        : selectedUser
                          ? `User Perspective: ${selectedUser.name}'s Personal Workspace`
                          : 'User Perspective: Personal Data Flow Workspace'
                      : 'Professional Data Flow Analysis & Visualization Platform'
                    }
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="hidden md:flex items-center space-x-3"
              >
                {/* Live Analytics Toggle Button - Production Ready */}
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLiveAnalyticsToggle}
                  className="flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 shadow-lg"
                  style={{
                    background: isLiveAnalyticsEnabled
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : isDark
                        ? 'linear-gradient(135deg, #374151, #4b5563)'
                        : 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
                    color: isLiveAnalyticsEnabled
                      ? 'white'
                      : isDark
                        ? '#ffffff'
                        : '#1e293b',
                    boxShadow: isLiveAnalyticsEnabled
                      ? '0 8px 25px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                      : isDark
                        ? '0 4px 15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                        : '0 4px 15px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.1)',
                    border: 'none',
                  }}
                >
                  <div className={`w-2.5 h-2.5 rounded-full mr-3 ${isLiveAnalyticsEnabled ? 'animate-pulse' : ''}`} style={{
                    background: isLiveAnalyticsEnabled
                      ? 'rgba(255, 255, 255, 0.9)'
                      : isDark
                        ? '#9ca3af'
                        : '#6b7280',
                    boxShadow: isLiveAnalyticsEnabled ? '0 0 8px rgba(255, 255, 255, 0.6)' : 'none',
                  }} />
                  <span className="flex items-center">
                    {isLiveAnalyticsEnabled ? (
                      <>
                        <span>Live Analytics</span>
                        <span className="ml-2 text-xs opacity-80 bg-white/20 px-2 py-0.5 rounded-full">
                          {isRunStatusConnected ? '30s' : 'Ready'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>Analytics Paused</span>
                        <span className="ml-2 text-xs opacity-60">Click to enable</span>
                      </>
                    )}
                  </span>
                </motion.button>

                {/* Admin/User View Toggle Button - Only for Admins */}
                {isAdmin() && (
                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAdminViewToggle}
                    className="flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 shadow-lg"
                    style={{
                      background: adminViewMode === 'admin'
                        ? isDark
                          ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                          : 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                        : isDark
                          ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                          : 'linear-gradient(135deg, #4f46e5, #3730a3)',
                      color: 'white',
                      boxShadow: adminViewMode === 'admin'
                        ? isDark
                          ? '0 8px 25px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                          : '0 8px 25px rgba(37, 99, 235, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                        : isDark
                          ? '0 8px 25px rgba(99, 102, 241, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                          : '0 8px 25px rgba(79, 70, 229, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                      border: 'none',
                    }}
                  >
                    <div className="flex items-center">
                      <div className="p-1 rounded-md bg-white/20 mr-3">
                        <UserIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="flex flex-col items-start">
                        <span className="text-xs opacity-80 leading-none">
                          {adminViewMode === 'admin' ? 'Admin' : 'User'}
                        </span>
                        <span className="leading-none">
                          {adminViewMode === 'admin' ? 'System View' : 'Personal View'}
                        </span>
                      </span>
                    </div>
                  </motion.button>
                )}

                {/* Non-admin users see their role indicator */}
                {!isAdmin() && (
                  <div className="flex items-center px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg" style={{
                    background: isDark
                      ? 'linear-gradient(135deg, #374151, #4b5563)'
                      : 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
                    color: isDark ? '#ffffff' : '#1e293b',
                    border: isDark ? '1px solid #4b5563' : '1px solid #e2e8f0',
                    boxShadow: isDark
                      ? '0 4px 15px rgba(0, 0, 0, 0.3)'
                      : '0 4px 15px rgba(0, 0, 0, 0.1)',
                  }}>
                    <div className="p-1 rounded-md mr-3" style={{ background: 'var(--color-primary-10)' }}>
                      <UserIcon className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <span className="flex flex-col items-start">
                      <span className="text-xs opacity-70 leading-none">User</span>
                      <span className="leading-none">Personal View</span>
                    </span>
                  </div>
                )}
              </motion.div>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="text-base leading-relaxed max-w-3xl"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {isAdmin()
                ? adminViewMode === 'admin'
                  ? selectedUser
                    ? `Admin View: Analyzing design flow patterns and performance metrics for ${selectedUser.name}'s projects`
                    : 'Admin View: Comprehensive analytics dashboard for monitoring data flows, performance metrics, and optimization opportunities across all users'
                  : selectedUser
                    ? `User View: Viewing ${selectedUser.name}'s personal data flow analysis and run status tracking`
                    : 'User View: Personal workspace for tracking your data processing runs and analyzing flow patterns'
                : 'Track your data processing run progress, analyze flow patterns, and optimize your workflows with intelligent insights'}
            </motion.p>
          </div>
        </motion.div>

        {/* Enhanced User selection for admins */}
        {isAdmin() && users.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="p-6 rounded-2xl shadow-card border backdrop-blur-md" 
            style={{ 
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: '0 25px 50px -12px var(--color-shadow)',
            }}
          >
            <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Select User</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <motion.div 
                whileHover={{ y: -8, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={() => setSelectedUserId(null)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                  selectedUserId === null 
                    ? 'border-primary bg-primary-light shadow-lg' 
                    : 'hover:bg-surface-light hover:shadow-md'
                }`}
                style={{ 
                  borderColor: selectedUserId === null ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: selectedUserId === null ? 'var(--color-primary-10)' : 'var(--color-surface)',
                }}
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
                    backgroundColor: 'var(--color-primary-20)',
                    color: 'var(--color-primary)'
                  }}>
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div className="ml-4">
                    <div className="font-semibold" style={{ color: 'var(--color-text)' }}>All Users</div>
                    <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>View runs from all users</div>
                  </div>
                </div>
              </motion.div>
              
              {users.map((u, index) => (
                <motion.div 
                  key={u.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                    selectedUserId === u.id 
                      ? 'border-primary bg-primary-light shadow-lg' 
                      : 'hover:bg-surface-light hover:shadow-md'
                  }`}
                  style={{ 
                    borderColor: selectedUserId === u.id ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: selectedUserId === u.id ? 'var(--color-primary-10)' : 'var(--color-surface)',
                  }}
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold" style={{
                      backgroundColor: 'var(--color-primary-20)',
                      color: 'var(--color-primary)'
                    }}>
                      {u.name ? u.name.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{u.name || u.username}</div>
                      <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{u.username}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Enhanced Flow View Selection */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="p-0 rounded-2xl shadow-card border overflow-hidden backdrop-blur-md" 
          style={{ 
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: '0 25px 50px -12px var(--color-shadow)',
          }}
        >
          <div className="bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary-dark)] to-[var(--color-secondary)] px-8 py-6">
            <div className="flex flex-col items-center text-center">
              <motion.h3
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="text-2xl font-bold text-white mb-2"
              >
                Data Flow Visualization Studio
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="text-white/80 mb-6"
              >
                Transform your run data into interactive flow diagrams with intelligent pattern recognition
              </motion.p>
              
              {/* Centered Flow View Buttons */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 1.0 }}
                className="flex justify-center items-center space-x-4"
              >
                <motion.button 
                  whileHover={{ scale: 1.08, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => handleViewModeChange('simple-flow')}
                  className="flex items-center px-6 py-3 rounded-xl font-semibold transition-all duration-300"
                  style={{ 
                    backgroundColor: viewMode === 'simple-flow' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.15)',
                    color: viewMode === 'simple-flow' ? 'var(--color-primary)' : 'white',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: viewMode === 'simple-flow' ? '0 8px 25px rgba(0, 0, 0, 0.15)' : '0 4px 15px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <ShareIcon className="w-5 h-5 mr-2" />
                  SIMPLE FLOW
                </motion.button>
                
                <motion.button 
                  whileHover={{ scale: 1.08, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => handleViewModeChange('branch-flow')}
                  className="flex items-center px-6 py-3 rounded-xl font-semibold transition-all duration-300"
                  style={{ 
                    backgroundColor: viewMode === 'branch-flow' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.15)',
                    color: viewMode === 'branch-flow' ? 'var(--color-primary)' : 'white',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: viewMode === 'branch-flow' ? '0 8px 25px rgba(0, 0, 0, 0.15)' : '0 4px 15px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <CircleStackIcon className="w-5 h-5 mr-2" />
                  BRANCH FLOW
                </motion.button>
                
                <motion.button 
                  whileHover={{ scale: 1.08, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => handleViewModeChange('rtl-flow')}
                  className="flex items-center px-6 py-3 rounded-xl font-semibold transition-all duration-300"
                  style={{ 
                    backgroundColor: viewMode === 'rtl-flow' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.15)',
                    color: viewMode === 'rtl-flow' ? 'var(--color-primary)' : 'white',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: viewMode === 'rtl-flow' ? '0 8px 25px rgba(0, 0, 0, 0.15)' : '0 4px 15px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <CpuChipIcon className="w-5 h-5 mr-2" />
                  RTL VIEW
                </motion.button>
              </motion.div>

              {/* Quick Help */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.2 }}
                className="mt-6 text-center"
              >
                <p className="text-sm text-white/70">
                  ?? <strong>TIP:</strong> USE SIMPLE VIEW FOR BASIC FLOW ANALYSIS, BRANCH VIEW FOR BRANCHING PATTERNS, AND RTL VIEW FOR VERSION-SPECIFIC ANALYSIS
                </p>
              </motion.div>
            </div>
          </div>
          
          {/* Enhanced Filters Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 p-8"
          >
            <div>
              <label htmlFor="search" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Search</label>
              <input
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search runs..."
                className="w-full rounded-xl px-4 py-3 transition-all duration-300 focus:ring-2 focus:ring-primary focus:border-transparent"
                style={{
                  backgroundColor: 'var(--color-surface-dark)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                  border: '2px solid var(--color-border)'
                }}
              />
            </div>
            <div>
              <label htmlFor="type" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Run Type</label>
              <select
                id="type"
                value={selectedRunType || ''}
                onChange={(e) => setSelectedRunType(e.target.value || null)}
                className="w-full rounded-xl px-4 py-3 transition-all duration-300 focus:ring-2 focus:ring-primary focus:border-transparent"
                style={{
                  backgroundColor: 'var(--color-surface-dark)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                  border: '2px solid var(--color-border)'
                }}
              >
                <option value="">All Types</option>
                <option value="Timing">Timing</option>
                <option value="QoR">QoR</option>
                <option value="DRC">DRC</option>
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Status</label>
              <select
                id="status"
                value={selectedStatus || ''}
                onChange={(e) => setSelectedStatus(e.target.value || null)}
                className="w-full rounded-xl px-4 py-3 transition-all duration-300 focus:ring-2 focus:ring-primary focus:border-transparent"
                style={{
                  backgroundColor: 'var(--color-surface-dark)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                  border: '2px solid var(--color-border)'
                }}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="paused">Paused</option>
              </select>
            </div>
            <div className="flex items-end">
              <motion.button 
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                onClick={() => {
                  setSelectedRunType(null);
                  setSelectedStatus(null);
                  setSearchTerm('');
                }}
                className="w-full px-6 py-3 rounded-xl font-semibold transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                  color: 'white',
                  border: 'none',
                  boxShadow: '0 4px 15px var(--color-primary-30)'
                }}
              >
                Clear Filters
              </motion.button>
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Main Content Area */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="p-0 rounded-2xl shadow-card border overflow-hidden backdrop-blur-md" 
          style={{ 
            backgroundColor: 'var(--color-surface)', 
            borderColor: 'var(--color-border)',
            boxShadow: '0 25px 50px -12px var(--color-shadow)',
          }}
        >
          {viewMode === 'simple-flow' && (
            <>
              <div className="bg-gradient-to-r from-[var(--color-primary-dark)] to-[var(--color-primary)] px-8 py-6">
                <div className="flex items-center justify-between">
                  <motion.h3 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-xl font-bold text-white flex items-center"
                  >
                    <ShareIcon className="h-6 w-6 mr-3" />
                    SIMPLE FLOW VIEW
                  </motion.h3>
                  <div className="flex items-center space-x-4">
                    {isRunStatusConnected && runStatusDbStatus && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center text-white text-sm bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm"
                      >
                        <CircleStackIcon className="w-4 h-4 mr-2" />
                        <div className={`w-2 h-2 rounded-full mr-2 ${isLiveAnalyticsEnabled ? 'animate-pulse bg-green-400' : 'bg-gray-400'}`} />
                        Auto-Connected to {runStatusDbStatus.connection.host}:{runStatusDbStatus.connection.port}/{runStatusDbStatus.connection.database}
                        {isLiveAnalyticsEnabled && <span className="ml-2 text-xs opacity-80">(Live)</span>}
                      </motion.div>
                    )}
                    {!isRunStatusConnected && dbConnection && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center text-white text-sm bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm"
                      >
                        <CircleStackIcon className="w-4 h-4 mr-2" />
                        Manual: {dbConnection.host}:{dbConnection.port}/{dbConnection.database}
                      </motion.div>
                    )}
                    {!isRunStatusConnected && dbConnection && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleDatabaseDisconnect}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-all duration-300 font-medium"
                      >
                        Disconnect
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>

              {!isRunStatusConnected && !dbConnection ? (
                <div className="text-center py-20">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="flex flex-col items-center justify-center"
                  >
                    <motion.div 
                      animate={{ 
                        rotate: [0, 360],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ 
                        rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                        scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                      }}
                      className="w-24 h-24 rounded-full flex items-center justify-center mb-8" 
                      style={{
                        backgroundColor: 'var(--color-primary-10)',
                        color: 'var(--color-primary)'
                      }}
                    >
                      <CircleStackIcon className="w-12 h-12" />
                    </motion.div>
                    <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>Connecting to Run Status Database</h3>
                    <p className="mb-8 text-lg max-w-md" style={{ color: 'var(--color-text-muted)' }}>
                      {runStatusError ? (
                        <>
                          <span className="text-red-500">Connection failed: {runStatusError}</span>
                          <br />
                          <span className="text-sm">You can manually connect to a database as fallback.</span>
                        </>
                      ) : (
                        'Automatically connecting to the Run Status database to fetch tables and analyze data.'
                      )}
                    </p>
                    {runStatusError && (
                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowDbModal(true)}
                        className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                          color: 'white',
                          boxShadow: '0 8px 25px var(--color-primary-30)'
                        }}
                      >
                        Manual Database Connection
                      </motion.button>
                    )}
                  </motion.div>
                </div>
              ) : (!isRunStatusConnected && !isConnected) ? (
                <div className="text-center py-20">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center"
                  >
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-24 rounded-full flex items-center justify-center mb-8" 
                      style={{
                        backgroundColor: 'var(--color-warning-10)',
                        color: 'var(--color-warning)'
                      }}
                    >
                      <ArrowPathIcon className="w-12 h-12" />
                    </motion.div>
                    <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>Connecting...</h3>
                    <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
                      Establishing connection to the database...
                    </p>
                  </motion.div>
                </div>
              ) : (isRunStatusConnected && runStatusTables.length === 0) || (!isRunStatusConnected && dbFiles.length === 0) ? (
                <div className="text-center py-20">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center"
                  >
                    <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8" style={{
                      backgroundColor: 'var(--color-info-10)',
                      color: 'var(--color-info)'
                    }}>
                      <TableCellsIcon className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>No Tables Found</h3>
                    <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
                      No tables were found in the connected database.
                    </p>
                  </motion.div>
                </div>
              ) : !simpleFlowData ? (
                <div className="p-8">
                  {/* Show different content based on user selection */}
                  {selectedRunStatusUser ? (
                    // User-specific tables view
                    <>
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <motion.h4 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xl font-bold mb-2" 
                            style={{ color: 'var(--color-text)' }}
                          >
                            {selectedRunStatusUser.username}'s Tables
                          </motion.h4>
                          <motion.p 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-base" 
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            {selectedRunStatusUser.totalRuns} total runs across {userSpecificTables.length} tables
                          </motion.p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleBackToUsers}
                          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm transition-all duration-300 font-medium"
                        >
                          Back to Users
                        </motion.button>
                      </div>
                    </>
                  ) : isRunStatusConnected && runStatusUsers.length > 0 && isAdmin() && adminViewMode === 'user' ? (
                    // Users list view - only show in admin user view mode
                    <>
                      <motion.h4
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xl font-bold mb-6"
                        style={{ color: 'var(--color-text)' }}
                      >
                        Users with Data in Run Status Database
                      </motion.h4>
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-base mb-6"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Select a user to view their tables and analyze their data. Found {runStatusUsers.length} users with data.
                      </motion.p>
                    </>
                  ) : (
                    // Default table selection view
                    <>
                      <motion.h4 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xl font-bold mb-6" 
                        style={{ color: 'var(--color-text)' }}
                      >
                        {isRunStatusConnected && isAdmin() && adminViewMode === 'admin'
                          ? 'Administrator Tables'
                          : isRunStatusConnected && isAdmin() && adminViewMode === 'user'
                            ? 'User Perspective - Select a table to analyze:'
                            : 'Select a table to analyze:'
                        }
                      </motion.h4>
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-base mb-6"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {isRunStatusConnected
                          ? isAdmin() && adminViewMode === 'admin'
                            ? 'Admin view: All tables in the Run Status database with full system access.'
                            : isAdmin() && adminViewMode === 'user'
                              ? 'User perspective: Choose any table from the Run Status database. The system will analyze the data and create a flow visualization.'
                              : 'Choose any table from the Run Status database. The system will analyze the data and create a flow visualization.'
                          : 'Choose any table from your database. The system will analyze the first row and create a flow visualization.'
                        }
                      </motion.p>
                    </>
                  )}
                  {(dbError || runStatusError) && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-6 p-4 rounded-xl" 
                      style={{ backgroundColor: 'var(--color-error-10)', color: 'var(--color-error)' }}
                    >
                      {runStatusError || dbError}
                    </motion.div>
                  )}
                  
                  {/* Show automated database tables first, then manual ones */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Show Users List - only in admin user view mode */}
                    {isRunStatusConnected && !selectedRunStatusUser && runStatusUsers.length > 0 && isAdmin() && adminViewMode === 'user' && runStatusUsers.map((user, index) => (
                      <motion.div
                        key={`user-${user.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="p-6 rounded-xl border cursor-pointer transition-all duration-300 relative"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-success)',
                          borderWidth: '2px',
                          boxShadow: '0 4px 15px var(--color-success-20)'
                        }}
                        onClick={() => handleUserSelection(user)}
                      >
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 text-xs rounded-full" style={{
                            backgroundColor: user.role === 'admin' ? 'var(--color-warning-10)' : 'var(--color-success-10)',
                            color: user.role === 'admin' ? 'var(--color-warning)' : 'var(--color-success)'
                          }}>
                            {user.role}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold truncate text-lg" style={{ color: 'var(--color-text)' }}>
                            {user.username}
                          </h5>
                          <UserIcon className="w-6 h-6" style={{ color: 'var(--color-success)' }} />
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          User with data in database
                        </p>
                        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Tables: {user.tables?.length || 0}</span>
                          <span>Runs: {user.totalRuns || 0}</span>
                        </div>
                      </motion.div>
                    ))}

                    {/* Show User-Specific Tables */}
                    {selectedRunStatusUser && userSpecificTables.map((table, index) => (
                      <motion.div
                        key={`user-table-${table.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="p-6 rounded-xl border cursor-pointer transition-all duration-300 relative"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-info)',
                          borderWidth: '2px',
                          boxShadow: '0 4px 15px var(--color-info-20)'
                        }}
                        onClick={() => handleRunStatusSimpleAnalyze(table)}
                      >
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 text-xs rounded-full" style={{
                            backgroundColor: 'var(--color-info-10)',
                            color: 'var(--color-info)'
                          }}>
                            User Data
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold truncate text-lg" style={{ color: 'var(--color-text)' }}>
                            {table.table_name}
                          </h5>
                          <TableCellsIcon className="w-6 h-6" style={{ color: 'var(--color-info)' }} />
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          {table.file_type}
                        </p>
                        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Schema: {table.schema_name || 'public'}</span>
                          <span>User Rows: {table.user_specific_count || table.row_count}</span>
                        </div>
                        {isSimpleAnalyzing && selectedRunStatusTable?.id === table.id && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-xl">
                            <div className="flex items-center text-white">
                              <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                              Analyzing...
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}

                    {/* Show Tables - Only for regular users or admin in admin view mode */}
                    {isRunStatusConnected && !selectedRunStatusUser &&
                     ((isAdmin() && adminViewMode === 'admin') || (!isAdmin())) &&
                     runStatusTables.length > 0 &&
                     runStatusTables.map((table, index) => (
                      <motion.div
                        key={`runstatus-${table.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="p-6 rounded-xl border cursor-pointer transition-all duration-300 relative"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-primary)',
                          borderWidth: '2px',
                          boxShadow: '0 4px 15px var(--color-primary-20)'
                        }}
                        onClick={() => handleRunStatusSimpleAnalyze(table)}
                      >
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 text-xs rounded-full" style={{
                            backgroundColor: 'var(--color-primary-10)',
                            color: 'var(--color-primary)'
                          }}>
                            Auto
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold truncate text-lg" style={{ color: 'var(--color-text)' }}>
                            {table.table_name}
                          </h5>
                          <TableCellsIcon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          {table.file_type}
                        </p>
                        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Schema: {table.schema_name || 'public'}</span>
                          <span>Rows: {table.row_count || 'Unknown'}</span>
                        </div>
                        {isSimpleAnalyzing && selectedRunStatusTable?.id === table.id && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-xl">
                            <div className="flex items-center text-white">
                              <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                              Analyzing...
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    
                    {/* Manual Database Tables */}
                    {!isRunStatusConnected && dbFiles.map((file, index) => (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="p-6 rounded-xl border cursor-pointer transition-all duration-300"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                          boxShadow: '0 4px 15px var(--color-shadow)'
                        }}
                        onClick={() => handleSimpleAnalyze(file)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold truncate text-lg" style={{ color: 'var(--color-text)' }}>
                            {file.table_name}
                          </h5>
                          <TableCellsIcon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          {file.file_type}
                        </p>
                        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Schema: {file.schema_name || 'public'}</span>
                          <span>Rows: {file.row_count || 'Unknown'}</span>
                        </div>
                        {isSimpleAnalyzing && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 flex items-center justify-center"
                          >
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              <ArrowPathIcon className="w-5 h-5 mr-2" style={{ color: 'var(--color-primary)' }} />
                            </motion.div>
                            <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>Analyzing...</span>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}

                    {/* Show "No tables found" message for non-admin users when no tables match their username */}
                    {(() => {
                      const shouldShowNoTables = isRunStatusConnected && !isAdmin() && runStatusTables.length === 0 && !selectedRunStatusUser;
                      console.log(`?? Simple View - Should show no tables: ${shouldShowNoTables} (connected: ${isRunStatusConnected}, isAdmin: ${isAdmin()}, isDocker: ${isDockerEnvironment()}, tablesCount: ${runStatusTables.length})`);
                      return shouldShowNoTables;
                    })() && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="col-span-full p-8 rounded-xl border-2 border-dashed text-center"
                        style={{
                          borderColor: 'var(--color-warning)',
                          backgroundColor: 'var(--color-warning-10)'
                        }}
                      >
                        <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-warning)' }} />
                        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                          No Tables Found for Your Account
                        </h3>
                        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                          This database doesn't contain any tables with data matching your username ({user?.username}).
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          Tables are filtered by the 'run_name' column. Make sure your data includes runs with your username.
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8">
                  <SimpleFlowVisualization 
                    flowData={simpleFlowData.flow_data}
                    onAnalyze={() => {
                      setSimpleFlowData(null);
                      setSelectedRunStatusTable(null);
                    }}
                    isLoading={isSimpleAnalyzing}
                  />
                </div>
              )}
            </>
          )}

          {/* Branch Flow View */}
          {viewMode === 'branch-flow' && (
            <>
              <div className="bg-gradient-to-r from-[var(--color-primary-dark)] to-[var(--color-primary)] px-8 py-6">
                <div className="flex items-center justify-between">
                  <motion.h3 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-xl font-bold text-white flex items-center"
                  >
                    <CircleStackIcon className="h-6 w-6 mr-3" />
                    BRANCH FLOW VIEW
                  </motion.h3>
                  <div className="flex items-center space-x-4">
                    {isRunStatusConnected && runStatusDbStatus && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center text-white text-sm bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm"
                      >
                        <CircleStackIcon className="w-4 h-4 mr-2" />
                        Auto-Connected to {runStatusDbStatus.connection.host}:{runStatusDbStatus.connection.port}/{runStatusDbStatus.connection.database}
                      </motion.div>
                    )}
                    {!isRunStatusConnected && dbConnection && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center text-white text-sm bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm"
                      >
                        <CircleStackIcon className="w-4 h-4 mr-2" />
                        Manual: {dbConnection.host}:{dbConnection.port}/{dbConnection.database}
                      </motion.div>
                    )}
                    {!isRunStatusConnected && dbConnection && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleDatabaseDisconnect}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-all duration-300 font-medium"
                      >
                        Disconnect
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>

              {!isRunStatusConnected && !dbConnection ? (
                <div className="text-center py-20">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="flex flex-col items-center justify-center"
                  >
                    <motion.div 
                      animate={{ 
                        rotate: [0, 360],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ 
                        rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                        scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                      }}
                      className="w-24 h-24 rounded-full flex items-center justify-center mb-8" 
                      style={{
                        backgroundColor: 'var(--color-primary-10)',
                        color: 'var(--color-primary)'
                      }}
                    >
                      <CircleStackIcon className="w-12 h-12" />
                    </motion.div>
                    <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>Connecting to Run Status Database</h3>
                    <p className="mb-8 text-lg max-w-md" style={{ color: 'var(--color-text-muted)' }}>
                      {runStatusError ? (
                        <>
                          <span className="text-red-500">Connection failed: {runStatusError}</span>
                          <br />
                          <span className="text-sm">You can manually connect to a database as fallback.</span>
                        </>
                      ) : (
                        'Automatically connecting to the Run Status database to analyze branching patterns and generate intelligent flow visualizations.'
                      )}
                    </p>
                    {runStatusError && (
                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowDbModal(true)}
                        className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                          color: 'white',
                          boxShadow: '0 8px 25px var(--color-primary-30)'
                        }}
                      >
                        Manual Database Connection
                      </motion.button>
                    )}
                  </motion.div>
                </div>
              ) : (!isRunStatusConnected && !isConnected) ? (
                <div className="text-center py-20">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center"
                  >
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-24 rounded-full flex items-center justify-center mb-8" 
                      style={{
                        backgroundColor: 'var(--color-warning-10)',
                        color: 'var(--color-warning)'
                      }}
                    >
                      <ArrowPathIcon className="w-12 h-12" />
                    </motion.div>
                    <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>Connecting...</h3>
                    <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
                      Establishing connection to the database...
                    </p>
                  </motion.div>
                </div>
              ) : (isRunStatusConnected && runStatusTables.length === 0) || (!isRunStatusConnected && dbFiles.length === 0) ? (
                <div className="text-center py-20">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center"
                  >
                    <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8" style={{
                      backgroundColor: 'var(--color-info-10)',
                      color: 'var(--color-info)'
                    }}>
                      <TableCellsIcon className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>No Tables Found</h3>
                    <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
                      No tables were found in the connected database.
                    </p>
                  </motion.div>
                </div>
              ) : !branchFlowData ? (
                <div className="p-8">
                  {/* Show different content based on user selection */}
                  {selectedRunStatusUser ? (
                    // User-specific tables view for Branch Flow
                    <>
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <motion.h4
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xl font-bold mb-2"
                            style={{ color: 'var(--color-text)' }}
                          >
                            {selectedRunStatusUser.username}'s Tables - Branch Analysis
                          </motion.h4>
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-base"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            Select a table to analyze branching patterns for {selectedRunStatusUser.username}
                          </motion.p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedRunStatusUser(null)}
                          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm transition-all duration-300 font-medium"
                        >
                          ? Back to Users
                        </motion.button>
                      </div>
                    </>
                  ) : (
                    // Default table selection view
                    <>
                      <motion.h4
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xl font-bold mb-6"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {isRunStatusConnected && isAdmin() && adminViewMode === 'user'
                          ? 'Select a User or Table for Branch Analysis:'
                          : 'Select a table to analyze for branching patterns:'
                        }
                      </motion.h4>
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-base mb-6"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {isRunStatusConnected && isAdmin() && adminViewMode === 'user'
                          ? 'Choose a user to view their tables, or select any table directly. The system will automatically detect when stages are copied from previous runs and create intelligent branching visualizations.'
                          : isRunStatusConnected
                            ? 'Choose a table with run data from the Run Status database. The system will automatically detect when stages are copied from previous runs and create intelligent branching visualizations with curved connections.'
                            : 'Choose a table with run data. The system will automatically detect when stages are copied from previous runs and create intelligent branching visualizations with curved connections.'
                        }
                      </motion.p>
                    </>
                  )}
                  {(dbError || runStatusError) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-6 p-4 rounded-xl border-l-4"
                      style={{
                        backgroundColor: 'var(--color-error-10)',
                        color: 'var(--color-error)',
                        borderLeftColor: 'var(--color-error)'
                      }}
                    >
                      <div className="flex items-start">
                        <ExclamationTriangleIcon className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium mb-1">Analysis Error</h4>
                          <p className="text-sm">{runStatusError || dbError}</p>
                          <p className="text-xs mt-2 opacity-75">
                            Please check your data format and try again. If the issue persists, contact support.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  {/* Show automated database tables first, then manual ones */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Show Users List - only in admin user view mode */}
                    {isRunStatusConnected && !selectedRunStatusUser && runStatusUsers.length > 0 && isAdmin() && adminViewMode === 'user' && runStatusUsers.map((user, index) => (
                      <motion.div
                        key={`user-branch-${user.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="p-6 rounded-xl border cursor-pointer transition-all duration-300 relative"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-success)',
                          borderWidth: '2px',
                          boxShadow: '0 4px 15px var(--color-success-20)'
                        }}
                        onClick={() => handleUserSelection(user)}
                      >
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 text-xs rounded-full" style={{
                            backgroundColor: user.role === 'admin' ? 'var(--color-warning-10)' : 'var(--color-success-10)',
                            color: user.role === 'admin' ? 'var(--color-warning)' : 'var(--color-success)'
                          }}>
                            {user.role}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold truncate text-lg" style={{ color: 'var(--color-text)' }}>
                            {user.username}
                          </h5>
                          <UserIcon className="w-6 h-6" style={{ color: 'var(--color-success)' }} />
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          User with data in database
                        </p>
                        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Tables: {user.tables?.length || 0}</span>
                          <span>Runs: {user.totalRuns || 0}</span>
                        </div>
                      </motion.div>
                    ))}

                    {/* Show User-Specific Tables for Branch Analysis */}
                    {selectedRunStatusUser && (() => {
                      // BranchFlow filtering: Exclude tables with BOTH RTL_version AND Block_name columns
                      const branchFlowUserTables = userSpecificTables.filter(table => {
                        const columns = table.columns || [];
                        const hasRTLVersion = columns.some(col => col.toLowerCase() === 'rtl_version');
                        const hasBlockName = columns.some(col => col.toLowerCase() === 'block_name');
                        const shouldExclude = hasRTLVersion && hasBlockName;
                        
                        if (shouldExclude) {
                          console.log(`?? BranchFlow User Tables: Excluding table ${table.table_name} - contains both RTL_version and Block_name columns`);
                        }
                        
                        return !shouldExclude;
                      });
                      
                      return branchFlowUserTables;
                    })().map((table, index) => (
                      <motion.div
                        key={`user-branch-table-${table.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="p-6 rounded-xl border cursor-pointer transition-all duration-300 relative"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-info)',
                          borderWidth: '2px',
                          boxShadow: '0 4px 15px var(--color-info-20)'
                        }}
                        onClick={() => handleRunStatusBranchAnalyze(table)}
                      >
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 text-xs rounded-full" style={{
                            backgroundColor: 'var(--color-info-10)',
                            color: 'var(--color-info)'
                          }}>
                            User Data
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold truncate text-lg" style={{ color: 'var(--color-text)' }}>
                            {table.table_name}
                          </h5>
                          <CircleStackIcon className="w-6 h-6" style={{ color: 'var(--color-info)' }} />
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          {table.file_type}  Branch Analysis
                        </p>
                        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Schema: {table.schema_name || 'public'}</span>
                          <span>Rows: {table.row_count || 'Unknown'}</span>
                        </div>
                        {isBranchAnalyzing && selectedRunStatusTable?.id === table.id && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 flex items-center justify-center"
                          >
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              <ArrowPathIcon className="w-5 h-5 mr-2" style={{ color: 'var(--color-info)' }} />
                            </motion.div>
                            <span className="text-sm font-medium" style={{ color: 'var(--color-info)' }}>Analyzing branches...</span>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}

                    {/* Automated Run Status Database Tables - Only for regular users or admin in admin view mode */}
                    {isRunStatusConnected && !selectedRunStatusUser &&
                     ((isAdmin() && adminViewMode === 'admin') || (!isAdmin())) &&
                     runStatusTables.length > 0 &&
                     (() => {
                       // BranchFlow filtering: Exclude tables with BOTH RTL_version AND Block_name columns
                       const branchFlowTables = runStatusTables.filter(table => {
                         const columns = table.columns || [];
                         const hasRTLVersion = columns.some(col => col.toLowerCase() === 'rtl_version');
                         const hasBlockName = columns.some(col => col.toLowerCase() === 'block_name');
                         const shouldExclude = hasRTLVersion && hasBlockName;
                         
                         if (shouldExclude) {
                           console.log(`?? BranchFlow: Excluding table ${table.table_name} - contains both RTL_version and Block_name columns`);
                         }
                         
                         return !shouldExclude;
                       });
                       
                       return branchFlowTables;
                     })().map((table, index) => (
                      <motion.div
                        key={`runstatus-branch-${table.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="p-6 rounded-xl border cursor-pointer transition-all duration-300 relative"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: '#FFD700',
                          borderWidth: '2px',
                          boxShadow: '0 4px 15px rgba(255, 215, 0, 0.2)'
                        }}
                        onClick={() => handleRunStatusBranchAnalyze(table)}
                      >
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 text-xs rounded-full" style={{
                            backgroundColor: 'rgba(255, 215, 0, 0.1)',
                            color: '#FFD700'
                          }}>
                            Auto
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold truncate text-lg" style={{ color: 'var(--color-text)' }}>
                            {table.table_name}
                          </h5>
                          <CircleStackIcon className="w-6 h-6" style={{ color: '#FFD700' }} />
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          {table.file_type} ? Branch Analysis
                        </p>
                        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Schema: {table.schema_name || 'public'}</span>
                          <span>Rows: {table.row_count || 'Unknown'}</span>
                        </div>
                        {isBranchAnalyzing && selectedRunStatusTable?.id === table.id && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center"
                          >
                            <div className="flex flex-col items-center">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="mb-2"
                              >
                                <ArrowPathIcon className="w-8 h-8" style={{ color: '#FFD700' }} />
                              </motion.div>
                              <span className="text-sm font-medium" style={{ color: '#FFD700' }}>Analyzing branches...</span>
                              <span className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>This may take a few moments</span>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                    
                    {/* Manual Database Tables */}
                    {!isRunStatusConnected && (() => {
                      // BranchFlow filtering: Exclude tables with BOTH RTL_version AND Block_name columns
                      const branchFlowDbFiles = dbFiles.filter(file => {
                        const columns = file.columns || [];
                        const hasRTLVersion = columns.some(col => col.toLowerCase() === 'rtl_version');
                        const hasBlockName = columns.some(col => col.toLowerCase() === 'block_name');
                        const shouldExclude = hasRTLVersion && hasBlockName;
                        
                        if (shouldExclude) {
                          console.log(`?? BranchFlow Manual Files: Excluding table ${file.table_name} - contains both RTL_version and Block_name columns`);
                        }
                        
                        return !shouldExclude;
                      });
                      
                      return branchFlowDbFiles;
                    })().map((file, index) => (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="p-6 rounded-xl border cursor-pointer transition-all duration-300"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                          boxShadow: '0 4px 15px var(--color-shadow)'
                        }}
                        onClick={() => handleBranchAnalyze(file)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold truncate text-lg" style={{ color: 'var(--color-text)' }}>
                            {file.table_name}
                          </h5>
                          <CircleStackIcon className="w-6 h-6" style={{ color: '#FFD700' }} />
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          {file.file_type} ? Branch Analysis
                        </p>
                        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Schema: {file.schema_name || 'public'}</span>
                          <span>Rows: {file.row_count || 'Unknown'}</span>
                        </div>
                        {isBranchAnalyzing && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 flex items-center justify-center"
                          >
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              <ArrowPathIcon className="w-5 h-5 mr-2" style={{ color: '#FFD700' }} />
                            </motion.div>
                            <span className="text-sm font-medium" style={{ color: '#FFD700' }}>Analyzing branches...</span>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}

                    {/* Show "No tables found" message for non-admin users when no tables match their username */}
                    {(() => {
                      const shouldShowNoTables = isRunStatusConnected && !isAdmin() && runStatusTables.length === 0 && !selectedRunStatusUser;
                      console.log(`?? Branch View - Should show no tables: ${shouldShowNoTables} (connected: ${isRunStatusConnected}, isAdmin: ${isAdmin()}, isDocker: ${isDockerEnvironment()}, tablesCount: ${runStatusTables.length})`);
                      return shouldShowNoTables;
                    })() && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="col-span-full p-8 rounded-xl border-2 border-dashed text-center"
                        style={{
                          borderColor: 'var(--color-warning)',
                          backgroundColor: 'var(--color-warning-10)'
                        }}
                      >
                        <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-warning)' }} />
                        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                          No Tables Found for Your Account
                        </h3>
                        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                          This database doesn't contain any tables with data matching your username ({user?.username}).
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          Tables are filtered by the 'run_name' column. Make sure your data includes runs with your username.
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8">
                  <BranchFlowVisualization 
                    data={branchFlowData.branch_data}
                  />
                  <div className="mt-4 flex justify-center">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setBranchFlowData(null);
                        setSelectedFile(null);
                      }}
                      className="px-6 py-2 rounded-lg font-medium transition-all duration-300"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)'
                      }}
                    >
                      Analyze Another Table
                    </motion.button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* RTL Flow View */}
          {viewMode === 'rtl-flow' && (
            <>
              <div className="bg-gradient-to-r from-[var(--color-primary-dark)] to-[var(--color-primary)] px-8 py-6">
                <div className="flex items-center justify-between">
                  <motion.h3 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-xl font-bold text-white flex items-center"
                  >
                    <CpuChipIcon className="h-6 w-6 mr-3" />
                    RTL VIEW
                  </motion.h3>
                  <div className="flex items-center space-x-4">
                    {isRunStatusConnected && runStatusDbStatus && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center text-white text-sm bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm"
                      >
                        <CircleStackIcon className="w-4 h-4 mr-2" />
                        Auto-Connected to {runStatusDbStatus.connection.host}:{runStatusDbStatus.connection.port}/{runStatusDbStatus.connection.database}
                      </motion.div>
                    )}
                    {!isRunStatusConnected && dbConnection && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center text-white text-sm bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm"
                      >
                        <CircleStackIcon className="w-4 h-4 mr-2" />
                        Manual: {dbConnection.host}:{dbConnection.port}/{dbConnection.database}
                      </motion.div>
                    )}
                    {!isRunStatusConnected && dbConnection && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleDatabaseDisconnect}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-all duration-300 font-medium"
                      >
                        Disconnect
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>

              {!isRunStatusConnected && !dbConnection ? (
                <div className="text-center py-20">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="flex flex-col items-center justify-center"
                  >
                    <motion.div 
                      animate={{ 
                        rotate: [0, 360],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ 
                        rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                        scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                      }}
                      className="w-24 h-24 rounded-full flex items-center justify-center mb-8" 
                      style={{
                        backgroundColor: 'var(--color-primary-10)',
                        color: 'var(--color-primary)'
                      }}
                    >
                      <CpuChipIcon className="w-12 h-12" />
                    </motion.div>
                    <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>Connecting to Run Status Database</h3>
                    <p className="mb-8 text-lg max-w-md" style={{ color: 'var(--color-text-muted)' }}>
                      {runStatusError ? (
                        <>
                          <span className="text-red-500">Connection failed: {runStatusError}</span>
                          <br />
                          <span className="text-sm">You can manually connect to a database as fallback.</span>
                        </>
                      ) : (
                        'Automatically connecting to the Run Status database to analyze RTL version patterns and generate version-specific branching visualizations.'
                      )}
                    </p>
                    {runStatusError && (
                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowDbModal(true)}
                        className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300"
                        style={{
                          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                          color: 'white',
                          boxShadow: '0 8px 25px var(--color-primary-30)'
                        }}
                      >
                        Manual Database Connection
                      </motion.button>
                    )}
                  </motion.div>
                </div>
              ) : (!isRunStatusConnected && !isConnected) ? (
                <div className="text-center py-20">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center"
                  >
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-24 rounded-full flex items-center justify-center mb-8" 
                      style={{
                        backgroundColor: 'var(--color-warning-10)',
                        color: 'var(--color-warning)'
                      }}
                    >
                      <ArrowPathIcon className="w-12 h-12" />
                    </motion.div>
                    <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>Connecting...</h3>
                    <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
                      Establishing connection to the database...
                    </p>
                  </motion.div>
                </div>
              ) : (isRunStatusConnected && getAvailableRtlTables().length === 0) || (!isRunStatusConnected && availableRtlFiles.length === 0) ? (
                <div className="text-center py-20">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center"
                  >
                    <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8" style={{
                      backgroundColor: 'var(--color-info-10)',
                      color: 'var(--color-info)'
                    }}>
                      <TableCellsIcon className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>No RTL Tables Found</h3>
                    <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
                      No tables with an RTL_version column were found in the connected database.
                    </p>
                  </motion.div>
                </div>
              ) : !rtlFlowData ? (
                <div className="p-8">
                  {/* Show different content based on user selection */}
                  {selectedRunStatusUser ? (
                    // User-specific tables view for RTL Flow
                    <>
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <motion.h4
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xl font-bold mb-2"
                            style={{ color: 'var(--color-text)' }}
                          >
                            {selectedRunStatusUser.username}'s Tables - RTL Analysis
                          </motion.h4>
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-base"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            Select a table with RTL_version column to analyze for {selectedRunStatusUser.username}
                          </motion.p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedRunStatusUser(null)}
                          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm transition-all duration-300 font-medium"
                        >
                          ? Back to Users
                        </motion.button>
                      </div>
                    </>
                  ) : (
                    // Default table selection view
                    <>
                      <motion.h4
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xl font-bold mb-6"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {isRunStatusConnected && isAdmin() && adminViewMode === 'user'
                          ? 'Select a User or Table for RTL Analysis:'
                          : 'Select a table to analyze for RTL version patterns:'
                        }
                      </motion.h4>
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-base mb-6"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {isRunStatusConnected && isAdmin() && adminViewMode === 'user'
                          ? 'Choose a user to view their RTL tables, or select any table with RTL_version column directly. The system will automatically detect RTL versions and create version-specific branching visualizations.'
                          : isRunStatusConnected
                            ? 'Choose a table with RTL_version column from the Run Status database. The system will automatically detect RTL versions and create version-specific branching visualizations.'
                            : 'Choose a table with RTL_version column. The system will automatically detect RTL versions and create version-specific branching visualizations.'
                        }
                      </motion.p>
                    </>
                  )}
                  {(dbError || runStatusError) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-6 p-4 rounded-xl border-l-4"
                      style={{
                        backgroundColor: 'var(--color-error-10)',
                        color: 'var(--color-error)',
                        borderLeftColor: 'var(--color-error)'
                      }}
                    >
                      <div className="flex items-start">
                        <ExclamationTriangleIcon className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium mb-1">RTL Analysis Error</h4>
                          <p className="text-sm">{runStatusError || dbError}</p>
                          <p className="text-xs mt-2 opacity-75">
                            Ensure your data contains an RTL_version column and try again.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  {/* Show automated database tables first, then manual ones */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Show Users List - only in admin user view mode */}
                    {isRunStatusConnected && !selectedRunStatusUser && runStatusUsers.length > 0 && isAdmin() && adminViewMode === 'user' && runStatusUsers.map((user, index) => (
                      <motion.div
                        key={`user-rtl-${user.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="p-6 rounded-xl border cursor-pointer transition-all duration-300 relative"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-success)',
                          borderWidth: '2px',
                          boxShadow: '0 4px 15px var(--color-success-20)'
                        }}
                        onClick={() => handleUserSelection(user)}
                      >
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 text-xs rounded-full" style={{
                            backgroundColor: user.role === 'admin' ? 'var(--color-warning-10)' : 'var(--color-success-10)',
                            color: user.role === 'admin' ? 'var(--color-warning)' : 'var(--color-success)'
                          }}>
                            {user.role}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold truncate text-lg" style={{ color: 'var(--color-text)' }}>
                            {user.username}
                          </h5>
                          <UserIcon className="w-6 h-6" style={{ color: 'var(--color-success)' }} />
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          User with data in database
                        </p>
                        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Tables: {user.tables?.length || 0}</span>
                          <span>Runs: {user.totalRuns || 0}</span>
                        </div>
                      </motion.div>
                    ))}

                    {/* Show User-Specific Tables for RTL Analysis */}
                    {selectedRunStatusUser && userSpecificTables.filter(table =>
                      Array.isArray(table.columns) && table.columns.some(col =>
                        col.toLowerCase().replace('_', '').replace(' ', '') === 'rtlversion'
                      )
                    ).map((table, index) => (
                      <motion.div
                        key={`user-rtl-table-${table.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="p-6 rounded-xl border cursor-pointer transition-all duration-300 relative"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-info)',
                          borderWidth: '2px',
                          boxShadow: '0 4px 15px var(--color-info-20)'
                        }}
                        onClick={() => handleRunStatusRtlAnalyze(table)}
                      >
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 text-xs rounded-full" style={{
                            backgroundColor: 'var(--color-info-10)',
                            color: 'var(--color-info)'
                          }}>
                            User Data
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold truncate text-lg" style={{ color: 'var(--color-text)' }}>
                            {table.table_name}
                          </h5>
                          <CpuChipIcon className="w-6 h-6" style={{ color: 'var(--color-info)' }} />
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          {table.file_type}  RTL Analysis
                        </p>
                        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Schema: {table.schema_name || 'public'}</span>
                          <span>Rows: {table.row_count || 'Unknown'}</span>
                        </div>
                        {isRtlAnalyzing && selectedRunStatusTable?.id === table.id && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center"
                          >
                            <div className="flex flex-col items-center">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="mb-2"
                              >
                                <ArrowPathIcon className="w-8 h-8" style={{ color: 'var(--color-info)' }} />
                              </motion.div>
                              <span className="text-sm font-medium" style={{ color: 'var(--color-info)' }}>Analyzing RTL...</span>
                              <span className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Processing RTL versions</span>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}

                    {/* Automated Run Status Database Tables with RTL_version - Only for regular users or admin in admin view mode */}
                    {isRunStatusConnected && !selectedRunStatusUser &&
                     ((isAdmin() && adminViewMode === 'admin') || (!isAdmin())) &&
                     getAvailableRtlTables().map((table, index) => (
                      <motion.div
                        key={`runstatus-rtl-${table.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="p-6 rounded-xl border cursor-pointer transition-all duration-300 relative"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-primary)',
                          borderWidth: '2px',
                          boxShadow: '0 4px 15px var(--color-primary-20)'
                        }}
                        onClick={() => handleRunStatusRtlAnalyze(table)}
                      >
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 text-xs rounded-full" style={{
                            backgroundColor: 'var(--color-primary-10)',
                            color: 'var(--color-primary)'
                          }}>
                            Auto
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold truncate text-lg" style={{ color: 'var(--color-text)' }}>
                            {table.table_name}
                          </h5>
                          <CpuChipIcon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          {table.file_type} ? RTL Analysis
                        </p>
                        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Schema: {table.schema_name || 'public'}</span>
                          <span>Rows: {table.row_count || 'Unknown'}</span>
                        </div>
                        {isRtlAnalyzing && selectedRunStatusTable?.id === table.id && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 flex items-center justify-center"
                          >
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              <ArrowPathIcon className="w-5 h-5 mr-2" style={{ color: 'var(--color-primary)' }} />
                            </motion.div>
                            <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>Analyzing RTL versions...</span>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                    
                    {/* Manual Database Tables with RTL_version */}
                    {!isRunStatusConnected && availableRtlFiles.map((file, index) => (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="p-6 rounded-xl border cursor-pointer transition-all duration-300"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                          boxShadow: '0 4px 15px var(--color-shadow)'
                        }}
                        onClick={() => handleRtlAnalyze(file)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold truncate text-lg" style={{ color: 'var(--color-text)' }}>
                            {file.table_name}
                          </h5>
                          <CpuChipIcon className="w-6 h-6" style={{ color: '#667eea' }} />
                        </div>
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          {file.file_type} ? RTL Analysis
                        </p>
                        <div className="flex justify-between items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Schema: {file.schema_name || 'public'}</span>
                          <span>Rows: {file.row_count || 'Unknown'}</span>
                        </div>
                        {isRtlAnalyzing && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 flex items-center justify-center"
                          >
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              <ArrowPathIcon className="w-5 h-5 mr-2" style={{ color: '#667eea' }} />
                            </motion.div>
                            <span className="text-sm font-medium" style={{ color: '#667eea' }}>Analyzing RTL versions...</span>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}

                    {/* Show "No tables found" message for non-admin users when no RTL tables match their username */}
                    {isRunStatusConnected && !isAdmin() && getAvailableRtlTables().length === 0 && !selectedRunStatusUser && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="col-span-full p-8 rounded-xl border-2 border-dashed text-center"
                        style={{
                          borderColor: 'var(--color-warning)',
                          backgroundColor: 'var(--color-warning-10)'
                        }}
                      >
                        <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-warning)' }} />
                        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                          No RTL Tables Found for Your Account
                        </h3>
                        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                          This database doesn't contain any tables with RTL_version column and data matching your username ({user?.username}).
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          Tables are filtered by the 'run_name' column. Make sure your data includes runs with your username and RTL_version column.
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8">
                  <RTLFlowVisualization 
                    data={rtlFlowData.rtl_data}
                  />
                  <div className="mt-4 flex justify-center">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setRtlFlowData(null);
                        setSelectedFile(null);
                      }}
                      className="px-6 py-2 rounded-lg font-medium transition-all duration-300"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)'
                      }}
                    >
                      Analyze Another Table
                    </motion.button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>

      {/* Database Connection Modal */}
      <DatabaseConnectionModal
        isOpen={showDbModal}
        onClose={() => setShowDbModal(false)}
        onConnect={handleDatabaseConnect}
        isConnecting={isConnecting}
      />

      {/* Success Notification Toast */}
      {showSuccessNotification && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-lg border"
          style={{
            backgroundColor: 'var(--color-success-10)',
            borderColor: 'var(--color-success)',
            color: 'var(--color-success)'
          }}
        >
          <div className="flex items-center">
            <CheckCircleIcon className="w-5 h-5 mr-3" />
            <div>
              <p className="font-medium">{successMessage}</p>
              <p className="text-xs mt-1 opacity-75">Analysis ready for review</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}