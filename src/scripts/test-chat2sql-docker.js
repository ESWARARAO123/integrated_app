#!/usr/bin/env node

/**
 * Test script for Chat2SQL Docker integration
 * Tests the dockerized Chat2SQL service connectivity and functionality
 */

const axios = require('axios');
const ConfigValidationService = require('../services/configValidationService');

async function testChat2SqlDocker() {
  console.log('\n🧪 Testing Chat2SQL Docker Integration\n');
  
  try {
    // 1. Validate configuration
    console.log('1. Validating configuration...');
    const configService = new ConfigValidationService();
    const config = await configService.validateConfiguration();
    const chat2sqlConfig = config.chat2sql;
    
    console.log(`   ✓ Chat2SQL enabled: ${chat2sqlConfig.enabled}`);
    console.log(`   ✓ Chat2SQL URL: ${chat2sqlConfig.baseUrl}`);
    console.log(`   ✓ Docker container: ${chat2sqlConfig.dockerContainer}`);
    
    // 2. Test Chat2SQL service health
    console.log('\n2. Testing Chat2SQL service health...');
    try {
      const healthResponse = await axios.get(`${chat2sqlConfig.baseUrl}/`, {
        timeout: chat2sqlConfig.connectionTimeout
      });
      
      console.log(`   ✓ Health check status: ${healthResponse.status}`);
      console.log(`   ✓ Service response:`, healthResponse.data);
    } catch (healthError) {
      console.log(`   ✗ Health check failed: ${healthError.message}`);
      console.log('   💡 Make sure the Chat2SQL Docker container is running');
      return false;
    }
    
    // 3. Test database connectivity through Chat2SQL
    console.log('\n3. Testing database connectivity...');
    try {
      const testQuery = 'list all tables';
      const queryResponse = await axios.post(`${chat2sqlConfig.baseUrl}/chat2sql/execute`, {
        query: testQuery,
        sessionId: 'test-session-' + Date.now()
      }, {
        timeout: chat2sqlConfig.requestTimeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   ✓ Query executed successfully`);
      console.log(`   ✓ Response status: ${queryResponse.status}`);
      console.log(`   ✓ Data received:`, queryResponse.data.data ? 'Yes' : 'No');
      console.log(`   ✓ Columns:`, queryResponse.data.columns || []);
      
      if (queryResponse.data.data) {
        const lines = queryResponse.data.data.split('\n').slice(0, 5); // Show first 5 lines
        console.log('   📊 Sample response:');
        lines.forEach(line => {
          if (line.trim()) {
            console.log(`      ${line}`);
          }
        });
      }
      
    } catch (queryError) {
      console.log(`   ✗ Query test failed: ${queryError.message}`);
      if (queryError.response) {
        console.log(`   📄 Error response:`, queryError.response.data);
      }
      return false;
    }
    
    // 4. Test Ollama connectivity through Chat2SQL
    console.log('\n4. Testing Ollama connectivity...');
    try {
      const ollamaTestQuery = 'show me the structure of the users table';
      const ollamaResponse = await axios.post(`${chat2sqlConfig.baseUrl}/chat2sql/execute`, {
        query: ollamaTestQuery,
        sessionId: 'test-ollama-' + Date.now()
      }, {
        timeout: chat2sqlConfig.requestTimeout * 2, // Longer timeout for AI processing
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   ✓ Ollama integration working`);
      console.log(`   ✓ AI-generated query executed successfully`);
      console.log(`   ✓ Response contains data:`, ollamaResponse.data.data ? 'Yes' : 'No');
      
    } catch (ollamaError) {
      console.log(`   ⚠ Ollama test failed: ${ollamaError.message}`);
      console.log('   💡 This might be expected if Ollama is not running on the host');
      console.log('   💡 Chat2SQL will still work for direct SQL queries');
    }
    
    // 5. Test frontend integration
    console.log('\n5. Testing frontend configuration...');
    try {
      const frontendConfigResponse = await axios.get('http://localhost:5634/api/config/frontend-config');
      const frontendConfig = frontendConfigResponse.data;
      
      console.log(`   ✓ Frontend config loaded`);
      console.log(`   ✓ Chat2SQL URL in config: ${frontendConfig.chat2sqlUrl}`);
      
      if (frontendConfig.chat2sqlUrl === chat2sqlConfig.baseUrl) {
        console.log(`   ✓ Frontend and backend configs match`);
      } else {
        console.log(`   ⚠ Config mismatch - Frontend: ${frontendConfig.chat2sqlUrl}, Backend: ${chat2sqlConfig.baseUrl}`);
      }
      
    } catch (frontendError) {
      console.log(`   ✗ Frontend config test failed: ${frontendError.message}`);
      console.log('   💡 Make sure the main application is running on port 5634');
    }
    
    // 6. Test Docker container status
    console.log('\n6. Testing Docker container status...');
    try {
      const { spawn } = require('child_process');
      
      const dockerPs = spawn('docker', ['ps', '--filter', `name=${chat2sqlConfig.dockerContainer}`, '--format', 'table {{.Names}}\t{{.Status}}\t{{.Ports}}']);
      
      let dockerOutput = '';
      dockerPs.stdout.on('data', (data) => {
        dockerOutput += data.toString();
      });
      
      await new Promise((resolve) => {
        dockerPs.on('close', (code) => {
          if (dockerOutput.includes(chat2sqlConfig.dockerContainer)) {
            console.log(`   ✓ Docker container is running`);
            console.log(`   📋 Container info:`);
            dockerOutput.split('\n').forEach(line => {
              if (line.trim()) {
                console.log(`      ${line}`);
              }
            });
          } else {
            console.log(`   ✗ Docker container not found or not running`);
            console.log('   💡 Run: cd Docker && docker compose up -d chat2sql');
          }
          resolve();
        });
      });
      
    } catch (dockerError) {
      console.log(`   ⚠ Docker status check failed: ${dockerError.message}`);
      console.log('   💡 Docker might not be available or accessible');
    }
    
    console.log('\n✅ Chat2SQL Docker integration test completed!');
    console.log('\n📋 Summary:');
    console.log(`   • Chat2SQL Service: ${chat2sqlConfig.baseUrl}`);
    console.log(`   • Docker Container: ${chat2sqlConfig.dockerContainer}`);
    console.log(`   • Configuration: Valid`);
    console.log(`   • Database: Connected`);
    console.log('\n🚀 Next steps:');
    console.log('   1. Start the main application: npm start');
    console.log('   2. Open the chat interface');
    console.log('   3. Enable Chat2SQL mode');
    console.log('   4. Try queries like "list all tables" or "show me users"');
    
    return true;
    
  } catch (error) {
    console.log('\n❌ Chat2SQL Docker integration test failed!');
    console.log(`Error: ${error.message}`);
    
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   1. Check if Docker is running: docker --version');
    console.log('   2. Build the Chat2SQL image: cd Docker && docker compose build chat2sql');
    console.log('   3. Start the service: docker compose up -d chat2sql');
    console.log('   4. Check logs: docker compose logs chat2sql');
    console.log('   5. Verify configuration: node src/scripts/validate-config.js');
    
    return false;
  }
}

// Run test if called directly
if (require.main === module) {
  testChat2SqlDocker()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test script error:', error);
      process.exit(1);
    });
}

module.exports = testChat2SqlDocker;
