import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'RESOURCE_NOT_FOUND',
  'INVALID_TRANSITION',
  'IDEMPOTENCY_KEY_REUSED',
  'RATE_LIMITED',
  'CONFLICT',
  'INTERNAL_ERROR',
  'CSRF_FAILED',
  'DUPLICATE_CUSTOMER',
  'DUPLICATE_REVIEW_REQUIRED',
  'CONSENT_REQUIRED',
  'CAMPAIGN_VERSION_CONFLICT',
  'CURRENCY_LOCKED',
  'ACCOUNT_DELETION_REQUIRES_CONFIRMATION',
]);

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const RegisterRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  businessName: z.string().trim().min(2).max(120),
});

export const SignInRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().trim().email().max(254),
});

export const PasswordResetRequestResponseSchema = z.object({
  message: z.string(),
  developmentResetToken: z.string().optional(),
});

export const PasswordResetCompleteRequestSchema = z.object({
  token: z.string().min(32).max(200),
  password: z.string().min(12).max(128),
});

export const WorkspaceResponseSchema = z.object({
  id: z.string(),
  businessName: z.string(),
  category: z.string().nullable(),
  timezone: z.string(),
  currency: z.string(),
  defaultCountryCode: z.string(),
  bookingLink: z.string().nullable(),
  followUpDays: z.number().int(),
  onboardingComplete: z.boolean(),
  reviewResponseTemplate: z.string(),
  isDemo: z.boolean(),
});

export const OnboardingRequestSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
        return true;
      } catch {
        return false;
      }
    }, 'Use a valid IANA timezone.'),
  currency: z.string().regex(/^[A-Z]{3}$/),
  defaultCountryCode: z.string().regex(/^\+[1-9][0-9]{0,3}$/),
  bookingLink: z.string().url().max(500).optional().or(z.literal('')),
  followUpDays: z.number().int().min(1).max(90),
});

export const WorkspaceSettingsPatchSchema = z
  .object({
    businessName: z.string().trim().min(2).max(120).optional(),
    category: z.string().trim().min(2).max(80).nullable().optional(),
    timezone: OnboardingRequestSchema.shape.timezone.optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    defaultCountryCode: z
      .string()
      .regex(/^\+[1-9][0-9]{0,3}$/)
      .optional(),
    bookingLink: z.string().url().max(500).optional().or(z.literal('')).or(z.null()),
    followUpDays: z.number().int().min(1).max(90).optional(),
    reviewResponseTemplate: z.string().trim().max(2000).optional(),
    onboardingComplete: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one setting is required.');

export const CreateCustomerRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional().default(''),
  phone: z.string().trim().min(7).max(40),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  source: z.string().trim().min(1).max(80),
  service: z.string().trim().min(1).max(120),
  quotedMinorUnits: z.number().int().min(0).max(100_000_000).optional(),
  consentChannel: z.enum(['whatsapp', 'sms', 'email', 'phone']),
  consentDecision: z.enum(['granted', 'withdrawn']),
  serviceInterests: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  internalNotes: z.string().trim().max(5000).default(''),
  confirmDuplicate: z.boolean().default(false),
});

