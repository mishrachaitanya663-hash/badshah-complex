import { initDb, testDbConnection, getDbKind, closeCurrentDb } from '../src/db/index.js';

async function main() {
  try {
    await initDb();
    const ok = await testDbConnection();
    console.log(`[db-test] driver=${getDbKind()} connected=${ok}`);
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.error('[db-test] failed:', error?.message || error);
    process.exitCode = 1;
  } finally {
    await closeCurrentDb().catch(() => {});
  }
}

main();
