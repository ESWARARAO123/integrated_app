# RUN_STATUS Module Documentation

## Overview
The RUN_STATUS module is a comprehensive Flask-based web service designed to analyze and visualize data flow patterns, particularly for EDA (Electronic Design Automation) workflows. It provides intelligent data analysis using AI models and generates interactive visualizations for different view types.

## Architecture

### Core Components

```json
{
  "main_application": "app.py",
  "analyzers": [
    "data_analyzer.py",
    "branch_analyzer.py", 
    "rtl_analyzer.py",
    "simple_analyzer.py",
    "intelligent_simple_analyzer.py",
    "simple_branch_analyzer.py"
  ],
  "layout_generator": "enhanced_layout_generator.py",
  "dependencies": "requirements.txt"
}
```

## File Analysis

### 1. app.py - Main Flask Application

**Purpose**: Central web service that handles HTTP requests and coordinates different analysis modules.

**Key Features**:
- Flask web server with CORS support
- PostgreSQL database integration with connection pooling
- File upload handling (CSV/Excel)
- Multiple analysis endpoints for different view types
- Health check endpoint for Docker deployment

**Endpoints**:
```json
{
  "endpoints": [
    {
      "path": "/health",
      "method": "GET",
      "purpose": "Health check for Docker containers"
    },
    {
      "path": "/upload",
      "method": "POST", 
      "purpose": "Standard flow analysis and visualization"
    },
    {
      "path": "/upload-branch",
      "method": "POST",
      "purpose": "Branch view analysis for copied data patterns"
    },
    {
      "path": "/upload-rtl", 
      "method": "POST",
      "purpose": "RTL version-based branching analysis"
    }
  ]
}
```

**Database Configuration**:
```json
{
  "database": {
    "host": "Environment variable: DATABASE_HOST or POSTGRES_HOST",
    "port": "Environment variable: DATABASE_PORT or POSTGRES_PORT (default: 5432)",
    "database": "Environment variable: DATABASE_NAME or POSTGRES_DB (default: copilot)",
    "user": "Environment variable: DATABASE_USER or POSTGRES_USER (default: postgres)",
    "password": "Environment variable: DATABASE_PASSWORD or POSTGRES_PASSWORD (default: root)"
  }
}
```

**Runtime Configuration**:
```json
{
  "server": {
    "host": "Environment variable: FLASK_HOST (default: 0.0.0.0)",
    "port": "Environment variable: FLASK_PORT (default: 5003)",
    "debug": "Environment variable: DEBUG or FLASK_ENV != production"
  }
}
```

### 2. enhanced_layout_generator.py - Advanced Layout Engine

**Purpose**: Generates sophisticated visualizations with proper connection logic and dynamic sizing.

**Key Features**:
- AI-powered connection pattern analysis using Ollama/Mistral
- Dynamic grid sizing based on text length
- Proper run-to-run connections (r1 ? r2 ? r3)
- Stage-to-stage connections within runs
- User flow separation
- Model-based connection logic (no hardcoding)

**Core Classes**:
```json
{
  "EnhancedLayoutGenerator": {
    "methods": [
      "analyze_connection_patterns()",
      "calculate_enhanced_layout_metrics()",
      "generate_enhanced_layout()",
      "_prepare_connection_sample_data()",
      "_get_model_response()",
      "_clean_json_response()"
    ],
    "ai_integration": {
      "model": "mistral",
      "url": "http://localhost:11434/api/generate",
      "purpose": "Analyze data patterns and determine connection logic"
    }
  }
}
```

**Layout Calculation Logic**:
```json
{
  "grid_sizing": {
    "font_size_mapping": {
      "12px": "7.2px per character",
      "11px": "6.6px per character", 
      "10px": "6.0px per character",
      "9px": "5.4px per character",
      "8px": "4.8px per character"
    },
    "node_width_calculation": "max(minimum_width, text_length * char_width * padding_factor)",
    "grid_size_range": "100px to 300px based on text length",
    "spacing": {
      "horizontal": "node_width + 60px",
      "vertical": "120px between runs",
      "user_separation": "200px between different users"
    }
  }
}
```

### 3. data_analyzer.py - Core Data Structure Analyzer

