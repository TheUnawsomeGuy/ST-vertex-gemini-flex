import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

test('manifest.json has required fields and valid types', () => {
    const manifestPath = path.join(rootDir, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json should exist');
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(typeof content.display_name, 'string');
    assert.equal(typeof content.js, 'string');
    assert.equal(typeof content.version, 'string');
    assert.equal(typeof content.description, 'string');
    assert.equal(content.js, 'index.js');
    assert.equal(content.css, 'style.css');
    assert.ok(Array.isArray(content.requires));
    assert.ok(Array.isArray(content.optional));
});

test('README.md exists and contains installation instructions', () => {
    const readmePath = path.join(rootDir, 'README.md');
    assert.ok(fs.existsSync(readmePath), 'README.md should exist');
    const content = fs.readFileSync(readmePath, 'utf8');
    assert.ok(content.includes('Vertex AI'));
    assert.ok(content.includes('Flex'));
});
