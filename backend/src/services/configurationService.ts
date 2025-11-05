/**
 * Configuration service for managing runtime settings
 */

import { getDatabaseService } from './databaseService';
import { AppEnvironmentConfig } from '../types/config';
import { createLogger } from '../utils/logger';

const logger = createLogger('info');

export interface TimerConfiguration {
  finishSentence: {
    defaultSeconds: number;
    availableOptions: number[];
  };
  guessAcronym: {
    defaultSeconds: number;
    availableOptions: number[];
  };
}

export interface GameConfiguration {
  timer: TimerConfiguration;
  history: {
    maxSize: number;
  };
  content: {
    cacheTimeout: number;
    configMapPath: string;
  };
}

export class ConfigurationService {
  private envConfig: AppEnvironmentConfig;
  private runtimeConfig: Map<string, string> = new Map();
  private initialized = false;

  constructor(envConfig: AppEnvironmentConfig) {
    this.envConfig = envConfig;
  }

  /**
   * Initialize configuration service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load runtime configuration from database if available
      await this.loadRuntimeConfig();
      
      // Set default values if not present
      await this.setDefaultConfiguration();
      
      this.initialized = true;
      logger.info('Configuration service initialized');
    } catch (error) {
      logger.error('Failed to initialize configuration service:', error);
      // Continue with environment defaults
      this.initialized = true;
    }
  }

  /**
   * Get timer configuration
   */
  getTimerConfiguration(): TimerConfiguration {
    const finishSentenceDefault = this.getRuntimeConfigNumber('timer.finishSentence.default', this.envConfig.TIMER_DEFAULT_SECONDS);
    const guessAcronymDefault = this.getRuntimeConfigNumber('timer.guessAcronym.default', 10);
    
    const availableOptions = this.getTimerOptions();

    return {
      finishSentence: {
        defaultSeconds: finishSentenceDefault,
        availableOptions
      },
      guessAcronym: {
        defaultSeconds: guessAcronymDefault,
        availableOptions
      }
    };
  }

  /**
   * Get available timer duration options
   */
  getTimerOptions(): number[] {
    const optionsStr = this.getRuntimeConfig('timer.availableOptions', '15,30,45,60');
    return optionsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
  }

  /**
   * Get game configuration
   */
  getGameConfiguration(): GameConfiguration {
    return {
      timer: this.getTimerConfiguration(),
      history: {
        maxSize: this.getRuntimeConfigNumber('history.maxSize', this.envConfig.HISTORY_SIZE)
      },
      content: {
        cacheTimeout: this.getRuntimeConfigNumber('content.cacheTimeout', this.envConfig.CONTENT_CACHE_TIMEOUT),
        configMapPath: this.getRuntimeConfig('content.configMapPath', this.envConfig.CONFIGMAP_PATH)
      }
    };
  }

  /**
   * Set timer configuration
   */
  async setTimerConfiguration(config: {
    finishSentence?: {
      defaultSeconds?: number;
      availableOptions?: number[];
    };
    guessAcronym?: {
      defaultSeconds?: number;
      availableOptions?: number[];
    };
  }): Promise<void> {
    if (config.finishSentence?.defaultSeconds !== undefined) {
      await this.setRuntimeConfig('timer.finishSentence.default', config.finishSentence.defaultSeconds.toString());
    }

    if (config.guessAcronym?.defaultSeconds !== undefined) {
      await this.setRuntimeConfig('timer.guessAcronym.default', config.guessAcronym.defaultSeconds.toString());
    }

    if (config.finishSentence?.availableOptions || config.guessAcronym?.availableOptions) {
      // Use the first available options array found
      const options = config.finishSentence?.availableOptions || config.guessAcronym?.availableOptions || [];
      await this.setRuntimeConfig('timer.availableOptions', options.join(','));
    }

    logger.info('Timer configuration updated');
  }

  /**
   * Set history configuration
   */
  async setHistorySize(size: number): Promise<void> {
    if (size < 1 || size > 1000) {
      throw new Error('History size must be between 1 and 1000');
    }

    await this.setRuntimeConfig('history.maxSize', size.toString());
    logger.info(`History size updated to ${size}`);
  }

