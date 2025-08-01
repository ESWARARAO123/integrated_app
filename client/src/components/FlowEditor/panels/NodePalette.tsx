import React from 'react';
import { motion } from 'framer-motion';
import {
  FileInput,
  Database,
  Wrench,
  Settings,
  X,
} from 'lucide-react';
import { NodeTemplate } from '../types/flow';

const nodeTemplates: NodeTemplate[] = [
  // Input Nodes
  {
    type: 'input',
    label: 'Project Input',
    icon: <Database size={20} />,
    description: 'Project configuration',
    category: 'input',
    defaultData: {
      label: 'Project Input',
      parameterName: 'project_name',
      value: '',
      inputType: 'text',
      status: 'idle',
      parameters: {},
    },
  },
  {
    type: 'input',
    label: 'Block Input',
    icon: <Database size={20} />,
    description: 'Block configuration',
    category: 'input',
    defaultData: {
      label: 'Block Input',
      parameterName: 'block_name',
      value: '',
      inputType: 'text',
      status: 'idle',
      parameters: {},
    },
  },
  {
    type: 'input',
    label: 'Tool Selection',
    icon: <Wrench size={20} />,
    description: 'EDA tool selection',
    category: 'input',
    defaultData: {
      label: 'Tool Selection',
      parameterName: 'tool_used',
      value: 'cadence',
      inputType: 'select',
      options: ['cadence', 'synopsys'],
      status: 'idle',
      parameters: {},
    },
  },
  {
    type: 'input',
    label: 'Stage Selection',
    icon: <Settings size={20} />,
    description: 'Flow stage selection',
    category: 'input',
    defaultData: {
      label: 'Stage Selection',
      parameterName: 'stage_in_flow',
      value: 'Synthesis',
      inputType: 'select',
      options: ['Synthesis', 'PD', 'LEC', 'STA', 'all'],
      status: 'idle',
      parameters: {},
    },
  },
  {
    type: 'input',
    label: 'PD Steps',
    icon: <Settings size={20} />,
    description: 'Physical Design steps',
    category: 'input',
    defaultData: {
      label: 'PD Steps',
      parameterName: 'pd_steps',
      value: 'Floorplan',
      inputType: 'select',
      options: ['Floorplan', 'Place', 'CTS', 'Route', 'all'],
      status: 'idle',
      parameters: {},
    },
  },
  {
    type: 'input',
    label: 'Run Name',
    icon: <FileInput size={20} />,
    description: 'Execution identifier',
    category: 'input',
    defaultData: {
      label: 'Run Name',
      parameterName: 'run_name',
      value: '',
      inputType: 'text',
      status: 'idle',
      parameters: {},
    },
  },
];

interface NodePaletteProps {
  onClose?: () => void;
}

export const NodePalette: React.FC<NodePaletteProps> = ({ onClose }) => {
  const onDragStart = (event: React.DragEvent, template: NodeTemplate) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(template));
    event.dataTransfer.effectAllowed = 'move';
  };

  const groupedTemplates = nodeTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, NodeTemplate[]>);

  const categoryTitles = {
    input: 'Input Parameters',
  };

  const categoryColors = {
    input: 'var(--color-primary)',
  };

  return (
    <motion.div 
      className="node-palette"
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '14px',
        boxShadow: '0 6px 24px rgba(0, 0, 0, 0.18)',
        width: '260px',
        maxHeight: '65vh',
        overflow: 'hidden',
      }}
    >
      <div className="palette-header" style={{
        padding: '14px 16px 10px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <h3 style={{
            margin: 0,
            color: 'var(--color-text)',
            fontSize: '16px',
            fontWeight: '600',
          }}>Flow Blocks</h3>
          <p style={{
            margin: '4px 0 0 0',
            color: 'var(--color-text-secondary)',
            fontSize: '11px',
            lineHeight: '1.3',
          }}>
            Drag blocks to build workflow
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = 'var(--color-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
            title="Close Flow Blocks"
          >
            <X size={16} />
          </button>
        )}
      </div>
      
      <div 
        className="palette-content" 
        style={{
          padding: '12px 16px 16px 16px',
          overflowY: 'auto',
          maxHeight: 'calc(65vh - 70px)',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-primary) rgba(255, 255, 255, 0.1)',
        }}
        onMouseEnter={(e) => {
          // Add custom scrollbar styles for webkit browsers
          const style = document.createElement('style');
          style.textContent = `
            .palette-content::-webkit-scrollbar {
              width: 6px;
            }
            .palette-content::-webkit-scrollbar-track {
              background: rgba(255, 255, 255, 0.1);
              border-radius: 3px;
            }
            .palette-content::-webkit-scrollbar-thumb {
              background: var(--color-primary);
              border-radius: 3px;
              opacity: 0.7;
            }
            .palette-content::-webkit-scrollbar-thumb:hover {
              background: var(--color-primary);
              opacity: 1;
            }
          `;
          document.head.appendChild(style);
          e.currentTarget.dataset.styleAdded = 'true';
        }}
      >
        {Object.entries(groupedTemplates).map(([category, templates]) => (
          <div key={category} style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              paddingBottom: '6px',
              borderBottom: `1px solid ${categoryColors[category as keyof typeof categoryColors]}20`,
            }}>
              <div style={{
                width: '3px',
                height: '16px',
                backgroundColor: categoryColors[category as keyof typeof categoryColors],
                borderRadius: '2px',
              }} />
              <h4 style={{
                margin: 0,
                color: 'var(--color-text)',
                fontSize: '13px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {categoryTitles[category as keyof typeof categoryTitles]}
              </h4>
            </div>
            
            {templates.map((template) => (
              <div
                key={`${template.type}-${template.label}`}
                className="palette-item"
                draggable
                style={{
                  borderLeftColor: categoryColors[category as keyof typeof categoryColors],
                  borderLeftWidth: '3px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '10px',
                  marginBottom: '6px',
                  cursor: 'grab',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  minHeight: '50px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onDragStart={(e) => {
                  e.currentTarget.style.cursor = 'grabbing';
                  onDragStart(e, template);
                }}
                onDragEnd={(e) => {
                  e.currentTarget.style.cursor = 'grab';
                }}
              >
                <div 
                  className="palette-item-icon"
                  style={{ color: categoryColors[category as keyof typeof categoryColors] }}
                >
                  {template.icon}
                </div>
                <div className="palette-item-content" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  flex: 1,
                }}>
                  <span className="palette-item-label" style={{
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    fontWeight: '600',
                    lineHeight: '1.2',
                  }}>{template.label}</span>
                  <span className="palette-item-description" style={{
                    color: 'var(--color-text-secondary)',
                    fontSize: '12px',
                    lineHeight: '1.3',
                    opacity: 0.8,
                  }}>{template.description}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
};
