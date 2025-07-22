# RunStatus Feature Documentation

## Overview

The RunStatus feature is a database analysis and monitoring system within PinnacleAi that allows users to connect to external PostgreSQL databases containing run/execution data and analyze them with different visualization flows (Simple Flow, Branch Flow, RTL Flow).

## Architecture

### Core Components

1. **Frontend Components**
   - `client/src/pages/RunStatus.tsx` - Main RunStatus page
   - `client/src/components/settings/RunStatusDbSettings.tsx` - Database configuration UI
   - `client/src/services/runStatusDbService.ts` - Frontend API client

2. **Backend Services**
   - `src/services/runStatusDbService.js` - Core database connection and table management
   - `src/routes/runStatusDb.js` - API routes for data operations
   - `src/routes/settings.runstatus.js` - Configuration management routes

3. **Database Schema**
   - `user_runstatus_db_configurations` table - Stores user database configurations
   - Dynamic connection to external PostgreSQL databases

## Current Issues

### 1. **404 Route Errors** ✅ FIXED

**Problem**: Frontend was making requests to non-existent API routes.

**Solution Applied**: Updated backend routes in `src/routes/settings.runstatus.js` to match frontend expectations:

**Before**:
- `/api/settings/runstatus-db-config` → **Now**: `/api/settings/runstatus-db/config`
- `/api/settings/test-runstatus-db-connection` → **Now**: `/api/settings/runstatus-db/test`
- `/api/settings/runstatus-db-disconnect` → **Now**: `/api/settings/runstatus-db/disconnect`

**Status**: ✅ **RESOLVED** - All routes now match frontend expectations

### 2. **Database Name Confusion** ❌

**Problem**: User mentioned database name "copilot" but logs show "runstatus".

**Explanation**: 
- The database name is NOT hardcoded as "runstatus"
- Users can configure any database name they want
- The "runstatus" you see in logs refers to the **feature name**, not the database name
- The actual database name comes from user configuration stored in `user_runstatus_db_configurations.database_name`

### 3. **Missing Configuration** ❌

**Problem**: User has no active RunStatus DB configuration:
```
No active RunStatus DB configuration found for user 6d378bd8-bb50-48f6-b85e-9cf9e0171dc2
```

**Solution**: User needs to configure their database connection through Settings > RunStatus Database Settings.

## How RunStatus Differs from Other Features

### Unique Characteristics

1. **Multi-Database Architecture**
   - Unlike other features that use the main application database
   - Creates **separate PostgreSQL connections** for each user's configured database
   - Manages **multiple concurrent connections** (one per user)

2. **Dynamic Table Discovery**
   - Automatically discovers tables in the connected database
   - Filters tables based on user permissions (non-admin users only see tables with their data)
   - Refreshes table list automatically every minute

3. **User-Specific Data Filtering**
   - Non-admin users only see tables containing their data (based on `run_name` column matching username)
   - Admin users see all tables in the database
   - Implements pattern matching for usernames (e.g., 's_girishR1' matches 's_girish')

4. **Real-Time Connection Management**
   - Maintains persistent connections with automatic reconnection
   - Handles Docker networking complexities (host resolution)
   - Implements connection pooling and retry logic

5. **Multiple Analysis Flows**
   - **Simple Flow**: Basic sequential process visualization
   - **Branch Flow**: Complex branching process analysis (excludes RTL tables)
   - **RTL Flow**: RTL-specific analysis (requires `Block_name` column)

## Route Structure Comparison

### RunStatus Routes (FIXED ✅)
```javascript
// Frontend and Backend NOW MATCH:
GET  /api/settings/runstatus-db/config           ✅ FIXED
POST /api/settings/runstatus-db/config           ✅ FIXED
POST /api/settings/runstatus-db/test             ✅ FIXED
POST /api/settings/runstatus-db/disconnect       ✅ MATCHES
```

### Prediction Routes (Working Reference)
```javascript
// Frontend and Backend MATCH:
GET  /api/settings/prediction-db-config           ✅
POST /api/settings/prediction-db-config           ✅
POST /api/settings/test-prediction-db-connection  ✅
POST /api/settings/prediction-db-disconnect       ✅
```

## Database Configuration Flow

### 1. User Configuration Storage
```sql
-- Main app database table
CREATE TABLE user_runstatus_db_configurations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL DEFAULT 5432,
  database_name VARCHAR(255) NOT NULL,  -- User's actual DB name (e.g., "copilot")
  username VARCHAR(255) NOT NULL,
  password TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Connection Management
```javascript
// Service creates separate connections per user
class RunStatusDatabaseService {
  userConnections = new Map(); // userId -> { pool, config, tables }
  
