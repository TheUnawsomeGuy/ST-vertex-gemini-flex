/**
 * Vertex AI Gemini Flex Mode Extension
 * Injects Google Cloud Vertex AI Flex PayGo headers and enforces the global endpoint
 * for a 50% discount on Gemini token costs.
 */

import { shouldInjectFlex, injectFlexParameters } from './src/injector.js';
import { getCardStatus, resolveCardDetails } from './src/status-resolver.js';

const MODULE_NAME = 'vertex-gemini-flex';
const LOG_PREFIX = '[VertexGeminiFlex]';

const defaultSettings = Object.freeze({
    enabled: true,
    tier: 'flex',
    force_global_region: true,
    show_api_selector_card: true,
});

/**
 * Retrieves the host extension context safely.
 */
function getHostContext() {
    if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
        return SillyTavern.getContext();
    }
    return null;
}

/**
 * Retrieves current extension settings.
 */
function getSettings() {
    const context = getHostContext();
    const extension_settings = context?.extensionSettings || window.extension_settings || {};

    if (!extension_settings[MODULE_NAME] || typeof extension_settings[MODULE_NAME] !== 'object') {
        extension_settings[MODULE_NAME] = { ...defaultSettings };
    }

    // Merge any missing default keys
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (typeof extension_settings[MODULE_NAME][key] === 'undefined') {
            extension_settings[MODULE_NAME][key] = value;
        }
    }

    return extension_settings[MODULE_NAME];
}

/**
 * Saves current extension settings debounced.
 */
function persistSettings() {
    const context = getHostContext();
    if (typeof context?.saveSettingsDebounced === 'function') {
        context.saveSettingsDebounced();
    } else if (typeof window.saveSettingsDebounced === 'function') {
        window.saveSettingsDebounced();
    }
}

/**
 * Injects or updates the Live Status Card inside the Vertex AI configuration form.
 */
function updateApiDrawerCard() {
    const settings = getSettings();
    const $form = $('#vertexai_form');

    if ($form.length === 0) {
        return;
    }

    let $card = $('#vertex_flex_api_card');
    if (!settings.show_api_selector_card) {
        $card.remove();
        return;
    }

    if ($card.length === 0) {
        $card = $(`
            <div id="vertex_flex_api_card" class="vertex-flex-status-card">
                <div class="vertex-flex-status-card-header">
                    <span class="vertex-flex-title">
                        <i class="fa-solid fa-bolt" style="color: #48bb78;"></i>
                        Gemini Flex Mode
                    </span>
                    <label class="vertex-flex-quick-toggle" title="Quickly toggle Gemini Flex Mode on/off">
                        <input type="checkbox" id="vertex_flex_quick_checkbox" />
                        <span>Enable</span>
                    </label>
                </div>
                <div class="flex-container alignItemsCenter gap5">
                    <span id="vertex_flex_status_badge" class="vertex-flex-badge">
                        <span class="vertex-flex-badge-dot"></span>
                        <span id="vertex_flex_status_label">Loading</span>
                    </span>
                    <span id="vertex_flex_status_message" class="vertex-flex-msg"></span>
                </div>
                <div id="vertex_flex_pills_container" class="vertex-flex-details"></div>
            </div>
        `);

        // Insert right below the Google Model select container
        const $modelContainer = $('#model_vertexai_select').closest('div');
        if ($modelContainer.length > 0) {
            $modelContainer.after($card);
        } else {
            $form.prepend($card);
        }

        // Bind quick toggle
        $card.find('#vertex_flex_quick_checkbox').on('change', function () {
            const isChecked = $(this).is(':checked');
            settings.enabled = isChecked;
            persistSettings();
            syncSettingsPanel();
            updateApiDrawerCard();
        });
    }

    // Sync quick toggle checkbox state
    $card.find('#vertex_flex_quick_checkbox').prop('checked', settings.enabled);

    // Read current model & region from DOM or settings
    const currentModel = String($('#model_vertexai_select').val() || '').trim();
    const currentRegion = String($('#vertexai_region').val() || 'us-central1').trim();

    const status = getCardStatus(currentModel, currentRegion, settings);
    const details = resolveCardDetails(currentModel, currentRegion, settings);

    // Update badge styling and labels
    const $badge = $card.find('#vertex_flex_status_badge');
    $badge.removeClass('active standby disabled warning').addClass(status.state);
    $card.find('#vertex_flex_status_label').text(status.label);
    $card.find('#vertex_flex_status_message').text(status.message);

    // Update details pills
    const $pills = $card.find('#vertex_flex_pills_container');
    $pills.empty();

    if (status.state === 'active') {
        $pills.append(`
            <span class="vertex-flex-pill"><i class="fa-solid fa-tag"></i> ${details.discount}</span>
            <span class="vertex-flex-pill"><i class="fa-solid fa-layer-group"></i> Tier: ${details.tier}</span>
            <span class="vertex-flex-pill"><i class="fa-solid fa-globe"></i> Location: ${details.effectiveRegion}</span>
            <span class="vertex-flex-pill"><i class="fa-solid fa-check"></i> Headers Injected</span>
        `);
    } else if (status.state === 'standby') {
        $pills.append(`
            <span class="vertex-flex-pill"><i class="fa-solid fa-info-circle"></i> Model: ${currentModel || 'None'}</span>
            <span class="vertex-flex-pill">Flex Bypassed for Claude</span>
        `);
    }
}

