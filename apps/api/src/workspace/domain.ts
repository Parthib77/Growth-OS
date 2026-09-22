export const accountDeletionManifest = [
  'reviewImportBatches',
  'customerImportBatches',
  'commandReceipts',
  'campaignRecipients',
  'campaignRevisions',
  'campaigns',
  'reviews',
  'bookings',
  'consents',
  'interactions',
  'customers',
  'operationalEvents',
  'sessions',
  'workspace',
  'user',
] as const;

export type AccountDeletionManifestStep = (typeof accountDeletionManifest)[number];
