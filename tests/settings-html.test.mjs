import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

test('settings.html exists and has required control inputs', () => {
    const htmlPath = path.join(rootDir, 'settings.html');
    assert.ok(fs.existsSync(htmlPath), 'settings.html should exist');
    const content = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(content.includes('id="vertex_gemini_flex_enabled"'), 'should have enabled toggle');
    assert.ok(content.includes('id="vertex_gemini_flex_tier"'), 'should have tier select');
    assert.ok(content.includes('value="flex"'), 'should have flex tier option');
    assert.ok(content.includes('value="priority"'), 'should have priority tier option');
    assert.ok(content.includes('id="vertex_gemini_flex_force_global"'), 'should have force global toggle');
    assert.ok(content.includes('id="vertex_gemini_flex_show_api_card"'), 'should have show api card toggle');
    assert.ok(content.includes('50%'), 'should mention 50% discount');
});

test('style.css exists and defines card, badge, and animation classes', () => {
    const cssPath = path.join(rootDir, 'style.css');
    assert.ok(fs.existsSync(cssPath), 'style.css should exist');
    const content = fs.readFileSync(cssPath, 'utf8');

    assert.ok(content.includes('.vertex-flex-status-card'), 'should have status card class');
    assert.ok(content.includes('.vertex-flex-badge'), 'should have badge class');
    assert.ok(content.includes('.vertex-flex-badge.active'), 'should have active badge style');
    assert.ok(content.includes('.vertex-flex-badge.standby'), 'should have standby badge style');
    assert.ok(content.includes('.vertex-flex-badge.disabled'), 'should have disabled badge style');
    assert.ok(content.includes('.vertex-flex-quick-toggle'), 'should have quick toggle class');
});