  /**
   * Set content configuration
   */
  async setContentConfiguration(config: {
    cacheTimeout?: number;
    configMapPath?: string;
  }): Promise<void> {
    if (config.cacheTimeout !== undefined) {
      if (config.cacheTimeout < 1000) {
        throw new Error('Cache timeout must be at least 1000ms');
      }
      await this.setRuntimeConfig('content.cacheTimeout', config.cacheTimeout.toString());
    }

    if (config.configMapPath !== undefined) {
      await this.setRuntimeConfig('content.configMapPath', config.configMapPath);
    }

    logger.info('Content configuration updated');
  }

  /**
   * Get all configuration as a flat object
   */
  getAllConfiguration(): Record<string, any> {
    const gameConfig = this.getGameConfiguration();
    
    return {
      // Environment configuration
      environment: {
        nodeEnv: this.envConfig.NODE_ENV,
        port: this.envConfig.PORT,
        logLevel: this.envConfig.LOG_LEVEL,
        corsOrigin: this.envConfig.CORS_ORIGIN
      },
      
      // Game configuration
      timer: gameConfig.timer,
      history: gameConfig.history,
      content: gameConfig.content,
      
      // Database configuration (without sensitive data)
      database: {
        configured: !!this.envConfig.DATABASE_URL,
        maxConnections: this.envConfig.DB_MAX_CONNECTIONS,
        idleTimeout: this.envConfig.DB_IDLE_TIMEOUT,
        connectionTimeout: this.envConfig.DB_CONNECTION_TIMEOUT
      }
    };
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.runtimeConfig.clear();
    await this.setDefaultConfiguration();
    logger.info('Configuration reset to defaults');
  }

  /**
   * Get runtime configuration value
   */
  private getRuntimeConfig(key: string, defaultValue: string): string {
    return this.runtimeConfig.get(key) || defaultValue;
  }

  /**
   * Get runtime configuration value as number
   */
  private getRuntimeConfigNumber(key: string, defaultValue: number): number {
    const value = this.runtimeConfig.get(key);
    if (!value) return defaultValue;
    
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Set runtime configuration value
   */
  private async setRuntimeConfig(key: string, value: string): Promise<void> {
    this.runtimeConfig.set(key, value);
    
    // Persist to database if available
    try {
      const databaseService = getDatabaseService();
      await databaseService.setConfig(key, value);
    } catch (error) {
      // Database not available - configuration will be in-memory only
      logger.debug(`Could not persist config to database: ${key}`);
    }
  }

  /**
   * Load runtime configuration from database
   */
  private async loadRuntimeConfig(): Promise<void> {
    try {
      const databaseService = getDatabaseService();
      const config = await databaseService.getAllConfig();
      
      for (const [key, value] of Object.entries(config)) {
        this.runtimeConfig.set(key, value);
      }
      
      logger.debug(`Loaded ${Object.keys(config).length} configuration values from database`);
    } catch (error) {
      // Database not available - use environment defaults
      logger.debug('Database not available for configuration loading');
    }
  }

  /**
   * Set default configuration values
   */
  private async setDefaultConfiguration(): Promise<void> {
    const defaults: [string, string][] = [
      ['timer.finishSentence.default', this.envConfig.TIMER_DEFAULT_SECONDS.toString()],
      ['timer.guessAcronym.default', '10'],
      ['timer.availableOptions', '15,30,45,60'],
      ['history.maxSize', this.envConfig.HISTORY_SIZE.toString()],
      ['content.cacheTimeout', this.envConfig.CONTENT_CACHE_TIMEOUT.toString()],
      ['content.configMapPath', this.envConfig.CONFIGMAP_PATH]
    ];

    for (const [key, value] of defaults) {
      if (!this.runtimeConfig.has(key)) {
        await this.setRuntimeConfig(key, value);
      }
    }
  }
}

// Singleton instance
let configurationServiceInstance: ConfigurationService | null = null;

/**
 * Create configuration service instance
 */
export function createConfigurationService(envConfig: AppEnvironmentConfig): ConfigurationService {
  if (configurationServiceInstance) {
    throw new Error('Configuration service already created');
  }

  configurationServiceInstance = new ConfigurationService(envConfig);
  return configurationServiceInstance;
}

/**
 * Get configuration service instance
 */
export function getConfigurationService(): ConfigurationService {
  if (!configurationServiceInstance) {
    throw new Error('Configuration service not created. Call createConfigurationService first.');
  }

  return configurationServiceInstance;
}