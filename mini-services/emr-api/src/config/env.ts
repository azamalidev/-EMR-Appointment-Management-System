// Typed environment access. Hardcoded dev defaults are acceptable.
// Note: PORT is hardcoded to 4000 per task spec — NOT read from env.

export const env = {
  port: 4000 as const,
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'emr_access_secret_dev_2024_min16chars',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'emr_refresh_secret_dev_2024_min16chars',
    accessTtl: '15m',
    refreshTtl: '7d',
  },
  bcryptCost: 12,
  cors: {
    origin: '*',
  },
  isDev: (process.env.NODE_ENV ?? 'development') !== 'production',
};

export type Env = typeof env;
