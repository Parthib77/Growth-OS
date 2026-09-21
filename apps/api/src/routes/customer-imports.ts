import type { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  CustomerImportCommitRequestSchema,
  CustomerImportPreviewRequestSchema,
  customerId as customerIdValue,
  importBatchId as importBatchIdValue,
} from '@growthos/contracts';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { requireSession } from '../auth.js';
import { commandActorUserId, commandContext, queryContext } from '../context.js';
import { newId, normalizeEmail, normalizePhone } from '../ids.js';
import { Customer, ImportBatch, Workspace } from '../models.js';
import { appendEvent, customerView, latestConsents } from './shared.js';
import {
  CUSTOMER_IMPORT_LIMITS,
  findDuplicateMatches,
  parseCustomerCsv,
  suggestCustomerMapping,
  customerCsvFields,
  type CustomerCsvField,
} from '../customers/domain.js';

type StoredRow = {
  rowNumber: number;
  values: Record<string, string>;
  errors: string[];
  duplicates: Readonly<{ id: string; matchedOn: readonly ('phone' | 'email')[] }>[];
  normalizedPhone: string;
  normalizedEmail: string | null;
};
const StoredRowSchema = z.object({
  rowNumber: z.number().int(),
  values: z.record(z.string(), z.string()),
  errors: z.array(z.string()),
  duplicates: z.array(z.object({ id: z.string(), matchedOn: z.array(z.enum(['phone', 'email'])) })),
  normalizedPhone: z.string(),
  normalizedEmail: z.string().nullable(),
});

function rowInput(row: StoredRow) {
  return {
    firstName: row.values.firstName.trim(),
    lastName: row.values.lastName.trim(),
    phone: row.values.phone.trim(),
    email: row.values.email.trim(),
    source: row.values.source.trim(),
    service: row.values.service.trim(),
  };
}

