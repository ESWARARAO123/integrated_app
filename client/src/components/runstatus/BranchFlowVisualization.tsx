import React, { useRef, useEffect, useState } from 'react';
import { BranchFlowData, BranchNode, BranchConnection } from '../../services/flowtrackService';
import './BranchFlowVisualization.css';

interface BranchFlowVisualizationProps {
  data: BranchFlowData;
  className?: string;
}

const BranchFlowVisualization: React.FC<BranchFlowVisualizationProps> = ({ data, className = '' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<BranchNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data || !data.nodes || data.nodes.length === 0) {
      console.log('BranchFlowVisualization: No data or nodes to render', { data });
      return;
    }

    const svg = svgRef.current;
    console.log('BranchFlowVisualization: Rendering with data', { 
      nodes: data.nodes.length, 
      connections: data.connections.length,
      layout: data.layout 
    });
    
    // Clear previous content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Create definitions for gradients and patterns
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    // Grid pattern
    const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', 'grid');
    pattern.setAttribute('width', data.layout.background.gridSize.toString());
    pattern.setAttribute('height', data.layout.background.gridSize.toString());
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${data.layout.background.gridSize} 0 L 0 0 0 ${data.layout.background.gridSize}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#f5f5f5'); // Very light gray grid for subtle appearance
    path.setAttribute('stroke-width', '1');
    path.setAttribute('opacity', '0.3'); // More subtle visibility
    
    pattern.appendChild(path);
    defs.appendChild(pattern);

    // Branch glow filter
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'branch-glow');
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');
    
    const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    feGaussianBlur.setAttribute('stdDeviation', '3');
    feGaussianBlur.setAttribute('result', 'coloredBlur');
    
    const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    feMergeNode1.setAttribute('in', 'coloredBlur');
    const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    feMergeNode2.setAttribute('in', 'SourceGraphic');
    
    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);
    filter.appendChild(feGaussianBlur);
    filter.appendChild(feMerge);
    defs.appendChild(filter);

    svg.appendChild(defs);

    // Background - Override to white
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    background.setAttribute('width', (data.layout.width + 300).toString());
    background.setAttribute('height', data.layout.height.toString());
    background.setAttribute('fill', '#ffffff'); // Force white background
    svg.appendChild(background);

    // Grid
    const gridRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    gridRect.setAttribute('width', (data.layout.width + 300).toString());
    gridRect.setAttribute('height', data.layout.height.toString());
    gridRect.setAttribute('fill', 'url(#grid)');
    svg.appendChild(gridRect);

    // Draw connections first (so they appear behind nodes)
    data.connections.forEach((connection: BranchConnection) => {
      const fromNode = data.nodes.find(n => n.id === connection.from);
      const toNode = data.nodes.find(n => n.id === connection.to);
      
      if (!fromNode || !toNode) return;

      // Calculate connection points at node edges for better arrow visibility (account for shifted positions)
      const fromCenterX = (fromNode.x + 250) + fromNode.style.width / 2; // Add shift offset
      const fromCenterY = fromNode.y + fromNode.style.height / 2;
      const toCenterX = (toNode.x + 250) + toNode.style.width / 2; // Add shift offset
      const toCenterY = toNode.y + toNode.style.height / 2;

      // Calculate edge points to position arrows outside nodes
      const dx = toCenterX - fromCenterX;
      const dy = toCenterY - fromCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Normalize direction vector
      const dirX = dx / distance;
      const dirY = dy / distance;

      // Start from edge of source node
      const fromX = fromCenterX + dirX * (fromNode.style.width / 2);
      const fromY = fromCenterY + dirY * (fromNode.style.height / 2);

      // End at edge of target node (with larger offset for arrow visibility)
      const arrowOffset = 25; // Increased pixels to offset arrow from node edge for better visibility
      const toX = toCenterX - dirX * (toNode.style.width / 2 + arrowOffset);
      const toY = toCenterY - dirY * (toNode.style.height / 2 + arrowOffset);

      if (connection.type === 'curved') {
        // Curved connection for branches
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midX = (fromX + toX) / 2;
        const midY = fromY + (toY - fromY) * 0.3;
        
        const d = `M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`;
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');

        // Use lighter colors for connections with better visibility
        let strokeColor = connection.style.stroke;
        if (connection.connection_category === 'branch') {
          strokeColor = '#ffcc02'; // Bright amber for branch connections
        } else {
          strokeColor = '#42a5f5'; // Bright blue for linear connections
        }

        path.setAttribute('stroke', strokeColor);
        path.setAttribute('stroke-width', connection.style.strokeWidth.toString());
        if (connection.style.strokeDasharray) {
          path.setAttribute('stroke-dasharray', connection.style.strokeDasharray);
        }

        // Use appropriate arrow marker based on connection type
        if (connection.connection_category === 'branch') {
          path.setAttribute('marker-end', 'url(#arrowhead)');
          path.setAttribute('filter', 'url(#branch-glow)');
        } else {
          path.setAttribute('marker-end', 'url(#arrowhead-linear)');
        }
        
        svg.appendChild(path);
      } else {
        // Straight connection
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromX.toString());
        line.setAttribute('y1', fromY.toString());
        line.setAttribute('x2', toX.toString());
        line.setAttribute('y2', toY.toString());
        // Use pure black for all connection lines
        line.setAttribute('stroke', '#000000'); // Pure black for all connection lines
        line.setAttribute('stroke-width', '1.5'); // Thin but visible line
        if (connection.style.strokeDasharray) {
          line.setAttribute('stroke-dasharray', connection.style.strokeDasharray);
        }

        // Use appropriate arrow marker based on connection type
        if (connection.connection_category === 'branch') {
          line.setAttribute('marker-end', 'url(#arrowhead)');
        } else {
          line.setAttribute('marker-end', 'url(#arrowhead-linear)');
        }
        
        svg.appendChild(line);
      }
    });

    // Arrow marker - Smaller, cleaner arrow head
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '6');  // Smaller arrow head
    marker.setAttribute('markerHeight', '6');  // Smaller arrow head
    marker.setAttribute('refX', '5');  // Adjusted reference point
    marker.setAttribute('refY', '3');  // Centered
    marker.setAttribute('orient', 'auto');

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 6 3, 0 6');  // Smaller, cleaner arrow
    polygon.setAttribute('fill', '#000000');  // Pure black
    polygon.setAttribute('stroke', '#000000');  // Pure black
    polygon.setAttribute('stroke-width', '1');

    marker.appendChild(polygon);
    defs.appendChild(marker);

    // Create a second marker for linear connections - Smaller, cleaner arrow head
    const markerLinear = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    markerLinear.setAttribute('id', 'arrowhead-linear');
    markerLinear.setAttribute('markerWidth', '6');  // Smaller arrow head
    markerLinear.setAttribute('markerHeight', '6');  // Smaller arrow head
    markerLinear.setAttribute('refX', '5');  // Adjusted reference point
    markerLinear.setAttribute('refY', '3');  // Centered
    markerLinear.setAttribute('orient', 'auto');

    const polygonLinear = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygonLinear.setAttribute('points', '0 0, 6 3, 0 6');  // Smaller, cleaner arrow
    polygonLinear.setAttribute('fill', '#000000');  // Pure black
    polygonLinear.setAttribute('stroke', '#000000');  // Pure black
    polygonLinear.setAttribute('stroke-width', '1');

    markerLinear.appendChild(polygonLinear);
    defs.appendChild(markerLinear);





    // Add RUN Number Column Header as the first column
    const runColumnX = 150; // Position for RUN column
    const runHeaderY = 20;

    // Create RUN column header background (matching other headers)
    const runHeaderBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    runHeaderBg.setAttribute('x', (runColumnX - 60).toString());
    runHeaderBg.setAttribute('y', (runHeaderY - 5).toString());
    runHeaderBg.setAttribute('width', '120');
    runHeaderBg.setAttribute('height', '25');
    runHeaderBg.setAttribute('fill', '#f8f9fa'); // Same as other headers
    runHeaderBg.setAttribute('stroke', '#dee2e6'); // Same as other headers
    runHeaderBg.setAttribute('stroke-width', '1');
    runHeaderBg.setAttribute('rx', '4');
    runHeaderBg.setAttribute('ry', '4');
    svg.appendChild(runHeaderBg);

    // Create RUN column header text (matching other headers)
    const runHeaderText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    runHeaderText.setAttribute('x', runColumnX.toString());
    runHeaderText.setAttribute('y', (runHeaderY + 10).toString());
    runHeaderText.setAttribute('text-anchor', 'middle');
    runHeaderText.setAttribute('dominant-baseline', 'middle');
    runHeaderText.setAttribute('font-size', '12');
    runHeaderText.setAttribute('font-weight', 'bold');
    runHeaderText.setAttribute('font-family', 'Roboto, Arial, sans-serif');
    runHeaderText.setAttribute('fill', '#374151'); // Same as other headers
    runHeaderText.textContent = 'RUN';
    svg.appendChild(runHeaderText);

    // Add separator line between RUN column and main content
    const separatorLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    separatorLine.setAttribute('x1', '220'); // Right edge of RUN column
    separatorLine.setAttribute('y1', '0');
    separatorLine.setAttribute('x2', '220');
    separatorLine.setAttribute('y2', (data.layout?.height || 600).toString());
    separatorLine.setAttribute('stroke', '#e2e8f0');
    separatorLine.setAttribute('stroke-width', '2');
    separatorLine.setAttribute('stroke-dasharray', '5,5');
    separatorLine.setAttribute('opacity', '0.7');
    svg.appendChild(separatorLine);

    // Draw column headers if metadata is available
    if (data.metadata && data.metadata.stage_names && data.metadata.stage_names.length > 0) {
      const headerY = 20; // Position headers at the top
      const nodeWidth = data.nodes.length > 0 ? data.nodes[0].style.width : 120;

      // Calculate actual column positions based on node positions (offset by RUN column width)
      const uniqueXPositions = Array.from(new Set(data.nodes.map(node => (node.x + 250) + node.style.width / 2))).sort((a, b) => a - b);
      
      data.metadata.stage_names.forEach((stageName, index) => {
        // Use actual node positions for header alignment
        const headerX = uniqueXPositions[index] || (50 + (index * 150) + (nodeWidth / 2));

        // Create header background
        const headerBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        headerBg.setAttribute('x', (headerX - 60).toString());
        headerBg.setAttribute('y', (headerY - 5).toString());
        headerBg.setAttribute('width', '120');
        headerBg.setAttribute('height', '25');
        headerBg.setAttribute('fill', '#f8f9fa');
        headerBg.setAttribute('stroke', '#dee2e6');
        headerBg.setAttribute('stroke-width', '1');
        headerBg.setAttribute('rx', '4');
        headerBg.setAttribute('ry', '4');
        svg.appendChild(headerBg);

        // Create header text - MAKE IT CAPITAL
        const headerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        headerText.setAttribute('x', headerX.toString());
        headerText.setAttribute('y', (headerY + 10).toString());
        headerText.setAttribute('text-anchor', 'middle');
        headerText.setAttribute('dominant-baseline', 'middle');
        headerText.setAttribute('font-size', '12');
        headerText.setAttribute('font-weight', 'bold');
        headerText.setAttribute('font-family', 'Roboto, Arial, sans-serif');
        headerText.setAttribute('fill', '#374151'); // Darker gray for better readability
        const addSpacing = (text: string) => {
          return text
            .replace(/([a-zA-Z])(\d+)/g, '$1 $2') // Add space between letters and numbers
            .replace(/(\d+)([a-zA-Z])/g, '$1 $2') // Add space between numbers and letters
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Add space between consecutive capitals
            .replace(/\s+/g, ' ') // Clean up multiple spaces
            .trim();
        };
        const displayName = addSpacing(stageName.replace(/\b(?:R|RUN|Run|run)(\d+)\b/g, 'RUN$1')).toUpperCase(); // CONVERT TO CAPITAL AND REPLACE R WITH RUN
        headerText.textContent = displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName;

        // Add tooltip for full name if truncated
        if (displayName.length > 12) {
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
          title.textContent = displayName;
          headerText.appendChild(title);
        }

        svg.appendChild(headerText);
      });

      // Draw visible dotted separator lines between columns using actual positions
      const layoutHeight = data.layout?.height || 600;
      for (let i = 1; i < uniqueXPositions.length; i++) {
        const currentX = uniqueXPositions[i];
        const prevX = uniqueXPositions[i - 1];
        const separatorX = prevX + ((currentX - prevX) / 2); // Midpoint between columns

        const separatorLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        separatorLine.setAttribute('x1', separatorX.toString());
        separatorLine.setAttribute('y1', '50'); // Start below headers
        separatorLine.setAttribute('x2', separatorX.toString());
        separatorLine.setAttribute('y2', (layoutHeight - 50).toString()); // End near bottom
        separatorLine.setAttribute('stroke', '#2d3748'); // Light black color - more visible
        separatorLine.setAttribute('stroke-width', '1.5'); // Slightly thicker for visibility
        separatorLine.setAttribute('stroke-dasharray', '6,4'); // More visible dotted pattern
        separatorLine.setAttribute('opacity', '0.7'); // More visible

        svg.appendChild(separatorLine);
      }
    } else if (data.nodes && data.nodes.length > 0) {
      // If no metadata, try to infer column positions from node positions (account for shift)
      const uniqueXPositions = Array.from(new Set(data.nodes.map(node => (node.x + 250) + node.style.width / 2))).sort((a, b) => a - b);
      const layoutHeight = data.layout?.height || 600;

      // Draw visible separator lines between unique X positions
      for (let i = 1; i < uniqueXPositions.length; i++) {
        const currentX = uniqueXPositions[i];
        const prevX = uniqueXPositions[i - 1];
        const separatorX = prevX + ((currentX - prevX) / 2); // Midpoint between columns

        const separatorLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        separatorLine.setAttribute('x1', separatorX.toString());
        separatorLine.setAttribute('y1', '50');
        separatorLine.setAttribute('x2', separatorX.toString());
        separatorLine.setAttribute('y2', (layoutHeight - 50).toString());
        separatorLine.setAttribute('stroke', '#2d3748'); // Light black color - more visible
        separatorLine.setAttribute('stroke-width', '1.5'); // Slightly thicker for visibility
        separatorLine.setAttribute('stroke-dasharray', '6,4'); // More visible dotted pattern
        separatorLine.setAttribute('opacity', '0.7'); // More visible

        svg.appendChild(separatorLine);
      }
    }

    // Group nodes by Y position (rows) and add RUN indicators - IMPROVED DETECTION
    const nodesByRow = new Map<number, BranchNode[]>();
    data.nodes.forEach((node: BranchNode) => {
      const rowKey = Math.round(node.y / 20) * 20; // Better grouping with larger tolerance
      if (!nodesByRow.has(rowKey)) {
        nodesByRow.set(rowKey, []);
      }
      nodesByRow.get(rowKey)!.push(node);
    });

    // Add RUN number indicators for each row - ENHANCED DETECTION
    Array.from(nodesByRow.entries()).forEach(([rowY, rowNodes]) => {
      // Enhanced RUN number detection - try multiple patterns
      let maxRunNumber = 0;
      let foundRunNumber = false;

      rowNodes.forEach(node => {
        // Try multiple patterns to detect RUN numbers
        const patterns = [
          /\b(?:R|RUN|Run|run)(\d+)\b/i,           // R1, RUN1, Run1, run1
          /\b([A-Za-z]+)(\d+)\b/,                  // CTS5, PLACE3, ROUTE2, etc.
          /(\d+)$/,                                // Numbers at the end
          /\b\w*(\d+)\w*\b/                       // Any word containing numbers
        ];

        for (const pattern of patterns) {
          const match = node.label.match(pattern);
          if (match) {
            const runNumber = parseInt(match[match.length - 1]); // Get the last captured group (the number)
            if (!isNaN(runNumber) && runNumber > 0) {
              maxRunNumber = Math.max(maxRunNumber, runNumber);
              foundRunNumber = true;
              break; // Found a valid number, stop trying other patterns
            }
          }
        }
      });

      // Only create indicator if we found a valid RUN number
      if (foundRunNumber && maxRunNumber > 0) {
        console.log(`Creating RUN indicator for row ${rowY}: RUN${maxRunNumber}`); // Debug log

        // Calculate the center Y position of all nodes in this row for better alignment
        const avgNodeY = rowNodes.reduce((sum, node) => sum + node.y, 0) / rowNodes.length;
        const nodeHeight = rowNodes.length > 0 ? rowNodes[0].style.height : 24;
        const centerY = avgNodeY + (nodeHeight / 2);

        // Create RUN indicator background for this row (matching header style) - ALIGNED WITH NODES
        const runIndicatorBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        runIndicatorBg.setAttribute('x', '90'); // Position in RUN column
        runIndicatorBg.setAttribute('y', (centerY - 12).toString()); // Align with node center
        runIndicatorBg.setAttribute('width', '120');
        runIndicatorBg.setAttribute('height', '24');
        runIndicatorBg.setAttribute('fill', '#f8f9fa'); // Same as headers
        runIndicatorBg.setAttribute('stroke', '#dee2e6'); // Same as headers
        runIndicatorBg.setAttribute('stroke-width', '1');
        runIndicatorBg.setAttribute('rx', '4');
        runIndicatorBg.setAttribute('ry', '4');
        svg.appendChild(runIndicatorBg);

        // Create RUN indicator text (matching header style) - ALIGNED WITH NODES
        const runIndicatorText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        runIndicatorText.setAttribute('x', '150'); // Center in RUN column
        runIndicatorText.setAttribute('y', centerY.toString()); // Align with node center
        runIndicatorText.setAttribute('text-anchor', 'middle');
        runIndicatorText.setAttribute('dominant-baseline', 'middle');
        runIndicatorText.setAttribute('font-size', '12');
        runIndicatorText.setAttribute('font-weight', 'bold');
        runIndicatorText.setAttribute('font-family', 'Roboto, Arial, sans-serif');
        runIndicatorText.setAttribute('fill', '#374151'); // Same as headers
        runIndicatorText.textContent = `RUN${maxRunNumber}`;
        svg.appendChild(runIndicatorText);
      }
    });

    // Draw nodes
    data.nodes.forEach((node: BranchNode) => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'branch-node');
      group.setAttribute('data-node-id', node.id);
      
      // Node rectangle with light colors (shifted right to make space for RUN column)
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const shiftedX = node.x + 250; // Shift right by 250px to make space for RUN column
      rect.setAttribute('x', shiftedX.toString());
      rect.setAttribute('y', node.y.toString());
      rect.setAttribute('width', node.style.width.toString());
      rect.setAttribute('height', node.style.height.toString());

      // Apply simple light color scheme
      let fillColor: string, strokeColor: string;

      if (node.is_branch) {
        fillColor = '#fef7e0'; // Very light warm yellow for branch nodes
        strokeColor = '#d69e2e'; // Muted orange for branch stroke
      } else {
        fillColor = '#ebf8ff'; // Very light cool blue for linear nodes
        strokeColor = '#3182ce'; // Muted blue for linear stroke
      }

      rect.setAttribute('fill', fillColor);
      rect.setAttribute('stroke', strokeColor);
      rect.setAttribute('stroke-width', node.style.strokeWidth.toString());
      rect.setAttribute('rx', node.style.cornerRadius.toString());
      rect.setAttribute('ry', node.style.cornerRadius.toString());
      
      if (node.is_branch) {
        rect.setAttribute('filter', 'url(#branch-glow)');
      }
      
      group.appendChild(rect);
      
      // Node text with enhanced styling - BLACK, THICK, BOLD with better visibility - MAKE IT CAPITAL
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', (shiftedX + node.style.width / 2).toString());
      text.setAttribute('y', (node.y + node.style.height / 2 + 5).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#000000'); // Pure black text
      text.setAttribute('font-size', '14'); // Standard readable size
      text.setAttribute('font-weight', 'bold'); // Bold weight
      text.setAttribute('font-family', 'Roboto, Arial, sans-serif'); // Roboto font
      // Remove all stroke and shadow effects for clean text
      // Improved spacing function for better text formatting
      const addSpacing = (text: string) => {
        return text
          .replace(/([a-zA-Z])(\d+)/g, '$1 $2') // Add space between letters and numbers
          .replace(/(\d+)([a-zA-Z])/g, '$1 $2') // Add space between numbers and letters
          .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
          .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Add space between consecutive capitals
          .replace(/\s+/g, ' ') // Clean up multiple spaces
          .trim();
      };
      // Replace various run patterns and add spacing
      const displayLabel = addSpacing(node.label.replace(/\b(?:R|RUN|Run|run)(\d+)\b/g, 'RUN$1')).toUpperCase();
      text.textContent = displayLabel; // CONVERT TO CAPITAL LETTERS
      
      group.appendChild(text);

      // Add animated "COPIED" tooltip only for nodes with incoming connections from different RUNs - ENHANCED DETECTION
      const incomingConnections = data.connections.filter(conn => conn.to === node.id);
      const hasInterRunConnection = incomingConnections.some(conn => {
        const fromNode = data.nodes.find(n => n.id === conn.from);
        if (!fromNode) return false;

        // Enhanced RUN number extraction function
        const extractRunNumber = (label: string): number | null => {
          const patterns = [
            /\b(?:R|RUN|Run|run)(\d+)\b/i,           // R1, RUN1, Run1, run1
            /\b([A-Za-z]+)(\d+)\b/,                  // CTS5, PLACE3, ROUTE2, etc.
            /(\d+)$/,                                // Numbers at the end
            /\b\w*(\d+)\w*\b/                       // Any word containing numbers
          ];

          for (const pattern of patterns) {
            const match = label.match(pattern);
            if (match) {
              const runNumber = parseInt(match[match.length - 1]); // Get the last captured group (the number)
              if (!isNaN(runNumber) && runNumber > 0) {
                return runNumber;
              }
            }
          }
          return null;
        };

        // Extract run numbers from both nodes
        const fromRunNumber = extractRunNumber(fromNode.label);
        const toRunNumber = extractRunNumber(node.label);

        // Check if both nodes have run numbers and they are different
        if (fromRunNumber !== null && toRunNumber !== null) {
          return fromRunNumber !== toRunNumber;
        }

        return false;
      });
      
      if (hasInterRunConnection) {
        // Create animated tooltip group
        const tooltipGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        tooltipGroup.setAttribute('class', 'copied-tooltip');
        tooltipGroup.setAttribute('opacity', '0');
        tooltipGroup.setAttribute('transform', `translate(${shiftedX + node.style.width + 10}, ${node.y - 10})`);
        
        // Create tooltip background
        const tooltipBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        tooltipBg.setAttribute('x', '0');
        tooltipBg.setAttribute('y', '0');
        tooltipBg.setAttribute('width', '60');
        tooltipBg.setAttribute('height', '20');
        tooltipBg.setAttribute('fill', '#2d3748');
        tooltipBg.setAttribute('stroke', '#4a5568');
        tooltipBg.setAttribute('stroke-width', '1');
        tooltipBg.setAttribute('rx', '4');
        tooltipBg.setAttribute('ry', '4');
        tooltipGroup.appendChild(tooltipBg);
        
        // Create tooltip text
        const tooltipText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tooltipText.setAttribute('x', '30');
        tooltipText.setAttribute('y', '14');
        tooltipText.setAttribute('text-anchor', 'middle');
        tooltipText.setAttribute('fill', '#ffffff');
        tooltipText.setAttribute('font-size', '10');
        tooltipText.setAttribute('font-weight', 'bold');
        tooltipText.setAttribute('font-family', 'Roboto, Arial, sans-serif');
        tooltipText.textContent = 'COPIED';
        tooltipGroup.appendChild(tooltipText);
        
        svg.appendChild(tooltipGroup);
        
        // Add hover animations - removed scaling to prevent vibration
        group.addEventListener('mouseenter', () => {
          tooltipGroup.setAttribute('opacity', '1');
          tooltipGroup.style.transition = 'opacity 0.3s ease';
          tooltipGroup.setAttribute('transform', `translate(${shiftedX + node.style.width + 10}, ${node.y - 10})`);
        });

        group.addEventListener('mouseleave', () => {
          tooltipGroup.setAttribute('opacity', '0');
          tooltipGroup.setAttribute('transform', `translate(${shiftedX + node.style.width + 10}, ${node.y - 10})`);
        });
      }
      
      // Add event listeners
      group.addEventListener('mouseenter', () => setHoveredNode(node.id));
      group.addEventListener('mouseleave', () => setHoveredNode(null));
      group.addEventListener('click', () => setSelectedNode(node));
      
      svg.appendChild(group);
    });

  }, [data]);

  // No zoom controls - just scrollable as requested

  const closeNodeDetails = () => {
    setSelectedNode(null);
  };

  // Handle case where data is not available
  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <div className={`branch-flow-container ${className}`}>
        <div className="branch-flow-header">
          <h3 className="text-lg font-semibold text-white mb-2">Branch Flow Visualization</h3>
        </div>
        <div className="branch-flow-content">
          <div className="text-center py-16">
            <div className="flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{
                backgroundColor: 'var(--color-warning-10)',
                color: 'var(--color-warning)'
              }}>
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>No Branch Data Available</h3>
              <p style={{ color: 'var(--color-text-muted)' }}>
                The analysis did not find any branching patterns in the selected data.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`branch-flow-container ${className}`}>
      <div className="branch-flow-header">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-white">Branch Flow Visualization</h3>
          {data.metadata?.username && data.metadata.username !== 'Unknown User' && (
            <div className="user-info">
              <span className="text-sm text-gray-300">User: </span>
              <span className="text-sm font-semibold text-white bg-blue-600 px-2 py-1 rounded">
                {data.metadata.username}
              </span>
            </div>
          )}
        </div>
        <div className="branch-flow-legend">
          <div className="legend-item">
            <div className="legend-color linear"></div>
            <span>Linear Flow</span>
          </div>
          <div className="legend-item">
            <div className="legend-color branch"></div>
            <span>Branch Flow</span>
          </div>
          <div className="legend-item">
            <div className="legend-line curved"></div>
            <span>Branch Connection</span>
          </div>
        </div>
      </div>
      
      <div className="branch-flow-content" ref={containerRef}>
        <svg
          ref={svgRef}
          width={(data.layout?.width || 800) + 500} // Increased width for RUN column
          height={data.layout?.height || 600}
          className="branch-flow-svg"
          viewBox={`0 0 ${(data.layout?.width || 800) + 500} ${data.layout?.height || 600}`} // Increased viewBox for RUN column
        />
        
        {selectedNode && (
          <div className="node-details-panel">
            <div className="node-details-header">
              <h4>{selectedNode.label}</h4>
              <button onClick={closeNodeDetails} className="close-button">×</button>
            </div>
            <div className="node-details-content">
              <div className="detail-row">
                <span className="detail-label">Run:</span>
                <span className="detail-value">{selectedNode.run}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Stage:</span>
                <span className="detail-value">{selectedNode.stage}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Value:</span>
                <span className="detail-value">{selectedNode.value}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className={`detail-value ${selectedNode.is_branch ? 'branch' : 'linear'}`}>
                  {selectedNode.is_branch ? 'Branch Node' : 'Linear Node'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {data.debug_info && (
        <div className="branch-flow-debug">
          <h4>Analysis Summary</h4>
          <div className="debug-stats">
            <span>Runs: {data.debug_info.runs_processed}</span>
            <span>Branch Runs: {data.debug_info.branch_runs.length}</span>
            <span>Linear Runs: {data.debug_info.linear_runs.length}</span>
            <span>Total Stages: {data.debug_info.total_stages}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchFlowVisualization;