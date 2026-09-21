import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Server } from 'node:http';
import { createApp, connectDatabase, disconnectDatabase } from '../app.js';
import { readConfig } from '../config.js';

const allowMongoDownload = process.env.GROWTHOS_ALLOW_MONGODB_DOWNLOAD === '1';
if (!allowMongoDownload) process.env.MONGOMS_RUNTIME_DOWNLOAD = '0';
process.env.MONGOMS_VERSION ??= '8.0.6';

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const config = readConfig({
  ...process.env,
  NODE_ENV: 'test',
  PORT: '4000',
  WEB_ORIGIN: 'http://127.0.0.1:3000',
  MONGODB_URI: replSet.getUri(),
  SESSION_SECRET: process.env.GROWTHOS_E2E_SESSION_SECRET ?? 'a'.repeat(32),
  COOKIE_SECURE: 'false',
});
await connectDatabase(config);
const server = createApp({ config }).listen(config.PORT, '127.0.0.1');
let shuttingDown = false;

async function closeServer(value: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    value.close((error) => (error ? reject(error) : resolve()));
  });
}

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await closeServer(server);
  await disconnectDatabase();
  await replSet.stop();
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
