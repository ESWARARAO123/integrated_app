const axios = require('axios');

/**
 * Python Service Diagnostic Utility
 * Provides health checks and diagnostic information for the Python prediction service
 */

const PYTHON_SERVICE_URL = process.env.PREDICTION_SERVICE_URL || 'http://127.0.0.1:8088';

class PythonServiceDiagnostic {
  constructor() {
    this.serviceUrl = PYTHON_SERVICE_URL;
  }

  /**
   * Generate comprehensive diagnostic report
   * @returns {Promise<Object>} Diagnostic report object
   */
  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      serviceUrl: this.serviceUrl,
      status: 'unknown',
      healthChecks: {},
      endpoints: {},
      errors: []
    };

    try {
      // Basic connectivity test
      const connectivityResult = await this.testConnectivity();
      report.healthChecks.connectivity = connectivityResult;
      
      if (connectivityResult.success) {
        report.status = 'online';
        
        // Test specific endpoints
        const endpointsToTest = [
          { path: '/health', method: 'GET' },
          { path: '/slack-prediction/predict', method: 'POST' },
          { path: '/training-status', method: 'GET' }
        ];

        for (const endpoint of endpointsToTest) {
          const endpointResult = await this.testEndpoint(endpoint);
          report.endpoints[endpoint.path] = endpointResult;
        }
      } else {
        report.status = 'offline';
        report.errors.push('Python service is not reachable');
      }

      // System information
      report.system = await this.getSystemInfo();

    } catch (error) {
      report.status = 'error';
      report.errors.push(`Failed to generate diagnostic report: ${error.message}`);
    }

    return report;
  }

  /**
   * Test basic connectivity to the Python service
   * @returns {Promise<Object>} Connectivity test result
   */
  async testConnectivity() {
    try {
      const response = await axios.get(`${this.serviceUrl}/health`, {
        timeout: 5000,
        validateStatus: () => true // Accept any status code
      });
      
      return {
        success: true,
        statusCode: response.status,
        message: 'Service is reachable',
        responseTime: response.headers['x-response-time'] || 'unknown'
      };
    } catch (error) {
      return {
        success: false,
        error: error.code || error.message,
        message: 'Service is not reachable'
      };
    }
  }

  /**
   * Test specific endpoint
   * @param {Object} endpoint - Endpoint configuration
   * @returns {Promise<Object>} Endpoint test result
   */
  async testEndpoint(endpoint) {
    try {
      const config = {
        method: endpoint.method,
        url: `${this.serviceUrl}${endpoint.path}`,
        timeout: 10000,
        validateStatus: () => true
      };

      // Add test data for POST requests
      if (endpoint.method === 'POST' && endpoint.path.includes('predict')) {
        config.data = {
          place_table: 'test_table',
          cts_table: 'test_table'
        };
        config.headers = {
          'Content-Type': 'application/json',
          'x-username': 'diagnostic'
        };
      }

      const response = await axios(config);
      
      return {
        success: response.status < 500,
        statusCode: response.status,
        message: response.status < 500 ? 'Endpoint is functional' : 'Endpoint returned server error',
        responseSize: JSON.stringify(response.data).length
      };
    } catch (error) {
      return {
        success: false,
        error: error.code || error.message,
        message: `Endpoint test failed: ${error.message}`
      };
    }
  }

  /**
   * Get system information
   * @returns {Promise<Object>} System information
   */
  async getSystemInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        dockerContainer: process.env.DOCKER_CONTAINER || 'false',
        predictionServiceUrl: this.serviceUrl
      }
    };
  }

  /**
   * Quick health check
   * @returns {Promise<boolean>} True if service is healthy
   */
  async isHealthy() {
    try {
      const response = await axios.get(`${this.serviceUrl}/health`, {
        timeout: 3000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
const pythonServiceDiagnostic = new PythonServiceDiagnostic();

module.exports = pythonServiceDiagnostic; 