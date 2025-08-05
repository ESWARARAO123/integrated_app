# Flow Editor Changelog

All notable changes to the Visual Flow Editor will be documented in this file.

## [v0.3.0] - 2025-08-05 (Current) - File Editor Integration & Context Menu System 🎉

### ✅ **COMPLETED: File Editor Modal Integration**
- **Large Chakra UI Modal**: Professional file editing interface inspired by FlowdirApprovalModal
- **TCL File Support**: Full viewing and editing capabilities for configuration files
- **Real-time MCP Integration**: Direct file operations via MCP server communication
- **Enhanced User Experience**:
  - Syntax highlighting with monospace font for TCL files
  - Undo/redo functionality with keyboard shortcuts (Ctrl+Z, Ctrl+Y)
  - Auto-save indicators and unsaved changes tracking
  - Fullscreen toggle capability (F11)
  - Professional status bar with file info and line count

### ✅ **COMPLETED: Context Menu System**
- **Right-click Block Interaction**: Context menus for all flow blocks
- **Smart File Path Resolution**: Dynamic path construction from FlowDir execution database
- **Multi-stage Support**: Config editing for Floorplan, Placement, CTS, and Route stages
- **Context-aware Options**: Menu items adapt based on block type and capabilities
- **Database Integration**: Leverages `flowdir_executions` table for path resolution

### ✅ **COMPLETED: Robust MCP Response Parsing**
- **Smart JSON Extraction**: Handles mixed console output and JSON responses
- **Fallback Parsing Logic**: Multiple parsing strategies for different response formats
- **Content Formatting**: Automatic conversion of escaped newlines to proper line breaks
- **Error Resilience**: Graceful handling of malformed or incomplete responses
- **Debug Logging**: Comprehensive logging for troubleshooting parsing issues

### 🔧 **TECHNICAL IMPROVEMENTS**
- Enhanced FileEditorModal with Chakra UI components for consistency
- Improved error handling and user feedback for file operations
- Dynamic username and run name extraction from FlowDir execution paths
- Integration with existing MCP settings configuration (no hardcoded IPs)
- Modular component architecture following project patterns

### 🐛 **KNOWN ISSUES**
- Context menu positioning affected by React Flow canvas transformations
- Menu spawns far from blocks due to zoom/pan coordinate system conflicts

## [v0.2.3] - 2025-08-01 - FlowDir Integration Success 🎉

### ✅ **COMPLETED: Docker API Integration**
- **Successfully Dockerized FlowDir Module**: Created `docker-dir-create-module` container
- **Fixed Base64 Parameter Injection**: Simplified from complex wrapper to direct `sys.argv` replacement
- **Fixed JSON Response Parsing**: Correctly extracts multi-line JSON responses from MCP orchestrator
- **Working End-to-End Flow**: Frontend → Proxy → Docker API → Base64 → Remote MCP → Success
- **Performance Metrics**:
  - **Execution Time**: ~1.7 seconds for full VLSI directory structure
  - **Base64 Script Size**: 26,463 characters
  - **Success Rate**: 100% with NAS paths (`/nas/nas_v1/Innovus_trials/users`)
  - **Directory Creation**: 147 directories, 1 file, 2 symlinks per execution

### ✅ **COMPLETED: Production-Ready Components**
- **Docker Container**: `docker-dir-create-module` running on port 3582
- **API Proxy**: `/api/dir-create/execute-flowdir` route with 2-minute timeout
- **Request Logging**: Comprehensive execution tracking with unique request IDs
- **Error Handling**: Graceful fallback from Base64 to file transfer method
- **Frontend Integration**: FlowdirApprovalModal with parameter validation and execution

### ✅ **COMPLETED: Database Integration & Tracking**
- **Migration 035**: Created `flowdir_executions` table for execution tracking
- **Full CRUD API**: `/api/flowdir-executions` endpoints for create, read, update, delete
- **Automatic Tracking**: Frontend automatically creates and updates execution records
- **Fixed Migration Pattern**: Corrected migration to follow project conventions (using `{ pool } = require('../database')` and proper `up()/down()` functions instead of custom patterns)
- **Comprehensive Data Storage**:
  - Project parameters (name, block, tool, stage, run details)
  - Execution results (directories, files, symlinks created)
  - Performance metrics (execution time, success/failure)
  - Complete logs and error messages
  - JSON storage for detailed results and created paths
- **User-Based Access Control**: All records linked to authenticated users

