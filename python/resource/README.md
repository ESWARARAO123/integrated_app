# Database Table Viewer

A simple web-based dashboard for viewing data from PostgreSQL database tables.

## Features

- **Database Connectivity**: Connects to PostgreSQL database at `172.16.16.21:5432`
- **Table Discovery**: Automatically discovers all tables in the database
- **Data Display**: Shows table data in a clean, responsive format
- **Simple Interface**: Clean dropdown selector and table view

## Database Configuration

- **Host**: 172.16.16.21
- **Port**: 5432
- **Database**: demo
- **User**: postgres
- **Password**: root

## Usage

### Local Development

1. Install dependencies:
   ```bash
   pip install psycopg2-binary==2.9.9
   ```

2. Start the dashboard:
   ```bash
   python web_dashboard.py --port 8005 --host localhost
   ```

3. Or use the startup script:
   ```bash
   ./start_simple_dashboard.sh
   ```

4. Access the dashboard at: http://localhost:8005

### Docker

The dashboard is available as a Docker container in the main Docker Compose setup:

```bash
cd /home/eswar/PinnacleAi/Docker
docker compose up -d resource-server
```

Access at: http://localhost:8005

## API Endpoints

- `GET /` - Main dashboard page
- `GET /api/tables` - Get list of available tables
- `GET /api/table-data?table=<table_name>` - Get data from specific table
- `GET /static/style.css` - CSS styles
- `GET /static/script.js` - JavaScript functionality

## File Structure

```
python/resource/
├── web_dashboard.py          # Main application
├── requirements.txt          # Python dependencies
├── start_simple_dashboard.sh # Startup script
└── README.md                # This file
```

## Features Removed

This simplified version removes all the complex resource monitoring features:
- ❌ Real-time system monitoring
- ❌ Auto-refresh functionality
- ❌ Network scanning
- ❌ Multi-server management
- ❌ Charts and graphs
- ❌ Complex configuration

## Focus

This dashboard focuses solely on:
- ✅ Database table discovery
- ✅ Table data display
- ✅ Clean, simple interface
- ✅ Responsive design 