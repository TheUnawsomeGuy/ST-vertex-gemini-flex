import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isGeminiModel,
    isFlexSupportedModel,
    shouldInjectFlex,
    injectFlexParameters,
    extractCustomHeaders,
    FLEX_REQUEST_HEADER,
    FLEX_SHARED_TYPE_HEADER,
} from '../src/injector.js';

test('isGeminiModel correctly identifies Gemini models', () => {
    assert.equal(isGeminiModel('gemini-4-argon'), true);
    assert.equal(isGeminiModel('gemini-3.8-flash'), true);
    assert.equal(isGeminiModel('gemini-2.5-pro'), true);
    assert.equal(isGeminiModel('gemini-1.5-flash-002'), true);
    assert.equal(isGeminiModel('models/gemini-1.5-pro'), true);
    assert.equal(isGeminiModel('google/gemini-2.5-flash'), true);
});

test('isGeminiModel correctly rejects Claude-on-Vertex and unknown models', () => {
    assert.equal(isGeminiModel('claude-sonnet-4-5@20250929'), false);
    assert.equal(isGeminiModel('claude-opus-5-5'), false);
    assert.equal(isGeminiModel('claude-haiku-4-5'), false);
    assert.equal(isGeminiModel('claude-3-5-sonnet'), false);
    assert.equal(isGeminiModel('gpt-4o'), false);
    assert.equal(isGeminiModel(''), false);
    assert.equal(isGeminiModel(null), false);
    assert.equal(isGeminiModel(undefined), false);
});

test('isFlexSupportedModel rejects Gemini 4 Argon and unsupported models on Vertex', () => {
    // Supported
    assert.equal(isFlexSupportedModel('gemini-3.8-flash'), true);
    assert.equal(isFlexSupportedModel('gemini-3.7-flash'), true);
    assert.equal(isFlexSupportedModel('gemini-3.5-flash'), true);
    assert.equal(isFlexSupportedModel('gemini-2.5-pro'), true);
    assert.equal(isFlexSupportedModel('gemini-1.5-pro'), true);

    // Unsupported on Vertex Flex PayGo
    assert.equal(isFlexSupportedModel('gemini-4-argon'), false);
    assert.equal(isFlexSupportedModel('models/gemini-4-argon'), false);
    assert.equal(isFlexSupportedModel('claude-sonnet-4-5'), false);
    assert.equal(isFlexSupportedModel('gpt-4o'), false);
});

test('shouldInjectFlex verifies all conditions', () => {
    const validSettings = { enabled: true, tier: 'flex', force_global_region: true };
    const validPayload = { chat_completion_source: 'vertexai', model: 'gemini-3.8-flash' };

    assert.equal(shouldInjectFlex(validPayload, validSettings), true);

    // Disabled in settings
    assert.equal(shouldInjectFlex(validPayload, { ...validSettings, enabled: false }), false);

    // Non-Vertex provider
    assert.equal(shouldInjectFlex({ ...validPayload, chat_completion_source: 'openai' }, validSettings), false);
    assert.equal(shouldInjectFlex({ ...validPayload, chat_completion_source: 'makersuite' }, validSettings), false);

    // Claude model on Vertex
    assert.equal(shouldInjectFlex({ ...validPayload, model: 'claude-sonnet-4-5' }, validSettings), false);

    // Gemini 4 Argon on Vertex (Flex not supported by Google)
    assert.equal(shouldInjectFlex({ ...validPayload, model: 'gemini-4-argon' }, validSettings), false);

    // Missing payload or settings
    assert.equal(shouldInjectFlex(null, validSettings), false);
    assert.equal(shouldInjectFlex(validPayload, null), false);
});

test('injectFlexParameters injects shared and flex headers, and enforces global region', () => {
    const payload = {
        chat_completion_source: 'vertexai',
        model: 'gemini-3.8-flash',
        vertexai_region: 'us-central1',
        custom_include_headers: JSON.stringify({ 'X-Custom-Trace': 'trace-123' }),
    };
    const settings = { enabled: true, tier: 'flex', force_global_region: true };

    const result = injectFlexParameters(payload, settings);
    assert.equal(result.vertexai_region, 'global');

    const headers = JSON.parse(result.custom_include_headers);
    assert.equal(headers['X-Custom-Trace'], 'trace-123');
    assert.equal(headers[FLEX_REQUEST_HEADER], 'shared');
    assert.equal(headers[FLEX_SHARED_TYPE_HEADER], 'flex');
});

test('injectFlexParameters supports priority tier', () => {
    const payload = {
        chat_completion_source: 'vertexai',
        model: 'gemini-2.5-pro',
        vertexai_region: 'europe-west4',
    };
    const settings = { enabled: true, tier: 'priority', force_global_region: true };

    const result = injectFlexParameters(payload, settings);
    assert.equal(result.vertexai_region, 'global');

    const headers = JSON.parse(result.custom_include_headers);
    assert.equal(headers[FLEX_REQUEST_HEADER], 'shared');
    assert.equal(headers[FLEX_SHARED_TYPE_HEADER], 'priority');
});

test('injectFlexParameters respects force_global_region = false', () => {
    const payload = {
        chat_completion_source: 'vertexai',
        model: 'gemini-2.5-pro',
        vertexai_region: 'us-east4',
    };
    const settings = { enabled: true, tier: 'flex', force_global_region: false };

    const result = injectFlexParameters(payload, settings);
    assert.equal(result.vertexai_region, 'us-east4');
    const headers = JSON.parse(result.custom_include_headers);
    assert.equal(headers[FLEX_SHARED_TYPE_HEADER], 'flex');
});

test('extractCustomHeaders handles JSON, YAML-like, and empty input', () => {
    assert.deepEqual(extractCustomHeaders('{"a":"1","b":"2"}'), { a: '1', b: '2' });
    assert.deepEqual(extractCustomHeaders(''), {});
    assert.deepEqual(extractCustomHeaders(null), {});
    assert.deepEqual(extractCustomHeaders(undefined), {});
    assert.deepEqual(extractCustomHeaders('invalid json'), {});
});
