# Flow Editor Database Implementation

## Overview
Complete database system for the Flow Editor that supports persistent storage of flows with user association, canvas state preservation, and cross-session continuity.

## Database Schema

### Core Tables

#### 1. `flows` - Main Flow Container
```sql
CREATE TABLE flows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,                          -- Links to users.id
  name VARCHAR(255) NOT NULL,                     -- User-defined flow name
  description TEXT,                               -- Optional description
  canvas_state JSONB DEFAULT '{}',               -- Viewport, zoom, pan state
  workspace_settings JSONB DEFAULT '{}',         -- UI preferences
  is_template BOOLEAN DEFAULT false,              -- Template flag
  is_active BOOLEAN DEFAULT true,                 -- Soft delete flag
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_executed_at TIMESTAMP WITH TIME ZONE,     -- Last execution time
  execution_count INTEGER DEFAULT 0,             -- Usage tracking
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 2. `flow_nodes` - Individual Flow Nodes
```sql
CREATE TABLE flow_nodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL,                          -- Links to flows.id
  node_id VARCHAR(255) NOT NULL,                  -- React Flow node ID
  node_type VARCHAR(100) NOT NULL,                -- 'input', 'process', 'output'
  position_x FLOAT NOT NULL DEFAULT 0,            -- X coordinate
  position_y FLOAT NOT NULL DEFAULT 0,            -- Y coordinate
  width FLOAT,                                    -- Node dimensions
  height FLOAT,
  data JSONB NOT NULL DEFAULT '{}',               -- Node configuration & values
  style JSONB DEFAULT '{}',                       -- Visual styling
  class_name VARCHAR(255),                        -- CSS classes
  draggable BOOLEAN DEFAULT true,                 -- Interaction flags
  selectable BOOLEAN DEFAULT true,
  deletable BOOLEAN DEFAULT true,
  z_index INTEGER DEFAULT 0,                      -- Layer ordering
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  UNIQUE(flow_id, node_id)
);
```

#### 3. `flow_edges` - Node Connections
```sql
CREATE TABLE flow_edges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL,                          -- Links to flows.id
  edge_id VARCHAR(255) NOT NULL,                  -- React Flow edge ID
  source_node_id VARCHAR(255) NOT NULL,           -- Source node
  target_node_id VARCHAR(255) NOT NULL,           -- Target node
  source_handle VARCHAR(255),                     -- Connection points
  target_handle VARCHAR(255),
  edge_type VARCHAR(100) DEFAULT 'default',       -- Edge styling
  animated BOOLEAN DEFAULT false,                 -- Animation flag
  style JSONB DEFAULT '{}',                       -- Visual properties
  label VARCHAR(255),                             -- Edge label
  label_style JSONB DEFAULT '{}',                 -- Label styling
  marker_end JSONB DEFAULT '{}',                  -- Arrow markers
  data JSONB DEFAULT '{}',                        -- Custom edge data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  UNIQUE(flow_id, edge_id)
);
```

#### 4. `flow_executions` - Execution History
```sql
CREATE TABLE flow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',           -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  execution_logs JSONB DEFAULT '[]',              -- Execution log entries
  error_message TEXT,                             -- Error details
  input_data JSONB DEFAULT '{}',                  -- Execution inputs
  output_data JSONB DEFAULT '{}',                 -- Execution results
  execution_time_ms INTEGER,                      -- Performance metrics
  node_execution_order JSONB DEFAULT '[]',       -- Execution sequence
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 5. `flow_templates` - Predefined Templates
```sql
CREATE TABLE flow_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),                          -- Template categorization
  template_data JSONB NOT NULL,                  -- Complete flow structure
  preview_image_url TEXT,                        -- Template preview
  is_public BOOLEAN DEFAULT true,                -- Visibility flag
  created_by UUID,                               -- Template author
  usage_count INTEGER DEFAULT 0,                -- Usage tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

#### 6. `flow_sharing` - Flow Collaboration
```sql
CREATE TABLE flow_sharing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL,
  shared_by UUID NOT NULL,
  shared_with UUID NOT NULL,
  permission_level VARCHAR(50) DEFAULT 'view',   -- 'view', 'edit', 'execute'
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,           -- Optional expiration
  is_active BOOLEAN DEFAULT true,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_with) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(flow_id, shared_with)
);
```

## API Endpoints

### Flow Management
- `POST /api/flows` - Save/update flow
- `GET /api/flows` - List user's flows
- `GET /api/flows/:id` - Load specific flow
- `DELETE /api/flows/:id` - Delete flow
- `POST /api/flows/autosave` - Background auto-save

### Flow Execution
- `POST /api/flows/:id/execute` - Start flow execution
- `PUT /api/flows/executions/:executionId` - Update execution status
- `GET /api/flows/:id/executions` - Get execution history

## Key Features Implemented

### 1. User Association & Security
- ✅ All flows tied to authenticated users via `user_id`
- ✅ JWT token authentication on all endpoints
- ✅ User isolation - users can only access their own flows
- ✅ Soft delete with `is_active` flag

### 2. Canvas State Persistence
- ✅ **Viewport preservation** - zoom, pan, position saved/restored
- ✅ **Node positioning** - exact X/Y coordinates maintained
- ✅ **Node data integrity** - all parameters, values, configuration preserved
- ✅ **Edge connections** - complete connection state with handles
- ✅ **Visual styling** - custom styles and CSS classes maintained

### 3. Page Refresh Handling
- ✅ **State restoration** - complete flow state restored after refresh
- ✅ **Canvas viewport** - zoom and pan position exactly preserved
- ✅ **Active flow tracking** - current flow ID maintained in toolbar
- ✅ **Auto-save integration** - prevents data loss during editing

### 4. Enhanced User Experience
- ✅ **Simplified node labels** - shows only value when set (e.g., "Bigendian")
- ✅ **Smart flow naming** - editable flow names with click-to-edit
- ✅ **Flow list management** - dropdown with all user flows
- ✅ **Auto-save every 30 seconds** - background persistence
- ✅ **Real-time feedback** - saving status and success messages

### 5. Data Integrity
- ✅ **Atomic transactions** - all saves are transactional
- ✅ **Foreign key constraints** - referential integrity maintained
- ✅ **Unique constraints** - prevents duplicate node/edge IDs
- ✅ **Cascade deletes** - clean removal of related data

## User Interaction Scenarios Solved

### Scenario 1: Flow Creation & Persistence
```
1. User creates new flow with nodes and edges
2. User assigns values (e.g., "Bigendian" to input node)
3. User saves flow with custom name
4. Flow stored with UUID, user association, complete state
5. Node shows only "Bigendian" label (clean UI)
```

### Scenario 2: Page Refresh Continuity
```
1. User working on flow with specific viewport (zoomed, panned)
2. User refreshes browser or navigates away
3. User returns to Flow Editor
4. System restores exact canvas state:
   - Same zoom level
   - Same pan position
   - Same node positions
   - Same connections
   - Same node values
