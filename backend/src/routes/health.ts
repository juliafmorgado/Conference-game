/**
 * Health check routes
 */

import { Router, Request, Response } from 'express';
import { HealthStatus } from '../types/content';
import { asyncHandler } from '../middleware/errorHandler';
import { performHealthChecks } from '../utils/healthChecks';

const router = Router();

// Simple health check
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const healthResults = await performHealthChecks();

  const healthStatus: HealthStatus = {
    status: healthResults.overall ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: healthResults.services.database.healthy,
      configMaps: healthResults.services.configMaps.healthy
    }
  };

  const statusCode = healthResults.overall ? 200 : 503;
  res.status(statusCode).json(healthStatus);
}));

// Detailed health check for Kubernetes probes
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  const healthResults = await performHealthChecks();

  const readinessStatus = {
    status: healthResults.overall ? 'ready' : 'not ready',
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: healthResults.services.database.healthy ? 'ready' : 'not ready',
        message: healthResults.services.database.message,
        responseTime: healthResults.services.database.responseTime
      },
      configMaps: {
        status: healthResults.services.configMaps.healthy ? 'ready' : 'not ready',
        message: healthResults.services.configMaps.message,
        responseTime: healthResults.services.configMaps.responseTime
      }
    }
  };

  const statusCode = healthResults.overall ? 200 : 503;
  res.status(statusCode).json(readinessStatus);
}));

// Liveness probe for Kubernetes
router.get('/live', asyncHandler(async (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
}));

export { router as healthRouter };