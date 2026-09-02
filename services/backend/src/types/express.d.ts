declare namespace Express { interface Request { userId: string; tokenScope?: 'otp' | 'session' } }
