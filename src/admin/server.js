import 'dotenv/config';
import crypto from 'node:crypto';
import http from 'node:http';
import { URL, pathToFileURL } from 'node:url';
import logger, { getRecentLogs } from '../logger.js';
import { deployCommands } from '../utils/deployCommands.js';
import { RUNTIME_CODENAMES, runtimeLabel } from '../runtime/codenames.js';
import {
    banAdminIp,
    countRecentAdminAuthFailures,
    createAdminSession,
    deleteAdminSession,
    deleteExpiredAdminSessions,
    ensureDefaultSettings,
    getAdminIpBan,
    getAdminSession,
    getNumberSetting,
    getSetting,
    listAdminAuthLogs,
    listAdminIpBans,
    listCommandExecutionLogs,
    listCommandSettings,
    listSchedulerJobs,
    listSchedulerRunLogs,
    recordAdminAuthLog,
    setSetting,
    updateCommandSetting,
    updateSchedulerJob,
} from '../storage/appStore.js';
import { getDatabasePath } from '../storage/database.js';

const DEFAULT_HOST = process.env.ADMIN_HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.ADMIN_PORT || 3100);
const COOKIE_NAME = 'nira_admin_session';
const AUTH_FAILURE_LIMIT = Number(process.env.ADMIN_AUTH_FAILURE_LIMIT || 10);
const AUTH_FAILURE_WINDOW_HOURS = Number(process.env.ADMIN_AUTH_FAILURE_WINDOW_HOURS || 24);
const SESSION_TTL_HOURS = Number(process.env.ADMIN_SESSION_TTL_HOURS || 12);
const oauthStates = new Map();

function nowIso() {
    return new Date().toISOString();
}

function send(res, status, body, headers = {}) {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...headers,
    });
    res.end(payload);
}

function sendJson(res, status, body) {
    send(res, status, body, { 'Content-Type': 'application/json; charset=utf-8' });
}

function redirect(res, location, headers = {}) {
    res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', ...headers });
    res.end();
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[ch]));
}

function parseCookies(req) {
    return Object.fromEntries((req.headers.cookie || '')
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const index = part.indexOf('=');
            if (index === -1) return [part, ''];
            return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
        }));
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function clientIp(req) {
    if (process.env.ADMIN_TRUST_PROXY === 'true') {
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            return String(forwarded).split(',')[0].trim();
        }
    }

    const address = req.socket.remoteAddress || 'unknown';
    return address.startsWith('::ffff:') ? address.slice(7) : address;
}

function normalizeIp(ipAddress) {
    const ip = String(ipAddress || '').trim().toLowerCase();
    return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function ipv4ToInt(ipAddress) {
    const parts = ipAddress.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return null;
    }
    return parts.reduce((total, part) => ((total << 8) + part) >>> 0, 0);
}

function ipv4CidrContains(ipAddress, cidr) {
    const [range, bitsText] = cidr.split('/');
    const bits = Number(bitsText);
    const ip = ipv4ToInt(ipAddress);
    const base = ipv4ToInt(range);
    if (ip == null || base == null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
        return false;
    }
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (ip & mask) === (base & mask);
}

function authWhitelistEntries() {
    const entries = (process.env.ADMIN_AUTH_WHITELIST_IPS || process.env.ADMIN_IP_WHITELIST || '')
        .split(',')
        .map((value) => normalizeIp(value))
        .filter(Boolean);

    if (process.env.ADMIN_AUTH_WHITELIST_LOOPBACK !== 'false') {
        entries.push('127.0.0.1', '::1');
    }

    return [...new Set(entries)];
}

function isWhitelistedIp(ipAddress) {
    const ip = normalizeIp(ipAddress);
    return authWhitelistEntries().some((entry) => {
        if (entry.includes('/')) return ipv4CidrContains(ip, entry);
        return entry === ip;
    });
}

function isDevAuthBypassed() {
    return process.env.ADMIN_AUTH_BYPASS === 'true' || process.env.NODE_ENV === 'development';
}

function requestOrigin(req) {
    if (process.env.ADMIN_PUBLIC_URL) {
        return process.env.ADMIN_PUBLIC_URL.replace(/\/$/, '');
    }
    const proto = process.env.ADMIN_PUBLIC_PROTOCOL || 'http';
    return `${proto}://${req.headers.host || `${DEFAULT_HOST}:${DEFAULT_PORT}`}`;
}

