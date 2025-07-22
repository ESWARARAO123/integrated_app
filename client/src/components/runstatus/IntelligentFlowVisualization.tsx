import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

interface FlowNode {
  id: string;
  label: string;
  type: string;
  status: string;
  user: string;
  run: string;
  stage: string;
  run_order: number;
  stage_order: number;
  x: number;
  y: number;
  style: {
    width: number;
    height: number;
    backgroundColor: string;
    color: string;
    borderRadius: number;
    fontSize: number;
    border?: string;
    boxShadow?: string;
  };
}

interface FlowConnection {
  from: string;
  to: string;
  type: string;
  style: {
    stroke: string;
    strokeWidth: number;
    arrowSize: number;
    opacity: number;
    strokeDasharray?: string;
  };
}

interface FlowLayout {
  width: number;
  height: number;
  background: {
    color: string;
    gridSize?: number;
    gridColor?: string;
    gridOpacity?: number;
  };
}

interface FlowMetadata {
  total_steps: number;
  completed_steps: number;
  failed_steps: number;
  running_steps: number;
  pending_steps: number;
  analysis_type: string;
  users_count?: number;
  total_runs?: number;
  detected_columns?: any;
  key_columns?: {
    user: string;
    run: string;
    stage: string;
    status: string;
  };
}

interface IntelligentFlowData {
  nodes: FlowNode[];
  connections: FlowConnection[];
  layout: FlowLayout;
  config: any;
  metadata: FlowMetadata;
}

interface IntelligentFlowVisualizationProps {
  flowData: IntelligentFlowData;
  onAnalyze?: () => void;
  isLoading?: boolean;
}

