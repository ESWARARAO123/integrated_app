#!/usr/bin/env node
/**
 * Verification Script for Session Cleanup Implementation
 * 
 * This script verifies that the session deletion with ChromaDB cleanup
 * is properly implemented and working as expected.
 */

const fs = require('fs');
const path = require('path');

class ImplementationVerifier {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.successes = [];
  }

  /**
   * Check if a file exists and contains expected content
   */
  checkFileContent(filePath, expectedContent, description) {
    try {
      if (!fs.existsSync(filePath)) {
        this.errors.push(`❌ File not found: ${filePath}`);
        return false;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const hasContent = expectedContent.every(expected => content.includes(expected));
      
      if (hasContent) {
        this.successes.push(`✅ ${description}: ${filePath}`);
        return true;
      } else {
        this.errors.push(`❌ Missing expected content in ${filePath}: ${description}`);
        return false;
      }
    } catch (error) {
      this.errors.push(`❌ Error checking ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Verify VectorStoreService implementation
   */
  verifyVectorStoreService() {
    console.log('\n🔍 Verifying VectorStoreService implementation...');
    
    const filePath = 'src/services/vectorStoreService.js';
    const expectedMethods = [
      'deleteSessionImageData',
      'deleteUserCollections',
      'userHasData',
      'getUserImageCollection'
    ];

    this.checkFileContent(
      filePath,
      expectedMethods,
      'VectorStoreService has all required methods'
    );

    // Check specific implementation details
    const specificChecks = [
      'user_${userId.replace(/-/g, \'_\')}_images',
      'chromaClient.deleteCollection',
      'textCollection: { success: false, error: null }',
      'imageCollection: { success: false, error: null }'
    ];

    this.checkFileContent(
      filePath,
      specificChecks,
      'VectorStoreService implementation details'
    );
  }

  /**
   * Verify chatbot route implementation
   */
  verifyChatbotRoute() {
    console.log('\n🔍 Verifying chatbot route implementation...');
    
    const filePath = 'src/routes/chatbot.js';
    const expectedContent = [
      'deleteSessionData(sessionId, userId)',
      'deleteSessionImageData(sessionId, userId)',
      'deleteUserCollections(userId)',
      'SELECT COUNT(*) as count FROM chat_sessions WHERE user_id = $1',
      'remainingSessionsCount === 0',
      'collectionsWiped: remainingSessionsCount === 0'
    ];

    this.checkFileContent(
      filePath,
      expectedContent,
      'Chatbot route has enhanced deletion logic'
    );
  }

  /**
   * Verify ollama route implementation
   */
  verifyOllamaRoute() {
    console.log('\n🔍 Verifying ollama route implementation...');
    
    const filePath = 'src/routes/ollama.js';
    const expectedContent = [
      'deleteSessionData(sessionId, userId)',
      'deleteSessionImageData(sessionId, userId)',
      'textResult.success && imageResult.success',
      'textChunksDeleted: textResult.deletedCount',
      'imageChunksDeleted: imageResult.deletedCount'
    ];

    this.checkFileContent(
      filePath,
      expectedContent,
      'Ollama route has enhanced RAG data deletion'
    );
  }

  /**
   * Verify frontend integration
   */
  verifyFrontendIntegration() {
    console.log('\n🔍 Verifying frontend integration...');
    
    // Check that the existing frontend code is still compatible
    const ragServicePath = 'client/src/services/ragChatService.ts';
    const useChatSessionsPath = 'client/src/hooks/useChatSessions.ts';

    this.checkFileContent(
      ragServicePath,
      ['clearRagData'],
      'RAG service has clearRagData method'
    );

    this.checkFileContent(
      useChatSessionsPath,
      ['ragChatService.clearRagData(sessionId)'],
      'useChatSessions calls RAG data clearing'
    );
  }

  /**
   * Verify test and documentation files
   */
  verifyTestsAndDocs() {
    console.log('\n🔍 Verifying tests and documentation...');
    
    const testScriptPath = 'scripts/test_session_deletion.js';
    const docsPath = 'docs/session-deletion-chromadb-cleanup.md';

    this.checkFileContent(
      testScriptPath,
      ['SessionDeletionTester', 'testSessionDeletion', 'testUserCollectionWipe'],
      'Test script exists and has required methods'
    );

    this.checkFileContent(
      docsPath,
      ['Session Deletion with ChromaDB Cleanup', 'User Isolation', 'Implementation Details'],
      'Documentation exists and covers key topics'
    );
  }

  /**
   * Check for potential issues
   */
  checkForIssues() {
    console.log('\n🔍 Checking for potential issues...');

    // Check for proper error handling
    const vectorServicePath = 'src/services/vectorStoreService.js';
    if (fs.existsSync(vectorServicePath)) {
      const content = fs.readFileSync(vectorServicePath, 'utf8');
      
      if (!content.includes('try {') || !content.includes('catch (error)')) {
        this.warnings.push('⚠️ VectorStoreService may be missing error handling');
      }

      if (!content.includes('console.log') && !content.includes('logger')) {
        this.warnings.push('⚠️ VectorStoreService may be missing logging');
      }
    }

    // Check for user isolation
    const chatbotRoutePath = 'src/routes/chatbot.js';
    if (fs.existsSync(chatbotRoutePath)) {
      const content = fs.readFileSync(chatbotRoutePath, 'utf8');
      
      if (!content.includes('req.session.userId')) {
        this.warnings.push('⚠️ Chatbot route may be missing user authentication');
      }
    }
  }

  /**
   * Run all verifications
   */
  async runVerification() {
    console.log('🚀 Starting Implementation Verification\n');
    console.log('This script verifies that the session deletion with ChromaDB cleanup');
    console.log('has been properly implemented across all components.\n');

    // Run all verification steps
    this.verifyVectorStoreService();
    this.verifyChatbotRoute();
    this.verifyOllamaRoute();
    this.verifyFrontendIntegration();
    this.verifyTestsAndDocs();
    this.checkForIssues();

    // Print results
    console.log('\n📊 Verification Results:');
    console.log('========================');

    if (this.successes.length > 0) {
      console.log('\n✅ Successes:');
      this.successes.forEach(success => console.log(`   ${success}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      this.warnings.forEach(warning => console.log(`   ${warning}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(error => console.log(`   ${error}`));
    }

    // Summary
    console.log('\n📈 Summary:');
    console.log(`   ✅ Successes: ${this.successes.length}`);
    console.log(`   ⚠️ Warnings: ${this.warnings.length}`);
    console.log(`   ❌ Errors: ${this.errors.length}`);

    if (this.errors.length === 0) {
      console.log('\n🎉 Implementation verification completed successfully!');
      console.log('\n📝 Next Steps:');
      console.log('   1. Test the functionality by uploading documents and creating sessions');
      console.log('   2. Delete sessions and verify ChromaDB cleanup in logs');
      console.log('   3. Run the test script: node scripts/test_session_deletion.js');
      console.log('   4. Monitor logs for proper cleanup messages');
    } else {
      console.log('\n🔧 Please fix the errors above before proceeding.');
    }

    return this.errors.length === 0;
  }
}

// Run the verification
async function main() {
  const verifier = new ImplementationVerifier();
  const success = await verifier.runVerification();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
}

module.exports = ImplementationVerifier;
