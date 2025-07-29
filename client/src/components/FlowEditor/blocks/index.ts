import { NodeTypes } from '@xyflow/react';
import { InputNode } from './InputNode';
import { ProcessNode } from './ProcessNode';
import { OutputNode } from './OutputNode';
import { BaseNode } from './BaseNode';

export const nodeTypes: NodeTypes = {
  input: InputNode,
  process: ProcessNode,
  output: OutputNode,
};

export { InputNode } from './InputNode';
export { ProcessNode } from './ProcessNode';
export { OutputNode } from './OutputNode';
export { BaseNode } from './BaseNode';