```

### Scenario 3: Cross-Session Access
```
1. User saves flow on Monday
2. User logs out, logs back in on Tuesday
3. User loads flow from dropdown
4. Exact same state restored:
   - Canvas viewport preserved
   - All node configurations intact
   - All connections maintained
   - UI state identical to save point
```

### Scenario 4: Multi-Flow Management
```
1. User creates multiple flows ("ML Pipeline", "Data Processing", etc.)
2. Each flow saved with unique UUID and user association
3. User can switch between flows via dropdown
4. Each flow maintains independent state
5. Auto-save prevents work loss during switching
```

### Scenario 5: Collaborative Features (Future-Ready)
```
1. Flow sharing table supports team collaboration
2. Permission levels (view, edit, execute)
3. Template system for reusable flows
4. Execution history tracking
5. Usage analytics
```

## Technical Implementation Details

### Frontend Integration
- **React Flow Instance Access**: Global instance stored for viewport control
- **State Management**: Context-based state with database sync
- **Auto-save**: Background saves every 30 seconds with change detection
- **UI Feedback**: Real-time saving status and error handling

### Backend Architecture
- **Express Routes**: RESTful API with proper HTTP methods
- **Authentication**: JWT middleware on all endpoints
- **Database Pool**: Connection pooling for performance
- **Transaction Management**: Atomic operations for data consistency

### Performance Optimizations
- **Indexed Queries**: Strategic indexes on user_id, flow_id, updated_at
- **Batch Operations**: Efficient bulk insert/update for nodes/edges
- **Lazy Loading**: Pagination support for large flow lists
- **Connection Pooling**: Optimized database connections

## Migration Status
✅ **Migration 033** - Flow Editor tables created successfully
- All tables created with proper constraints
- Indexes added for query performance
- Triggers configured for timestamp updates
- Foreign key relationships established

## Testing Recommendations

### Database Testing
```sql
-- Verify user flow isolation
SELECT * FROM flows WHERE user_id = 'test-user-uuid';

-- Check canvas state preservation
SELECT canvas_state FROM flows WHERE id = 'flow-uuid';

-- Validate node positioning
SELECT node_id, position_x, position_y FROM flow_nodes WHERE flow_id = 'flow-uuid';
```

### API Testing
```bash
# Save flow
curl -X POST /api/flows -H "Authorization: Bearer $JWT" -d '{
  "name": "Test Flow",
  "nodes": [...],
  "edges": [...],
  "viewport": {"x": 100, "y": 50, "zoom": 1.5}
}'

# Load flow
curl -X GET /api/flows/$FLOW_ID -H "Authorization: Bearer $JWT"
```

## Future Enhancements

### Phase 2 Features
- [ ] **Flow Templates**: Predefined flow templates for common patterns
- [ ] **Flow Sharing**: Team collaboration with permission controls
- [ ] **Version History**: Flow versioning and rollback capabilities
- [ ] **Export/Import**: Flow portability between systems
- [ ] **Advanced Analytics**: Usage patterns and performance metrics

### Performance Improvements
- [ ] **Caching Layer**: Redis caching for frequently accessed flows
- [ ] **Real-time Sync**: WebSocket-based collaborative editing
- [ ] **Compression**: JSONB compression for large flows
- [ ] **CDN Integration**: Static asset optimization

## Conclusion

The Flow Editor database implementation provides a robust, scalable foundation for persistent workflow management. Key achievements:

1. **Complete State Persistence** - Every aspect of the flow is preserved
2. **User Isolation** - Secure, multi-tenant architecture
3. **Canvas Continuity** - Exact viewport restoration across sessions
4. **Clean UI** - Simplified node displays with value-based labeling
5. **Auto-save Integration** - Prevents data loss during editing
6. **Future-Ready** - Extensible schema for advanced features

The system successfully handles all specified user interaction scenarios while maintaining data integrity and providing excellent user experience. 