import mongoose, { type ClientSession } from 'mongoose';
import { argon2id, hash as hashPassword } from 'argon2';
import {
  bookingId as bookingIdValue,
  campaignId as campaignIdValue,
  campaignRecipientId as campaignRecipientIdValue,
  currencyCode,
  customerId as customerIdValue,
  reviewId as reviewIdValue,
  userId as userIdValue,
  workspaceId as workspaceIdValue,
  type OperationalEventPayload,
  type SubjectKind,
} from '@growthos/contracts';
import { newId, normalizeEmail, normalizePhone } from '../ids.js';
import {
  Booking,
  Campaign,
  CampaignRecipient,
  CampaignRevision,
  Consent,
  Customer,
  Interaction,
  Review,
  User,
  Workspace,
} from '../models.js';
import { appendEvent } from '../routes/shared.js';

export const DEMO_ACCOUNT = Object.freeze({
  email: 'demo@growthos.local',
  password: 'DemoWorkspace!2026',
  businessName: 'Northline Studio',
});

export type DemoSeedResult = Readonly<{
  status: 'created' | 'exists';
  userId: string;
  workspaceId: string;
  email: string;
}>;

type SeedEvent = Readonly<{
  subjectKind: SubjectKind;
  subjectId: string;
  payload: OperationalEventPayload;
}>;

function daysFrom(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 86_400_000);
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 11000;
}

async function findExistingDemo(
  normalizedEmail: string,
  session?: ClientSession,
): Promise<DemoSeedResult | null> {
  const query = User.findOne({ normalizedEmail });
  if (session) query.session(session);
  const user = await query;
  if (!user) return null;
  const workspaceQuery = Workspace.findOne({ ownerUserId: String(user._id) });
  if (session) workspaceQuery.session(session);
  const workspace = await workspaceQuery;
  if (!workspace?.isDemo)
    throw new Error(
      'The configured demo email belongs to a non-demo account; nothing was changed.',
    );
  return {
    status: 'exists',
    userId: String(user._id),
    workspaceId: String(workspace._id),
    email: user.email,
  };
}

