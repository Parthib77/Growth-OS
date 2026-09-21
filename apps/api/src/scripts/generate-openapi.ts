import { writeFile } from 'node:fs/promises';
import { buildOpenApi } from '@growthos/contracts';
await writeFile('docs/openapi.json', `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
