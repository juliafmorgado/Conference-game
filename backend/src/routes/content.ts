/**
 * Content API routes
 */

import { Router, Request, Response } from 'express';
import { SentencesQuerySchema, AcronymsQuerySchema } from '../types/content';
import { asyncHandler, ValidationError } from '../middleware/errorHandler';
import { getContentService } from '../services/contentService';

const router = Router();

// GET /api/sentences - Fetch sentences with optional category filtering
router.get('/sentences', asyncHandler(async (req: Request, res: Response) => {
  // Validate query parameters
  const queryResult = SentencesQuerySchema.safeParse(req.query);
  
  if (!queryResult.success) {
    throw new ValidationError('Invalid query parameters', queryResult.error.issues);
  }

  const { category, limit, offset } = queryResult.data;

  // Get content from service
  const contentService = getContentService();
  const result = await contentService.getSentences(category, limit, offset);

  // Set response headers for pagination
  res.set({
    'X-Total-Count': result.total.toString(),
    'X-Page-Count': Math.ceil(result.total / limit).toString(),
    'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
    'ETag': `"sentences-${category || 'all'}-${Date.now()}"`
  });

  res.json({
    data: result.sentences,
    pagination: {
      total: result.total,
      limit,
      offset,
      hasMore: offset + limit < result.total
    },
    categories: result.categories
  });
}));

// GET /api/acronyms - Fetch all acronyms
router.get('/acronyms', asyncHandler(async (req: Request, res: Response) => {
  // Validate query parameters
  const queryResult = AcronymsQuerySchema.safeParse(req.query);
  
  if (!queryResult.success) {
    throw new ValidationError('Invalid query parameters', queryResult.error.issues);
  }

  const { limit, offset } = queryResult.data;

  // Get content from service
  const contentService = getContentService();
  const result = await contentService.getAcronyms(limit, offset);

  // Set response headers for pagination and caching
  res.set({
    'X-Total-Count': result.total.toString(),
    'X-Page-Count': Math.ceil(result.total / limit).toString(),
    'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
    'ETag': `"acronyms-${Date.now()}"`
  });

  res.json({
    data: result.acronyms,
    pagination: {
      total: result.total,
      limit,
      offset,
      hasMore: offset + limit < result.total
    }
  });
}));

// GET /api/categories - Get available sentence categories
router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const contentService = getContentService();
  const categories = await contentService.getCategories();

  res.set({
    'Cache-Control': 'public, max-age=600', // Cache for 10 minutes
    'ETag': `"categories-${Date.now()}"`
  });

  res.json({
    data: categories,
    total: categories.length
  });
}));

// POST /api/content/reload - Force reload content from ConfigMaps
router.post('/content/reload', asyncHandler(async (req: Request, res: Response) => {
  const contentService = getContentService();
  await contentService.reloadContent();

  // Clear response cache to ensure fresh content is served
  const { clearCache } = await import('../middleware/caching');
  clearCache();

  res.json({
    message: 'Content reloaded successfully',
    timestamp: new Date().toISOString()
  });
}));

export { router as contentRouter };