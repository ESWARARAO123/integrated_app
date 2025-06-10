# User-Isolated RAG System Documentation

## Overview

This document explains how our RAG (Retrieval Augmented Generation) system implements user isolation, ensuring that each user's documents and embeddings are securely separated and not accessible to other users.

## Architecture

The system employs a multi-layered approach to user isolation:

```
┌─────────────────────────────────────────────────────────────┐
│                     RAG SYSTEM                              │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  Upload Flow    │    │  Retrieval Flow │                │
│  │                 │    │                 │                │
│  │  User → PDF    ─┼───►│  User → Query   │                │
│  │       ↓         │    │       ↓         │                │
│  │  Process Doc    │    │  Embed Query    │                │
│  │       ↓         │    │       ↓         │                │
│  │  Generate       │    │  Search USER's  │                │
│  │  Embeddings     │    │  Collection     │                │
│  │       ↓         │    │       ↓         │                │
│  │  Store in USER  │    │  Return USER's  │                │
│  │  Collection     │    │  Documents Only │                │
│  └─────────────────┘    └─────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## User Isolation Implementation

### 1. Dedicated ChromaDB Collections

The core of our user isolation strategy is creating dedicated ChromaDB collections for each user:

```javascript
async getUserCollection(userId) {
  try {
    const collectionName = `user_${userId.replace(/-/g, '_')}_docs`;
    
    try {
      const collection = await this.chromaClient.getCollection({
        name: collectionName
      });
      console.log(`Retrieved existing ChromaDB collection: ${collectionName}`);
      return collection;
    } catch (error) {
      console.log(`Creating new ChromaDB collection: ${collectionName}`);
      const collection = await this.chromaClient.createCollection({
        name: collectionName,
        metadata: {
          userId: userId,
          createdAt: new Date().toISOString()
        }
      });
      console.log(`Created new ChromaDB collection: ${collectionName}`);
      return collection;
    }
  } catch (error) {
    console.error(`Error managing user collection for ${userId}:`, error);
    throw error;
  }
}
```

This function ensures:
- Each user has their own collection with a unique name pattern: `user_[USER_ID]_docs`
- Collection names are consistent by replacing hyphens in UUIDs with underscores
- If a collection doesn't exist, it's created with user metadata

### 2. User-Specific Document Storage

When processing documents, the system always requires a userId:

```javascript
async addDocumentChunks(documentId, chunks, embeddings, metadata = {}) {
  try {
    console.log(`Storing ${embeddings.length} embeddings in ChromaDB for document ${documentId}`);
    
    const userId = metadata.userId;
    if (!userId) {
      throw new Error('userId is required in metadata for user isolation');
    }

    // Get user-specific collection
    const collection = await this.getUserCollection(userId);
    
    // Add chunks with user metadata...
  }
}
```

Key aspects:
- The userId is required for all document storage operations
- Each document chunk includes the userId as metadata
- File paths include the userId in the directory structure

### 3. User-Isolated Search

When querying the vector database, the system enforces user-specific queries:

```javascript
async search(queryEmbedding, options = {}) {
  const { limit = 10, sessionId, userId } = options;
  
  if (!userId) {
    throw new Error('userId is required for user-isolated search');
  }

  try {
    const collection = await this.getUserCollection(userId);
    
    console.log(`🔍 Searching ChromaDB for user ${userId} with limit ${limit}`);
    
    // Simple where clause - just filter by userId
    let whereClause = { userId: userId };
    
    // Query user's collection with filtering
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      where: whereClause
    });
    
    // Process results...
  }
}
```

This ensures:
- Searches are performed only on the user's collection
- Additional filtering by userId ensures proper isolation
- The system will error rather than return data without user context

### 4. File System Isolation

Document processing respects user boundaries at the file system level:

```
/DATA/documents/[USER_ID]/[DOCUMENT_ID].pdf
/DATA/embeddings/[USER_ID]/[DOCUMENT_ID].json
```

The document worker traces this isolation throughout processing:

```javascript
const { documentId, userId, sessionId, filePath, fileName, fileType } = job.data;

// Process document with user context
const result = await this.documentProcessor.processDocument(
  document,
  { 
    userId, 
    sessionId, 
    jobId: job.id,
    workerId: process.pid,
    ...processingOptions 
  },
  onProgress
);
```

## Security Considerations

1. **Strict User Validation**: All operations require a valid userId
2. **Collection Naming**: Collections use the user's unique ID, preventing access conflicts
3. **Metadata Filtering**: Additional userId filtering in metadata prevents cross-contamination
4. **No Default Collections**: The system never uses shared/default collections
5. **Progress Tracking**: All processing updates are scoped to the user via WebSockets

## Benefits of User Isolation

1. **Data Privacy**: Users can only access their own documents
2. **Performance**: Smaller, user-specific collections improve search speed
3. **Resource Efficiency**: Processing only works on relevant user data
4. **Custom Tuning**: Allows for user-specific optimization of RAG parameters
5. **Compliance**: Helps meet data isolation requirements for privacy regulations

## Usage Examples

### Document Upload Flow

1. User uploads a PDF document
2. System assigns document to user's collection
3. Document processing occurs with user context
4. Embeddings are stored in user's isolated collection

### Query Flow

1. User submits a question
2. System embeds the question
3. Query is performed ONLY on user's collection
4. Results are filtered to ensure they belong to the user
5. Responses include only the user's own documents

## Monitoring and Management

The system provides user-specific collection statistics:

```javascript
async getStats(userId = null) {
  try {
    // User-specific stats
    const collection = await this.getUserCollection(userId);
    const count = await collection.count();
    
    // Get unique documents for this user
    const results = await collection.get({
      where: { userId: userId }
    });
    
    const uniqueDocuments = new Set();
    // Count unique documents...
    
    return {
      totalChunks: count,
      totalDocuments: uniqueDocuments.size,
      userId: userId
    };
  } catch (error) {
    // Handle error...
  }
}
```

This allows for monitoring the size and growth of each user's data separately.

## Conclusion

Our RAG system implements comprehensive user isolation at multiple levels:
1. **Storage**: Separate ChromaDB collections per user
2. **Metadata**: User ID embedded in all document metadata
3. **Queries**: Enforced user context in all retrieval operations
4. **File System**: User-specific directory structure
5. **Processing**: User context maintained throughout the pipeline

This ensures complete isolation of user data, preventing any possibility of data leakage between users while maintaining high performance and scalability. 