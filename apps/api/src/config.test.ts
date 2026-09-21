import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

const base = {
  NODE_ENV: 'test',
  PORT: '4000',
  WEB_ORIGIN: 'http://localhost:3000',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/growthos-test',
  SESSION_SECRET: 'a'.repeat(32),
};

describe('readConfig', () => {
  it('parses COOKIE_SECURE literally', () => {
    expect(readConfig({ ...base, COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(false);
    expect(readConfig({ ...base, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
    expect(() => readConfig({ ...base, COOKIE_SECURE: 'yes' })).toThrow(/Invalid environment/);
  });
});
