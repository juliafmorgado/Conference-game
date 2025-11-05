/**
 * Database entity models and types
 */

import { z } from 'zod';

/**
 * Database entity interfaces
 */

export interface GameSession {
  id: string;
  game_type: 'finish-sentence' | 'guess-acronym';
  started_at: Date;
  ended_at?: Date;
  items_shown: number;
  category?: string;
}

export interface AppConfig {
  key: string;
  value: string;
  updated_at: Date;
}

/**
 * Database validation schemas
 */

export const GameSessionSchema = z.object({
  id: z.string().uuid(),
  game_type: z.enum(['finish-sentence', 'guess-acronym']),
  started_at: z.date(),
  ended_at: z.date().optional(),
  items_shown: z.number().min(0),
  category: z.string().max(100).optional()
});

export const AppConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
  updated_at: z.date()
});

/**
 * Database input/output types
 */

export interface CreateGameSessionInput {
  game_type: 'finish-sentence' | 'guess-acronym';
  category?: string;
}

export interface UpdateGameSessionInput {
  ended_at?: Date;
  items_shown?: number;
}

export interface CreateAppConfigInput {
  key: string;
  value: string;
}

export interface UpdateAppConfigInput {
  value: string;
}

/**
 * Database query result types
 */

export interface GameSessionRow {
  id: string;
  game_type: string;
  started_at: string;
  ended_at?: string;
  items_shown: number;
  category?: string;
}

export interface AppConfigRow {
  key: string;
  value: string;
  updated_at: string;
}

/**
 * Database connection configuration
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number; // Maximum number of connections in pool
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export const DatabaseConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().min(1).max(65535),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
  ssl: z.boolean().optional(),
  max: z.number().min(1).max(100).optional(),
  idleTimeoutMillis: z.number().min(1000).optional(),
  connectionTimeoutMillis: z.number().min(1000).optional()
});

/**
 * Type inference from schemas
 */

export type GameSessionInput = z.infer<typeof GameSessionSchema>;
export type AppConfigInput = z.infer<typeof AppConfigSchema>;
export type DatabaseConfigInput = z.infer<typeof DatabaseConfigSchema>;