export const UpdateCustomerRequestSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().max(80),
    phone: z.string().trim().min(7).max(40),
    email: z.string().trim().email().max(254).or(z.literal('')),
    source: z.string().trim().min(1).max(80),
    service: z.string().trim().min(1).max(120),
    quotedMinorUnits: z.number().int().min(0).max(100_000_000).nullable(),
    serviceInterests: z.array(z.string().trim().min(1).max(120)).max(20),
    internalNotes: z.string().trim().max(5000),
    lifecycle: z.enum(['enquiry', 'contacted', 'replied', 'booked', 'completed', 'lost']),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const CreateInteractionRequestSchema = z.object({
  kind: z.enum(['enquiry', 'call', 'message', 'note']),
  body: z.string().trim().min(1).max(5000),
  serviceInterest: z.string().trim().max(120).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

export const RecordConsentRequestSchema = z.object({
  channel: z.enum(['whatsapp', 'sms', 'email', 'phone']),
  decision: z.enum(['granted', 'withdrawn']),
});

export const CreateBookingRequestSchema = z.object({
  customerId: z.string().regex(/^[a-f0-9-]{8,64}$/i),
  service: z.string().trim().min(1).max(120),
  appointmentAt: z.string().datetime({ offset: true }),
  agreedMinorUnits: z.number().int().min(0).max(100_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  notes: z.string().trim().max(2000).optional().default(''),
});

export const UpdateBookingStatusRequestSchema = z.object({
  state: z.enum(['tentative', 'confirmed', 'completed', 'cancelled', 'no_show']),
});

export const CsrfResponseSchema = z.object({ csrfToken: z.string().min(16) });

export const CustomerResponseSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  source: z.string(),
  service: z.string(),
  quotedMoney: z.object({ currency: z.string(), minorUnits: z.number().int() }).nullable(),
  consent: z.object({ channel: z.string(), decision: z.string() }).nullable(),
  lifecycle: z.string(),
  lastInteractionAt: z.string(),
  serviceInterests: z.array(z.string()),
  internalNotes: z.string(),
  contactEligible: z.boolean(),
});

export const InteractionResponseSchema = z.object({
  id: z.string(),
  kind: z.enum(['enquiry', 'call', 'message', 'note']),
  body: z.string(),
  serviceInterest: z.string().nullable(),
  occurredAt: z.string(),
});

export const ConsentHistoryResponseSchema = z.object({
  id: z.string(),
  channel: z.enum(['whatsapp', 'sms', 'email', 'phone']),
  decision: z.enum(['granted', 'withdrawn']),
  capturedAt: z.string(),
});

export const CustomerDetailResponseSchema = CustomerResponseSchema.extend({
  interactions: z.array(InteractionResponseSchema),
  consentHistory: z.array(ConsentHistoryResponseSchema),
});

export const CustomerImportPreviewRequestSchema = z.object({
  csv: z.string().min(1).max(1_000_000),
  mapping: z.record(z.string(), z.string()).optional(),
});

export const CustomerImportPreviewResponseSchema = z.object({
  importId: z.string(),
  headers: z.array(z.string()),
  mapping: z.record(z.string(), z.string().nullable()),
  rows: z.array(
    z.object({
      rowNumber: z.number().int(),
      values: z.record(z.string(), z.string()),
      errors: z.array(z.string()),
      duplicates: z.array(
        z.object({ id: z.string(), matchedOn: z.array(z.enum(['phone', 'email'])) }),
      ),
    }),
  ),
  limits: z.object({ maxRows: z.number().int(), maxBytes: z.number().int() }),
});

export const CustomerImportCommitRequestSchema = z.object({
  resolutions: z.record(z.string(), z.enum(['create', 'skip'])),
});

export const CustomerImportCommitResponseSchema = z.object({
  created: z.array(CustomerResponseSchema),
  skippedRows: z.array(z.number().int()),
});

export const RegisterResponseSchema = z.object({
  userId: z.string(),
  workspaceId: z.string(),
  csrfToken: z.string().min(16),
});

export const SignInResponseSchema = RegisterResponseSchema;
export const PasswordResetCompleteResponseSchema = RegisterResponseSchema;
export const SessionResponseSchema = z.object({ userId: z.string(), workspaceId: z.string() });
export const CustomerListResponseSchema = z.object({
  items: z.array(CustomerResponseSchema),
  nextCursor: z.string().nullable(),
});

export const TodayResponseSchema = z.object({
  items: z.array(
    CustomerResponseSchema.extend({ reasons: z.array(z.string()), nextAction: z.string() }),
  ),
  generatedAt: z.string(),
});

export const BookingResponseSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  service: z.string(),
  appointmentAt: z.string(),
  agreedMoney: z.object({ currency: z.string(), minorUnits: z.number().int() }),
  state: z.enum(['tentative', 'confirmed', 'completed', 'cancelled', 'no_show']),
});