/**
 * Synchronizes controls in the Extensions Settings panel.
 */
function syncSettingsPanel() {
    const settings = getSettings();
    $('#vertex_gemini_flex_enabled').prop('checked', settings.enabled);
    $('#vertex_gemini_flex_tier').val(settings.tier);
    $('#vertex_gemini_flex_force_global').prop('checked', settings.force_global_region);
    $('#vertex_gemini_flex_show_api_card').prop('checked', settings.show_api_selector_card);
}

/**
 * Initializes settings UI in the main Extensions Settings drawer.
 */
async function initSettingsUi() {
    const context = getHostContext();
    let html = '';

    if (typeof context?.renderExtensionTemplateAsync === 'function') {
        try {
            html = await context.renderExtensionTemplateAsync('third-party/vertex-gemini-flex', 'settings');
        } catch (err) {
            console.debug(LOG_PREFIX, 'Template render deferred:', err);
        }
    }

    if (!html) {
        try {
            const resp = await fetch('/scripts/extensions/third-party/vertex-gemini-flex/settings.html');
            if (resp.ok) {
                html = await resp.text();
            }
        } catch {
            // Silently handle standalone test environments
        }
    }

    if (html && $('#extensions_settings').length > 0) {
        if ($('.vertex-gemini-flex-settings').length === 0) {
            $('#extensions_settings').append(html);
        }

        syncSettingsPanel();

        $('#vertex_gemini_flex_enabled').off('change').on('change', function () {
            const settings = getSettings();
            settings.enabled = $(this).is(':checked');
            persistSettings();
            updateApiDrawerCard();
        });

        $('#vertex_gemini_flex_tier').off('change').on('change', function () {
            const settings = getSettings();
            settings.tier = String($(this).val());
            persistSettings();
            updateApiDrawerCard();
        });

        $('#vertex_gemini_flex_force_global').off('change').on('change', function () {
            const settings = getSettings();
            settings.force_global_region = $(this).is(':checked');
            persistSettings();
            updateApiDrawerCard();
        });

        $('#vertex_gemini_flex_show_api_card').off('change').on('change', function () {
            const settings = getSettings();
            settings.show_api_selector_card = $(this).is(':checked');
            persistSettings();
            updateApiDrawerCard();
        });
    }
}

/**
 * Secondary safety guard: intercept fetch to guarantee Flex headers on generation payloads.
 */
function installFetchInterceptor() {
    if (window._vertexGeminiFlexFetchInstalled) {
        return;
    }
    window._vertexGeminiFlexFetchInstalled = true;

    const originalFetch = window.fetch;
    window.fetch = async function (url, options) {
        try {
            const urlString = String(url || '');
            if (urlString.includes('/api/backends/chat-completions/generate') && options?.body && options?.method === 'POST') {
                const settings = getSettings();
                if (settings.enabled) {
                    const parsed = JSON.parse(options.body);
                    if (shouldInjectFlex(parsed, settings)) {
                        injectFlexParameters(parsed, settings);
                        options.body = JSON.stringify(parsed);
                        console.debug(LOG_PREFIX, `[FetchGuard] Injected Flex tier into generation payload for ${parsed.model}`);
                    }
                }
            }
        } catch (error) {
            console.warn(LOG_PREFIX, 'Fetch interceptor pass-through error:', error);
        }
        return originalFetch.apply(this, arguments);
    };
}

/**
 * Main initialization entrypoint.
 */
jQuery(async () => {
    const context = getHostContext();
    const settings = getSettings();

    console.log(LOG_PREFIX, 'Loaded Vertex AI Gemini Flex Mode Extension v1.0.0');

    // Register event listener on CHAT_COMPLETION_SETTINGS_READY
    if (context?.eventSource && context?.eventTypes?.CHAT_COMPLETION_SETTINGS_READY) {
        context.eventSource.on(context.eventTypes.CHAT_COMPLETION_SETTINGS_READY, async (generateData) => {
            if (shouldInjectFlex(generateData, settings)) {
                injectFlexParameters(generateData, settings);
                console.log(LOG_PREFIX, `[EventHook] Injected Flex Mode for model "${generateData.model}" (region: ${generateData.vertexai_region})`);
            }
        });
    }

    // Secondary safety fetch guard
    installFetchInterceptor();

    // Setup settings UI
    await initSettingsUi();

    // Setup and observe API drawer card
    updateApiDrawerCard();

    // DOM event listeners to update card on model or region change
    $(document).on('change', '#model_vertexai_select', updateApiDrawerCard);
    $(document).on('input', '#vertexai_region', updateApiDrawerCard);
    $(document).on('change', '#vertexai_auth_mode', updateApiDrawerCard);

    // Host event hooks if available
    if (context?.eventSource) {
        if (context.eventTypes?.CHATCOMPLETION_SOURCE_CHANGED) {
            context.eventSource.on(context.eventTypes.CHATCOMPLETION_SOURCE_CHANGED, updateApiDrawerCard);
        }
        if (context.eventTypes?.CHATCOMPLETION_MODEL_CHANGED) {
            context.eventSource.on(context.eventTypes.CHATCOMPLETION_MODEL_CHANGED, updateApiDrawerCard);
        }
        if (context.eventTypes?.APP_READY) {
            context.eventSource.on(context.eventTypes.APP_READY, () => {
                syncSettingsPanel();
                updateApiDrawerCard();
            });
        }
    }
});
