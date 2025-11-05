/**
 * ConfigMap Integration Tests
 * Tests the complete ConfigMap integration including content loading, hot reload, and category filtering
 */

import fs from 'fs/promises';
import path from 'path';
import { ConfigMapLoader, ConfigMapLoaderOptions } from '../src/services/configMapLoader';
import { ContentService } from '../src/services/contentService';
import { ContentConfig } from '../src/types/content';

describe('ConfigMap Integration', () => {
  const testConfigMapPath = path.join(__dirname, 'fixtures', 'configmap');
  let configMapLoader: ConfigMapLoader;
  let contentService: ContentService;

  // Test content
  const testSentences = {
    sentences: [
      {
        id: 'test-k8s-1',
        text: 'Kubernetes makes container orchestration...',
        category: 'Kubernetes'
      },
      {
        id: 'test-devops-1',
        text: 'DevOps practices improve...',
        category: 'DevOps'
      },
      {
        id: 'test-obs-1',
        text: 'Observability helps teams...',
        category: 'Observability'
      }
    ]
  };

  const testAcronyms = {
    acronyms: [
      {
        id: 'test-k8s',
        term: 'K8s',
        meaning: 'Kubernetes'
      },
      {
        id: 'test-cicd',
        term: 'CI/CD',
        meaning: 'Continuous Integration/Continuous Deployment'
      }
    ]
  };

  beforeAll(async () => {
    // Create test ConfigMap directory and files
    await fs.mkdir(testConfigMapPath, { recursive: true });
    await fs.writeFile(
      path.join(testConfigMapPath, 'sentences.json'),
      JSON.stringify(testSentences, null, 2)
    );
    await fs.writeFile(
      path.join(testConfigMapPath, 'acronyms.json'),
      JSON.stringify(testAcronyms, null, 2)
    );
  });

  afterAll(async () => {
    // Cleanup test files
    try {
      await fs.rm(testConfigMapPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    const options: ConfigMapLoaderOptions = {
      configMapPath: testConfigMapPath,
      watchForChanges: false, // Disable watching for tests
      cacheTimeout: 1000
    };

    configMapLoader = new ConfigMapLoader(options);
    contentService = new ContentService(options);
  });

  afterEach(async () => {
    if (configMapLoader) {
      await configMapLoader.cleanup();
    }
    if (contentService) {
      await contentService.cleanup();
    }
  });

  describe('ConfigMap Content Loading', () => {
    it('should load content from ConfigMap files', async () => {
      await configMapLoader.initialize();
      
      const content = await configMapLoader.getContent();
      
      expect(content).toBeDefined();
      expect(content.sentences).toHaveLength(3);
      expect(content.acronyms).toHaveLength(2);
      
      // Verify sentence content
      expect(content.sentences[0]).toEqual(testSentences.sentences[0]);
      expect(content.sentences[1]).toEqual(testSentences.sentences[1]);
      expect(content.sentences[2]).toEqual(testSentences.sentences[2]);
      
      // Verify acronym content
      expect(content.acronyms[0]).toEqual(testAcronyms.acronyms[0]);
      expect(content.acronyms[1]).toEqual(testAcronyms.acronyms[1]);
    });

    it('should handle missing ConfigMap files gracefully', async () => {
      const invalidOptions: ConfigMapLoaderOptions = {
        configMapPath: '/nonexistent/path',
        watchForChanges: false,
        cacheTimeout: 1000,
        fallbackContent: {
          sentences: [{ id: 'fallback', text: 'Fallback sentence...', category: 'Test' }],
          acronyms: [{ id: 'fallback', term: 'TEST', meaning: 'Test Acronym' }]
        }
      };

      const fallbackLoader = new ConfigMapLoader(invalidOptions);
      
      await fallbackLoader.initialize();
      const content = await fallbackLoader.getContent();
      
      expect(content.sentences).toHaveLength(1);
      expect(content.sentences[0]?.id).toBe('fallback');
      expect(content.acronyms).toHaveLength(1);
      expect(content.acronyms[0]?.id).toBe('fallback');
      
      await fallbackLoader.cleanup();
    });

    it('should validate content structure', async () => {
      // Create invalid content file
      const invalidContent = { invalid: 'structure' };
      await fs.writeFile(
        path.join(testConfigMapPath, 'sentences.json'),
        JSON.stringify(invalidContent)
      );

      await expect(configMapLoader.initialize()).rejects.toThrow();
      
      // Restore valid content
      await fs.writeFile(
        path.join(testConfigMapPath, 'sentences.json'),
        JSON.stringify(testSentences, null, 2)
      );
    });
  });

  describe('Category Filtering', () => {
    beforeEach(async () => {
      await configMapLoader.initialize();
    });

    it('should return all sentences when no category filter is applied', async () => {
      const sentences = await configMapLoader.getSentences();
      expect(sentences).toHaveLength(3);
    });

    it('should filter sentences by category', async () => {
      const kubernetesSentences = await configMapLoader.getSentences('Kubernetes');
      expect(kubernetesSentences).toHaveLength(1);
      expect(kubernetesSentences[0]?.category).toBe('Kubernetes');
      expect(kubernetesSentences[0]?.id).toBe('test-k8s-1');

      const devopsSentences = await configMapLoader.getSentences('DevOps');
      expect(devopsSentences).toHaveLength(1);
      expect(devopsSentences[0]?.category).toBe('DevOps');
      expect(devopsSentences[0]?.id).toBe('test-devops-1');

      const observabilitySentences = await configMapLoader.getSentences('Observability');
      expect(observabilitySentences).toHaveLength(1);
      expect(observabilitySentences[0]?.category).toBe('Observability');
      expect(observabilitySentences[0]?.id).toBe('test-obs-1');
    });

    it('should handle case-insensitive category filtering', async () => {
      const sentences1 = await configMapLoader.getSentences('kubernetes');
      const sentences2 = await configMapLoader.getSentences('KUBERNETES');
      const sentences3 = await configMapLoader.getSentences('Kubernetes');
      
      expect(sentences1).toHaveLength(1);
      expect(sentences2).toHaveLength(1);
      expect(sentences3).toHaveLength(1);
      
      expect(sentences1[0]?.id).toBe(sentences2[0]?.id);
      expect(sentences2[0]?.id).toBe(sentences3[0]?.id);
    });

    it('should return empty array for non-existent category', async () => {
      const sentences = await configMapLoader.getSentences('NonExistent');
      expect(sentences).toHaveLength(0);
    });

    it('should return available categories', async () => {
      const categories = await configMapLoader.getCategories();
      expect(categories).toHaveLength(3);
      expect(categories).toContain('Kubernetes');
      expect(categories).toContain('DevOps');
      expect(categories).toContain('Observability');
      expect(categories).toEqual(categories.sort()); // Should be sorted
    });
  });

  describe('Content Service Integration', () => {
    beforeEach(async () => {
      await contentService.initialize();
    });

    it('should provide sentences through content service', async () => {
      const result = await contentService.getSentences();
      
      expect(result.sentences).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.categories).toHaveLength(3);
      expect(result.categories).toContain('Kubernetes');
      expect(result.categories).toContain('DevOps');
      expect(result.categories).toContain('Observability');
    });

    it('should provide filtered sentences through content service', async () => {
      const result = await contentService.getSentences('Kubernetes');
      
      expect(result.sentences).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.sentences[0]?.category).toBe('Kubernetes');
    });

    it('should provide acronyms through content service', async () => {
      const result = await contentService.getAcronyms();
      
      expect(result.acronyms).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should support pagination', async () => {
      const result = await contentService.getSentences(undefined, 2, 0);
      
      expect(result.sentences).toHaveLength(2);
      expect(result.total).toBe(3);
      
      const result2 = await contentService.getSentences(undefined, 2, 2);
      expect(result2.sentences).toHaveLength(1);
      expect(result2.total).toBe(3);
    });

    it('should provide health status', async () => {
      const health = await contentService.getHealthStatus();
      
      expect(health.healthy).toBe(true);
      expect(health.message).toBe('Content service operational');
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Hot Reload Functionality', () => {
    it('should detect content changes when watching is enabled', async () => {
      const watchingOptions: ConfigMapLoaderOptions = {
        configMapPath: testConfigMapPath,
        watchForChanges: true,
        cacheTimeout: 100
      };

      const watchingLoader = new ConfigMapLoader(watchingOptions);
      await watchingLoader.initialize();

      let contentUpdated = false;
      watchingLoader.on('contentUpdated', () => {
        contentUpdated = true;
      });

      // Modify content file
      const updatedSentences = {
        sentences: [
          ...testSentences.sentences,
          {
            id: 'test-new-1',
            text: 'New sentence added...',
            category: 'Test'
          }
        ]
      };

      await fs.writeFile(
        path.join(testConfigMapPath, 'sentences.json'),
        JSON.stringify(updatedSentences, null, 2)
      );

      // Wait for file watcher to detect change
      await new Promise(resolve => setTimeout(resolve, 1500));

      const content = await watchingLoader.getContent();
      expect(content.sentences).toHaveLength(4);
      expect(content.sentences[3]?.id).toBe('test-new-1');

      // Restore original content
      await fs.writeFile(
        path.join(testConfigMapPath, 'sentences.json'),
        JSON.stringify(testSentences, null, 2)
      );

      await watchingLoader.cleanup();
    });

    it('should handle reload errors gracefully', async () => {
      await configMapLoader.initialize();

      // Create invalid content
      await fs.writeFile(
        path.join(testConfigMapPath, 'sentences.json'),
        'invalid json content'
      );

      // Should not throw, but should keep previous content
      const content = await configMapLoader.getContent();
      expect(content.sentences).toHaveLength(3); // Previous valid content

      // Restore valid content
      await fs.writeFile(
        path.join(testConfigMapPath, 'sentences.json'),
        JSON.stringify(testSentences, null, 2)
      );
    });
  });

  describe('Caching Behavior', () => {
    it('should cache content and respect cache timeout', async () => {
      const shortCacheOptions: ConfigMapLoaderOptions = {
        configMapPath: testConfigMapPath,
        watchForChanges: false,
        cacheTimeout: 100 // Very short cache
      };

      const cachingLoader = new ConfigMapLoader(shortCacheOptions);
      await cachingLoader.initialize();

      const content1 = await cachingLoader.getContent();
      const content2 = await cachingLoader.getContent(); // Should use cache
      
      expect(content1).toBe(content2); // Same object reference

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const content3 = await cachingLoader.getContent(); // Should reload
      expect(content3).toEqual(content1); // Same content, but different object

      await cachingLoader.cleanup();
    });

    it('should force reload content', async () => {
      await configMapLoader.initialize();

      const content1 = await configMapLoader.getContent();
      
      // Modify file
      const modifiedSentences = {
        sentences: [testSentences.sentences[0]] // Only first sentence
      };
      
      await fs.writeFile(
        path.join(testConfigMapPath, 'sentences.json'),
        JSON.stringify(modifiedSentences, null, 2)
      );

      // Force reload
      await configMapLoader.reloadContent();
      const content2 = await configMapLoader.getContent();
      
      expect(content2.sentences).toHaveLength(1);
      expect(content2.sentences[0]).toEqual(testSentences.sentences[0]);

      // Restore original content
      await fs.writeFile(
        path.join(testConfigMapPath, 'sentences.json'),
        JSON.stringify(testSentences, null, 2)
      );
    });
  });
});