export const BookingListResponseSchema = z.object({ items: z.array(BookingResponseSchema) });

export const ResultsResponseSchema = z.object({
  range: z.object({
    from: z.string(),
    to: z.string(),
    fromLocal: z.string(),
    toLocal: z.string(),
    throughLocal: z.string(),
    timezone: z.string(),
  }),
  throughLocal: z.string(),
  generatedAt: z.string(),
  includedBookingStatuses: z.array(z.enum(['tentative', 'confirmed', 'completed', 'no_show'])),
  newEnquiries: z.number().int(),
  bookingsRecorded: z.number().int(),
  bookingDefinition: z.string(),
  recordedValueDefinition: z.string(),
  recordedBookingValue: z.object({ currency: z.string(), minorUnits: z.number().int() }),
  followUpsPrepared: z.number().int(),
  followUpsSent: z.number().int(),
  campaignReplies: z.number().int(),
  campaignConversions: z.number().int(),
});

export const ResultsQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  through: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const ReviewResponseStateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('unanswered') }),
  z.object({ kind: z.literal('drafted'), text: z.string(), revisedAt: z.string() }),
  z.object({ kind: z.literal('posted_manually'), text: z.string(), postedAt: z.string() }),
]);
export const ReviewResponseActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save_draft'), text: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal('mark_posted_manually') }),
  z.object({ action: z.literal('reopen_draft'), text: z.string().trim().min(1).max(2000) }),
]);
export const ReviewResponseSchema = z.object({
  id: z.string(),
  reviewerName: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string(),
  source: z.string(),
  receivedAt: z.string(),
  response: ReviewResponseStateSchema,
});
export const ReviewListQuerySchema = z.object({
  responseState: z.enum(['unanswered', 'drafted', 'posted_manually']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
export const ReviewListResponseSchema = z.object({
  items: z.array(ReviewResponseSchema),
  nextCursor: z.string().nullable(),
});
export const CreateReviewRequestSchema = z.object({
  reviewerName: z.string().trim().min(1).max(120),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  text: z.string().trim().min(1).max(5000),
  source: z.string().trim().min(1).max(80),
  receivedAt: z.string().datetime({ offset: true }).optional(),
});
export const ReviewImportPreviewRequestSchema = z.object({
  csv: z.string().min(1).max(1_000_000),
});
export const ReviewImportPreviewResponseSchema = z.object({
  importId: z.string(),
  headers: z.array(z.string()),
  rows: z.array(
    z.object({
      rowNumber: z.number().int(),
      values: z.record(z.string(), z.string()),
      errors: z.array(z.string()),
    }),
  ),
  limits: z.object({ maxRows: z.number().int(), maxBytes: z.number().int() }),
});
export const ReviewImportCommitRequestSchema = z.object({
  resolutions: z.record(z.string(), z.enum(['create', 'skip'])).default({}),
});
export const ReviewImportCommitResponseSchema = z.object({
  created: z.array(ReviewResponseSchema),
  skippedRows: z.array(z.number().int()),
});

export const WorkspaceExportCustomerSchema = z
  .object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string(),
    email: z.string().nullable(),
    source: z.string(),
    service: z.string(),
    quotedMinorUnits: z.number().int().nullable(),
    lifecycle: z.string(),
    lastInteractionAt: z.string(),
    serviceInterests: z.array(z.string()),
    internalNotes: z.string(),
  })
  .strict();
export const WorkspaceExportConsentSchema = z
  .object({
    id: z.string(),
    customerId: z.string(),
    channel: z.string(),
    decision: z.string(),
    capturedAt: z.string(),
  })
  .strict();
export const WorkspaceExportInteractionSchema = z
  .object({
    id: z.string(),
    customerId: z.string(),
    actorUserId: z.string(),
    kind: z.string(),
    body: z.string(),
    serviceInterest: z.string().nullable(),
    occurredAt: z.string(),
  })
  .strict();
export const WorkspaceExportCampaignSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    channel: z.string(),
    template: z.string(),
    audience: z.record(z.string(), z.unknown()),
    status: z.string(),
    version: z.number().int(),
    reviewedVersion: z.number().int(),
  })
  .strict();
