export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27018/payo?replicaSet=rs0&directConnection=true',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret',
  /**
   * Cooling-off delay for LOOSENING a guardian rule (removing the guardian, raising the
   * ceiling). Read on every access rather than captured at import time so a test — and the
   * demo — can flip it per request. 24 h in production, 0 in the demo (`.env.example`).
   */
  get guardianCoolingMs(): number {
    const raw = Number(process.env.GUARDIAN_COOLING_MS);
    return Number.isFinite(raw) && process.env.GUARDIAN_COOLING_MS !== undefined && process.env.GUARDIAN_COOLING_MS !== ''
      ? raw
      : 86_400_000;
  },
};
