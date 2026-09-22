import { describe, expect, it } from 'vitest';
import {
  assertCampaignStatusTransition,
  personalizeCampaignTemplate,
  preparedWhatsAppLink,
  safeCampaignCsvCell,
  validateCampaignTemplate,
} from './domain.js';

describe('campaign policies', () => {
  it('accepts only the supported personalization variables', () => {
    expect(() =>
      validateCampaignTemplate('Hi {first_name}, {service} at {business_name}'),
    ).not.toThrow();
    expect(() => validateCampaignTemplate('Hi {phone}')).toThrow(/Unsupported/);
    expect(
      personalizeCampaignTemplate('Hi {first_name}, your {service} is ready', {
        firstName: 'Ada',
        service: 'Cut',
        businessName: 'Salon',
      }),
    ).toBe('Hi Ada, your Cut is ready');
  });
  it('enforces campaign status transitions', () => {
    expect(() => assertCampaignStatusTransition('draft', 'ready')).not.toThrow();
    expect(() => assertCampaignStatusTransition('completed', 'draft')).toThrow(/Cannot move/);
  });
  it('prepares an honest WhatsApp link without claiming delivery', () => {
    expect(preparedWhatsAppLink('+15551234567', 'Hi Ada')).toBe(
      'https://wa.me/15551234567?text=Hi%20Ada',
    );
    expect(() => preparedWhatsAppLink('555', 'Hi')).toThrow(/valid/);
  });
  it('protects campaign CSV cells from spreadsheet formulas', () => {
    expect(safeCampaignCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(safeCampaignCsvCell('\t=SUM(A1:A2)')).toBe("'\t=SUM(A1:A2)");
    expect(safeCampaignCsvCell('Ada, Jr')).toBe('"Ada, Jr"');
  });
});
