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
  state: z.string(),
});

export const BookingListResponseSchema = z.object({ items: z.array(BookingResponseSchema) });

export const ResultsResponseSchema = z.object({
  range: z.object({
    from: z.string(),
    to: z.string(),
    fromLocal: z.string(),
    toLocal: z.string(),
    timezone: z.string(),
  }),
  newEnquiries: z.number().int(),
  bookingsRecorded: z.number().int(),
  bookingDefinition: z.string(),
  recordedValueDefinition: z.string(),
  recordedBookingValue: z.object({ currency: z.string(), minorUnits: z.number().int() }),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type SignInRequest = z.infer<typeof SignInRequestSchema>;
export type OnboardingRequest = z.infer<typeof OnboardingRequestSchema>;
export type CreateCustomerRequest = z.infer<typeof CreateCustomerRequestSchema>;
export type UpdateCustomerRequest = z.infer<typeof UpdateCustomerRequestSchema>;
export type CreateInteractionRequest = z.infer<typeof CreateInteractionRequestSchema>;
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;
export type WorkspaceResponse = z.infer<typeof WorkspaceResponseSchema>;
