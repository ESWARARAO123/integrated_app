import React from 'react';
import { NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { NodeData } from '../types/flow';

interface BaseNodeProps extends NodeProps {
  data: NodeData;
  className?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  children?: React.ReactNode;
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  data,
  selected,
  dragging,
  className = '',
  icon,
  accentColor,
  children,
}) => {
  const getStatusColor = () => {
    switch (data.status) {
      case 'running':
        return 'var(--color-warning)';
      case 'success':
        return 'var(--color-success)';
      case 'error':
        return 'var(--color-error)';
      default:
        return 'var(--color-border)';
    }
  };

  const nodeClasses = [
    'flow-node',
    className,
    selected ? 'selected' : '',
    dragging ? 'dragging' : '',
  ].filter(Boolean).join(' ');

  return (
    <motion.div
      className={nodeClasses}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: selected ? 1.02 : 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        backgroundColor: 'var(--color-surface)',
        border: `2px solid ${selected ? 'var(--color-primary)' : getStatusColor()}`,
        borderRadius: '12px',
        padding: '20px',
        minWidth: '240px',
        boxShadow: dragging
          ? '0 10px 25px rgba(0,0,0,0.3)'
          : selected
          ? '0 0 0 2px var(--color-primary-translucent)'
          : '0 4px 12px rgba(0,0,0,0.1)',
        position: 'relative',
        borderLeftColor: accentColor || 'var(--color-border)',
        borderLeftWidth: '4px',
      }}
    >
      <div className="node-header" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      }}>
        {icon && (
          <div 
            className="node-icon"
            style={{ color: accentColor || 'var(--color-primary)' }}
          >
            {icon}
          </div>
        )}
        <span
          className="node-title"
          style={{
            color: 'var(--color-text)',
            fontSize: '20px',
            fontWeight: '700',
            flex: 1,
            lineHeight: '1.1',
            letterSpacing: '0.3px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '180px',
          }}
          title={data.label} // Show full text on hover
        >
          {data.label}
        </span>
        <div
          className={`status-indicator ${data.status}`}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            animation: data.status === 'running' ? 'pulse 2s infinite' : 'none',
          }}
        />
      </div>
      
      {data.description && (
        <div 
          className="node-content"
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '12px',
            lineHeight: '1.4',
            margin: 0,
          }}
        >
          {data.description}
        </div>
      )}
      
      {children}
    </motion.div>
  );
};
