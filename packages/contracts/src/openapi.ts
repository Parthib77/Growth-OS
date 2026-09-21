import { z } from 'zod';
import { routeRegistry } from './routes.js';

function schemaFor(value: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(value, { target: 'openapi-3.0' });
}

export function buildOpenApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const route of routeRegistry) {
    const operation: Record<string, unknown> = {
      operationId: route.operationId,
      responses: Object.fromEntries(
        Object.entries(route.responses).map(([status, schema]) => [
          status,
          Number(status) === 204
            ? { description: 'No content' }
            : {
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
    const pathItem = paths[route.path] ?? {};
    pathItem[route.method] = operation;
    paths[route.path] = pathItem;
  }
  return {
    openapi: '3.1.0',
    info: { title: 'Growth OS API', version: '0.1.0' },
    paths,
  };
}
