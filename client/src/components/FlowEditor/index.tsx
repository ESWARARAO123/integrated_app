import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlowEditorProvider } from './FlowEditorProvider';
import { FlowCanvas } from './canvas/FlowCanvas';
import { NodePalette } from './panels/NodePalette';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { FlowToolbar } from './panels/FlowToolbar';
import { useTheme } from '../../contexts/ThemeContext';
import { Blocks } from 'lucide-react';
import './styles/FlowEditor.css';

export const FlowEditor: React.FC = () => {
  const { currentTheme } = useTheme();
  const [showNodePalette, setShowNodePalette] = useState(false);

  const toggleNodePalette = () => {
    setShowNodePalette(!showNodePalette);
  };

  return (
    <FlowEditorProvider>
      <div className="flow-editor-container" data-theme={currentTheme}>
        <FlowToolbar />
        <div className="flow-editor-main" style={{ position: 'relative' }}>
          {/* Floating Toggle Button - only show when palette is hidden */}
          <AnimatePresence>
            {!showNodePalette && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="floating-palette-toggle"
                style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  zIndex: 1000,
                }}
              >
                <button
                  onClick={toggleNodePalette}
                  className="palette-toggle-btn"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 3px 10px rgba(0, 0, 0, 0.12)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.18)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.12)';
                  }}
                  title="Open Flow Blocks"
                >
                  <Blocks size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Conditional NodePalette with glassmorphic styling */}
          <AnimatePresence>
            {showNodePalette && (
              <NodePalette onClose={toggleNodePalette} />
            )}
          </AnimatePresence>

          <FlowCanvas />
          <PropertiesPanel />
        </div>
      </div>
    </FlowEditorProvider>
  );
};

export default FlowEditor;
