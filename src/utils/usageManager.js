import { getUsageCount, incrementUsageCount } from '../storage/appStore.js';

const LIMITS = {
    'sonar-pro': 3,
    'sonar-reasoning': 5,
    'sonar': 15,
};

function getTodayDate() {
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    return kstDate.toISOString().split('T')[0];
}

export async function checkLimit(model) {
    const today = getTodayDate();
    const currentUsage = getUsageCount(model, today);
    const limit = LIMITS[model] || 0;

    return {
        allowed: currentUsage < limit,
        current: currentUsage,
        limit,
        remaining: Math.max(0, limit - currentUsage),
    };
}

export async function incrementUsage(model) {
    return incrementUsageCount(model, getTodayDate());
}

export function getLimits() {
    return LIMITS;
}
