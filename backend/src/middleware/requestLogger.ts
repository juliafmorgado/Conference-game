/**
 * Request logging middleware
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;

    // Override res.send to capture response details
    res.send = function(body: any) {
      const duration = Date.now() - startTime;
      
      // Log request details
      logger.info(`${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        query: req.query,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        contentLength: res.get('Content-Length') || body?.length || 0
      });

      // Call original send method
      return originalSend.call(this, body);
    };

    next();
  };
}