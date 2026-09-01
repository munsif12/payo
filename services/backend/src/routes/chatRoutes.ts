import { Router } from 'express';
import { handler } from '../lib/handler';
import { createSession, listSessions, listMessages, createMessage } from '../controllers/chatController';

export const chatRoutes = Router();
chatRoutes.get('/sessions', handler(listSessions));
chatRoutes.post('/sessions', handler(createSession));
chatRoutes.get('/sessions/:id/messages', handler(listMessages));
chatRoutes.post('/sessions/:id/messages', handler(createMessage));
