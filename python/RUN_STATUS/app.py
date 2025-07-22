from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import os
import logging
import numpy as np
import psycopg2
from psycopg2 import pool
from enhanced_layout_generator import analyze_and_generate_advanced_layout
from branch_analyzer import analyze_branch_view
from rtl_analyzer import analyze_rtl_view

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Database configuration - Docker-aware with proper fallbacks
def get_database_config():
    """Get database configuration with Docker-aware fallbacks"""
    # Check if running in Docker
    is_docker = os.path.exists('/.dockerenv')
    
    # For Docker environment, use host machine IP as fallback
    # For local development, use localhost as fallback
    default_host = os.getenv('HOST_MACHINE_IP', '172.16.16.23') if is_docker else 'localhost'
    
    return {
        'host': os.getenv('DATABASE_HOST') or os.getenv('POSTGRES_HOST') or default_host,
        'port': int(os.getenv('DATABASE_PORT') or os.getenv('POSTGRES_PORT') or '5432'),
        'database': os.getenv('DATABASE_NAME') or os.getenv('POSTGRES_DB') or 'copilot',
        'user': os.getenv('DATABASE_USER') or os.getenv('POSTGRES_USER') or 'postgres',
        'password': os.getenv('DATABASE_PASSWORD') or os.getenv('POSTGRES_PASSWORD') or 'root'
    }

DB_CONFIG = get_database_config()

