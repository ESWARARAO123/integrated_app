#!/usr/bin/env python3
"""
Intelligent Simple Flow Analyzer
Model-based analysis without external dependencies
"""

import json
import csv
import sys
import os
from typing import Dict, List, Any, Optional
from collections import defaultdict, Counter
import re

class IntelligentSimpleFlowAnalyzer:
    def __init__(self):
        # EDA flow patterns and keywords
        self.stage_patterns = {
            'synthesis': ['synth', 'synthesis', 'syn', 'compile'],
            'floorplan': ['floorplan', 'fp', 'floor', 'plan'],
            'placement': ['place', 'placement', 'pl', 'placed'],
            'cts': ['cts', 'clock', 'tree', 'synthesis'],
            'routing': ['route', 'routing', 'rt', 'routed'],
            'drc': ['drc', 'design', 'rule', 'check'],
            'verification': ['verify', 'verification', 'ver', 'check'],
            'signoff': ['signoff', 'sign', 'off', 'final']
        }
        
        self.user_patterns = ['user', 'owner', 'designer', 'engineer', 'creator']
        self.run_patterns = ['run', 'flow', 'job', 'batch', 'iteration', 'id']
        self.status_patterns = ['status', 'state', 'result', 'outcome', 'condition']
        
        self.status_mapping = {
            'completed': ['complete', 'done', 'success', 'pass', 'finished', 'ok'],
            'failed': ['fail', 'error', 'abort', 'crash', 'exception'],
            'running': ['run', 'active', 'progress', 'executing', 'processing'],
            'pending': ['pending', 'wait', 'queue', 'scheduled', 'ready']
        }

    def read_csv_data(self, file_path: str) -> List[Dict[str, Any]]:
        """Read CSV data safely"""
        data = []
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    data.append(dict(row))
            return data
        except Exception as e:
            raise ValueError(f"Error reading CSV file: {str(e)}")

    def analyze_column_types(self, data: List[Dict[str, Any]]) -> Dict[str, str]:
        """Intelligently detect column types based on content and patterns"""
        if not data:
            return {}
        
        columns = list(data[0].keys())
        column_analysis = {}
        
        for col in columns:
            col_lower = col.lower()
            sample_values = [str(row.get(col, '')).lower() for row in data[:10]]
            
            # Analyze column content
            if any(pattern in col_lower for pattern in self.user_patterns):
                column_analysis[col] = 'user'
            elif any(pattern in col_lower for pattern in self.run_patterns):
                column_analysis[col] = 'run'
            elif any(pattern in col_lower for pattern in self.status_patterns):
                column_analysis[col] = 'status'
            elif self._is_stage_column(col_lower, sample_values):
                column_analysis[col] = 'stage'
            elif self._is_timestamp_column(col_lower, sample_values):
                column_analysis[col] = 'timestamp'
            else:
                column_analysis[col] = 'data'
        
        return column_analysis

    def _is_stage_column(self, col_name: str, sample_values: List[str]) -> bool:
        """Check if column contains stage information"""
        stage_keywords = ['stage', 'step', 'phase', 'task', 'tool', 'process']
        
        # Check column name
        if any(keyword in col_name for keyword in stage_keywords):
            return True
        
        # Check sample values for stage patterns
        stage_matches = 0
        for value in sample_values:
            for stage_type, patterns in self.stage_patterns.items():
                if any(pattern in value for pattern in patterns):
                    stage_matches += 1
                    break
        
        return stage_matches >= len(sample_values) * 0.3  # 30% threshold

    def _is_timestamp_column(self, col_name: str, sample_values: List[str]) -> bool:
        """Check if column contains timestamp information"""
        time_keywords = ['time', 'date', 'timestamp', 'created', 'updated']
        return any(keyword in col_name for keyword in time_keywords)

    def detect_stage_type(self, stage_value: str) -> str:
        """Detect the type of stage based on value"""
        stage_lower = str(stage_value).lower()
        
        for stage_type, patterns in self.stage_patterns.items():
            if any(pattern in stage_lower for pattern in patterns):
                return stage_type
        
        return 'process'  # Default type

    def normalize_status(self, status_value: str) -> str:
        """Normalize status values to standard categories"""
        status_lower = str(status_value).lower()
        
        for normalized_status, patterns in self.status_mapping.items():
            if any(pattern in status_lower for pattern in patterns):
                return normalized_status
        
        return 'unknown'

    def create_intelligent_flow_structure(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create tabular flow structure matching SimpleFlowVisualization format"""
        if not data:
            return self._create_empty_structure()
        
        columns = list(data[0].keys())
        table_name = "Database Table"
        
        print(f"Creating tabular flow structure with {len(columns)} columns and {len(data)} rows", file=sys.stderr)
        
        # Create header flow - shows column names as flow steps
        header_flow = self._create_header_flow(columns)
        
        # Create data rows - each row becomes a flow showing values across columns
        data_rows = []
        for row_idx, row in enumerate(data[:10]):  # Limit to first 10 rows for performance
            data_row = self._create_data_row_flow(row, columns, row_idx)
            data_rows.append(data_row)
        
        return {
            'table_name': table_name,
            'total_columns': len(columns),
            'total_rows': len(data),
            'header_flow': header_flow,
            'data_rows': data_rows,
            'metadata': {
                'analyzed_at': self._get_current_timestamp(),
                'total_rows_analyzed': len(data),
                'analysis_type': 'intelligent_tabular_flow',
                'description': f'Tabular flow analysis of {len(data)} rows across {len(columns)} columns'
            }
        }

    def _create_header_flow(self, columns: List[str]) -> Dict[str, Any]:
        """Create header flow showing column names"""
        flow_steps = []
        
        for idx, column in enumerate(columns):
            step_id = f"header_step_{idx}"
            flow_steps.append({
                'id': step_id,
                'position': idx,
                'column_name': column,
                'value': column,
                'display_value': self._format_display_value(column),
                'is_first': idx == 0,
                'is_last': idx == len(columns) - 1
            })
        
        return {
            'id': 'header_flow',
            'type': 'header',
            'initial_value': 'Column Headers',
            'initial_display': f'Headers ({len(columns)} columns)',
            'complete_flow': flow_steps
        }

    def _create_data_row_flow(self, row: Dict[str, Any], columns: List[str], row_idx: int) -> Dict[str, Any]:
        """Create data row flow showing values across columns"""
        flow_steps = []
        
        # Get the first column value as the row identifier
        first_col_value = str(row.get(columns[0], f'Row {row_idx + 1}'))
        
        for idx, column in enumerate(columns):
            step_id = f"row_{row_idx}_step_{idx}"
            raw_value = row.get(column, '')
            
            flow_steps.append({
                'id': step_id,
                'position': idx,
                'column_name': column,
                'value': str(raw_value),
                'display_value': self._format_display_value(str(raw_value)),
                'is_first': idx == 0,
                'is_last': idx == len(columns) - 1
            })
        
        return {
            'id': f'data_row_{row_idx}',
            'row_number': row_idx + 1,
            'type': 'data',
            'initial_value': first_col_value,
            'initial_display': self._format_display_value(first_col_value),
            'complete_flow': flow_steps
        }

    def _format_display_value(self, value: str) -> str:
        """Format value for display - truncate if too long"""
        if not value:
            return '(empty)'
        
        value_str = str(value).strip()
        if len(value_str) > 25:
            return value_str[:22] + '...'
        return value_str

    def _get_current_timestamp(self) -> str:
        """Get current timestamp in ISO format"""
        from datetime import datetime
        return datetime.now().isoformat()

    def _find_column_by_type(self, column_types: Dict[str, str], target_type: str) -> Optional[str]:
        """Find column by detected type"""
        for col, col_type in column_types.items():
            if col_type == target_type:
                return col
        return None

    def _sort_stages_intelligently(self, stages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Sort stages based on EDA flow logic"""
        stage_order = ['synthesis', 'floorplan', 'placement', 'cts', 'routing', 'drc', 'verification', 'signoff']
        
        def get_stage_priority(stage_info):
            stage_type = stage_info['stage_type']
            try:
                return stage_order.index(stage_type)
            except ValueError:
                return 999  # Unknown stages go to end
        
        return sorted(stages, key=get_stage_priority)

    def _get_stage_color(self, stage_type: str, status: str) -> str:
        """Get color based on stage type and status"""
        # Base colors for stage types
        stage_colors = {
            'synthesis': '#007bff',
            'floorplan': '#28a745',
            'placement': '#ffc107',
            'cts': '#6f42c1',
            'routing': '#fd7e14',
            'drc': '#dc3545',
            'verification': '#20c997',
            'signoff': '#6c757d',
            'process': '#17a2b8'
        }
        
        base_color = stage_colors.get(stage_type, '#6c757d')
        
        # Modify based on status
        if status == 'failed':
            return '#dc3545'
        elif status == 'completed':
            return base_color
        elif status == 'running':
            return '#ffc107'
        else:  # pending or unknown
            return '#6c757d'

    def _create_empty_structure(self) -> Dict[str, Any]:
        """Create empty structure when no data"""
        return {
            'table_name': 'Empty Table',
            'total_columns': 0,
            'total_rows': 0,
            'header_flow': {
                'id': 'empty_header',
                'type': 'header',
                'initial_value': 'No Data',
                'initial_display': 'No columns available',
                'complete_flow': []
            },
            'data_rows': [],
            'metadata': {
                'analyzed_at': self._get_current_timestamp(),
                'total_rows_analyzed': 0,
                'analysis_type': 'empty_tabular_flow',
                'description': 'No data available for analysis'
            }
        }

    def analyze(self, file_path: str) -> Dict[str, Any]:
        """Main analysis method"""
        try:
            print(f"Starting intelligent analysis of: {file_path}", file=sys.stderr)
            
            # Read data
            data = self.read_csv_data(file_path)
            print(f"Read {len(data)} rows of data", file=sys.stderr)
            
            # Create flow structure
            result = self.create_intelligent_flow_structure(data)
            print(f"Created tabular flow with {result['total_columns']} columns and {len(result['data_rows'])} data rows", file=sys.stderr)
            
            return result
            
        except Exception as e:
            print(f"Analysis error: {str(e)}", file=sys.stderr)
            return self._create_empty_structure()

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python intelligent_simple_analyzer.py <csv_file_path>"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    try:
        analyzer = IntelligentSimpleFlowAnalyzer()
        result = analyzer.analyze(file_path)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()