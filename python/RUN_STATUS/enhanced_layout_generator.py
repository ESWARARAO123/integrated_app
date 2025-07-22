"""
Enhanced Layout Generator - Fixes GUI architecture issues
1. Proper grid size adjustment for long text
2. Correct run-to-run connections (r1 ? r2 ? r3)
3. Stage-to-stage connections (last stage of prev run ? first stage of next run)
4. User flow separation
5. Model-based connection logic (no hardcoding)
"""

import pandas as pd
import json
import logging
import re
import math
import os
from typing import Dict, List, Any, Optional, Tuple
# Removed requests import - no longer needed for AI calls
import openpyxl

logger = logging.getLogger(__name__)

# Removed AI/Ollama dependencies - using pattern-based analysis instead

class EnhancedLayoutGenerator:
    """Enhanced layout generator with proper connection logic and dynamic sizing"""
    
    def __init__(self):
        self.connection_rules = {}
        self.layout_metrics = {}
    
    def analyze_connection_patterns(self, sheets_data: Dict[str, pd.DataFrame], analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze connection patterns using pattern-based approach (no AI)"""
        
        user_col = analysis["user_column"]
        run_col = analysis["run_column"]
        stage_col = analysis["stage_column"]
        
        # Pattern-based connection analysis
        connection_rules = {
            "run_connection_logic": {
                "sequential_order": "numeric_or_alphabetic_sorting",
                "inter_run_connection": "last_stage_prev_run_to_first_stage_next_run",
                "same_stage_handling": "separate_flows_no_direct_same_stage_connections"
            },
            "stage_connection_rules": self._get_default_stage_connections(),
            "user_separation": {
                "method": "separate_y_positions",
                "spacing": "calculated_based_on_runs_per_user"
            },
            "grid_sizing": {
                "base_calculation": "max_text_length * character_width",
                "minimum_size": "ensure_readability",
                "adjustment_factor": "1.2_for_padding"
            }
        }
        
        # Use pattern-based intelligent connection analysis
        return self._intelligent_connection_analysis(sheets_data, analysis)
    
    def _get_default_stage_connections(self) -> List[Dict[str, Any]]:
        """Get default stage connection rules"""
        return [
            {"from_stage": "synthesis", "to_stage": "floorplan", "connection_type": "straight", "condition": "within_run"},
            {"from_stage": "floorplan", "to_stage": "placement", "connection_type": "straight", "condition": "within_run"},
            {"from_stage": "placement", "to_stage": "cts", "connection_type": "straight", "condition": "within_run"},
            {"from_stage": "cts", "to_stage": "routing", "connection_type": "straight", "condition": "within_run"},
            {"from_stage": "routing", "to_stage": "drc", "connection_type": "straight", "condition": "within_run"},
            {"from_stage": "drc", "to_stage": "verification", "connection_type": "straight", "condition": "within_run"},
            {"from_stage": "verification", "to_stage": "signoff", "connection_type": "straight", "condition": "within_run"}
        ]
    
    def _intelligent_connection_analysis(self, sheets_data: Dict[str, pd.DataFrame], analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Intelligent fallback connection analysis"""
        logger.info("Using intelligent connection analysis...")
        
        return {
            "run_connection_logic": {
                "sequential_order": "extract_numbers_from_run_names_and_sort",
                "inter_run_connection": "last_stage_prev_run ? first_stage_next_run",
                "same_stage_handling": "separate_flows_no_direct_same_stage_connections"
            },
            "stage_connection_rules": [
                {
                    "from_stage": "any_stage",
                    "to_stage": "next_stage_in_sequence",
                    "connection_type": "straight",
                    "condition": "within_run"
                },
                {
                    "from_stage": "last_stage_prev_run",
                    "to_stage": "first_stage_next_run", 
                    "connection_type": "curved",
                    "condition": "between_runs"
                }
            ],
            "user_separation": {
                "method": "separate_y_positions",
                "spacing": "calculated_based_on_runs_per_user"
            },
            "grid_sizing": {
                "base_calculation": "max_text_length * 8_pixels_per_char",
                "minimum_size": "120_pixels",
                "adjustment_factor": "1.3_for_padding_and_readability"
            }
        }
    
    def calculate_enhanced_layout_metrics(self, sheets_data: Dict[str, pd.DataFrame], analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate enhanced layout metrics with proper grid sizing"""
        
        user_col = analysis["user_column"]
        run_col = analysis["run_column"]
        stage_col = analysis["stage_column"]
        
        # Analyze text lengths across all data
        all_text_lengths = []
        max_text_per_column = {}
        
        for sheet_name, df in sheets_data.items():
            for col in [user_col, run_col, stage_col]:
                if col in df.columns:
                    lengths = df[col].astype(str).str.len()
                    all_text_lengths.extend(lengths.tolist())
                    max_text_per_column[f"{sheet_name}_{col}"] = lengths.max()
        
        max_text_length = max(all_text_lengths) if all_text_lengths else 10
        avg_text_length = sum(all_text_lengths) / len(all_text_lengths) if all_text_lengths else 8
        
        # MANUAL PRECISE GRID SIZING CALCULATION (No Model)
        # Analyze actual text space requirements
        
        # Font size to pixel width mapping (more accurate)
        font_size_to_char_width = {
            12: 7.2,  # 12px font = ~7.2px per character
            11: 6.6,  # 11px font = ~6.6px per character  
            10: 6.0,  # 10px font = ~6.0px per character
            9: 5.4,   # 9px font = ~5.4px per character
            8: 4.8    # 8px font = ~4.8px per character
        }
        
        # Calculate optimal node dimensions based on text length with generous padding
        if max_text_length <= 8:
            font_size = 12
            char_width = font_size_to_char_width[12]
            node_width = max(150, int(max_text_length * char_width * 2.0))  # 100% padding for comfort
        elif max_text_length <= 12:
            font_size = 11
            char_width = font_size_to_char_width[11]
            node_width = max(180, int(max_text_length * char_width * 2.0))
        elif max_text_length <= 16:
            font_size = 10
            char_width = font_size_to_char_width[10]
            node_width = max(220, int(max_text_length * char_width * 2.0))
        elif max_text_length <= 24:
            font_size = 9
            char_width = font_size_to_char_width[9]
            node_width = max(280, int(max_text_length * char_width * 2.2))  # Extra padding
        else:
            font_size = 8
            char_width = font_size_to_char_width[8]
            node_width = max(320, int(max_text_length * char_width * 2.5))  # Generous padding for very long text
        
        # Calculate node height based on text length (might need wrapping)
        estimated_text_width = max_text_length * char_width
        if estimated_text_width > node_width * 0.9:  # Text might wrap
            node_height = 70  # Taller for potential text wrapping
        else:
            node_height = 50  # Standard height
        
        # VERY LARGE GRID SIZE CALCULATION FOR TEXT FITTING
        # Grid size should be large enough to accommodate long text comfortably
        # Rule: Much larger grid for excellent text readability
        
        # Calculate estimated text width
        estimated_text_width = max_text_length * char_width
        
        # Make grid size much larger based on text length
        if max_text_length <= 10:
            grid_size = 100  # Short text, large grid
        elif max_text_length <= 15:
            grid_size = 120  # Medium text, larger grid
        elif max_text_length <= 20:
            grid_size = 140  # Long text, very large grid
        elif max_text_length <= 25:
            grid_size = 160  # Very long text, extra large grid
        elif max_text_length <= 30:
            grid_size = 180  # Extra long text, huge grid
        else:
            # For extremely long text, make grid proportional to text length
            grid_size = max(200, int(max_text_length * 6))  # 6px per character minimum
        
        # Also consider node width for additional sizing
        if node_width > 200:
            grid_size = max(grid_size, int(node_width * 0.7))  # 70% of node width
        
        # Ensure grid size is very large (much higher range)
        grid_size = max(100, min(grid_size, 300))  # Between 100px and 300px for excellent text fitting
        
        # Calculate spacing
        spacing_x = node_width + 60  # Extra space between nodes
        spacing_y = 120  # Vertical spacing between runs
        user_separation = 200  # Space between different users
        
        # Calculate total users and runs for layout sizing
        total_users = 0
        max_runs_per_user = 0
        max_stages = len(analysis.get("stages", []))
        
        for df in sheets_data.values():
            if user_col in df.columns:
                users = [u for u in df[user_col].unique() if not str(u).lower().startswith('block')]
                total_users += len(users)
                
                for user in users:
                    user_data = df[df[user_col] == user]
                    runs_count = user_data[run_col].nunique() if run_col in user_data.columns else 1
                    max_runs_per_user = max(max_runs_per_user, runs_count)
        
        # Calculate layout dimensions
        layout_width = max(1500, (max_stages + 2) * spacing_x + 200)
        layout_height = max(1000, total_users * max_runs_per_user * spacing_y + user_separation * total_users)
        
        return {
            "text_analysis": {
                "max_length": max_text_length,
                "avg_length": avg_text_length,
                "max_per_column": max_text_per_column
            },
            "node_sizing": {
                "width": node_width,
                "height": node_height,
                "font_size": font_size
            },
            "grid_sizing": {
                "size": grid_size,
                "calculation": f"Manual calculation for node_width={node_width}: grid_size={grid_size}",
                "logic": f"Text length {max_text_length} ? Node width {node_width} ? Grid size {grid_size}",
                "font_size": font_size,
                "char_width": char_width
            },
            "spacing": {
                "x": spacing_x,
                "y": spacing_y,
                "user_separation": user_separation
            },
            "layout_dimensions": {
                "width": layout_width,
                "height": layout_height
            },
            "data_metrics": {
                "total_users": total_users,
                "max_runs_per_user": max_runs_per_user,
                "max_stages": max_stages
            }
        }
    
    def generate_enhanced_layout(self, file_path: str, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate enhanced layout with proper connections and sizing"""
        
        # Read data
        if file_path.endswith(('.xlsx', '.xls')):
            wb = openpyxl.load_workbook(file_path)
            sheets_data = {}
            for sheet_name in wb.sheetnames:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                df.columns = [col.strip() for col in df.columns]
                for col in df.columns:
                    if df[col].dtype == 'object':
                        df[col] = df[col].astype(str).str.strip()
                df = df.dropna(how='all')
                if not df.empty:
                    sheets_data[sheet_name] = df
        else:
            df = pd.read_csv(file_path)
            sheets_data = {'main': df}
        
        # Analyze connection patterns
        connection_analysis = self.analyze_connection_patterns(sheets_data, analysis)
        
        # Calculate enhanced layout metrics
        layout_metrics = self.calculate_enhanced_layout_metrics(sheets_data, analysis)
        
        # Extract configuration
        user_col = analysis["user_column"]
        run_col = analysis["run_column"]
        stage_col = analysis["stage_column"]
        stages_config = {s["name"]: s for s in analysis["stages"]}
        starting_block = analysis.get("starting_block", {})
        
        # Layout parameters from metrics
        node_width = layout_metrics["node_sizing"]["width"]
        node_height = layout_metrics["node_sizing"]["height"]
        font_size = layout_metrics["node_sizing"]["font_size"]
        grid_size = layout_metrics["grid_sizing"]["size"]
        spacing_x = layout_metrics["spacing"]["x"]
        spacing_y = layout_metrics["spacing"]["y"]
        user_separation = layout_metrics["spacing"]["user_separation"]
        layout_width = layout_metrics["layout_dimensions"]["width"]
        layout_height = layout_metrics["layout_dimensions"]["height"]
        
        logger.info(f"Enhanced layout metrics: node_width={node_width}, grid_size={grid_size}, font_size={font_size}")
        
        layout_data = {
            "nodes": [],
            "connections": [],
            "layout": {
                "width": layout_width,
                "height": layout_height,
                "background": {
                    "color": "black",
                    "gridSize": grid_size,
                    "gridColor": "gray",
                    "gridOpacity": 0.3
                },
                "stage_colors": {stage: config["color"] for stage, config in stages_config.items()}
            },
            "config": {
                "node_width": node_width,
                "node_height": node_height,
                "font_size": font_size,
                "grid_size": grid_size,
                "spacing_x": spacing_x,
                "spacing_y": spacing_y,
                "dynamic_sizing": True,
                "enhanced_connections": True
            },
            "analysis": analysis,
            "connection_analysis": connection_analysis,
            "layout_metrics": layout_metrics
        }
        
        # Process each sheet
        current_y_offset = 100
        all_user_flows = {}  # Track all user flows for proper separation
        
        for sheet_idx, (sheet_name, df) in enumerate(sheets_data.items()):
            logger.info(f"Processing sheet: {sheet_name}")
            
            # Add starting block for this sheet
            if starting_block and sheet_name == starting_block.get("sheet", list(sheets_data.keys())[0]):
                block_node = {
                    "id": f"block_{sheet_name}",
                    "label": starting_block.get("label", "ETH_SBS"),
                    "x": 50,
                    "y": current_y_offset,
                    "type": "block",
                    "sheet": sheet_name,
                    "tree_id": f"tree_{sheet_name}",
                    "style": {
                        "width": node_width,
                        "height": node_height,
                        "fill": "#2C3E50",
                        "stroke": "white",
                        "strokeWidth": 3,
                        "cornerRadius": 8,
                        "fontSize": font_size,
                        "textColor": "white",
                        "fontWeight": "bold"
                    }
                }
                layout_data["nodes"].append(block_node)
            
            # Process users in this sheet
            if user_col in df.columns:
                users = [user for user in df[user_col].unique() if not str(user).lower().startswith('block')]
                
                for user_idx, user in enumerate(sorted(users)):
                    user_key = f"{sheet_name}_{user}"
                    user_data = df[df[user_col] == user]
                    
                    # Calculate user's Y position
                    user_y_offset = current_y_offset + (user_idx * user_separation)
                    
                    # Analyze runs for this user
                    runs_analysis = self._analyze_user_runs(user_data, run_col, stage_col, stages_config)
                    
                    # Store user flow for connection analysis
                    all_user_flows[user_key] = {
                        "runs": runs_analysis,
                        "y_offset": user_y_offset,
                        "sheet": sheet_name,
                        "user": user
                    }
                    
                    # Generate nodes and connections for this user
                    self._generate_user_flow(
                        layout_data, user_key, runs_analysis, stages_config,
                        user_y_offset, spacing_x, spacing_y, node_width, node_height, font_size,
                        starting_block, sheet_name
                    )
            
            # Update y_offset for next sheet
            if users:  # Only if there were users in this sheet
                current_y_offset += len(users) * user_separation + 300  # Extra space between sheets
        
        logger.info(f"Enhanced layout generated: {len(layout_data['nodes'])} nodes, {len(layout_data['connections'])} connections")
        return layout_data
    
    def _analyze_user_runs(self, user_data: pd.DataFrame, run_col: str, stage_col: str, stages_config: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze runs for a specific user"""
        
        runs_data = {}
        
        # Collect run data
        for _, row in user_data.iterrows():
            run = str(row[run_col])
            stage = str(row[stage_col])
            
            if stage not in stages_config:
                continue
            
            if run not in runs_data:
                runs_data[run] = {
                    'stages': [],
                    'first_stage': None,
                    'last_stage': None,
                    'stage_orders': []
                }
            
            if stage not in runs_data[run]['stages']:
                runs_data[run]['stages'].append(stage)
                runs_data[run]['stage_orders'].append(stages_config[stage]['order'])
        
        # Sort stages within each run and determine first/last
        for run in runs_data:
            # Sort stages by order
            stage_order_pairs = list(zip(runs_data[run]['stages'], runs_data[run]['stage_orders']))
            stage_order_pairs.sort(key=lambda x: x[1])
            
            runs_data[run]['stages'] = [stage for stage, _ in stage_order_pairs]
            runs_data[run]['first_stage'] = runs_data[run]['stages'][0] if runs_data[run]['stages'] else None
            runs_data[run]['last_stage'] = runs_data[run]['stages'][-1] if runs_data[run]['stages'] else None
        
        # Enhanced run sorting logic
        def smart_run_sort_key(run_name):
            """Smart sorting key for run names"""
            # Extract all numbers from the run name
            numbers = re.findall(r'\d+', run_name)
            if numbers:
                # Use the first number as primary sort key
                primary_num = int(numbers[0])
                # Use the run name as secondary key for stability
                return (primary_num, run_name)
            else:
                # No numbers found, sort alphabetically but put at end
                return (999999, run_name)
        
        try:
            sorted_runs = sorted(runs_data.keys(), key=smart_run_sort_key)
        except:
            sorted_runs = sorted(runs_data.keys())
        
        return {
            "runs_data": runs_data,
            "sorted_runs": sorted_runs,
            "total_runs": len(sorted_runs)
        }
    
    def _generate_user_flow(self, layout_data: Dict[str, Any], user_key: str, runs_analysis: Dict[str, Any], 
                           stages_config: Dict[str, Any], user_y_offset: int, spacing_x: int, spacing_y: int,
                           node_width: int, node_height: int, font_size: int, starting_block: Dict[str, Any], sheet_name: str):
        """Generate nodes and connections for a specific user's flow"""
        
        runs_data = runs_analysis["runs_data"]
        sorted_runs = runs_analysis["sorted_runs"]
        
        user = user_key.split('_', 1)[1]  # Extract user name from user_key
        
        # Track previous run's last node for inter-run connections
        prev_run_last_node = None
        
        for run_idx, run in enumerate(sorted_runs):
            run_data = runs_data[run]
            stages = run_data['stages']
            
            # Calculate Y position for this run
            run_y = user_y_offset + (run_idx * spacing_y)
            
            # Track previous node within this run
            prev_stage_node = None
            run_first_node = None
            run_last_node = None
            
            for stage_idx, stage in enumerate(stages):
                stage_config = stages_config[stage]
                node_id = f"{sheet_name}_{run}_{stage}_{user}"
                
                # Calculate X position based on stage order
                x_pos = spacing_x + (stage_config['order'] * spacing_x)
                
                node = {
                    "id": node_id,
                    "label": node_id,
                    "x": x_pos,
                    "y": run_y,
                    "type": "stage",
                    "stage": stage,
                    "user": user,
                    "run": run,
                    "run_index": run_idx,
                    "stage_index": stage_idx,
                    "sheet": sheet_name,
                    "tree_id": f"tree_{sheet_name}_{user}",
                    "style": {
                        "width": node_width,
                        "height": node_height,
                        "fill": stage_config["color"],
                        "stroke": "white",
                        "strokeWidth": 2,
                        "cornerRadius": 5,
                        "fontSize": font_size,
                        "textColor": "white"
                    }
                }
                layout_data["nodes"].append(node)
                
                # Track first and last nodes of this run
                if stage_idx == 0:
                    run_first_node = node
                if stage_idx == len(stages) - 1:
                    run_last_node = node
                
                # INTRA-RUN CONNECTIONS: Connect to previous stage in same run
                if prev_stage_node:
                    layout_data["connections"].append({
                        "from": prev_stage_node["id"],
                        "to": node["id"],
                        "type": "straight",
                        "connection_category": "intra_run",
                        "tree_id": f"tree_{sheet_name}_{user}",
                        "style": {
                            "stroke": "white",
                            "strokeWidth": 2,
                            "arrowSize": 8
                        }
                    })
                
                # BLOCK CONNECTION: First stage of first run connects to block
                elif run_idx == 0 and stage_idx == 0 and starting_block:
                    layout_data["connections"].append({
                        "from": f"block_{sheet_name}",
                        "to": node["id"],
                        "type": "straight",
                        "connection_category": "block_to_first",
                        "tree_id": f"tree_{sheet_name}_{user}",
                        "style": {
                            "stroke": "white",
                            "strokeWidth": 2,
                            "arrowSize": 8
                        }
                    })
                
                prev_stage_node = node
            
            # INTER-RUN CONNECTIONS: Connect last stage of previous run to first stage of current run
            if prev_run_last_node and run_first_node:
                layout_data["connections"].append({
                    "from": prev_run_last_node["id"],
                    "to": run_first_node["id"],
                    "type": "curved",
                    "connection_category": "inter_run",
                    "tree_id": f"tree_{sheet_name}_{user}",
                    "style": {
                        "stroke": "#FFD700",  # Gold color for inter-run connections
                        "strokeWidth": 3,
                        "arrowSize": 10,
                        "strokeDasharray": "5,5"  # Dashed line to distinguish
                    }
                })
            
            # Update previous run's last node
            prev_run_last_node = run_last_node

# Main function to replace the previous analyzer
def analyze_and_generate_advanced_layout(file_path: str) -> Dict[str, Any]:
    """Main function using enhanced layout generator"""
    try:
        # Import the original analyzer for basic analysis
        from data_analyzer import DataStructureAnalyzer as AdvancedDataStructureAnalyzer
        
        # Get basic analysis first
        analyzer = AdvancedDataStructureAnalyzer()
        analysis = analyzer.analyze_multi_sheet_structure(file_path)
        
        # Use enhanced layout generator
        enhanced_generator = EnhancedLayoutGenerator()
        layout_data = enhanced_generator.generate_enhanced_layout(file_path, analysis)
        
        logger.info(f"Enhanced layout generation completed successfully")
        return layout_data
        
    except Exception as e:
        logger.error(f"Error in enhanced layout generation: {e}")
        raise ValueError(f"Failed to generate enhanced layout: {str(e)}")