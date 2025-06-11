#!/usr/bin/env node

/**
 * Setup script for Chat2SQL Docker integration
 * Builds and starts the Chat2SQL service with proper configuration
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

async function setupChat2Sql() {
  console.log('\n🚀 Setting up Chat2SQL Docker Integration\n');
  
  try {
    // 1. Verify prerequisites
    console.log('1. Checking prerequisites...');
    
    // Check Docker
    try {
      await execCommand('docker --version');
      console.log('   ✓ Docker is available');
    } catch (error) {
      console.log('   ✗ Docker is not available');
      console.log('   💡 Please install Docker first');
      return false;
    }
    
    // Check Docker Compose
    try {
      await execCommand('docker compose version');
      console.log('   ✓ Docker Compose is available');
    } catch (error) {
      console.log('   ✗ Docker Compose is not available');
      console.log('   💡 Please install Docker Compose first');
      return false;
    }
    
    // Check if we're in the right directory
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    try {
      await fs.access(packageJsonPath);
      console.log('   ✓ Running from project root');
    } catch (error) {
      console.log('   ✗ Not in project root directory');
      console.log('   💡 Please run this script from the project root');
      return false;
    }
    
    // 2. Verify configuration files
    console.log('\n2. Verifying configuration files...');
    
    const configFiles = [
      'conf/config.ini',
      'Docker/Dockerfile.chat2sql',
      'Docker/docker-compose.yml',
      'Docker/env.docker',
      'python/CHAT2SQL-MODULE/backend.py',
      'python/CHAT2SQL-MODULE/requirements.txt'
    ];
    
    for (const file of configFiles) {
      try {
        await fs.access(file);
        console.log(`   ✓ ${file} exists`);
      } catch (error) {
        console.log(`   ✗ ${file} is missing`);
        return false;
      }
    }
    
    // 3. Build the Chat2SQL Docker image
    console.log('\n3. Building Chat2SQL Docker image...');
    try {
      console.log('   📦 Building image (this may take a few minutes)...');
      await execCommand('cd Docker && docker compose build chat2sql', { stdio: 'inherit' });
      console.log('   ✓ Chat2SQL image built successfully');
    } catch (error) {
      console.log('   ✗ Failed to build Chat2SQL image');
      console.log(`   Error: ${error.message}`);
      return false;
    }
    
    // 4. Start required services
    console.log('\n4. Starting required services...');
    try {
      console.log('   🔄 Starting Redis and ChromaDB...');
      await execCommand('cd Docker && docker compose up -d redis chromadb', { stdio: 'inherit' });
      console.log('   ✓ Base services started');
      
      // Wait a moment for services to initialize
      console.log('   ⏳ Waiting for services to initialize...');
      await sleep(5000);
      
    } catch (error) {
      console.log('   ✗ Failed to start base services');
      console.log(`   Error: ${error.message}`);
      return false;
    }
    
    // 5. Start Chat2SQL service
    console.log('\n5. Starting Chat2SQL service...');
    try {
      console.log('   🚀 Starting Chat2SQL container...');
      await execCommand('cd Docker && docker compose up -d chat2sql', { stdio: 'inherit' });
      console.log('   ✓ Chat2SQL service started');
      
      // Wait for service to be ready
      console.log('   ⏳ Waiting for Chat2SQL to be ready...');
      await sleep(10000);
      
    } catch (error) {
      console.log('   ✗ Failed to start Chat2SQL service');
      console.log(`   Error: ${error.message}`);
      return false;
    }
    
    // 6. Verify service health
    console.log('\n6. Verifying service health...');
    try {
      const axios = require('axios');
      
      // Test Chat2SQL health
      try {
        const response = await axios.get('http://localhost:5000/', { timeout: 10000 });
        console.log('   ✓ Chat2SQL service is healthy');
        console.log(`   📊 Status: ${response.data.status}`);
      } catch (healthError) {
        console.log('   ⚠ Chat2SQL health check failed');
        console.log('   💡 Service might still be starting up');
      }
      
      // Test Redis
      try {
        await execCommand('cd Docker && docker compose exec redis redis-cli ping');
        console.log('   ✓ Redis is responding');
      } catch (redisError) {
        console.log('   ⚠ Redis health check failed');
      }
      
      // Test ChromaDB
      try {
        const chromaResponse = await axios.get('http://localhost:8001/api/v1/heartbeat', { timeout: 5000 });
        console.log('   ✓ ChromaDB is responding');
      } catch (chromaError) {
        console.log('   ⚠ ChromaDB health check failed');
      }
      
    } catch (error) {
      console.log('   ⚠ Some health checks failed, but services might still work');
    }
    
    // 7. Show service status
    console.log('\n7. Service status summary...');
    try {
      console.log('   📋 Docker containers:');
      await execCommand('docker ps --filter "name=productdemo" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', { stdio: 'inherit' });
    } catch (error) {
      console.log('   ⚠ Could not get container status');
    }
    
    // 8. Run integration test
    console.log('\n8. Running integration test...');
    try {
      const testResult = await require('./test-chat2sql-docker')();
      if (testResult) {
        console.log('   ✅ Integration test passed');
      } else {
        console.log('   ⚠ Integration test had issues (check details above)');
      }
    } catch (testError) {
      console.log('   ⚠ Could not run integration test');
      console.log(`   Error: ${testError.message}`);
    }
    
    console.log('\n🎉 Chat2SQL Docker setup completed!');
    console.log('\n📋 Service URLs:');
    console.log('   • Chat2SQL API: http://localhost:5000');
    console.log('   • Main Application: http://localhost:5634 (start with: npm start)');
    console.log('   • ChromaDB: http://localhost:8001');
    console.log('   • Redis: localhost:6379');
    
    console.log('\n🔧 Management Commands:');
    console.log('   • View logs: cd Docker && docker compose logs chat2sql');
    console.log('   • Restart service: cd Docker && docker compose restart chat2sql');
    console.log('   • Stop services: cd Docker && docker compose down');
    console.log('   • Test integration: node src/scripts/test-chat2sql-docker.js');
    
    console.log('\n🚀 Usage:');
    console.log('   1. Start main app: npm start');
    console.log('   2. Open chat interface');
    console.log('   3. Click the Chat2SQL toggle button');
    console.log('   4. Try queries like:');
    console.log('      - "list all tables"');
    console.log('      - "show me all users"');
    console.log('      - "count rows in sessions table"');
    
    return true;
    
  } catch (error) {
    console.log('\n❌ Chat2SQL setup failed!');
    console.log(`Error: ${error.message}`);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check Docker: docker --version');
    console.log('   2. Check logs: cd Docker && docker compose logs chat2sql');
    console.log('   3. Rebuild: cd Docker && docker compose build --no-cache chat2sql');
    console.log('   4. Manual start: cd Docker && docker compose up chat2sql');
    
    return false;
  }
}

// Helper functions
function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run setup if called directly
if (require.main === module) {
  setupChat2Sql()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Setup script error:', error);
      process.exit(1);
    });
}

module.exports = setupChat2Sql;
