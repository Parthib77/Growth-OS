import { connectDatabase, disconnectDatabase } from '../app.js';
import { readConfig } from '../config.js';
import { DEMO_ACCOUNT, seedDemoWorkspace } from '../demo/seed.js';

if (process.env.DEMO_SEED_GUARD !== 'seed-growthos-demo')
  throw new Error('Demo seeding is disabled. Set DEMO_SEED_GUARD=seed-growthos-demo to run it.');

const config = readConfig();
await connectDatabase(config);
try {
  const result = await seedDemoWorkspace({
    email: process.env.GROWTHOS_DEMO_EMAIL,
    password: process.env.GROWTHOS_DEMO_PASSWORD,
  });
  process.stdout.write(
    `${JSON.stringify({
      event: 'demo_seed_finished',
      ...result,
      password: process.env.GROWTHOS_DEMO_PASSWORD ? '(from environment)' : DEMO_ACCOUNT.password,
    })}\n`,
  );
} finally {
  await disconnectDatabase();
}
