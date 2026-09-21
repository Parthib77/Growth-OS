import {
  canTransitionCustomer,
  customerLifecycleKind,
  type CustomerLifecycle,
} from '@growthos/contracts';

export const CUSTOMER_IMPORT_LIMITS = Object.freeze({
  maxBytes: 1_000_000,
  maxRows: 1_000,
  maxColumns: 32,
  maxCellLength: 500,
});

export type CsvIssue = Readonly<{ rowNumber: number; code: string; message: string }>;
export type ParsedCsv = Readonly<{ headers: string[]; rows: string[][] }>;

function formulaLike(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith('=') || trimmed.startsWith('@')) return true;
  return (trimmed.startsWith('+') || trimmed.startsWith('-')) && /[A-Za-z=]/.test(trimmed[1] ?? '');
}

export function parseCustomerCsv(input: string): ParsedCsv {
  const byteLength = Buffer.byteLength(input, 'utf8');
  if (byteLength > CUSTOMER_IMPORT_LIMITS.maxBytes)
    throw new Error(`CSV exceeds ${CUSTOMER_IMPORT_LIMITS.maxBytes} bytes`);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let justClosedQuote = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (character === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        justClosedQuote = true;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"' && cell.length === 0) {
      quoted = true;
      continue;
    }
    if (justClosedQuote && character !== ',' && character !== '\r' && character !== '\n')
      throw new Error('CSV has characters after a closing quote');
    justClosedQuote = false;
    if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
    if (cell.length > CUSTOMER_IMPORT_LIMITS.maxCellLength)
      throw new Error(`CSV cell exceeds ${CUSTOMER_IMPORT_LIMITS.maxCellLength} characters`);
  }
  if (quoted) throw new Error('CSV has an unterminated quoted cell');
  if (cell.length > 0 || row.length > 0 || justClosedQuote) {
    row.push(cell);
    rows.push(row);
  }
  if (rows.length < 2) throw new Error('CSV must include a header and at least one row');
  const [headerRow, ...dataRows] = rows;
  if (headerRow.length > CUSTOMER_IMPORT_LIMITS.maxColumns)
    throw new Error(`CSV has more than ${CUSTOMER_IMPORT_LIMITS.maxColumns} columns`);
  if (dataRows.length > CUSTOMER_IMPORT_LIMITS.maxRows)
    throw new Error(`CSV has more than ${CUSTOMER_IMPORT_LIMITS.maxRows} rows`);
  const headers = headerRow.map((header) => header.trim());
  if (
    headers.some((header) => header.length === 0) ||
    new Set(headers.map((h) => h.toLowerCase())).size !== headers.length
  )
    throw new Error('CSV headers must be non-empty and unique');
  for (const [rowIndex, dataRow] of dataRows.entries()) {
    while (dataRow.length < headers.length) dataRow.push('');
    if (dataRow.length > headers.length)
      throw new Error(`CSV row ${rowIndex + 2} has too many columns`);
    for (const value of dataRow) {
      if (value.length > CUSTOMER_IMPORT_LIMITS.maxCellLength)
        throw new Error(`CSV row ${rowIndex + 2} has an oversized cell`);
      if (formulaLike(value))
        throw new Error(`CSV row ${rowIndex + 2} contains a formula-like value`);
    }
  }
  return { headers, rows: dataRows };
}

export const customerCsvFields = [
  'firstName',
  'lastName',
  'phone',
  'email',
  'source',
  'service',
] as const;
export type CustomerCsvField = (typeof customerCsvFields)[number];

export function suggestCustomerMapping(
  headers: readonly string[],
): Record<CustomerCsvField, string | null> {
  const aliases: Record<CustomerCsvField, readonly string[]> = {
    firstName: ['firstname', 'first name', 'given name'],
    lastName: ['lastname', 'last name', 'surname'],
    phone: ['phone', 'mobile', 'telephone'],
    email: ['email', 'email address'],
    source: ['source', 'lead source'],
    service: ['service', 'interest', 'service interest'],
  };
  const normalized = new Map(headers.map((header) => [header.trim().toLowerCase(), header]));
  const mapping: Record<CustomerCsvField, string | null> = {
    firstName: null,
    lastName: null,
    phone: null,
    email: null,
    source: null,
    service: null,
  };
  for (const field of customerCsvFields)
    mapping[field] = aliases[field].map((alias) => normalized.get(alias)).find(Boolean) ?? null;
  return mapping;
}

export type DuplicateMatch = Readonly<{ id: string; matchedOn: readonly ('phone' | 'email')[] }>;
export function findDuplicateMatches(
  row: { normalizedPhone: string; normalizedEmail: string | null },
  candidates: readonly { id: string; normalizedPhone: string; normalizedEmail: string | null }[],
): DuplicateMatch[] {
  return candidates.flatMap((candidate): DuplicateMatch[] => {
    const matchedOn: ('phone' | 'email')[] = [];
    if (row.normalizedPhone && row.normalizedPhone === candidate.normalizedPhone)
      matchedOn.push('phone');
    if (row.normalizedEmail && row.normalizedEmail === candidate.normalizedEmail)
      matchedOn.push('email');
    return matchedOn.length ? [{ id: candidate.id, matchedOn }] : [];
  });
}

export function assertLifecycleTransition(
  from: string,
  to: string,
): asserts to is CustomerLifecycle['kind'] {
  const fromKind = customerLifecycleKind(from);
  const toKind = customerLifecycleKind(to);
  if (!canTransitionCustomer(fromKind, toKind))
    throw new Error(`Cannot move customer from ${from} to ${to}`);
}

export function safeCsvCell(value: string): string {
  const protectedValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(protectedValue)
    ? `"${protectedValue.replaceAll('"', '""')}"`
    : protectedValue;
}
