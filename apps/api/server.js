import express from 'express';
import mongoose from 'mongoose';
import { connectDatabase, createApp } from './dist/app.js';
import { readConfig } from './dist/config.js';

const config = readConfig();
const app = express();
let connection;

app.use(async (_req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();

  connection ??= connectDatabase(config).catch((error) => {
    connection = undefined;
    throw error;
  });

  try {
    await connection;
    next();
  } catch {
    res
      .status(503)
      .json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Service unavailable.' } });
  }
});

app.use(createApp({ config }));

export default app;
