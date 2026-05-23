import { getDatabase } from './database.js';

const DEFAULT_COMMAND_LOG_RETENTION_DAYS = 30;
const DEFAULT_SCHEDULER_LOG_RETENTION_DAYS = 30;

function nowIso() {
    return new Date().toISOString();
}

function toBoolean(value) {
    return value === true || value === 1;
}

function parseJson(value, fallback = null) {
    if (value == null) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function stringifyJson(value) {
    return JSON.stringify(value ?? null);
}

export function getSetting(key, fallback = null) {
    const row = getDatabase().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? parseJson(row.value, fallback) : fallback;
}

export function setSetting(key, value) {
    getDatabase()
        .prepare(`
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
        `)
        .run(key, stringifyJson(value), nowIso());
}

export function getNumberSetting(key, fallback) {
    const value = getSetting(key, fallback);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function ensureDefaultSettings() {
    if (getSetting('command_log_retention_days') == null) {
        setSetting('command_log_retention_days', DEFAULT_COMMAND_LOG_RETENTION_DAYS);
    }
    if (getSetting('scheduler_log_retention_days') == null) {
        setSetting('scheduler_log_retention_days', DEFAULT_SCHEDULER_LOG_RETENTION_DAYS);
    }
}

export function ensureCommandSetting(commandName, defaults = {}) {
    const enabled = defaults.enabled === false ? 0 : 1;
    const disabled = defaults.disabled === true ? 1 : 0;
    const defaultEnabled = disabled ? 0 : enabled;
    const now = nowIso();

    getDatabase()
        .prepare(`
            INSERT INTO command_settings (
                command_name, enabled, admin_only, cooldown_seconds, notes, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(command_name) DO NOTHING
        `)
        .run(
            commandName,
            defaultEnabled,
            defaults.adminOnly ? 1 : 0,
            Number(defaults.cooldownSeconds || 0),
            defaults.notes || null,
            now,
        );
}

export function getCommandSetting(commandName, defaults = {}) {
    ensureCommandSetting(commandName, defaults);
    const row = getDatabase()
        .prepare('SELECT * FROM command_settings WHERE command_name = ?')
        .get(commandName);

    return row ? {
        commandName: row.command_name,
        enabled: toBoolean(row.enabled),
        adminOnly: toBoolean(row.admin_only),
        cooldownSeconds: row.cooldown_seconds,
        notes: row.notes,
        updatedAt: row.updated_at,
    } : null;
}

export function updateCommandSetting(commandName, patch) {
    const current = getCommandSetting(commandName);
    const next = {
        enabled: patch.enabled == null ? current.enabled : Boolean(patch.enabled),
        adminOnly: patch.adminOnly == null ? current.adminOnly : Boolean(patch.adminOnly),
        cooldownSeconds: patch.cooldownSeconds == null
            ? current.cooldownSeconds
            : Math.max(0, Number(patch.cooldownSeconds) || 0),
        notes: patch.notes == null ? current.notes : String(patch.notes),
    };

    getDatabase()
        .prepare(`
            UPDATE command_settings
            SET enabled = ?, admin_only = ?, cooldown_seconds = ?, notes = ?, updated_at = ?
            WHERE command_name = ?
        `)
        .run(
            next.enabled ? 1 : 0,
            next.adminOnly ? 1 : 0,
            next.cooldownSeconds,
            next.notes,
            nowIso(),
            commandName,
        );

    return getCommandSetting(commandName);
}

export function listCommandSettings(commandMetadata = []) {
    for (const meta of commandMetadata) {
        ensureCommandSetting(meta.name, { disabled: meta.disabled });
    }

    const rows = getDatabase()
        .prepare(`
            SELECT
                cs.*,
                COUNT(cel.id) AS execution_count,
                MAX(cel.created_at) AS last_executed_at,
                SUM(CASE WHEN cel.status = 'success' THEN 1 ELSE 0 END) AS success_count,
                SUM(CASE WHEN cel.status = 'error' THEN 1 ELSE 0 END) AS error_count,
                AVG(cel.duration_ms) AS avg_duration_ms
            FROM command_settings cs
            LEFT JOIN command_execution_logs cel
                ON cel.command_name = cs.command_name
            GROUP BY cs.command_name
            ORDER BY cs.command_name ASC
        `)
        .all();

    const metaByName = new Map(commandMetadata.map((meta) => [meta.name, meta]));

    return rows.map((row) => ({
        name: row.command_name,
        description: metaByName.get(row.command_name)?.description || '',
        fileName: metaByName.get(row.command_name)?.fileName || '',
        sourceDisabled: Boolean(metaByName.get(row.command_name)?.disabled),
        enabled: toBoolean(row.enabled),
        adminOnly: toBoolean(row.admin_only),
        cooldownSeconds: row.cooldown_seconds,
        notes: row.notes,
        updatedAt: row.updated_at,
        executionCount: row.execution_count || 0,
        successCount: row.success_count || 0,
        errorCount: row.error_count || 0,
        avgDurationMs: row.avg_duration_ms == null ? null : Math.round(row.avg_duration_ms),
        lastExecutedAt: row.last_executed_at,
    }));
}

export function recordCommandExecution(entry) {
    getDatabase()
        .prepare(`
            INSERT INTO command_execution_logs (
                command_name, user_id, guild_id, channel_id, status, duration_ms, error_message, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
            entry.commandName,
            entry.userId || null,
            entry.guildId || null,
            entry.channelId || null,
            entry.status,
            Number(entry.durationMs || 0),
            entry.errorMessage || null,
            entry.createdAt || nowIso(),
        );
}

export function listCommandExecutionLogs({ limit = 100, commandName, status } = {}) {
    const cappedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const conditions = [];
    const params = [];

    if (commandName) {
        conditions.push('command_name = ?');
        params.push(commandName);
    }
    if (status) {
        conditions.push('status = ?');
        params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return getDatabase()
        .prepare(`
            SELECT *
            FROM command_execution_logs
            ${where}
            ORDER BY created_at DESC
            LIMIT ?
        `)
        .all(...params, cappedLimit)
        .map((row) => ({
            id: row.id,
            commandName: row.command_name,
            userId: row.user_id,
            guildId: row.guild_id,
            channelId: row.channel_id,
            status: row.status,
            durationMs: row.duration_ms,
            errorMessage: row.error_message,
            createdAt: row.created_at,
        }));
}

export function deleteOldCommandExecutionLogs(retentionDays = getNumberSetting('command_log_retention_days', DEFAULT_COMMAND_LOG_RETENTION_DAYS)) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    return getDatabase()
        .prepare('DELETE FROM command_execution_logs WHERE created_at < ?')
        .run(cutoff).changes;
}

export function saveSessionRecord(sessionKey, history, existingCreatedAt = null) {
    const existing = getDatabase()
        .prepare('SELECT created_at FROM sessions WHERE session_key = ?')
        .get(sessionKey);
    const createdAt = existingCreatedAt || existing?.created_at || Date.now();

    getDatabase()
        .prepare(`
            INSERT INTO sessions (session_key, history_json, last_update, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(session_key) DO UPDATE SET
                history_json = excluded.history_json,
                last_update = excluded.last_update
        `)
        .run(sessionKey, stringifyJson(history), Date.now(), createdAt);
}

export function loadSessionRecord(sessionKey) {
    const row = getDatabase()
        .prepare('SELECT * FROM sessions WHERE session_key = ?')
        .get(sessionKey);
    if (!row) return null;

    return {
        userId: sessionKey,
        history: parseJson(row.history_json, []),
        lastUpdate: row.last_update,
        createdAt: row.created_at,
    };
}

export function deleteSessionRecord(sessionKey) {
    return getDatabase()
        .prepare('DELETE FROM sessions WHERE session_key = ?')
        .run(sessionKey).changes > 0;
}

export function cleanupExpiredSessionRecords(timeoutMs) {
    const cutoff = Date.now() - timeoutMs;
    return getDatabase()
        .prepare('DELETE FROM sessions WHERE last_update < ?')
        .run(cutoff).changes;
}

export function saveConversationRecord(interactionId, data) {
    const timestamp = Number(data?.timestamp || Date.now());
    getDatabase()
        .prepare(`
            INSERT INTO conversations (interaction_id, data_json, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(interaction_id) DO UPDATE SET
                data_json = excluded.data_json,
                updated_at = excluded.updated_at
        `)
        .run(interactionId, stringifyJson(data), timestamp, Date.now());
}

export function loadConversationRecord(interactionId) {
    const row = getDatabase()
        .prepare('SELECT data_json FROM conversations WHERE interaction_id = ?')
        .get(interactionId);
    return row ? parseJson(row.data_json, null) : null;
}

export function deleteConversationRecord(interactionId) {
    return getDatabase()
        .prepare('DELETE FROM conversations WHERE interaction_id = ?')
        .run(interactionId).changes > 0;
}

export function cleanupExpiredConversationRecords(timeoutMs) {
    const cutoff = Date.now() - timeoutMs;
    return getDatabase()
        .prepare('DELETE FROM conversations WHERE updated_at < ?')
        .run(cutoff).changes;
}

export function getUsageCount(model, date) {
    const row = getDatabase()
        .prepare('SELECT count FROM usage_counters WHERE model = ? AND date = ?')
        .get(model, date);
    return row?.count || 0;
}

export function setUsageCount(model, date, count) {
    getDatabase()
        .prepare(`
            INSERT INTO usage_counters (model, date, count)
            VALUES (?, ?, ?)
            ON CONFLICT(model, date) DO UPDATE SET count = excluded.count
        `)
        .run(model, date, Number(count || 0));
}

export function incrementUsageCount(model, date) {
    getDatabase()
        .prepare(`
            INSERT INTO usage_counters (model, date, count)
            VALUES (?, ?, 1)
            ON CONFLICT(model, date) DO UPDATE SET count = count + 1
        `)
        .run(model, date);
    return getUsageCount(model, date);
}

export function getStateValue(key, fallback = null) {
    const row = getDatabase()
        .prepare('SELECT value_json FROM state_values WHERE key = ?')
        .get(key);
    return row ? parseJson(row.value_json, fallback) : fallback;
}

export function setStateValue(key, value) {
    getDatabase()
        .prepare(`
            INSERT INTO state_values (key, value_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value_json = excluded.value_json,
                updated_at = excluded.updated_at
        `)
        .run(key, stringifyJson(value), nowIso());
}

export function ensureSchedulerJob(job) {
    getDatabase()
        .prepare(`
            INSERT INTO scheduler_jobs (
                job_id, handler_key, cron_expression, timezone, enabled, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO NOTHING
        `)
        .run(
            job.jobId,
            job.handlerKey,
            job.cronExpression,
            job.timezone || 'Asia/Seoul',
            job.enabled === false ? 0 : 1,
            nowIso(),
        );
}

export function listSchedulerJobs() {
    return getDatabase()
        .prepare('SELECT * FROM scheduler_jobs ORDER BY job_id ASC')
        .all()
        .map((row) => ({
            jobId: row.job_id,
            handlerKey: row.handler_key,
            cronExpression: row.cron_expression,
            timezone: row.timezone,
            enabled: toBoolean(row.enabled),
            lastRunAt: row.last_run_at,
            lastStatus: row.last_status,
            lastError: row.last_error,
            lastDurationMs: row.last_duration_ms,
            runCount: row.run_count,
            updatedAt: row.updated_at,
        }));
}

export function getSchedulerJob(jobId) {
    return listSchedulerJobs().find((job) => job.jobId === jobId) || null;
}

export function updateSchedulerJob(jobId, patch) {
    const current = getSchedulerJob(jobId);
    if (!current) return null;

    const next = {
        cronExpression: patch.cronExpression ?? current.cronExpression,
        timezone: patch.timezone ?? current.timezone,
        enabled: patch.enabled == null ? current.enabled : Boolean(patch.enabled),
    };

    getDatabase()
        .prepare(`
            UPDATE scheduler_jobs
            SET cron_expression = ?, timezone = ?, enabled = ?, updated_at = ?
            WHERE job_id = ?
        `)
        .run(next.cronExpression, next.timezone, next.enabled ? 1 : 0, nowIso(), jobId);

    return getSchedulerJob(jobId);
}

export function recordSchedulerRun(jobId, status, durationMs, errorMessage = null) {
    const createdAt = nowIso();
    const db = getDatabase();
    db.prepare(`
        INSERT INTO scheduler_run_logs (job_id, status, duration_ms, error_message, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(jobId, status, Number(durationMs || 0), errorMessage, createdAt);

    db.prepare(`
        UPDATE scheduler_jobs
        SET last_run_at = ?,
            last_status = ?,
            last_error = ?,
            last_duration_ms = ?,
            run_count = run_count + 1,
            updated_at = ?
        WHERE job_id = ?
    `).run(createdAt, status, errorMessage, Number(durationMs || 0), createdAt, jobId);
}

export function listSchedulerRunLogs({ limit = 100, jobId, status } = {}) {
    const cappedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const conditions = [];
    const params = [];

    if (jobId) {
        conditions.push('job_id = ?');
        params.push(jobId);
    }
    if (status) {
        conditions.push('status = ?');
        params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return getDatabase()
        .prepare(`
            SELECT *
            FROM scheduler_run_logs
            ${where}
            ORDER BY created_at DESC
            LIMIT ?
        `)
        .all(...params, cappedLimit)
        .map((row) => ({
            id: row.id,
            jobId: row.job_id,
            status: row.status,
            durationMs: row.duration_ms,
            errorMessage: row.error_message,
            createdAt: row.created_at,
        }));
}

export function deleteOldSchedulerRunLogs(retentionDays = getNumberSetting('scheduler_log_retention_days', DEFAULT_SCHEDULER_LOG_RETENTION_DAYS)) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    return getDatabase()
        .prepare('DELETE FROM scheduler_run_logs WHERE created_at < ?')
        .run(cutoff).changes;
}

export function recordAdminAuthLog(entry) {
    getDatabase()
        .prepare(`
            INSERT INTO admin_auth_logs (
                ip_address, email, provider, status, reason, user_agent, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
            entry.ipAddress,
            entry.email || null,
            entry.provider || 'google',
            entry.status,
            entry.reason || null,
            entry.userAgent || null,
            entry.createdAt || nowIso(),
        );
}

export function countRecentAdminAuthFailures(ipAddress, windowHours = 24) {
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
    const row = getDatabase()
        .prepare(`
            SELECT COUNT(*) AS count
            FROM admin_auth_logs
            WHERE ip_address = ?
              AND status = 'failure'
              AND created_at >= ?
        `)
        .get(ipAddress, cutoff);
    return row?.count || 0;
}

export function banAdminIp(ipAddress, reason, failedCount) {
    const bannedAt = nowIso();
    getDatabase()
        .prepare(`
            INSERT INTO admin_ip_bans (ip_address, reason, failed_count, banned_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(ip_address) DO UPDATE SET
                reason = excluded.reason,
                failed_count = excluded.failed_count,
                banned_at = excluded.banned_at
        `)
        .run(ipAddress, reason, Number(failedCount || 0), bannedAt);
}

export function getAdminIpBan(ipAddress) {
    const row = getDatabase()
        .prepare('SELECT * FROM admin_ip_bans WHERE ip_address = ?')
        .get(ipAddress);
    return row ? {
        ipAddress: row.ip_address,
        reason: row.reason,
        failedCount: row.failed_count,
        bannedAt: row.banned_at,
    } : null;
}

export function listAdminIpBans({ limit = 100 } = {}) {
    const cappedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return getDatabase()
        .prepare(`
            SELECT *
            FROM admin_ip_bans
            ORDER BY banned_at DESC
            LIMIT ?
        `)
        .all(cappedLimit)
        .map((row) => ({
            ipAddress: row.ip_address,
            reason: row.reason,
            failedCount: row.failed_count,
            bannedAt: row.banned_at,
        }));
}

export function listAdminAuthLogs({ limit = 100, status, ipAddress, email } = {}) {
    const cappedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const conditions = [];
    const params = [];

    if (status) {
        conditions.push('status = ?');
        params.push(status);
    }
    if (ipAddress) {
        conditions.push('ip_address = ?');
        params.push(ipAddress);
    }
    if (email) {
        conditions.push('email = ?');
        params.push(email);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return getDatabase()
        .prepare(`
            SELECT *
            FROM admin_auth_logs
            ${where}
            ORDER BY created_at DESC
            LIMIT ?
        `)
        .all(...params, cappedLimit)
        .map((row) => ({
            id: row.id,
            ipAddress: row.ip_address,
            email: row.email,
            provider: row.provider,
            status: row.status,
            reason: row.reason,
            userAgent: row.user_agent,
            createdAt: row.created_at,
        }));
}

export function createAdminSession(session) {
    const now = nowIso();
    getDatabase()
        .prepare(`
            INSERT INTO admin_sessions (
                token_hash, email, name, picture, ip_address, user_agent,
                created_at, last_seen_at, expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
            session.tokenHash,
            session.email,
            session.name || null,
            session.picture || null,
            session.ipAddress || null,
            session.userAgent || null,
            now,
            now,
            session.expiresAt,
        );
}

export function getAdminSession(tokenHash) {
    const now = nowIso();
    const row = getDatabase()
        .prepare('SELECT * FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
        .get(tokenHash, now);
    if (!row) return null;

    getDatabase()
        .prepare('UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ?')
        .run(now, tokenHash);

    return {
        tokenHash: row.token_hash,
        email: row.email,
        name: row.name,
        picture: row.picture,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        createdAt: row.created_at,
        lastSeenAt: now,
        expiresAt: row.expires_at,
    };
}

export function deleteAdminSession(tokenHash) {
    return getDatabase()
        .prepare('DELETE FROM admin_sessions WHERE token_hash = ?')
        .run(tokenHash).changes > 0;
}

export function deleteExpiredAdminSessions() {
    return getDatabase()
        .prepare('DELETE FROM admin_sessions WHERE expires_at <= ?')
        .run(nowIso()).changes;
}
