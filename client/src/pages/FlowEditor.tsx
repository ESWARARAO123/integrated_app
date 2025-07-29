import React from 'react';
import { motion } from 'framer-motion';
import FlowEditor from '../components/FlowEditor';

const FlowEditorPage: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <FlowEditor />
    </motion.div>
  );
};

export default FlowEditorPage;