### ✅ **COMPLETED: Frontend Display Fixes**
- **Fixed Directory Count Display**: Now correctly shows "Created 147 directories"
- **Fixed Modal Validation**: Approval modal no longer gets stuck in "validating" state
- **Enhanced Logging**: Real-time status updates during execution
- **Database Integration**: Execution records automatically saved and linked to flows

### ✅ **COMPLETED: Remote Execution Validation**
- **Manual Testing**: Direct base64 execution via orchestrator.py ✅
- **API Testing**: Docker API with curl commands ✅  
- **Frontend Testing**: Flow Editor with real user interactions ✅
- **Production Paths**: Validated with actual NAS storage paths
- **Multiple Test Runs**: Consistent 1.3-1.7s execution times
- **Database Persistence**: All executions tracked and queryable

### 🎯 **SYSTEM NOW FULLY OPERATIONAL**
- **Backend**: ✅ Working perfectly with correct parsing
- **Frontend**: ✅ Displays accurate results (147 directories)
- **Database**: ✅ Complete execution tracking and history
- **Docker**: ✅ Production-ready containerized deployment
- **API**: ✅ RESTful endpoints for execution management

---

## [v0.2.2] - 2024-07-31 - FlowDir Integration

### ✅ **NEW: FlowDir Script Parameterization**
- **Created `flowdir_parameterized.py`** - CLI-enabled version of the original flowdir.py
- **Added comprehensive CLI arguments**:
  - `--project-name` (required): Project name (e.g., "Bigendian")
  - `--block-name` (required): Block name (e.g., "Top_encoder03") 
  - `--tool-name` (required): Tool choice (cadence/synopsys)
  - `--stage` (required): Flow stage (all/Synthesis/PD/LEC/STA)
  - `--run-name` (required): Run identifier (e.g., "test-run-016")
  - `--pd-steps` (optional): PD steps when stage=PD (Floorplan,Place,CTS,Route,all)
  - `--reference-run` (optional): Reference run for copying
  - `--working-directory` (optional): Base working directory path
  - `--central-scripts` (optional): Central scripts directory path

### ✅ **NEW: Structured Logging System**
- **Progress Tracking**: `FLOWDIR_PROGRESS:X/10:Description` format
- **Action Logging**: `FLOWDIR_LOG:ACTION:STATUS:PATH` format
- **Path Tracking**: Complete capture of all created directories, files, and symlinks
- **Summary Output**: Comprehensive execution summary with counts and paths
- **Error Handling**: Structured error messages with `FLOWDIR_ERROR:` prefix

### ✅ **NEW: Testing & Validation**
- **Successful Local Testing**: Verified script execution from user home directory
- **Path Correction**: Fixed central scripts path from `/mnt/projects/` to `/mnt/projects_107/`
- **Real-world Validation**: Tested with actual project parameters:
  - Project: "Bigendian", Block: "Top_encoder03", Tool: "cadence", Stage: "all"
  - **Results**: 147 directories, 1 file, 2 symlinks created successfully
- **Output Parsing Ready**: All logs structured for easy backend processing

### 📋 **PLANNED: Backend Integration Architecture**
- **Created comprehensive integration plan** (`flowdir_backend_integration_plan.md`)
- **Architecture Flow Designed**: Frontend → Parameter Extraction → User Approval → Backend API → Base64 Execution → MCP → Response Parsing → Frontend Display

---

## [v0.2.1] - 2025-01-29

### 🔧 Major Fixes
- **Fixed Viewport Restoration Issue**: Resolved problem where canvas position and zoom weren't preserved when loading flows
  - Removed React Flow's `fitView` prop that was overriding viewport restoration
  - Added comprehensive debugging for viewport save/restore operations
  - Implemented retry logic for viewport restoration with increasing delays
- **Fixed Node Position Persistence**: Resolved issue where node positions weren't saved when users dragged nodes
  - Added `UPDATE_NODE_POSITION` action type to FlowEditorProvider reducer
  - Implemented `updateNodePosition` function for syncing position changes to global state
  - Created custom `handleNodesChange` handler in FlowCanvas to detect and sync position updates
  - Added performance optimization to only update positions when dragging is complete

### ✨ New Features
- **Enhanced Debugging**: Added comprehensive logging for viewport and node position operations
- **Performance Optimizations**: Position updates only occur when dragging is complete, not during drag
- **MCP Integration Analysis**: Created comprehensive analysis document for integrating MCP execution capabilities

---

## [v0.2.0] - 2025-01-29

