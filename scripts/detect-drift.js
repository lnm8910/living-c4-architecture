#!/usr/bin/env node

/**
 * Architecture Drift Detection Script
 *
 * Compares the Structurizr DSL (source of truth) with actual code:
 * - docker-compose.yml services
 * - Service source directories
 * - Dependency alignment
 *
 * Exit codes:
 *   0 - No drift detected
 *   1 - Drift detected (details in output)
 *   2 - Script error
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const DSL_PATH = path.join(ROOT_DIR, 'architecture/workspace.dsl');
const DOCKER_COMPOSE_PATH = path.join(ROOT_DIR, 'sample-app/docker-compose.yml');

// ANSI colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

/**
 * Convert camelCase DSL identifier to kebab-case docker-compose name.
 * e.g. "apiGateway" -> "api-gateway", "userService" -> "user-service"
 */
function camelToKebab(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Parse the Structurizr DSL file to extract containers and relationships.
 *
 * Extracts:
 * - Container definitions: identifier, name, description, technology
 * - Relationships between containers (source -> target)
 */
function parseDSL() {
  let content;
  try {
    content = fs.readFileSync(DSL_PATH, 'utf8');
  } catch (error) {
    throw new Error(`Failed to load workspace.dsl: ${error.message}`);
  }

  const containers = {};
  const relationships = [];

  // Match container definitions:
  //   identifier = container "Name" "Description" "Technology" "Tag"
  // The tag is optional.
  const containerRegex = /(\w+)\s*=\s*container\s+"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"/g;
  let match;

  // Track which identifiers are data stores / infrastructure vs application containers.
  // We identify infrastructure by their DSL tags: "Database", "Queue"
  const infraIdentifiers = new Set();
  const infraTagRegex = /(\w+)\s*=\s*container\s+"[^"]+"\s+"[^"]+"\s+"[^"]+"\s+"(Database|Queue)"/g;
  while ((match = infraTagRegex.exec(content)) !== null) {
    infraIdentifiers.add(match[1]);
  }

  // Parse all containers
  while ((match = containerRegex.exec(content)) !== null) {
    const [, identifier, name, description, technology] = match;

    // Skip infrastructure containers (databases, queues) — they're not application services
    if (infraIdentifiers.has(identifier)) continue;

    const kebabName = camelToKebab(identifier);
    containers[kebabName] = {
      identifier,
      name,
      description,
      technology,
      source: `sample-app/${kebabName}`,
      dependencies: [],
    };
  }

  // Match relationships between containers:
  //   source -> target "Description"
  const relationshipRegex = /(\w+)\s*->\s*(\w+)\s+"([^"]+)"/g;
  while ((match = relationshipRegex.exec(content)) !== null) {
    const [, source, target, description] = match;
    relationships.push({ source, target, description });
  }

  // Build dependency lists from relationships.
  // A container's dependencies = everything it points to (via ->).
  // Map DSL identifiers to kebab-case for matching.
  const identifierToKebab = {};
  for (const [kebab, info] of Object.entries(containers)) {
    identifierToKebab[info.identifier] = kebab;
  }

  // Also map infrastructure identifiers to their docker-compose names
  const infraMapping = {
    postgresDb: 'postgres',
    redisCache: 'redis',
    rabbitMq: 'rabbitmq',
  };

  for (const rel of relationships) {
    const sourceKebab = identifierToKebab[rel.source];
    if (!sourceKebab) continue; // source is not an application container

    const targetKebab = identifierToKebab[rel.target] || infraMapping[rel.target];
    if (!targetKebab) continue; // target is external system, person, or unknown

    const container = containers[sourceKebab];
    if (!container.dependencies.includes(targetKebab)) {
      container.dependencies.push(targetKebab);
    }
  }

  return containers;
}

function loadDockerCompose() {
  try {
    const content = fs.readFileSync(DOCKER_COMPOSE_PATH, 'utf8');
    return yaml.parse(content);
  } catch (error) {
    throw new Error(`Failed to load docker-compose.yml: ${error.message}`);
  }
}

function extractServicesFromDockerCompose(compose) {
  const services = {};
  const infraServices = ['postgres', 'redis', 'rabbitmq', 'mailhog'];

  for (const [name, config] of Object.entries(compose.services || {})) {
    // Skip infrastructure services for this comparison
    if (infraServices.includes(name)) continue;

    services[name] = {
      build: config.build,
      ports: config.ports || [],
      dependsOn: config.depends_on || [],
      environment: config.environment || [],
    };
  }

  return services;
}

