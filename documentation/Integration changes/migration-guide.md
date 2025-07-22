# Migration Guide

## Overview

This guide helps developers understand the changes made to the PinnacleAi application and how to work with the new modular architecture. All changes are backward compatible, so existing functionality continues to work without modification.

## What Changed

### 1. Settings Module Architecture

**Old Structure**:
```
src/routes/settings.js (482 lines)
└── All settings logic in one file
```

**New Structure**:
```
src/routes/settings.js (184 lines)
├── Basic settings (theme, API keys)
└── Imports settings.prediction.js

src/routes/settings.prediction.js (325 lines)
└── Prediction database management
```

### 2. Toast Notifications

**Old Behavior**:
- Console-only logging
- No visual user feedback
- Commented-out toast code

**New Behavior**:
- Visual toast notifications
- Immediate user feedback
- Professional UI experience

## For Developers

### Working with Settings Routes

#### Basic Settings (Theme, API Keys)
Continue working with `src/routes/settings.js` as before:

```javascript
// Theme management
POST /api/settings/theme
GET  /api/settings/theme

// API key management  
POST /api/settings/api-key
GET  /api/settings/api-key
```

#### Prediction Database Settings
New functionality is in `src/routes/settings.prediction.js`:

```javascript
// Prediction database management
GET  /api/settings/prediction-db-config
POST /api/settings/prediction-db-config
POST /api/settings/test-prediction-db-connection
POST /api/settings/prediction-db-disconnect
```

### Adding New Settings Routes

#### For Basic Settings
Add to `src/routes/settings.js`:

```javascript
// Example: Add new basic setting
router.post('/new-setting', isAuthenticated, async (req, res) => {
  try {
    // Implementation
    res.json({ message: 'Setting saved successfully' });
  } catch (error) {
    console.error('Error saving setting:', error);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});
```

#### For Prediction-Related Settings
Add to `src/routes/settings.prediction.js`:

```javascript
// Example: Add new prediction setting
router.post('/prediction-new-setting', isAuthenticated, async (req, res) => {
  try {
    // Implementation with advanced error handling
    res.json({
      success: true,
      message: 'Prediction setting saved successfully'
    });
  } catch (error) {
    console.error('Error saving prediction setting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save prediction setting'
    });
  }
});
```

### Working with Toast Notifications

#### Using Toast in Prediction Components

```typescript
import { useToast } from '@chakra-ui/react';

const MyComponent = () => {
  const toast = useToast();

  const handleOperation = async () => {
    try {
      // Perform operation
      await someAsyncOperation();
      
      // Show success toast
      toast({
        title: 'Operation Complete',
        description: 'Your operation completed successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      // Show error toast
      toast({
        title: 'Operation Failed',
        description: error.message || 'An error occurred',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
};
```

#### Toast Configuration Standards

```typescript
// Success toast
toast({
  title: 'Success Title',
  description: 'Detailed success message',
  status: 'success',
  duration: 3000,
  isClosable: true,
});

// Error toast
toast({
  title: 'Error Title',
  description: 'Specific error message',
  status: 'error',
  duration: 3000,
  isClosable: true,
});

// Important success (longer duration)
toast({
  title: 'Important Success',
  description: 'Critical operation completed',
  status: 'success',
  duration: 5000,
  isClosable: true,
});
```

## For Frontend Developers

### Component Integration

#### Importing Toast Hook
```typescript
import { useToast } from '@chakra-ui/react';
```

#### Using Toast in Components
```typescript
const MyComponent = () => {
  const toast = useToast();
  
  // Use toast in event handlers
  const handleClick = () => {
    toast({
      title: 'Action Performed',
      description: 'Your action was successful',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };
};
```

### API Integration

#### Updated Response Handling
```typescript
// Handle new response format
const response = await fetch('/api/settings/prediction-db-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(config)
});

const result = await response.json();

if (result.success) {
  toast({
    title: 'Configuration Saved',
    description: result.message,
    status: 'success',
    duration: 3000,
    isClosable: true,
  });
} else {
  toast({
    title: 'Configuration Failed',
    description: result.message,
    status: 'error',
    duration: 3000,
    isClosable: true,
  });
}
```

## For System Administrators

### Deployment

#### No Changes Required
- Same Docker deployment process
- Same configuration files
- Same environment variables
- Same port mappings

#### Enhanced Logging
New error messages provide better debugging information:

```bash
# More specific database connection errors
ERROR: Cannot connect to database server at localhost:5432. Please check if PostgreSQL is running and accessible.

# Instead of generic errors
ERROR: Database connection failed
```

### Monitoring

#### Log Patterns to Watch
```bash
# Successful prediction database configuration
INFO: Prediction database configuration saved successfully

# Connection test results
INFO: Database connection test successful
ERROR: Prediction database connection test failed: [specific error]

# Service integration
INFO: Prediction database service reloaded successfully
ERROR: Error reloading prediction database service: [details]
```

## Testing

### Unit Testing

#### Testing Settings Routes
```javascript
// Test basic settings
describe('Basic Settings', () => {
  test('should update theme', async () => {
    const response = await request(app)
      .post('/api/settings/theme')
      .send({ theme: 'dark' })
      .expect(200);
    
    expect(response.body.message).toBe('Theme updated successfully');
  });
});

// Test prediction settings
describe('Prediction Settings', () => {
  test('should save database config', async () => {
    const config = {
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test'
    };
    
    const response = await request(app)
      .post('/api/settings/prediction-db-config')
      .send(config)
      .expect(200);
    
    expect(response.body.success).toBe(true);
  });
});
```

#### Testing Toast Components
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

test('should show success toast on successful operation', async () => {
  render(
    <ChakraProvider>
      <MyComponent />
    </ChakraProvider>
  );
  
  fireEvent.click(screen.getByText('Perform Operation'));
  
  await waitFor(() => {
    expect(screen.getByText('Operation Complete')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Common Issues

#### Toast Not Appearing
```typescript
// Ensure ChakraProvider wraps your component
<ChakraProvider>
  <MyComponent />
</ChakraProvider>

// Ensure useToast is imported correctly
import { useToast } from '@chakra-ui/react';
```

#### Settings Route Not Found
```javascript
// Ensure routes are properly mounted
router.use('/', predictionRoutes);

// Check route path in settings.prediction.js
router.get('/prediction-db-config', isAuthenticated, async (req, res) => {
  // Handler
});
```

#### Database Connection Issues
```javascript
// Check error message format in response
{
  "success": false,
  "message": "Cannot connect to database server at localhost:5432. Please check if PostgreSQL is running and accessible."
}
```

## Best Practices

### Code Organization
1. **Basic settings** → `settings.js`
2. **Domain-specific settings** → separate modules
3. **Helper functions** → bottom of module files
4. **Error handling** → specific, user-friendly messages

### Toast Usage
1. **Immediate feedback** for user actions
2. **Specific messages** for different scenarios
3. **Consistent duration** based on message importance
4. **Proper status types** (success, error, warning, info)

### Error Handling
1. **Specific error codes** for different failure types
2. **User-friendly messages** instead of technical details
3. **Actionable guidance** when possible
4. **Proper HTTP status codes**

This migration guide ensures smooth transition to the new architecture while maintaining all existing functionality and improving the development experience.
