import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { AppEnvironmentConfigSchema } from './types/config';
import { createLogger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { enhancedCompression, compressionStats } from './middleware/compression';
import { responseCache, httpCacheHeaders, getCacheStats } from './middleware/caching';
import { healthRouter } from './routes/health';
import { contentRouter } from './routes/content';
import { sessionsRouter } from './routes/sessions';
import { configRouter } from './routes/config';
import { metricsRouter, metricsMiddleware } from './routes/metrics';
import { performanceRouter } from './routes/performance';
import { createContentService } from './services/contentService';
import { defaultFallbackContent } from './services/configMapLoader';
import { createDefaultDatabaseService } from './services/databaseService';
import { createConfigurationService } from './services/configurationService';

// Load environment variables
dotenv.config();

// Validate and parse environment configuration
const envConfig = AppEnvironmentConfigSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  TIMER_DEFAULT_SECONDS: process.env.TIMER_DEFAULT_SECONDS,
  HISTORY_SIZE: process.env.HISTORY_SIZE,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  LOG_LEVEL: process.env.LOG_LEVEL,
  CONFIGMAP_PATH: process.env.CONFIGMAP_PATH,
  CONTENT_CACHE_TIMEOUT: process.env.CONTENT_CACHE_TIMEOUT
});

// Initialize logger
const logger = createLogger(envConfig.LOG_LEVEL);

// Initialize services
const configurationService = createConfigurationService(envConfig);
const contentService = createContentService({
  configMapPath: envConfig.CONFIGMAP_PATH,
  watchForChanges: process.env.WATCH_CONFIG_CHANGES === 'true' || envConfig.NODE_ENV !== 'production',
  cacheTimeout: envConfig.CONTENT_CACHE_TIMEOUT,
  fallbackContent: defaultFallbackContent
});
const databaseService = createDefaultDatabaseService(envConfig);

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: envConfig.CORS_ORIGIN === '*' ? true : envConfig.CORS_ORIGIN.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

app.use(cors(corsOptions));

// Enhanced compression middleware with Brotli support
app.use(compressionStats());
app.use(enhancedCompression({
  level: 6,
  threshold: 1024,
  enableBrotli: true,
  mimeTypes: [
    'text/*',
    'application/json',
    'application/javascript',
    'application/xml',
    'application/rss+xml',
    'application/atom+xml',
    'image/svg+xml'
  ]
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(requestLogger(logger));

// Metrics collection middleware
app.use(metricsMiddleware());

// Response caching middleware for API endpoints (disabled in development)
if (envConfig.NODE_ENV === 'production') {
  app.use('/api', responseCache({
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 500,
    shouldCache: (req, res) => {
      // Only cache GET requests with 200 status
      return req.method === 'GET' && res.statusCode === 200;
    }
  }));
}

// HTTP cache headers for static content
app.use('/api/sentences', httpCacheHeaders({ maxAge: 300, public: true }));
app.use('/api/acronyms', httpCacheHeaders({ maxAge: 300, public: true }));

// API routes
app.use('/health', healthRouter);
app.use('/api', contentRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/config', configRouter);
app.use('/metrics', metricsRouter);
app.use('/performance', performanceRouter);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Conference Games API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler(logger));

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await contentService.cleanup();
  if (databaseService) {
    await databaseService.cleanup();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await contentService.cleanup();
  if (databaseService) {
    await databaseService.cleanup();
  }
  process.exit(0);
});

// Start server
const server = app.listen(envConfig.PORT, async () => {
  logger.info(`Server running on port ${envConfig.PORT} in ${envConfig.NODE_ENV} mode`);
  
  // Initialize services after server starts
  try {
    await configurationService.initialize();
    logger.info('Configuration service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize configuration service:', error);
    // Continue with defaults
  }

  try {
    await contentService.initialize();
    logger.info('Content service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize content service:', error);
    // Don't exit - fallback content should be available
  }

  // Initialize database service if configured
  if (databaseService) {
    try {
      await databaseService.initialize();
      logger.info('Database service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database service:', error);
      // Don't exit - database is optional for basic functionality
    }
  }
});

// Handle server errors
server.on('error', (error: Error) => {
  logger.error('Server error:', error);
  process.exit(1);
});

export default app;
export { envConfig, logger };