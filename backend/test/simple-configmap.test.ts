/**
 * Simple ConfigMap Integration Test
 */

import fs from 'fs/promises';
import path from 'path';

describe('Simple ConfigMap Test', () => {
  const testDir = path.join(__dirname, 'fixtures', 'simple-test');
  
  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test content files
    const sentences = {
      sentences: [
        { id: 'test-1', text: 'Test sentence...', category: 'Test' }
      ]
    };
    
    const acronyms = {
      acronyms: [
        { id: 'test-1', term: 'TEST', meaning: 'Test Acronym' }
      ]
    };
    
    await fs.writeFile(
      path.join(testDir, 'sentences.json'),
      JSON.stringify(sentences, null, 2)
    );
    
    await fs.writeFile(
      path.join(testDir, 'acronyms.json'),
      JSON.stringify(acronyms, null, 2)
    );
  });
  
  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  it('should read test content files', async () => {
    const sentencesContent = await fs.readFile(path.join(testDir, 'sentences.json'), 'utf8');
    const acronymsContent = await fs.readFile(path.join(testDir, 'acronyms.json'), 'utf8');
    
    const sentences = JSON.parse(sentencesContent);
    const acronyms = JSON.parse(acronymsContent);
    
    expect(sentences.sentences).toHaveLength(1);
    expect(sentences.sentences[0]?.id).toBe('test-1');
    
    expect(acronyms.acronyms).toHaveLength(1);
    expect(acronyms.acronyms[0]?.id).toBe('test-1');
  });
});