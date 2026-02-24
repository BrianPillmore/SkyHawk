import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPool, closeDb } from './index.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const pool = getPool();
  const result = await pool.query<{ name: string }>(
    'SELECT name FROM _migrations ORDER BY id',
  );
  return new Set(result.rows.map((r) => r.name));
}

async function runMigrations(): Promise<void> {
  console.log('Starting database migrations...');

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let ranCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  [skip] ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO _migrations (name) VALUES ($1)',
        [file],
      );
      await client.query('COMMIT');
      console.log(`  [done] ${file}`);
      ranCount++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  [FAIL] ${file}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  if (ranCount === 0) {
    console.log('All migrations are up to date.');
  } else {
    console.log(`Applied ${ranCount} migration(s).`);
  }
}

// Run if called directly
runMigrations()
  .then(() => {
    console.log('Migrations complete.');
    return closeDb();
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