export const WorkspaceExportCampaignRevisionSchema = z
  .object({
    id: z.string(),
    campaignId: z.string(),
    version: z.number().int(),
    name: z.string(),
    channel: z.string(),
    template: z.string(),
    audience: z.record(z.string(), z.unknown()),
    status: z.string(),
    reviewedVersion: z.number().int(),
    recordedAt: z.string(),
  })
  .strict();
export const WorkspaceExportCampaignRecipientSchema = z
  .object({
    id: z.string(),
    campaignId: z.string(),
    customerId: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().nullable(),
    service: z.string(),
    eligibility: z.string(),
    reason: z.string().nullable(),
    consentRecordId: z.string().nullable(),
    eligibilityCheckedAt: z.string(),
    personalizedPreview: z.string(),
    removed: z.boolean(),
    outcome: z.string().nullable(),
    bookingId: z.string().nullable(),
    outcomeAt: z.string().nullable(),
  })
  .strict();
export const WorkspaceExportBookingSchema = z
  .object({
    id: z.string(),
    customerId: z.string(),
    service: z.string(),
    appointmentAt: z.string(),
    agreedMinorUnits: z.number().int(),
    currency: z.string(),
    notes: z.string(),
    state: z.string(),
    sourceCampaignRecipientId: z.string().nullable(),
  })
  .strict();
