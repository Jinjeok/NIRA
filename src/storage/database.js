import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'nira.sqlite');

let db;

function resolveDatabasePath() {
    if (process.env.NIRA_DB_PATH === ':memory:') {
        return ':memory:';
    }
    return path.resolve(process.env.NIRA_DB_PATH || DEFAULT_DB_PATH);
}

function migrate(database) {
    database.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS command_settings (
            command_name TEXT PRIMARY KEY,
            enabled INTEGER NOT NULL DEFAULT 1,
            admin_only INTEGER NOT NULL DEFAULT 0,
            cooldown_seconds INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS command_execution_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            command_name TEXT NOT NULL,
            user_id TEXT,
            guild_id TEXT,
            channel_id TEXT,
            status TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            error_message TEXT,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_command_execution_logs_created_at
            ON command_execution_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_command_execution_logs_command_name
            ON command_execution_logs(command_name);

        CREATE TABLE IF NOT EXISTS sessions (
            session_key TEXT PRIMARY KEY,
            history_json TEXT NOT NULL,
            last_update INTEGER NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS conversations (
            interaction_id TEXT PRIMARY KEY,
            data_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS usage_counters (
            model TEXT NOT NULL,
            date TEXT NOT NULL,
            count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (model, date)
        );

        CREATE TABLE IF NOT EXISTS state_values (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scheduler_jobs (
            job_id TEXT PRIMARY KEY,
            handler_key TEXT NOT NULL,
            cron_expression TEXT NOT NULL,
            timezone TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            last_run_at TEXT,
            last_status TEXT,
            last_error TEXT,
            last_duration_ms INTEGER,
            run_count INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scheduler_run_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT NOT NULL,
            status TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            error_message TEXT,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_scheduler_run_logs_created_at
            ON scheduler_run_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_scheduler_run_logs_job_id
            ON scheduler_run_logs(job_id);

        CREATE TABLE IF NOT EXISTS admin_auth_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT NOT NULL,
            email TEXT,
            provider TEXT NOT NULL DEFAULT 'google',
            status TEXT NOT NULL,
            reason TEXT,
            user_agent TEXT,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_admin_auth_logs_ip_created_at
            ON admin_auth_logs(ip_address, created_at);
        CREATE INDEX IF NOT EXISTS idx_admin_auth_logs_status
            ON admin_auth_logs(status);

        CREATE TABLE IF NOT EXISTS admin_ip_bans (
            ip_address TEXT PRIMARY KEY,
            reason TEXT NOT NULL,
            failed_count INTEGER NOT NULL,
            banned_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS admin_sessions (
            token_hash TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            name TEXT,
            picture TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
            ON admin_sessions(expires_at);
    `);
}

export function getDatabase() {
    if (!db) {
        const databasePath = resolveDatabasePath();
        if (databasePath !== ':memory:') {
            fs.mkdirSync(path.dirname(databasePath), { recursive: true });
        }
        db = new DatabaseSync(databasePath);
        migrate(db);
    }

    return db;
}

export function getDatabasePath() {
    return resolveDatabasePath();
}
