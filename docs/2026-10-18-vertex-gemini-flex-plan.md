# Vertex AI Gemini Flex Mode Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone, TauriTavern/SillyTavern compatible third-party extension (`vertex-gemini-flex`) that injects Google Vertex AI Flex PayGo headers (50% token cost reduction) and enforces the `global` location endpoint for both Express Mode (API Key) and Full Mode (Service Account JSON), featuring an inline live status card and quick toggle directly in the Vertex AI API settings drawer.

**Architecture:** A lightweight client-side third-party extension listening to `event_types.CHAT_COMPLETION_SETTINGS_READY` and backed by a secondary `window.fetch` guard. It non-destructively parses and merges `custom_include_headers` with `X-Vertex-AI-LLM-Request-Type: shared` and `X-Vertex-AI-LLM-Shared-Request-Type: flex` (or `priority`) and updates `vertexai_region = 'global'` for Gemini models on Vertex AI, while safely skipping Claude-on-Vertex models.

**Tech Stack:** JavaScript (ES modules, jQuery, SillyTavern / TauriTavern Extension API), CSS3, Node.js (test runner `node:test`).

**Spec:** `/root/fdgr/vertex-gemini-flex/docs/design-spec.md`

## Global Constraints
- Target directory: `/root/fdgr/vertex-gemini-flex/`
- Zero modification to files inside `/root/fdgr/TauriTavern/` (must remain clean and uncontaminated).
- Compatibility with both TauriTavern (Rust backend) and standard SillyTavern (Node backend).
- Must preserve any existing user-configured `custom_include_headers` (parse JSON/YAML before injecting).
- Must only inject into Vertex AI Gemini models; must skip Anthropic Claude models on Vertex.

## Review Focus
1. Non-Gemini model on Vertex AI (`claude-sonnet-...`): must pass through with zero injected headers and untouched region.
2. Pre-existing custom headers (e.g. `{"X-Custom": "val"}`): must merge cleanly without overwriting the existing custom headers.
3. Disabled state: when extension is toggled off, all generation payloads must pass through completely untouched.
4. Tier switching (`priority` vs `flex`): must correctly inject `X-Vertex-AI-LLM-Shared-Request-Type: priority` or `flex`.
5. Missing DOM elements: if the API drawer or `#vertexai_form` has not yet rendered or is dynamically toggled, UI observers must not throw exceptions.

---

### Task 1: Scaffolding, `manifest.json`, and Documentation

**Files:**
- Create: `/root/fdgr/vertex-gemini-flex/manifest.json`
- Create: `/root/fdgr/vertex-gemini-flex/README.md`
- Test: `/root/fdgr/vertex-gemini-flex/tests/manifest.test.mjs`

**Interfaces:**
- Produces: Valid SillyTavern/TauriTavern extension manifest structure.

- [ ] **Step 1: Write test for manifest validation**
```javascript
// tests/manifest.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('manifest.json has required fields and valid types', () => {
    const manifestPath = path.resolve('manifest.json');
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(typeof content.display_name, 'string');
    assert.equal(typeof content.js, 'string');
    assert.equal(typeof content.version, 'string');
    assert.equal(typeof content.description, 'string');
    assert.equal(content.js, 'index.js');
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test /root/fdgr/vertex-gemini-flex/tests/manifest.test.mjs`
Expected: FAIL (file not found).

- [ ] **Step 3: Create `manifest.json` and `README.md`**
Create `/root/fdgr/vertex-gemini-flex/manifest.json`:
```json
{
    "display_name": "Vertex AI Gemini Flex Mode",
    "loading_order": 50,
    "requires": [],
    "optional": [],
    "js": "index.js",
    "css": "style.css",
    "author": "TheUnawsomeGuy",
    "version": "1.0.0",
    "description": "Injects Gemini Flex Mode (Flex PayGo tier with 50% discount) into Google Vertex AI requests.",
    "homePage": "https://github.com/TheUnawsomeGuy"
}
```
Create `/root/fdgr/vertex-gemini-flex/README.md` with complete installation and usage instructions.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test /root/fdgr/vertex-gemini-flex/tests/manifest.test.mjs`
Expected: PASS.

---

### Task 2: Core Payload Injection & Header Engine

**Files:**
- Create: `/root/fdgr/vertex-gemini-flex/src/injector.js`
- Test: `/root/fdgr/vertex-gemini-flex/tests/injector.test.mjs`

**Interfaces:**
- Produces:
  - `isGeminiModel(model: string): boolean`
  - `shouldInjectFlex(payload: object, settings: object): boolean`
  - `injectFlexParameters(payload: object, settings: object): object`

- [ ] **Step 1: Write the failing test for injector functions**
```javascript
// tests/injector.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { isGeminiModel, shouldInjectFlex, injectFlexParameters } from '../src/injector.js';

test('isGeminiModel correctly identifies Gemini vs Claude models', () => {
    assert.equal(isGeminiModel('gemini-3.8-flash'), true);
    assert.equal(isGeminiModel('gemini-2.5-pro'), true);
    assert.equal(isGeminiModel('claude-sonnet-4-5@20250929'), false);
    assert.equal(isGeminiModel('claude-opus-5'), false);
});

