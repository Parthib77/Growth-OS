import type { Router } from 'express';
import { buildOpenApi } from '@growthos/contracts';

export function registerOpenApiRoute(router: Router): void {
  router.get('/openapi.json', (_req, res) => res.json(buildOpenApi()));
}
