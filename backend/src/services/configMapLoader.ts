/**
 * ConfigMap content loader service
 * Handles loading and hot-reloading of game content from Kubernetes ConfigMaps
 */

import fs from 'fs/promises';
import { watch } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { ContentConfig, ContentConfigSchema, Sentence, Acronym } from '../types/content';
import { createLogger } from '../utils/logger';

const logger = createLogger('info');

export interface ConfigMapLoaderOptions {
  configMapPath: string;
  watchForChanges: boolean;
  cacheTimeout: number;
  fallbackContent?: ContentConfig;
}

export class ConfigMapLoader extends EventEmitter {
  private configMapPath: string;
  private watchForChanges: boolean;
  private cacheTimeout: number;
  private fallbackContent: ContentConfig | undefined;
  private cachedContent: ContentConfig | null = null;
  private lastLoadTime: number = 0;
  private watchers: ReturnType<typeof watch>[] = [];
  private isLoading = false;

  constructor(options: ConfigMapLoaderOptions) {
    super();
    this.configMapPath = options.configMapPath;
    this.watchForChanges = options.watchForChanges;
    this.cacheTimeout = options.cacheTimeout;
    this.fallbackContent = options.fallbackContent;
  }

  /**
   * Initialize the loader and start watching for changes if enabled
   */
  async initialize(): Promise<void> {
    try {
      await this.loadContent();
      
      if (this.watchForChanges) {
        await this.setupFileWatchers();
      }
      
      logger.info('ConfigMap loader initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ConfigMap loader:', error);
      throw error;
    }
  }

  /**
   * Get current content, loading from cache or files as needed
   */
  async getContent(): Promise<ContentConfig> {
    const now = Date.now();
    
    // Return cached content if still valid
    if (this.cachedContent && (now - this.lastLoadTime) < this.cacheTimeout) {
      return this.cachedContent;
    }

    // Load fresh content
    await this.loadContent();
    
    if (!this.cachedContent) {
      throw new Error('Failed to load content and no fallback available');
    }

    return this.cachedContent;
  }

  /**
   * Force reload content from files
   */
  async reloadContent(): Promise<void> {
    this.cachedContent = null;
    await this.loadContent();
  }