**Purpose**: AI-powered analysis of data structure to identify patterns and relationships.

**Key Features**:
- LLM-based header analysis
- Username extraction from run names
- Column mapping identification
- Stage order determination
- Fallback analysis when AI fails

**Core Classes**:
```json
{
  "DataStructureAnalyzer": {
    "methods": [
      "extract_usernames_from_data()",
      "analyze_headers()",
      "_get_model_response()",
      "_clean_json_response()",
      "_validate_analysis()",
      "_fallback_analysis()"
    ],
    "username_patterns": [
      "s_girishR1 ? girish",
      "user_nameR2 ? name", 
      "girishR1 ? girish",
      "girish1 ? girish"
    ]
  }
}
```

**Analysis Output Format**:
```json
{
  "analysis_structure": {
    "user_column": "column_name_for_user",
    "run_column": "column_name_for_run",
    "stage_column": "column_name_for_stage", 
    "stages": [
      {
        "name": "stage_name",
        "order": 0,
        "color": "#hex_color",
        "description": "stage description"
      }
    ],
    "run_pattern": {
      "prefix": "r",
      "format": "r1, r2, r3...",
      "description": "run naming pattern"
    },
    "flow_logic": {
      "description": "how stages connect to each other",
      "rules": ["rule descriptions"]
    }
  }
}
```

### 4. branch_analyzer.py - Branch View Analyzer

**Purpose**: Analyzes data copying patterns to create branching visualizations.

**Key Features**:
- Detects when stages are copied from previous runs
- Creates branching visualizations based on data patterns
- Treats header row as actual data (Run 1)
- Automatic username extraction

**Core Classes**:
```json
{
  "BranchViewAnalyzer": {
    "purpose": "Detect branching patterns based on copied data",
    "logic": [
      "First row: display all stages (starting run)",
      "Check if run copies data from previous runs", 
      "If no copying: display all stages (independent run)",
      "If copying: skip copied stages, branch from last copied stage to first new stage"
    ],
    "fallback_support": "Works without pandas dependency"
  }
}
```

### 5. rtl_analyzer.py - RTL View Analyzer

**Purpose**: Analyzes RTL versions and creates version-specific branching visualizations.

**Key Features**:
- RTL version detection
- Version-specific branching patterns
- Multi-version flow analysis
- Fallback CSV reading support

**Core Classes**:
```json
{
  "RTLViewAnalyzer": {
    "purpose": "Analyze RTL version-based branching patterns",
    "features": [
      "RTL version detection",
      "Version-specific branching",
      "Multi-version flow analysis"
    ],
    "data_structures": {
      "rtl_versions": "Dictionary of detected RTL versions",
      "version_data": "Data associated with each version",
      "branch_patterns": "Branching patterns between versions"
    }
  }
}
```

### 6. simple_analyzer.py - Lightweight Analyzer

**Purpose**: Simple AI-powered data analyzer that works without pandas dependency issues.

**Key Features**:
- Pure Python CSV reading
- Ollama/Mistral integration
- Username extraction
- Lightweight operation

**Configuration**:
```json
{
  "ollama_config": {
    "url": "http://localhost:11434/api/generate",
    "model": "mistral"
  },
  "features": [
    "CSV reading without pandas",
    "Username pattern matching",
    "AI-powered analysis",
    "Fallback mechanisms"
  ]
}
```

### 7. intelligent_simple_analyzer.py - Pattern-Based Analyzer

**Purpose**: Model-based analysis without external dependencies using predefined patterns.

**Key Features**:
- EDA flow pattern recognition
- Built-in stage patterns
- Status mapping
- No external AI dependency

**Pattern Definitions**:
```json
{
  "stage_patterns": {
    "synthesis": ["synth", "synthesis", "syn", "compile"],
    "floorplan": ["floorplan", "fp", "floor", "plan"],
    "placement": ["place", "placement", "pl", "placed"],
    "cts": ["cts", "clock", "tree", "synthesis"],
    "routing": ["route", "routing", "rt", "routed"],
    "drc": ["drc", "design", "rule", "check"],
    "verification": ["verify", "verification", "ver", "check"],
    "signoff": ["signoff", "sign", "off", "final"]
  },
  "status_mapping": {
    "completed": ["complete", "done", "success", "pass", "finished", "ok"],
    "failed": ["fail", "error", "abort", "crash", "exception"],
    "running": ["run", "active", "progress", "executing", "processing"],
    "pending": ["pending", "wait", "queue", "scheduled", "ready"]
  }
}
```

