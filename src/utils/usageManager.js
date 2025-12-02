import fs from 'fs/promises';
import path from 'path';
import logger from '../logger.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const USAGE_FILE = path.join(DATA_DIR, 'usage.json');

// Limits per day
const LIMITS = {
    'sonar-pro': 3,
    'sonar-reasoning': 5,
    'sonar': 15
};

async function loadUsage() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const data = await fs.readFile(USAGE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.error(`[UsageManager] Error loading usage: ${error.message}`);
        }
        return { date: new Date().toISOString().split('T')[0], counts: {} };
    }
}

async function saveUsage(usage) {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(USAGE_FILE, JSON.stringify(usage, null, 2));
    } catch (error) {
        logger.error(`[UsageManager] Error saving usage: ${error.message}`);
    }
}

function getTodayDate() {
    // Use KST (UTC+9) for date boundary
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    return kstDate.toISOString().split('T')[0];
}

export async function checkLimit(model) {
    const usage = await loadUsage();
    const today = getTodayDate();

    // Reset if date changed
    if (usage.date !== today) {
        usage.date = today;
        usage.counts = {};
        await saveUsage(usage);
    }

    const currentUsage = usage.counts[model] || 0;
    const limit = LIMITS[model] || 0;

    return {
        allowed: currentUsage < limit,
        current: currentUsage,
        limit: limit,
        remaining: Math.max(0, limit - currentUsage)
    };
}

export async function incrementUsage(model) {
    const usage = await loadUsage();
    const today = getTodayDate();

    if (usage.date !== today) {
        usage.date = today;
        usage.counts = {};
    }

    usage.counts[model] = (usage.counts[model] || 0) + 1;
    await saveUsage(usage);
    
    return usage.counts[model];
}

export function getLimits() {
    return LIMITS;
}
