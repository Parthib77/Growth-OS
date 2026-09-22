import { describe, expect, it } from 'vitest';
import { OnboardingRequestSchema, WorkspaceSettingsPatchSchema } from './schemas.js';

describe('workspace settings contracts', () => {
  it('rejects invalid IANA timezones at the input boundary', () => {
    const result = OnboardingRequestSchema.safeParse({
      businessName: 'Salon',
      category: 'Beauty',
      timezone: 'Not/AZone',
      currency: 'USD',
      defaultCountryCode: '+1',
      bookingLink: '',
      followUpDays: 3,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty partial settings patch', () => {
    expect(WorkspaceSettingsPatchSchema.safeParse({}).success).toBe(false);
  });
});
