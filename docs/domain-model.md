# Growth OS domain model

## Modeling rules

- Parse HTTP, CSV, environment, and MongoDB values at their boundaries.
- Brand identifiers and semantic primitives that must not be exchanged.
- Model lifecycle states as closed unions with exhaustive transition functions.
- Keep one source for each fact. Derive consent, booking exclusion, and campaign eligibility.
- Store money as safe integer minor units plus an ISO 4217 currency code.
- Store instants in UTC. Convert civil input through the workspace IANA timezone.
- Keep consent, interactions, operational events, and original review text append-only.
- Keep wire schemas, domain values, and MongoDB documents separate.

## Core values

```ts
type Brand<T, Name extends string> = T & { readonly __brand: Name };

type WorkspaceId = Brand<string, 'WorkspaceId'>;
type UserId = Brand<string, 'UserId'>;
type CustomerId = Brand<string, 'CustomerId'>;
type CampaignId = Brand<string, 'CampaignId'>;
type CampaignRecipientId = Brand<string, 'CampaignRecipientId'>;
type BookingId = Brand<string, 'BookingId'>;
type ReviewId = Brand<string, 'ReviewId'>;
type EventId = Brand<string, 'EventId'>;
type CommandId = Brand<string, 'CommandId'>;
type RequestId = Brand<string, 'RequestId'>;
type Version = Brand<number, 'Version'>;
type UtcInstant = Brand<string, 'UtcInstant'>;
type LocalDateTime = Brand<string, 'LocalDateTime'>;
type IanaTimezone = Brand<string, 'IanaTimezone'>;
type CurrencyCode = Brand<string, 'CurrencyCode'>;
type MinorUnits = Brand<number, 'MinorUnits'>;
type IdempotencyKey = Brand<string, 'IdempotencyKey'>;

type Money = Readonly<{ minorUnits: MinorUnits; currency: CurrencyCode }>;
type NonEmptyArray<T> = readonly [T, ...T[]];
```

`Money` construction rejects unsafe integers and currency that differs from the workspace. Commands that cannot accept negative money use a separate non-negative constructor.

## Server-owned context

```ts
type Actor =
  | { kind: 'user'; userId: UserId }
  | { kind: 'system'; reason: 'retention' | 'account_deletion' };

type CommandContext = Readonly<{
  workspaceId: WorkspaceId;
  actor: Actor;
  commandId: CommandId;
  requestId: RequestId;
  now: UtcInstant;
}>;

type QueryContext = Readonly<{
  workspaceId: WorkspaceId;
  actorUserId: UserId;
}>;
```

The authenticated session creates these contexts. A route body or header cannot set `workspaceId`, actor, command ID, request ID, or clock.

## Aggregates and facts

### User and workspace

`User` owns normalized email, Argon2id password hash, reset generation, account state, and timestamps. `BusinessWorkspace` owns the business name, category, timezone, currency, default country code, validated booking link, follow-up rules, onboarding state, retention-policy settings, and owner user ID.

Changing currency after the first money record is forbidden until a migration policy exists. Historical values always retain their currency.

### Customer

`Customer` owns identity and current workflow state. It contains normalized and display contact values, source, service interests, current lifecycle, notes, and the private `lastInteractionAt` query projection. It does not store consent or booking booleans.

```ts
type CustomerLifecycle =
  | { kind: 'enquiry' }
  | { kind: 'contacted'; at: UtcInstant }
  | { kind: 'replied'; at: UtcInstant }
  | { kind: 'booked'; bookingId: BookingId; at: UtcInstant }
  | { kind: 'completed'; at: UtcInstant }
  | { kind: 'lost'; at: UtcInstant; reason?: string };
```

### Consent record

`ConsentRecord` is an immutable fact with customer, channel, granted or withdrawn decision, provenance, actor, evidence note, and effective time. The latest record by effective time and ID determines current permission for a channel.

```ts
type ContactChannel = 'whatsapp' | 'sms' | 'email' | 'phone';
type ConsentDecision = 'granted' | 'withdrawn';
```

No record means unknown and therefore ineligible. A withdrawal suppresses future contact until a later valid grant with new provenance exists.

### Interaction

