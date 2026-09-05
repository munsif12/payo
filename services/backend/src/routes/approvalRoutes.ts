import { Router } from 'express';
import { handler } from '../lib/handler';
import { listApprovals, approveAction, declineAction } from '../controllers/approvalsController';

export const approvalRoutes = Router();
approvalRoutes.get('/', handler(listApprovals));
approvalRoutes.post('/:id/approve', handler(approveAction));
approvalRoutes.post('/:id/decline', handler(declineAction));
