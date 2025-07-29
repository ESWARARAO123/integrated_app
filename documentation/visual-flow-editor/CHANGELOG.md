# Flow Editor Changelog

All notable changes to the Visual Flow Editor will be documented in this file.

## [v0.2.1] - 2025-01-29 (Current)

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

### [v0.3.0] - Planned
- **Flow Execution**: Integration with MCP orchestrator
- **Script Templates**: Pre-built flow templates for common patterns
- **Advanced Validation**: Complex flow validation rules
- **Real-time Updates**: WebSocket-based execution monitoring

### [v0.4.0] - Planned  
- **Collaboration Features**: Flow sharing and permissions
- **Version History**: Flow versioning and rollback capabilities
- **Performance Optimization**: Virtualization for large flows
- **Mobile Enhancements**: Touch-optimized interactions

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