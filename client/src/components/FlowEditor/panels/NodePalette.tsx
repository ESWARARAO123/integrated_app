import React from 'react';
import { motion } from 'framer-motion';
import {
  FileInput,
  Database,
  Wrench,
  Settings,
  Zap,
  Layers,
  TestTube,
  FolderOpen,
  FileText,
  Terminal
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
      value: 'SYNTH',
      inputType: 'select',
      options: ['SYNTH', 'PD', 'LEC', 'STA', 'all'],
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
  
  // Process Nodes
  {
    type: 'process',
    label: 'Synthesis',
    icon: <Zap size={20} />,
    description: 'RTL synthesis execution',
    category: 'process',
    defaultData: {
      label: 'Synthesis',
      stage: 'SYNTH',
      tool: 'cadence',
      status: 'idle',
      parameters: {},
    },
  },
  {
    type: 'process',
    label: 'Physical Design',
    icon: <Layers size={20} />,
    description: 'Place and route execution',
    category: 'process',
    defaultData: {
      label: 'Physical Design',
      stage: 'PD',
      tool: 'cadence',
      status: 'idle',
      parameters: {},
    },
  },
  {
    type: 'process',
    label: 'LEC Verification',
    icon: <TestTube size={20} />,
    description: 'Logic equivalence checking',
    category: 'process',
    defaultData: {
      label: 'LEC Verification',
      stage: 'LEC',
      tool: 'cadence',
      status: 'idle',
      parameters: {},
    },
  },
  {
    type: 'process',
    label: 'STA Analysis',
    icon: <TestTube size={20} />,
    description: 'Static timing analysis',
    category: 'process',
    defaultData: {
      label: 'STA Analysis',
      stage: 'STA',
      tool: 'cadence',
      status: 'idle',
      parameters: {},
    },
  },
  
  // Output Nodes
  {
    type: 'output',
    label: 'Directory Output',
    icon: <FolderOpen size={20} />,
    description: 'Generated directory structure',
    category: 'output',
    defaultData: {
      label: 'Directory Output',
      outputType: 'directory',
      outputPath: 'Generated directories',
      status: 'idle',
      parameters: {},
    },
  },
  {
    type: 'output',
    label: 'Script Output',
    icon: <FileText size={20} />,
    description: 'Generated execution scripts',
    category: 'output',
    defaultData: {
      label: 'Script Output',
      outputType: 'file',
      outputPath: 'complete_make.csh',
      expectedFiles: ['complete_make.csh', 'config.tcl'],
      status: 'idle',
      parameters: {},
    },
  },
  {
    type: 'output',
    label: 'Execution Logs',
    icon: <Terminal size={20} />,
    description: 'Execution logs and reports',
    category: 'output',
    defaultData: {
      label: 'Execution Logs',
      outputType: 'logs',
      outputPath: 'Execution logs',
      status: 'idle',
      parameters: {},
    },
  },
];

export const NodePalette: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
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
    process: 'Process Stages',
    output: 'Output Results',
  };

  const categoryColors = {
    input: 'var(--color-primary)',
    process: 'var(--color-secondary)',
    output: 'var(--color-success)',
  };

  return (
    <motion.div 
      className="node-palette"
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="palette-header">
        <h3>Flow Blocks</h3>
        <p style={{
          margin: '8px 0 0 0',
          color: 'var(--color-text-secondary)',
          fontSize: '11px',
          lineHeight: '1.3',
        }}>
          Drag blocks to build workflow
        </p>
      </div>
      
      <div className="palette-content">
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
                onDragStart={(e) => onDragStart(e, template.type)}
                style={{
                  borderLeftColor: categoryColors[category as keyof typeof categoryColors],
                  borderLeftWidth: '3px',
                }}
              >
                <div 
                  className="palette-item-icon"
                  style={{ color: categoryColors[category as keyof typeof categoryColors] }}
                >
                  {template.icon}
                </div>
                <div className="palette-item-content">
                  <span className="palette-item-label">{template.label}</span>
                  <span className="palette-item-description">{template.description}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
};
