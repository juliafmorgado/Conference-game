/**
 * Response caching middleware for performance optimization
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

interface CacheEntry {
  data: any;
  headers: Record<string, string>;
  timestamp: number;
  etag: string;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  keyGenerator?: (req: Request) => string;
  shouldCache?: (req: Request, res: Response) => boolean;
  varyHeaders?: string[];
}

class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // Update access order for LRU
      this.accessOrder.set(key, ++this.accessCounter);
    }
    return entry;
  }

  set(key: string, entry: CacheEntry): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  delete(key: string): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  size(): number {
    return this.cache.size;
  }

  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Infinity;

    for (const [key, access] of this.accessOrder) {
      if (access < oldestAccess) {
        oldestAccess = access;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  // Get cache statistics
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0 // Would need hit/miss tracking for accurate rate
    };
  }
}

// Global cache instance
const globalCache = new MemoryCache(1000);

/**
 * Generate cache key from request
 */
function defaultKeyGenerator(req: Request): string {
  const url = req.originalUrl || req.url;
  const method = req.method;
  const query = JSON.stringify(req.query);
  
  return createHash('md5')
    .update(`${method}:${url}:${query}`)
    .digest('hex');
}

/**
 * Default cache condition - only cache GET requests with 200 status
 */
function defaultShouldCache(req: Request, res: Response): boolean {
  return req.method === 'GET' && res.statusCode === 200;
}

/**
 * Generate ETag for response data
 */
function generateETag(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('md5').update(content).digest('hex');
}

/**
 * Response caching middleware
 */
export function responseCache(options: CacheOptions = {}): (req: Request, res: Response, next: NextFunction) => void {
  const {
    ttl = 5 * 60 * 1000, // 5 minutes default
    maxSize = 1000,
    keyGenerator = defaultKeyGenerator,
    shouldCache = defaultShouldCache,
    varyHeaders = []
  } = options;

  // Create cache instance for this middleware
  const cache = new MemoryCache(maxSize);

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = keyGenerator(req);
    const now = Date.now();

    // Check if we have a cached response
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && (now - cachedEntry.timestamp) < ttl) {
      // Check ETag for conditional requests
      const clientETag = req.headers['if-none-match'];
      if (clientETag && clientETag === cachedEntry.etag) {
        return res.status(304).end();
      }

      // Set cached headers
      Object.entries(cachedEntry.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // Set ETag and cache headers
      res.setHeader('ETag', cachedEntry.etag);
      res.setHeader('X-Cache', 'HIT');
      
      return res.json(cachedEntry.data);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      // Only cache if conditions are met
      if (shouldCache(req, res)) {
        const etag = generateETag(data);
        const headers: Record<string, string> = {};
        
        // Capture relevant headers
        const headersToCache = ['content-type', 'cache-control', ...varyHeaders];
        headersToCache.forEach(header => {
          const value = res.getHeader(header);
          if (value) {
            headers[header] = String(value);
          }
        });

        // Cache the response
        cache.set(cacheKey, {
          data,
          headers,
          timestamp: now,
          etag
        });

        // Set ETag and cache headers
        res.setHeader('ETag', etag);
        res.setHeader('X-Cache', 'MISS');
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Cache invalidation middleware
 */
export function invalidateCache(pattern?: string | RegExp): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    // Clear cache on write operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (pattern) {
        // Invalidate specific patterns (would need more sophisticated implementation)
        globalCache.clear();
      } else {
        globalCache.clear();
      }
    }
    next();
  };
}

/**
 * Cache statistics endpoint
 */
export function getCacheStats() {
  return globalCache.getStats();
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  globalCache.clear();
}

/**
 * HTTP cache headers middleware
 */
export function httpCacheHeaders(options: {
  maxAge?: number;
  sMaxAge?: number;
  mustRevalidate?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  public?: boolean;
  private?: boolean;
} = {}): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const {
      maxAge = 300, // 5 minutes
      sMaxAge,
      mustRevalidate = false,
      noCache = false,
      noStore = false,
      public: isPublic = true,
      private: isPrivate = false
    } = options;

    if (req.method === 'GET') {
      const cacheDirectives: string[] = [];

      if (noStore) {
        cacheDirectives.push('no-store');
      } else if (noCache) {
        cacheDirectives.push('no-cache');
      } else {
        if (isPublic) cacheDirectives.push('public');
        if (isPrivate) cacheDirectives.push('private');
        if (maxAge !== undefined) cacheDirectives.push(`max-age=${maxAge}`);
        if (sMaxAge !== undefined) cacheDirectives.push(`s-maxage=${sMaxAge}`);
        if (mustRevalidate) cacheDirectives.push('must-revalidate');
      }

      if (cacheDirectives.length > 0) {
        res.setHeader('Cache-Control', cacheDirectives.join(', '));
      }
    }

    next();
  };
}

export default responseCache;