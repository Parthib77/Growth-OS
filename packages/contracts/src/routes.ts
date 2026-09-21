import { z } from 'zod';
import {
  BookingResponseSchema,
  CreateBookingRequestSchema,
  CreateCustomerRequestSchema,
  CustomerResponseSchema,
  CustomerDetailResponseSchema,
  CustomerImportCommitRequestSchema,
  CustomerImportCommitResponseSchema,
  CustomerImportPreviewRequestSchema,
  CustomerImportPreviewResponseSchema,
  CreateInteractionRequestSchema,
  InteractionResponseSchema,
  RecordConsentRequestSchema,
  UpdateCustomerRequestSchema,
  ErrorResponseSchema,
  OnboardingRequestSchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
  ResultsResponseSchema,
  SignInRequestSchema,
  TodayResponseSchema,
  CsrfResponseSchema,
  WorkspaceResponseSchema,
} from './schemas.js';

export type RouteDefinition = Readonly<{
  operationId: string;
  module:
    | 'health'
    | 'auth'
    | 'workspace'
    | 'customers'
    | 'customerImports'
    | 'today'
    | 'bookings'
    | 'results'
    | 'openapi';
  method: 'get' | 'post' | 'patch';
  path: string;
  auth: 'public' | 'session' | 'csrf';
  request?: z.ZodType;
  responses: Readonly<Record<number, z.ZodType>>;
}>;

