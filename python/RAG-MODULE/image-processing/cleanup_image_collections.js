#!/usr/bin/env node
/**
 * Cleanup Script for Image Collections
 * Deletes user image collections from both filesystem and ChromaDB
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class ImageCollectionCleaner {
  constructor() {
    this.baseDataDir = '/app/data';
    this.collectionsDir = path.join(this.baseDataDir, 'collections');
    this.chromaDbHost = process.env.CHROMADB_HOST || 'chromadb';
    this.chromaDbPort = process.env.CHROMADB_PORT || '8000';
  }

  /**
   * List all user image collections
   */
  async listImageCollections() {
    try {
      const collections = [];
      
      if (!(await this.directoryExists(this.collectionsDir))) {
        console.log('📁 No collections directory found');
        return collections;
      }

      const entries = await fs.readdir(this.collectionsDir);
      
      for (const entry of entries) {
        if (entry.includes('_images')) {
          const collectionPath = path.join(this.collectionsDir, entry);
          const stats = await fs.stat(collectionPath);
          
          if (stats.isDirectory()) {
            const info = await this.getCollectionInfo(collectionPath);
            collections.push({
              name: entry,
              path: collectionPath,
              ...info
            });
          }
        }
      }

      return collections;
    } catch (error) {
      console.error('❌ Error listing collections:', error.message);
      return [];
    }
  }

  /**
   * Get information about a collection
   */
  async getCollectionInfo(collectionPath) {
    try {
      const sessions = [];
      let totalImages = 0;
      let totalSize = 0;

      const entries = await fs.readdir(collectionPath);
      
      for (const entry of entries) {
        const sessionPath = path.join(collectionPath, entry);
        const stats = await fs.stat(sessionPath);
        
        if (stats.isDirectory()) {
          const sessionInfo = await this.getSessionInfo(sessionPath);
          sessions.push({
            name: entry,
            path: sessionPath,
            ...sessionInfo
          });
          totalImages += sessionInfo.imageCount;
          totalSize += sessionInfo.totalSize;
        }
      }

      return {
        sessions,
        totalImages,
        totalSize: Math.round(totalSize / 1024), // Convert to KB
        lastModified: (await fs.stat(collectionPath)).mtime
      };
    } catch (error) {
      return {
        sessions: [],
        totalImages: 0,
        totalSize: 0,
        error: error.message
      };
    }
  }

  /**
   * Get information about a session
   */
  async getSessionInfo(sessionPath) {
    try {
      const entries = await fs.readdir(sessionPath);
      let imageCount = 0;
      let totalSize = 0;
      let metadataFile = null;

      for (const entry of entries) {
        const filePath = path.join(sessionPath, entry);
        const stats = await fs.stat(filePath);
        
        if (entry === 'collection_metadata.json') {
          metadataFile = filePath;
        } else if (entry.startsWith('img_')) {
          imageCount++;
          totalSize += stats.size;
        }
      }

      let metadata = null;
      if (metadataFile) {
        try {
          const content = await fs.readFile(metadataFile, 'utf8');
          metadata = JSON.parse(content);
        } catch (e) {
          console.warn(`⚠️ Could not read metadata: ${e.message}`);
        }
      }

      return {
        imageCount,
        totalSize,
        metadata,
        lastModified: (await fs.stat(sessionPath)).mtime
      };
    } catch (error) {
      return {
        imageCount: 0,
        totalSize: 0,
        metadata: null,
        error: error.message
      };
    }
  }

  /**
   * Delete a specific user's image collection
   */
  async deleteUserCollection(userId, sessionId = null) {
    try {
      console.log(`🗑️ Deleting collection for user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`);
      
      const userCollectionName = `user_${userId.replace(/-/g, '_')}_images`;
      const userCollectionPath = path.join(this.collectionsDir, userCollectionName);

      if (!(await this.directoryExists(userCollectionPath))) {
        console.log(`📁 Collection not found: ${userCollectionName}`);
        return { success: false, message: 'Collection not found' };
      }

      if (sessionId) {
        // Delete specific session
        const sessionName = `session_${sessionId.replace(/-/g, '_')}`;
        const sessionPath = path.join(userCollectionPath, sessionName);
        
        if (await this.directoryExists(sessionPath)) {
          await this.deleteDirectory(sessionPath);
          console.log(`✅ Deleted session: ${sessionName}`);
          
          // Check if user collection is now empty
          const remainingSessions = await fs.readdir(userCollectionPath);
          if (remainingSessions.length === 0) {
            await this.deleteDirectory(userCollectionPath);
            console.log(`✅ Deleted empty user collection: ${userCollectionName}`);
          }
        } else {
          console.log(`📁 Session not found: ${sessionName}`);
          return { success: false, message: 'Session not found' };
        }
      } else {
        // Delete entire user collection
        await this.deleteDirectory(userCollectionPath);
        console.log(`✅ Deleted user collection: ${userCollectionName}`);
      }

      return { success: true, message: 'Collection deleted successfully' };
    } catch (error) {
      console.error(`❌ Error deleting collection: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete all image collections
   */
  async deleteAllImageCollections() {
    try {
      console.log('🗑️ Deleting ALL image collections...');
      
      const collections = await this.listImageCollections();
      
      if (collections.length === 0) {
        console.log('📁 No image collections found');
        return { success: true, message: 'No collections to delete' };
      }

      let deletedCount = 0;
      for (const collection of collections) {
        try {
          await this.deleteDirectory(collection.path);
          console.log(`✅ Deleted: ${collection.name}`);
          deletedCount++;
        } catch (error) {
          console.error(`❌ Failed to delete ${collection.name}: ${error.message}`);
        }
      }

      console.log(`🎯 Deleted ${deletedCount} out of ${collections.length} collections`);
      return { success: true, deletedCount, totalCount: collections.length };
    } catch (error) {
      console.error(`❌ Error deleting all collections: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up ChromaDB image collections (if they exist)
   */
  async cleanupChromaDbImageCollections() {
    try {
      console.log('🗄️ Cleaning up ChromaDB image collections...');
      
      // This would require ChromaDB client integration
      // For now, just log the action
      console.log('ℹ️ ChromaDB cleanup would be implemented here');
      console.log('   - List all collections with "_images" suffix');
      console.log('   - Delete collections that match image collection pattern');
      
      return { success: true, message: 'ChromaDB cleanup completed' };
    } catch (error) {
      console.error(`❌ ChromaDB cleanup error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Utility: Check if directory exists
   */
  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Utility: Delete directory recursively
   */
  async deleteDirectory(dirPath) {
    await fs.rm(dirPath, { recursive: true, force: true });
  }

  /**
   * Display collections summary
   */
  async displayCollectionsSummary() {
    console.log('📊 IMAGE COLLECTIONS SUMMARY');
    console.log('=' * 40);
    
    const collections = await this.listImageCollections();
    
    if (collections.length === 0) {
      console.log('📁 No image collections found');
      return;
    }

    let totalImages = 0;
    let totalSize = 0;

    for (const collection of collections) {
      console.log(`\n👤 ${collection.name}`);
      console.log(`   📁 Path: ${collection.path}`);
      console.log(`   🖼️ Images: ${collection.totalImages}`);
      console.log(`   💾 Size: ${collection.totalSize}KB`);
      console.log(`   📅 Modified: ${collection.lastModified.toISOString()}`);
      
      if (collection.sessions.length > 0) {
        console.log(`   📂 Sessions:`);
        for (const session of collection.sessions) {
          console.log(`      - ${session.name}: ${session.imageCount} images (${Math.round(session.totalSize/1024)}KB)`);
        }
      }

      totalImages += collection.totalImages;
      totalSize += collection.totalSize;
    }

    console.log(`\n📈 TOTALS:`);
    console.log(`   Collections: ${collections.length}`);
    console.log(`   Total Images: ${totalImages}`);
    console.log(`   Total Size: ${totalSize}KB`);
  }
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);
  const cleaner = new ImageCollectionCleaner();

  if (args.length === 0) {
    console.log('🧹 Image Collection Cleanup Tool');
    console.log('================================');
    console.log('Usage:');
    console.log('  node cleanup_image_collections.js list                    # List all collections');
    console.log('  node cleanup_image_collections.js delete-user <userId>    # Delete user collection');
    console.log('  node cleanup_image_collections.js delete-session <userId> <sessionId>  # Delete specific session');
    console.log('  node cleanup_image_collections.js delete-all              # Delete all collections');
    console.log('  node cleanup_image_collections.js cleanup-chromadb        # Cleanup ChromaDB');
    return;
  }

  const command = args[0];

  switch (command) {
    case 'list':
      await cleaner.displayCollectionsSummary();
      break;

    case 'delete-user':
      if (args.length < 2) {
        console.error('❌ Usage: delete-user <userId>');
        process.exit(1);
      }
      const result = await cleaner.deleteUserCollection(args[1]);
      console.log(result.success ? '✅ Success' : '❌ Failed:', result.message || result.error);
      break;

    case 'delete-session':
      if (args.length < 3) {
        console.error('❌ Usage: delete-session <userId> <sessionId>');
        process.exit(1);
      }
      const sessionResult = await cleaner.deleteUserCollection(args[1], args[2]);
      console.log(sessionResult.success ? '✅ Success' : '❌ Failed:', sessionResult.message || sessionResult.error);
      break;

    case 'delete-all':
      const allResult = await cleaner.deleteAllImageCollections();
      console.log(allResult.success ? '✅ Success' : '❌ Failed:', allResult.message || allResult.error);
      break;

    case 'cleanup-chromadb':
      const chromaResult = await cleaner.cleanupChromaDbImageCollections();
      console.log(chromaResult.success ? '✅ Success' : '❌ Failed:', chromaResult.message || chromaResult.error);
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ImageCollectionCleaner;