### 8. simple_branch_analyzer.py - Simplified Branch Logic

**Purpose**: Implements exact user-specified branching logic with simple CSV handling.

**Key Features**:
- Exact user logic implementation
- First row handling
- Data copying detection
- Scrollable visualization (no zoom buttons)

**Logic Flow**:
```json
{
  "branching_logic": [
    "1. First row: display all stages (starting run)",
    "2. Check if run copies data from previous runs",
    "3. If no copying: display all stages (independent run)", 
    "4. If copying: skip copied stages, branch from LAST copied stage to FIRST new stage",
    "5. Make it scrollable (no zoom buttons)"
  ]
}
```

### 9. requirements.txt - Dependencies

**Purpose**: Defines all Python package dependencies for the module.

**Dependencies**:
```json
{
  "web_framework": {
    "Flask": "2.3.3",
    "Flask-CORS": "4.0.0",
    "Werkzeug": "2.3.7"
  },
  "data_processing": {
    "pandas": "2.1.1", 
    "numpy": "1.24.3"
  },
  "database": {
    "psycopg2-binary": "2.9.7"
  },
  "file_processing": {
    "openpyxl": "3.1.2",
    "xlrd": "2.0.1"
  }
}
```

## Data Flow Architecture

```json
{
  "data_flow": {
    "1_file_upload": {
      "input": "CSV/Excel file via HTTP POST",
      "processing": "File validation and temporary storage",
      "output": "File path for analysis"
    },
    "2_data_analysis": {
      "input": "File path",
      "processing": "AI-powered structure analysis or pattern matching",
      "output": "Data structure metadata"
    },
    "3_layout_generation": {
      "input": "Data structure metadata",
      "processing": "Enhanced layout calculation with connection logic",
      "output": "Visualization layout data"
    },
    "4_response": {
      "input": "Layout data",
      "processing": "JSON serialization and cleanup",
      "output": "HTTP JSON response"
    }
  }
}
```

## AI Integration

### Ollama/Mistral Integration
```json
{
  "ai_integration": {
    "service": "Ollama",
    "model": "mistral",
    "endpoint": "http://localhost:11434/api/generate",
    "timeout": "60 seconds",
    "usage": [
      "Data structure analysis",
      "Connection pattern detection", 
      "Stage relationship identification",
      "Flow logic determination"
    ],
    "fallback": "Rule-based analysis when AI unavailable"
  }
}
```

## Storage and Execution

### File Storage
```json
{
  "storage": {
    "uploaded_files": {
      "location": "uploads/ directory",
      "lifecycle": "Temporary - deleted after processing",
      "formats": ["CSV", "Excel (.xls, .xlsx)"]
    },
    "cache": {
      "location": "__pycache__/ directory", 
      "content": "Python bytecode cache",
      "management": "Automatic Python cache management"
    }
  }
}
```

### Execution Environment
```json
{
  "execution": {
    "runtime": "Python 3.x",
    "server": "Flask development/production server",
    "deployment": {
      "docker": "Containerized deployment supported",
      "standalone": "Direct Python execution supported"
    },
    "scaling": {
      "database": "Connection pooling (1-20 connections)",
      "concurrent_requests": "Flask threading support",
      "file_processing": "Sequential processing with cleanup"
    }
  }
}
```

## Configuration Management

### Environment Variables
```json
{
  "required_env_vars": {
    "database": [
      "DATABASE_HOST/POSTGRES_HOST",
      "DATABASE_PORT/POSTGRES_PORT", 
      "DATABASE_NAME/POSTGRES_DB",
      "DATABASE_USER/POSTGRES_USER",
      "DATABASE_PASSWORD/POSTGRES_PASSWORD"
    ],
    "server": [
      "FLASK_HOST (optional)",
      "FLASK_PORT (optional)",
      "FLASK_ENV (optional)",
      "DEBUG (optional)"
    ]
  }
}
```

