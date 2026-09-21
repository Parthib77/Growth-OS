import { z } from 'zod';
import { routeRegistry } from './routes.js';

function schemaFor(value: z.ZodType): Record<string, unknown> {
  const description = value.description;
  return description ? { type: 'object', description } : { type: 'object' };
}

export function buildOpenApi(): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  for (const route of routeRegistry) {
    const operation: Record<string, unknown> = {
      operationId: route.operationId,
      responses: Object.fromEntries(
        Object.entries(route.responses).map(([status, schema]) => [
          status,
          {
            description: 'Response',
            content: { 'application/json': { schema: schemaFor(schema) } },
          },
        ]),
      ),
    };
    if (route.request)
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: schemaFor(route.request) } },
      };
    paths[route.path] = {
      ...(paths[route.path] as Record<string, unknown> | undefined),
      [route.method]: operation,
    };
  }
  return { openapi: '3.1.0', info: { title: 'Growth OS API', version: '0.1.0' }, paths };
}
