import { Router } from 'express';
import { handler } from '../lib/handler';
import { createRequest, listRequests, approveRequest, declineRequest } from '../controllers/requestsController';

export const requestRoutes = Router();
requestRoutes.get('/', handler(listRequests));
requestRoutes.post('/', handler(createRequest));
requestRoutes.post('/:id/approve', handler(approveRequest));
requestRoutes.post('/:id/decline', handler(declineRequest));
