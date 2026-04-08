export const env = {
  appPassword: process.env.APP_PASSWORD ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-secret-change-me",
  dbProvider: process.env.DB_PROVIDER ?? "sqlite",
  databaseUrl: process.env.DATABASE_URL ?? "./data/personal-assistant.db",
  timezone: process.env.TIMEZONE ?? "UTC",
  openAiApiKey: process.env.OPENAI_API_KEY,
};

export function hasRequiredAuthEnv(): boolean {
  return Boolean(process.env.APP_PASSWORD && process.env.JWT_SECRET);
}