# Log environment detection and configuration
is_docker = os.path.exists('/.dockerenv')
logger.info(f"RunStatus Environment: {'Docker' if is_docker else 'Local'}")
logger.info(f"RunStatus Database configuration: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
logger.info(f"RunStatus Database user: {DB_CONFIG['user']}")

# Initialize database connection pool
db_pool = None

def init_database():
    """Initialize database connection and verify connectivity"""
    global db_pool
    try:
        # Create connection pool
        db_pool = psycopg2.pool.SimpleConnectionPool(
            1, 20,  # min and max connections
            host=DB_CONFIG['host'],
            port=DB_CONFIG['port'],
            database=DB_CONFIG['database'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password']
        )

        # Test connection
        conn = db_pool.getconn()
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        result = cursor.fetchone()
        cursor.close()
        db_pool.putconn(conn)

        logger.info("RunStatus database connection established successfully")
        return True

    except Exception as e:
        logger.error(f"RunStatus database connection failed: {e}")
        return False

def get_db_connection():
    """Get a database connection from the pool"""
    if db_pool:
        return db_pool.getconn()
    return None

def return_db_connection(conn):
    """Return a database connection to the pool"""
    if db_pool and conn:
        db_pool.putconn(conn)

# Health check endpoint for Docker
@app.route('/health')
def health_check():
    db_status = "connected" if db_pool else "disconnected"
    return jsonify({
        "status": "healthy",
        "service": "runstatus",
        "database": db_status,
        "config": {
            "host": DB_CONFIG['host'],
            "port": DB_CONFIG['port'],
            "database": DB_CONFIG['database']
        }
    }), 200

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def convert_to_json_serializable(obj):
    """Convert numpy/pandas types to JSON serializable types"""
    if isinstance(obj, dict):
        return {key: convert_to_json_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_json_serializable(item) for item in obj]
    elif isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif pd.isna(obj):
        return None
    else:
        return obj

def read_data_file(file_path):
    """Read data from either CSV or Excel file based on extension - Model-based approach"""
    try:
        file_ext = os.path.splitext(file_path)[1].lower()
        logger.info(f"Reading file with extension: {file_ext}")
        
        if file_ext == '.csv':
            df = pd.read_csv(file_path)
        elif file_ext in ['.xls', '.xlsx']:
            df = pd.read_excel(file_path)
        else:
            raise ValueError("Unsupported file format. Please upload a CSV or Excel file.")
        
        # Clean up column names - remove whitespace and make consistent
        df.columns = [col.strip() for col in df.columns]
        
        # Basic validation - ensure we have at least 3 columns
        if len(df.columns) < 3:
            raise ValueError("Data must have at least 3 columns for analysis")
        
        # Clean up data - remove whitespace from all string columns
        for col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].astype(str).str.strip()
        
        # Check for completely empty data
        if df.empty:
            raise ValueError("File contains no data")
        
        # Check for null values in all columns
        null_columns = df.columns[df.isnull().any()].tolist()
        if null_columns:
            logger.warning(f"Found null values in columns: {null_columns}")
            # Fill null values with empty string for analysis
            df = df.fillna('')
        
        logger.info(f"Successfully read file with {len(df)} rows and {len(df.columns)} columns")
        logger.info(f"Columns: {list(df.columns)}")
        return df
        
    except Exception as e:
        logger.error(f"Error reading file: {str(e)}")
        raise

@app.route('/')
def serve_frontend():
    return jsonify({
        "service": "RunStatus API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": [
            "/health",
            "/upload",
            "/upload-branch", 
            "/upload-rtl"
        ]
    })

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            logger.error("No file part in request")
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if not file.filename:
            logger.error("No file selected")
            return jsonify({'error': 'No file selected'}), 400
            
        logger.info(f"Processing file: {file.filename}")
        
        # Save file
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(file_path)
        logger.info(f"File saved to: {file_path}")

        try:
            # Generate visualization using advanced model-based analysis
            logger.info("Analyzing multi-sheet data structure and generating advanced visualization layout...")
            layout_data = analyze_and_generate_advanced_layout(file_path)
            
            if not layout_data or not layout_data.get("nodes"):
                logger.error("Failed to generate valid layout")
                return jsonify({
                    'error': 'Failed to generate visualization',
                    'details': 'No valid layout data generated'
                }), 500
            
            # Convert numpy/pandas types to JSON serializable types
            layout_data = convert_to_json_serializable(layout_data)
            
            logger.info(f"Successfully generated layout with {len(layout_data['nodes'])} nodes")
            return jsonify(layout_data)

        except ValueError as ve:
            logger.error(f"Validation error: {str(ve)}")
            return jsonify({'error': str(ve)}), 400
        except Exception as e:
            logger.error(f"Processing error: {str(e)}")
            return jsonify({
                'error': 'Error processing file',
                'details': str(e)
            }), 500
        finally:
            # Clean up uploaded file
            try:
                os.remove(file_path)
                logger.info(f"Cleaned up file: {file_path}")
            except:
                pass

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/upload-branch', methods=['POST'])
def upload_file_branch():
    """Upload and analyze file for branch view"""
    try:
        if 'file' not in request.files:
            logger.error("No file part in request")
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if not file.filename:
            logger.error("No file selected")
            return jsonify({'error': 'No file selected'}), 400
            
        logger.info(f"Processing file for branch view: {file.filename}")
        
        # Save file
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(file_path)
        logger.info(f"File saved to: {file_path}")

        try:
            # Generate branch visualization
            logger.info("Analyzing data for branch view patterns...")
            layout_data = analyze_branch_view(file_path)
            
            if not layout_data or not layout_data.get("nodes"):
                logger.error("Failed to generate valid branch layout")
                return jsonify({
                    'error': 'Failed to generate branch visualization',
                    'details': 'No valid branch layout data generated'
                }), 500
            
            # Convert numpy/pandas types to JSON serializable types
            layout_data = convert_to_json_serializable(layout_data)
            
            logger.info(f"Successfully generated branch layout with {len(layout_data['nodes'])} nodes")
            return jsonify(layout_data)

        except ValueError as ve:
            logger.error(f"Branch analysis validation error: {str(ve)}")
            return jsonify({'error': str(ve)}), 400
        except Exception as e:
            logger.error(f"Branch analysis processing error: {str(e)}")
            return jsonify({
                'error': 'Error processing file for branch view',
                'details': str(e)
            }), 500
        finally:
            # Clean up uploaded file
            try:
                os.remove(file_path)
                logger.info(f"Cleaned up file: {file_path}")
            except:
                pass

    except Exception as e:
        logger.error(f"Unexpected error in branch upload: {str(e)}")
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/upload-rtl', methods=['POST'])
def upload_file_rtl():
    """Upload and analyze file for RTL view"""
    try:
        if 'file' not in request.files:
            logger.error("No file part in request")
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if not file.filename:
            logger.error("No file selected")
            return jsonify({'error': 'No file selected'}), 400
            
        logger.info(f"Processing file for RTL view: {file.filename}")
        
        # Save file
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(file_path)
        logger.info(f"File saved to: {file_path}")

        try:
            # Generate RTL visualization
            logger.info("Analyzing data for RTL view patterns...")
            layout_data = analyze_rtl_view(file_path)
            
            if not layout_data:
                logger.error("Failed to generate valid RTL layout")
                return jsonify({
                    'error': 'Failed to generate RTL visualization',
                    'details': 'No valid RTL layout data generated'
                }), 500
            
            # Convert numpy/pandas types to JSON serializable types
            layout_data = convert_to_json_serializable(layout_data)
            
            logger.info(f"Successfully generated RTL layout with {len(layout_data.get('rtl_versions', []))} versions")
            return jsonify(layout_data)

        except ValueError as ve:
            logger.error(f"RTL analysis validation error: {str(ve)}")
            return jsonify({'error': str(ve)}), 400
        except Exception as e:
            logger.error(f"RTL analysis processing error: {str(e)}")
            return jsonify({
                'error': 'Error processing file for RTL view',
                'details': str(e)
            }), 500
        finally:
            # Clean up uploaded file
            try:
                os.remove(file_path)
                logger.info(f"Cleaned up file: {file_path}")
            except:
                pass

    except Exception as e:
        logger.error(f"Unexpected error in RTL upload: {str(e)}")
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

# Application initialization flag
_app_initialized = False

def initialize_app():
    """Initialize the application"""
    global _app_initialized
    if not _app_initialized:
        logger.info("Initializing RunStatus database connection...")
        db_connected = init_database()
        if db_connected:
            logger.info("RunStatus database connection successful")
        else:
            logger.warning("RunStatus database connection failed - some features may not work")
        _app_initialized = True

@app.before_request
def ensure_app_initialized():
    """Ensure app is initialized before handling requests"""
    initialize_app()

if __name__ == '__main__':
    # Initialize database connection immediately
    initialize_app()

    # Get configuration from environment variables for Docker compatibility
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', '5003'))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    if os.environ.get('FLASK_ENV', 'production') != 'production':
        debug = True

    logger.info(f"Starting RunStatus server on {host}:{port} (debug={debug})")
    app.run(host=host, port=port, debug=debug)