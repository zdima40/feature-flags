const { createBuilder } = require('@angular-devkit/architect');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

module.exports = createBuilder(async ({ headed, grep }, { workspaceRoot }) => {
  const directory = await mkdtemp(join(tmpdir(), 'rollout-e2e-'));
  try {
    const args = [require.resolve('@playwright/test/cli'), 'test'];
    if (headed) args.push('--headed');
    if (grep) args.push('--grep', grep);
    const child = spawn(process.execPath, args, {
      cwd: workspaceRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        ROLLOUT_E2E_DATABASE: join(directory, 'rollout.db'),
      },
    });
    const [code] = await once(child, 'close');
    return { success: code === 0 };
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 5 });
  }
});
