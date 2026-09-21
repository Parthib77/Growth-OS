import type { Router } from 'express';
import mongoose from 'mongoose';
import {
  BookingResponseSchema,
  CreateBookingRequestSchema,
  assertCustomerTransition,
  bookingId as bookingIdValue,
  currencyCode,
  customerId as customerIdValue,
  customerLifecycleKind,
  DomainError,
  money,
} from '@growthos/contracts';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { requireSession } from '../auth.js';
import { commandActorUserId, commandContext, queryContext } from '../context.js';
import { hashToken, newId } from '../ids.js';
import { Booking, CommandReceipt, Customer, Workspace, type BookingDoc } from '../models.js';
import { appendEvent, bookingView, fingerprint } from './shared.js';

export function registerBookingRoutes(router: Router, config: AppConfig): void {
  router.get('/bookings', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const rows = await Booking.find({ workspaceId: query.workspaceId })
        .sort({ appointmentAt: -1 })
        .limit(100)
        .lean();
      res.json({ items: rows.map((booking) => bookingView(booking)) });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/bookings', requireSession(config), async (req, res, next) => {
    try {
      const input = CreateBookingRequestSchema.parse(req.body);
      const context = commandContext(req);
      const actorUserId = commandActorUserId(context);
      const key = req.get('idempotency-key');
      if (!key || !/^[A-Za-z0-9._-]{8,120}$/.test(key))
        throw new AppError('VALIDATION_FAILED', 'Idempotency-Key is required.', 400);
      const keyHash = hashToken(`${context.workspaceId}:booking:${key}`);
      const requestFingerprint = fingerprint(input);
      const prior = await CommandReceipt.findOne({
        workspaceId: context.workspaceId,
        operation: 'booking.record',
        keyHash,
      }).lean();
      if (prior) {
        if (prior.requestFingerprint !== requestFingerprint)
          throw new AppError(
            'IDEMPOTENCY_KEY_REUSED',
            'This idempotency key was used for different booking details.',
            409,
          );
        return res.status(201).json(BookingResponseSchema.parse(prior.response));
      }
      const customer = await Customer.findOne({
        _id: input.customerId,
        workspaceId: context.workspaceId,
      });
      if (!customer) throw new AppError('RESOURCE_NOT_FOUND', 'Customer not found.', 404);
      const workspace = await Workspace.findById(context.workspaceId);
      if (!workspace || input.currency !== workspace.currency)
        throw new AppError(
          'VALIDATION_FAILED',
          'Booking currency must match the workspace currency.',
          400,
        );
      const agreedMoney = money({ currency: input.currency, minorUnits: input.agreedMinorUnits });
      try {
        assertCustomerTransition(customerLifecycleKind(customer.lifecycle), 'booked');
      } catch (error: unknown) {
        if (error instanceof DomainError)
          throw new AppError('INVALID_TRANSITION', error.message, 409);
        throw new AppError('INVALID_TRANSITION', 'Customer lifecycle is invalid.', 409);
      }
      const bookingId = newId();
      const commandId = String(context.commandId);
      const session = await mongoose.startSession();
      let created: BookingDoc | undefined;
      try {
        await session.withTransaction(async () => {
          [created] = await Booking.create(
            [
              {
                _id: bookingId,
                workspaceId: context.workspaceId,
                customerId: input.customerId,
                service: input.service,
                appointmentAt: new Date(input.appointmentAt),
                agreedMinorUnits: agreedMoney.minorUnits,
                currency: agreedMoney.currency,
                notes: input.notes,
                state: 'confirmed',
              },
            ],
            { session },
          );
          if (!created) throw new Error('Booking was not created');
          await Customer.updateOne(
            { _id: input.customerId, workspaceId: context.workspaceId },
            { $set: { lifecycle: 'booked', lastInteractionAt: new Date() } },
            { session },
          );
          await appendEvent(
            {
              workspaceId: context.workspaceId,
              userId: actorUserId,
              requestId: String(context.requestId),
              commandId,
              subjectKind: 'booking',
              subjectId: bookingId,
              ordinal: 0,
              payload: {
                type: 'booking.recorded',
                bookingId: bookingIdValue(bookingId),
                customerId: customerIdValue(input.customerId),
                agreedMinorUnits: agreedMoney.minorUnits,
                currency: currencyCode(agreedMoney.currency),
              },
            },
            session,
          );
          await CommandReceipt.create(
            [
              {
                _id: commandId,
                workspaceId: context.workspaceId,
                operation: 'booking.record',
                keyHash,
                requestFingerprint,
                resourceId: bookingId,
                response: bookingView(created),
              },
            ],
            { session },
          );
        });
      } catch (error: unknown) {
        const duplicate = error instanceof Error && 'code' in error && error.code === 11000;
        if (duplicate) {
          const raced = await CommandReceipt.findOne({
            workspaceId: context.workspaceId,
            operation: 'booking.record',
            keyHash,
          }).lean();
          if (raced && raced.requestFingerprint === requestFingerprint)
            return res.status(201).json(BookingResponseSchema.parse(raced.response));
          throw new AppError(
            'IDEMPOTENCY_KEY_REUSED',
            'This idempotency key was used for different booking details.',
            409,
          );
        }
        throw error;
      } finally {
        await session.endSession();
      }
      if (!created) throw new Error('Booking creation returned no document');
      res.status(201).json(bookingView(created));
    } catch (error: unknown) {
      next(error);
    }
  });
}
