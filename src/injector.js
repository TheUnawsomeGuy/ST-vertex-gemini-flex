/**
 * Core parameter and header injection engine for Google Vertex AI Gemini Flex Mode.
 */

export const FLEX_REQUEST_HEADER = 'X-Vertex-AI-LLM-Request-Type';
export const FLEX_SHARED_TYPE_HEADER = 'X-Vertex-AI-LLM-Shared-Request-Type';

export const SERVICE_TIERS = Object.freeze({
    FLEX: 'flex',
    PRIORITY: 'priority',
});

export const DEFAULT_UNSUPPORTED_MODELS = Object.freeze([
    'gemini-4-argon',
]);

/**
 * Checks if a given model identifier represents a Google Gemini model.
 * Rejects Claude-on-Vertex and non-Gemini identifiers.
 *
 * @param {string|null|undefined} model Model identifier string
 * @returns {boolean}
 */
export function isGeminiModel(model) {
    if (typeof model !== 'string') {
        return false;
    }
    const normalized = model.trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    // Explicitly reject Claude models hosted on Vertex AI
    if (normalized.startsWith('claude-') || normalized.includes('/claude-')) {
        return false;
    }

    // Explicitly reject other non-Gemini models
    if (normalized.startsWith('gpt-') || normalized.startsWith('deepseek-') || normalized.startsWith('mistral')) {
        return false;
    }

    // Check for Gemini prefix or standard Vertex publisher path
    return normalized.startsWith('gemini-')
        || normalized.includes('/gemini-')
        || normalized.startsWith('models/gemini-');
}

/**
 * Checks if a model supports Vertex AI Flex PayGo.
 * Gemini 4 Argon and other reasoning/frontier preview models currently reject Flex headers on Vertex.
 *
 * @param {string|null|undefined} model Model identifier string
 * @param {string[]|string|null|undefined} customExclusions Additional models to exclude
 * @returns {boolean}
 */
export function isFlexSupportedModel(model, customExclusions = []) {
    if (!isGeminiModel(model)) {
        return false;
    }

    const normalized = model.trim().toLowerCase();
    const exclusions = Array.isArray(customExclusions)
        ? [...DEFAULT_UNSUPPORTED_MODELS, ...customExclusions]
        : [...DEFAULT_UNSUPPORTED_MODELS];

    for (const item of exclusions) {
        if (!item || typeof item !== 'string') {
            continue;
        }
        const excluded = item.trim().toLowerCase();
        if (excluded && (normalized === excluded || normalized.endsWith('/' + excluded))) {
            return false;
        }
    }

    return true;
}

/**
 * Checks whether Flex parameters should be injected into the given generation payload.
 *
 * @param {object|null|undefined} payload Generation parameters payload
 * @param {object|null|undefined} settings Extension settings
 * @returns {boolean}
 */
export function shouldInjectFlex(payload, settings) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }
    if (!settings || typeof settings !== 'object') {
        return false;
    }
    if (!settings.enabled) {
        return false;
    }
    if (payload.chat_completion_source !== 'vertexai') {
        return false;
    }
    return isFlexSupportedModel(payload.model, settings.unsupported_models);
}

/**
 * Safely parses raw custom headers into an object dictionary.
 * Supports JSON strings, empty strings, and null/undefined values.
 *
 * @param {string|object|null|undefined} raw
 * @returns {Record<string, string>}
 */
export function extractCustomHeaders(raw) {
    if (!raw) {
        return {};
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
        return { ...raw };
    }
    if (typeof raw !== 'string') {
        return {};
    }

    const trimmed = raw.trim();
    if (!trimmed) {
        return {};
    }

    // Attempt JSON parse
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        } catch {
            // Fall through to line-by-line parsing
        }
    }

    // Fallback: parse simple key: value lines
    const headers = {};
    const lines = trimmed.split('\n');
    for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            const val = line.slice(colonIdx + 1).trim();
            if (key && val) {
                headers[key] = val;
            }
        }
    }
    return headers;
}

/**
 * Injects Google Vertex AI Flex headers and forces the global region
 * into the given generation payload object in-place.
 *
 * @param {object} payload Generation parameters payload
 * @param {object} settings Extension settings
 * @returns {object} The mutated payload
 */
export function injectFlexParameters(payload, settings) {
    if (!payload || typeof payload !== 'object') {
        return payload;
    }

    const tier = (settings?.tier === SERVICE_TIERS.PRIORITY)
        ? SERVICE_TIERS.PRIORITY
        : SERVICE_TIERS.FLEX;

    // Enforce global region unless user explicitly configured otherwise
    const forceGlobal = settings?.force_global_region !== false;
    if (forceGlobal) {
        payload.vertexai_region = 'global';
    }

    // Parse pre-existing custom headers to avoid destroying user settings
    const currentHeaders = extractCustomHeaders(payload.custom_include_headers);

    // Inject Vertex AI Flex PayGo HTTP headers
    currentHeaders[FLEX_REQUEST_HEADER] = 'shared';
    currentHeaders[FLEX_SHARED_TYPE_HEADER] = tier;

    // Save back as JSON string
    payload.custom_include_headers = JSON.stringify(currentHeaders);

    return payload;
}