export async function seedDemoWorkspace(
  input: {
    email?: string;
    password?: string;
    now?: Date;
  } = {},
): Promise<DemoSeedResult> {
  const email = input.email?.trim() || DEMO_ACCOUNT.email;
  const normalizedEmail = normalizeEmail(email);
  const password = input.password || DEMO_ACCOUNT.password;
  if (password.length < 12 || password.length > 128)
    throw new Error('The demo password must contain between 12 and 128 characters.');

  const existing = await findExistingDemo(normalizedEmail);
  if (existing) return existing;

  const now = input.now ? new Date(input.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error('The demo seed time is invalid.');
  const ids = {
    user: newId(),
    workspace: newId(),
    mina: newId(),
    jordan: newId(),
    priya: newId(),
    minaConsent: newId(),
    jordanConsent: newId(),
    priyaConsent: newId(),
    minaInteraction: newId(),
    jordanInteraction: newId(),
    priyaInteraction: newId(),
    campaign: newId(),
    campaignRevision: newId(),
    minaRecipient: newId(),
    jordanRecipient: newId(),
    booking: newId(),
    reviewOne: newId(),
    reviewTwo: newId(),
  } as const;
  const passwordHash = await hashPassword(password, { type: argon2id });
  const session = await mongoose.startSession();
  let result: DemoSeedResult | undefined;

  try {
    await session.withTransaction(async () => {
      const raced = await findExistingDemo(normalizedEmail, session);
      if (raced) {
        result = raced;
        return;
      }

      await User.create(
        [
          {
            _id: ids.user,
            email,
            normalizedEmail,
            passwordHash,
            sessionGeneration: 0,
          },
        ],
        { session, ordered: true },
      );
      await Workspace.create(
        [
          {
            _id: ids.workspace,
            ownerUserId: ids.user,
            businessName: DEMO_ACCOUNT.businessName,
            category: 'Salon',
            timezone: 'America/Los_Angeles',
            currency: 'USD',
            defaultCountryCode: '+1',
            bookingLink: 'https://example.com/northline-studio/book',
            followUpDays: 3,
            reviewResponseTemplate:
              'Thank you, {reviewer_name}. We appreciate you taking the time to share this.',
            onboardingComplete: true,
            isDemo: true,
          },
        ],
        { session, ordered: true },
      );

      await Customer.create(
        [
          {
            _id: ids.mina,
            workspaceId: ids.workspace,
            firstName: 'Mina',
            lastName: 'Chen',
            phone: '+1 415 555 0114',
            normalizedPhone: normalizePhone('+1 415 555 0114'),
            email: 'mina.chen@example.test',
            normalizedEmail: 'mina.chen@example.test',
            source: 'Referral',
            service: 'Color consultation',
            quotedMinorUnits: 14500,
            lifecycle: 'enquiry',
            lastInteractionAt: daysFrom(now, -5),
            serviceInterests: ['Color consultation', 'Balayage'],
            internalNotes: 'Prefers weekday afternoon appointments.',
          },
          {
            _id: ids.jordan,
            workspaceId: ids.workspace,
            firstName: 'Jordan',
            lastName: 'Lee',
            phone: '+1 415 555 0132',
            normalizedPhone: normalizePhone('+1 415 555 0132'),
            email: 'jordan.lee@example.test',
            normalizedEmail: 'jordan.lee@example.test',
            source: 'Instagram',
            service: 'Cut and finish',
            quotedMinorUnits: 9800,
            lifecycle: 'booked',
            lastInteractionAt: daysFrom(now, -1),
            serviceInterests: ['Cut and finish'],
            internalNotes: 'First visit.',
          },
          {
            _id: ids.priya,
            workspaceId: ids.workspace,
            firstName: 'Priya',
            lastName: 'Shah',
            phone: '+1 415 555 0188',
            normalizedPhone: normalizePhone('+1 415 555 0188'),
            email: 'priya.shah@example.test',
            normalizedEmail: 'priya.shah@example.test',
            source: 'Website',
            service: 'Texture treatment',
            quotedMinorUnits: 17500,
            lifecycle: 'contacted',
            lastInteractionAt: daysFrom(now, -4),
            serviceInterests: ['Texture treatment'],
            internalNotes: 'Asked not to receive WhatsApp follow-ups.',
          },
        ],
        { session, ordered: true },
      );
      await Consent.create(
        [
          {
            _id: ids.minaConsent,
            workspaceId: ids.workspace,
            customerId: ids.mina,
            channel: 'whatsapp',
            decision: 'granted',
            capturedAt: daysFrom(now, -5),
          },
          {
            _id: ids.jordanConsent,
            workspaceId: ids.workspace,
            customerId: ids.jordan,
            channel: 'whatsapp',
            decision: 'granted',
            capturedAt: daysFrom(now, -6),
          },
          {
            _id: ids.priyaConsent,
            workspaceId: ids.workspace,
            customerId: ids.priya,
            channel: 'whatsapp',
            decision: 'withdrawn',
            capturedAt: daysFrom(now, -2),
          },
        ],
        { session, ordered: true },
      );
      await Interaction.create(
        [
          {
            _id: ids.minaInteraction,
            workspaceId: ids.workspace,
            customerId: ids.mina,
            actorUserId: ids.user,
            kind: 'enquiry',
            body: 'Asked about maintenance and timing for balayage.',
            serviceInterest: 'Balayage',
            occurredAt: daysFrom(now, -5),
          },
          {
            _id: ids.jordanInteraction,
            workspaceId: ids.workspace,
            customerId: ids.jordan,
            actorUserId: ids.user,
            kind: 'message',
            body: 'Confirmed the appointment time and service.',
            serviceInterest: 'Cut and finish',
            occurredAt: daysFrom(now, -1),
          },
          {
            _id: ids.priyaInteraction,
            workspaceId: ids.workspace,
            customerId: ids.priya,
            actorUserId: ids.user,
            kind: 'note',
            body: 'Recorded WhatsApp consent withdrawal.',
            serviceInterest: 'Texture treatment',
            occurredAt: daysFrom(now, -2),
          },
        ],
        { session, ordered: true },
      );

      const audience = { consentChannel: 'whatsapp' as const, lifecycle: 'enquiry' as const };
      const template =
        'Hi {first_name}, this is {business_name}. Would you like to book your {service}?';
      await Campaign.create(
        [
          {
            _id: ids.campaign,
            workspaceId: ids.workspace,
            name: 'September consultation follow-up',
            channel: 'whatsapp',
            template,
            audience,
            status: 'active',
            version: 1,
            reviewedVersion: 1,
            removedCustomerIds: [],
          },
        ],
        { session },
      );
      await CampaignRevision.create(
        [
          {
            _id: ids.campaignRevision,
            workspaceId: ids.workspace,
            campaignId: ids.campaign,
            version: 1,
            name: 'September consultation follow-up',
            channel: 'whatsapp',
            template,
            audience,
            status: 'active',
            reviewedVersion: 1,
            recordedAt: daysFrom(now, -2),
          },
        ],
        { session },
      );
      await CampaignRecipient.create(
        [
          {
            _id: ids.minaRecipient,
            workspaceId: ids.workspace,
            campaignId: ids.campaign,
            campaignVersion: 1,
            customerId: ids.mina,
            firstName: 'Mina',
            lastName: 'Chen',
            phone: '+1 415 555 0114',
            service: 'Color consultation',
            eligibility: 'eligible',
            reason: null,
            consentRecordId: ids.minaConsent,
            eligibilityCheckedAt: daysFrom(now, -2),
            personalizedPreview:
              'Hi Mina, this is Northline Studio. Would you like to book your Color consultation?',
            removed: false,
            outcome: 'sent',
            outcomeAt: daysFrom(now, -1),
          },
          {
            _id: ids.jordanRecipient,
            workspaceId: ids.workspace,
            campaignId: ids.campaign,
            campaignVersion: 1,
            customerId: ids.jordan,
            firstName: 'Jordan',
            lastName: 'Lee',
            phone: '+1 415 555 0132',
            service: 'Cut and finish',
            eligibility: 'booked',
            reason: 'Booking recorded',
            consentRecordId: ids.jordanConsent,
            eligibilityCheckedAt: daysFrom(now, -2),
            personalizedPreview:
              'Hi Jordan, this is Northline Studio. Would you like to book your Cut and finish?',
            removed: false,
            outcome: 'booked',
            bookingId: ids.booking,
            outcomeAt: daysFrom(now, -1),
          },
        ],
        { session, ordered: true },
      );
      await Booking.create(
        [
          {
            _id: ids.booking,
            workspaceId: ids.workspace,
            customerId: ids.jordan,
            service: 'Cut and finish',
            appointmentAt: daysFrom(now, 2),
            agreedMinorUnits: 9800,
            currency: 'USD',
            notes: 'Demo booking attributed to the September follow-up.',
            state: 'confirmed',
            sourceCampaignRecipientId: ids.jordanRecipient,
            createdAt: now,
            updatedAt: now,
          },
        ],
        { session },
      );
      await Review.create(
        [
          {
            _id: ids.reviewOne,
            workspaceId: ids.workspace,
            reviewerName: 'Elena R.',
            rating: 5,
            text: 'The consultation was clear, thoughtful, and never rushed.',
            source: 'Google',
            receivedAt: daysFrom(now, -2),
            responseState: 'unanswered',
          },
          {
            _id: ids.reviewTwo,
            workspaceId: ids.workspace,
            reviewerName: 'Sam K.',
            rating: 4,
            text: 'Great result and helpful aftercare advice.',
            source: 'Manual import',
            receivedAt: daysFrom(now, -8),
            responseState: 'drafted',
            responseText: 'Thank you, Sam. We are glad the aftercare guidance was useful.',
            responseRevisedAt: daysFrom(now, -7),
          },
        ],
        { session, ordered: true },
      );

      const events = [
        {
          subjectKind: 'workspace',
          subjectId: ids.workspace,
          payload: {
            type: 'account.registered',
            userId: userIdValue(ids.user),
            workspaceId: workspaceIdValue(ids.workspace),
          },
        },
        ...[
          [ids.mina, 'Referral', 14500],
          [ids.jordan, 'Instagram', 9800],
          [ids.priya, 'Website', 17500],
        ].map(([id, source, quotedMinorUnits]) => ({
          subjectKind: 'customer' as const,
          subjectId: String(id),
          payload: {
            type: 'enquiry.created' as const,
            customerId: customerIdValue(String(id)),
            source: String(source),
            quotedMinorUnits: Number(quotedMinorUnits),
          },
        })),
        {
          subjectKind: 'campaign',
          subjectId: ids.campaign,
          payload: {
            type: 'campaign.created',
            campaignId: campaignIdValue(ids.campaign),
            version: 1,
          },
        },
        {
          subjectKind: 'campaign',
          subjectId: ids.campaign,
          payload: {
            type: 'campaign.message_prepared',
            campaignId: campaignIdValue(ids.campaign),
            recipientId: campaignRecipientIdValue(ids.minaRecipient),
          },
        },
        {
          subjectKind: 'campaign',
          subjectId: ids.campaign,
          payload: {
            type: 'campaign.message_sent',
            campaignId: campaignIdValue(ids.campaign),
            recipientId: campaignRecipientIdValue(ids.minaRecipient),
          },
        },
        {
          subjectKind: 'booking',
          subjectId: ids.booking,
          payload: {
            type: 'booking.recorded',
            bookingId: bookingIdValue(ids.booking),
            customerId: customerIdValue(ids.jordan),
            agreedMinorUnits: 9800,
            currency: currencyCode('USD'),
          },
        },
        {
          subjectKind: 'review',
          subjectId: ids.reviewOne,
          payload: {
            type: 'review.created',
            reviewId: reviewIdValue(ids.reviewOne),
            rating: 5,
            source: 'Google',
          },
        },
        {
          subjectKind: 'review',
          subjectId: ids.reviewTwo,
          payload: {
            type: 'review.created',
            reviewId: reviewIdValue(ids.reviewTwo),
            rating: 4,
            source: 'Manual import',
          },
        },
      ] satisfies readonly SeedEvent[];

      for (const event of events)
        await appendEvent(
          {
            workspaceId: ids.workspace,
            userId: ids.user,
            requestId: newId(),
            commandId: newId(),
            subjectKind: event.subjectKind,
            subjectId: event.subjectId,
            ordinal: 0,
            occurredAt: now,
            payload: event.payload,
          },
          session,
        );

      result = {
        status: 'created',
        userId: ids.user,
        workspaceId: ids.workspace,
        email,
      };
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      const raced = await findExistingDemo(normalizedEmail);
      if (raced) return raced;
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (!result) throw new Error('Demo seed transaction returned no result.');
  return result;
}
