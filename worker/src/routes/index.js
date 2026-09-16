/**
 * 路由配置模块
 * @module routes
 */

import { Router, createJwt, buildSessionCookie, verifyMailboxLogin, authMiddleware } from '../middleware/index.js';
import { handleApiRequest } from '../api/index.js';
import { getDatabaseWithValidation } from '../db/index.js';
import { verifyPassword, hashPassword, sha256Hex } from '../utils/common.js';

/**
 * 创建并配置路由器
 * @returns {Router} 配置好的路由器实例
 */
export function createRouter() {
  const router = new Router();

  router.get('/api/public-config', async ({ env }) => {
    const domain = String(env.MAIL_DOMAIN || 'hoodak-team.lol').split(/[,\s]+/)[0];
    return Response.json({
      signupEnabled: String(env.PUBLIC_SIGNUP_ENABLED || '1') !== '0',
      mailDomain: domain,
      turnstileSiteKey: String(env.TURNSTILE_SITE_KEY || '')
    }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  });

  router.post('/api/register', async ({ request, env }) => {
    if (String(env.PUBLIC_SIGNUP_ENABLED || '1') === '0') {
      return Response.json({ message: 'Регистрация временно отключена' }, { status: 403 });
    }
    const JWT_TOKEN = env.JWT_TOKEN || env.JWT_SECRET || '';
    if (!JWT_TOKEN) return Response.json({ message: 'Сервис авторизации не настроен' }, { status: 500 });

    let DB;
    try { DB = await getDatabaseWithValidation(env); }
    catch (_) { return Response.json({ message: 'База данных недоступна' }, { status: 500 }); }

    try {
      const body = await request.json();
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const domain = String(env.MAIL_DOMAIN || 'hoodak-team.lol').split(/[,\s]+/)[0].toLowerCase();
      const adminName = String(env.ADMIN_NAME || 'admin').trim().toLowerCase();
      const reserved = new Set(['admin', 'administrator', 'support', 'help', 'postmaster', 'abuse', 'security', 'root', 'system', 'info', adminName]);

      if (!/^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/.test(username)) {
        return Response.json({ message: 'Логин: 3–32 символа, латинские буквы, цифры, точка, дефис или подчёркивание' }, { status: 400 });
      }
      if (reserved.has(username)) return Response.json({ message: 'Этот адрес зарезервирован' }, { status: 400 });
      if (password.length < 8 || password.length > 72 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        return Response.json({ message: 'Пароль должен содержать 8–72 символа, букву и цифру' }, { status: 400 });
      }

      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ipHash = await sha256Hex(`${JWT_TOKEN}:${ip}`);
      const now = Date.now();
      const rate = await DB.prepare('SELECT window_started_at, attempts FROM signup_rate_limits WHERE ip_hash = ?').bind(ipHash).first();
      if (rate && now - Number(rate.window_started_at) < 3600000 && Number(rate.attempts) >= 5) {
        return Response.json({ message: 'Слишком много попыток. Попробуйте через час' }, { status: 429 });
      }
      if (!rate || now - Number(rate.window_started_at) >= 3600000) {
        await DB.prepare('INSERT INTO signup_rate_limits(ip_hash, window_started_at, attempts) VALUES(?, ?, 1) ON CONFLICT(ip_hash) DO UPDATE SET window_started_at=excluded.window_started_at, attempts=1').bind(ipHash, now).run();
      } else {
        await DB.prepare('UPDATE signup_rate_limits SET attempts = attempts + 1 WHERE ip_hash = ?').bind(ipHash).run();
      }

      const turnstileSecret = String(env.TURNSTILE_SECRET_KEY || '');
      if (turnstileSecret) {
        const token = String(body.turnstileToken || '');
        if (!token) return Response.json({ message: 'Подтвердите, что вы не робот' }, { status: 400 });
        const form = new FormData();
        form.set('secret', turnstileSecret);
        form.set('response', token);
        if (ip !== 'unknown') form.set('remoteip', ip);
        const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
        const result = await verification.json();
        if (!result.success) return Response.json({ message: 'Проверка безопасности не пройдена' }, { status: 400 });
      }

      const address = `${username}@${domain}`;
      const exists = await DB.prepare('SELECT 1 FROM users WHERE username = ? UNION ALL SELECT 1 FROM mailboxes WHERE address = ? LIMIT 1').bind(username, address).all();
      if (exists?.results?.length) return Response.json({ message: 'Такой адрес уже занят' }, { status: 409 });

      const passwordHash = await hashPassword(password);
      await DB.batch([
        DB.prepare("INSERT INTO users(username, password_hash, role, can_send, mailbox_limit) VALUES(?, ?, 'user', 0, 1)").bind(username, passwordHash),
        DB.prepare('INSERT INTO mailboxes(address, local_part, domain, last_accessed_at, can_login) VALUES(?, ?, ?, CURRENT_TIMESTAMP, 0)').bind(address, username, domain),
        DB.prepare('INSERT INTO user_mailboxes(user_id, mailbox_id, is_pinned) SELECT u.id, m.id, 1 FROM users u, mailboxes m WHERE u.username = ? AND m.address = ?').bind(username, address)
      ]);
      const account = await DB.prepare('SELECT u.id AS user_id, m.id AS mailbox_id FROM users u JOIN user_mailboxes um ON um.user_id=u.id JOIN mailboxes m ON m.id=um.mailbox_id WHERE u.username=? LIMIT 1').bind(username).first();
      if (!account) throw new Error('account_creation_failed');

      const sessionDays = parseInt(env.SESSION_EXPIRE_DAYS, 10) || 7;
      const jwt = await createJwt(JWT_TOKEN, { role: 'user', username, userId: account.user_id, mailboxId: account.mailbox_id, mailboxAddress: address }, sessionDays);
      const headers = new Headers({ 'Content-Type': 'application/json' });
      headers.set('Set-Cookie', buildSessionCookie(jwt, request.url, sessionDays));
      return new Response(JSON.stringify({ success: true, username, address }), { status: 201, headers });
    } catch (error) {
      console.error('Public signup failed:', error);
      const duplicate = String(error?.message || '').toLowerCase().includes('unique');
      return Response.json({ message: duplicate ? 'Такой адрес уже занят' : 'Не удалось создать аккаунт' }, { status: duplicate ? 409 : 500 });
    }
  });

  // =================== 认证相关路由 ===================
  router.post('/api/login', async (context) => {
    const { request, env } = context;
    let DB;
    try {
      DB = await getDatabaseWithValidation(env);
    } catch (error) {
      console.error('登录时数据库连接失败:', error.message);
      return new Response('数据库连接失败', { status: 500 });
    }
    const ADMIN_NAME = String(env.ADMIN_NAME || 'admin').trim().toLowerCase();
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || env.ADMIN_PASS || '';
    const GUEST_PASSWORD = env.GUEST_PASSWORD || '';
    const JWT_TOKEN = env.JWT_TOKEN || env.JWT_SECRET || '';
    // 从环境变量读取会话过期天数，默认7天
    const SESSION_EXPIRE_DAYS = parseInt(env.SESSION_EXPIRE_DAYS, 10) || 7;

    try {
      const body = await request.json();
      const name = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '').trim();

      if (!name || !password) {
        return new Response('用户名或密码不能为空', { status: 400 });
      }

      // 1) 管理员
      if (name === ADMIN_NAME && ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
        let adminUserId = 0;
        try {
          const u = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(ADMIN_NAME).all();
          if (u?.results?.length) {
            adminUserId = Number(u.results[0].id);
          } else {
            await DB.prepare("INSERT INTO users (username, role, can_send, mailbox_limit) VALUES (?, 'admin', 1, 9999)").bind(ADMIN_NAME).run();
            const again = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(ADMIN_NAME).all();
            adminUserId = Number(again?.results?.[0]?.id || 0);
          }
        } catch (_) {
          adminUserId = 0;
        }

        const token = await createJwt(JWT_TOKEN, { role: 'admin', username: ADMIN_NAME, userId: adminUserId }, SESSION_EXPIRE_DAYS);
        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.set('Set-Cookie', buildSessionCookie(token, request.url, SESSION_EXPIRE_DAYS));
        return new Response(JSON.stringify({ success: true, role: 'admin', can_send: 1, mailbox_limit: 9999 }), { headers });
      }

      // 2) 访客
      if (name === 'guest' && GUEST_PASSWORD && password === GUEST_PASSWORD) {
        const token = await createJwt(JWT_TOKEN, { role: 'guest', username: 'guest' }, SESSION_EXPIRE_DAYS);
        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.set('Set-Cookie', buildSessionCookie(token, request.url, SESSION_EXPIRE_DAYS));
        return new Response(JSON.stringify({ success: true, role: 'guest' }), { headers });
      }

      // 3) 普通用户. Разрешаем вход как по логину, так и по адресу почты.
      try {
        const domains = String(env.MAIL_DOMAIN || '').split(/[,\s]+/).filter(Boolean).map(v => v.toLowerCase());
        const [emailLocal, emailDomain] = name.split('@');
        const lookupName = emailLocal && emailDomain && domains.includes(emailDomain) ? emailLocal : name;
        const { results } = await DB.prepare('SELECT id, username, password_hash, role, mailbox_limit, can_send FROM users WHERE username = ?').bind(lookupName).all();
        if (results && results.length) {
          const row = results[0];
          const ok = await verifyPassword(password, row.password_hash || '');
          if (ok) {
            const role = (row.role === 'admin') ? 'admin' : 'user';
            const mailbox = await DB.prepare('SELECT m.id, m.address FROM user_mailboxes um JOIN mailboxes m ON m.id=um.mailbox_id WHERE um.user_id=? ORDER BY um.is_pinned DESC, um.id LIMIT 1').bind(row.id).first();
            const token = await createJwt(JWT_TOKEN, { role, username: row.username, userId: row.id, mailboxId: mailbox?.id, mailboxAddress: mailbox?.address }, SESSION_EXPIRE_DAYS);
            const headers = new Headers({ 'Content-Type': 'application/json' });
            headers.set('Set-Cookie', buildSessionCookie(token, request.url, SESSION_EXPIRE_DAYS));
            const canSend = role === 'admin' ? 1 : (row.can_send ? 1 : 0);
            const mailboxLimit = role === 'admin' ? (row.mailbox_limit || 20) : (row.mailbox_limit || 10);
            return new Response(JSON.stringify({ success: true, role, can_send: canSend, mailbox_limit: mailboxLimit }), { headers });
          }
        }
      } catch (_) {
        // 继续尝试邮箱登录
      }

      // 4) 邮箱登录
      try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(name)) {
          const mailboxInfo = await verifyMailboxLogin(name, password, DB);
          if (mailboxInfo) {
            const token = await createJwt(JWT_TOKEN, {
              role: 'mailbox',
              username: name,
              mailboxId: mailboxInfo.id,
              mailboxAddress: mailboxInfo.address
            }, SESSION_EXPIRE_DAYS);
            const headers = new Headers({ 'Content-Type': 'application/json' });
            headers.set('Set-Cookie', buildSessionCookie(token, request.url, SESSION_EXPIRE_DAYS));
            return new Response(JSON.stringify({
              success: true,
              role: 'mailbox',
              mailbox: mailboxInfo.address,
              can_send: 1,
              mailbox_limit: 1
            }), { headers });
          }
        }
      } catch (_) {
        // 继续
      }

      return new Response('用户名或密码错误', { status: 401 });
    } catch (_) {
      return new Response('Bad Request', { status: 400 });
    }
  });

  router.post('/api/logout', async (context) => {
    const { request } = context;
    const headers = new Headers({ 'Content-Type': 'application/json' });

    try {
      const u = new URL(request.url);
      const isHttps = (u.protocol === 'https:');
      const secureFlag = isHttps ? ' Secure;' : '';
      headers.set('Set-Cookie', `iding-session=; HttpOnly;${secureFlag} Path=/; SameSite=Strict; Max-Age=0`);
    } catch (_) {
      headers.set('Set-Cookie', 'iding-session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
    }

    return new Response(JSON.stringify({ success: true }), { headers });
  });

  router.get('/api/session', async (context) => {
    const { request, env, authPayload } = context;
    const ADMIN_NAME = String(env.ADMIN_NAME || 'admin').trim().toLowerCase();
    const MAIL_DOMAINS = (env.MAIL_DOMAIN || 'temp.example.com')
      .split(/[,\s]+/)
      .map(d => d.trim())
      .filter(Boolean);

    if (!authPayload) {
      return new Response('Unauthorized', { status: 401 });
    }

    const strictAdmin = (authPayload.role === 'admin') && (
      String(authPayload.username || '').trim().toLowerCase() === ADMIN_NAME ||
      String(authPayload.username || '') === '__root__'
    );

    const response = {
      authenticated: true,
      role: authPayload.role || 'admin',
      username: authPayload.username || '',
      strictAdmin,
      mailDomain: MAIL_DOMAINS[0] || ''
    };

    if (authPayload.mailboxAddress) response.mailboxAddress = authPayload.mailboxAddress;

    // 邮箱用户返回邮箱地址
    if (authPayload.role === 'mailbox' && authPayload.mailboxAddress) {
      response.mailboxAddress = authPayload.mailboxAddress;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  });

  // =================== API路由委托 ===================
  router.get('/api/*', async (context) => {
    return await delegateApiRequest(context);
  });

  router.post('/api/*', async (context) => {
    return await delegateApiRequest(context);
  });

  router.patch('/api/*', async (context) => {
    return await delegateApiRequest(context);
  });

  router.put('/api/*', async (context) => {
    return await delegateApiRequest(context);
  });

  router.delete('/api/*', async (context) => {
    return await delegateApiRequest(context);
  });

  // =================== 邮件接收路由 ===================
  router.post('/receive', async (context) => {
    const { request, env, authPayload } = context;

    if (authPayload === false) {
      return new Response('Unauthorized', { status: 401 });
    }

    let DB;
    try {
      DB = await getDatabaseWithValidation(env);
    } catch (error) {
      console.error('邮件接收时数据库连接失败:', error.message);
      return new Response('数据库连接失败', { status: 500 });
    }

    const { handleEmailReceive } = await import('../email/receiver.js');
    return handleEmailReceive(request, DB, env);
  });

  return router;
}

/**
 * 委托API请求到处理器
 * @param {object} context - 请求上下文
 * @returns {Promise<Response>} HTTP响应
 */
async function delegateApiRequest(context) {
  const { request, env, authPayload } = context;
  let DB;
  try {
    DB = await getDatabaseWithValidation(env);
  } catch (error) {
    console.error('API请求时数据库连接失败:', error.message);
    return new Response('数据库连接失败', { status: 500 });
  }

  const MAIL_DOMAINS = (env.MAIL_DOMAIN || 'temp.example.com')
    .split(/[,\s]+/)
    .map(d => d.trim())
    .filter(Boolean);

  const RESEND_API_KEY = env.RESEND_API_KEY || env.RESEND_TOKEN || env.RESEND || '';
  const ADMIN_NAME = String(env.ADMIN_NAME || 'admin').trim().toLowerCase();

  // 访客只允许读取模拟数据
  if ((authPayload.role || 'admin') === 'guest') {
    return handleApiRequest(request, DB, MAIL_DOMAINS, {
      mockOnly: true,
      resendApiKey: RESEND_API_KEY,
      adminName: ADMIN_NAME,
      r2: env.MAIL_EML,
      authPayload
    });
  }

  // 邮箱用户只能访问自己的邮箱数据
  if (authPayload.role === 'mailbox') {
    return handleApiRequest(request, DB, MAIL_DOMAINS, {
      mockOnly: false,
      resendApiKey: RESEND_API_KEY,
      adminName: ADMIN_NAME,
      r2: env.MAIL_EML,
      authPayload,
      mailboxOnly: true
    });
  }

  // Обычный пользователь работает только со своим постоянным ящиком.
  if (authPayload.role === 'user') {
    return handleApiRequest(request, DB, MAIL_DOMAINS, {
      mockOnly: false,
      resendApiKey: RESEND_API_KEY,
      adminName: ADMIN_NAME,
      r2: env.MAIL_EML,
      authPayload,
      mailboxOnly: true,
      persistentUser: true
    });
  }

  return handleApiRequest(request, DB, MAIL_DOMAINS, {
    mockOnly: false,
    resendApiKey: RESEND_API_KEY,
    adminName: ADMIN_NAME,
    r2: env.MAIL_EML,
    authPayload
  });
}

export { authMiddleware };