  /**
   * Get sentences with optional category filtering
   */
  async getSentences(category?: string): Promise<Sentence[]> {
    const content = await this.getContent();
    
    if (!category) {
      return content.sentences;
    }

    return content.sentences.filter(
      sentence => sentence.category.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Get all acronyms
   */
  async getAcronyms(): Promise<Acronym[]> {
    const content = await this.getContent();
    return content.acronyms;
  }

  /**
   * Get available categories
   */
  async getCategories(): Promise<string[]> {
    const content = await this.getContent();
    const categories = [...new Set(content.sentences.map(s => s.category))];
    return categories.sort();
  }

  /**
   * Check if content is currently available
   */
  isContentAvailable(): boolean {
    return this.cachedContent !== null;
  }

  /**
   * Cleanup watchers and resources
   */
  async cleanup(): Promise<void> {
    // Close file watchers
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    
    // Remove all listeners
    this.removeAllListeners();
    
    logger.info('ConfigMap loader cleaned up');
  }

  /**
   * Load content from ConfigMap files
   */
  private async loadContent(): Promise<void> {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;

    try {
      const sentencesPath = path.join(this.configMapPath, 'sentences.json');
      const acronymsPath = path.join(this.configMapPath, 'acronyms.json');
      
      logger.debug(`Loading content from ConfigMap path: ${this.configMapPath}`);
      logger.debug(`Sentences path: ${sentencesPath}`);
      logger.debug(`Acronyms path: ${acronymsPath}`);

      // Load and parse content files
      const [sentencesFile, acronymsFile] = await Promise.all([
        this.loadJsonFile(sentencesPath),
        this.loadJsonFile(acronymsPath)
      ]);

      // Extract arrays from the JSON objects
      const contentConfig: ContentConfig = {
        sentences: sentencesFile.sentences || sentencesFile,
        acronyms: acronymsFile.acronyms || acronymsFile
      };

      const validationResult = ContentConfigSchema.safeParse(contentConfig);
      
      if (!validationResult.success) {
        throw new Error(`Content validation failed: ${validationResult.error.message}`);
      }

      // Update cache
      this.cachedContent = validationResult.data;
      this.lastLoadTime = Date.now();

      logger.info(`Loaded ${this.cachedContent.sentences.length} sentences and ${this.cachedContent.acronyms.length} acronyms`);
      
      // Emit content updated event
      this.emit('contentUpdated', this.cachedContent);

    } catch (error) {
      logger.error('Failed to load content from ConfigMap:', error);
      logger.error('Error details:', error instanceof Error ? error.message : String(error));
      
      // Use fallback content if available
      if (this.fallbackContent && !this.cachedContent) {
        logger.warn('Using fallback content');
        this.cachedContent = this.fallbackContent;
        this.lastLoadTime = Date.now();
        this.emit('contentUpdated', this.cachedContent);
      } else if (!this.cachedContent) {
        throw error;
      }
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load and parse a JSON file
   */
  private async loadJsonFile(filePath: string): Promise<any> {
    try {
      logger.debug(`Attempting to read file: ${filePath}`);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      logger.debug(`File content length: ${fileContent.length}`);
      const parsed = JSON.parse(fileContent);
      logger.debug(`Parsed JSON successfully`);
      return parsed;
    } catch (error) {
      logger.error(`Error loading JSON file ${filePath}:`, error);
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`ConfigMap file not found: ${filePath}`);
      }
      throw new Error(`Failed to load JSON file ${filePath}: ${error}`);
    }
  }

  /**
   * Setup file watchers for hot reload
   */
  private async setupFileWatchers(): Promise<void> {
    const sentencesPath = path.join(this.configMapPath, 'sentences.json');
    const acronymsPath = path.join(this.configMapPath, 'acronyms.json');

    const watchPaths = [sentencesPath, acronymsPath];

    for (const watchPath of watchPaths) {
      try {
        // Check if file exists before watching
        await fs.access(watchPath);
        
        const watcher = watch(watchPath, { persistent: false }, (eventType) => {
          if (eventType === 'change') {
            logger.info(`ConfigMap file changed: ${watchPath}`);
            this.handleFileChange();
          }
        });

        this.watchers.push(watcher);
        logger.debug(`Watching ConfigMap file: ${watchPath}`);
        
      } catch (error) {
        logger.warn(`Cannot watch ConfigMap file ${watchPath}:`, error);
      }
    }
  }

  /**
   * Handle file change events with debouncing
   */
  private handleFileChange = (() => {
    let timeout: NodeJS.Timeout | null = null;
    
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(async () => {
        try {
          logger.info('Reloading content due to ConfigMap changes');
          await this.reloadContent();
          this.emit('contentReloaded');
        } catch (error) {
          logger.error('Failed to reload content after file change:', error);
          this.emit('contentError', error);
        }
      }, 1000); // Debounce for 1 second
    };
  })();
}

/**
 * Default fallback content for development/testing
 */
export const defaultFallbackContent: ContentConfig = {
  sentences: [
    {
      id: 'fallback-1',
      text: 'The best way to scale Kubernetes is...',
      category: 'Kubernetes'
    },
    {
      id: 'fallback-2',
      text: 'When implementing DevOps, the most important thing is...',
      category: 'DevOps'
    },
    {
      id: 'fallback-3',
      text: 'Observability helps teams by...',
      category: 'Observability'
    },
    {
      id: 'fallback-4',
      text: 'Building a strong engineering culture requires...',
      category: 'Culture'
    }
  ],
  acronyms: [
    {
      id: 'fallback-1',
      term: 'K8s',
      meaning: 'Kubernetes'
    },
    {
      id: 'fallback-2',
      term: 'CI/CD',
      meaning: 'Continuous Integration/Continuous Deployment'
    },
    {
      id: 'fallback-3',
      term: 'SRE',
      meaning: 'Site Reliability Engineering'
    },
    {
      id: 'fallback-4',
      term: 'YAML',
      meaning: 'YAML Ain\'t Markup Language'
    }
  ]
};