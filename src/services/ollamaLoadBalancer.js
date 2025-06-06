/**
 * Ollama Load Balancer Service
 * Distributes requests across multiple Ollama instances for better performance
 */

const { logger } = require('../utils/logger');

class OllamaLoadBalancer {
  constructor(instances = null) {
    // Default to single instance, but can be configured for multiple
    this.instances = instances || [
      'http://localhost:11434'  // Default single instance
    ];
    
    // You can enable multiple instances by setting:
    // this.instances = [
    //   'http://localhost:11434',
    //   'http://localhost:11435', 
    //   'http://localhost:11436'
    // ];
    
    this.currentIndex = 0;
    this.healthStatus = new Map();
    
    // Initialize health status
    this.instances.forEach(instance => {
      this.healthStatus.set(instance, true);
    });
    
    logger.info(`OllamaLoadBalancer initialized with ${this.instances.length} instance(s)`);
  }

  /**
   * Get the next available Ollama instance using round-robin
   * @returns {string} Ollama instance URL
   */
  getNextInstance() {
    // Filter healthy instances
    const healthyInstances = this.instances.filter(instance => 
      this.healthStatus.get(instance)
    );
    
    if (healthyInstances.length === 0) {
      logger.warn('No healthy Ollama instances available, using primary');
      return this.instances[0]; // Fallback to primary
    }
    
    // Round-robin through healthy instances
    const instance = healthyInstances[this.currentIndex % healthyInstances.length];
    this.currentIndex = (this.currentIndex + 1) % healthyInstances.length;
    
    return instance;
  }

  /**
   * Mark an instance as unhealthy
   * @param {string} instance - Instance URL
   */
  markUnhealthy(instance) {
    this.healthStatus.set(instance, false);
    logger.warn(`Marked Ollama instance as unhealthy: ${instance}`);
    
    // Schedule health check in 30 seconds
    setTimeout(() => this.checkHealth(instance), 30000);
  }

  /**
   * Check health of a specific instance
   * @param {string} instance - Instance URL
   */
  async checkHealth(instance) {
    try {
      const axios = require('axios');
      const response = await axios.get(`${instance}/api/version`, { 
        timeout: 5000 
      });
      
      if (response.status === 200) {
        this.healthStatus.set(instance, true);
        logger.info(`Ollama instance healthy again: ${instance}`);
      }
    } catch (error) {
      logger.warn(`Ollama instance still unhealthy: ${instance}`);
      // Schedule another check in 30 seconds
      setTimeout(() => this.checkHealth(instance), 30000);
    }
  }

  /**
   * Get load balancer status
   * @returns {Object} Status information
   */
  getStatus() {
    const healthyCount = Array.from(this.healthStatus.values())
      .filter(healthy => healthy).length;
    
    return {
      totalInstances: this.instances.length,
      healthyInstances: healthyCount,
      instances: this.instances.map(instance => ({
        url: instance,
        healthy: this.healthStatus.get(instance)
      }))
    };
  }

  /**
   * Enable multiple Ollama instances
   * Call this method to enable load balancing across multiple instances
   * @param {Array<string>} instances - Array of Ollama instance URLs
   */
  enableMultiInstance(instances) {
    this.instances = instances;
    this.currentIndex = 0;
    
    // Reset health status
    this.healthStatus.clear();
    this.instances.forEach(instance => {
      this.healthStatus.set(instance, true);
    });
    
    logger.info(`Enabled multi-instance mode with ${instances.length} instances`);
    return this.getStatus();
  }
}

module.exports = new OllamaLoadBalancer(); 