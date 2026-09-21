import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildOpenApi } from '@growthos/contracts';

const expected = JSON.stringify(buildOpenApi());
const output = fileURLToPath(new URL('../../../../docs/openapi.json', import.meta.url));
const actual = await readFile(output, 'utf8');
if (JSON.stringify(JSON.parse(actual)) !== expected) {
  process.stderr.write('docs/openapi.json is out of date; run npm run generate:openapi\n');
  process.exitCode = 1;
} else {
  process.stdout.write('OpenAPI is up to date.\n');
}
