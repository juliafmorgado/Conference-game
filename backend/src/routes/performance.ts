/**
 * Performance monitoring and statistics endpoints
 */

import { Router, Request, Response } from 'express';
import { getCacheStats } from '../middleware/caching';
import { getDatabaseService } from '../services/databaseService';

const router = Router();

/**
 * Get performance statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const cacheStats = getCacheStats();
    
    // Get database pool stats if available
    let dbStats = null;
    try {
      const dbService = getDatabaseService();
      dbStats = dbService.getPoolStats();
    } catch (error) {
      // Database service not available
    }

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    
    // Get CPU usage (basic)
    const cpuUsage = process.cpuUsage();

    // Get uptime
    const uptime = process.uptime();

    // Get compression stats from response object if available
    const compressionStats = (res as any).compressionStats || {
      totalRequests: 0,
      compressedRequests: 0,
      totalBytes: 0,
      compressedBytes: 0,
      compressionRatio: 0
    };

    const stats = {
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: uptime,
        formatted: formatUptime(uptime)
      },
      memory: {
        rss: formatBytes(memoryUsage.rss),
        heapTotal: formatBytes(memoryUsage.heapTotal),
        heapUsed: formatBytes(memoryUsage.heapUsed),
        external: formatBytes(memoryUsage.external),
        arrayBuffers: formatBytes(memoryUsage.arrayBuffers)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      cache: cacheStats,
      database: dbStats,
      compression: compressionStats,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get performance statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get detailed memory statistics
 */
router.get('/memory', (req: Request, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    
    // Force garbage collection if available (only in development)
    if (global.gc && process.env.NODE_ENV === 'development') {
      global.gc();
      const afterGC = process.memoryUsage();
      
      res.json({
        beforeGC: {
          rss: formatBytes(memoryUsage.rss),
          heapTotal: formatBytes(memoryUsage.heapTotal),
          heapUsed: formatBytes(memoryUsage.heapUsed),
          external: formatBytes(memoryUsage.external)
        },
        afterGC: {
          rss: formatBytes(afterGC.rss),
          heapTotal: formatBytes(afterGC.heapTotal),
          heapUsed: formatBytes(afterGC.heapUsed),
          external: formatBytes(afterGC.external)
        },
        freed: {
          heap: formatBytes(memoryUsage.heapUsed - afterGC.heapUsed),
          rss: formatBytes(memoryUsage.rss - afterGC.rss)
        }
      });
    } else {
      res.json({
        current: {
          rss: formatBytes(memoryUsage.rss),
          heapTotal: formatBytes(memoryUsage.heapTotal),
          heapUsed: formatBytes(memoryUsage.heapUsed),
          external: formatBytes(memoryUsage.external),
          arrayBuffers: formatBytes(memoryUsage.arrayBuffers)
        },
        note: 'Garbage collection not available or not in development mode'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get memory statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get database performance statistics
 */
router.get('/database', async (req: Request, res: Response) => {
  try {
    const dbService = getDatabaseService();
    const poolStats = dbService.getPoolStats();
    const healthStatus = await dbService.getHealthStatus();

    res.json({
      pool: poolStats,
      health: healthStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database service not available',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Clear application caches
 */
router.post('/cache/clear', (req: Request, res: Response) => {
  try {
    // Clear response cache
    const { clearCache } = require('../middleware/caching');
    clearCache();

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Trigger garbage collection (development only)
 */
router.post('/gc', (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      error: 'Garbage collection endpoint only available in development mode'
    });
  }

  try {
    if (global.gc) {
      const beforeGC = process.memoryUsage();
      global.gc();
      const afterGC = process.memoryUsage();

      return res.json({
        success: true,
        beforeGC: {
          heapUsed: formatBytes(beforeGC.heapUsed),
          rss: formatBytes(beforeGC.rss)
        },
        afterGC: {
          heapUsed: formatBytes(afterGC.heapUsed),
          rss: formatBytes(afterGC.rss)
        },
        freed: {
          heap: formatBytes(beforeGC.heapUsed - afterGC.heapUsed),
          rss: formatBytes(beforeGC.rss - afterGC.rss)
        }
      });
    } else {
      return res.status(400).json({
        error: 'Garbage collection not available. Start Node.js with --expose-gc flag.'
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to trigger garbage collection',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(2);
  
  return `${size} ${sizes[i]}`;
}

/**
 * Format uptime to human readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}

export { router as performanceRouter };