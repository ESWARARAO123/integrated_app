import React, { useState } from 'react';
import './SimpleFlowVisualization.css';

interface FlowStep {
  id: string;
  position: number;
  column_name: string;
  value: string;
  display_value: string;
  is_first: boolean;
  is_last: boolean;
}

interface HeaderFlow {
  id: string;
  type: 'header';
  initial_value: string;
  initial_display: string;
  complete_flow: FlowStep[];
}

interface DataRow {
  id: string;
  row_number: number;
  type: 'data';
  initial_value: string;
  initial_display: string;
  complete_flow: FlowStep[];
}

interface FlowData {
  table_name: string;
  total_columns: number;
  total_rows: number;
  header_flow: HeaderFlow;
  data_rows: DataRow[];
  metadata: {
    analyzed_at: string;
    total_rows_analyzed: number;
    analysis_type: string;
    description: string;
  };
}

interface SimpleFlowVisualizationProps {
  flowData: FlowData;
  onAnalyze?: () => void;
  isLoading?: boolean;
}

const SimpleFlowVisualization: React.FC<SimpleFlowVisualizationProps> = ({
  flowData,
  onAnalyze,
  isLoading = false
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [animatingSteps, setAnimatingSteps] = useState<Set<string>>(new Set());

  const handleItemClick = (itemId: string, itemType: 'header' | 'data') => {
    const newExpandedItems = new Set(expandedItems);
    
    if (expandedItems.has(itemId)) {
      // Collapse
      newExpandedItems.delete(itemId);
      setExpandedItems(newExpandedItems);
      setAnimatingSteps(new Set()); // Clear animations
    } else {
      // Expand
      newExpandedItems.add(itemId);
      setExpandedItems(newExpandedItems);
      
      // Animate steps one by one
      let flowToAnimate;
      if (itemType === 'header') {
        flowToAnimate = flowData.header_flow;
      } else {
        flowToAnimate = flowData.data_rows.find(r => r.id === itemId);
      }
      
      if (flowToAnimate) {
        flowToAnimate.complete_flow.forEach((step, index) => {
          setTimeout(() => {
            setAnimatingSteps(prev => {
              const newSet = new Set(prev);
              newSet.add(step.id);
              return newSet;
            });
          }, index * 150); // 150ms delay between each step
        });
      }
    }
  };

  if (!flowData) {
    return (
      <div className="simple-flow-container">
        <div className="flow-header">
          <h3>Data Flow Analysis</h3>
          <button 
            onClick={onAnalyze}
            disabled={isLoading}
            className="analyze-button"
          >
            {isLoading ? 'Analyzing...' : 'Analyze Data'}
          </button>
        </div>
        <div className="no-data-message">
          <p>No data analyzed yet. Click "Analyze Data" to generate flow visualization.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="simple-flow-container">
      <div className="flow-header">
        <h3>Vertical Header + Data Flow Analysis</h3>
        <div className="flow-info">
          <span className="table-name">Table: <strong>{flowData.table_name}</strong></span>
          <span className="column-count">Columns: <strong>{flowData.total_columns}</strong></span>
          <span className="row-count">Rows: <strong>{flowData.total_rows}</strong></span>
        </div>
      </div>

      <div className="flow-content">
        <div className="vertical-flow-layout">
          {/* RUN Number Indicators on the left */}
          {(() => {
            // Extract RUN numbers from flow data - Automated detection
            const runNumbers = new Map<string, number>();
            const allSteps = [
              ...flowData.header_flow.complete_flow,
              ...flowData.data_rows.flatMap(row => row.complete_flow)
            ];

            allSteps.forEach(step => {
              // Look for various patterns: R1, RUN1, Run1, r1, etc.
              const runMatch = step.display_value.match(/\b(?:R|RUN|Run|run)(\d+)\b/i);
              if (runMatch) {
                const runNumber = parseInt(runMatch[1]);
                const runKey = `RUN${runNumber}`;
                runNumbers.set(runKey, runNumber);
              }
            });

            // Display RUN indicators if any found
            if (runNumbers.size > 0) {
              const sortedRuns = Array.from(runNumbers.entries()).sort((a, b) => a[1] - b[1]);
              return (
                <div className="run-indicators">
                  {sortedRuns.map(([runNum, runNumber], index) => {
                    // Get steps for this RUN and display their names with proper spacing
                    const runSteps = allSteps.filter(step => {
                      const stepRunMatch = step.display_value.match(/\b(?:R|RUN|Run|run)(\d+)\b/i);
                      return stepRunMatch && parseInt(stepRunMatch[1]) === runNumber;
                    });

                    if (runSteps.length > 0) {
                      const stepNames = runSteps.map(step => {
                        // Clean the label by removing RUN patterns and common separators
                        let cleanLabel = step.display_value.replace(/\b(?:R|RUN|Run|run)\d+\b/gi, '');
                        cleanLabel = cleanLabel.replace(/^[-_\s]+|[-_\s]+$/g, '');
                        cleanLabel = cleanLabel.replace(/[-_]+/g, ' ');

                        if (cleanLabel.trim()) {
                          const addSpacing = (text: string) => {
                            return text
                              .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
                              .replace(/(\d+)([a-zA-Z])/g, '$1 $2')
                              .replace(/([a-z])([A-Z])/g, '$1 $2')
                              .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
                              .replace(/\s+/g, ' ')
                              .trim();
                          };
                          return addSpacing(cleanLabel).toUpperCase();
                        }

                        // If no clean label found, try to extract meaningful parts
                        const parts = step.display_value.split(/[_\-\s]+/);
                        const meaningfulParts = parts.filter(part =>
                          part.length > 0 &&
                          !part.match(/^(?:R|RUN|Run|run)\d+$/i)
                        );

                        const addSpacing = (text: string) => {
                          return text
                            .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
                            .replace(/(\d+)([a-zA-Z])/g, '$1 $2')
                            .replace(/([a-z])([A-Z])/g, '$1 $2')
                            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
                            .replace(/\s+/g, ' ')
                            .trim();
                        };

                        return meaningfulParts.length > 0 ?
                          addSpacing(meaningfulParts.join(' ')).toUpperCase() :
                          addSpacing(step.display_value).toUpperCase();
                      }).filter(name => name.length > 0);

                      // Remove duplicates and join
                      const uniqueNames = Array.from(new Set(stepNames));
                      const stepNamesText = uniqueNames.join(', ');

                      return (
                        <div key={runNum} className="run-indicator" style={{ top: `${80 + (index * 60)}px` }}>
                          <div className="run-indicator-bg">
                            <span className="run-number">{runNum}</span>
                          </div>
                          <div className="run-steps-text">
                            <span className="steps-names">{stepNamesText}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              );
            }
            return null;
          })()}

          {/* Left side - Vertical list of header + data rows */}
          <div className="vertical-items-list">
            {/* Header Row */}
            <div className="flow-item-container">
              <div 
                className={`flow-item header-item ${expandedItems.has(flowData.header_flow.id) ? 'expanded' : ''}`}
                onClick={() => handleItemClick(flowData.header_flow.id, 'header')}
              >
                <div className="item-content">
                  <span className="item-value" title={flowData.header_flow.initial_value}>
                    {flowData.header_flow.initial_display}
                  </span>
                </div>
                <div className="expand-indicator">
                  {expandedItems.has(flowData.header_flow.id) ? '?' : '?'}
                </div>
              </div>
              
              {/* Header horizontal expansion */}
              {expandedItems.has(flowData.header_flow.id) && (
                <div className="horizontal-expansion">
                  <div className="flow-steps-container">
                    {flowData.header_flow.complete_flow.map((step, stepIndex) => (
                      <React.Fragment key={step.id}>
                        <div 
                          className={`flow-step-box small ${animatingSteps.has(step.id) ? 'animate-in' : ''}`}
                          style={{
                            animationDelay: `${stepIndex * 150}ms`
                          }}
                        >
                          <div className="step-content">
                            <span className="step-value" title={step.value}>
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
                                return addSpacing(step.display_value.replace(/\b(?:R|RUN|Run|run)(\d+)\b/g, 'RUN$1')).toUpperCase();
                              })()}
                            </span>
                          </div>
                        </div>
                        
                        {/* Arrow between steps */}
                        {!step.is_last && (
                          <div 
                            className={`flow-arrow ${animatingSteps.has(step.id) ? 'animate-arrow' : ''}`}
                            style={{
                              animationDelay: `${stepIndex * 150 + 75}ms`
                            }}
                          >
                            <span className="arrow-symbol">?</span>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Data Rows */}
            {flowData.data_rows.map((row) => (
              <div key={row.id} className="flow-item-container">
                <div 
                  className={`flow-item data-item ${expandedItems.has(row.id) ? 'expanded' : ''}`}
                  onClick={() => handleItemClick(row.id, 'data')}
                >
                  <div className="item-content">
                    <span className="item-value" title={row.initial_value}>
                      {row.initial_display}
                    </span>
                  </div>
                  <div className="expand-indicator">
                    {expandedItems.has(row.id) ? '?' : '?'}
                  </div>
                </div>
                
                {/* Data row horizontal expansion */}
                {expandedItems.has(row.id) && (
                  <div className="horizontal-expansion">
                    <div className="flow-steps-container">
                      {row.complete_flow.map((step, stepIndex) => (
                        <React.Fragment key={step.id}>
                          <div 
                            className={`flow-step-box small ${animatingSteps.has(step.id) ? 'animate-in' : ''}`}
                            style={{
                              animationDelay: `${stepIndex * 150}ms`
                            }}
                          >
                            <div className="step-content">
                              <span className="step-value" title={step.value}>
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
                                  return addSpacing(step.display_value.replace(/\b(?:R|RUN|Run|run)(\d+)\b/g, 'RUN$1')).toUpperCase();
                                })()}
                              </span>
                            </div>
                          </div>
                          
                          {/* Arrow between steps */}
                          {!step.is_last && (
                            <div 
                              className={`flow-arrow ${animatingSteps.has(step.id) ? 'animate-arrow' : ''}`}
                              style={{
                                animationDelay: `${stepIndex * 150 + 75}ms`
                              }}
                            >
                              <span className="arrow-symbol">?</span>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flow-metadata">
        <div className="metadata-item">
          <span className="metadata-label">Analyzed:</span>
          <span className="metadata-value">
            {new Date(flowData.metadata.analyzed_at).toLocaleString()}
          </span>
        </div>
        <div className="metadata-item">
          <span className="metadata-label">Rows Analyzed:</span>
          <span className="metadata-value">{flowData.metadata.total_rows_analyzed}</span>
        </div>
        <div className="metadata-item">
          <span className="metadata-label">Description:</span>
          <span className="metadata-value">{flowData.metadata.description}</span>
        </div>
      </div>
    </div>
  );
};

export default SimpleFlowVisualization;