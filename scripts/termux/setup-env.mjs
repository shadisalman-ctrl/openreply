import { appendFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

process.loadEnvFile('.env');
const required = ['NEXTAUTH_URL', 'NGROK_AUTHTOKEN', 'EMAIL_SERVER', 'EMAIL_FROM', 'ALLOWED_EMAILS'];
for (const name of required) {
  if (!process.env[name] || /YOUR_|replace-with/.test(process.env[name])) {
    throw new Error(`Fill ${name} in .env before installing.`);
  }
}
const origin = new URL(process.env.NEXTAUTH_URL);
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('NEXTAUTH_URL must be an HTTPS origin, without a path or query.');
}
const generated = {
  NEXTAUTH_SECRET: () => randomBytes(32).toString('base64'),
  CRON_SECRET: () => randomBytes(32).toString('base64'),
  ENCRYPTION_KEY: () => randomBytes(32).toString('hex'),
  WEBHOOK_VERIFY_TOKEN: () => randomBytes(32).toString('hex'),
  DATABASE_URL: () => `postgresql://openreply:${randomBytes(24).toString('hex')}@127.0.0.1:5432/openreply`,
};
for (const [name, make] of Object.entries(generated)) {
  if (!process.env[name]) {
    const value = make();
    // Last assignment wins in Node's dotenv parser. Existing values are never rotated.
    appendFileSync('.env', `\n${name}=${value}\n`);
    process.env[name] = value;
  }
}
chmodSync('.env', 0o600);
if (!/^[a-fA-F0-9]{64}$/.test(process.env.ENCRYPTION_KEY)) {
  throw new Error('ENCRYPTION_KEY must contain exactly 64 hexadecimal characters.');
}
const db = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(db.hostname) || db.port && db.port !== '5432' ||
    decodeURIComponent(db.username) !== 'openreply' || db.pathname !== '/openreply') {
  throw new Error('This installer manages only the local openreply database/user on port 5432.');
}
if (!decodeURIComponent(db.password)) throw new Error('DATABASE_URL needs a password.');
if (process.argv.includes('--validate')) process.exit(0);
const password = decodeURIComponent(db.password).replaceAll("'", "''");
const sql = `SELECT 'CREATE ROLE openreply LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'openreply')\n\\gexec\nALTER ROLE openreply PASSWORD '${password}';\nSELECT 'CREATE DATABASE openreply OWNER openreply' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'openreply')\n\\gexec\n`;
const result = spawnSync('su', ['-', 'postgres', '-c', 'psql -v ON_ERROR_STOP=1'], {
  input: sql, encoding: 'utf8',
});
// Do not print SQL or PostgreSQL errors that could contain credentials.
if (result.error || result.status !== 0) throw new Error('Local database provisioning failed. Check PostgreSQL is running.');
console.log('Environment validated; local database ready.');
