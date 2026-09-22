import {
  campaignTemplateVariables,
  canTransitionCampaign,
  campaignOutcomes,
  campaignStatuses,
  type CampaignOutcome,
  type CampaignStatus,
} from '@growthos/contracts';

const variablePattern = /\{([a-z_]+)\}/g;
export function templateVariables(template: string): string[] {
  return [...template.matchAll(variablePattern)].map((match) => match[1]);
}

export function validateCampaignTemplate(template: string): void {
  const variables = templateVariables(template);
  const supported = new Set<string>(campaignTemplateVariables);
  for (const variable of variables)
    if (!supported.has(variable)) throw new Error(`Unsupported template variable: {${variable}}`);
  if (
    template.replace(variablePattern, '').includes('{') ||
    template.replace(variablePattern, '').includes('}')
  )
    throw new Error('Template contains a malformed variable.');
}

export function personalizeCampaignTemplate(
  template: string,
  values: { firstName: string; service: string; businessName: string },
): string {
  validateCampaignTemplate(template);
  return template.replace(variablePattern, (_match, variable: string) => {
    if (variable === 'first_name') return values.firstName;
    if (variable === 'service') return values.service;
    return values.businessName;
  });
}

export function campaignStatus(status: string): CampaignStatus {
  if (!(campaignStatuses as readonly string[]).includes(status))
    throw new Error(`Invalid campaign status: ${status}`);
  return status as CampaignStatus;
}

export function assertCampaignStatusTransition(from: string, to: CampaignStatus): void {
  const source = campaignStatus(from);
  if (!canTransitionCampaign(source, to))
    throw new Error(`Cannot move campaign from ${source} to ${to}`);
}

export function campaignOutcome(value: string): CampaignOutcome {
  if (!(campaignOutcomes as readonly string[]).includes(value))
    throw new Error(`Invalid campaign outcome: ${value}`);
  return value as CampaignOutcome;
}

export function validWhatsAppPhone(phone: string | null | undefined): boolean {
  return Boolean(phone && /^\+[1-9][0-9]{7,14}$/.test(phone));
}

export function preparedWhatsAppLink(phone: string, message: string): string {
  if (!validWhatsAppPhone(phone)) throw new Error('Customer phone is not valid for WhatsApp.');
  return `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(message)}`;
}

export function safeCampaignCsvCell(value: string): string {
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export type Eligibility =
  | 'eligible'
  | 'withdrawn'
  | 'booked'
  | 'invalid_contact'
  | 'no_consent'
  | 'removed'
  | 'cancelled';
