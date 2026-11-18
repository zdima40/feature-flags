import { defineConfig, devices } from '@playwright/test';

const database = process.env['ROLLOUT_E2E_DATABASE'];
if (!database) {
  throw new Error('Run npm run e2e to provision a temporary SQLite database.');
}

const ui = 'http://127.0.0.1:4210';
const api = 'http://127.0.0.1:5165';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env['CI'],
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: ui,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'API',
      command: `dotnet run --project ../backend/Rollout.Api --configuration Release --no-launch-profile --no-restore --urls ${api}`,
      url: `${api}/api/flags`,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        DOTNET_ENVIRONMENT: 'Development',
        ConnectionStrings__Rollout: `Data Source=${database}`,
      },
    },
    {
      name: 'Angular',
      command:
        'npm start -- --host 127.0.0.1 --port 4210 --proxy-config e2e/proxy.conf.json',
      url: ui,
    },
  ],
});