const IntelligentFlowVisualization: React.FC<IntelligentFlowVisualizationProps> = ({
  flowData,
  onAnalyze,
  isLoading = false
}) => {
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [animatedNodes, setAnimatedNodes] = useState<Set<string>>(new Set());
  const [showGrid, setShowGrid] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const { currentTheme } = useTheme();

  // Extract unique usernames from Run column in nodes
  const extractUniqueUsernames = (): string[] => {
    const usernames = new Set<string>();
    
    flowData?.nodes?.forEach(node => {
      if (node.run && typeof node.run === 'string') {
        // Extract username from run name (e.g., "vinayR1" -> "vinay")
        const match = node.run.match(/^([a-zA-Z]+)/);
        if (match) {
          usernames.add(match[1].toLowerCase());
        }
      }
    });
    
    return Array.from(usernames);
  };

  // Animate nodes on mount
  useEffect(() => {
    if (flowData?.nodes) {
      const timer = setTimeout(() => {
        flowData.nodes.forEach((node, index) => {
          setTimeout(() => {
            setAnimatedNodes(prev => {
              const newSet = new Set(prev);
              newSet.add(node.id);
              return newSet;
            });
          }, index * 100);
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [flowData]);

  // Debug logging
  console.log('IntelligentFlowVisualization received flowData:', flowData);

  if (!flowData) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">No flow data provided</p>
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Analyze Data
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-2">Invalid flow data structure</p>
          <p className="text-sm text-gray-500 mb-4">Expected nodes array, got: {typeof flowData.nodes}</p>
          <div className="text-xs text-gray-400 mb-4">
            <pre className="bg-gray-100 p-2 rounded text-left max-w-md overflow-auto">
              {JSON.stringify(flowData, null, 2).substring(0, 500)}...
            </pre>
          </div>
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Re-analyze Data
            </button>
          )}
        </div>
      </div>
    );
  }

  if (flowData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">No flow nodes found in data</p>
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Re-analyze Data
            </button>
          )}
        </div>
      </div>
    );
  }

  const { nodes, connections = [], layout = {}, metadata = {} } = flowData;

  // Provide safe defaults
  const safeLayout = {
    width: 1200,
    height: 800,
    background: {
      color: '#ffffff',
      gridSize: 20,
      gridColor: '#f0f0f0',
      gridOpacity: 0.5
    },
    ...layout
  };

  const safeMetadata = {
    total_steps: 0,
    completed_steps: 0,
    failed_steps: 0,
    running_steps: 0,
    pending_steps: 0,
    analysis_type: 'unknown',
    users_count: 0,
    total_runs: 0,
    key_columns: undefined,
    ...metadata
  };

  // Calculate SVG viewBox
  const viewBoxWidth = safeLayout.width;
  const viewBoxHeight = safeLayout.height;

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      case 'running': return '#f59e0b';
      case 'pending': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // Create arrow marker
  const createArrowMarker = (id: string, color: string) => (
    <defs>
      <marker
        id={id}
        viewBox="0 0 10 10"
        refX="9"
        refY="3"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
        fill={color}
      >
        <path d="M0,0 L0,6 L9,3 z" />
      </marker>
    </defs>
  );

  return (
    <div className="intelligent-flow-container rounded-lg shadow-lg" style={{
      background: `linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-dark) 50%, var(--color-surface-light) 100%)`,
      border: `2px solid var(--color-border)`,
      borderRadius: '20px',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)',
      backdropFilter: 'blur(15px)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200" style={{
        background: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)`,
        borderRadius: '12px 12px 0 0',
        border: `1px solid var(--color-primary-light)`,
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
      }}>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: '#ffffff', textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}>
                Intelligent Flow Analysis
              </h3>
              <div className="flex flex-wrap gap-4 text-sm">
                <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Total Steps: {safeMetadata.total_steps}</span>
                <span style={{ color: '#10b981' }}>Completed: {safeMetadata.completed_steps}</span>
                <span style={{ color: '#ef4444' }}>Failed: {safeMetadata.failed_steps}</span>
                <span style={{ color: '#f59e0b' }}>Running: {safeMetadata.running_steps}</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Pending: {safeMetadata.pending_steps}</span>
              </div>
            </div>
            
            {/* Display extracted unique usernames from Run column */}
            {extractUniqueUsernames().length > 0 && (
              <div className="extracted-intelligent-users">
                <span className="text-sm font-medium" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                  Run Users:
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {extractUniqueUsernames().map((username) => (
                    <span 
                      key={username}
                      className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: currentTheme === 'light' 
                          ? 'linear-gradient(135deg, #10b981, #059669)' 
                          : 'linear-gradient(135deg, #34d399, #10b981)',
                        color: '#ffffff',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                      }}
                    >
                      {username}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className="px-3 py-1 text-sm rounded transition-colors"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)'
              }}
            >
              {showGrid ? 'Hide Grid' : 'Show Grid'}
            </button>
            {onAnalyze && (
              <button
                onClick={onAnalyze}
                className="px-4 py-2 rounded-lg transition-colors"
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  backdropFilter: 'blur(10px)',
                  fontWeight: '600'
                }}
              >
                Re-analyze
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Flow Visualization */}
      <div className="p-6">
        <div className="relative overflow-auto border border-gray-200 rounded-lg" style={{ height: '600px' }}>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            className="bg-white"
            style={{ minWidth: viewBoxWidth, minHeight: viewBoxHeight }}
          >
            {/* Grid Background */}
            {showGrid && safeLayout.background?.gridSize && (
              <defs>
                <pattern
                  id="grid"
                  width={safeLayout.background.gridSize}
                  height={safeLayout.background.gridSize}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${safeLayout.background.gridSize} 0 L 0 0 0 ${safeLayout.background.gridSize}`}
                    fill="none"
                    stroke={safeLayout.background.gridColor || '#f0f0f0'}
                    strokeWidth="1"
                    opacity={safeLayout.background.gridOpacity || 0.5}
                  />
                </pattern>
              </defs>
            )}
            
            {showGrid && safeLayout.background?.gridSize && (
              <rect width="100%" height="100%" fill="url(#grid)" />
            )}

            {/* Arrow markers for connections */}
            {createArrowMarker('arrow-normal', '#495057')}
            {createArrowMarker('arrow-run', '#007bff')}

            {/* Connections */}
            {connections.map((connection, index) => {
              const fromNode = nodes.find(n => n.id === connection.from);
              const toNode = nodes.find(n => n.id === connection.to);
              
              if (!fromNode || !toNode) return null;

              const fromX = fromNode.x + fromNode.style.width / 2;
              const fromY = fromNode.y + fromNode.style.height / 2;
              const toX = toNode.x + toNode.style.width / 2;
              const toY = toNode.y + toNode.style.height / 2;

              const markerId = connection.type === 'between_runs' ? 'arrow-run' : 'arrow-normal';

              return (
                <motion.line
                  key={`connection-${index}`}
                  x1={fromX}
                  y1={fromY}
                  x2={toX}
                  y2={toY}
                  stroke={connection.style.stroke}
                  strokeWidth={connection.style.strokeWidth}
                  strokeDasharray={connection.style.strokeDasharray}
                  opacity={connection.style.opacity}
                  markerEnd={`url(#${markerId})`}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: connection.style.opacity }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => (
              <motion.g
                key={node.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: animatedNodes.has(node.id) ? 1 : 0, 
                  opacity: animatedNodes.has(node.id) ? 1 : 0 
                }}
                transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setSelectedNode(node)}
              >
                {/* Node Rectangle */}
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.style.width}
                  height={node.style.height}
                  fill={node.style.backgroundColor}
                  rx={node.style.borderRadius}
                  stroke={hoveredNode === node.id ? '#3b82f6' : '#dee2e6'}
                  strokeWidth={hoveredNode === node.id ? 3 : 2}
                  filter={hoveredNode === node.id ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'}
                />
                
                {/* Node Label */}
                <text
                  x={node.x + node.style.width / 2}
                  y={node.y + node.style.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={node.style.color}
                  fontSize={node.style.fontSize}
                  fontWeight="500"
                >
                  {(() => {
                    const addSpacing = (text: string) => {
                      return text
                        .replace(/([a-zA-Z])(\d+)/g, '$1 $2') // Add space between letters and numbers
                        .replace(/(\d+)([a-zA-Z])/g, '$1 $2') // Add space between numbers and letters
                        .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
                        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Add space between consecutive capitals
                        .replace(/\s+/g, ' ') // Clean up multiple spaces
                        .trim();
                    };
                    return addSpacing(node.label.replace(/\b(?:R|RUN|Run|run)(\d+)\b/g, 'RUN$1')).toUpperCase();
                  })()}
                </text>
                
                {/* Status Indicator */}
                <circle
                  cx={node.x + node.style.width - 10}
                  cy={node.y + 10}
                  r="6"
                  fill={getStatusColor(node.status)}
                  stroke="white"
                  strokeWidth="2"
                />
              </motion.g>
            ))}
          </svg>
        </div>
      </div>

      {/* Node Details Modal */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setSelectedNode(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-semibold text-gray-900">Node Details</h4>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700">Stage:</span>
                  <span className="ml-2 text-gray-900">{selectedNode.stage}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">User:</span>
                  <span className="ml-2 text-gray-900">{selectedNode.user}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Run:</span>
                  <span className="ml-2 text-gray-900">{selectedNode.run}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <span 
                    className="ml-2 px-2 py-1 rounded text-sm font-medium"
                    style={{ 
                      backgroundColor: getStatusColor(selectedNode.status) + '20',
                      color: getStatusColor(selectedNode.status)
                    }}
                  >
                    {selectedNode.status}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Type:</span>
                  <span className="ml-2 text-gray-900">{selectedNode.type}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Position:</span>
                  <span className="ml-2 text-gray-900">
                    Run {selectedNode.run_order + 1}, Stage {selectedNode.stage_order + 1}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Status Legend</h4>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-600">Failed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-sm text-gray-600">Running</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-sm text-gray-600">Pending</span>
          </div>
        </div>
        
        {safeMetadata.key_columns && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Detected Columns</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div>User: {safeMetadata.key_columns.user}</div>
              <div>Run: {safeMetadata.key_columns.run}</div>
              <div>Stage: {safeMetadata.key_columns.stage}</div>
              <div>Status: {safeMetadata.key_columns.status}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntelligentFlowVisualization;