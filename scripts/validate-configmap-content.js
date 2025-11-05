#!/usr/bin/env node

/**
 * ConfigMap Content Validation Script
 * Validates the structure and content of game content files
 */

const fs = require('fs');
const path = require('path');

// Validation schemas
const sentenceSchema = {
  id: 'string',
  text: 'string',
  category: 'string'
};

const acronymSchema = {
  id: 'string',
  term: 'string',
  meaning: 'string'
};

// Expected categories
const expectedCategories = ['Kubernetes', 'DevOps', 'Observability', 'Culture'];

// Validation functions
function validateObject(obj, schema, name) {
  const errors = [];
  
  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in obj)) {
      errors.push(`${name}: Missing required field '${key}'`);
    } else if (typeof obj[key] !== expectedType) {
      errors.push(`${name}: Field '${key}' should be ${expectedType}, got ${typeof obj[key]}`);
    } else if (expectedType === 'string' && obj[key].trim() === '') {
      errors.push(`${name}: Field '${key}' cannot be empty`);
    }
  }
  
  return errors;
}

function validateSentences(sentences) {
  const errors = [];
  const ids = new Set();
  const categoryCount = {};
  
  if (!Array.isArray(sentences)) {
    return ['Sentences must be an array'];
  }
  
  sentences.forEach((sentence, index) => {
    const sentenceErrors = validateObject(sentence, sentenceSchema, `Sentence ${index + 1}`);
    errors.push(...sentenceErrors);
    
    // Check for duplicate IDs
    if (sentence.id) {
      if (ids.has(sentence.id)) {
        errors.push(`Duplicate sentence ID: ${sentence.id}`);
      }
      ids.add(sentence.id);
    }
    
    // Count categories
    if (sentence.category) {
      categoryCount[sentence.category] = (categoryCount[sentence.category] || 0) + 1;
    }
    
    // Validate sentence text ends with appropriate punctuation
    if (sentence.text && !sentence.text.match(/[.!?…]$/)) {
      errors.push(`Sentence ${index + 1}: Text should end with punctuation`);
    }
  });
  
  // Check category distribution
  for (const category of expectedCategories) {
    if (!categoryCount[category]) {
      errors.push(`Missing sentences for category: ${category}`);
    } else if (categoryCount[category] < 5) {
      errors.push(`Category '${category}' has only ${categoryCount[category]} sentences (recommended: at least 5)`);
    }
  }
  
  return { errors, stats: { total: sentences.length, categories: categoryCount } };
}

function validateAcronyms(acronyms) {
  const errors = [];
  const ids = new Set();
  const terms = new Set();
  
  if (!Array.isArray(acronyms)) {
    return ['Acronyms must be an array'];
  }
  
  acronyms.forEach((acronym, index) => {
    const acronymErrors = validateObject(acronym, acronymSchema, `Acronym ${index + 1}`);
    errors.push(...acronymErrors);
    
    // Check for duplicate IDs
    if (acronym.id) {
      if (ids.has(acronym.id)) {
        errors.push(`Duplicate acronym ID: ${acronym.id}`);
      }
      ids.add(acronym.id);
    }
    
    // Check for duplicate terms
    if (acronym.term) {
      const normalizedTerm = acronym.term.toUpperCase();
      if (terms.has(normalizedTerm)) {
        errors.push(`Duplicate acronym term: ${acronym.term}`);
      }
      terms.add(normalizedTerm);
    }
    
    // Validate term format (should be uppercase, with some exceptions)
    const mixedCaseExceptions = ['K8s', 'IaC', 'GitOps', 'gRPC', 'OAuth', 'NoSQL'];
    if (acronym.term && 
        acronym.term !== acronym.term.toUpperCase() && 
        !mixedCaseExceptions.includes(acronym.term)) {
      errors.push(`Acronym ${index + 1}: Term '${acronym.term}' should be uppercase`);
    }
  });
  
  return { errors, stats: { total: acronyms.length } };
}

