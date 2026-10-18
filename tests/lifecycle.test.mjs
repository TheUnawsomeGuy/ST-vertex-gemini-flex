import test from 'node:test';
import assert from 'node:assert/strict';
import { getCardStatus, resolveCardDetails } from '../src/status-resolver.js';

test('getCardStatus correctly returns disabled when settings.enabled is false', () => {
    const status = getCardStatus('gemini-3.8-flash', 'global', { enabled: false });
    assert.equal(status.state, 'disabled');
    assert.equal(status.label, 'Disabled');
});

test('getCardStatus correctly returns standby for Claude models on Vertex', () => {
    const status = getCardStatus('claude-sonnet-4-5@20250929', 'global', { enabled: true });
    assert.equal(status.state, 'standby');
    assert.equal(status.label, 'Standby');
    assert.ok(status.message.includes('Non-Gemini model'));
});

test('getCardStatus correctly reports standby for Gemini 4 Argon (unsupported by Vertex Flex)', () => {
    const status = getCardStatus('gemini-4-argon', 'global', { enabled: true });
    assert.equal(status.state, 'standby');
    assert.equal(status.label, 'Unsupported on Vertex');
    assert.ok(status.message.includes('AI Studio') || status.message.includes('Vertex AI'));

    // When bypass_unsupported_models is false, Argon is treated as active
    const activeStatus = getCardStatus('gemini-4-argon', 'global', { enabled: true, bypass_unsupported_models: false });
    assert.equal(activeStatus.state, 'active');
});

test('getCardStatus correctly returns active for Gemini models', () => {
    const status = getCardStatus('gemini-3.8-flash', 'global', {
        enabled: true,
        tier: 'flex',
        force_global_region: true,
    });
    assert.equal(status.state, 'active');
    assert.equal(status.label, 'Active');
    assert.ok(status.message.includes('50%'));
});

test('getCardStatus warns when force_global_region is false and region is regional', () => {
    const status = getCardStatus('gemini-2.5-pro', 'europe-west4', {
        enabled: true,
        tier: 'flex',
        force_global_region: false,
    });
    assert.equal(status.state, 'warning');
    assert.ok(status.message.includes('global'));
});

test('resolveCardDetails returns formatted pill data for active state', () => {
    const details = resolveCardDetails('gemini-4-argon', 'us-central1', {
        enabled: true,
        tier: 'flex',
        force_global_region: true,
    });
    assert.equal(details.tier, 'flex');
    assert.equal(details.effectiveRegion, 'global');
    assert.equal(details.discount, '50% Off');
});