### Default Values
```json
{
  "defaults": {
    "database": {
      "host": "localhost",
      "port": 5432,
      "database": "copilot", 
      "user": "postgres",
      "password": "root"
    },
    "server": {
      "host": "0.0.0.0",
      "port": 5003,
      "debug": false
    }
  }
}
```

## Error Handling and Logging

### Logging Configuration
```json
{
  "logging": {
    "level": "INFO",
    "format": "Standard Python logging format",
    "outputs": [
      "Console output",
      "Application logs"
    ],
    "categories": [
      "File processing",
      "Database operations",
      "AI model interactions",
      "Layout generation",
      "Error tracking"
    ]
  }
}
```

### Error Handling Strategy
```json
{
  "error_handling": {
    "file_processing": {
      "invalid_format": "HTTP 400 with error message",
      "empty_file": "HTTP 400 with validation error",
      "read_failure": "HTTP 500 with processing error"
    },
    "ai_integration": {
      "model_unavailable": "Fallback to rule-based analysis",
      "timeout": "Graceful degradation to simple analysis",
      "invalid_response": "JSON parsing with cleanup attempts"
    },
    "database": {
      "connection_failure": "Warning logged, service continues",
      "query_error": "Error logged with connection retry"
    }
  }
}
```

## Performance Characteristics

### Resource Usage
```json
{
  "performance": {
    "memory": {
      "base": "~50MB Flask application",
      "per_file": "Variable based on file size",
      "ai_model": "Depends on Ollama model size"
    },
    "cpu": {
      "file_processing": "I/O bound operations",
      "ai_analysis": "CPU intensive during model inference",
      "layout_generation": "Moderate CPU usage"
    },
    "network": {
      "ai_requests": "HTTP requests to localhost:11434",
      "database": "PostgreSQL connection pool",
      "client_responses": "JSON data transfer"
    }
  }
}
```

### Scalability Considerations
```json
{
  "scalability": {
    "concurrent_users": "Limited by Flask threading and database pool",
    "file_size_limits": "Memory constrained by pandas DataFrame size",
    "ai_model_queue": "Sequential processing through Ollama",
    "database_connections": "Pool size: 1-20 connections"
  }
}
```

## Integration Points

### Docker Integration
```json
{
  "docker": {
    "health_check": "/health endpoint",
    "environment": "Environment variable configuration",
    "networking": "Container-to-container communication",
    "volumes": [
      "Configuration files",
      "Data directories",
      "Log directories"
    ]
  }
}
```

### External Dependencies
```json
{
  "external_services": {
    "ollama": {
      "purpose": "AI model inference",
      "endpoint": "http://localhost:11434",
      "fallback": "Rule-based analysis"
    },
    "postgresql": {
      "purpose": "Data persistence and session management",
      "fallback": "Service continues with limited functionality"
    }
  }
}
```

## Usage Examples

### Standard Flow Analysis
```bash
curl -X POST http://localhost:5003/upload \
  -F "file=@data.csv" \
  -H "Content-Type: multipart/form-data"
```

### Branch View Analysis  
```bash
curl -X POST http://localhost:5003/upload-branch \
  -F "file=@data.csv" \
  -H "Content-Type: multipart/form-data"
```

### RTL View Analysis
```bash
curl -X POST http://localhost:5003/upload-rtl \
  -F "file=@data.csv" \
  -H "Content-Type: multipart/form-data"
```

### Health Check
```bash
curl http://localhost:5003/health
```

## Maintenance and Monitoring

### Health Monitoring
```json
{
  "monitoring": {
    "health_endpoint": "/health",
    "database_status": "Connection pool status",
    "service_status": "Overall service health",
    "configuration": "Current database configuration"
  }
}
```

### Log Analysis
```json
{
  "log_categories": [
    "File upload and processing",
    "AI model interactions", 
    "Database operations",
    "Layout generation",
    "Error conditions",
    "Performance metrics"
  ]
}
```

This documentation provides a comprehensive overview of the RUN_STATUS module, its components, functionality, and integration points. The module serves as a sophisticated data analysis and visualization service with AI-powered insights and multiple analysis modes.