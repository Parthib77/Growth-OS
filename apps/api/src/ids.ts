import { randomBytes, randomUUID, createHash } from 'node:crypto';

export function newId(): string {
  return randomUUID();
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return value.replace(/[^0-9+]/g, '').replace(/^00/, '+');
}
