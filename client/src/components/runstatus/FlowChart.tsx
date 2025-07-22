import React, { useRef, useEffect, useState } from 'react';
import { FlowChartLayout, FlowChartNode, FlowChartConnection } from '../services/flowtrackService';
import { useTheme } from '../contexts/ThemeContext';

interface FlowChartProps {
  data: FlowChartLayout;
  width?: number;
  height?: number;
}

const FlowChart: React.FC<FlowChartProps> = ({ data, width = 1200, height = 800 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const { currentTheme } = useTheme();

  // Extract unique usernames from Run_name in nodes
  const extractUniqueUsernames = (): string[] => {
    const usernames = new Set<string>();
    
    data?.nodes?.forEach(node => {
      // Check if node has run_name property or similar
      const runName = (node as any).run_name || (node as any).run || (node as any).label;
      if (runName && typeof runName === 'string') {
        // Extract username from run name (e.g., "vinayR1" -> "vinay")
        const match = runName.match(/^([a-zA-Z]+)/);
        if (match) {
          usernames.add(match[1].toLowerCase());
        }
      }
    });
    
    return Array.from(usernames);
  };

  useEffect(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return;

    // Auto-fit the chart to the container
    const layoutWidth = data.layout.width;
    const layoutHeight = data.layout.height;
    
    const scaleX = width / layoutWidth;
    const scaleY = height / layoutHeight;
    const autoZoom = Math.min(scaleX, scaleY, 1) * 0.9; // 90% of the fit
    
    setZoom(autoZoom);
    setPan({
      x: (width - layoutWidth * autoZoom) / 2,
      y: (height - layoutHeight * autoZoom) / 2
    });
  }, [data, width, height]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, zoom * delta));
    setZoom(newZoom);
  };

  const renderArrowMarker = () => (
    <defs>
      <marker
        id="arrowhead"
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polygon
          points="0 0, 10 3.5, 0 7"
          fill="white"
          stroke="white"
          strokeWidth="1"
        />
      </marker>
      <marker
        id="arrowhead-gold"
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polygon
          points="0 0, 10 3.5, 0 7"
          fill="#FFD700"
          stroke="#FFD700"
          strokeWidth="1"
        />
      </marker>
    </defs>
  );

  const renderConnection = (connection: FlowChartConnection) => {
    const fromNode = data.nodes.find(n => n.id === connection.from);
    const toNode = data.nodes.find(n => n.id === connection.to);
    
    if (!fromNode || !toNode) return null;

    const fromX = fromNode.x + fromNode.style.width / 2;
    const fromY = fromNode.y + fromNode.style.height / 2;
    const toX = toNode.x + toNode.style.width / 2;
    const toY = toNode.y + toNode.style.height / 2;

    const isGold = connection.style.stroke === '#FFD700';
    const markerId = isGold ? 'arrowhead-gold' : 'arrowhead';

    if (connection.type === 'curved') {
      // Create curved path for inter-run connections
      const midX = (fromX + toX) / 2;
      const midY = Math.min(fromY, toY) - 50; // Curve upward
      
      return (
        <path
          key={`${connection.from}-${connection.to}`}
          d={`M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`}
          fill="none"
          stroke={connection.style.stroke}
          strokeWidth={connection.style.strokeWidth}
          strokeDasharray={connection.style.strokeDasharray}
          markerEnd={`url(#${markerId})`}
          opacity={0.8}
        />
      );
    } else {
      // Straight line for intra-run connections
      return (
        <line
          key={`${connection.from}-${connection.to}`}
          x1={fromX}
          y1={fromY}
          x2={toX}
          y2={toY}
          stroke={connection.style.stroke}
          strokeWidth={connection.style.strokeWidth}
          strokeDasharray={connection.style.strokeDasharray}
          markerEnd={`url(#${markerId})`}
          opacity={0.8}
        />
      );
    }
  };

  const renderNode = (node: FlowChartNode) => {
    const isSelected = selectedNode === node.id;
    const isHovered = false; // You can add hover state if needed

    return (
      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
        {/* Node background */}
        <rect
          width={node.style.width}
          height={node.style.height}
          fill={node.style.fill}
          stroke={isSelected ? '#FFD700' : node.style.stroke}
          strokeWidth={isSelected ? 4 : node.style.strokeWidth}
          rx={node.style.cornerRadius}
          ry={node.style.cornerRadius}
          style={{
            filter: isSelected ? 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))' : 'none',
            cursor: 'pointer'
          }}
          onClick={() => setSelectedNode(isSelected ? null : node.id)}
        />
        
        {/* Node text */}
        <text
          x={node.style.width / 2}
          y={node.style.height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={node.style.textColor}
          fontSize={node.style.fontSize}
          fontWeight={node.style.fontWeight || 'normal'}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {/* Split long text into multiple lines */}
          {(() => {
            const addSpacing = (text: string) => {
              return text
                .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
                .replace(/(\d+)([a-zA-Z])/g, '$1 $2')
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/\s+/g, ' ')
                .trim();
            };
            const displayLabel = addSpacing(node.label.replace(/\bR(\d+)\b/g, 'RUN$1')).toUpperCase();
            return displayLabel.length > 15 ? (
              <>
                <tspan x={node.style.width / 2} dy="-0.3em">
                  {displayLabel.substring(0, 15)}
                </tspan>
                <tspan x={node.style.width / 2} dy="1.2em">
                  {displayLabel.substring(15)}
                </tspan>
              </>
            ) : (
              displayLabel
            );
          })()}
        </text>
        
        {/* Node type indicator */}
        {node.type === 'block' && (
          <circle
            cx={node.style.width - 10}
            cy={10}
            r={4}
            fill="#FFD700"
            stroke="white"
            strokeWidth={1}
          />
        )}
      </g>
    );
  };

  const renderGrid = () => {
    if (!data.layout.background.gridSize) return null;

    const gridSize = data.layout.background.gridSize;
    const gridLines = [];
    
    // Vertical lines
    for (let x = 0; x <= data.layout.width; x += gridSize) {
      gridLines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={data.layout.height}
          stroke={data.layout.background.gridColor}
          strokeWidth={0.5}
          opacity={data.layout.background.gridOpacity}
        />
      );
    }
    
    // Horizontal lines
    for (let y = 0; y <= data.layout.height; y += gridSize) {
      gridLines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={data.layout.width}
          y2={y}
          stroke={data.layout.background.gridColor}
          strokeWidth={0.5}
          opacity={data.layout.background.gridOpacity}
        />
      );
    }
    
    return <g>{gridLines}</g>;
  };

  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
            No Flow Chart Data
          </div>
          <div style={{ color: 'var(--color-text-muted)' }}>
            Please analyze a file to generate the flow chart visualization.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Header with extracted usernames */}
      {extractUniqueUsernames().length > 0 && (
        <div className="absolute top-4 left-4 z-10 p-3 rounded-lg" style={{
          background: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)`,
          border: `1px solid var(--color-primary-light)`,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(10px)'
        }}>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Flow Users:
            </span>
            <div className="flex flex-wrap gap-1">
              {extractUniqueUsernames().map((username) => (
                <span 
                  key={username}
                  className="px-2 py-1 rounded text-xs font-semibold"
                  style={{
                    background: currentTheme === 'light' 
                      ? 'linear-gradient(135deg, #10b981, #059669)' 
                      : 'linear-gradient(135deg, #34d399, #10b981)',
                    color: '#ffffff',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  {username}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
        <button
          onClick={() => setZoom(zoom * 1.2)}
          className="px-3 py-1 rounded text-sm"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)'
          }}
        >
          Zoom In
        </button>
        <button
          onClick={() => setZoom(zoom * 0.8)}
          className="px-3 py-1 rounded text-sm"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)'
          }}
        >
          Zoom Out
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="px-3 py-1 rounded text-sm"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)'
          }}
        >
          Reset
        </button>
      </div>

      {/* Selected node info */}
      {selectedNode && (
        <div className="absolute top-4 left-4 z-10 p-3 rounded-lg max-w-xs"
             style={{
               backgroundColor: 'var(--color-surface)',
               border: '1px solid var(--color-border)',
               boxShadow: '0 4px 6px var(--color-shadow)'
             }}>
          {(() => {
            const node = data.nodes.find(n => n.id === selectedNode);
            if (!node) return null;
            
            return (
              <div>
                <div className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                  {(() => {
                    const addSpacing = (text: string) => {
                      return text
                        .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
                        .replace(/(\d+)([a-zA-Z])/g, '$1 $2')
                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                        .replace(/\s+/g, ' ')
                        .trim();
                    };
                    return addSpacing(node.label.replace(/\bR(\d+)\b/g, 'RUN$1')).toUpperCase();
                  })()}
                </div>
                <div className="text-sm space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                  <div>Type: {node.type}</div>
                  {node.stage && <div>Stage: {node.stage}</div>}
                  {node.user && <div>User: {node.user}</div>}
                  {node.run && <div>Run: {node.run}</div>}
                  {node.sheet && <div>Sheet: {node.sheet}</div>}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ backgroundColor: data.layout.background.color }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {renderArrowMarker()}
        
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Grid */}
          {renderGrid()}
          
          {/* Connections (render first so they appear behind nodes) */}
          {data.connections.map(renderConnection)}
          
          {/* Nodes */}
          {data.nodes.map(renderNode)}
        </g>
      </svg>
    </div>
  );
};

export default FlowChart;