function googleConfig(req) {
    const clientId = process.env.GOOGLE_AUTH_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_AUTH_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI || `${requestOrigin(req)}/auth/google/callback`;
    const allowedEmails = (process.env.GOOGLE_AUTH_ALLOWED_EMAILS || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    const allowedDomains = (process.env.GOOGLE_AUTH_ALLOWED_DOMAINS || '')
        .split(',')
        .map((value) => value.trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean);

    return {
        clientId,
        clientSecret,
        redirectUri,
        allowedEmails,
        allowedDomains,
        configured: Boolean(clientId && clientSecret),
        allowlistConfigured: allowedEmails.length > 0 || allowedDomains.length > 0,
    };
}

function isEmailAllowed(email, config) {
    const normalized = String(email || '').toLowerCase();
    const domain = normalized.split('@')[1] || '';
    return config.allowedEmails.includes(normalized) || config.allowedDomains.includes(domain);
}

function safeReturnTo(value) {
    if (!value || !String(value).startsWith('/') || String(value).startsWith('//')) return '/';
    return value;
}

function sessionCookie(token, req) {
    const secure = process.env.ADMIN_COOKIE_SECURE === 'true' || requestOrigin(req).startsWith('https://');
    const maxAge = Math.max(1, SESSION_TTL_HOURS) * 60 * 60;
    return [
        `${COOKIE_NAME}=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${maxAge}`,
        secure ? 'Secure' : '',
    ].filter(Boolean).join('; ');
}

function clearSessionCookie() {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function currentSession(req) {
    if (isDevAuthBypassed()) {
        return {
            email: 'dev@nira.local',
            name: 'Development Auth Bypass',
            picture: null,
            ipAddress: clientIp(req),
            authBypass: true,
            createdAt: nowIso(),
            lastSeenAt: nowIso(),
            expiresAt: null,
        };
    }

    const token = parseCookies(req)[COOKIE_NAME];
    if (!token) return null;
    return getAdminSession(hashToken(token));
}

async function readJson(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (!chunks.length) return {};
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function commandMetadata(runtime) {
    return runtime?.commandMetadata || runtime?.client?.commandMetadata || [];
}

function schedulerJobs(runtime) {
    return runtime?.scheduler?.getJobs ? runtime.scheduler.getJobs() : listSchedulerJobs();
}

function cleanupOauthStates() {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [state, value] of oauthStates.entries()) {
        if (value.createdAt < cutoff) oauthStates.delete(state);
    }
}

function recordAuthFailure(req, ipAddress, reason, email = null) {
    const whitelisted = isWhitelistedIp(ipAddress);
    recordAdminAuthLog({
        ipAddress,
        email,
        status: whitelisted ? 'failure_whitelisted' : 'failure',
        reason: whitelisted ? `${reason}; whitelist_no_ban` : reason,
        userAgent: req.headers['user-agent'] || null,
    });

    if (whitelisted) {
        logger.warn(`[AdminAuth] Auth failure from whitelisted IP ${ipAddress}; ban skipped`);
        return 0;
    }

    const failedCount = countRecentAdminAuthFailures(ipAddress, AUTH_FAILURE_WINDOW_HOURS);
    if (failedCount >= AUTH_FAILURE_LIMIT && !getAdminIpBan(ipAddress)) {
        banAdminIp(ipAddress, `${AUTH_FAILURE_WINDOW_HOURS}h auth failures >= ${AUTH_FAILURE_LIMIT}`, failedCount);
        logger.warn(`[AdminAuth] Permanently banned IP ${ipAddress} after ${failedCount} failed auth attempts`);
    }

    return failedCount;
}

function recordAuthSuccess(req, ipAddress, email) {
    recordAdminAuthLog({
        ipAddress,
        email,
        status: 'success',
        reason: 'google_oauth',
        userAgent: req.headers['user-agent'] || null,
    });
}

async function exchangeCodeForToken(config, code) {
    const body = new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!response.ok) {
        throw new Error(`Google token exchange failed: HTTP ${response.status}`);
    }

    return response.json();
}

async function fetchGoogleUser(accessToken) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new Error(`Google userinfo failed: HTTP ${response.status}`);
    }

    return response.json();
}

