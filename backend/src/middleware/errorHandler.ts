/**
 * Error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export function errorHandler(logger: Logger) {
  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    // Log the error
    logger.error(`Error in ${req.method} ${req.path}:`, {
      error: error.message,
      stack: error.stack,
      body: req.body,
      query: req.query,
      params: req.params
    });

    // Handle different error types
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      });
      return;
    }

    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message,
        details: error.details
      });
      return;
    }

    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
      return;
    }

    if (error instanceof DatabaseError) {
      res.status(500).json({
        error: 'Database Error',
        message: 'An error occurred while accessing the database'
      });
      return;
    }

    // Handle API errors with status codes
    const apiError = error as ApiError;
    if (apiError.statusCode) {
      res.status(apiError.statusCode).json({
        error: error.name || 'API Error',
        message: error.message,
        code: apiError.code
      });
      return;
    }

    // Default server error
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}