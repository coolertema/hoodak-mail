/**
 * 通用工具函数模块
 * @module utils/common
 */

/**
 * 从邮件地址中提取纯邮箱地址
 * 处理各种格式如 "Name <email@domain.com>" 或 "<email@domain.com>"
 * @param {string} addr - 原始邮件地址字符串
 * @returns {string} 纯邮箱地址
 */
export function extractEmail(addr) {
  const s = String(addr || '').trim();
  const m = s.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  return s.split(/\s/)[0] || s;
}

/**
 * 生成指定长度的随机ID
 * @param {number} length - ID长度，默认为8
 * @returns {string} 随机生成的ID字符串
 */
export function generateRandomId(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 验证邮箱地址格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否为有效的邮箱格式
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * 计算文本的SHA-256哈希值并返回十六进制字符串
 * @param {string} text - 需要计算哈希的文本内容
 * @returns {Promise<string>} 十六进制格式的SHA-256哈希值
 */
export async function sha256Hex(text) {
  const enc = new TextEncoder();
  const data = enc.encode(String(text || ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

const PASSWORD_SCHEME = 'pbkdf2-sha256';
const PASSWORD_ITERATIONS = 120000;

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

/** Hash a password with a random salt using Web Crypto PBKDF2. */
export async function hashPassword(password) {
  const raw = String(password || '');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(raw), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSWORD_ITERATIONS },
    key,
    256
  );
  return `${PASSWORD_SCHEME}$${PASSWORD_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

/**
 * 验证原始密码与哈希密码是否匹配
 * @param {string} rawPassword - 原始明文密码
 * @param {string} hashed - 已哈希的密码
 * @returns {Promise<boolean>} 验证结果，true表示密码匹配
 */
export async function verifyPassword(rawPassword, hashed) {
  if (!hashed) return false;
  try {
    const value = String(hashed || '');
    if (value.startsWith(`${PASSWORD_SCHEME}$`)) {
      const [, iterationsRaw, saltRaw, expectedRaw] = value.split('$');
      const iterations = Number(iterationsRaw);
      if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
      const salt = base64ToBytes(saltRaw);
      const expected = base64ToBytes(expectedRaw);
      const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(String(rawPassword || '')), 'PBKDF2', false, ['deriveBits']
      );
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, expected.length * 8
      );
      return timingSafeEqual(new Uint8Array(bits), expected);
    }
    // Backwards compatibility for accounts created by older HoodakMail builds.
    const hex = (await sha256Hex(rawPassword)).toLowerCase();
    return hex === value.toLowerCase();
  } catch (_) {
    return false;
  }
}
