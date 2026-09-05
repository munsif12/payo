import { Router } from 'express';
import { handler } from '../lib/handler';
import { getGuardian, setGuardian, removeGuardian, updateCeiling } from '../controllers/guardianController';

export const guardianRoutes = Router();
guardianRoutes.get('/', handler(getGuardian));
guardianRoutes.put('/', handler(setGuardian));
guardianRoutes.delete('/', handler(removeGuardian));
guardianRoutes.patch('/ceiling', handler(updateCeiling));
