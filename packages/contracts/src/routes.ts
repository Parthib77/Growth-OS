import { z } from 'zod';
import {
  BookingResponseSchema,
  CreateBookingRequestSchema,
  CreateCustomerRequestSchema,
  CustomerResponseSchema,
  ErrorResponseSchema,
  OnboardingRequestSchema,
  RegisterRequestSchema,
  ResultsResponseSchema,
  SignInRequestSchema,
  TodayResponseSchema,
  CsrfResponseSchema,
  WorkspaceResponseSchema,
} from './schemas.js';

export type RouteDefinition = Readonly<{
  operationId: string;
  method: 'get' | 'post' | 'patch';
  path: string;
  auth: 'public' | 'session' | 'csrf';
  request?: z.ZodType;
  responses: Readonly<Record<number, z.ZodType>>;
}>;

export const routeRegistry = [
  {
    operationId: 'healthLive',
    method: 'get',
    path: '/api/v1/health/live',
    auth: 'public',
    responses: { 200: z.object({ status: z.literal('ok') }) },
  },
  {
    operationId: 'healthReady',
    method: 'get',
    path: '/api/v1/health/ready',
    auth: 'public',
    responses: { 200: z.object({ status: z.string() }), 503: ErrorResponseSchema },
  },
  {
    operationId: 'csrf',
    method: 'get',
    path: '/api/v1/auth/csrf',
    auth: 'public',
    responses: { 200: CsrfResponseSchema },
  },
  {
    operationId: 'register',
    method: 'post',
    path: '/api/v1/auth/register',
    auth: 'csrf',
    request: RegisterRequestSchema,
    responses: {
      201: z.object({ userId: z.string(), workspaceId: z.string() }),
      400: ErrorResponseSchema,
    },
  },
  {
    operationId: 'signIn',
    method: 'post',
    path: '/api/v1/auth/sign-in',
    auth: 'csrf',
    request: SignInRequestSchema,
    responses: {
      200: z.object({ userId: z.string(), workspaceId: z.string() }),
      401: ErrorResponseSchema,
    },
  },
  {
    operationId: 'signOut',
    method: 'post',
    path: '/api/v1/auth/sign-out',
    auth: 'csrf',
    responses: { 204: z.null(), 401: ErrorResponseSchema },
  },
  {
    operationId: 'session',
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
    method: 'get',
    path: '/api/v1/workspace',
    auth: 'session',
    responses: { 200: WorkspaceResponseSchema, 401: ErrorResponseSchema },
  },
  {
    operationId: 'updateWorkspace',
    method: 'patch',
    path: '/api/v1/workspace',
    auth: 'csrf',
    request: OnboardingRequestSchema,
    responses: { 200: WorkspaceResponseSchema, 400: ErrorResponseSchema },
  },
  {
    operationId: 'listCustomers',
    method: 'get',
    path: '/api/v1/customers',
    auth: 'session',
    responses: {
      200: z.object({ items: z.array(CustomerResponseSchema), nextCursor: z.string().nullable() }),
      401: ErrorResponseSchema,
    },
  },
  {
    operationId: 'createCustomer',
    method: 'post',
    path: '/api/v1/customers',
    auth: 'csrf',
    request: CreateCustomerRequestSchema,
    responses: { 201: CustomerResponseSchema, 400: ErrorResponseSchema },
  },
  {
    operationId: 'getToday',
    method: 'get',
    path: '/api/v1/today',
    auth: 'session',
    responses: { 200: TodayResponseSchema, 401: ErrorResponseSchema },
  },
  {
    operationId: 'createBooking',
    method: 'post',
    path: '/api/v1/bookings',
    auth: 'csrf',
    request: CreateBookingRequestSchema,
    responses: { 201: BookingResponseSchema, 409: ErrorResponseSchema },
  },
  {
    operationId: 'listBookings',
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
    method: 'get',
    path: '/api/v1/results',
    auth: 'session',
    responses: { 200: ResultsResponseSchema, 401: ErrorResponseSchema },
  },
  {
    operationId: 'openapi',
    method: 'get',
    path: '/api/v1/openapi.json',
    auth: 'public',
    responses: { 200: z.record(z.string(), z.unknown()) },
  },
] satisfies readonly RouteDefinition[];

export type RegisteredOperationId = (typeof routeRegistry)[number]['operationId'];
