import React from 'react';
import { FlowEditorProvider } from './FlowEditorProvider';
import { FlowCanvas } from './canvas/FlowCanvas';
import { NodePalette } from './panels/NodePalette';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { FlowToolbar } from './panels/FlowToolbar';
import { useTheme } from '../../contexts/ThemeContext';
import './styles/FlowEditor.css';

export const FlowEditor: React.FC = () => {
  const { currentTheme } = useTheme();

  return (
    <FlowEditorProvider>
      <div className="flow-editor-container" data-theme={currentTheme}>
        <FlowToolbar />
        <div className="flow-editor-main">
          <NodePalette />
          <FlowCanvas />
          <PropertiesPanel />
        </div>
      </div>
    </FlowEditorProvider>
  );
};

export default FlowEditor;
