import { createApp } from './app.js';
import { config } from './config.js';
import { initDb, getDbKind, testDbConnection, closeCurrentDb } from './db/index.js';

async function start() {
  try {
    await initDb();
    const ok = await testDbConnection();
    if (!ok) throw new Error('Database connection test failed');
    console.log(`[db] Connected (${getDbKind()})`);

    const app = await createApp();
    const server = app.listen(config.port, () => {
      console.log(`Badshah customer API running at http://localhost:${config.port}`);
    });

    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}, shutting down...`);
      server.close(async () => {
        try { await closeCurrentDb(); } catch { /* ignore */ }
        process.exit(0);
      });
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start server:', error?.message || error);
    try { await closeCurrentDb(); } catch { /* ignore */ }
    process.exit(1);
  }
}

start();
