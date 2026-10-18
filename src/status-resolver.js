import { isGeminiModel, SERVICE_TIERS } from './injector.js';

/**
 * Calculates the display status for the API Selector live status card.
 *
 * @param {string|null|undefined} model Currently selected model identifier
 * @param {string|null|undefined} region Currently selected region string
 * @param {object} settings Extension settings
 * @returns {{ state: 'active'|'standby'|'disabled'|'warning', label: string, message: string }}
 */
export function getCardStatus(model, region, settings) {
    if (!settings?.enabled) {
        return {
            state: 'disabled',
            label: 'Disabled',
            message: 'Flex Mode is disabled in extension settings.',
        };
    }

    if (!isGeminiModel(model)) {
        return {
            state: 'standby',
            label: 'Standby',
            message: 'Non-Gemini model selected; Flex Mode safely bypassed.',
        };
    }

    const effectiveRegion = (settings.force_global_region !== false) ? 'global' : (region || 'us-central1');
    if (effectiveRegion !== 'global') {
        return {
            state: 'warning',
            label: 'Region Notice',
            message: 'Flex PayGo requires "global" region. Regional endpoints may reject request.',
        };
    }

    const tierName = settings.tier === SERVICE_TIERS.PRIORITY ? 'Priority Tier' : 'Flex PayGo (50% Off)';
    return {
        state: 'active',
        label: 'Active',
        message: `${tierName} engaged. Cost reduced by 50% with best-effort latency.`,
    };
}

/**
 * Resolves detailed badges/pills for the status card.
 *
 * @param {string|null|undefined} model
 * @param {string|null|undefined} region
 * @param {object} settings
 * @returns {{ tier: string, effectiveRegion: string, discount: string }}
 */
export function resolveCardDetails(model, region, settings) {
    const tier = settings?.tier === SERVICE_TIERS.PRIORITY ? 'priority' : 'flex';
    const effectiveRegion = (settings?.force_global_region !== false) ? 'global' : (region || 'us-central1');
    const discount = tier === 'flex' ? '50% Off' : 'Standard Rate';

    return {
        tier,
        effectiveRegion,
        discount,
    };
}
