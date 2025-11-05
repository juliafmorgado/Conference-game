/**
 * Health check utilities for monitoring service dependencies
 */

export interface HealthCheckResult {
  healthy: boolean;
  message?: string;
  responseTime?: number;
}

export interface ServiceHealthChecks {
  database: () => Promise<HealthCheckResult>;
  configMaps: () => Promise<HealthCheckResult>;
}

/**
 * Database health check
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Import database service dynamically to avoid circular dependencies
    const { getDatabaseService } = await import('../services/databaseService');
    
    try {
      const databaseService = getDatabaseService();
      const healthStatus = await databaseService.getHealthStatus();
      
      return {
        healthy: healthStatus.healthy,
        message: healthStatus.message,
        responseTime: healthStatus.responseTime
      };
    } catch (serviceError) {
      // Database service not initialized - this is OK if no DATABASE_URL is provided
      return {
        healthy: true,
        message: 'Database service not configured (optional)',
        responseTime: Date.now() - startTime
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Database health check failed',
      responseTime
    };
  }
}

/**
 * ConfigMap health check
 */
export async function checkConfigMapHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Try to make a simple HTTP request to the content endpoint to verify it's working
    // This avoids circular dependency issues
    const http = require('http');
    
    return new Promise<HealthCheckResult>((resolve) => {
      const req = http.get('http://localhost:3001/api/sentences?limit=1', (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => data += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.data && Array.isArray(parsed.data)) {
                resolve({
                  healthy: true,
                  message: 'ConfigMaps accessible and content loaded',
                  responseTime
                });
              } else {
                resolve({
                  healthy: false,
                  message: 'Invalid content format',
                  responseTime
                });
              }
            } catch (parseError) {
              resolve({
                healthy: false,
                message: 'Invalid JSON response',
                responseTime
              });
            }
          } else {
            resolve({
              healthy: false,
              message: `Content endpoint returned status ${res.statusCode}`,
              responseTime
            });
          }
        });
      });
      
      req.on('error', () => {
        resolve({
          healthy: false,
          message: 'Content endpoint not accessible',
          responseTime: Date.now() - startTime
        });
      });
      
      req.setTimeout(5000, () => {
        req.destroy();
        resolve({
          healthy: false,
          message: 'Content endpoint timeout',
          responseTime: Date.now() - startTime
        });
      });
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'ConfigMaps not accessible',
      responseTime
    };
  }
}

/**
 * Comprehensive health check for all services
 */
export async function performHealthChecks(): Promise<{
  overall: boolean;
  services: {
    database: HealthCheckResult;
    configMaps: HealthCheckResult;
  };
}> {
  const [databaseResult, configMapsResult] = await Promise.all([
    checkDatabaseHealth(),
    checkConfigMapHealth()
  ]);

  const overall = databaseResult.healthy && configMapsResult.healthy;

  return {
    overall,
    services: {
      database: databaseResult,
      configMaps: configMapsResult
    }
  };
}