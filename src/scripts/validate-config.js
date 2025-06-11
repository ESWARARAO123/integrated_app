#!/usr/bin/env node

/**
 * Configuration Validation Script
 * Validates configuration and displays port mappings
 * Can be run standalone or as part of startup process
 */

const ConfigValidationService = require('../services/configValidationService');

async function validateAndDisplayConfig() {
  console.log('\n🔧 Configuration Validation\n');
  
  try {
    const configService = new ConfigValidationService();
    const validatedConfig = await configService.validateConfiguration();
    
    console.log('✅ Configuration validation passed!\n');
    
    // Display port mappings
    console.log('📊 Service Port Mappings:\n');
    const portMappings = configService.getPortMappings();
    
    Object.entries(portMappings).forEach(([service, config]) => {
      console.log(`${service}:`);
      console.log(`  Port: ${config.port}`);
      console.log(`  URL:  ${config.url}`);
      console.log(`  Info: ${config.description}\n`);
    });
    
    // Display configuration sources
    console.log('📁 Configuration Sources:\n');
    console.log('  Primary: conf/config.ini');
    console.log('  Docker:  Docker/env.docker');
    console.log('  API:     /api/config/ports\n');
    
    // Display quick access URLs
    console.log('🚀 Quick Access URLs:\n');
    console.log(`  Application:  ${validatedConfig.server.baseUrl}`);
    console.log(`  Health Check: ${validatedConfig.server.baseUrl}/api/config/health`);
    console.log(`  Port Info:    ${validatedConfig.server.baseUrl}/api/config/ports`);
    console.log(`  ChromaDB:     ${validatedConfig.docker.chromadb.url}`);
    console.log(`  Ollama:       ${validatedConfig.ollama.baseUrl}\n`);
    
    return true;
    
  } catch (error) {
    console.log('❌ Configuration validation failed!\n');
    console.log('Error: ' + error.message);
    
    if (error.message.includes('Configuration validation failed:')) {
      console.log('\n💡 Common fixes:');
      console.log('  1. Check conf/config.ini exists and is readable');
      console.log('  2. Verify all required sections are present');
      console.log('  3. Ensure port numbers are valid (1-65535)');
      console.log('  4. Check for typos in configuration keys\n');
    }
    
    return false;
  }
}

// Run validation if called directly
if (require.main === module) {
  validateAndDisplayConfig()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation script error:', error);
      process.exit(1);
    });
}

module.exports = validateAndDisplayConfig;
