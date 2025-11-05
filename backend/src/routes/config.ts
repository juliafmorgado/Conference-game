/**
 * Configuration management routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, ValidationError } from '../middleware/errorHandler';
import { getConfigurationService, TimerConfiguration } from '../services/configurationService';

const router = Router();

// Validation schemas
const TimerConfigSchema = z.object({
  finishSentence: z.object({
    defaultSeconds: z.number().min(5).max(300).optional(),
    availableOptions: z.array(z.number().min(5).max(300)).optional()
  }).optional(),
  guessAcronym: z.object({
    defaultSeconds: z.number().min(5).max(300).optional(),
    availableOptions: z.array(z.number().min(5).max(300)).optional()
  }).optional()
});

const HistoryConfigSchema = z.object({
  maxSize: z.number().min(1).max(1000)
});

const ContentConfigSchema = z.object({
  cacheTimeout: z.number().min(1000).optional(),
  configMapPath: z.string().min(1).optional()
});

// GET /api/config - Get all configuration
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const configService = getConfigurationService();
  const config = configService.getAllConfiguration();

  res.json({
    config,
    timestamp: new Date().toISOString()
  });
}));

// GET /api/config/timer - Get timer configuration
router.get('/timer', asyncHandler(async (req: Request, res: Response) => {
  const configService = getConfigurationService();
  const timerConfig = configService.getTimerConfiguration();

  res.json({
    timer: timerConfig,
    timestamp: new Date().toISOString()
  });
}));

// PUT /api/config/timer - Update timer configuration
router.put('/timer', asyncHandler(async (req: Request, res: Response) => {
  const configService = getConfigurationService();

  const validationResult = TimerConfigSchema.safeParse(req.body);
  if (!validationResult.success) {
    throw new ValidationError('Invalid timer configuration', validationResult.error.issues);
  }

  const timerConfig = validationResult.data;
  const cleanConfig: any = {};
  
  if (timerConfig.finishSentence) {
    cleanConfig.finishSentence = {};
    if (timerConfig.finishSentence.defaultSeconds !== undefined) {
      cleanConfig.finishSentence.defaultSeconds = timerConfig.finishSentence.defaultSeconds;
    }
    if (timerConfig.finishSentence.availableOptions !== undefined) {
      cleanConfig.finishSentence.availableOptions = timerConfig.finishSentence.availableOptions;
    }
  }
  
  if (timerConfig.guessAcronym) {
    cleanConfig.guessAcronym = {};
    if (timerConfig.guessAcronym.defaultSeconds !== undefined) {
      cleanConfig.guessAcronym.defaultSeconds = timerConfig.guessAcronym.defaultSeconds;
    }
    if (timerConfig.guessAcronym.availableOptions !== undefined) {
      cleanConfig.guessAcronym.availableOptions = timerConfig.guessAcronym.availableOptions;
    }
  }
  
  await configService.setTimerConfiguration(cleanConfig);
  const updatedConfig = configService.getTimerConfiguration();

  res.json({
    timer: updatedConfig,
    message: 'Timer configuration updated successfully',
    timestamp: new Date().toISOString()
  });
}));

// GET /api/config/game - Get game configuration
router.get('/game', asyncHandler(async (req: Request, res: Response) => {
  const configService = getConfigurationService();
  const gameConfig = configService.getGameConfiguration();

  res.json({
    game: gameConfig,
    timestamp: new Date().toISOString()
  });
}));

// PUT /api/config/history - Update history configuration
router.put('/history', asyncHandler(async (req: Request, res: Response) => {
  const configService = getConfigurationService();

  const validationResult = HistoryConfigSchema.safeParse(req.body);
  if (!validationResult.success) {
    throw new ValidationError('Invalid history configuration', validationResult.error.issues);
  }

  await configService.setHistorySize(validationResult.data.maxSize);
  const updatedConfig = configService.getGameConfiguration();

  res.json({
    history: updatedConfig.history,
    message: 'History configuration updated successfully',
    timestamp: new Date().toISOString()
  });
}));

// PUT /api/config/content - Update content configuration
router.put('/content', asyncHandler(async (req: Request, res: Response) => {
  const configService = getConfigurationService();

  const validationResult = ContentConfigSchema.safeParse(req.body);
  if (!validationResult.success) {
    throw new ValidationError('Invalid content configuration', validationResult.error.issues);
  }

  const contentConfig = validationResult.data;
  const cleanConfig: { cacheTimeout?: number; configMapPath?: string } = {};
  
  if (contentConfig.cacheTimeout !== undefined) {
    cleanConfig.cacheTimeout = contentConfig.cacheTimeout;
  }
  if (contentConfig.configMapPath !== undefined) {
    cleanConfig.configMapPath = contentConfig.configMapPath;
  }
  
  await configService.setContentConfiguration(cleanConfig);
  const updatedConfig = configService.getGameConfiguration();

  res.json({
    content: updatedConfig.content,
    message: 'Content configuration updated successfully',
    timestamp: new Date().toISOString()
  });
}));

// POST /api/config/reset - Reset configuration to defaults
router.post('/reset', asyncHandler(async (req: Request, res: Response) => {
  const configService = getConfigurationService();
  
  await configService.resetToDefaults();
  const config = configService.getAllConfiguration();

  res.json({
    config,
    message: 'Configuration reset to defaults successfully',
    timestamp: new Date().toISOString()
  });
}));

// GET /api/config/timer/options - Get available timer duration options
router.get('/timer/options', asyncHandler(async (req: Request, res: Response) => {
  const configService = getConfigurationService();
  const options = configService.getTimerOptions();

  res.json({
    options,
    timestamp: new Date().toISOString()
  });
}));

export { router as configRouter };