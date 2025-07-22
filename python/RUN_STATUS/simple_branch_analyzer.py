#!/usr/bin/env python3

import csv
import logging
import re
import json
from typing import Dict, List, Any, Optional

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleBranchAnalyzer:
    """
    Simple Branch Analyzer - implements EXACT user logic:
    1. First row: display all stages (starting run)
    2. Check if run copies data from previous runs
    3. If no copying: display all stages (independent run)
    4. If copying: skip copied stages, branch from LAST copied stage to FIRST new stage
    5. Make it scrollable (no zoom buttons)
    """
    
    def analyze_csv(self, file_path: str) -> Dict[str, Any]:
        """Analyze CSV file with user's exact branching logic"""
        
        try:
            # Read CSV file
            all_data = []
            with open(file_path, 'r', newline='', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                columns = reader.fieldnames
                for row in reader:
                    all_data.append(row)
            
            logger.info(f"Loaded CSV with {len(all_data)} rows and {len(columns)} columns")
            
            if not all_data:
                raise ValueError("CSV file is empty")
            
            # Get columns (first column is run name, rest are stages)
            run_column = columns[0]
            stage_columns = columns[1:]
            
            logger.info(f"Run column: {run_column}")
            logger.info(f"Stage columns: {stage_columns}")
            
            # Extract username from run names
            run_names = [row[run_column] for row in all_data]
            username = self._extract_username(run_names)
            
            # Analyze branching patterns
            branch_analysis = self._analyze_branching_patterns(all_data, run_column, stage_columns)
            
            # Generate visualization layout
            layout_data = self._generate_layout(branch_analysis, stage_columns, username)
            
            return layout_data
            
        except Exception as e:
            logger.error(f"Error analyzing CSV: {str(e)}")
            raise
    
    def _extract_username(self, run_names: List[str]) -> str:
        """Enhanced multi-user extraction with deduplication from run names"""

        raw_usernames = set()  # Store all found usernames before cleaning
        logger.info(f"Simple Branch: Analyzing {len(run_names)} run names for multi-user extraction with deduplication")

        # First pass: Extract all potential usernames from all run names
        for run_name in run_names:
            run_str = str(run_name)
            logger.debug(f"Simple Branch: Processing run name: {run_str}")

            # Pattern 1: Extract from s_username_R1 format
            if '_' in run_str:
                parts = run_str.split('_')
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
                            logger.debug(f"Simple Branch: Extracted full username: {extracted_username}")

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
                matches = re.findall(pattern, run_str, re.IGNORECASE)
                for match in matches:
                    if isinstance(match, tuple):
                        match = match[0]  # Take first group if multiple groups

                    # Clean the match and remove R suffixes
                    cleaned_match = re.sub(r'R\d+$', '', match).rstrip('_')

                    # Skip common non-username words
                    if cleaned_match.lower() not in ['run', 'test', 'data', 'file', 'table', 'status', 'result']:
                        raw_usernames.add(cleaned_match.lower())  # Store in lowercase for deduplication
                        logger.debug(f"Simple Branch: Extracted username with pattern {pattern}: {cleaned_match}")

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
            logger.debug(f"Simple Branch: Final username: {proper_case}")

        logger.info(f"Simple Branch: Deduplicated usernames found: {usernames}")

        # Format username(s) for display
        if usernames:
            username_list = sorted(list(usernames))
            result = ', '.join(username_list)
            logger.info(f"Simple Branch: Final extracted usernames: {result}")
            return result
        else:
            logger.warning("Simple Branch: No usernames could be extracted from run names")
            return "System User"  # More professional than "Unknown User"
    
    def _analyze_branching_patterns(self, all_data: List[Dict], run_column: str, stage_columns: List[str]) -> Dict[str, Any]:
        """Analyze branching patterns using user's exact logic"""
        
        runs_data = {}
        branch_patterns = {}
        
        # Extract run data
        for row in all_data:
            run_name = str(row[run_column])
            runs_data[run_name] = {}
            for stage in stage_columns:
                runs_data[run_name][stage] = str(row.get(stage, '')).strip()
        
        # Sort runs (first run is index 0)
        sorted_runs = list(runs_data.keys())
        logger.info(f"Processing runs in order: {sorted_runs}")
        
        # Analyze each run using user's logic
        for i, current_run in enumerate(sorted_runs):
            
            if i == 0:
                # First run: display all stages (starting run)
                logger.info(f"{current_run}: First run - display all stages")
                branch_patterns[current_run] = {
                    'type': 'first_run',
                    'display_all': True,
                    'copied_stages': {},
                    'new_stages': []
                }
                continue
            
            current_data = runs_data[current_run]
            copied_stages = {}
            
            # Check if this run copies data from ANY previous run
            for stage in stage_columns:
                current_value = current_data[stage]
                
                if not current_value:  # Skip empty stages
                    continue
                
                # Look for this exact value in previous runs
                for prev_run in sorted_runs[:i]:
                    prev_data = runs_data[prev_run]
                    
                    for prev_stage in stage_columns:
                        prev_value = prev_data[prev_stage]
                        
                        if prev_value and current_value == prev_value:
                            # Found exact match - this is copied data
                            copied_stages[stage] = {
                                'source_run': prev_run,
                                'source_stage': prev_stage,
                                'value': current_value,
                                'stage_index': stage_columns.index(stage),
                                'source_stage_index': stage_columns.index(prev_stage)
                            }
                            logger.info(f"{current_run}.{stage} = '{current_value}' (copied from {prev_run}.{prev_stage})")
                            break
                    
                    if stage in copied_stages:
                        break
            
            # Determine run type based on copied data
            if not copied_stages:
                # No copied data: independent run - display all stages
                logger.info(f"{current_run}: Independent run - display all stages")
                branch_patterns[current_run] = {
                    'type': 'independent_run',
                    'display_all': True,
                    'copied_stages': {},
                    'new_stages': []
                }
            else:
                # Has copied data: branching run
                logger.info(f"{current_run}: Branching run - copied {len(copied_stages)} stages")
                
                # Find new stages (not copied)
                new_stages = []
                for stage in stage_columns:
                    if current_data[stage] and stage not in copied_stages:
                        new_stages.append({
                            'stage': stage,
                            'value': current_data[stage],
                            'stage_index': stage_columns.index(stage)
                        })
                
                # Find LAST copied stage (highest index)
                last_copied_stage = None
                last_copied_index = -1
                for stage, copy_info in copied_stages.items():
                    if copy_info['stage_index'] > last_copied_index:
                        last_copied_index = copy_info['stage_index']
                        last_copied_stage = copy_info
                
                branch_patterns[current_run] = {
                    'type': 'branching_run',
                    'display_all': False,
                    'copied_stages': copied_stages,
                    'new_stages': new_stages,
                    'last_copied_stage': last_copied_stage
                }
        
        return {
            'runs_data': runs_data,
            'branch_patterns': branch_patterns,
            'sorted_runs': sorted_runs,
            'stage_columns': stage_columns
        }
    
    def _generate_layout(self, analysis: Dict[str, Any], stage_columns: List[str], username: str) -> Dict[str, Any]:
        """Generate visualization layout"""
        
        runs_data = analysis['runs_data']
        branch_patterns = analysis['branch_patterns']
        sorted_runs = analysis['sorted_runs']
        
        nodes = []
        connections = []
        
        # Layout settings
        node_width = 120
        node_height = 60
        spacing_x = 200
        spacing_y = 120
        
        # Stage colors
        stage_colors = {
            'floorplan': '#E74C3C',
            'place': '#3498DB', 
            'cts': '#F39C12',
            'route': '#27AE60'
        }
        
        def get_stage_color(stage_name: str) -> str:
            stage_lower = stage_name.lower()
            for pattern, color in stage_colors.items():
                if pattern in stage_lower:
                    return color
            return '#34495E'
        
        # Generate nodes for each run
        for run_idx, run_name in enumerate(sorted_runs):
            pattern = branch_patterns[run_name]
            run_data = runs_data[run_name]
            
            base_y = 100 + (run_idx * spacing_y)
            
            if pattern['display_all']:
                # Display all stages for this run
                for stage_idx, stage in enumerate(stage_columns):
                    stage_value = run_data[stage]
                    if stage_value:  # Only create nodes for non-empty stages
                        node_id = f"{run_name}_{stage}"
                        x_pos = 100 + (stage_idx * spacing_x)
                        
                        nodes.append({
                            'id': node_id,
                            'label': stage_value,
                            'x': x_pos,
                            'y': base_y,
                            'type': 'stage',
                            'run': run_name,
                            'stage': stage,
                            'stage_name': stage,
                            'stage_index': stage_idx,
                            'value': stage_value,
                            'is_branch': pattern['type'] == 'branching_run',
                            'style': {
                                'width': node_width,
                                'height': node_height,
                                'fill': get_stage_color(stage),
                                'stroke': '#FFD700' if pattern['type'] == 'branching_run' else 'white',
                                'strokeWidth': 3 if pattern['type'] == 'branching_run' else 2,
                                'cornerRadius': 8,
                                'fontSize': 12,
                                'textColor': 'white',
                                'fontWeight': 'bold'
                            }
                        })
            else:
                # Branching run: only display NEW stages (skip copied ones)
                for new_stage in pattern['new_stages']:
                    stage = new_stage['stage']
                    stage_value = new_stage['value']
                    stage_idx = new_stage['stage_index']
                    
                    node_id = f"{run_name}_{stage}"
                    x_pos = 100 + (stage_idx * spacing_x)
                    
                    nodes.append({
                        'id': node_id,
                        'label': stage_value,
                        'x': x_pos,
                        'y': base_y,
                        'type': 'stage',
                        'run': run_name,
                        'stage': stage,
                        'stage_name': stage,
                        'stage_index': stage_idx,
                        'value': stage_value,
                        'is_branch': True,
                        'style': {
                            'width': node_width,
                            'height': node_height,
                            'fill': get_stage_color(stage),
                            'stroke': '#FFD700',
                            'strokeWidth': 3,
                            'cornerRadius': 8,
                            'fontSize': 12,
                            'textColor': 'white',
                            'fontWeight': 'bold'
                        }
                    })
        
        # Generate connections
        node_dict = {node['id']: node for node in nodes}
        
        for run_idx, run_name in enumerate(sorted_runs):
            pattern = branch_patterns[run_name]
            
            if pattern['display_all']:
                # Linear connections within the run
                run_nodes = [n for n in nodes if n['run'] == run_name]
                run_nodes.sort(key=lambda x: x['stage_index'])
                
                for i in range(len(run_nodes) - 1):
                    connections.append({
                        'from': run_nodes[i]['id'],
                        'to': run_nodes[i + 1]['id'],
                        'type': 'straight',
                        'connection_category': 'linear',
                        'style': {
                            'stroke': '#3498DB',
                            'strokeWidth': 3,
                            'arrowSize': 10
                        }
                    })
            else:
                # Branching run: create branch connection from LAST copied stage to FIRST new stage
                last_copied = pattern['last_copied_stage']
                new_stages = pattern['new_stages']
                
                if last_copied and new_stages:
                    # Source node (last copied stage)
                    source_run = last_copied['source_run']
                    source_stage = last_copied['source_stage']
                    source_node_id = f"{source_run}_{source_stage}"
                    
                    # Target node (first new stage)
                    first_new_stage = min(new_stages, key=lambda x: x['stage_index'])
                    target_node_id = f"{run_name}_{first_new_stage['stage']}"
                    
                    # Create branch connection
                    if source_node_id in node_dict and target_node_id in node_dict:
                        connections.append({
                            'from': source_node_id,
                            'to': target_node_id,
                            'type': 'curved',
                            'connection_category': 'branch',
                            'style': {
                                'stroke': '#FFD700',
                                'strokeWidth': 4,
                                'arrowSize': 12,
                                'strokeDasharray': '8,4'
                            }
                        })
                        logger.info(f"Branch connection: {source_node_id} -> {target_node_id}")
                
                # Linear connections within new stages
                if len(new_stages) > 1:
                    new_stages.sort(key=lambda x: x['stage_index'])
                    for i in range(len(new_stages) - 1):
                        from_id = f"{run_name}_{new_stages[i]['stage']}"
                        to_id = f"{run_name}_{new_stages[i + 1]['stage']}"
                        
                        connections.append({
                            'from': from_id,
                            'to': to_id,
                            'type': 'straight',
                            'connection_category': 'branch_linear',
                            'style': {
                                'stroke': '#FFD700',
                                'strokeWidth': 3,
                                'arrowSize': 10
                            }
                        })
        
        # Calculate layout dimensions
        max_x = max([n['x'] for n in nodes]) + node_width + 100 if nodes else 800
        max_y = max([n['y'] for n in nodes]) + node_height + 100 if nodes else 600
        
        return {
            'nodes': nodes,
            'connections': connections,
            'layout': {
                'width': max_x,
                'height': max_y,
                'scrollable': True,
                'background': {
                    'color': 'black',
                    'gridSize': 50,
                    'gridColor': 'gray',
                    'gridOpacity': 0.3
                }
            },
            'branch_analysis': branch_patterns,
            'metadata': {
                'username': username,
                'stage_names': stage_columns,
                'total_runs': len(sorted_runs),
                'total_stages': len(stage_columns)
            }
        }

def analyze_branch_view(file_path: str) -> Dict[str, Any]:
    """Main function to analyze branch view"""
    analyzer = SimpleBranchAnalyzer()
    return analyzer.analyze_csv(file_path)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        result = analyze_branch_view(sys.argv[1])
        print(json.dumps(result, indent=2))
    else:
        print("Usage: python simple_branch_analyzer.py <csv_file>")