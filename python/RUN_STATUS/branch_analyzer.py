"""
Branch View Analyzer - Intelligent branching based on data copying patterns
Analyzes data to detect when stages are copied from previous runs and creates branching visualizations
Treats header row as actual data (Run 1) and extracts username automatically
"""

import json
import logging
import re
import math
import csv
import os
from typing import Dict, List, Any, Optional, Tuple
import requests

# Try to import pandas and openpyxl, use fallback if not available
try:
    import pandas as pd
    import openpyxl
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    pd = None
    openpyxl = None

logger = logging.getLogger(__name__)

# Removed AI/Ollama dependencies - using pattern-based analysis instead

class BranchViewAnalyzer:
    """Analyzes data for branching patterns based on copied data from previous stages"""
    
    def __init__(self):
        self.branch_patterns = {}
        self.copy_relationships = {}
        self.stage_dependencies = {}
    
    def _read_csv_fallback(self, file_path: str) -> Dict[str, List[Dict[str, str]]]:
        """Fallback CSV reader when pandas is not available - treats header as data"""
        with open(file_path, 'r', newline='', encoding='utf-8') as f:
            reader = csv.reader(f)
            data = list(reader)
        
        if not data:
            return {}
        
        # Treat all rows as data, including the header
        all_rows = []
        
        # Process all rows as data
        for row_idx, row_data in enumerate(data):
            if not row_data or not any(cell.strip() for cell in row_data):
                continue  # Skip empty rows
            
            # Create a row dict with positional column names
            row_dict = {}
            for col_idx, value in enumerate(row_data):
                col_name = f"col_{col_idx}"  # Use positional column names
                row_dict[col_name] = value.strip() if value else ''
            
            if any(row_dict.values()):  # Skip empty rows
                all_rows.append(row_dict)
        
        return {'main': all_rows}

    def analyze_branch_patterns(self, file_path: str) -> Dict[str, Any]:
        """Main function to analyze data and generate branch view"""
        try:
            logger.info(f"Analyzing branch patterns for: {file_path}")
            
            # Read data with fallback support
            if HAS_PANDAS and file_path.endswith(('.xlsx', '.xls')):
                # Use pandas for Excel files
                wb = openpyxl.load_workbook(file_path)
                sheets_data = {}
                for sheet_name in wb.sheetnames:
                    df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
                    df.columns = [f"col_{i}" for i in range(len(df.columns))]
                    for col in df.columns:
                        if df[col].dtype == 'object':
                            df[col] = df[col].astype(str).str.strip()
                    df = df.dropna(how='all')
                    if not df.empty:
                        sheets_data[sheet_name] = df
            elif HAS_PANDAS:
                # Use pandas for CSV files - treat header as data
                df = pd.read_csv(file_path, header=None)  # Don't treat first row as header
                # Rename columns to positional names
                df.columns = [f"col_{i}" for i in range(len(df.columns))]
                sheets_data = {'main': df}
            else:
                # Fallback CSV reader
                sheets_data = self._read_csv_fallback(file_path)
            
            # Analyze data structure
            data_analysis = self._analyze_data_structure(sheets_data)
            
            # Detect copy patterns
            copy_patterns = self._detect_copy_patterns(sheets_data, data_analysis)
            
            # Generate branch layout
            branch_layout = self._generate_branch_layout(sheets_data, data_analysis, copy_patterns)
            
            return branch_layout
            
        except Exception as e:
            logger.error(f"Error in branch pattern analysis: {e}")
            raise ValueError(f"Failed to analyze branch patterns: {str(e)}")
    
    def _analyze_data_structure(self, sheets_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the basic data structure to identify runs, stages, and users"""
        
        # Get first sheet for analysis
        first_sheet_data = list(sheets_data.values())[0]
        
        # Handle both pandas DataFrame and fallback dict format
        if HAS_PANDAS and hasattr(first_sheet_data, 'columns'):
            columns = first_sheet_data.columns.tolist()
            all_data = first_sheet_data.to_dict('records')
        else:
            # Fallback: get columns from first row
            if first_sheet_data and len(first_sheet_data) > 0:
                columns = list(first_sheet_data[0].keys())
                all_data = first_sheet_data
            else:
                raise ValueError("No data found in the file")
        
        logger.info(f"Analyzing data structure with columns: {columns}")
        
        # Enhanced multi-user extraction with deduplication from ALL data rows
        raw_usernames = set()  # Store all found usernames before cleaning
        if all_data and len(all_data) > 0:
            logger.info(f"Analyzing {len(all_data)} rows for multi-user extraction with deduplication")

            # First pass: Extract all potential usernames from all rows
            for row in all_data:
                # Try all columns that might contain usernames
                for col_name in columns:
                    row_value = str(row.get(col_name, ''))
                    logger.debug(f"Processing value: {row_value} from column {col_name}")

                    # Pattern 1: Extract from s_username_R1 format
                    if '_' in row_value:
                        parts = row_value.split('_')
                        # Look for username part (typically after first underscore)
                        if len(parts) >= 2:
                            # Try to get the full name part (might include multiple underscores)
                            # First, join all parts except the first one
                            potential_name = '_'.join(parts[1:])

                            # Now remove any R1, R2, etc. suffix
                            import re
                            # Match the pattern: any text followed by R and digits at the end
                            match = re.match(r'(.+?)R\d+$', potential_name)
                            if match:
                                extracted_username = match.group(1)
                                # Remove trailing underscores if any
                                extracted_username = extracted_username.rstrip('_')
                                if len(extracted_username) > 1:
                                    raw_usernames.add(extracted_username.lower())  # Store in lowercase for deduplication
                                    logger.debug(f"Extracted full username: {extracted_username}")

                    # Pattern 2: Try various regex patterns to extract usernames
                    import re
                    patterns = [
                        # Full name followed by R and digits
                        r'([a-zA-Z][a-zA-Z0-9_]+)R\d+',  # john_doeR1, girishR1

                        # Full name with run indicator
                        r'([a-zA-Z][a-zA-Z0-9_]+)_run\d+',  # john_doe_run1

                        # Username with underscore prefix
                        r'_([a-zA-Z][a-zA-Z0-9_]+)',  # _john_doe

                        # Run followed by username
                        r'run_([a-zA-Z][a-zA-Z0-9_]+)',  # run_john_doe

                        # Username followed by underscore and anything
                        r'([a-zA-Z][a-zA-Z0-9_]+)_\w+',  # john_doe_something
                    ]

                    for pattern in patterns:
                        matches = re.findall(pattern, row_value, re.IGNORECASE)
                        for match in matches:
                            if isinstance(match, tuple):
                                match = match[0]  # Take first group if multiple groups

                            # Clean the match and remove R suffixes
                            cleaned_match = re.sub(r'R\d+$', '', match).rstrip('_')

                            # Skip common non-username words
                            if cleaned_match.lower() not in ['run', 'test', 'data', 'file', 'table', 'status', 'result']:
                                raw_usernames.add(cleaned_match.lower())  # Store in lowercase for deduplication
                                logger.debug(f"Extracted username with pattern {pattern}: {cleaned_match}")

            # If still no usernames found, try to extract from any text patterns
            if not raw_usernames:
                logger.info("No usernames found with standard patterns, trying fallback extraction")
                for row in all_data:
                    for col_name in columns:
                        row_value = str(row.get(col_name, ''))
                        # Extract any alphanumeric sequences that might be usernames
                        import re
                        words = re.findall(r'[a-zA-Z][a-zA-Z0-9_]{2,}', row_value)
                        for word in words:
                            # Clean the word and remove R suffixes
                            cleaned_word = re.sub(r'R\d+$', '', word).rstrip('_')

                            # Skip common non-username words
                            if cleaned_word.lower() not in ['run', 'test', 'data', 'file', 'table', 'column', 'row', 'value', 'status', 'result']:
                                raw_usernames.add(cleaned_word.lower())  # Store in lowercase for deduplication
                                logger.debug(f"Fallback extracted username: {cleaned_word}")

            # Final pass: Convert to proper case for display (capitalize first letter)
            usernames = set()
            for username in raw_usernames:
                # Convert to proper case: first letter uppercase, rest lowercase, preserve underscores
                if '_' in username:
                    # Handle names like "john_doe" -> "John_Doe"
                    parts = username.split('_')
                    proper_case = '_'.join([part.capitalize() for part in parts if part])
                else:
                    # Handle names like "girish" -> "Girish"
                    proper_case = username.capitalize()

                usernames.add(proper_case)
                logger.debug(f"Final username: {proper_case}")

            logger.info(f"Deduplicated usernames found: {usernames}")

        # Format username(s) for display
        if usernames:
            username_list = sorted(list(usernames))
            username = ', '.join(username_list)
            logger.info(f"Final extracted usernames: {username}")
        else:
            username = "System User"  # More professional than "Unknown User"
            logger.warning("No usernames could be extracted from data")
        
        # Use positional column logic
        run_column = columns[0]  # First column is always run column
        stage_columns = columns[1:]  # Remaining columns are stage columns
        
        # Create meaningful stage names from the first row (original header)
        stage_names = []
        if all_data and len(all_data) > 0:
            first_row = all_data[0]
            for col in stage_columns:
                stage_value = str(first_row.get(col, col))
                # Clean up stage name (remove numbers, keep base name)
                clean_name = ''.join([c for c in stage_value if c.isalpha()])
                if clean_name:
                    stage_names.append(clean_name)
                else:
                    stage_names.append(col)
        else:
            stage_names = stage_columns
        
        # Create stage mapping
        stage_mapping = {}
        for i, col in enumerate(stage_columns):
            if i < len(stage_names):
                stage_mapping[col] = stage_names[i]
            else:
                stage_mapping[col] = col
        
        return {
            'run_column': run_column,
            'stage_columns': stage_columns,
            'stage_names': stage_names,
            'stage_mapping': stage_mapping,
            'username': username,
            'total_columns': len(columns),
            'column_order': {stage: idx for idx, stage in enumerate(stage_columns)}
        }
    
    def _detect_copy_patterns(self, sheets_data: Dict[str, Any], data_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Detect patterns where data is copied from previous runs"""
        
        first_sheet_data = list(sheets_data.values())[0]
        run_column = data_analysis['run_column']
        stage_columns = data_analysis['stage_columns']
        
        copy_patterns = {}
        branch_points = {}
        
        # Group data by runs - handle both pandas and fallback formats
        runs_data = {}
        
        if HAS_PANDAS and hasattr(first_sheet_data, 'iterrows'):
            # Pandas DataFrame
            for _, row in first_sheet_data.iterrows():
                run_name = str(row[run_column])
                if run_name not in runs_data:
                    runs_data[run_name] = {}
                
                for stage in stage_columns:
                    runs_data[run_name][stage] = str(row[stage]) if pd.notna(row[stage]) else ''
        else:
            # Fallback dict format
            for row in first_sheet_data:
                run_name = str(row[run_column])
                if run_name not in runs_data:
                    runs_data[run_name] = {}
                
                for stage in stage_columns:
                    runs_data[run_name][stage] = str(row.get(stage, '')) if row.get(stage) else ''
        
        # Sort runs by extracting numbers, but treat header row as Run 0 (first)
        def extract_run_number(run_name):
            # If it's the header row (no numbers), treat as Run 0
            numbers = re.findall(r'\d+', run_name)
            if not numbers:
                return 0  # Header row comes first
            return int(numbers[0])
        
        sorted_runs = sorted(runs_data.keys(), key=extract_run_number)
        
        logger.info(f"Analyzing copy patterns for runs: {sorted_runs}")
        
        # Analyze each run for copied data
        for i, current_run in enumerate(sorted_runs):
            if i == 0:  # First run (header row) has no previous runs to copy from
                continue
            
            current_data = runs_data[current_run]
            copy_patterns[current_run] = {
                'copied_from': {},
                'branch_point': None,
                'skipped_stages': [],
                'new_stages': []
            }
            
            # Check each stage in current run
            for stage_idx, stage in enumerate(stage_columns):
                current_value = current_data.get(stage, '')
                
                if not current_value:
                    continue
                
                # Look for this value in previous runs
                found_copy = False
                for prev_run in sorted_runs[:i]:
                    prev_data = runs_data[prev_run]
                    
                    # Check if current stage value matches any stage in previous run
                    for prev_stage_idx, prev_stage in enumerate(stage_columns):
                        prev_value = prev_data.get(prev_stage, '')
                        
                        # Check for exact match (indicating data copying)
                        if prev_value and current_value == prev_value:
                            # Found a copy!
                            copy_patterns[current_run]['copied_from'][stage] = {
                                'source_run': prev_run,
                                'source_stage': prev_stage,
                                'source_stage_index': prev_stage_idx,
                                'current_stage_index': stage_idx,
                                'value': current_value
                            }
                            
                            # Determine branch point (where copying starts)
                            if copy_patterns[current_run]['branch_point'] is None:
                                copy_patterns[current_run]['branch_point'] = {
                                    'stage': prev_stage,
                                    'stage_index': prev_stage_idx,
                                    'source_run': prev_run
                                }
                            
                            found_copy = True
                            break
                    
                    if found_copy:
                        break
                
                # If no copy found, this is a new stage
                if not found_copy:
                    copy_patterns[current_run]['new_stages'].append({
                        'stage': stage,
                        'stage_index': stage_idx,
                        'value': current_value
                    })
            
            # Determine skipped stages
            if copy_patterns[current_run]['branch_point']:
                branch_point_idx = copy_patterns[current_run]['branch_point']['stage_index']
                
                # Find first new stage
                first_new_stage_idx = None
                for new_stage in copy_patterns[current_run]['new_stages']:
                    if first_new_stage_idx is None or new_stage['stage_index'] < first_new_stage_idx:
                        first_new_stage_idx = new_stage['stage_index']
                
                if first_new_stage_idx is not None:
                    # Stages between branch point and first new stage are skipped
                    for skip_idx in range(branch_point_idx + 1, first_new_stage_idx):
                        if skip_idx < len(stage_columns):
                            copy_patterns[current_run]['skipped_stages'].append({
                                'stage': stage_columns[skip_idx],
                                'stage_index': skip_idx
                            })
        
        return {
            'runs_data': runs_data,
            'sorted_runs': sorted_runs,
            'copy_patterns': copy_patterns
        }
    
    def _generate_branch_layout(self, sheets_data: Dict[str, Any], data_analysis: Dict[str, Any], copy_patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Generate the branch view layout based on copy patterns with proper branching logic"""
        
        runs_data = copy_patterns['runs_data']
        sorted_runs = copy_patterns['sorted_runs']
        copy_pattern_data = copy_patterns['copy_patterns']
        stage_columns = data_analysis['stage_columns']
        
        logger.info(f"Generating branch layout for runs: {sorted_runs}")
        logger.info(f"Stage columns: {stage_columns}")
        
        # Layout configuration
        node_width = 180
        node_height = 60
        spacing_x = 220
        spacing_y = 120
        
        # Stage colors
        stage_colors = {
            'floorplan': '#3498DB', 'floor': '#3498DB', 'fp': '#3498DB',
            'place': '#2ECC71', 'placement': '#2ECC71', 'pl': '#2ECC71',
            'cts': '#F39C12', 'clock': '#F39C12', 'ct': '#F39C12',
            'route': '#E74C3C', 'routing': '#E74C3C', 'rt': '#E74C3C',
            'drc': '#9B59B6', 'check': '#9B59B6', 'verify': '#9B59B6'
        }
        
        def get_stage_color(stage_name):
            stage_lower = stage_name.lower()
            for pattern, color in stage_colors.items():
                if pattern in stage_lower:
                    return color
            return '#34495E'  # Default color
        
        layout_data = {
            "nodes": [],
            "connections": [],
            "layout": {
                "width": len(stage_columns) * spacing_x + 400,
                "height": len(sorted_runs) * spacing_y + 400,
                "scrollable": True,
                "zoomable": True,
                "minZoom": 0.1,
                "maxZoom": 3.0,
                "background": {
                    "color": "black",
                    "gridSize": 50,
                    "gridColor": "gray",
                    "gridOpacity": 0.3
                }
            },
            "branch_analysis": copy_pattern_data,
            "metadata": {
                "username": data_analysis.get('username', 'Unknown User'),
                "stage_names": data_analysis.get('stage_names', []),
                "stage_mapping": data_analysis.get('stage_mapping', {}),
                "total_runs": len(sorted_runs),
                "total_stages": len(stage_columns)
            }
        }
        
        # Track all nodes for connection logic
        all_nodes = {}
        run_flows = {}  # Track the flow of each run
        
        # STEP 1: Create nodes for all runs
        for run_idx, run_name in enumerate(sorted_runs):
            run_data = runs_data[run_name]
            base_y = 100 + (run_idx * spacing_y)
            
            run_flows[run_name] = {
                'nodes': [],
                'is_branch': run_name in copy_pattern_data and len(copy_pattern_data[run_name].get('copied_from', {})) > 0,
                'branch_info': copy_pattern_data.get(run_name, {}),
                'y_position': base_y
            }
            
            # Create nodes for stages that have data
            for stage_idx, stage in enumerate(stage_columns):
                stage_value = run_data.get(stage, '').strip()
                if not stage_value:
                    continue
                
                node_id = f"{run_name}_{stage}"
                x_pos = 100 + (stage_idx * spacing_x)
                
                # Check if this stage is copied from another run
                is_copied = False
                if run_name in copy_pattern_data:
                    copied_stages = copy_pattern_data[run_name].get('copied_from', {})
                    is_copied = stage in copied_stages
                
                # SKIP creating nodes for copied stages - they should not be displayed
                if not is_copied:
                    # Get proper stage name from mapping
                    stage_display_name = data_analysis.get('stage_mapping', {}).get(stage, stage)
                    
                    node = {
                        "id": node_id,
                        "label": f"{stage_value}",
                        "x": x_pos,
                        "y": base_y,
                        "type": "stage",
                        "run": run_name,
                        "stage": stage,
                        "stage_name": stage_display_name,
                        "stage_index": stage_idx,
                        "value": stage_value,
                        "is_branch": run_name in copy_pattern_data and len(copy_pattern_data[run_name].get('copied_from', {})) > 0,
                        "style": {
                            "width": node_width,
                            "height": node_height,
                            "fill": get_stage_color(stage_display_name),
                            "stroke": "#FFD700" if (run_name in copy_pattern_data and len(copy_pattern_data[run_name].get('copied_from', {})) > 0) else "white",
                            "strokeWidth": 3 if (run_name in copy_pattern_data and len(copy_pattern_data[run_name].get('copied_from', {})) > 0) else 2,
                            "cornerRadius": 8,
                            "fontSize": 12,
                            "textColor": "white",
                            "fontWeight": "bold"
                        }
                    }
                    layout_data["nodes"].append(node)
                    all_nodes[node_id] = node
                    run_flows[run_name]['nodes'].append(node)
        
        # STEP 2: Generate connections with proper branching logic
        for run_idx, run_name in enumerate(sorted_runs):
            run_flow = run_flows[run_name]
            
            if not run_flow['is_branch']:
                # Regular linear flow - connect consecutive stages
                prev_node = None
                for node in run_flow['nodes']:
                    if prev_node:
                        layout_data["connections"].append({
                            "from": prev_node["id"],
                            "to": node["id"],
                            "type": "straight",
                            "connection_category": "linear",
                            "style": {
                                "stroke": "white",
                                "strokeWidth": 3,
                                "arrowSize": 10
                            }
                        })
                    prev_node = node
            else:
                # Branch flow - connect from source stage to first new stage (skip copied stages)
                branch_info = run_flow['branch_info']
                copied_stages = branch_info.get('copied_from', {})
                
                if copied_stages:
                    # Find the LAST copied stage (highest stage index) - this is the branch point
                    last_copied_stage = None
                    last_copied_stage_idx = -1
                    last_copy_info = None
                    
                    for copied_stage, copy_info in copied_stages.items():
                        stage_idx = copy_info['current_stage_index']
                        if stage_idx > last_copied_stage_idx:
                            last_copied_stage_idx = stage_idx
                            last_copied_stage = copied_stage
                            last_copy_info = copy_info
                    
                    if last_copy_info:
                        # Branch from the LAST copied stage to the FIRST new stage
                        source_run = last_copy_info['source_run']
                        source_stage = last_copy_info['source_stage']
                        source_node_id = f"{source_run}_{source_stage}"
                        
                        # Find the first new stage in current run (after the last copied stage)
                        first_new_node = None
                        for node in sorted(run_flow['nodes'], key=lambda x: x['stage_index']):
                            if node['stage_index'] > last_copied_stage_idx:
                                first_new_node = node
                                break
                        
                        # Create branch connection from LAST copied stage to FIRST new stage
                        if source_node_id in all_nodes and first_new_node:
                            layout_data["connections"].append({
                                "from": source_node_id,
                                "to": first_new_node["id"],
                                "type": "curved",
                                "connection_category": "branch",
                                "style": {
                                    "stroke": "#FFD700",
                                    "strokeWidth": 4,
                                    "arrowSize": 12,
                                    "strokeDasharray": "8,4"
                                }
                            })
                            
                            logger.info(f"Created branch connection: {source_node_id} -> {first_new_node['id']} (from LAST copied stage {last_copied_stage})")
                
                # Connect consecutive new stages within the branch (only the visible nodes)
                visible_nodes = [node for node in run_flow['nodes']]  # All nodes in run_flow are already non-copied
                visible_nodes.sort(key=lambda x: x['stage_index'])
                
                prev_node = None
                for node in visible_nodes:
                    if prev_node:
                        layout_data["connections"].append({
                            "from": prev_node["id"],
                            "to": node["id"],
                            "type": "straight",
                            "connection_category": "branch_linear",
                            "style": {
                                "stroke": "#FFD700",
                                "strokeWidth": 3,
                                "arrowSize": 10
                            }
                        })
                    prev_node = node
        
        logger.info(f"Generated branch layout with {len(layout_data['nodes'])} nodes and {len(layout_data['connections'])} connections")
        
        # Add debug information
        layout_data["debug_info"] = {
            "runs_processed": len(sorted_runs),
            "branch_runs": [run for run in sorted_runs if run in copy_pattern_data],
            "linear_runs": [run for run in sorted_runs if run not in copy_pattern_data],
            "total_stages": len(stage_columns)
        }
        
        return layout_data

def analyze_branch_view(file_path: str) -> Dict[str, Any]:
    """Main function to analyze and generate branch view"""
    try:
        # Use the simple, clean analyzer with user's exact logic
        from simple_branch_analyzer import analyze_branch_view as simple_analyze
        return simple_analyze(file_path)
    except Exception as e:
        logger.error(f"Error in branch view analysis: {e}")
        raise ValueError(f"Failed to generate branch view: {str(e)}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python branch_analyzer.py <file_path>"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    try:
        result = analyze_branch_view(file_path)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)