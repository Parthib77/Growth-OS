import type { Router } from 'express';
import { routeRegistry } from '@growthos/contracts';
import type { AppConfig } from '../config.js';
import { registerAuthRoutes } from './auth.js';
import { registerBookingRoutes } from './bookings.js';
import { registerCustomerRoutes } from './customers.js';
import { registerCustomerImportRoutes } from './customer-imports.js';
import { registerCampaignRoutes } from './campaigns.js';
import { registerHealthRoutes } from './health.js';
import { registerOpenApiRoute } from './openapi.js';
import { registerResultsRoutes } from './results.js';
import { registerReviewRoutes } from './reviews.js';
import { registerTodayRoutes } from './today.js';
import { registerWorkspaceRoutes } from './workspace.js';

const registrations = {
  health: (router: Router, _config: AppConfig) => registerHealthRoutes(router),
  auth: registerAuthRoutes,
  workspace: registerWorkspaceRoutes,
  customers: registerCustomerRoutes,
  customerImports: registerCustomerImportRoutes,
  campaigns: registerCampaignRoutes,
  today: registerTodayRoutes,
  bookings: registerBookingRoutes,
  results: registerResultsRoutes,
  reviews: registerReviewRoutes,
  openapi: (router: Router, _config: AppConfig) => registerOpenApiRoute(router),
} satisfies Record<
  (typeof routeRegistry)[number]['module'],
  (router: Router, config: AppConfig) => void
>;

export function registerRoutes(router: Router, config: AppConfig): void {
  const modules = new Set(routeRegistry.map((route) => route.module));
  for (const module of modules) registrations[module](router, config);
}
