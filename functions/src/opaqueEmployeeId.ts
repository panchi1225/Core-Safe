import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
export function secretKey(value: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('Autofill key is not configured');
  return Buffer.from(value, 'hex');
}
export function publicEmployeeId(key: Buffer, token: string, id: string, expiresAt: number): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('core-safe-employee-v1'));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ token, id, expiresAt }), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function employeeIdFromPublic(key: Buffer, token: string, value: unknown, now: number): string | null {
  try {
    if (typeof value !== 'string' || value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from('core-safe-employee-v1')); decipher.setAuthTag(bytes.subarray(12, 28));
    const raw = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
    return raw.token === token && Number.isFinite(raw.expiresAt) && raw.expiresAt > now && typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 1500 && !raw.id.includes('/') ? raw.id : null;
  } catch { return null; }
}
export const rateId = (key: Buffer, label: string, parts: string[]) => createHmac('sha256', key).update(JSON.stringify([label, ...parts])).digest('hex');
