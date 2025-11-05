/**
 * Main types export file for Conference Games Backend
 */

export * from './content';
export * from './database';
export * from './config';

// Re-export commonly used types for convenience
export type {
  Sentence,
  Acronym,
  ContentConfig,
  HealthStatus
} from './content';

export type {
  GameSession,
  AppConfig,
  GameSessionInput,
  AppConfigInput,
  DatabaseConfig,
  CreateGameSessionInput,
  UpdateGameSessionInput
} from './database';

export type {
  AppEnvironmentConfig,
  GameConfiguration,
  ServerConfig,
  ApplicationConfig,
  AppEnvironmentConfigInput,
  GameConfigurationInput,
  ServerConfigInput,
  ApplicationConfigInput
} from './config';

// Re-export validation schemas from content
export {
  SentenceSchema,
  AcronymSchema,
  ContentConfigSchema,
  HealthStatusSchema,
  SentencesQuerySchema,
  AcronymsQuerySchema
} from './content';

// Re-export validation schemas from database
export {
  GameSessionSchema,
  AppConfigSchema,
  DatabaseConfigSchema
} from './database';

// Re-export validation schemas from config
export {
  AppEnvironmentConfigSchema,
  GameConfigurationSchema,
  ServerConfigSchema,
  ApplicationConfigSchema
} from './config';