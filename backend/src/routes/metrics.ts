/**
 * Metrics routes for Prometheus monitoring
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Simple metrics collection
interface AppMetrics {
  requests_total: number;
  requests_duration_seconds: number[];
  active_connections: number;
  memory_usage_bytes: number;
  uptime_seconds: number;
}

// In-memory metrics store (in production, use proper metrics library like prom-client)
const metrics: AppMetrics = {
  requests_total: 0,
  requests_duration_seconds: [],
  active_connections: 0,
  memory_usage_bytes: 0,
  uptime_seconds: 0
};

const startTime = Date.now();

// Update metrics helper
function updateMetrics() {
  const memUsage = process.memoryUsage();
  metrics.memory_usage_bytes = memUsage.heapUsed;
  metrics.uptime_seconds = Math.floor((Date.now() - startTime) / 1000);
}

// GET /metrics - Prometheus-compatible metrics endpoint
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  updateMetrics();

  // Calculate average request duration
  const avgDuration = metrics.requests_duration_seconds.length > 0
    ? metrics.requests_duration_seconds.reduce((a, b) => a + b, 0) / metrics.requests_duration_seconds.length
    : 0;

  // Format metrics in Prometheus format
  const prometheusMetrics = `
# HELP conference_games_requests_total Total number of HTTP requests
# TYPE conference_games_requests_total counter
conference_games_requests_total ${metrics.requests_total}

# HELP conference_games_request_duration_seconds Average request duration in seconds
# TYPE conference_games_request_duration_seconds gauge
conference_games_request_duration_seconds ${avgDuration.toFixed(6)}

# HELP conference_games_memory_usage_bytes Current memory usage in bytes
# TYPE conference_games_memory_usage_bytes gauge
conference_games_memory_usage_bytes ${metrics.memory_usage_bytes}

# HELP conference_games_memory_heap_total_bytes Total heap memory in bytes
# TYPE conference_games_memory_heap_total_bytes gauge
conference_games_memory_heap_total_bytes ${process.memoryUsage().heapTotal}

# HELP conference_games_memory_rss_bytes Resident set size in bytes
# TYPE conference_games_memory_rss_bytes gauge
conference_games_memory_rss_bytes ${process.memoryUsage().rss}

# HELP conference_games_uptime_seconds Application uptime in seconds
# TYPE conference_games_uptime_seconds gauge
conference_games_uptime_seconds ${metrics.uptime_seconds}

# HELP conference_games_active_connections Current number of active connections
# TYPE conference_games_active_connections gauge
conference_games_active_connections ${metrics.active_connections}

# HELP nodejs_version_info Node.js version information
# TYPE nodejs_version_info gauge
nodejs_version_info{version="${process.version}"} 1

# HELP nodejs_heap_size_used_bytes Process heap space size used
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes ${process.memoryUsage().heapUsed}

# HELP nodejs_heap_size_total_bytes Process heap space size total
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes ${process.memoryUsage().heapTotal}

# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds
# TYPE process_cpu_user_seconds_total counter
process_cpu_user_seconds_total ${(process.cpuUsage().user / 1000000).toFixed(6)}

# HELP process_cpu_system_seconds_total Total system CPU time spent in seconds
# TYPE process_cpu_system_seconds_total counter
process_cpu_system_seconds_total ${(process.cpuUsage().system / 1000000).toFixed(6)}
`.trim();

  res.set({
    'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });

  res.send(prometheusMetrics);
}));

// GET /metrics/health - JSON format metrics for debugging
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  updateMetrics();

  const healthMetrics = {
    timestamp: new Date().toISOString(),
    uptime: metrics.uptime_seconds,
    memory: {
      used: metrics.memory_usage_bytes,
      total: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
      rss: process.memoryUsage().rss
    },
    cpu: process.cpuUsage(),
    requests: {
      total: metrics.requests_total,
      active: metrics.active_connections
    },
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };

  res.json(healthMetrics);
}));

// Middleware to increment request counter
export function metricsMiddleware() {
  return (req: Request, res: Response, next: Function) => {
    metrics.requests_total++;
    metrics.active_connections++;

    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      metrics.requests_duration_seconds.push(duration / 1000);
      metrics.active_connections--;

      // Keep only last 1000 request durations
      if (metrics.requests_duration_seconds.length > 1000) {
        metrics.requests_duration_seconds = metrics.requests_duration_seconds.slice(-1000);
      }
    });

    next();
  };
}

export { router as metricsRouter };