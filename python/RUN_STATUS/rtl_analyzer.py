"""
RTL View Analyzer - Intelligent RTL version-based branching analysis
Analyzes data to detect RTL versions and creates version-specific branching visualizations
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

class RTLViewAnalyzer:
    """Analyzes data for RTL version-based branching patterns"""
    
    def __init__(self):
        self.rtl_versions = {}
        self.version_data = {}
        self.branch_patterns = {}
    
    def _read_csv_fallback(self, file_path: str) -> Dict[str, List[Dict[str, str]]]:
        """Fallback CSV reader when pandas is not available"""
        with open(file_path, 'r', newline='', encoding='utf-8') as f:
            reader = csv.reader(f)
            data = list(reader)
        
        if not data:
            return {}
        
        # Use first row as headers
        headers = [col.strip() for col in data[0]]
        all_rows = []
        
        # Process remaining rows as data
        for row_idx, row_data in enumerate(data[1:], 1):
            if not row_data or not any(cell.strip() for cell in row_data):
                continue  # Skip empty rows
            
            # Create a row dict with proper column names
            row_dict = {}
            for col_idx, value in enumerate(row_data):
                if col_idx < len(headers):
                    col_name = headers[col_idx]
                    row_dict[col_name] = value.strip() if value else ''
            
            if any(row_dict.values()):  # Skip empty rows
                all_rows.append(row_dict)
        
        return {'main': all_rows}

    def analyze_rtl_patterns(self, file_path: str) -> Dict[str, Any]:
        """Main function to analyze data and generate RTL view"""
        try:
            logger.info(f"Analyzing RTL patterns for: {file_path}")
            
            # Read data with fallback support
            if HAS_PANDAS and file_path.endswith(('.xlsx', '.xls')):
                # Use pandas for Excel files
                wb = openpyxl.load_workbook(file_path)
                sheets_data = {}
                for sheet_name in wb.sheetnames:
                    df = pd.read_excel(file_path, sheet_name=sheet_name)
                    # Clean up column names
                    df.columns = [col.strip() for col in df.columns]
                    for col in df.columns:
                        if df[col].dtype == 'object':
                            df[col] = df[col].astype(str).str.strip()
                    df = df.dropna(how='all')
                    if not df.empty:
                        sheets_data[sheet_name] = df
            elif HAS_PANDAS:
                # Use pandas for CSV files
                df = pd.read_csv(file_path)
                # Clean up column names
                df.columns = [col.strip() for col in df.columns]
                sheets_data = {'main': df}
            else:
                # Fallback CSV reader
                sheets_data = self._read_csv_fallback(file_path)
            
            # Check if RTL_version column exists
            first_sheet_data = list(sheets_data.values())[0]
            
            # Get column names
            if HAS_PANDAS and hasattr(first_sheet_data, 'columns'):
                columns = first_sheet_data.columns.tolist()
            else:
                # Fallback: get columns from first row
                if first_sheet_data and len(first_sheet_data) > 0:
                    columns = list(first_sheet_data[0].keys())
                else:
                    raise ValueError("No data found in the file")
            
            # Check for RTL_version column (case insensitive)
            rtl_column = None
            for col in columns:
                if col.lower().replace('_', '').replace(' ', '') == 'rtlversion':
                    rtl_column = col
                    break
            
            if not rtl_column:
                raise ValueError("RTL_version column not found in the data. Please ensure your data has an RTL_version column.")
            
            # Analyze data structure
            data_analysis = self._analyze_data_structure(sheets_data, rtl_column)
            
            # Extract RTL versions
            rtl_versions = self._extract_rtl_versions(sheets_data, data_analysis)
            
            # Generate RTL view layout
            rtl_layout = self._generate_rtl_layout(sheets_data, data_analysis, rtl_versions)
            
            return rtl_layout
            
        except Exception as e:
            logger.error(f"Error in RTL pattern analysis: {e}")
            raise ValueError(f"Failed to analyze RTL patterns: {str(e)}")
    
    def _analyze_data_structure(self, sheets_data: Dict[str, Any], rtl_column: str) -> Dict[str, Any]:
        """Analyze the basic data structure to identify runs, stages, and RTL versions"""
        
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
        
        logger.info(f"Analyzing RTL data structure with columns: {columns}")
        
        # Enhanced multi-user extraction with deduplication from data
        raw_usernames = set()  # Store all found usernames before cleaning
        if all_data and len(all_data) > 0:
            logger.info(f"RTL Analyzer: Analyzing {len(all_data)} rows for multi-user extraction with deduplication")

            # First pass: Extract all potential usernames from all rows and columns
            for row in all_data:
                # Look for run_name column or similar, but also check other columns
                for col in columns:
                    row_value = str(row.get(col, ''))
                    logger.debug(f"RTL: Processing value: {row_value} from column {col}")

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
                                    logger.debug(f"RTL: Extracted full username: {extracted_username}")

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
                                logger.debug(f"RTL: Extracted username with pattern {pattern}: {cleaned_match}")

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
                logger.debug(f"RTL: Final username: {proper_case}")

            logger.info(f"RTL: Deduplicated usernames found: {usernames}")

        # Format username(s) for display
        if usernames:
            username_list = sorted(list(usernames))
            username = ', '.join(username_list)
            logger.info(f"RTL: Final extracted usernames: {username}")
        else:
            username = "System User"  # More professional than "Unknown User"
            logger.warning("RTL: No usernames could be extracted from data")
        
        # Identify run column and stage columns
        run_column = None
        stage_columns = []
        
        for col in columns:
            if col == rtl_column:
                continue  # Skip RTL version column
            elif 'run' in col.lower():
                run_column = col
            else:
                stage_columns.append(col)
        
        # If no run column found, use first non-RTL column
        if not run_column and stage_columns:
            run_column = stage_columns.pop(0)
        
        return {
            'rtl_column': rtl_column,
            'run_column': run_column,
            'stage_columns': stage_columns,
            'username': username,
            'total_columns': len(columns),
            'column_order': {stage: idx for idx, stage in enumerate(stage_columns)}
        }
    
    def _extract_rtl_versions(self, sheets_data: Dict[str, Any], data_analysis: Dict[str, Any]) -> List[str]:
        """Extract unique RTL versions from the data"""
        
        first_sheet_data = list(sheets_data.values())[0]
        rtl_column = data_analysis['rtl_column']
        
        rtl_versions = set()
        
        # Handle both pandas DataFrame and fallback dict format
        if HAS_PANDAS and hasattr(first_sheet_data, 'iterrows'):
            # Pandas DataFrame
            for _, row in first_sheet_data.iterrows():
                rtl_value = str(row[rtl_column]).strip()
                if rtl_value and rtl_value.lower() != 'nan':
                    rtl_versions.add(rtl_value)
        else:
            # Fallback dict format
            for row in first_sheet_data:
                rtl_value = str(row.get(rtl_column, '')).strip()
                if rtl_value:
                    rtl_versions.add(rtl_value)
        
        # Sort RTL versions naturally (RTL_1, RTL_2, etc.)
        def sort_rtl_version(version):
            # Extract number from RTL version
            numbers = re.findall(r'\d+', version)
            if numbers:
                return int(numbers[0])
            return 0
        
        sorted_versions = sorted(list(rtl_versions), key=sort_rtl_version)
        logger.info(f"Found RTL versions: {sorted_versions}")
        
        return sorted_versions
    
    def _generate_rtl_layout(self, sheets_data: Dict[str, Any], data_analysis: Dict[str, Any], rtl_versions: List[str]) -> Dict[str, Any]:
        """Generate RTL view layout with version-specific branching"""
        
        first_sheet_data = list(sheets_data.values())[0]
        rtl_column = data_analysis['rtl_column']
        run_column = data_analysis['run_column']
        stage_columns = data_analysis['stage_columns']
        username = data_analysis['username']
        
        # Group data by RTL versions
        version_data = {}
        
        # Handle both pandas DataFrame and fallback dict format
        if HAS_PANDAS and hasattr(first_sheet_data, 'iterrows'):
            # Pandas DataFrame
            for _, row in first_sheet_data.iterrows():
                rtl_value = str(row[rtl_column]).strip()
                if rtl_value and rtl_value.lower() != 'nan':
                    if rtl_value not in version_data:
                        version_data[rtl_value] = []
                    
                    row_data = {}
                    for col in [run_column] + stage_columns:
                        row_data[col] = str(row[col]) if pd.notna(row[col]) else ''
                    version_data[rtl_value].append(row_data)
        else:
            # Fallback dict format
            for row in first_sheet_data:
                rtl_value = str(row.get(rtl_column, '')).strip()
                if rtl_value:
                    if rtl_value not in version_data:
                        version_data[rtl_value] = []
                    
                    row_data = {}
                    for col in [run_column] + stage_columns:
                        row_data[col] = str(row.get(col, '')) if row.get(col) else ''
                    version_data[rtl_value].append(row_data)
        
        # Generate branch analysis for each RTL version
        version_analyses = {}
        for version in rtl_versions:
            if version in version_data:
                # Import branch analyzer for individual version analysis
                from simple_branch_analyzer import SimpleBranchAnalyzer
                analyzer = SimpleBranchAnalyzer()
                
                # Convert version data to the format expected by SimpleBranchAnalyzer
                version_rows = version_data[version]
                
                # Analyze branching patterns for this version
                branch_analysis = analyzer._analyze_branching_patterns(version_rows, run_column, stage_columns)
                
                # Generate branch layout for this version
                branch_layout = analyzer._generate_layout(branch_analysis, stage_columns, username)
                
                version_analyses[version] = {
                    'data': version_data[version],
                    'copy_patterns': branch_analysis.get('branch_patterns', {}),
                    'branch_layout': branch_layout
                }
        
        return {
            'type': 'rtl_view',
            'username': username,
            'rtl_versions': rtl_versions,
            'version_analyses': version_analyses,
            'data_analysis': data_analysis,
            'total_versions': len(rtl_versions),
            'status': 'initiated'
        }

def analyze_rtl_view(file_path: str) -> Dict[str, Any]:
    """Main function to analyze and generate RTL view"""
    try:
        analyzer = RTLViewAnalyzer()
        return analyzer.analyze_rtl_patterns(file_path)
    except Exception as e:
        logger.error(f"Error in RTL view analysis: {e}")
        raise ValueError(f"Failed to generate RTL view: {str(e)}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python rtl_analyzer.py <file_path>"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    try:
        result = analyze_rtl_view(file_path)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)