export function registerCustomerImportRoutes(router: Router, config: AppConfig): void {
  router.post('/customer-imports/preview', requireSession(config), async (req, res, next) => {
    try {
      const input = CustomerImportPreviewRequestSchema.parse(req.body);
      const context = commandContext(req);
      const parsed = parseCustomerCsv(input.csv);
      const suggested = suggestCustomerMapping(parsed.headers);
      const mapping: Record<CustomerCsvField, string | null> = { ...suggested };
      for (const field of customerCsvFields) {
        const requested = input.mapping?.[field];
        if (requested) {
          if (!parsed.headers.includes(requested))
            throw new AppError('VALIDATION_FAILED', `Unknown CSV column: ${requested}.`, 400);
          mapping[field] = requested;
        }
      }
      const missing = (['firstName', 'phone', 'source', 'service'] as const).filter(
        (field) => !mapping[field],
      );
      if (missing.length)
        throw new AppError(
          'VALIDATION_FAILED',
          `Missing required columns: ${missing.join(', ')}.`,
          400,
        );
      const existing = await Customer.find({ workspaceId: context.workspaceId })
        .select('_id normalizedPhone normalizedEmail')
        .lean();
      const seenRows: { id: string; normalizedPhone: string; normalizedEmail: string | null }[] =
        [];
      const rows: StoredRow[] = parsed.rows.map((values, index) => {
        const valueMap: Record<string, string> = {};
        for (const [columnIndex, header] of parsed.headers.entries())
          valueMap[header] = values[columnIndex] ?? '';
        const mapped: Record<string, string> = {};
        for (const field of customerCsvFields) {
          const header = mapping[field];
          mapped[field] = header ? (valueMap[header] ?? '') : '';
        }
        const inputRow = rowInput({
          rowNumber: index + 2,
          values: mapped,
          errors: [],
          duplicates: [],
          normalizedPhone: normalizePhone(mapped.phone),
          normalizedEmail: mapped.email ? normalizeEmail(mapped.email) : null,
        });
        const errors: string[] = [];
        if (!inputRow.firstName) errors.push('firstName is required');
        if (!inputRow.phone || inputRow.phone.length < 7) errors.push('phone is required');
        if (!inputRow.source) errors.push('source is required');
        if (!inputRow.service) errors.push('service is required');
        if (inputRow.email && !inputRow.email.includes('@')) errors.push('email is invalid');
        const normalizedPhone = normalizePhone(inputRow.phone);
        const normalizedEmail = inputRow.email ? normalizeEmail(inputRow.email) : null;
        const duplicates = findDuplicateMatches({ normalizedPhone, normalizedEmail }, [
          ...existing.map((candidate) => ({
            id: String(candidate._id),
            normalizedPhone: candidate.normalizedPhone,
            normalizedEmail: candidate.normalizedEmail ?? null,
          })),
          ...seenRows,
        ]);
        seenRows.push({ id: `row:${index + 2}`, normalizedPhone, normalizedEmail });
        return {
          rowNumber: index + 2,
          values: mapped,
          errors,
          duplicates,
          normalizedPhone,
          normalizedEmail,
        };
      });
      const importId = newId();
      await ImportBatch.create({
        _id: importId,
        workspaceId: context.workspaceId,
        createdBy: commandActorUserId(context),
        headers: parsed.headers,
        mapping,
        rows,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      res.json({
        importId,
        headers: parsed.headers,
        mapping,
        rows: rows.map(({ rowNumber, values, errors, duplicates }) => ({
          rowNumber,
          values,
          errors,
          duplicates,
        })),
        limits: CUSTOMER_IMPORT_LIMITS,
      });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post(
    '/customer-imports/:importId/commit',
    requireSession(config),
    async (req, res, next) => {
      try {
        const input = CustomerImportCommitRequestSchema.parse(req.body);
        const context = commandContext(req);
        const batch = await ImportBatch.findOne({
          _id: req.params.importId,
          workspaceId: context.workspaceId,
        });
        if (!batch)
          throw new AppError('RESOURCE_NOT_FOUND', 'Import preview not found or expired.', 404);
        const rows: StoredRow[] = z.array(StoredRowSchema).parse(batch.rows);
        const duplicateRows = rows.filter(
          (row) => row.duplicates.length > 0 && row.errors.length === 0,
        );
        for (const row of duplicateRows) {
          const resolution = input.resolutions[String(row.rowNumber)];
          if (!resolution)
            throw new AppError(
              'DUPLICATE_REVIEW_REQUIRED',
              `Choose create or skip for duplicate row ${row.rowNumber}.`,
              409,
              undefined,
              { rowNumber: row.rowNumber, duplicates: row.duplicates },
            );
        }
        const workspace = await Workspace.findById(context.workspaceId).lean();
        if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
        const session = await mongoose.startSession();
        const createdIds: string[] = [];
        const skippedRows: number[] = [];
        try {
          await session.withTransaction(async () => {
            let ordinal = 0;
            for (const row of rows) {
              if (row.errors.length > 0 || input.resolutions[String(row.rowNumber)] === 'skip') {
                skippedRows.push(row.rowNumber);
                continue;
              }
              const values = rowInput(row);
              const customerId = newId();
              await Customer.create(
                [
                  {
                    _id: customerId,
                    workspaceId: context.workspaceId,
                    ...values,
                    normalizedPhone: row.normalizedPhone,
                    normalizedEmail: row.normalizedEmail || null,
                    email: values.email || null,
                    quotedMinorUnits: undefined,
                    lifecycle: 'enquiry',
                    lastInteractionAt: new Date(),
                    serviceInterests: [],
                    internalNotes: '',
                  },
                ],
                { session },
              );
              await appendEvent(
                {
                  workspaceId: context.workspaceId,
                  userId: commandActorUserId(context),
                  requestId: String(context.requestId),
                  commandId: String(context.commandId),
                  subjectKind: 'customer',
                  subjectId: customerId,
                  ordinal,
                  payload: {
                    type: 'enquiry.created',
                    customerId: customerIdValue(customerId),
                    source: values.source,
                  },
                },
                session,
              );
              ordinal += 1;
              await appendEvent(
                {
                  workspaceId: context.workspaceId,
                  userId: commandActorUserId(context),
                  requestId: String(context.requestId),
                  commandId: String(context.commandId),
                  subjectKind: 'customer',
                  subjectId: customerId,
                  ordinal,
                  payload: {
                    type: 'customer.imported',
                    customerId: customerIdValue(customerId),
                    importBatchId: importBatchIdValue(String(batch._id)),
                  },
                },
                session,
              );
              ordinal += 1;
              createdIds.push(customerId);
            }
          });
        } finally {
          await session.endSession();
        }
        const created = await Customer.find({
          workspaceId: context.workspaceId,
          _id: { $in: createdIds },
        }).lean();
        const consents = await latestConsents(context.workspaceId, createdIds);
        res.json({
          created: created.map((customer) =>
            customerView(customer, consents.get(String(customer._id)), workspace.currency),
          ),
          skippedRows,
        });
      } catch (error: unknown) {
        next(error);
      }
    },
  );
}
