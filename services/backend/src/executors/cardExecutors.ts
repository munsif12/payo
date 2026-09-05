import { registerExecutor } from '../lib/pendingActions';
import { Card } from '../models';
import { ApiError } from '../lib/apiError';

registerExecutor('card_unfreeze', async (session, a) => {
  const p = a.payload as { cardId: string };
  const upd = await Card.updateOne({ _id: p.cardId, userId: a.userId }, { frozen: false }, { session });
  if (upd.matchedCount === 0) throw new ApiError(404, 'NOT_FOUND', 'Card not found');
  return null;
});