export const routeRegistry = [
  {
    operationId: 'healthLive',
    module: 'health',
    method: 'get',
    path: '/api/v1/health/live',
    auth: 'public',
    responses: { 200: z.object({ status: z.literal('ok') }) },
  },
  {
    operationId: 'healthReady',
    module: 'health',
    method: 'get',
    path: '/api/v1/health/ready',
    auth: 'public',
    responses: { 200: z.object({ status: z.string() }), 503: ErrorResponseSchema },
  },
  {
    operationId: 'csrf',
    module: 'auth',
    method: 'get',
    path: '/api/v1/auth/csrf',
    auth: 'public',
    responses: { 200: CsrfResponseSchema },
  },
  {
    operationId: 'register',
    module: 'auth',
    method: 'post',
    path: '/api/v1/auth/register',
    auth: 'csrf',
    request: RegisterRequestSchema,
    responses: {
      201: RegisterResponseSchema,
      400: ErrorResponseSchema,
    },
  },
  {
    operationId: 'signIn',
    module: 'auth',
    method: 'post',
    path: '/api/v1/auth/sign-in',
    auth: 'csrf',
    request: SignInRequestSchema,
    responses: {
      200: RegisterResponseSchema,
      401: ErrorResponseSchema,
    },
  },
  {
    operationId: 'signOut',
    module: 'auth',
    method: 'post',
    path: '/api/v1/auth/sign-out',
    auth: 'csrf',
    responses: { 204: z.null(), 401: ErrorResponseSchema },
  },
  {
    operationId: 'session',
    module: 'auth',
    method: 'get',
    path: '/api/v1/session',
    auth: 'session',
    responses: {
      200: z.object({ userId: z.string(), workspaceId: z.string() }),
      401: ErrorResponseSchema,
    },
  },
  {
    operationId: 'getWorkspace',
    module: 'workspace',
    method: 'get',
    path: '/api/v1/workspace',
    auth: 'session',
    responses: { 200: WorkspaceResponseSchema, 401: ErrorResponseSchema },
  },
  {
    operationId: 'updateWorkspace',
    module: 'workspace',
    method: 'patch',
    path: '/api/v1/workspace',
    auth: 'csrf',
    request: OnboardingRequestSchema,
    responses: { 200: WorkspaceResponseSchema, 400: ErrorResponseSchema },
  },
  {
    operationId: 'listCustomers',
    module: 'customers',
    method: 'get',
    path: '/api/v1/customers',
    auth: 'session',
    responses: {
      200: z.object({ items: z.array(CustomerResponseSchema), nextCursor: z.string().nullable() }),
      401: ErrorResponseSchema,
    },
  },
  {
    operationId: 'getCustomer',
    module: 'customers',
    method: 'get',
    path: '/api/v1/customers/{customerId}',
    auth: 'session',
    responses: { 200: CustomerResponseSchema, 404: ErrorResponseSchema },
  },
  {
    operationId: 'getCustomerDetail',
    module: 'customers',
    method: 'get',
    path: '/api/v1/customers/{customerId}/detail',
    auth: 'session',
    responses: { 200: CustomerDetailResponseSchema, 404: ErrorResponseSchema },
  },
  {
    operationId: 'createCustomer',
    module: 'customers',
    method: 'post',
    path: '/api/v1/customers',
    auth: 'csrf',
    request: CreateCustomerRequestSchema,
    responses: { 201: CustomerResponseSchema, 400: ErrorResponseSchema },
  },
  {
    operationId: 'updateCustomer',
    module: 'customers',
    method: 'patch',
    path: '/api/v1/customers/{customerId}',
    auth: 'csrf',
    request: UpdateCustomerRequestSchema,
    responses: { 200: CustomerResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  },
  {
    operationId: 'recordInteraction',
    module: 'customers',
    method: 'post',
    path: '/api/v1/customers/{customerId}/interactions',
    auth: 'csrf',
    request: CreateInteractionRequestSchema,
    responses: { 201: InteractionResponseSchema, 404: ErrorResponseSchema },
  },
  {
    operationId: 'recordConsent',
    module: 'customers',
    method: 'post',
    path: '/api/v1/customers/{customerId}/consents',
    auth: 'csrf',
    request: RecordConsentRequestSchema,
    responses: {
      201: z.object({
        id: z.string(),
        channel: z.string(),
        decision: z.string(),
        capturedAt: z.string(),
      }),
      404: ErrorResponseSchema,
    },
  },
  {
    operationId: 'previewCustomerImport',
    module: 'customerImports',
    method: 'post',
    path: '/api/v1/customer-imports/preview',
    auth: 'csrf',
    request: CustomerImportPreviewRequestSchema,
    responses: { 200: CustomerImportPreviewResponseSchema, 400: ErrorResponseSchema },
  },
  {
    operationId: 'commitCustomerImport',
    module: 'customerImports',
    method: 'post',
    path: '/api/v1/customer-imports/{importId}/commit',
    auth: 'csrf',
    request: CustomerImportCommitRequestSchema,
    responses: { 200: CustomerImportCommitResponseSchema, 400: ErrorResponseSchema },
  },
  {
    operationId: 'getToday',
    module: 'today',
    method: 'get',
    path: '/api/v1/today',
    auth: 'session',
    responses: { 200: TodayResponseSchema, 401: ErrorResponseSchema },
  },
  {
    operationId: 'createBooking',
    module: 'bookings',
    method: 'post',
    path: '/api/v1/bookings',
    auth: 'csrf',
    request: CreateBookingRequestSchema,
    responses: { 201: BookingResponseSchema, 409: ErrorResponseSchema },
  },
  {
    operationId: 'listBookings',
    module: 'bookings',
    method: 'get',
    path: '/api/v1/bookings',
    auth: 'session',
    responses: {
      200: z.object({ items: z.array(BookingResponseSchema) }),
      401: ErrorResponseSchema,
    },
  },
  {
    operationId: 'getResults',
    module: 'results',
    method: 'get',
    path: '/api/v1/results',
    auth: 'session',
    responses: { 200: ResultsResponseSchema, 401: ErrorResponseSchema },
  },
  {
    operationId: 'openapi',
    module: 'openapi',
    method: 'get',
    path: '/api/v1/openapi.json',
    auth: 'public',
    responses: { 200: z.record(z.string(), z.unknown()) },
  },
] satisfies readonly RouteDefinition[];

export type RegisteredOperationId = (typeof routeRegistry)[number]['operationId'];