function extractDependenciesFromEnv(envVars) {
  const deps = [];
  const envArray = Array.isArray(envVars) ? envVars : [];

  for (const env of envArray) {
    if (env.includes('USER_SERVICE_URL')) deps.push('user-service');
    if (env.includes('ORDER_SERVICE_URL')) deps.push('order-service');
    if (env.includes('DATABASE_URL') || env.includes('POSTGRES')) deps.push('postgres');
    if (env.includes('REDIS_URL') || env.includes('REDIS')) deps.push('redis');
    if (env.includes('RABBITMQ_URL') || env.includes('RABBITMQ')) deps.push('rabbitmq');
  }

  return [...new Set(deps)];
}

function checkServiceExists(sourcePath) {
  const fullPath = path.join(ROOT_DIR, sourcePath);
  return fs.existsSync(fullPath);
}

function detectDrift() {
  const issues = [];
  const warnings = [];

  console.log('\n📊 Architecture Drift Detection\n');
  console.log('='.repeat(50));

  // Load sources
  const dslContainers = parseDSL();
  const compose = loadDockerCompose();
  const composeServices = extractServicesFromDockerCompose(compose);

  // 1. Check for services in DSL but not in docker-compose
  console.log('\n🔍 Checking DSL containers exist in docker-compose...\n');

  for (const [id, container] of Object.entries(dslContainers)) {
    if (!composeServices[id]) {
      issues.push(`Service "${id}" is in workspace.dsl but NOT in docker-compose.yml`);
      log(colors.red, '✗', `${container.name} (${id}) - NOT FOUND in docker-compose`);
    } else {
      log(colors.green, '✓', `${container.name} (${id}) - Found`);
    }
  }

  // 2. Check for services in docker-compose but not in DSL
  console.log('\n🔍 Checking docker-compose services exist in DSL...\n');

  for (const serviceId of Object.keys(composeServices)) {
    if (!dslContainers[serviceId]) {
      issues.push(`Service "${serviceId}" is in docker-compose but NOT in workspace.dsl`);
      log(colors.red, '✗', `${serviceId} - NOT FOUND in DSL (undocumented service!)`);
    } else {
      log(colors.green, '✓', `${serviceId} - Documented`);
    }
  }

  // 3. Check source directories exist
  console.log('\n🔍 Checking source directories exist...\n');

  for (const [id, container] of Object.entries(dslContainers)) {
    const exists = checkServiceExists(container.source);
    if (!exists) {
      issues.push(`Source directory "${container.source}" for "${id}" does not exist`);
      log(colors.red, '✗', `${id}: ${container.source} - MISSING`);
    } else {
      log(colors.green, '✓', `${id}: ${container.source} - Exists`);
    }
  }

  // 4. Check dependency alignment
  console.log('\n🔍 Checking service dependencies...\n');

  for (const [id, composeService] of Object.entries(composeServices)) {
    const dslContainer = dslContainers[id];
    if (!dslContainer) continue;

    const composeDeps = [
      ...composeService.dependsOn,
      ...extractDependenciesFromEnv(composeService.environment),
    ].filter((d, i, arr) => arr.indexOf(d) === i); // unique

    const dslDeps = dslContainer.dependencies || [];

    // Check for deps in code but not documented
    for (const dep of composeDeps) {
      const normalizedDep = dep.replace(/-/g, '');
      const dslHasDep = dslDeps.some(
        (d) => d.replace(/-/g, '').toLowerCase() === normalizedDep.toLowerCase()
      );

      if (!dslHasDep) {
        warnings.push(`${id} depends on "${dep}" in code but not documented in DSL`);
        log(colors.yellow, '⚠', `${id}: undocumented dependency on "${dep}"`);
      }
    }

    // Check for documented deps not in code
    for (const dep of dslDeps) {
      const normalizedDep = dep.replace(/-/g, '');
      const codeHasDep = composeDeps.some(
        (d) => d.replace(/-/g, '').toLowerCase() === normalizedDep.toLowerCase()
      );

      if (!codeHasDep && !['email-provider', 'payment-gateway'].includes(dep)) {
        warnings.push(`${id} documents dependency on "${dep}" but not found in code`);
        log(colors.yellow, '⚠', `${id}: documented dependency "${dep}" not found in code`);
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📋 Summary\n');

  if (issues.length === 0 && warnings.length === 0) {
    log(colors.green, '✓', 'No drift detected! Architecture is in sync.');
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

  return issues.length > 0 ? 1 : 0;
}

// Run
try {
  const exitCode = detectDrift();
  process.exit(exitCode);
} catch (error) {
  console.error(`${colors.red}Error:${colors.reset} ${error.message}`);
  process.exit(2);
}
