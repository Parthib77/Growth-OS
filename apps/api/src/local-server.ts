import { createApp, connectDatabase } from './app.js';
import { readConfig } from './config.js';

const config = readConfig();
await connectDatabase(config);
createApp({ config }).listen(config.PORT, () =>
  console.log(JSON.stringify({ level: 'info', event: 'api_started', port: config.PORT })),
);
