/**
 * Content service - manages content loading and provides unified API
 */

import { ConfigMapLoader, ConfigMapLoaderOptions, defaultFallbackContent } from './configMapLoader';
import { Sentence, Acronym, ContentConfig } from '../types/content';
import { createLogger } from '../utils/logger';

const logger = createLogger('info');
import { clearCache } from '../middleware/caching';

export class ContentService {
  private configMapLoader: ConfigMapLoader;
  private initialized = false;

  constructor(options: ConfigMapLoaderOptions) {
    this.configMapLoader = new ConfigMapLoader(options);
    
    // Set up event listeners
    this.configMapLoader.on('contentUpdated', (content: ContentConfig) => {
      logger.info('Content updated successfully');
      // Clear response cache when content is updated
      clearCache();
    });

    this.configMapLoader.on('contentReloaded', () => {
      logger.info('Content reloaded successfully');
      // Clear response cache when content is reloaded
      clearCache();
    });

    this.configMapLoader.on('contentError', (error: Error) => {
      logger.error('Content loading error:', error);
    });
  }

  /**
   * Initialize the content service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.configMapLoader.initialize();
      this.initialized = true;
      logger.info('Content service initialized');
    } catch (error) {
      logger.error('Failed to initialize content service:', error);
      throw error;
    }
  }

  /**
   * Get sentences with optional category filtering
   */
  async getSentences(category?: string, limit?: number, offset?: number): Promise<{
    sentences: Sentence[];
    total: number;
    categories: string[];
  }> {
    if (!this.initialized) {
      throw new Error('Content service not initialized');
    }

    try {
      const [sentences, allCategories] = await Promise.all([
        this.configMapLoader.getSentences(category),
        this.configMapLoader.getCategories()
      ]);

      // Apply pagination if specified
      const paginatedSentences = limit !== undefined && offset !== undefined
        ? sentences.slice(offset, offset + limit)
        : sentences;

      return {
        sentences: paginatedSentences,
        total: sentences.length,
        categories: allCategories
      };
    } catch (error) {
      logger.error('Failed to get sentences:', error);
      throw error;
    }
  }

  /**
   * Get acronyms with optional pagination
   */
  async getAcronyms(limit?: number, offset?: number): Promise<{
    acronyms: Acronym[];
    total: number;
  }> {
    if (!this.initialized) {
      throw new Error('Content service not initialized');
    }

    try {
      const acronyms = await this.configMapLoader.getAcronyms();

      // Apply pagination if specified
      const paginatedAcronyms = limit !== undefined && offset !== undefined
        ? acronyms.slice(offset, offset + limit)
        : acronyms;

      return {
        acronyms: paginatedAcronyms,
        total: acronyms.length
      };
    } catch (error) {
      logger.error('Failed to get acronyms:', error);
      throw error;
    }
  }

  /**
   * Get available categories
   */
  async getCategories(): Promise<string[]> {
    if (!this.initialized) {
      throw new Error('Content service not initialized');
    }

    try {
      return await this.configMapLoader.getCategories();
    } catch (error) {
      logger.error('Failed to get categories:', error);
      throw error;
    }
  }

  /**
   * Force reload content
   */
  async reloadContent(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Content service not initialized');
    }

    try {
      await this.configMapLoader.reloadContent();
      logger.info('Content reloaded manually');
    } catch (error) {
      logger.error('Failed to reload content:', error);
      throw error;
    }
  }

  /**
   * Check if content is available
   */
  isContentAvailable(): boolean {
    return this.initialized && this.configMapLoader.isContentAvailable();
  }

  /**
   * Get health status of content loading
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    message: string;
    responseTime: number;
  }> {
    const startTime = Date.now();

    try {
      if (!this.initialized) {
        return {
          healthy: false,
          message: 'Content service not initialized',
          responseTime: Date.now() - startTime
        };
      }

      const isAvailable = this.configMapLoader.isContentAvailable();
      
      if (!isAvailable) {
        return {
          healthy: false,
          message: 'Content not available',
          responseTime: Date.now() - startTime
        };
      }

      // Try to fetch a small amount of content to verify it's working
      await this.configMapLoader.getCategories();

      return {
        healthy: true,
        message: 'Content service operational',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Content service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.configMapLoader) {
      await this.configMapLoader.cleanup();
    }
    this.initialized = false;
    logger.info('Content service cleaned up');
  }
}

// Singleton instance
let contentServiceInstance: ContentService | null = null;

/**
 * Create and configure the content service instance
 */
export function createContentService(options: ConfigMapLoaderOptions): ContentService {
  if (contentServiceInstance) {
    throw new Error('Content service already created');
  }

  contentServiceInstance = new ContentService(options);
  return contentServiceInstance;
}

/**
 * Get the content service instance
 */
export function getContentService(): ContentService {
  if (!contentServiceInstance) {
    throw new Error('Content service not created. Call createContentService first.');
  }

  return contentServiceInstance;
}

/**
 * Create default content service for development
 */
export function createDefaultContentService(): ContentService {
  const defaultOptions: ConfigMapLoaderOptions = {
    configMapPath: process.env.CONFIGMAP_PATH || '/app/content',
    watchForChanges: process.env.WATCH_CONFIG_CHANGES === 'true' || process.env.NODE_ENV !== 'production',
    cacheTimeout: parseInt(process.env.CONTENT_CACHE_TIMEOUT || '300000'), // 5 minutes
    fallbackContent: defaultFallbackContent
  };

  return createContentService(defaultOptions);
}

/**
 * Update content service configuration from configuration service
 */
export async function updateContentServiceConfig(): Promise<void> {
  try {
    const { getConfigurationService } = await import('./configurationService');
    const configService = getConfigurationService();
    const gameConfig = configService.getGameConfiguration();
    
    // The content service would need to be updated to support dynamic reconfiguration
    // For now, this is a placeholder for future enhancement
    logger.info('Content service configuration updated from configuration service');
  } catch (error) {
    logger.debug('Could not update content service configuration:', error);
  }
}