### 🔧 Major Fixes
- **Fixed Critical Save/Load Bug**: Resolved issue where multiple saves were overwriting the same flow instead of creating new ones
- **Fixed SQL Query Bug**: Corrected `GET /api/flows` query to return all user flows instead of just one
- **Fixed Authentication Pattern**: Switched from JWT to session-based authentication to match application standard
- **Fixed UI Regression**: Restored stable node styling and connection handles after UI enhancements caused instability

### ✨ New Features
- **Unique Flow Names**: Automatic timestamped flow names (e.g., "Flow Jul 29, 14:35") for new saves
- **Simplified Node Labels**: Nodes display only assigned values when set (e.g., just "Bigendian" instead of label + value)
- **Enhanced Flow Management**: Improved save/load UI with flow count, delete buttons, and current flow highlighting
- **Canvas State Persistence**: Complete viewport preservation (zoom, pan, position) across sessions
- **Auto-load Last Flow**: Automatically loads the most recent flow when opening the editor

### 🗄️ Database Schema
- **Complete Schema Implementation**: Created `flows`, `flow_nodes`, `flow_edges`, `flow_executions`, `flow_templates`, `flow_sharing` tables
- **User Isolation**: Proper UUID-based user association for all flows
- **JSONB Storage**: Flexible storage for node data and canvas state
- **Foreign Key Constraints**: Referential integrity and cascade deletes

### 🎨 UI/UX Improvements
- **Theme Integration**: Seamless Dark/Light/Midnight theme support
- **Node Design**: Consistent styling with BaseNode, InputNode, ProcessNode, OutputNode
- **Flow List UI**: Scrollable dropdown with theme-matching design
- **Status Indicators**: Visual feedback for node states and operations
- **Responsive Design**: Mobile-friendly interactions and layouts

### 🚀 Performance
- **Removed Auto-save**: Disabled automatic saving per user request, manual save only
- **Optimized Queries**: Improved database query performance with proper indexing
- **Efficient State Management**: React Flow hooks with minimal re-renders
- **Global Instance Access**: Stored React Flow instance for viewport control

### 🔍 Developer Experience
- **Comprehensive Logging**: Added detailed frontend and backend logging for debugging
- **Error Handling**: Robust try-catch blocks with user-friendly messages
- **Documentation**: Complete documentation of architecture, fixes, and lessons learned

### 🐛 Bug Fixes
- Fixed missing connection handles on Input and Output nodes
- Resolved white CSS overlay glitch from React Flow defaults
- Fixed node positioning and drag interactions
- Corrected flow ID management for proper save/update distinction
- Fixed session authentication middleware integration

---

## [v0.1.0] - 2025-01-25

### ✨ Initial Release
- **Visual Canvas**: React Flow-based drag-and-drop interface
- **Node System**: Basic Input, Process, and Output node types
- **Connection System**: Visual connections between nodes
- **Basic Persistence**: Initial database schema and API endpoints
- **Theme Support**: Basic theme integration

### 🏗️ Architecture
- **Frontend**: React + TypeScript + React Flow + Framer Motion
- **Backend**: Node.js + Express + PostgreSQL
- **Database**: Initial flow storage tables
- **API**: Basic CRUD operations for flows

### 📋 Known Issues (Resolved in v0.2.0)
- Save operations updating same flow instead of creating new ones
- SQL query returning only one flow per user
- Authentication pattern mismatch with application standard
- UI instability with node styling and connections
- Missing viewport persistence across sessions

---

## Upcoming Releases

### [v0.3.0] - Planned: FlowDir Execution
- **Flow Execution**: Integration with MCP orchestrator for FlowDir script execution
- **Parameter Extraction**: Automatic parameter extraction from flow nodes
- **User Approval Modal**: Parameter validation and approval interface
- **Real-time Progress**: Live execution progress tracking
- **Results Visualization**: Directory structure visualization and path tracking

### [v0.4.0] - Planned: Advanced Features
- **Script Templates**: Pre-built flow templates for common VLSI patterns
- **Advanced Validation**: Complex flow validation rules
- **Collaboration Features**: Flow sharing and permissions
- **Version History**: Flow versioning and rollback capabilities

### [v1.0.0] - Production Ready
- **Complete Feature Set**: All planned features implemented
- **Production Deployment**: Ready for production use
- **Comprehensive Testing**: Full test coverage
- **Documentation**: Complete user and developer documentation

---

**Legend:**
- 🔧 Bug Fixes
- ✨ New Features  
- 🗄️ Database Changes
- 🎨 UI/UX Improvements
- 🚀 Performance Improvements
- 🔍 Developer Experience
- 🐛 Bug Fixes
- 🏗️ Architecture Changes
- 📋 Known Issues 