export const WorkspaceExportOperationalEventSchema = z
  .object({
    eventId: z.string(),
    requestId: z.string(),
    commandId: z.string(),
    ordinal: z.number().int(),
    occurredAt: z.string(),
    subject: z.object({ kind: z.string(), id: z.string() }).strict(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();
export const WorkspaceExportSchema = z
  .object({
    schemaVersion: z.literal(1),
    exportedAt: z.string(),
    account: z.object({ email: z.string().email() }),
    workspace: WorkspaceResponseSchema,
    customers: z.array(WorkspaceExportCustomerSchema),
    consents: z.array(WorkspaceExportConsentSchema),
    interactions: z.array(WorkspaceExportInteractionSchema),
    campaigns: z.array(WorkspaceExportCampaignSchema),
    campaignRevisions: z.array(WorkspaceExportCampaignRevisionSchema),
    campaignRecipients: z.array(WorkspaceExportCampaignRecipientSchema),
    bookings: z.array(WorkspaceExportBookingSchema),
    reviews: z.array(ReviewResponseSchema),
    operationalEvents: z.array(WorkspaceExportOperationalEventSchema),
  })
  .strict();
export const DeleteAccountRequestSchema = z.object({
  password: z.string().min(1).max(128),
  businessNameConfirmation: z.string().min(2).max(120),
});
export type WorkspaceExportDocument = z.infer<typeof WorkspaceExportSchema>;

export const CampaignAudienceSchema = z.object({
  consentChannel: z.literal('whatsapp').default('whatsapp'),
  lifecycle: z.enum(['enquiry', 'contacted', 'replied', 'booked', 'completed', 'lost']).optional(),
  service: z.string().trim().max(120).optional(),
  source: z.string().trim().max(80).optional(),
});

export const CampaignTemplateSchema = z.string().trim().min(1).max(2000);
export const CreateCampaignRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channel: z.literal('whatsapp'),
  template: CampaignTemplateSchema,
  audience: CampaignAudienceSchema,
});
export const UpdateCampaignRequestSchema = z.object({
  version: z.number().int().positive(),
  name: z.string().trim().min(1).max(120).optional(),
  template: CampaignTemplateSchema.optional(),
  audience: CampaignAudienceSchema.optional(),
});
export const CampaignResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['draft', 'ready', 'active', 'completed', 'cancelled']),
  version: z.number().int(),
  channel: z.literal('whatsapp'),
  template: z.string(),
  audience: CampaignAudienceSchema,
  recipientCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const CampaignListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.coerce.number().int().min(0).max(1000000).default(0),
  status: z.enum(['draft', 'ready', 'active', 'completed', 'cancelled']).optional(),
});
export const CampaignListResponseSchema = z.object({
  items: z.array(CampaignResponseSchema),
  nextCursor: z.string().nullable(),
});
export const CampaignTransitionRequestSchema = z.object({
  version: z.number().int().positive(),
  to: z.enum(['draft', 'ready', 'active', 'completed', 'cancelled']),
});
export const CampaignRecipientResponseSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  customerId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  eligibility: z.enum([
    'eligible',
    'removed',
    'withdrawn',
    'booked',
    'invalid_contact',
    'no_consent',
    'cancelled',
  ]),
  reason: z.string().nullable(),
  consentRecordId: z.string().nullable(),
  eligibilityCheckedAt: z.string(),
  removed: z.boolean(),
  outcome: z.enum(['sent', 'skipped', 'replied', 'booked']).nullable(),
  personalizedPreview: z.string(),
  whatsappHref: z.string().nullable(),
});
export const CampaignRecipientListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.coerce.number().int().min(0).max(1000000).default(0),
  eligibility: z
    .enum([
      'eligible',
      'removed',
      'withdrawn',
      'booked',
      'invalid_contact',
      'no_consent',
      'cancelled',
    ])
    .optional(),
});
export const CampaignRecipientListResponseSchema = z.object({
  items: z.array(CampaignRecipientResponseSchema),
  nextCursor: z.string().nullable(),
});
export const CampaignRecipientRemoveRequestSchema = z.object({
  campaignVersion: z.number().int().positive(),
});
export const CampaignOutcomeRequestSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('sent') }),
  z.object({ outcome: z.literal('skipped') }),
  z.object({ outcome: z.literal('replied') }),
  z.object({ outcome: z.literal('booked'), bookingId: z.string().regex(/^[a-f0-9-]{8,64}$/i) }),
]);
export const CampaignOutcomeResponseSchema = z.object({
  recipient: CampaignRecipientResponseSchema,
  idempotent: z.boolean(),
});
export const WhatsAppLinkResponseSchema = z.object({
  href: z.string().url(),
  deliveryClaim: z.literal('prepared_link_only'),
});
export const CampaignAuditResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      occurredAt: z.string(),
      payload: z.record(z.string(), z.unknown()),
    }),
  ),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type SignInRequest = z.infer<typeof SignInRequestSchema>;
export type OnboardingRequest = z.infer<typeof OnboardingRequestSchema>;
export type CreateCustomerRequest = z.infer<typeof CreateCustomerRequestSchema>;
export type UpdateCustomerRequest = z.infer<typeof UpdateCustomerRequestSchema>;
export type CreateInteractionRequest = z.infer<typeof CreateInteractionRequestSchema>;
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;
export type WorkspaceResponse = z.infer<typeof WorkspaceResponseSchema>;
export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>;
export type UpdateCampaignRequest = z.infer<typeof UpdateCampaignRequestSchema>;
export type CampaignAudience = z.infer<typeof CampaignAudienceSchema>;
export type CampaignOutcomeRequest = z.infer<typeof CampaignOutcomeRequestSchema>;
export type WorkspaceSettingsPatch = z.infer<typeof WorkspaceSettingsPatchSchema>;
export type ResultsQuery = z.infer<typeof ResultsQuerySchema>;
export type ReviewResponseContractState = z.infer<typeof ReviewResponseStateSchema>;
export type ReviewResponseAction = z.infer<typeof ReviewResponseActionSchema>;
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;
export type CreateReviewRequest = z.infer<typeof CreateReviewRequestSchema>;
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;
