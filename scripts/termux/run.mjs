import { spawn } from 'node:child_process';

process.loadEnvFile('.env');
const commands = {
  web: ['node', ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1']],
  worker: ['node', ['node_modules/tsx/dist/cli.mjs', 'worker/dm-worker.ts']],
  cron: ['sh', ['scripts/cron.sh']],
  tunnel: ['ngrok', ['http', '--url', process.env.NEXTAUTH_URL, 'http://127.0.0.1:3000']],
};
const command = commands[process.argv[2]];
if (!command) throw new Error('Expected web, worker, cron, or tunnel.');
const env = { ...process.env, CRON_BASE_URL: 'http://127.0.0.1:3000' };
const child = spawn(command[0], command[1], { stdio: 'inherit', env });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
