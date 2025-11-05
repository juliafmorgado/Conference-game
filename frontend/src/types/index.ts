/**
 * Main types export file for Conference Games
 */

export * from './game';

// Re-export commonly used types for convenience
export type {
  Sentence,
  Acronym,
  GameState,
  TimerState,
  SentencesResponse,
  AcronymsResponse,
  ApiError,
  TimerConfig,
  GameConfig,
  TimerProps,
  GameComponentProps
} from './game';