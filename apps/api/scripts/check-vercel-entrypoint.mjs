import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = ['server.js', 'server.ts', 'src/server.js', 'src/server.ts'];
const found = candidates.filter((path) => existsSync(join(root, path)));
const entrypoint = join(root, 'server.js');

if (found.length !== 1 || found[0] !== 'server.js') {
  throw new Error(`Expected only server.js as the Vercel entrypoint; found ${found.join(', ')}`);
}

if (!readFileSync(entrypoint, 'utf8').includes("import express from 'express'")) {
  throw new Error('Vercel entrypoint must import Express directly.');
}

console.log(`Vercel API entrypoint: ${found[0]}`);
