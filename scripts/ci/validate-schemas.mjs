#!/usr/bin/env node
/**
 * Validate example JSON files against JSON Schemas in packages/cli/schemas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use Ajv from the CLI package to avoid adding a root dependency
const requireCli = createRequire(path.resolve(__dirname, '../../packages/cli/package.json'));
const Ajv = requireCli('ajv').default;

const schemasDir = path.resolve(__dirname, '../../packages/cli/schemas');
const examplesDir = path.join(schemasDir, 'examples');

/** @returns {string[]} */
function list(dir) { return fs.existsSync(dir) ? fs.readdirSync(dir).map(f => path.join(dir, f)) : []; }

const schemaFiles = list(schemasDir).filter(p => /\.schema\.json$/i.test(p));
const exampleFiles = list(examplesDir).filter(p => /\.json$/i.test(p));

if (schemaFiles.length === 0) {
  console.warn('[ci:validate-schemas] No schema files found');
  process.exit(0);
}

const ajv = new Ajv({ allErrors: true, strict: false });
let failures = 0;

for (const schPath of schemaFiles) {
  const schRaw = fs.readFileSync(schPath, 'utf8');
  const schema = JSON.parse(schRaw);
  const base = path.basename(schPath).replace(/\.schema\.json$/i, '');
  const validate = ajv.compile(schema);
  const matches = exampleFiles.filter(f => path.basename(f).startsWith(base));
  if (matches.length === 0) {
    console.warn(`[ci:validate-schemas] No examples for schema ${base}`);
    continue;
  }
  for (const exPath of matches) {
    const exRaw = fs.readFileSync(exPath, 'utf8');
    const data = JSON.parse(exRaw);
    const ok = validate(data);
    if (!ok) {
      failures++;
      console.error(`\n[ci:validate-schemas] ${path.basename(exPath)} failed against ${path.basename(schPath)}`);
      console.error(ajv.errorsText(validate.errors, { separator: '\n - ' }));
    } else {
      console.log(`[ci:validate-schemas] OK: ${path.basename(exPath)} -> ${path.basename(schPath)}`);
    }
  }
}

process.exit(failures === 0 ? 0 : 1);
