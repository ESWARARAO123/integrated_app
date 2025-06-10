#!/usr/bin/env node

/**
 * Test script for the file cleanup service
 * Creates test files and verifies cleanup functionality
 */

const fs = require('fs').promises;
const path = require('path');
const FileCleanupService = require('../services/fileCleanupService');

async function createTestFile(filePath, content = 'Test file content') {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  console.log(`✓ Created test file: ${filePath}`);
}

async function testFileCleanup() {
  console.log('🧪 Testing File Cleanup Service\n');

  const fileCleanupService = new FileCleanupService();
  const testDir = path.join(process.cwd(), 'DATA', 'documents', 'test-user-123');
  
  try {
    // Create test files
    const testFiles = [
      path.join(testDir, 'test-document-1.pdf'),
      path.join(testDir, 'test-document-2.docx'),
      path.join(testDir, 'test-document-3.txt')
    ];

    console.log('📁 Creating test files...');
    for (const filePath of testFiles) {
      await createTestFile(filePath, `Test content for ${path.basename(filePath)}`);
    }

    // Test 1: Schedule cleanup for successful processing
    console.log('\n🔄 Test 1: Schedule cleanup for successful processing');
    const scheduleResult = await fileCleanupService.scheduleCleanup(
      testFiles[0],
      {
        id: 'test-doc-1',
        original_name: 'test-document-1.pdf',
        user_id: 'test-user-123'
      },
      true // successful processing
    );
    console.log('Schedule result:', scheduleResult);

    // Test 2: Schedule cleanup for failed processing (should be skipped if keep_failed_files is true)
    console.log('\n🔄 Test 2: Schedule cleanup for failed processing');
    const scheduleFailedResult = await fileCleanupService.scheduleCleanup(
      testFiles[1],
      {
        id: 'test-doc-2',
        original_name: 'test-document-2.docx',
        user_id: 'test-user-123'
      },
      false // failed processing
    );
    console.log('Schedule failed result:', scheduleFailedResult);

    // Test 3: Immediate cleanup
    console.log('\n🔄 Test 3: Immediate cleanup');
    const immediateResult = await fileCleanupService.cleanupNow(testFiles[2]);
    console.log('Immediate cleanup result:', immediateResult);

    // Test 4: Get cleanup statistics
    console.log('\n📊 Test 4: Get cleanup statistics');
    const stats = await fileCleanupService.getCleanupStats();
    console.log('Cleanup stats:', stats);

    // Wait a bit for scheduled cleanup to potentially execute
    console.log('\n⏳ Waiting 5 seconds for scheduled cleanup...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check which files still exist
    console.log('\n📋 Final file status:');
    for (const filePath of testFiles) {
      try {
        await fs.access(filePath);
        console.log(`  ✓ ${path.basename(filePath)} - Still exists`);
      } catch (error) {
        console.log(`  ✗ ${path.basename(filePath)} - Deleted`);
      }
    }

    console.log('\n✅ File cleanup test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup test files that might still exist
    console.log('\n🧹 Cleaning up test files...');
    try {
      const testDir = path.join(process.cwd(), 'DATA', 'documents', 'test-user-123');
      await fs.rmdir(testDir, { recursive: true });
      console.log('✓ Test directory cleaned up');
    } catch (cleanupError) {
      console.warn('⚠ Could not clean up test directory:', cleanupError.message);
    }
  }
}

// Run test if called directly
if (require.main === module) {
  testFileCleanup().catch(console.error);
}

module.exports = testFileCleanup;