test('injectFlexParameters injects flex headers and sets global region', () => {
    const payload = {
        chat_completion_source: 'vertexai',
        model: 'gemini-3.8-flash',
        vertexai_region: 'us-central1',
        custom_include_headers: JSON.stringify({ 'X-Existing': '123' })
    };
    const settings = { enabled: true, tier: 'flex', force_global_region: true };
    injectFlexParameters(payload, settings);
    assert.equal(payload.vertexai_region, 'global');
    const headers = JSON.parse(payload.custom_include_headers);
    assert.equal(headers['X-Existing'], '123');
    assert.equal(headers['X-Vertex-AI-LLM-Request-Type'], 'shared');
    assert.equal(headers['X-Vertex-AI-LLM-Shared-Request-Type'], 'flex');
});

test('injectFlexParameters respects priority tier', () => {
    const payload = {
        chat_completion_source: 'vertexai',
        model: 'gemini-2.5-pro',
        vertexai_region: 'us-central1',
    };
    const settings = { enabled: true, tier: 'priority', force_global_region: true };
    injectFlexParameters(payload, settings);
    const headers = JSON.parse(payload.custom_include_headers);
    assert.equal(headers['X-Vertex-AI-LLM-Shared-Request-Type'], 'priority');
});

test('shouldInjectFlex returns false for Claude or non-Vertex sources', () => {
    const settings = { enabled: true };
    assert.equal(shouldInjectFlex({ chat_completion_source: 'openai', model: 'gpt-4o' }, settings), false);
    assert.equal(shouldInjectFlex({ chat_completion_source: 'vertexai', model: 'claude-sonnet-4-5' }, settings), false);
    assert.equal(shouldInjectFlex({ chat_completion_source: 'vertexai', model: 'gemini-3.8-flash' }, { enabled: false }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test /root/fdgr/vertex-gemini-flex/tests/injector.test.mjs`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement `src/injector.js`**
Write clean, well-tested logic handling JSON/YAML custom header preservation, model detection, and parameter injection.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test /root/fdgr/vertex-gemini-flex/tests/injector.test.mjs`
Expected: PASS.

---

### Task 3: Extension Settings Template & Styling

**Files:**
- Create: `/root/fdgr/vertex-gemini-flex/settings.html`
- Create: `/root/fdgr/vertex-gemini-flex/style.css`
- Test: `/root/fdgr/vertex-gemini-flex/tests/settings-html.test.mjs`

**Interfaces:**
- Produces: HTML template and styling for extension settings panel and API drawer card.

- [ ] **Step 1: Write test for template markup**
Check that `settings.html` contains the required input IDs: `#vertex_gemini_flex_enabled`, `#vertex_gemini_flex_tier`, `#vertex_gemini_flex_force_global`.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test /root/fdgr/vertex-gemini-flex/tests/settings-html.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement `settings.html` and `style.css`**
- Create `settings.html` with responsive toggle switches, dropdowns, and documentation tooltips.
- Create `style.css` with dark/light mode compatible theme rules, glowing status indicators (green active, gray standby), and compact card layout.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test /root/fdgr/vertex-gemini-flex/tests/settings-html.test.mjs`
Expected: PASS.

---

### Task 4: API Selector Drawer Card & Main Extension Lifecycle (`index.js`)

**Files:**
- Create: `/root/fdgr/vertex-gemini-flex/index.js`
- Test: `/root/fdgr/vertex-gemini-flex/tests/lifecycle.test.mjs`

**Interfaces:**
- Consumes: SillyTavern/TauriTavern `getContext()`, `eventSource`, `event_types`.
- Injects: DOM Card into `#vertexai_form` below `#model_vertexai_select`.
- Hooks: `event_types.CHAT_COMPLETION_SETTINGS_READY`.

- [ ] **Step 1: Write test for lifecycle and card state resolver**
Create a test that verifies the status card state calculation logic given various models, regions, and settings.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test /root/fdgr/vertex-gemini-flex/tests/lifecycle.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement `index.js`**
- Register extension settings defaults in `extension_settings['vertex-gemini-flex']`.
- Set up `eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, ...)` hook calling `injectFlexParameters`.
- Mount settings template in `#extensions_settings`.
- Mount and dynamically update the **Live Flex Mode Status Card** inside `#vertexai_form` right below `#model_vertexai_select`.
- Wire the quick-toggle in the API selector card to toggle `extension_settings['vertex-gemini-flex'].enabled` and update the UI in real-time.
- Install secondary `window.fetch` interceptor for extra safety.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test /root/fdgr/vertex-gemini-flex/tests/lifecycle.test.mjs`
Expected: PASS.

---

### Task 5: Packaging & Installation Verification

**Files:**
- Create: `/root/fdgr/vertex-gemini-flex.zip`
- Test: `/root/fdgr/vertex-gemini-flex/tests/package.test.mjs`

- [ ] **Step 1: Write test verifying zip bundle structure**
Ensure all required files (`manifest.json`, `index.js`, `settings.html`, `style.css`, `README.md`) are present in root of zip.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test /root/fdgr/vertex-gemini-flex/tests/package.test.mjs`
Expected: FAIL (zip does not exist).

- [ ] **Step 3: Build the `.zip` package**
Run zip command to generate `/root/fdgr/vertex-gemini-flex.zip`.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test /root/fdgr/vertex-gemini-flex/tests/package.test.mjs`
Expected: PASS.
