import { parseCustomerCsv, safeCsvCell, type ParsedCsv } from '../customers/domain.js';

export const REVIEW_IMPORT_LIMITS = Object.freeze({
  maxBytes: 1_000_000,
  maxRows: 1_000,
  maxColumns: 16,
  maxCellLength: 5_000,
});

export type ReviewCsvRow = Readonly<{
  rowNumber: number;
  values: Record<string, string>;
  errors: string[];
}>;

export function parseReviewCsv(input: string): ParsedCsv {
  return parseCustomerCsv(input, REVIEW_IMPORT_LIMITS);
}

export function reviewRows(parsed: ParsedCsv): ReviewCsvRow[] {
  return parsed.rows.map((row, index) => {
    const values = Object.fromEntries(
      parsed.headers.map((header, column) => [header, row[column] ?? '']),
    );
    const errors: string[] = [];
    const rating = Number(values.rating);
    if (!values.reviewerName?.trim()) errors.push('reviewerName is required');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      errors.push('rating must be 1 through 5');
    if (!values.text?.trim()) errors.push('text is required');
    if (!values.source?.trim()) errors.push('source is required');
    if (values.receivedAt && Number.isNaN(Date.parse(values.receivedAt)))
      errors.push('receivedAt must be a date');
    return { rowNumber: index + 2, values, errors };
  });
}

export function reviewCsv(
  records: readonly {
    reviewerName: string;
    rating: number;
    text: string;
    source: string;
    receivedAt: string;
    responseState: string;
    responseText: string;
  }[],
): string {
  const headers = [
    'reviewerName',
    'rating',
    'text',
    'source',
    'receivedAt',
    'responseState',
    'responseText',
  ];
  return [
    headers.map(safeCsvCell).join(','),
    ...records.map((record) =>
      [
        record.reviewerName,
        record.rating,
        record.text,
        record.source,
        record.receivedAt,
        record.responseState,
        record.responseText,
      ]
        .map((value) => safeCsvCell(String(value)))
        .join(','),
    ),
  ].join('\n');
}
