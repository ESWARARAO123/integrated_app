#!/usr/bin/env python3.12
"""
Database Table Viewer - Simple Resource Dashboard
Displays data from demo database tables
"""

import json
import psycopg2
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

# Database configuration
DB_HOST = "172.16.16.21"
DB_PORT = "5432"
DB_NAME = "demo"
DB_USER = "postgres"
DB_PASSWORD = "root"

class DatabaseManager:
    """Manages database connections and queries"""
    
    def __init__(self):
        self.connection = None
        self.connect()
    
    def connect(self):
        """Establish database connection"""
        try:
            self.connection = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD
            )
            print("✅ Database connection established")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            self.connection = None
    
    def get_tables(self):
        """Get all tables from the database"""
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            tables = [row[0] for row in cursor.fetchall()]
            cursor.close()
            return tables
        except Exception as e:
            print(f"Error getting tables: {e}")
            return []
    
    def get_table_data(self, table_name, limit=100):
        """Get data from a specific table"""
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            cursor.execute(f"SELECT * FROM {table_name} ORDER BY id DESC LIMIT {limit}")
            
            # Get column names
            columns = [desc[0] for desc in cursor.description]
            
            # Get data
            rows = cursor.fetchall()
            cursor.close()
            
            return {
                'columns': columns,
                'data': rows
            }
        except Exception as e:
            print(f"Error getting table data: {e}")
            return {'columns': [], 'data': []}
    
    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()

class DashboardHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the dashboard"""
    
    def __init__(self, *args, db_manager=None, **kwargs):
        self.db_manager = db_manager
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        """Handle GET requests"""
        try:
            parsed_path = urllib.parse.urlparse(self.path)
            path = parsed_path.path
            
            if path == '/':
                self.send_dashboard_page()
            elif path == '/api/tables':
                self.send_tables_list()
            elif path == '/api/table-data':
                self.send_table_data()
            elif path == '/static/style.css':
                self.send_css()
            elif path == '/static/script.js':
                self.send_javascript()
            else:
                self.send_error(404, "Not Found")
                
        except Exception as e:
            print(f"Error handling request: {e}")
            self.send_error(500, str(e))
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def send_dashboard_page(self):
        """Send the main dashboard HTML page"""
        html = self._get_dashboard_html()
        
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))
    
    def send_tables_list(self):
        """Send list of available tables"""
        try:
            tables = self.db_manager.get_tables()
            response = {
                'success': True,
                'tables': tables
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def send_table_data(self):
        """Send data from selected table"""
        try:
            parsed_path = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_path.query)
            table_name = query_params.get('table', [''])[0]
            
            if not table_name:
                self.send_error(400, "Table name required")
                return
            
            data = self.db_manager.get_table_data(table_name)
            response = {
                'success': True,
                'table': table_name,
                'columns': data['columns'],
                'data': data['data']
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            self.wfile.write(json.dumps(response, default=str).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def send_css(self):
        """Send CSS styles"""
        css = self._get_css()
        
        self.send_response(200)
        self.send_header('Content-type', 'text/css')
        self.end_headers()
        self.wfile.write(css.encode('utf-8'))
    
    def send_javascript(self):
        """Send JavaScript code"""
        js = self._get_javascript()
        
        self.send_response(200)
        self.send_header('Content-type', 'application/javascript')
        self.end_headers()
        self.wfile.write(js.encode('utf-8'))
    
    def _get_dashboard_html(self):
        """Generate the main dashboard HTML"""
        return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Table Viewer</title>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>
    <div class="dashboard">
        <header class="dashboard-header">
            <h1>📊 Database Table Viewer</h1>
            <div class="header-controls">
                <div class="table-selector">
                    <label for="table-select">Select Table:</label>
                    <select id="table-select" onchange="loadTableData()">
                        <option value="">Choose a table...</option>
                    </select>
                </div>
            </div>
        </header>
        
        <div class="dashboard-content">
            <div class="data-container">
                <div id="table-info" class="table-info">
                    <p>Select a table from the dropdown above to view data</p>
                </div>
                <div id="data-table" class="data-table-container">
                    <!-- Table data will be loaded here -->
                </div>
            </div>
        </div>
    </div>
    
    <script src="/static/script.js"></script>
</body>
</html>
"""
    
    def _get_css(self):
        """Generate CSS styles"""
        return """
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
}

.dashboard {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}

.dashboard-header {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
}

.dashboard-header h1 {
    color: #2c3e50;
    font-size: 2rem;
    font-weight: 700;
}

.header-controls {
    display: flex;
    align-items: center;
    gap: 15px;
}

.table-selector {
    display: flex;
    align-items: center;
    gap: 10px;
}

.table-selector label {
    font-weight: 600;
    color: #34495e;
}

#table-select {
    padding: 10px 15px;
    border: 2px solid #3498db;
    border-radius: 8px;
    background: white;
    font-size: 14px;
    min-width: 200px;
    cursor: pointer;
    transition: all 0.3s ease;
}

#table-select:focus {
    outline: none;
    border-color: #2980b9;
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.dashboard-content {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.data-container {
    width: 100%;
}

.table-info {
    text-align: center;
    padding: 40px;
    color: #7f8c8d;
    font-size: 16px;
}

.data-table-container {
    overflow-x: auto;
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    font-size: 13px;
}

.data-table th {
    background: linear-gradient(135deg, #3498db, #2980b9);
    color: white;
    padding: 12px 8px;
    text-align: left;
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 10;
}

.data-table td {
    padding: 10px 8px;
    border-bottom: 1px solid #ecf0f1;
    word-break: break-word;
}

.data-table tr:nth-child(even) {
    background-color: #f8f9fa;
}

.data-table tr:hover {
    background-color: #e3f2fd;
    transition: background-color 0.2s ease;
}

.loading {
    text-align: center;
    padding: 40px;
    color: #7f8c8d;
}

.loading::after {
    content: '';
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-left: 10px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.error {
    text-align: center;
    padding: 40px;
    color: #e74c3c;
    background: #fdf2f2;
    border-radius: 8px;
    border: 1px solid #fecaca;
}

@media (max-width: 768px) {
    .dashboard {
        padding: 10px;
    }
    
    .dashboard-header {
        flex-direction: column;
        text-align: center;
    }
    
    .dashboard-header h1 {
        font-size: 1.5rem;
    }
    
    .header-controls {
        width: 100%;
        justify-content: center;
    }
    
    #table-select {
        min-width: 150px;
    }
    
    .data-table {
        font-size: 11px;
    }
    
    .data-table th,
    .data-table td {
        padding: 8px 4px;
    }
}
"""
    
    def _get_javascript(self):
        """Generate JavaScript for dashboard functionality"""
        return """
document.addEventListener('DOMContentLoaded', function() {
    loadTables();
});

async function loadTables() {
    try {
        const response = await fetch('/api/tables');
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('table-select');
            select.innerHTML = '<option value="">Choose a table...</option>';
            
            data.tables.forEach(table => {
                const option = document.createElement('option');
                option.value = table;
                option.textContent = table;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading tables:', error);
        showError('Failed to load tables');
    }
}

async function loadTableData() {
    const tableSelect = document.getElementById('table-select');
    const tableName = tableSelect.value;
    
    if (!tableName) {
        showTableInfo('Select a table from the dropdown above to view data');
        return;
    }
    
    showLoading('Loading table data...');
    
    try {
        const response = await fetch(`/api/table-data?table=${encodeURIComponent(tableName)}`);
        const data = await response.json();
        
        if (data.success) {
            displayTableData(data);
        } else {
            showError('Failed to load table data');
        }
    } catch (error) {
        console.error('Error loading table data:', error);
        showError('Failed to load table data');
    }
}

function displayTableData(data) {
    const container = document.getElementById('data-table');
    const tableInfo = document.getElementById('table-info');
    
    if (!data.data || data.data.length === 0) {
        showTableInfo(`No data found in table '${data.table}'`);
        return;
    }
    
    let tableHTML = '<table class="data-table">';
    
    // Header row
    tableHTML += '<thead><tr>';
    data.columns.forEach(column => {
        tableHTML += `<th>${column}</th>`;
    });
    tableHTML += '</tr></thead>';
    
    // Data rows
    tableHTML += '<tbody>';
    data.data.forEach(row => {
        tableHTML += '<tr>';
        row.forEach(cell => {
            let displayValue = cell;
            if (cell === null || cell === undefined) {
                displayValue = '';
            } else if (typeof cell === 'number') {
                if (cell % 1 === 0) {
                    displayValue = cell.toLocaleString();
                } else {
                    displayValue = parseFloat(cell).toFixed(2);
                }
            } else if (typeof cell === 'string') {
                if (cell.length > 50) {
                    displayValue = cell.substring(0, 47) + '...';
                }
            }
            tableHTML += `<td title="${cell}">${displayValue}</td>`;
        });
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';
    
    tableInfo.style.display = 'none';
    container.innerHTML = tableHTML;
    
    const rowCount = data.data.length;
    const columnCount = data.columns.length;
    showTableInfo(`Table: ${data.table} | Rows: ${rowCount} | Columns: ${columnCount}`);
}

function showLoading(message) {
    const container = document.getElementById('data-table');
    const tableInfo = document.getElementById('table-info');
    
    tableInfo.style.display = 'none';
    container.innerHTML = `<div class="loading">${message}</div>`;
}

function showError(message) {
    const container = document.getElementById('data-table');
    const tableInfo = document.getElementById('table-info');
    
    tableInfo.style.display = 'none';
    container.innerHTML = `<div class="error">❌ ${message}</div>`;
}

function showTableInfo(message) {
    const tableInfo = document.getElementById('table-info');
    const container = document.getElementById('data-table');
    
    tableInfo.style.display = 'block';
    tableInfo.innerHTML = `<p>${message}</p>`;
    container.innerHTML = '';
}
"""

def create_dashboard_handler(db_manager):
    """Create a handler class with database manager"""
    class Handler(DashboardHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, db_manager=db_manager, **kwargs)
    return Handler

def start_dashboard(port=8005, host='localhost'):
    """Start the web dashboard"""
    db_manager = DatabaseManager()
    handler_class = create_dashboard_handler(db_manager)
    server = HTTPServer((host, port), handler_class)
    
    print(f"🚀 Starting Database Table Viewer...")
    print(f"📊 Dashboard URL: http://{host}:{port}")
    print(f"🗄️  Database: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    print(f"🔄 Press Ctrl+C to stop")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Stopping dashboard...")
        db_manager.close()
        server.shutdown()
        print("✅ Dashboard stopped")

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Database Table Viewer')
    parser.add_argument('--port', type=int, default=8005, help='Port to run the dashboard on')
    parser.add_argument('--host', default='localhost', help='Host to bind to')
    
    args = parser.parse_args()
    start_dashboard(args.port, args.host)

if __name__ == "__main__":
    main() 
