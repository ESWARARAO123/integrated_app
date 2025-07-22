import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserIcon, 
  CpuChipIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { RTLFlowData, RTLVersionAnalysis } from '../../services/flowtrackService';
import BranchFlowVisualization from './BranchFlowVisualization';
import './RTLFlowVisualization.css';

interface RTLFlowVisualizationProps {
  data: RTLFlowData;
}

export default function RTLFlowVisualization({ data }: RTLFlowVisualizationProps) {
  const [analysisStatus, setAnalysisStatus] = useState<'initiating' | 'initiated'>('initiating');
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [selectedVersionData, setSelectedVersionData] = useState<RTLVersionAnalysis | null>(null);

  // Simulate analysis initiation
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnalysisStatus('initiated');
    }, 2000); // Show "initiating analysis" for 2 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleVersionClick = (version: string) => {
    setSelectedVersion(version);
    setSelectedVersionData(data.version_analyses[version] || null);
  };

  const handleBackToVersions = () => {
    setSelectedVersion(null);
    setSelectedVersionData(null);
  };

  if (analysisStatus === 'initiating') {
    return (
      <div className="rtl-flow-container">
        <div className="rtl-analysis-status">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="status-card initiating"
          >
            <ArrowPathIcon className="status-icon animate-spin" />
            <h3>INITIATING ANALYSIS</h3>
            <p>ANALYZING RTL VERSION DATA AND DETECTING BRANCHING PATTERNS...</p>
          </motion.div>
        </div>
      </div>
    );
  }

  if (selectedVersion && selectedVersionData) {
    return (
      <div className="rtl-flow-container">
        <div className="rtl-header">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBackToVersions}
            className="back-button"
          >
            ? Back to Versions
          </motion.button>
          <div className="version-title">
            <CpuChipIcon className="version-icon" />
            <h2>{(() => {
              const addSpacing = (text: string) => {
                return text
                  .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
                  .replace(/(\d+)([a-zA-Z])/g, '$1 $2')
                  .replace(/([a-z])([A-Z])/g, '$1 $2')
                  .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
                  .replace(/\s+/g, ' ')
                  .trim();
              };
              return addSpacing(selectedVersion.replace(/\b(?:R|RUN|Run|run)(\d+)\b/g, 'RUN$1')).toUpperCase();
            })()} BRANCHING ANALYSIS</h2>
          </div>
        </div>
        
        <div className="version-visualization">
          <BranchFlowVisualization data={selectedVersionData.branch_layout} />
        </div>
      </div>
    );
  }

  return (
    <div className="rtl-flow-container">
      {/* Analysis Status */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rtl-analysis-status"
      >
        <div className="status-card initiated">
          <CheckCircleIcon className="status-icon" />
          <h3>INITIATED</h3>
          <p>RTL ANALYSIS COMPLETED SUCCESSFULLY</p>
        </div>
      </motion.div>

      {/* User and Versions Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rtl-header"
      >
        {data.username && data.username !== 'Unknown User' && (
          <div className="user-info">
            <UserIcon className="user-icon" />
            <span className="username">{data.username.toUpperCase()}</span>
          </div>
        )}
        
        <div className="rtl-versions">
          <span className="versions-label">RTL VERSIONS:</span>
          <div className="version-links">
            {data.rtl_versions.map((version, index) => (
              <motion.button
                key={version}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + (index * 0.1) }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleVersionClick(version)}
                className="version-link"
              >
                <CpuChipIcon className="version-link-icon" />
                {(() => {
                  const addSpacing = (text: string) => {
                    return text
                      .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
                      .replace(/(\d+)([a-zA-Z])/g, '$1 $2')
                      .replace(/([a-z])([A-Z])/g, '$1 $2')
                      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
                      .replace(/\s+/g, ' ')
                      .trim();
                  };
                  return addSpacing(version.replace(/\b(?:R|RUN|Run|run)(\d+)\b/g, 'RUN$1')).toUpperCase();
                })()}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Column Headers Information */}
      {data.data_analysis && data.data_analysis.stage_columns && data.data_analysis.stage_columns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rtl-header-main"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                DATA STRUCTURE OVERVIEW
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                ANALYSIS INCLUDES {data.data_analysis.total_columns} COLUMNS WITH {data.data_analysis.stage_columns.length} STAGE COLUMNS
              </p>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
              STAGE COLUMNS:
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.data_analysis.stage_columns.map((column, index) => (
                <motion.span
                  key={column}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + (index * 0.1) }}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--color-primary-10)',
                    color: 'var(--color-primary)',
                    border: '1px solid var(--color-primary-30)'
                  }}
                >
                  {(() => {
                    const addSpacing = (text: string) => {
                      return text
                        .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
                        .replace(/(\d+)([a-zA-Z])/g, '$1 $2')
                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
                        .replace(/\s+/g, ' ')
                        .trim();
                    };
                    return addSpacing(column.replace(/\b(?:R|RUN|Run|run)(\d+)\b/g, 'RUN$1')).toUpperCase();
                  })()}
                </motion.span>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium" style={{ color: 'var(--color-text)' }}>RTL COLUMN:</span>
                <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">
                  {(() => {
                    const addSpacing = (text: string) => {
                      return text
                        .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
                        .replace(/(\d+)([a-zA-Z])/g, '$1 $2')
                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
                        .replace(/\s+/g, ' ')
                        .trim();
                    };
                    return addSpacing(data.data_analysis.rtl_column.replace(/\b(?:R|RUN|Run|run)(\d+)\b/g, 'RUN$1')).toUpperCase();
                  })()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium" style={{ color: 'var(--color-text)' }}>RUN COLUMN:</span>
                <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs">
                  {(() => {
                    const addSpacing = (text: string) => {
                      return text
                        .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
                        .replace(/(\d+)([a-zA-Z])/g, '$1 $2')
                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
                        .replace(/\s+/g, ' ')
                        .trim();
                    };
                    return addSpacing(data.data_analysis.run_column.replace(/\b(?:R|RUN|Run|run)(\d+)\b/g, 'RUN$1')).toUpperCase();
                  })()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium" style={{ color: 'var(--color-text)' }}>USERNAME:</span>
                <span className="px-2 py-1 rounded bg-purple-100 text-purple-800 text-xs">
                  {(() => {
                    const addSpacing = (text: string) => {
                      return text
                        .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
                        .replace(/(\d+)([a-zA-Z])/g, '$1 $2')
                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
                        .replace(/\s+/g, ' ')
                        .trim();
                    };
                    return addSpacing(data.data_analysis.username.replace(/\b(?:R|RUN|Run|run)(\d+)\b/g, 'RUN$1')).toUpperCase();
                  })()}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Version Selection Prompt */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="version-selection-prompt"
      >
        <div className="prompt-card">
          <CpuChipIcon className="prompt-icon" />
          <h3>Select RTL Version</h3>
          <p>
            Click on any RTL version above to view its specific branching analysis.
            Each version shows how runs branch from previous stages within that RTL version.
          </p>
          <div className="version-stats">
            <div className="stat">
              <span className="stat-value">{data.total_versions}</span>
              <span className="stat-label">Total Versions</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {Object.values(data.version_analyses).reduce((total, analysis) => 
                  total + analysis.data.length, 0
                )}
              </span>
              <span className="stat-label">Total Runs</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Version Preview Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="version-preview-grid"
      >
        {data.rtl_versions.map((version, index) => {
          const versionAnalysis = data.version_analyses[version];
          const runCount = versionAnalysis?.data.length || 0;
          const branchCount = Object.keys(versionAnalysis?.copy_patterns || {}).length;
          
          return (
            <motion.div
              key={version}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 + (index * 0.1) }}
              whileHover={{ scale: 1.02, y: -5 }}
              onClick={() => handleVersionClick(version)}
              className="version-preview-card"
            >
              <div className="version-preview-header">
                <CpuChipIcon className="version-preview-icon" />
                <h4>{version}</h4>
              </div>
              <div className="version-preview-stats">
                <div className="preview-stat">
                  <span className="preview-stat-value">{runCount}</span>
                  <span className="preview-stat-label">Runs</span>
                </div>
                <div className="preview-stat">
                  <span className="preview-stat-value">{branchCount}</span>
                  <span className="preview-stat-label">Branches</span>
                </div>
              </div>
              <div className="version-preview-action">
                <span>Click to analyze ?</span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}