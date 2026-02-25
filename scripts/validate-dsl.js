#!/usr/bin/env node

/**
 * Structurizr DSL Validator
 *
 * Basic validation of the workspace.dsl file:
 * - Syntax structure checks
 * - Reference validation (containers referenced in relationships exist)
 * - Required elements present
 *
 * For full validation, use Structurizr CLI or Structurizr Lite.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DSL_PATH = path.join(ROOT_DIR, 'architecture/workspace.dsl');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

function validateDsl() {
  console.log('\n🔍 Validating Structurizr DSL\n');
  console.log('='.repeat(50));

  const issues = [];
  const warnings = [];

  // Load DSL file
  let content;
  try {
    content = fs.readFileSync(DSL_PATH, 'utf8');
    log(colors.green, '✓', 'workspace.dsl file found');
  } catch (error) {
    log(colors.red, '✗', `Cannot read workspace.dsl: ${error.message}`);
    return 1;
  }

  // Check for required sections
  console.log('\n📋 Checking required sections...\n');

  const requiredSections = [
    { pattern: /workspace\s+"[^"]+"\s+"[^"]+"/, name: 'Workspace declaration' },
    { pattern: /model\s*\{/, name: 'Model section' },
    { pattern: /views\s*\{/, name: 'Views section' },
    { pattern: /softwareSystem\s+"[^"]+"/, name: 'Software system definition' },
    { pattern: /container\s+"[^"]+"/, name: 'Container definitions' },
    { pattern: /systemContext\s+\w+/, name: 'System context view' },
    { pattern: /container\s+\w+\s+"[^"]+"/, name: 'Container view' },
  ];

  for (const section of requiredSections) {
    if (section.pattern.test(content)) {
      log(colors.green, '✓', section.name);
    } else {
      issues.push(`Missing: ${section.name}`);
      log(colors.red, '✗', section.name);
    }
  }

  // Extract defined elements
  console.log('\n📋 Extracting defined elements...\n');

  const personPattern = /(\w+)\s*=\s*person\s+"([^"]+)"/g;
  const systemPattern = /(\w+)\s*=\s*softwareSystem\s+"([^"]+)"/g;
  const containerPattern = /(\w+)\s*=\s*container\s+"([^"]+)"/g;
  const componentPattern = /(\w+)\s*=\s*component\s+"([^"]+)"/g;

  const elements = new Map();

  let match;
  while ((match = personPattern.exec(content)) !== null) {
    elements.set(match[1], { type: 'person', name: match[2] });
  }
  while ((match = systemPattern.exec(content)) !== null) {
    elements.set(match[1], { type: 'softwareSystem', name: match[2] });
  }
  while ((match = containerPattern.exec(content)) !== null) {
    elements.set(match[1], { type: 'container', name: match[2] });
  }
  while ((match = componentPattern.exec(content)) !== null) {
    elements.set(match[1], { type: 'component', name: match[2] });
  }

  console.log(`Found ${elements.size} elements:`);
  const typeCounts = {};
  for (const [id, el] of elements) {
    typeCounts[el.type] = (typeCounts[el.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`  • ${type}: ${count}`);
  }

  // Check relationships reference valid elements
  console.log('\n📋 Validating relationships...\n');

  const relationshipPattern = /(\w+)\s*->\s*(\w+)\s+"([^"]+)"/g;
  let relationshipCount = 0;
  let validRelationships = 0;

  while ((match = relationshipPattern.exec(content)) !== null) {
    relationshipCount++;
    const [, source, target, description] = match;

    // Check if source and target exist (allowing for hierarchical references)
    const sourceExists = elements.has(source) || source.includes('.');
    const targetExists = elements.has(target) || target.includes('.');

    if (!sourceExists) {
      warnings.push(`Relationship source "${source}" not found as top-level element`);
    }
    if (!targetExists) {
      warnings.push(`Relationship target "${target}" not found as top-level element`);
    }
    if (sourceExists && targetExists) {
      validRelationships++;
    }
  }

  log(
    validRelationships === relationshipCount ? colors.green : colors.yellow,
    validRelationships === relationshipCount ? '✓' : '⚠',
    `${validRelationships}/${relationshipCount} relationships validated`
  );

  // Check for styles
  console.log('\n📋 Checking styling...\n');

  const stylePattern = /styles\s*\{[\s\S]*?element\s+"([^"]+)"/g;
  const styles = [];
  while ((match = stylePattern.exec(content)) !== null) {
    styles.push(match[1]);
  }

  if (styles.length > 0) {
    log(colors.green, '✓', `Found styles for: ${styles.join(', ')}`);
  } else {
    warnings.push('No element styles defined');
    log(colors.yellow, '⚠', 'No element styles defined');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📋 Validation Summary\n');

  if (issues.length === 0 && warnings.length === 0) {
    log(colors.green, '✓', 'DSL validation passed!');
    return 0;
  }

  if (issues.length > 0) {
    console.log(`${colors.red}Errors (${issues.length}):${colors.reset}`);
    issues.forEach((issue) => console.log(`  • ${issue}`));
  }

  if (warnings.length > 0) {
    console.log(`\n${colors.yellow}Warnings (${warnings.length}):${colors.reset}`);
    warnings.forEach((warning) => console.log(`  • ${warning}`));
  }

  console.log('');
  console.log('💡 For full validation, run: structurizr-cli validate -w architecture/workspace.dsl');
  console.log('');

  return issues.length > 0 ? 1 : 0;
}

try {
  const exitCode = validateDsl();
  process.exit(exitCode);
} catch (error) {
  console.error(`${colors.red}Error:${colors.reset} ${error.message}`);
  process.exit(2);
}
