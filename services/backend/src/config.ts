export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/payo?replicaSet=rs0&directConnection=true',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret',
};
