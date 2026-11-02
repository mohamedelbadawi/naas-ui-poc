import 'dotenv/config';

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

const DEFAULT_STABILITY_WINDOW_MS = 4_000;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export function getBaseUrl(): string {
  return requireEnv('BASE_URL');
}


export function getTestUser(): Credentials {
  return { email: requireEnv('TEST_USER_EMAIL'), password: requireEnv('TEST_USER_PASSWORD') };
}


export function getStabilityWindowMs(): number {
  const raw = process.env.FLUTTER_STABILITY_WINDOW_MS?.trim();
  if (!raw) {
    return DEFAULT_STABILITY_WINDOW_MS;
  }

  const milliseconds = Number(raw);
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new Error(`FLUTTER_STABILITY_WINDOW_MS must be a positive number of milliseconds, got "${raw}".`);
  }
  return milliseconds;
}