`Interaction` is an append-only enquiry, note, call, message handoff, reply, or system outcome. It owns direction, occurrence time, actor, optional recipient link, and protected content. The event ledger stores only a safe fact and reference.

### Campaign and recipient

`Campaign` owns its name, audience-rule snapshot, message template, state, version, and timing. Only draft campaigns accept edits. Recipient review creates or refreshes a snapshot, but activation rechecks current facts.

```ts
type CampaignState =
  | { kind: 'draft'; version: Version }
  | { kind: 'ready'; version: Version; reviewedAt: UtcInstant }
  | { kind: 'active'; version: Version; activatedAt: UtcInstant }
  | { kind: 'completed'; version: Version; completedAt: UtcInstant }
  | { kind: 'cancelled'; version: Version; cancelledAt: UtcInstant };

type EligibilityReason =
  | 'consent_missing'
  | 'consent_withdrawn'
  | 'already_booked'
  | 'missing_phone'
  | 'removed_by_owner'
  | 'campaign_cancelled';

type EligibilityDecision =
  | { kind: 'eligible'; checkedAt: UtcInstant; consentRecordId: string }
  | { kind: 'excluded'; checkedAt: UtcInstant; reasons: NonEmptyArray<EligibilityReason> };

type RecipientState =
  | { kind: 'prepared'; preparedAt: UtcInstant }
  | { kind: 'skipped'; skippedAt: UtcInstant; reason: string }
  | { kind: 'sent'; markedAt: UtcInstant }
  | { kind: 'replied'; markedAt: UtcInstant }
  | { kind: 'booked'; bookingId: BookingId; markedAt: UtcInstant };
```

`sent` means that the owner recorded the handoff. It does not mean provider delivery.

### Booking

`Booking` owns the customer, service, appointment instant, business-local date, agreed money, optional source recipient, notes, creator, state, and timestamps.

```ts
type BookingState =
  | { kind: 'tentative' }
  | { kind: 'confirmed'; at: UtcInstant }
  | { kind: 'completed'; at: UtcInstant }
  | { kind: 'cancelled'; at: UtcInstant; reason?: string }
  | { kind: 'no_show'; at: UtcInstant };
```

A source recipient must belong to the same workspace and customer. It must be `sent` or `replied`. Otherwise, the booking can be stored without campaign attribution.

### Review

`Review` owns immutable original review text, rating, reviewer display name, source, received time, and a separate response state.

```ts
type ReviewResponseState =
  | { kind: 'unanswered' }
  | { kind: 'drafted'; text: string; revisedAt: UtcInstant }
  | { kind: 'posted_manually'; text: string; postedAt: UtcInstant };
```

### Session

`Session` owns the hash of a random opaque token, user, workspace, issue time, idle expiry, absolute expiry, last-seen time, CSRF token hash, generation, and state.

```ts
type SessionState =
  | { kind: 'active' }
  | { kind: 'revoked'; at: UtcInstant }
  | { kind: 'expired'; at: UtcInstant };
```

### Operational event

`OperationalEvent` is the authoritative audit and reporting fact. The payload union is exhaustive and contains only safe business metadata.