function validateContentFile(filePath, type) {
  console.log(`\n📋 Validating ${type}: ${filePath}`);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    let data;
    
    try {
      data = JSON.parse(content);
    } catch (parseError) {
      console.log(`❌ Invalid JSON: ${parseError.message}`);
      return false;
    }
    
    let result;
    if (type === 'sentences') {
      if (!data.sentences) {
        console.log(`❌ Missing 'sentences' array in file`);
        return false;
      }
      result = validateSentences(data.sentences);
    } else if (type === 'acronyms') {
      if (!data.acronyms) {
        console.log(`❌ Missing 'acronyms' array in file`);
        return false;
      }
      result = validateAcronyms(data.acronyms);
    }
    
    if (result.errors.length > 0) {
      console.log(`❌ Validation errors found:`);
      result.errors.forEach(error => console.log(`   • ${error}`));
      return false;
    } else {
      console.log(`✅ Validation passed`);
      if (result.stats) {
        console.log(`📊 Stats:`, result.stats);
      }
      return true;
    }
    
  } catch (error) {
    console.log(`❌ Error validating file: ${error.message}`);
    return false;
  }
}

function validateAllContent() {
  console.log('🔍 ConfigMap Content Validation');
  console.log('================================');
  
  const contentPaths = [
    { path: 'backend/content/sentences.json', type: 'sentences' },
    { path: 'backend/content/acronyms.json', type: 'acronyms' },
    { path: 'helm/conference-games/content/sentences.json', type: 'sentences' },
    { path: 'helm/conference-games/content/acronyms.json', type: 'acronyms' }
  ];
  
  let allValid = true;
  
  for (const { path: filePath, type } of contentPaths) {
    const isValid = validateContentFile(filePath, type);
    allValid = allValid && isValid;
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allValid) {
    console.log('🎉 All content files are valid!');
    return 0;
  } else {
    console.log('❌ Some content files have validation errors');
    return 1;
  }
}

// Cross-validation between backend and helm content
function crossValidateContent() {
  console.log('\n🔄 Cross-validating backend and helm content...');
  
  try {
    const backendSentences = JSON.parse(fs.readFileSync('backend/content/sentences.json', 'utf8'));
    const helmSentences = JSON.parse(fs.readFileSync('helm/conference-games/content/sentences.json', 'utf8'));
    
    const backendAcronyms = JSON.parse(fs.readFileSync('backend/content/acronyms.json', 'utf8'));
    const helmAcronyms = JSON.parse(fs.readFileSync('helm/conference-games/content/acronyms.json', 'utf8'));
    
    // Compare sentences
    const backendSentenceIds = new Set(backendSentences.sentences.map(s => s.id));
    const helmSentenceIds = new Set(helmSentences.sentences.map(s => s.id));
    
    const sentenceDiff = [...backendSentenceIds].filter(id => !helmSentenceIds.has(id));
    if (sentenceDiff.length > 0) {
      console.log(`❌ Sentence ID mismatch between backend and helm: ${sentenceDiff.join(', ')}`);
      return false;
    }
    
    // Compare acronyms
    const backendAcronymIds = new Set(backendAcronyms.acronyms.map(a => a.id));
    const helmAcronymIds = new Set(helmAcronyms.acronyms.map(a => a.id));
    
    const acronymDiff = [...backendAcronymIds].filter(id => !helmAcronymIds.has(id));
    if (acronymDiff.length > 0) {
      console.log(`❌ Acronym ID mismatch between backend and helm: ${acronymDiff.join(', ')}`);
      return false;
    }
    
    console.log('✅ Backend and helm content are synchronized');
    return true;
    
  } catch (error) {
    console.log(`❌ Error during cross-validation: ${error.message}`);
    return false;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('ConfigMap Content Validation Script');
    console.log('');
    console.log('Usage: node validate-configmap-content.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --cross-validate    Also validate content synchronization between backend and helm');
    console.log('  --help, -h          Show this help message');
    return 0;
  }
  
  const exitCode = validateAllContent();
  
  if (args.includes('--cross-validate')) {
    const crossValid = crossValidateContent();
    if (!crossValid) {
      return 1;
    }
  }
  
  return exitCode;
}

// Run the script
process.exit(main());