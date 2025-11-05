/**
 * Core game content interfaces
 */

export interface Sentence {
  id: string;
  text: string;
  category: string;
}

export interface Acronym {
  id: string;
  term: string;
  meaning: string;
}

/**
 * Game state management types
 */

export interface TimerState {
  duration: number;
  remaining: number;
  isRunning: boolean;
  isPaused: boolean;
}

export interface GameState {
  currentItem: Sentence | Acronym | null;
  history: string[];
  timerDuration: number;
  timerRemaining: number;
  isTimerRunning: boolean;
  selectedCategory?: string;
  audioEnabled: boolean;
}

/**
 * API response types
 */

export interface SentencesResponse {
  sentences: Sentence[];
  total: number;
  category?: string;
}

export interface AcronymsResponse {
  acronyms: Acronym[];
  total: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * Configuration types
 */

export interface TimerConfig {
  defaultDuration: number;
  audioEnabled: boolean;
  visualFeedback: boolean;
}

export interface GameConfig {
  finishSentence: {
    timerDuration: number;
    categories: string[];
  };
  guessAcronym: {
    timerDuration: number;
  };
  keyboard: {
    enabled: boolean;
    shortcuts: {
      restart: string;
      next: string;
      previous: string;
    };
  };
}

/**
 * Component prop types
 */

export interface TimerProps {
  duration: number;
  onComplete: () => void;
  autoStart?: boolean;
  onTick?: (remaining: number) => void;
  audioEnabled?: boolean;
  onAudioToggle?: (enabled: boolean) => void;
}

export interface GameComponentProps {
  config: GameConfig;
  onGameEnd?: () => void;
}