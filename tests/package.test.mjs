import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zipPath = path.resolve('/root/fdgr/vertex-gemini-flex.zip');

test('vertex-gemini-flex.zip package exists and contains all required extension files', () => {
    assert.ok(fs.existsSync(zipPath), 'vertex-gemini-flex.zip should exist at /root/fdgr/vertex-gemini-flex.zip');

    const listing = execSync(`unzip -l "${zipPath}"`, { encoding: 'utf8' });

    assert.ok(listing.includes('manifest.json'), 'zip must contain manifest.json');
    assert.ok(listing.includes('index.js'), 'zip must contain index.js');
    assert.ok(listing.includes('settings.html'), 'zip must contain settings.html');
    assert.ok(listing.includes('style.css'), 'zip must contain style.css');
    assert.ok(listing.includes('README.md'), 'zip must contain README.md');
    assert.ok(listing.includes('src/injector.js'), 'zip must contain src/injector.js');
    assert.ok(listing.includes('src/status-resolver.js'), 'zip must contain src/status-resolver.js');
});
