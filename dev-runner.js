import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electronPath from 'electron';

async function start() {
  // 1. Start Vite dev server programmatically (blazing fast, single Node process)
  const server = await createServer();
  await server.listen();

  const address = server.httpServer?.address();
  const port = (address && typeof address === 'object') ? address.port : 5173;
  const devUrl = `http://localhost:${port}`;
  console.log(`[PodSync Dev] Vite server ready at ${devUrl}`);

  // 2. Launch Electron directly once server is listening
  const electronProcess = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: devUrl
    }
  });

  electronProcess.on('close', async () => {
    try {
      await server.close();
    } catch (_) {}
    process.exit(0);
  });

  electronProcess.on('error', (err) => {
    console.error('[PodSync Dev] Electron error:', err);
    process.exit(1);
  });
}

start().catch((err) => {
  console.error('[PodSync Dev] Failed to start dev environment:', err);
  process.exit(1);
});