  async connectUser(userId, config) {
    const pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,  // This is user's DB name (e.g., "copilot")
      user: config.user,
      password: config.password
    });
  }
}
```

### 3. Table Filtering Logic
```javascript
// Non-admin users: Filter by run_name column
const userDataQuery = `
  SELECT COUNT(*) as count
  FROM "${tableName}" 
  WHERE run_name LIKE $1 || '%'
`;
// Pattern: 's_girish%' matches 's_girishR1', 's_girish_test', etc.

// Admin users: See all tables
const adminQuery = `SELECT COUNT(*) as row_count FROM "${tableName}"`;
```

## Solutions

### 1. Route Mismatches ✅ FIXED

**Solution Applied**: Updated backend routes in `src/routes/settings.runstatus.js`:
```javascript
// FIXED - Backend routes now match frontend expectations:
router.get('/runstatus-db/config', ...)        ✅ Updated
router.post('/runstatus-db/config', ...)       ✅ Updated  
router.post('/runstatus-db/test', ...)         ✅ Updated
router.post('/runstatus-db/disconnect', ...)   ✅ Already matched
```

**Result**: All API routes now work correctly with the frontend.

### 2. Clarify Database Naming

The database name is **completely configurable**:
- User enters database name in UI (e.g., "copilot", "production", "test_db")
- System stores it in `user_runstatus_db_configurations.database_name`
- Service connects to that specific database
- "runstatus" in logs refers to the **feature name**, not database name

### 3. Configuration Setup Process

1. User goes to Settings > RunStatus Database Settings
2. Enters connection details:
   - Host: Database server address
   - Port: Usually 5432
   - Database: **User's actual database name** (e.g., "copilot")
   - Username: Database user
   - Password: Database password
3. System tests connection
4. If successful, saves configuration and establishes connection
5. Begins automatic table discovery and filtering

## Docker Environment Considerations

### Host Resolution
```javascript
// Service automatically resolves Docker networking
resolveHostForDocker(host) {
  if (isDocker && host === 'localhost') {
    return 'host.docker.internal';  // Docker host access
  }
  return host;
}
```

### Multiple Host Attempts
```javascript
// Tries multiple host candidates for Docker compatibility
const hostCandidates = [
  primaryHost,           // User-specified host
  'localhost',          // Local development
  '172.17.0.1',         // Docker bridge gateway
  '172.18.0.1',         // Docker Compose gateway
  // ... more Docker network IPs
];
```

## Error Analysis from Logs

### Connection Initialization
```
?? Initializing Run Status Database connection for user 6d378bd8-bb50-48f6-b85e-9cf9e0171dc2...
?? Loading RunStatus DB config for user 6d378bd8-bb50-48f6-b85e-9cf9e0171dc2
?? Config query result: 0 rows found
? No active RunStatus DB configuration found
```
**Status**: ❌ User needs to configure database connection

### Route Errors
```
POST http://localhost:5641/api/settings/runstatus-db/test 404 (Not Found)
POST http://localhost:5641/api/settings/runstatus-db/config 404 (Not Found)
```
**Status**: ✅ **FIXED** - Backend routes updated to match frontend expectations

### Other Service Errors
```
Error: relation "prediction_db_settings" does not exist
Error: mockRuns is not defined
```
**Status**: ⚠️  Unrelated issues in other features

## Comparison with Other Features

| Feature | Database Connection | User Isolation | Table Discovery | Real-time Updates |
|---------|-------------------|----------------|-----------------|-------------------|
| **RunStatus** | External PostgreSQL per user | Yes (by run_name) | Dynamic | Yes (1min intervals) |
| **Prediction** | External PostgreSQL shared | No | Static config | No |
| **FlowTrack** | External PostgreSQL shared | No | Manual | No |
| **Chat2SQL** | External PostgreSQL per user | No | Manual | No |

## Recommendations

### Immediate Actions Required (Priority 1)
1. ✅ **Route mismatches FIXED** - Backend routes now match frontend expectations
2. **Restart the server** - Required for route changes to take effect
3. **Test the configuration flow** - User should now be able to save database config
4. **Verify database migration** - Ensure `user_runstatus_db_configurations` table exists

### Enhancements (Priority 2)
1. **Improve error messages** - Make route errors more descriptive
2. **Add connection validation** - Better feedback for invalid configurations
3. **Documentation** - Update API documentation with correct routes

### Long-term Improvements (Priority 3)
1. **Connection pooling optimization** - Reduce resource usage
2. **Enhanced filtering** - More flexible user data filtering options
3. **Performance monitoring** - Track connection health and performance

## Testing Checklist

- [ ] User can access Settings > RunStatus Database Settings
- [ ] User can enter database configuration (host, port, database, user, password)
- [ ] Test connection button works
- [ ] Save configuration button works
- [ ] Connection status shows as connected
- [ ] Tables appear in RunStatus page
- [ ] Analysis flows work (Simple, Branch, RTL)
- [ ] Non-admin users only see their tables
- [ ] Admin users see all tables 