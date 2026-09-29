import { spawn } from 'node:child_process';
import electronPath from 'electron';

process.env.NODE_ENV = 'production';

const p = spawn(electronPath, ['.'], {
  detached: true,
  stdio: 'ignore',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

p.unref();
process.exit(0);