function loginPage({ req, error = null, banned = null }) {
    const config = googleConfig(req);
    const loginDisabled = !config.configured || !config.allowlistConfigured || banned;
    const setupProblems = [
        !config.configured ? 'GOOGLE_AUTH_CLIENT_ID / GOOGLE_AUTH_CLIENT_SECRET 설정이 필요합니다.' : null,
        !config.allowlistConfigured ? 'GOOGLE_AUTH_ALLOWED_EMAILS 또는 GOOGLE_AUTH_ALLOWED_DOMAINS 설정이 필요합니다.' : null,
    ].filter(Boolean);
    const loginHref = `/auth/google?returnTo=${encodeURIComponent('/')}`;

    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NIRA Admin Login</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f7f9; color: #1d2430; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(460px, calc(100vw - 32px)); background: #fff; border: 1px solid #d8dde5; border-radius: 8px; padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { color: #667085; line-height: 1.5; }
    a, button { display: inline-flex; align-items: center; justify-content: center; min-height: 38px; padding: 8px 12px; border-radius: 6px; border: 1px solid #0f766e; background: #0f766e; color: #fff; text-decoration: none; font: inherit; cursor: pointer; }
    .disabled { pointer-events: none; opacity: .45; }
    .error { color: #b42318; background: #fff1f0; border: 1px solid #f3b4ad; border-radius: 6px; padding: 10px 12px; }
    code { background: #f2f4f7; padding: 1px 4px; border-radius: 4px; }
    ul { padding-left: 20px; color: #667085; }
  </style>
</head>
<body>
  <main>
    <h1>NIRA ${escapeHtml(runtimeLabel('admin'))}</h1>
    <p>Google 계정으로 로그인해주세요.</p>
    ${banned ? `<div class="error">이 IP는 영구 밴되었습니다. 사유: ${escapeHtml(banned.reason)}</div>` : ''}
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    ${setupProblems.length ? `<ul>${setupProblems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
    <p><a class="${loginDisabled ? 'disabled' : ''}" href="${loginDisabled ? '#' : loginHref}">Google로 로그인</a></p>
    <p><code>${escapeHtml(config.redirectUri)}</code></p>
  </main>
</body>
</html>`;
}

function adminPage(user) {
    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NIRA ${runtimeLabel('admin')}</title>
  <style>
    :root { --bg: #f6f7f9; --panel: #fff; --line: #d8dde5; --text: #1d2430; --muted: #667085; --accent: #0f766e; --danger: #b42318; --warn: #b54708; --ok: #067647; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: 0; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 24px; border-bottom: 1px solid var(--line); background: var(--panel); position: sticky; top: 0; z-index: 2; }
    h1 { font-size: 20px; margin: 0; font-weight: 700; }
    main { max-width: 1280px; margin: 0 auto; padding: 20px 24px 40px; }
    button, input { min-height: 34px; border: 1px solid var(--line); border-radius: 6px; background: #fff; color: var(--text); font: inherit; padding: 6px 10px; }
    button { cursor: pointer; }
    button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
    button.active { border-color: var(--accent); color: var(--accent); font-weight: 700; }
    .toolbar, .tabs, .row-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .tabs { margin-bottom: 16px; }
    .grid { display: grid; gap: 16px; }
    .summary { grid-template-columns: repeat(4, minmax(160px, 1fr)); margin-bottom: 16px; }
    .metric, section { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
    .metric { padding: 14px; }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; font-size: 20px; margin-top: 6px; overflow-wrap: anywhere; }
    section { overflow: hidden; }
    section h2 { font-size: 15px; margin: 0; padding: 14px 16px; border-bottom: 1px solid var(--line); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; font-size: 13px; }
    th { color: var(--muted); font-weight: 600; background: #fafbfc; }
    td code, td { overflow-wrap: anywhere; }
    tr:last-child td { border-bottom: 0; }
    .success, .enabled { color: var(--ok); font-weight: 700; }
    .error, .failure, .disabled { color: var(--danger); font-weight: 700; }
    .failure_whitelisted { color: var(--warn); font-weight: 700; }
    .blocked { color: var(--warn); font-weight: 700; }
    .muted { color: var(--muted); }
    .cron-input { width: 160px; }
    .tz-input { width: 120px; }
    .webhook-input { width: 100%; min-width: 180px; margin-top: 6px; }
    .number-input { width: 86px; }
    .hidden { display: none; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-top: 4px; }
    .tag-webhook { background: #e0f2fe; color: #0369a1; }
    .tag-channel { background: #dcfce7; color: #15803d; }
    .tag-internal { background: #f3f4f6; color: #6b7280; }
    .sched-actions { display: flex; gap: 6px; align-items: center; flex-wrap: nowrap; }
    .log-viewer { max-height: 480px; overflow-y: auto; padding: 10px 14px; font-family: ui-monospace, monospace; font-size: 12px; background: #0d1117; border-radius: 0 0 8px 8px; }
    .log-line { padding: 1px 0; white-space: pre-wrap; word-break: break-all; color: #8b949e; }
    .log-line.log-error { color: #f85149; }
    .log-line.log-warn { color: #e3b341; }
    .log-line.log-info { color: #c9d1d9; }
    @media (max-width: 820px) { header { align-items: flex-start; flex-direction: column; } main { padding: 14px; } .summary { grid-template-columns: 1fr 1fr; } table { min-width: 920px; } section { overflow-x: auto; } }
  </style>
</head>
<body>
  <header>
    <h1>NIRA ${runtimeLabel('admin')}</h1>
    <div class="toolbar">
      <span class="muted">${escapeHtml(user.email)}</span>
      <button id="refresh" class="primary">새로고침</button>
      <button id="logout">로그아웃</button>
    </div>
  </header>
  <main>
    <div class="tabs">
      <button class="tab active" data-view="commands">명령어</button>
      <button class="tab" data-view="schedules">스케줄러</button>
      <button class="tab" data-view="logs">실행 기록</button>
      <button class="tab" data-view="applogs">앱 로그</button>
      <button class="tab" data-view="security">보안</button>
      <button class="tab" data-view="settings">설정</button>
    </div>
    <div class="grid summary" id="summary"></div>
    <div id="commands" class="view"></div>
    <div id="schedules" class="view hidden"></div>
    <div id="logs" class="view hidden"></div>
    <div id="applogs" class="view hidden"></div>
    <div id="security" class="view hidden"></div>
    <div id="settings" class="view hidden"></div>
  </main>
  <script>
    const state = { view: 'commands', data: null };
    async function api(path, options = {}) {
      const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
      if (res.status === 401) { location.href = '/login'; return null; }
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
    function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
    function renderSummary() {
      const commands = state.data.commands || [];
      const schedules = state.data.schedules || [];
      const commandErrors = (state.data.commandLogs || []).filter((log) => log.status === 'error').length;
      const authFailures = (state.data.authLogs || []).filter((log) => String(log.status).startsWith('failure')).length;
      document.querySelector('#summary').innerHTML = [
        ['명령어', commands.length],
        ['활성 스케줄', schedules.filter((job) => job.enabled).length + '/' + schedules.length],
        ['명령어 실패', commandErrors],
        ['인증 실패', authFailures],
        ['Bot', state.data.health.codenames.bot],
        ['Scheduler', state.data.health.codenames.scheduler],
        ['Admin', state.data.health.codenames.admin],
        ['DB', state.data.health.databasePath.split(/[\\\\/]/).pop()],
      ].map(([label, value]) => '<div class="metric"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>').join('');
    }
    function renderCommands() {
      const rows = (state.data.commands || []).map((cmd) => '<tr>' +
        '<td><code>' + esc(cmd.name) + '</code><div class="muted">' + esc(cmd.description) + '</div></td>' +
        '<td class="' + (cmd.enabled ? 'enabled' : 'disabled') + '">' + (cmd.enabled ? '활성' : '비활성') + '</td>' +
        '<td>' + esc(cmd.executionCount) + '</td><td>' + esc(cmd.successCount) + ' / ' + esc(cmd.errorCount) + '</td><td>' + esc(cmd.avgDurationMs ?? '-') + '</td>' +
        '<td><div class="row-actions"><button data-command="' + esc(cmd.name) + '" data-enabled="' + (!cmd.enabled) + '">' + (cmd.enabled ? '끄기' : '켜기') + '</button>' +
        '<label><input class="admin-only" type="checkbox" data-command="' + esc(cmd.name) + '"' + (cmd.adminOnly ? ' checked' : '') + '> 관리자</label></div></td></tr>').join('');
      document.querySelector('#commands').innerHTML =
        '<section><h2>명령어 관리</h2>' +
        '<div style="padding:12px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px">' +
        '<button id="deploy-commands" class="primary">Discord에 커맨드 배포</button>' +
        '<span class="muted" style="font-size:13px">활성 커맨드만 Discord에 등록됩니다. 비활성 커맨드는 슬래시 목록에서 제거됩니다.</span>' +
        '</div>' +
        '<table><thead><tr><th>명령어</th><th>상태</th><th>실행</th><th>성공/실패</th><th>평균 ms</th><th>작업</th></tr></thead><tbody>' + rows + '</tbody></table></section>';
    }
    function renderSchedules() {
      const typeLabel = { webhook: '웹훅', channel: '채널', internal: '내부' };
      const rows = (state.data.schedules || []).map((job) => {
        const type = job.targetType || 'internal';
        const jobCell = '<td style="min-width:160px">' +
          '<code style="white-space:nowrap">' + esc(job.jobId) + '</code>' +
          '<div class="muted" style="white-space:nowrap">' + esc(job.handlerKey) + '</div>' +
          (type === 'webhook' ? '<input class="webhook-input" data-job-webhook="' + esc(job.jobId) + '" value="' + esc(job.webhookUrl || '') + '" placeholder="https://discord.com/api/webhooks/...">' : '') +
          (type === 'channel' ? '<input class="webhook-input" data-job-webhook="' + esc(job.jobId) + '" value="' + esc(job.webhookUrl || '') + '" placeholder="채널 ID">' : '') +
          '</td>';
        return '<tr>' +
          jobCell +
          '<td style="white-space:nowrap">' +
            '<span class="' + (job.enabled ? 'enabled' : 'disabled') + '">' + (job.enabled ? '활성' : '비활성') + (job.running ? ' · 실행중' : '') + '</span>' +
            '<div><span class="tag tag-' + esc(type) + '">' + esc(typeLabel[type] || type) + '</span></div>' +
          '</td>' +
          '<td><input class="cron-input" data-job="' + esc(job.jobId) + '" value="' + esc(job.cronExpression) + '"></td>' +
          '<td><input class="tz-input" data-job-tz="' + esc(job.jobId) + '" value="' + esc(job.timezone) + '"></td>' +
          '<td class="' + esc(job.lastStatus || '') + '" style="white-space:nowrap">' + esc(job.lastStatus || '-') + '<div class="muted">' + esc(job.lastRunAt || '') + '</div></td>' +
          '<td><div class="sched-actions"><button data-save-job="' + esc(job.jobId) + '">저장</button><button data-toggle-job="' + esc(job.jobId) + '" data-enabled="' + (!job.enabled) + '">' + (job.enabled ? '끄기' : '켜기') + '</button><button data-run-job="' + esc(job.jobId) + '">실행</button></div></td>' +
          '</tr>';
      }).join('');
      document.querySelector('#schedules').innerHTML = '<section><h2>스케줄러 현황</h2><table style="table-layout:auto"><thead><tr><th>Job / 웹훅 URL</th><th>상태 / 타입</th><th>Cron</th><th>Timezone</th><th>최근 결과</th><th>작업</th></tr></thead><tbody>' + rows + '</tbody></table></section>';
    }
    function renderLogs() {
      const commandRows = (state.data.commandLogs || []).map((log) => '<tr><td>' + esc(log.createdAt) + '</td><td><code>' + esc(log.commandName) + '</code></td><td class="' + esc(log.status) + '">' + esc(log.status) + '</td><td>' + esc(log.durationMs) + '</td><td>' + esc(log.errorMessage || '') + '</td></tr>').join('');
      const schedulerRows = (state.data.schedulerLogs || []).map((log) => '<tr><td>' + esc(log.createdAt) + '</td><td><code>' + esc(log.jobId) + '</code></td><td class="' + esc(log.status) + '">' + esc(log.status) + '</td><td>' + esc(log.durationMs) + '</td><td>' + esc(log.errorMessage || '') + '</td></tr>').join('');
      document.querySelector('#logs').innerHTML = '<div class="grid"><section><h2>명령어 실행 기록</h2><table><thead><tr><th>시각</th><th>명령어</th><th>상태</th><th>ms</th><th>오류</th></tr></thead><tbody>' + commandRows + '</tbody></table></section><section><h2>스케줄러 실행 기록</h2><table><thead><tr><th>시각</th><th>Job</th><th>상태</th><th>ms</th><th>오류</th></tr></thead><tbody>' + schedulerRows + '</tbody></table></section></div>';
    }
    function renderSecurity() {
      const authRows = (state.data.authLogs || []).map((log) => '<tr><td>' + esc(log.createdAt) + '</td><td><code>' + esc(log.ipAddress) + '</code></td><td>' + esc(log.email || '') + '</td><td class="' + esc(log.status) + '">' + esc(log.status) + '</td><td>' + esc(log.reason || '') + '</td></tr>').join('');
      const banRows = (state.data.ipBans || []).map((ban) => '<tr><td><code>' + esc(ban.ipAddress) + '</code></td><td>' + esc(ban.failedCount) + '</td><td>' + esc(ban.reason) + '</td><td>' + esc(ban.bannedAt) + '</td></tr>').join('');
      document.querySelector('#security').innerHTML = '<div class="grid"><section><h2>Google Auth 로그</h2><table><thead><tr><th>시각</th><th>IP</th><th>Email</th><th>상태</th><th>사유</th></tr></thead><tbody>' + authRows + '</tbody></table></section><section><h2>영구 IP 밴</h2><table><thead><tr><th>IP</th><th>실패 수</th><th>사유</th><th>밴 시각</th></tr></thead><tbody>' + banRows + '</tbody></table></section></div>';
    }
    function renderSettings() {
      const settings = state.data.settings || {};
      document.querySelector('#settings').innerHTML = '<section><h2>보관 설정</h2><table><tbody>' +
        '<tr><td>명령어 실행 기록 보관일</td><td><input class="number-input" id="command-retention" type="number" min="1" value="' + esc(settings.commandLogRetentionDays) + '"></td></tr>' +
        '<tr><td>스케줄러 실행 기록 보관일</td><td><input class="number-input" id="scheduler-retention" type="number" min="1" value="' + esc(settings.schedulerLogRetentionDays) + '"></td></tr>' +
        '<tr><td>인증 방식</td><td class="muted">' + (state.data.health.authBypass ? 'dev auth bypass' : esc(state.data.health.auth)) + '</td></tr>' +
        '<tr><td>인증 실패 밴 기준</td><td class="muted">' + esc(state.data.health.authFailureLimit) + '회 / ' + esc(state.data.health.authFailureWindowHours) + '시간</td></tr>' +
        '<tr><td>밴 제외 IP</td><td class="muted">' + esc((state.data.health.authWhitelistIps || []).join(', ') || '-') + '</td></tr>' +
        '<tr><td></td><td><button id="save-settings" class="primary">저장</button></td></tr></tbody></table></section>';
    }
    function renderAppLogs() {
      const logs = state.data.appLogs || [];
      const lines = logs.map(log => {
        const cls = log.level === 'error' ? 'log-error' : log.level === 'warn' ? 'log-warn' : 'log-info';
        return '<div class="log-line ' + cls + '">' + esc(log.text) + '</div>';
      }).join('');
      document.querySelector('#applogs').innerHTML = '<section><h2>앱 로그 <span class="muted" style="font-weight:400;font-size:12px">최근 ' + logs.length + '건</span></h2><div class="log-viewer">' + (lines || '<div style="padding:8px;color:#8b949e">로그 없음</div>') + '</div></section>';
    }
    function render() {
      renderSummary(); renderCommands(); renderSchedules(); renderLogs(); renderAppLogs(); renderSecurity(); renderSettings();
      document.querySelectorAll('.view').forEach((node) => node.classList.toggle('hidden', node.id !== state.view));
      document.querySelectorAll('.tab').forEach((node) => node.classList.toggle('active', node.dataset.view === state.view));
    }
    async function load() {
      const [health, commands, commandLogs, schedules, schedulerLogs, settings, authLogs, ipBans, appLogs] = await Promise.all([
        api('/api/health'), api('/api/commands'), api('/api/command-logs?limit=100'), api('/api/schedules'), api('/api/scheduler-logs?limit=100'), api('/api/settings'), api('/api/admin-auth-logs?limit=100'), api('/api/admin-ip-bans?limit=100'), api('/api/logs?limit=200')
      ]);
      state.data = { health, commands, commandLogs, schedules, schedulerLogs, settings, authLogs, ipBans, appLogs };
      render();
    }
    document.addEventListener('click', async (event) => {
      const target = event.target;
      if (target.matches('.tab')) { state.view = target.dataset.view; render(); }
      if (target.id === 'refresh') await load();
      if (target.id === 'logout') { await fetch('/auth/logout', { method: 'POST' }); location.href = '/login'; }
      if (target.id === 'deploy-commands') {
        try {
          target.disabled = true; target.textContent = '배포 중...';
          const result = await api('/api/deploy-commands', { method: 'POST' });
          alert('배포 완료: ' + result.deployed + '개 커맨드가 Discord에 등록됐습니다.');
          await load();
        } catch (err) { alert('배포 실패: ' + err.message); }
        finally { target.disabled = false; target.textContent = 'Discord에 커맨드 배포'; }
      }
      if (target.dataset.command) { await api('/api/commands/' + encodeURIComponent(target.dataset.command), { method: 'PATCH', body: JSON.stringify({ enabled: target.dataset.enabled === 'true' }) }); await load(); }
      if (target.matches('.admin-only')) { await api('/api/commands/' + encodeURIComponent(target.dataset.command), { method: 'PATCH', body: JSON.stringify({ adminOnly: target.checked }) }); await load(); }
      if (target.dataset.saveJob) {
        try {
          const jobId = target.dataset.saveJob;
          const patch = { cronExpression: document.querySelector('[data-job="' + CSS.escape(jobId) + '"]').value, timezone: document.querySelector('[data-job-tz="' + CSS.escape(jobId) + '"]').value };
          const webhookInput = document.querySelector('[data-job-webhook="' + CSS.escape(jobId) + '"]');
          if (webhookInput) patch.webhookUrl = webhookInput.value;
          await api('/api/schedules/' + encodeURIComponent(jobId), { method: 'PATCH', body: JSON.stringify(patch) });
          await load();
        } catch (err) { alert('저장 실패: ' + err.message); }
      }
      if (target.dataset.toggleJob) { await api('/api/schedules/' + encodeURIComponent(target.dataset.toggleJob), { method: 'PATCH', body: JSON.stringify({ enabled: target.dataset.enabled === 'true' }) }); await load(); }
      if (target.dataset.runJob) { await api('/api/schedules/' + encodeURIComponent(target.dataset.runJob) + '/run', { method: 'POST' }); await load(); }
      if (target.id === 'save-settings') {
        await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ commandLogRetentionDays: Number(document.querySelector('#command-retention').value), schedulerLogRetentionDays: Number(document.querySelector('#scheduler-retention').value) }) });
        await load();
      }
    });
    load().catch((error) => { document.querySelector('main').innerHTML = '<section><h2>오류</h2><div style="padding:16px;color:#b42318">' + esc(error.message) + '</div></section>'; });
  </script>
</body>
</html>`;
}

function makeHealth(runtime, user) {
    return {
        ok: true,
        databasePath: getDatabasePath(),
        schedulerAttached: Boolean(runtime?.scheduler),
        user,
        auth: 'google',
        authBypass: isDevAuthBypassed(),
        authWhitelistIps: authWhitelistEntries(),
        authFailureLimit: AUTH_FAILURE_LIMIT,
        authFailureWindowHours: AUTH_FAILURE_WINDOW_HOURS,
        codenames: {
            bot: runtimeLabel('bot'),
            scheduler: runtimeLabel('scheduler'),
            admin: runtimeLabel('admin'),
        },
        codenameRegistry: RUNTIME_CODENAMES,
    };
}

async function handleGoogleStart(req, res, url) {
    const ipAddress = clientIp(req);
    const config = googleConfig(req);
    if (!config.configured || !config.allowlistConfigured) {
        send(res, 500, loginPage({ req, error: 'Google OAuth 설정이 아직 완료되지 않았습니다.' }));
        return;
    }

    cleanupOauthStates();
    const state = crypto.randomBytes(24).toString('hex');
    oauthStates.set(state, {
        createdAt: Date.now(),
        returnTo: safeReturnTo(url.searchParams.get('returnTo')),
        ipAddress,
    });

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
    });

    redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

async function handleGoogleCallback(req, res, url) {
    const ipAddress = clientIp(req);
    const config = googleConfig(req);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const stored = state ? oauthStates.get(state) : null;

    try {
        if (error) {
            recordAuthFailure(req, ipAddress, `oauth_error:${error}`);
            redirect(res, `/login?error=${encodeURIComponent(`Google OAuth 오류: ${error}`)}`);
            return;
        }
        if (!stored || Date.now() - stored.createdAt > 10 * 60 * 1000) {
            recordAuthFailure(req, ipAddress, 'invalid_or_expired_state');
            redirect(res, '/login?error=인증 세션이 만료되었습니다. 다시 로그인해주세요.');
            return;
        }
        oauthStates.delete(state);

        if (!code) {
            recordAuthFailure(req, ipAddress, 'missing_code');
            redirect(res, '/login?error=Google 인증 코드가 없습니다.');
            return;
        }

        const token = await exchangeCodeForToken(config, code);
        const profile = await fetchGoogleUser(token.access_token);
        const email = String(profile.email || '').toLowerCase();

        if (!profile.email_verified) {
            recordAuthFailure(req, ipAddress, 'email_not_verified', email);
            redirect(res, '/login?error=검증되지 않은 Google 이메일입니다.');
            return;
        }
        if (!isEmailAllowed(email, config)) {
            recordAuthFailure(req, ipAddress, 'email_not_allowed', email);
            redirect(res, '/login?error=허용되지 않은 Google 계정입니다.');
            return;
        }

        const sessionToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
        createAdminSession({
            tokenHash: hashToken(sessionToken),
            email,
            name: profile.name,
            picture: profile.picture,
            ipAddress,
            userAgent: req.headers['user-agent'] || null,
            expiresAt,
        });
        recordAuthSuccess(req, ipAddress, email);
        redirect(res, stored.returnTo || '/', { 'Set-Cookie': sessionCookie(sessionToken, req) });
    } catch (callbackError) {
        logger.error('[AdminAuth] Google callback failed:', callbackError);
        recordAuthFailure(req, ipAddress, callbackError.message);
        redirect(res, '/login?error=Google 로그인 처리 중 오류가 발생했습니다.');
    }
}

async function handleApi(req, res, url, runtime, session) {
    if (req.method === 'GET' && url.pathname === '/api/health') {
        sendJson(res, 200, makeHealth(runtime, session));
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/settings') {
        sendJson(res, 200, {
            commandLogRetentionDays: getNumberSetting('command_log_retention_days', 30),
            schedulerLogRetentionDays: getNumberSetting('scheduler_log_retention_days', 30),
            migratedAt: getSetting('local_state_migrated_at'),
        });
        return;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/settings') {
        const body = await readJson(req);
        if (body.commandLogRetentionDays != null) {
            setSetting('command_log_retention_days', Math.max(1, Number(body.commandLogRetentionDays) || 30));
        }
        if (body.schedulerLogRetentionDays != null) {
            setSetting('scheduler_log_retention_days', Math.max(1, Number(body.schedulerLogRetentionDays) || 30));
        }
        sendJson(res, 200, { ok: true });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/commands') {
        sendJson(res, 200, listCommandSettings(commandMetadata(runtime)));
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/command-logs') {
        sendJson(res, 200, listCommandExecutionLogs({
            limit: url.searchParams.get('limit') || 100,
            commandName: url.searchParams.get('command') || undefined,
            status: url.searchParams.get('status') || undefined,
        }));
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/schedules') {
        sendJson(res, 200, schedulerJobs(runtime));
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/scheduler-logs') {
        sendJson(res, 200, listSchedulerRunLogs({
            limit: url.searchParams.get('limit') || 100,
            jobId: url.searchParams.get('job') || undefined,
            status: url.searchParams.get('status') || undefined,
        }));
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/admin-auth-logs') {
        sendJson(res, 200, listAdminAuthLogs({
            limit: url.searchParams.get('limit') || 100,
            status: url.searchParams.get('status') || undefined,
            ipAddress: url.searchParams.get('ip') || undefined,
            email: url.searchParams.get('email') || undefined,
        }));
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/admin-ip-bans') {
        sendJson(res, 200, listAdminIpBans({ limit: url.searchParams.get('limit') || 100 }));
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/deploy-commands') {
        try {
            const settings = listCommandSettings(commandMetadata(runtime));
            const enabledNames = new Set(settings.filter(s => s.enabled).map(s => s.name));
            const result = await deployCommands({ enabledNames });
            logger.info(`[Admin] 커맨드 배포 완료: ${result.deployed}개`);
            sendJson(res, 200, result);
        } catch (err) {
            logger.error(`[Admin] 커맨드 배포 실패: ${err.message}`);
            sendJson(res, 500, { error: err.message });
        }
        return;
    }

    const commandMatch = url.pathname.match(/^\/api\/commands\/([^/]+)$/);
    if (req.method === 'PATCH' && commandMatch) {
        const body = await readJson(req);
        sendJson(res, 200, updateCommandSetting(decodeURIComponent(commandMatch[1]), body));
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/logs') {
        const limit = Number(url.searchParams.get('limit') || 200);
        sendJson(res, 200, getRecentLogs({ limit }));
        return;
    }

    const scheduleMatch = url.pathname.match(/^\/api\/schedules\/([^/]+)$/);
    if (req.method === 'PATCH' && scheduleMatch) {
        try {
            const body = await readJson(req);
            const jobId = decodeURIComponent(scheduleMatch[1]);
            logger.info(`[Admin] PATCH schedule ${jobId} ${JSON.stringify(body)}`);
            const updated = runtime?.scheduler?.updateJob
                ? runtime.scheduler.updateJob(jobId, body)
                : updateSchedulerJob(jobId, body);
            sendJson(res, 200, updated);
        } catch (err) {
            logger.error(`[Admin] PATCH schedule 실패: ${err.message}`);
            sendJson(res, 400, { error: err.message });
        }
        return;
    }

    const runMatch = url.pathname.match(/^\/api\/schedules\/([^/]+)\/run$/);
    if (req.method === 'POST' && runMatch) {
        if (!runtime?.scheduler?.runJob) {
            sendJson(res, 409, { error: 'Scheduler is not attached to this admin process' });
            return;
        }
        const result = await runtime.scheduler.runJob(decodeURIComponent(runMatch[1]), 'admin');
        sendJson(res, 200, result);
        return;
    }

    sendJson(res, 404, { error: 'Not found' });
}

function bannedResponse(req, res, url, ban) {
    if (url.pathname.startsWith('/api/')) {
        sendJson(res, 403, { error: 'IP banned', ban });
        return;
    }
    send(res, 403, loginPage({ req, banned: ban }));
}

export function startAdminServer(runtime = {}, options = {}) {
    ensureDefaultSettings();
    deleteExpiredAdminSessions();

    const host = options.host ?? DEFAULT_HOST;
    const port = Number(options.port ?? DEFAULT_PORT);

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);
        const ipAddress = clientIp(req);
        const whitelisted = isWhitelistedIp(ipAddress);
        const ban = whitelisted ? null : getAdminIpBan(ipAddress);

        try {
            if (ban) {
                bannedResponse(req, res, url, ban);
                return;
            }

            if (req.method === 'GET' && url.pathname === '/login') {
                send(res, 200, loginPage({ req, error: url.searchParams.get('error') }));
                return;
            }

            if (req.method === 'GET' && url.pathname === '/auth/google') {
                await handleGoogleStart(req, res, url);
                return;
            }

            if (req.method === 'GET' && url.pathname === '/auth/google/callback') {
                await handleGoogleCallback(req, res, url);
                return;
            }

            if (url.pathname === '/auth/logout') {
                const token = parseCookies(req)[COOKIE_NAME];
                if (token) deleteAdminSession(hashToken(token));
                redirect(res, '/login', { 'Set-Cookie': clearSessionCookie() });
                return;
            }

            const session = currentSession(req);
            if (!session) {
                if (url.pathname.startsWith('/api/')) {
                    sendJson(res, 401, { error: 'Unauthorized', loginUrl: '/login' });
                    return;
                }
                redirect(res, `/login?returnTo=${encodeURIComponent(url.pathname)}`);
                return;
            }

            if (url.pathname.startsWith('/api/')) {
                await handleApi(req, res, url, runtime, session);
                return;
            }

            if (req.method === 'GET' && url.pathname === '/') {
                send(res, 200, adminPage(session));
                return;
            }

            if (req.method === 'GET' && url.pathname === '/favicon.ico') {
                res.writeHead(204);
                res.end();
                return;
            }

            sendJson(res, 404, { error: 'Not found' });
        } catch (error) {
            logger.error('[Admin] Request failed:', error);
            sendJson(res, 500, { error: error.message });
        }
    });

    server.listen(port, host, () => {
        const address = server.address();
        const actualPort = typeof address === 'object' && address ? address.port : port;
        logger.info(`[Admin:${runtimeLabel('admin')}] NIRA admin server listening at http://${host}:${actualPort}`);
        if (!googleConfig({ headers: { host: `${host}:${actualPort}` } }).configured) {
            logger.warn('[Admin] Google OAuth is not configured. Set GOOGLE_AUTH_CLIENT_ID and GOOGLE_AUTH_CLIENT_SECRET.');
        }
    });

    return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    startAdminServer();
}
