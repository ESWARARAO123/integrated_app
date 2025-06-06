# 🔒 User Isolation Implementation Guide

## 📋 **Overview**

This document explains how **complete user isolation** was implemented in the RAG (Retrieval-Augmented Generation) system, ensuring that each user's documents, embeddings, and RAG capabilities are completely separate from other users.

## 🎯 **User Isolation Requirements**

### **Core Principles:**
1. **Data Separation**: Each user's documents must be stored separately
2. **Search Isolation**: Users can only search their own documents
3. **RAG Toggle Independence**: Each user's RAG availability is independent
4. **Session Management**: User-specific session data handling
5. **Security**: No cross-user data leakage

---

## 🏗️ **Architecture Overview**

### **Before User Isolation:**
```
┌─────────────────┐
│   Single Store  │
├─────────────────┤
│ All Users' Docs │
│ Mixed Together  │
│ No Separation   │
└─────────────────┘
```

### **After User Isolation:**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User A Store  │    │   User B Store  │    │   User C Store  │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ User A Docs     │    │ User B Docs     │    │ User C Docs     │
│ User A Sessions │    │ User B Sessions │    │ User C Sessions │
│ User A RAG      │    │ User B RAG      │    │ User C RAG      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🔧 **Implementation Components**

### **1. ChromaDB Collection Isolation**

#### **Collection Naming Strategy:**
```javascript
// User-specific collection names
const getCollectionName = (userId) => {
  return `user_${userId.replace(/-/g, '_')}_docs`;
};

// Example:
// User ID: "65642ced-1986-4579-90c9-d066724f987c"
// Collection: "user_65642ced_1986_4579_90c9_d066724f987c_docs"
```

#### **Collection Creation Logic:**
```javascript
// src/services/vectorStoreService.js
async getUserCollection(userId) {
  if (!userId) {
    throw new Error('userId is required for user isolation');
  }

  const collectionName = `user_${userId.replace(/-/g, '_')}_docs`;
  
  try {
    // Try to get existing collection
    const collection = await this.chromaClient.getCollection({
      name: collectionName
    });
    console.log(`Retrieved existing ChromaDB collection: ${collectionName}`);
    return collection;
  } catch (error) {
    // Create new collection if it doesn't exist
    console.log(`Creating new ChromaDB collection: ${collectionName}`);
    const collection = await this.chromaClient.createCollection({
      name: collectionName,
      metadata: {
        userId: userId,
        createdAt: new Date().toISOString(),
        description: `Document collection for user ${userId}`
      }
    });
    console.log(`Created new ChromaDB collection: ${collectionName}`);
    return collection;
  }
}
```

### **2. Document Storage Isolation**

#### **File System Structure:**
```
DATA/
├── documents/
│   ├── user_a_id/
│   │   ├── document1.pdf
│   │   └── document2.pdf
│   ├── user_b_id/
│   │   ├── document3.pdf
│   │   └── document4.pdf
│   └── user_c_id/
│       └── document5.pdf
└── embeddings/
    ├── user_a_id/
    ├── user_b_id/
    └── user_c_id/
```

#### **Document Upload with User Context:**
```javascript
// src/routes/documents.js
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id; // From authentication middleware
    
    // Create user-specific directory
    const userDir = path.join(documentsDir, userId);
    await fsExtra.ensureDir(userDir);
    
    // Store document with user context
    const document = await documentService.createDocument({
      original_name: file.originalname,
      file_path: filePath,
      file_type: file.mimetype,
      file_size: file.size,
      user_id: userId,        // 🔑 User isolation key
      session_id: sessionId || null,
      status: 'uploaded'
    });
    
    // Queue for processing with user context
    await documentQueueService.addDocumentToQueue(document.id, {
      userId: userId,         // 🔑 Passed to workers
      sessionId: sessionId,
      priority: 0
    });
  } catch (error) {
    // Error handling
  }
});
```

### **3. Embedding Storage with User Metadata**

