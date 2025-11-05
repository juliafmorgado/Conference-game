/**
 * Application configuration types and validation
 */

import { z } from 'zod';

/**
 * Environment configuration
 */

export interface AppEnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL?: string | undefined;
  TIMER_DEFAULT_SECONDS: number;
  HISTORY_SIZE: number;
  CORS_ORIGIN: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  CONFIGMAP_PATH: string;
  CONTENT_CACHE_TIMEOUT: number;
  DB_MAX_CONNECTIONS: number;
  DB_IDLE_TIMEOUT: number;
  DB_CONNECTION_TIMEOUT: number;
}

export const AppEnvironmentConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url().optional(),
  TIMER_DEFAULT_SECONDS: z.coerce.number().min(5).max(300).default(30),
  HISTORY_SIZE: z.coerce.number().min(1).max(1000).default(50),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  CONFIGMAP_PATH: z.string().default('/etc/config'),
  CONTENT_CACHE_TIMEOUT: z.coerce.number().min(1000).default(300000), // 5 minutes
  DB_MAX_CONNECTIONS: z.coerce.number().min(1).max(100).default(20),
  DB_IDLE_TIMEOUT: z.coerce.number().min(1000).default(30000),
  DB_CONNECTION_TIMEOUT: z.coerce.number().min(1000).default(2000)
});

/**
 * Game configuration
 */

export interface GameConfiguration {
  finishSentence: {
    defaultTimerSeconds: number;
    availableCategories: string[];
  };
  guessAcronym: {
    defaultTimerSeconds: number;
  };
  keyboard: {
    enabled: boolean;
    shortcuts: {
      restart: string;
      next: string;
      previous: string;
    };
  };
  audio: {
    enabled: boolean;
    alertSound: string;
  };
}

export const GameConfigurationSchema = z.object({
  finishSentence: z.object({
    defaultTimerSeconds: z.number().min(5).max(300),
    availableCategories: z.array(z.string())
  }),
  guessAcronym: z.object({
    defaultTimerSeconds: z.number().min(5).max(300)
  }),
  keyboard: z.object({
    enabled: z.boolean(),
    shortcuts: z.object({
      restart: z.string(),
      next: z.string(),
      previous: z.string()
    })
  }),
  audio: z.object({
    enabled: z.boolean(),
    alertSound: z.string()
  })
});

/**
 * Server configuration
 */

export interface ServerConfig {
  port: number;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  compression: {
    enabled: boolean;
    level: number;
  };
  security: {
    helmet: boolean;
    rateLimiting: boolean;
  };
}

export const ServerConfigSchema = z.object({
  port: z.number().min(1).max(65535),
  cors: z.object({
    origin: z.union([z.string(), z.array(z.string())]),
    credentials: z.boolean()
  }),
  compression: z.object({
    enabled: z.boolean(),
    level: z.number().min(1).max(9)
  }),
  security: z.object({
    helmet: z.boolean(),
    rateLimiting: z.boolean()
  })
});

/**
 * Content loading configuration
 */

export interface ContentLoadingConfig {
  configMapPath: string;
  watchForChanges: boolean;
  cacheTimeout: number;
  fallbackContent: {
    sentences: string;
    acronyms: string;
  };
}

export const ContentLoadingConfigSchema = z.object({
  configMapPath: z.string().min(1),
  watchForChanges: z.boolean(),
  cacheTimeout: z.number().min(1000),
  fallbackContent: z.object({
    sentences: z.string(),
    acronyms: z.string()
  })
});

/**
 * Complete application configuration
 */

export interface ApplicationConfig {
  environment: AppEnvironmentConfig;
  server: ServerConfig;
  game: GameConfiguration;
  contentLoading: ContentLoadingConfig;
}

export const ApplicationConfigSchema = z.object({
  environment: AppEnvironmentConfigSchema,
  server: ServerConfigSchema,
  game: GameConfigurationSchema,
  contentLoading: ContentLoadingConfigSchema
});

/**
 * Type inference from schemas
 */

export type AppEnvironmentConfigInput = z.infer<typeof AppEnvironmentConfigSchema>;
export type GameConfigurationInput = z.infer<typeof GameConfigurationSchema>;
export type ServerConfigInput = z.infer<typeof ServerConfigSchema>;
export type ContentLoadingConfigInput = z.infer<typeof ContentLoadingConfigSchema>;
export type ApplicationConfigInput = z.infer<typeof ApplicationConfigSchema>;