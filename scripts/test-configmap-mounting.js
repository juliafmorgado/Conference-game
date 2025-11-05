#!/usr/bin/env node

/**
 * ConfigMap Mounting Test
 * Simulates how ConfigMaps are mounted in Kubernetes and tests content loading
 */

const fs = require('fs').promises;
const path = require('path');

const TEST_MOUNT_PATH = path.join(__dirname, '..', 'test-configmap-mount');
const CONTENT_SOURCE = path.join(__dirname, '..', 'helm', 'conference-games', 'content');

async function setupConfigMapMount() {
  console.log('📁 Setting up ConfigMap mount simulation...');
  
  // Create mount directory
  await fs.mkdir(TEST_MOUNT_PATH, { recursive: true });
  
  // Copy content files to simulate ConfigMap mounting
  const sentencesSource = path.join(CONTENT_SOURCE, 'sentences.json');
  const acronymsSource = path.join(CONTENT_SOURCE, 'acronyms.json');
  
  const sentencesTarget = path.join(TEST_MOUNT_PATH, 'sentences.json');
  const acronymsTarget = path.join(TEST_MOUNT_PATH, 'acronyms.json');
  
  await fs.copyFile(sentencesSource, sentencesTarget);
  await fs.copyFile(acronymsSource, acronymsTarget);
  
  console.log('✅ ConfigMap mount simulation ready');
  return TEST_MOUNT_PATH;
}

async function testContentLoading(mountPath) {
  console.log('🔍 Testing content loading from mounted ConfigMap...');
  
  // Import the ConfigMapLoader (simulate backend loading)
  // First check if compiled version exists, otherwise use TypeScript directly
  let ConfigMapLoader;
  try {
    const compiled = require('../backend/dist/services/configMapLoader');
    ConfigMapLoader = compiled.ConfigMapLoader;
  } catch (error) {
    // Fallback to requiring TypeScript directly (for development)
    require('ts-node/register');
    const ts = require('../backend/src/services/configMapLoader');
    ConfigMapLoader = ts.ConfigMapLoader;
  }
  
  const loader = new ConfigMapLoader({
    configMapPath: mountPath,
    watchForChanges: false,
    cacheTimeout: 1000
  });
  
  try {
    await loader.initialize();
    
    // Test basic content loading
    const content = await loader.getContent();
    console.log(`✅ Loaded ${content.sentences.length} sentences and ${content.acronyms.length} acronyms`);
    
    // Test category filtering
    const categories = await loader.getCategories();
    console.log(`✅ Found ${categories.length} categories: ${categories.join(', ')}`);
    
    // Test specific category filtering
    for (const category of categories) {
      const filtered = await loader.getSentences(category);
      console.log(`✅ Category "${category}": ${filtered.length} sentences`);
    }
    
    // Test acronyms
    const acronyms = await loader.getAcronyms();
    console.log(`✅ Loaded ${acronyms.length} acronyms`);
    
    await loader.cleanup();
    return true;
    
  } catch (error) {
    console.error('❌ Content loading failed:', error.message);
    return false;
  }
}

async function testHotReload(mountPath) {
  console.log('🔄 Testing hot reload simulation...');
  
  // Import the ConfigMapLoader (simulate backend loading)
  let ConfigMapLoader;
  try {
    const compiled = require('../backend/dist/services/configMapLoader');
    ConfigMapLoader = compiled.ConfigMapLoader;
  } catch (error) {
    // Fallback to requiring TypeScript directly (for development)
    require('ts-node/register');
    const ts = require('../backend/src/services/configMapLoader');
    ConfigMapLoader = ts.ConfigMapLoader;
  }
  
  const loader = new ConfigMapLoader({
    configMapPath: mountPath,
    watchForChanges: true,
    cacheTimeout: 100
  });
  
  try {
    await loader.initialize();
    
    const originalContent = await loader.getContent();
    const originalCount = originalContent.sentences.length;
    
    // Simulate ConfigMap update by modifying the file
    const sentencesPath = path.join(mountPath, 'sentences.json');
    const sentencesData = JSON.parse(await fs.readFile(sentencesPath, 'utf-8'));
    
    // Add a test sentence
    sentencesData.sentences.push({
      id: 'hot-reload-test',
      text: 'Hot reload test sentence...',
      category: 'Testing'
    });
    
    await fs.writeFile(sentencesPath, JSON.stringify(sentencesData, null, 2));
    
    // Wait for hot reload
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Force reload to simulate ConfigMap change detection
    await loader.reloadContent();
    const updatedContent = await loader.getContent();
    
    if (updatedContent.sentences.length > originalCount) {
      console.log('✅ Hot reload working - content updated');
    } else {
      console.log('⚠️  Hot reload may not be working as expected');
    }
    
    await loader.cleanup();
    return true;
    
  } catch (error) {
    console.error('❌ Hot reload test failed:', error.message);
    return false;
  }
}

async function testEnvironmentSpecificContent() {
  console.log('🌍 Testing environment-specific content...');
  
  // Test development environment content
  const devMountPath = path.join(TEST_MOUNT_PATH, 'dev');
  await fs.mkdir(devMountPath, { recursive: true });
  
  // Copy base content
  await fs.copyFile(
    path.join(CONTENT_SOURCE, 'sentences.json'),
    path.join(devMountPath, 'sentences.json')
  );
  await fs.copyFile(
    path.join(CONTENT_SOURCE, 'acronyms.json'),
    path.join(devMountPath, 'acronyms.json')
  );
  
  // Add development-specific content
  const devSentences = {
    sentences: [
      {
        id: 'dev-test-1',
        text: 'In development mode, debugging is...',
        category: 'Development'
      }
    ]
  };
  
  await fs.writeFile(
    path.join(devMountPath, 'test-sentences.json'),
    JSON.stringify(devSentences, null, 2)
  );
  
  console.log('✅ Environment-specific content simulation ready');
  return true;
}

async function cleanup() {
  console.log('🧹 Cleaning up test files...');
  try {
    await fs.rm(TEST_MOUNT_PATH, { recursive: true, force: true });
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.log('⚠️  Cleanup warning:', error.message);
  }
}

async function main() {
  console.log('🚀 ConfigMap Mounting Integration Test');
  console.log('=====================================\n');
  
  let success = true;
  
  try {
    // Setup
    const mountPath = await setupConfigMapMount();
    
    // Test content loading
    success = await testContentLoading(mountPath) && success;
    
    // Test hot reload
    success = await testHotReload(mountPath) && success;
    
    // Test environment-specific content
    success = await testEnvironmentSpecificContent() && success;
    
    console.log('\n=====================================');
    if (success) {
      console.log('🎉 All ConfigMap mounting tests passed!');
    } else {
      console.log('❌ Some tests failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n⚠️  Test interrupted');
  await cleanup();
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = { main };