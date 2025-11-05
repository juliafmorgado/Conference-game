#!/usr/bin/env node

/**
 * ConfigMap Functionality Test Script
 * Tests ConfigMap integration, content loading, and category filtering
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// Test configuration
const TEST_CONFIG = {
  testDir: path.join(__dirname, '..', 'test-configmap-content'),
  backendPort: 3001,
  testTimeout: 30000
};

// Test content
const TEST_SENTENCES = {
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
    },
    {
      id: 'test-culture-1',
      text: 'Team culture affects...',
      category: 'Culture'
    }
  ]
};

const TEST_ACRONYMS = {
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

// Utility functions
function makeRequest(path, port = TEST_CONFIG.backendPort) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function waitForServer(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await makeRequest('/health', port);
      return true;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

// Test functions
async function setupTestContent() {
  console.log('📁 Setting up test content...');
  
  await fs.mkdir(TEST_CONFIG.testDir, { recursive: true });
  
  await fs.writeFile(
    path.join(TEST_CONFIG.testDir, 'sentences.json'),
    JSON.stringify(TEST_SENTENCES, null, 2)
  );
  
  await fs.writeFile(
    path.join(TEST_CONFIG.testDir, 'acronyms.json'),
    JSON.stringify(TEST_ACRONYMS, null, 2)
  );
  
  console.log('✅ Test content created');
}

async function testContentLoading() {
  console.log('\n🔍 Testing content loading...');
  
  try {
    // Test sentences endpoint
    const sentencesResponse = await makeRequest('/api/sentences');
    
    if (sentencesResponse.status !== 200) {
      throw new Error(`Sentences endpoint returned status ${sentencesResponse.status}`);
    }
    
    const { data: sentences, pagination, categories } = sentencesResponse.data;
    
    if (!Array.isArray(sentences) || sentences.length === 0) {
      throw new Error('No sentences loaded');
    }
    
    if (pagination.total !== sentences.length) {
      throw new Error(`Total count mismatch: expected ${sentences.length}, got ${pagination.total}`);
    }
    
    if (!Array.isArray(categories) || categories.length === 0) {
      throw new Error('No categories loaded');
    }
    
    console.log(`✅ Sentences loaded: ${sentences.length} sentences, ${categories.length} categories`);
    
    // Test acronyms endpoint
    const acronymsResponse = await makeRequest('/api/acronyms');
    
    if (acronymsResponse.status !== 200) {
      throw new Error(`Acronyms endpoint returned status ${acronymsResponse.status}`);
    }
    
    const { data: acronyms } = acronymsResponse.data;
    
    if (!Array.isArray(acronyms) || acronyms.length === 0) {
      throw new Error('No acronyms loaded');
    }
    
    console.log(`✅ Acronyms loaded: ${acronyms.length} acronyms`);
    
    return { sentences, acronyms, categories };
    
  } catch (error) {
    console.log(`❌ Content loading failed: ${error.message}`);
    throw error;
  }
}

async function testCategoryFiltering(categories) {
  console.log('\n🔍 Testing category filtering...');
  
  try {
    for (const category of categories) {
      const response = await makeRequest(`/api/sentences?category=${encodeURIComponent(category)}`);
      
      if (response.status !== 200) {
        throw new Error(`Category filtering failed for ${category}: status ${response.status}`);
      }
      
      const { data: sentences } = response.data;
      
      if (!Array.isArray(sentences)) {
        throw new Error(`Invalid response for category ${category}`);
      }
      
      // Verify all sentences belong to the requested category
      const allMatch = sentences.every(sentence => sentence.category === category);
      
      if (!allMatch) {
        throw new Error(`Category filtering failed: some sentences don't match category ${category}`);
      }
      
      console.log(`✅ Category filtering works for ${category}: ${sentences.length} sentences`);
    }
    
    // Test invalid category
    const invalidResponse = await makeRequest('/api/sentences?category=InvalidCategory');
    
    if (invalidResponse.status !== 200) {
      throw new Error(`Invalid category test failed: status ${invalidResponse.status}`);
    }
    
    const { data: invalidSentences } = invalidResponse.data;
    
    if (invalidSentences.length !== 0) {
      throw new Error('Invalid category should return empty results');
    }
    
    console.log('✅ Invalid category returns empty results');
    
  } catch (error) {
    console.log(`❌ Category filtering failed: ${error.message}`);
    throw error;
  }
}

async function testHealthCheck() {
  console.log('\n🏥 Testing health check...');
  
  try {
    const response = await makeRequest('/health');
    
    if (response.status !== 200) {
      throw new Error(`Health check failed: status ${response.status}`);
    }
    
    const { status } = response.data;
    
    if (status !== 'healthy') {
      throw new Error(`Health check failed: status is ${status}`);
    }
    
    console.log('✅ Health check passed');
    
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    throw error;
  }
}

async function testContentValidation() {
  console.log('\n📋 Testing content validation...');
  
  try {
    // Validate actual content files
    const backendSentences = JSON.parse(
      await fs.readFile(path.join(__dirname, '..', 'backend', 'content', 'sentences.json'), 'utf8')
    );
    
    const backendAcronyms = JSON.parse(
      await fs.readFile(path.join(__dirname, '..', 'backend', 'content', 'acronyms.json'), 'utf8')
    );
    
    const helmSentences = JSON.parse(
      await fs.readFile(path.join(__dirname, '..', 'helm', 'conference-games', 'content', 'sentences.json'), 'utf8')
    );
    
    const helmAcronyms = JSON.parse(
      await fs.readFile(path.join(__dirname, '..', 'helm', 'conference-games', 'content', 'acronyms.json'), 'utf8')
    );
    
    // Validate structure
    if (!Array.isArray(backendSentences.sentences)) {
      throw new Error('Backend sentences.json has invalid structure');
    }
    
    if (!Array.isArray(backendAcronyms.acronyms)) {
      throw new Error('Backend acronyms.json has invalid structure');
    }
    
    if (!Array.isArray(helmSentences.sentences)) {
      throw new Error('Helm sentences.json has invalid structure');
    }
    
    if (!Array.isArray(helmAcronyms.acronyms)) {
      throw new Error('Helm acronyms.json has invalid structure');
    }
    
    // Validate content synchronization
    if (backendSentences.sentences.length !== helmSentences.sentences.length) {
      throw new Error('Backend and Helm sentences count mismatch');
    }
    
    if (backendAcronyms.acronyms.length !== helmAcronyms.acronyms.length) {
      throw new Error('Backend and Helm acronyms count mismatch');
    }
    
    console.log(`✅ Content validation passed:`);
    console.log(`   - ${backendSentences.sentences.length} sentences`);
    console.log(`   - ${backendAcronyms.acronyms.length} acronyms`);
    console.log(`   - Backend and Helm content synchronized`);
    
  } catch (error) {
    console.log(`❌ Content validation failed: ${error.message}`);
    throw error;
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up...');
  
  try {
    await fs.rm(TEST_CONFIG.testDir, { recursive: true, force: true });
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.log(`⚠️  Cleanup warning: ${error.message}`);
  }
}

// Main test execution
async function main() {
  console.log('🚀 ConfigMap Functionality Tests');
  console.log('================================');
  
  try {
    // Setup
    await setupTestContent();
    
    // Content validation (doesn't require running server)
    await testContentValidation();
    
    // Check if backend server is running
    console.log('\n🔍 Checking if backend server is running...');
    const serverRunning = await waitForServer(TEST_CONFIG.backendPort, 3);
    
    if (!serverRunning) {
      console.log('⚠️  Backend server not running on port', TEST_CONFIG.backendPort);
      console.log('   To test API endpoints, start the backend server:');
      console.log('   cd backend && npm run dev');
      console.log('');
      console.log('✅ Content validation tests completed successfully');
      return 0;
    }
    
    console.log('✅ Backend server is running');
    
    // API tests
    const { categories } = await testContentLoading();
    await testCategoryFiltering(categories);
    await testHealthCheck();
    
    console.log('\n🎉 All ConfigMap functionality tests passed!');
    return 0;
    
  } catch (error) {
    console.log(`\n❌ Tests failed: ${error.message}`);
    return 1;
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

// Run tests
main().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});