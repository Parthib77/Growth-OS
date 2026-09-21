import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('.next/routes-manifest.json', 'utf8'));
const rewrite = manifest.rewrites?.afterFiles?.find((entry) => entry.source === '/api/:path*');
if (rewrite?.destination !== 'http://api:4000/api/:path*') {
  throw new Error(
    `Expected Docker rewrite to target api:4000, got ${rewrite?.destination ?? 'missing'}`,
  );
}
console.log('Docker rewrite manifest targets api:4000.');