```ts
type OperationalEvent = Readonly<{
  eventId: EventId;
  schemaVersion: 1;
  workspaceId: WorkspaceId;
  commandId: CommandId;
  ordinal: number;
  occurredAt: UtcInstant;
  actor: Actor;
  requestId: RequestId;
  subject: {
    kind: 'customer' | 'campaign' | 'recipient' | 'booking' | 'review' | 'workspace';
    id: string;
  };
  payload: OperationalEventPayload;
}>;

type OperationalEventPayload =
  | { type: 'enquiry.created'; customerId: CustomerId; source: string; quotedMinorUnits?: number }
  | {
      type: 'consent.recorded';
      customerId: CustomerId;
      channel: ContactChannel;
      decision: ConsentDecision;
      consentRecordId: string;
    }
  | { type: 'follow_up.prepared'; campaignId: CampaignId; recipientId: CampaignRecipientId }
  | { type: 'follow_up.marked_sent'; campaignId: CampaignId; recipientId: CampaignRecipientId }
  | { type: 'reply.recorded'; customerId: CustomerId; campaignId?: CampaignId }
  | {
      type: 'campaign.changed';
      campaignId: CampaignId;
      fromVersion: Version;
      toVersion: Version;
      changedFields: readonly string[];
    }
  | { type: 'campaign.activated'; campaignId: CampaignId; recipientCount: number }
  | {
      type: 'campaign.outcome_changed';
      campaignId: CampaignId;
      recipientId: CampaignRecipientId;
      outcome: RecipientState['kind'];
    }
  | {
      type: 'booking.recorded';
      bookingId: BookingId;
      customerId: CustomerId;
      agreedMinorUnits: number;
      currency: CurrencyCode;
      sourceRecipientId?: CampaignRecipientId;
    }
  | {
      type: 'booking.status_changed';
      bookingId: BookingId;
      from: BookingState['kind'];
      to: BookingState['kind'];
    }
  | { type: 'review.response_prepared'; reviewId: ReviewId }
  | { type: 'review.marked_posted'; reviewId: ReviewId }
  | { type: 'workspace.settings_changed'; changedFields: readonly string[] }
  | { type: 'account.deletion_requested' };
```

The ledger has no general update or delete operation. Approved retention purge and account deletion are explicit system commands.

## State transitions

The server owns every transition. Repeating the same terminal result through the same idempotency key returns the stored result. A different invalid action returns `INVALID_TRANSITION`.

### Customer lifecycle

| From        | Allowed target                           | Guard                                                                                                            |
| ----------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `enquiry`   | `contacted`, `replied`, `booked`, `lost` | The corresponding interaction or booking is stored in the same transaction.                                      |
| `contacted` | `replied`, `booked`, `lost`              | The corresponding interaction or booking is stored in the same transaction.                                      |
| `replied`   | `booked`, `lost`                         | The corresponding interaction or booking is stored in the same transaction.                                      |
| `booked`    | `completed`                              | The linked booking completed.                                                                                    |
| `booked`    | `replied` or `lost`                      | The linked booking was cancelled and no other active booking exists. Explicit reconciliation decides the target. |
| `completed` | `enquiry`                                | An explicit reopen command stores a new enquiry interaction.                                                     |
| `lost`      | `enquiry`                                | An explicit reopen command stores a new enquiry interaction.                                                     |

All other customer transitions are invalid.

### Campaign

| From                     | Allowed target | Guard                                                                           |
| ------------------------ | -------------- | ------------------------------------------------------------------------------- |
| `draft`                  | `ready`        | The template parses, review is current, and at least one recipient is eligible. |
| `draft`                  | `cancelled`    | The owner confirms cancellation.                                                |
| `ready`                  | `draft`        | An edit invalidates the prior review and increments the version.                |
| `ready`                  | `active`       | The activation recheck leaves at least one eligible recipient.                  |
| `ready`                  | `cancelled`    | The owner confirms cancellation.                                                |
| `active`                 | `completed`    | Every recipient is terminal or the owner closes explicitly.                     |
| `active`                 | `cancelled`    | Unsent recipients become excluded with `campaign_cancelled`.                    |
| `completed`, `cancelled` | none           | These states are terminal.                                                      |

Only `draft` accepts audience, template, and recipient changes. Every edit and transition requires the expected version.

### Recipient

| From                | Allowed target      |
| ------------------- | ------------------- |
| `prepared`          | `sent`, `skipped`   |
| `sent`              | `replied`, `booked` |
| `replied`           | `booked`            |
| `skipped`, `booked` | none                |

Recording `booked` requires a stored booking. A provider-confirmed delivery state may be added only with a separate authenticated provider receipt design.

### Booking

| From                                | Allowed target                      |
| ----------------------------------- | ----------------------------------- |
| `tentative`                         | `confirmed`, `cancelled`            |
| `confirmed`                         | `completed`, `cancelled`, `no_show` |
| `completed`, `cancelled`, `no_show` | none                                |

A correction to a terminal booking is a separate command with a reason and a correction event. It does not rewrite history silently.

### Review response

| From              | Allowed target                    |
| ----------------- | --------------------------------- |
| `unanswered`      | `drafted`                         |
| `drafted`         | `drafted`, `posted_manually`      |
| `posted_manually` | `drafted` through explicit reopen |

