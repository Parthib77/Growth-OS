import { describe, expect, it } from 'vitest';
import { accountDeletionManifest } from './domain.js';

describe('account deletion manifest', () => {
  it('contains each tenant-owned collection in dependency order', () => {
    expect(accountDeletionManifest.indexOf('reviewImportBatches')).toBeLessThan(
      accountDeletionManifest.indexOf('reviews'),
    );
    expect(accountDeletionManifest.indexOf('campaignRecipients')).toBeLessThan(
      accountDeletionManifest.indexOf('campaigns'),
    );
    expect(accountDeletionManifest.at(-2)).toBe('workspace');
    expect(accountDeletionManifest.at(-1)).toBe('user');
    expect(new Set(accountDeletionManifest).size).toBe(accountDeletionManifest.length);
  });
});
