/**
 * Game session tracking routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, ValidationError } from '../middleware/errorHandler';
import { getDatabaseService } from '../services/databaseService';

const router = Router();

// Validation schemas
const CreateSessionSchema = z.object({
  gameType: z.enum(['finish-sentence', 'guess-acronym']),
  category: z.string().optional()
});

const UpdateSessionSchema = z.object({
  itemsShown: z.number().min(0).optional(),
  endSession: z.boolean().optional()
});

const SessionsQuerySchema = z.object({
  gameType: z.enum(['finish-sentence', 'guess-acronym']).optional(),
  category: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
});

// POST /api/sessions - Create a new game session
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const databaseService = getDatabaseService();
    
    const validationResult = CreateSessionSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid request body', validationResult.error.issues);
    }

    const { gameType, category } = validationResult.data;
    const sessionId = await databaseService.createGameSession(gameType, category);

    res.status(201).json({
      sessionId,
      gameType,
      category,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not created')) {
      // Database service not available
      res.status(503).json({
        error: 'Session tracking not available',
        message: 'Database service not configured'
      });
      return;
    }
    throw error;
  }
}));

// PUT /api/sessions/:sessionId - Update a game session
router.put('/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const databaseService = getDatabaseService();
    const sessionId = req.params.sessionId;
    
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const validationResult = UpdateSessionSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid request body', validationResult.error.issues);
    }

    const { itemsShown, endSession } = validationResult.data;

    const updates: any = {};
    if (itemsShown !== undefined) {
      updates.itemsShown = itemsShown;
    }
    if (endSession) {
      updates.endedAt = new Date();
    }

    await databaseService.updateGameSession(sessionId, updates);

    res.json({
      sessionId,
      updated: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not created')) {
      res.status(503).json({
        error: 'Session tracking not available',
        message: 'Database service not configured'
      });
      return;
    }
    throw error;
  }
}));

// GET /api/sessions/:sessionId - Get a specific game session
router.get('/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const databaseService = getDatabaseService();
    const sessionId = req.params.sessionId;
    
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const session = await databaseService.getGameSession(sessionId);

    if (!session) {
      res.status(404).json({
        error: 'Session not found',
        sessionId
      });
      return;
    }

    res.json({
      session: {
        id: session.id,
        gameType: session.gameType,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString(),
        itemsShown: session.itemsShown,
        category: session.category
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not created')) {
      res.status(503).json({
        error: 'Session tracking not available',
        message: 'Database service not configured'
      });
      return;
    }
    throw error;
  }
}));

// GET /api/sessions - Get game sessions with filtering
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const databaseService = getDatabaseService();

    const validationResult = SessionsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      throw new ValidationError('Invalid query parameters', validationResult.error.issues);
    }

    const { gameType, category, startDate, endDate, limit, offset } = validationResult.data;

    const options: any = { limit, offset };
    if (gameType) options.gameType = gameType;
    if (category) options.category = category;
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);

    const result = await databaseService.getGameSessions(options);

    const sessions = result.sessions.map(session => ({
      id: session.id,
      gameType: session.gameType,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString(),
      itemsShown: session.itemsShown,
      category: session.category
    }));

    res.set({
      'X-Total-Count': result.total.toString(),
      'X-Page-Count': Math.ceil(result.total / limit).toString()
    });

    res.json({
      data: sessions,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not created')) {
      res.status(503).json({
        error: 'Session tracking not available',
        message: 'Database service not configured'
      });
      return;
    }
    throw error;
  }
}));

export { router as sessionsRouter };