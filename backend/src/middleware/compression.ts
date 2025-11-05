/**
 * Enhanced compression middleware with performance optimizations
 */

import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import { createGzip, createDeflate, createBrotliCompress } from 'zlib';
import { pipeline } from 'stream';

interface CompressionOptions {
  threshold?: number;
  level?: number;
  chunkSize?: number;
  windowBits?: number;
  memLevel?: number;
  strategy?: number;
  enableBrotli?: boolean;
  mimeTypes?: string[];
}

/**
 * Check if the request accepts a specific encoding
 */
function acceptsEncoding(req: Request, encoding: string): boolean {
  const acceptEncoding = req.headers['accept-encoding'];
  if (!acceptEncoding) return false;
  
  return acceptEncoding.toLowerCase().includes(encoding.toLowerCase());
}

/**
 * Determine the best compression method based on client support
 */
function getBestCompression(req: Request, enableBrotli: boolean = true): string | null {
  if (enableBrotli && acceptsEncoding(req, 'br')) {
    return 'br';
  }
  if (acceptsEncoding(req, 'gzip')) {
    return 'gzip';
  }
  if (acceptsEncoding(req, 'deflate')) {
    return 'deflate';
  }
  return null;
}

/**
 * Check if content type should be compressed
 */
function shouldCompress(contentType: string, mimeTypes: string[]): boolean {
  if (!contentType) return false;
  
  const type = contentType.toLowerCase().split(';')[0];
  if (!type) return false;
  
  return mimeTypes.some(mimeType => {
    if (mimeType.endsWith('*')) {
      return type.startsWith(mimeType.slice(0, -1));
    }
    return type === mimeType;
  });
}

/**
 * Enhanced compression middleware
 */
export function enhancedCompression(options: CompressionOptions = {}): (req: Request, res: Response, next: NextFunction) => void {
  const {
    threshold = 1024, // Only compress responses larger than 1KB
    level = 6, // Compression level (1-9, 6 is good balance)
    chunkSize = 16 * 1024, // 16KB chunks
    windowBits = 15,
    memLevel = 8,
    strategy = 0, // Default strategy
    enableBrotli = true,
    mimeTypes = [
      'text/*',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/rss+xml',
      'application/atom+xml',
      'image/svg+xml'
    ]
  } = options;

  // Use the standard compression middleware as fallback
  const standardCompression = compression({
    level,
    threshold,
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (!req.headers['accept-encoding']) {
        return false;
      }

      // Don't compress if already compressed
      if (res.getHeader('content-encoding')) {
        return false;
      }

      // Don't compress if explicitly disabled
      if (req.headers['x-no-compression']) {
        return false;
      }

      // Check content type
      const contentType = res.getHeader('content-type') as string;
      return shouldCompress(contentType, mimeTypes);
    }
  });

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if no compression support
    const compressionMethod = getBestCompression(req, enableBrotli);
    if (!compressionMethod) {
      return next();
    }

    // Add compression method to response headers for debugging
    res.setHeader('X-Compression-Method', compressionMethod);

    // Use standard compression middleware
    standardCompression(req, res, next);
  };
}

/**
 * Brotli compression middleware (for modern browsers)
 */
export function brotliCompression(options: { quality?: number; threshold?: number } = {}): (req: Request, res: Response, next: NextFunction) => void {
  const { quality = 4, threshold = 1024 } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Check if client supports Brotli
    if (!acceptsEncoding(req, 'br')) {
      return next();
    }

    // Don't compress if already compressed
    if (res.getHeader('content-encoding')) {
      return next();
    }

    // Override res.end to compress the response
    const originalEnd = res.end.bind(res);
    const originalWrite = res.write.bind(res);
    
    let chunks: Buffer[] = [];
    let totalLength = 0;

    res.write = function(chunk: any, encoding?: any) {
      if (chunk) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
        chunks.push(buffer);
        totalLength += buffer.length;
      }
      return true;
    };

    res.end = function(chunk?: any, encoding?: any): any {
      if (chunk) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
        chunks.push(buffer);
        totalLength += buffer.length;
      }

      // Only compress if above threshold
      if (totalLength < threshold) {
        // Restore original methods and send uncompressed
        res.write = originalWrite;
        res.end = originalEnd;
        
        for (const chunk of chunks) {
          originalWrite(chunk);
        }
        return originalEnd();
      }

      // Compress with Brotli
      const data = Buffer.concat(chunks);
      const brotli = createBrotliCompress({
        params: {
          [require('zlib').constants.BROTLI_PARAM_QUALITY]: quality,
          [require('zlib').constants.BROTLI_PARAM_SIZE_HINT]: totalLength
        }
      });

      res.setHeader('Content-Encoding', 'br');
      res.removeHeader('Content-Length');

      // Restore original methods
      res.write = originalWrite;
      res.end = originalEnd;

      // Pipe compressed data
      pipeline(
        require('stream').Readable.from([data]),
        brotli,
        res,
        (err) => {
          if (err) {
            console.error('Brotli compression error:', err);
          }
        }
      );
      
      return res;
    };

    next();
  };
}

/**
 * Compression statistics middleware
 */
export function compressionStats(): (req: Request, res: Response, next: NextFunction) => void {
  const stats = {
    totalRequests: 0,
    compressedRequests: 0,
    totalBytes: 0,
    compressedBytes: 0,
    compressionRatio: 0
  };

  return (req: Request, res: Response, next: NextFunction) => {
    stats.totalRequests++;

    const originalEnd = res.end.bind(res);
    let responseSize = 0;

    // Track response size
    const originalWrite = res.write.bind(res);
    res.write = function(chunk: any, encoding?: any) {
      if (chunk) {
        responseSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
      }
      return originalWrite(chunk, encoding);
    };

    res.end = function(chunk?: any, encoding?: any) {
      if (chunk) {
        responseSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
      }

      stats.totalBytes += responseSize;

      // Check if response was compressed
      const contentEncoding = res.getHeader('content-encoding');
      if (contentEncoding) {
        stats.compressedRequests++;
        stats.compressedBytes += responseSize;
      }

      // Calculate compression ratio
      if (stats.totalBytes > 0) {
        stats.compressionRatio = (stats.totalBytes - stats.compressedBytes) / stats.totalBytes;
      }

      return originalEnd(chunk, encoding);
    };

    // Expose stats on response object
    (res as any).compressionStats = stats;

    next();
  };
}

export default enhancedCompression;