#### **ChromaDB Storage with User Context:**
```javascript
// src/services/vectorStoreService.js
async addDocumentChunks(documentId, chunks, embeddings, metadata = {}) {
  try {
    const userId = metadata.userId;
    if (!userId) {
      throw new Error('userId is required in metadata for user isolation');
    }

    // Get user-specific collection
    const collection = await this.getUserCollection(userId);
    
    // Prepare user-specific metadata
    const ids = chunks.map((_, index) => `${documentId}_chunk_${index}`);
    const documents = chunks;
    const metadatas = chunks.map((chunk, index) => ({
      documentId: documentId.toString(),
      chunkIndex: index.toString(),
      sessionId: metadata.sessionId ? metadata.sessionId.toString() : "no_session",
      userId: userId.toString(),           // 🔑 User isolation in metadata
      timestamp: new Date().toISOString(),
      fileName: metadata.fileName || "unknown",
      fileType: metadata.fileType || "unknown"
    }));

    // Store in user-specific collection
    await collection.add({
      ids: ids,
      embeddings: embeddings,
      documents: documents,
      metadatas: metadatas
    });
    
    console.log(`✅ Successfully stored ${embeddings.length} vectors for document ${documentId} in user collection`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to store document ${documentId}:`, error);
    return { success: false, error: error.message };
  }
}
```

### **4. Search Isolation**

#### **User-Specific Search:**
```javascript
// src/services/vectorStoreService.js
async search(queryEmbedding, options = {}) {
  const { limit = 10, sessionId, userId } = options;
  
  if (!userId) {
    throw new Error('userId is required for user-isolated search');
  }

  try {
    // Get user-specific collection
    const collection = await this.getUserCollection(userId);
    
    console.log(`🔍 Searching ChromaDB for user ${userId} with limit ${limit}`);
    
    // Search only in user's collection
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      where: { userId: userId }  // 🔑 Additional user filter
    });

    // Process and return results
    if (!results.documents || !results.documents[0]) {
      console.log(`No results found for user ${userId}`);
      return [];
    }

    return results.documents[0].map((doc, index) => ({
      content: doc,
      score: results.distances[0][index],
      metadata: results.metadatas[0][index]
    }));
  } catch (error) {
    console.error(`Error searching for user ${userId}:`, error);
    return [];
  }
}
```

### **5. RAG Toggle Isolation**

#### **User-Specific RAG Availability:**
```javascript
// src/services/ragService.js
async isRagAvailable(userId = null) {
  try {
    await this.initializeServices();

    if (!this.vectorStoreService) {
      console.log('RAG: Vector store service not available');
      return false;
    }

    // Get user-specific stats
    const stats = await this.vectorStoreService.getStats(userId);
    console.log(`RAG: Availability check - Vector store has ${stats.totalChunks} chunks in ${stats.totalDocuments} documents${userId ? ` for user ${userId}` : ''}`);

    const isAvailable = stats.totalChunks > 0;
    
    if (isAvailable) {
      console.log(`RAG: Available for user ${userId}`);
    } else {
      console.log(`RAG: Not available for user ${userId} - no documents found`);
    }

    return isAvailable;
  } catch (error) {
    console.error(`RAG: Error checking availability for user ${userId}:`, error);
    return false;
  }
}
```

#### **User-Specific Stats Calculation:**
```javascript
// src/services/vectorStoreService.js
async getStats(userId = null) {
  try {
    if (!userId) {
      // Return aggregate stats for admin
      return await this.getAggregateStats();
    }

    // User-specific stats
    if (this.useChromaDB && this.chromaClient) {
      try {
        const collection = await this.getUserCollection(userId);
        const count = await collection.count();
        
        // Get unique documents for this user
        const results = await collection.get({
          where: { userId: userId }
        });
        
        const uniqueDocuments = new Set();
        if (results.metadatas) {
          results.metadatas.forEach(metadata => {
            if (metadata.documentId) {
              uniqueDocuments.add(metadata.documentId);
            }
          });
        }
        
        return {
          totalChunks: count,
          totalDocuments: uniqueDocuments.size,
          userId: userId
        };
      } catch (error) {
        console.error(`Error getting user stats for ${userId}:`, error);
        return { totalChunks: 0, totalDocuments: 0, userId: userId };
      }
    }
    
    return { totalChunks: 0, totalDocuments: 0, userId: userId };
  } catch (error) {
    console.error('Error getting vector store stats:', error);
    return { totalChunks: 0, totalDocuments: 0, userId: userId };
  }
}
```

### **6. Session Data Isolation**

#### **User-Specific Session Deletion:**
```javascript
// src/services/vectorStoreService.js
async deleteSessionData(sessionId, userId) {
  try {
    if (!userId) {
      throw new Error('userId is required for user isolation');
    }

    const collection = await this.getUserCollection(userId);
    
    console.log(`🗑️ Deleting session data for sessionId: ${sessionId}, userId: ${userId}`);
    
    // Get all data for this user first
    const allResults = await collection.get({
      where: { userId: userId }
    });
    
    console.log(`Found ${allResults.ids?.length || 0} total chunks for user ${userId}`);
    
    // Filter by sessionId
    let idsToDelete = [];
    if (allResults.ids && allResults.metadatas) {
      for (let i = 0; i < allResults.ids.length; i++) {
        const metadata = allResults.metadatas[i];
        if (metadata.sessionId === sessionId || 
            (sessionId && metadata.sessionId === "no_session")) {
          idsToDelete.push(allResults.ids[i]);
        }
      }
    }
    
    if (idsToDelete.length > 0) {
      await collection.delete({ ids: idsToDelete });
      console.log(`✅ Deleted ${idsToDelete.length} chunks for session ${sessionId} (user ${userId})`);
    } else {
      console.log(`No chunks found for session ${sessionId} (user ${userId})`);
    }
    
    return { success: true, deletedCount: idsToDelete.length };
  } catch (error) {
    console.error(`❌ Error deleting session data:`, error);
    return { success: false, error: error.message };
  }
}
```

---

## 🔄 **API Integration with User Context**

### **Frontend RAG Toggle Check:**
```typescript
// client/src/services/ragChatService.ts
async checkRagAvailability(): Promise<boolean> {
  try {
    const response = await fetch('/api/ollama/rag-available', {
      method: 'GET',
      credentials: 'include', // 🔑 Includes user session
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.available || false;
  } catch (error) {
    console.error('Error checking RAG availability:', error);
    return false;
  }
}
```

### **Backend RAG Availability Endpoint:**
```javascript
// src/routes/ollama.js
router.get('/rag-available', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // 🔑 From authentication middleware
    
    // Check RAG availability for this specific user
    const isAvailable = await ragService.isRagAvailable(userId);
    
    res.json({ 
      available: isAvailable,
      userId: userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking RAG availability:', error);
    res.status(500).json({ 
      available: false, 
      error: 'Failed to check RAG availability' 
    });
  }
});
```

### **RAG Chat with User Context:**
```javascript
// src/routes/ollama.js
router.post('/rag-chat', authenticateToken, async (req, res) => {
  try {
    const { message, model, sessionId } = req.body;
    const userId = req.user.id; // 🔑 From authentication middleware
    
    // Process RAG chat with user context
    const result = await ragService.processRagChat(message, model, {
      sessionId: sessionId,
      userId: userId  // 🔑 User isolation in RAG processing
    });
    
    if (result.success) {
      res.json({
        response: result.response,
        sources: result.sources,
        context: result.context
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error in RAG chat:', error);
    res.status(500).json({ error: 'Failed to process RAG chat' });
  }
});
```

---

## 🔐 **Security Considerations**

### **1. Authentication Middleware:**
```javascript
// src/middleware/auth.js
const authenticateToken = (req, res, next) => {
  // Extract user from session/token
  if (req.session && req.session.userId) {
    req.user = { id: req.session.userId };
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
```

### **2. User ID Validation:**
```javascript
// Validate UUID format
const isValidUserId = (userId) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
};

// Sanitize collection names
const sanitizeCollectionName = (userId) => {
  if (!isValidUserId(userId)) {
    throw new Error('Invalid user ID format');
  }
  return `user_${userId.replace(/-/g, '_')}_docs`;
};
```

### **3. Cross-User Access Prevention:**
```javascript
// Always verify user ownership
const verifyUserAccess = async (documentId, userId) => {
  const document = await documentService.getDocument(documentId);
  if (document.user_id !== userId) {
    throw new Error('Access denied: Document belongs to different user');
  }
  return document;
};
```

---

## 📊 **Testing User Isolation**

### **Test Scenarios:**

#### **1. Document Upload Isolation:**
```javascript
// Test: User A uploads document
// Expected: Document only visible to User A
// Verification: User B cannot see User A's document
```

#### **2. RAG Toggle Independence:**
```javascript
// Test: User A has documents, User B has none
// Expected: User A sees RAG enabled, User B sees RAG disabled
// Verification: Each user's toggle reflects their own data
```

#### **3. Search Isolation:**
```javascript
// Test: User A searches for content in User B's documents
// Expected: No results returned
// Verification: Search only returns User A's documents
```

#### **4. Session Deletion Isolation:**
```javascript
// Test: User A deletes their session
// Expected: Only User A's session data is deleted
// Verification: User B's data remains intact
```

---

## 🎯 **Benefits Achieved**

### **1. Complete Data Separation:**
- ✅ Each user has their own ChromaDB collection
- ✅ File system isolation by user directory
- ✅ Metadata includes user identification

### **2. Independent RAG Functionality:**
- ✅ RAG toggle reflects individual user's document status
- ✅ Search results limited to user's own documents
- ✅ Chat responses based only on user's uploaded content

### **3. Scalable Architecture:**
- ✅ Supports unlimited users
- ✅ No performance impact from other users' data
- ✅ Easy to add new isolation features

### **4. Security & Privacy:**
- ✅ No cross-user data leakage
- ✅ User authentication enforced at all levels
- ✅ Session-based access control

---

## 🔧 **Key Implementation Files**

### **Modified Files for User Isolation:**

1. **`src/services/vectorStoreService.js`**
   - User-specific collection management
   - Isolated search functionality
   - User-specific stats calculation

2. **`src/services/ragService.js`**
   - User context in RAG availability checks
   - User-specific document retrieval

3. **`src/services/documentProcessor.js`**
   - User metadata in embedding storage
   - User context preservation through processing

4. **`src/routes/documents.js`**
   - User authentication integration
   - User-specific file storage

5. **`src/routes/ollama.js`**
   - User context in all RAG endpoints
   - User-specific RAG availability

6. **`client/src/services/ragChatService.ts`**
   - Session-based user identification
   - User-specific API calls

---

## 📈 **Performance Impact**

### **Minimal Overhead:**
- **Collection Creation**: One-time cost per user
- **Search Performance**: Improved (smaller collections)
- **Storage Efficiency**: Better organization
- **Memory Usage**: Unchanged

### **Scalability Benefits:**
- **Linear Scaling**: Performance scales with individual user data size
- **Isolation Benefits**: One user's large dataset doesn't affect others
- **Maintenance**: Easier to manage user-specific issues

This user isolation implementation ensures complete data separation while maintaining high performance and scalability for multi-user RAG applications. 