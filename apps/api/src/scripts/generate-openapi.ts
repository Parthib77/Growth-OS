import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { buildOpenApi } from '@growthos/contracts';
const output = fileURLToPath(new URL('../../../../docs/openapi.json', import.meta.url));
const source = JSON.stringify(buildOpenApi());
await writeFile(output, await prettier.format(source, { parser: 'json', printWidth: 100 }));