Original review text never changes.

### Session

| From                 | Allowed target       |
| -------------------- | -------------------- |
| `active`             | `revoked`, `expired` |
| `revoked`, `expired` | none                 |

## Domain interfaces

```ts
interface CustomerCommands {
  createEnquiry(ctx: CommandContext, command: CreateEnquiry): Promise<CreateEnquiryResult>;
  update(ctx: CommandContext, command: UpdateCustomer): Promise<Customer>;
  recordInteraction(ctx: CommandContext, command: RecordInteraction): Promise<Interaction>;
  recordConsent(ctx: CommandContext, command: RecordConsent): Promise<ConsentRecord>;
  previewImport(ctx: CommandContext, command: PreviewImport): Promise<ImportPreview>;
  commitImport(ctx: CommandContext, command: CommitReviewedImport): Promise<ImportResult>;
}

interface CampaignCommands {
  createDraft(ctx: CommandContext, command: CreateCampaignDraft): Promise<Campaign>;
  updateDraft(
    ctx: CommandContext,
    command: UpdateCampaignDraft & { expectedVersion: Version },
  ): Promise<Campaign>;
  reviewRecipients(
    ctx: CommandContext,
    command: ReviewRecipients & { expectedVersion: Version },
  ): Promise<RecipientReview>;
  activate(
    ctx: CommandContext,
    command: ActivateCampaign & { expectedVersion: Version },
  ): Promise<Campaign>;
  removeRecipient(
    ctx: CommandContext,
    command: RemoveRecipient & { expectedVersion: Version },
  ): Promise<Campaign>;
  recordOutcome(
    ctx: CommandContext,
    command: RecordRecipientOutcome & { idempotencyKey: IdempotencyKey },
  ): Promise<CampaignRecipient>;
}

interface BookingCommands {
  record(
    ctx: CommandContext,
    command: RecordBooking & { idempotencyKey: IdempotencyKey },
  ): Promise<Booking>;
  changeStatus(ctx: CommandContext, command: ChangeBookingStatus): Promise<Booking>;
  correct(ctx: CommandContext, command: CorrectBooking & { reason: string }): Promise<Booking>;
}

interface ReviewCommands {
  create(ctx: CommandContext, command: CreateReview): Promise<Review>;
  prepareResponse(ctx: CommandContext, command: PrepareReviewResponse): Promise<Review>;
  markPosted(ctx: CommandContext, command: MarkReviewPosted): Promise<Review>;
}

interface TodayQueries {
  get(ctx: QueryContext, query: TodayQuery): Promise<TodayView>;
}

interface ResultQueries {
  summarize(ctx: QueryContext, query: ResultsQuery): Promise<ResultsView>;
  exportCsv(ctx: QueryContext, query: ResultsQuery): Promise<SafeCsvStream>;
}
```

These interfaces hide transition checks, duplicate review, eligibility, transactions, current-state writes, events, and receipts. ETags, idempotency keys, and CSRF remain visible at the client boundary because the caller must participate in those protocols.

## Results definitions

- New enquiries count `enquiry.created` events in the business-local range.
- Follow-ups prepared count `follow_up.prepared` events.
- Follow-ups sent count `follow_up.marked_sent` events. The label is never `delivered`.
- Replies count `reply.recorded` events.
- Bookings count booking records created in the range with the included statuses named in the response.
- Recorded booking value sums booking `agreedMoney` for the named statuses and currency.
- Campaign-attributed bookings require a valid same-workspace, same-customer source recipient.
- Collected revenue is absent until a payment aggregate and payment facts exist.

Every response includes UTC bounds, business-local dates, timezone, currency, included statuses, and generation time.

## Persistence invariants

- Every business collection stores `workspaceId`.
- Every repository method requires a workspace scope.
- Contact indexes are non-unique because duplicates require review.
- Campaign recipient uniqueness is workspace, campaign, and customer.
- Current-state updates, receipts, events, and private query projections commit together.
- Persistence mappers validate database rows before constructing domain values.
- Production index definitions and access paths are authoritative in `docs/architecture.md`.
