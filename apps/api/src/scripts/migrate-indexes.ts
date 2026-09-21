import { connectDatabase, disconnectDatabase } from '../app.js';
import { ensureIndexes, verifyIndexes } from '../models.js';
import { readConfig } from '../config.js';

const config = readConfig();
try {
  await connectDatabase(config);
  await ensureIndexes();
  await verifyIndexes();
  process.stdout.write(JSON.stringify({ status: 'indexes-ready' }) + '\n');
} finally {
  await disconnectDatabase();
}
