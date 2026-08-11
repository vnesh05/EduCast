import crypto from 'crypto';

/**
 * Generates an uppercase 6-character alphanumeric join code (e.g., "HUB7A9")
 */
export function generateClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded easily confused chars O, 0, I, 1
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}
