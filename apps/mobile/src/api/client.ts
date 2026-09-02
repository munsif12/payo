import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { apiBase } from '../lib/backendUrl';
import type { RootState } from '../store';
import { signedOut } from '../store/authSlice';
import { shouldSignOut } from './authGuard';
import type {
  Me, Txn, PendingAction, ContactDto, PocketDto, RequestDto, CardDto,
  StatementMeta, BillLookup, NamedItem, PublicUser,
} from './types';

interface Ok<T> { success: true; data: T }

const rawBaseQuery = fetchBaseQuery({
  baseUrl: apiBase(),
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

/** Any 401 on an authenticated call means the stored session is dead (expired, or the
 *  user no longer exists after a reseed) — sign out so the app returns to login instead
 *  of behaving like an empty ghost account. Auth endpoints are exempt (wrong PIN is 401). */
export const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> =
  async (args, api, extra) => {
    const result = await rawBaseQuery(args, api, extra);
    const url = typeof args === 'string' ? args : args.url;
    if (shouldSignOut(result.error?.status, url, !!(api.getState() as RootState).auth.token)) {
      api.dispatch(signedOut());
    }
    return result;
  };

export const payoApi = createApi({
  reducerPath: 'payoApi',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Me', 'Txns', 'Contacts', 'Pockets', 'Requests', 'Card', 'Statements'],
  endpoints: (b) => ({
    me: b.query<Me, void>({
      query: () => '/me',
      transformResponse: (r: Ok<Me>) => r.data,
      providesTags: ['Me'],
    }),
    login: b.mutation<{ token: string; user: PublicUser }, { email: string; pin: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: (r: Ok<{ token: string; user: PublicUser }>) => r.data,
    }),
    signup: b.mutation<{ userId: string; demoOtp: string }, { name: string; urduName?: string; email: string; phone: string; pin: string }>({
      query: (body) => ({ url: '/auth/signup', method: 'POST', body }),
      transformResponse: (r: Ok<{ userId: string; demoOtp: string }>) => r.data,
    }),
    verifyOtp: b.mutation<{ token: string; user: PublicUser }, { userId: string; otp: string }>({
      query: (body) => ({ url: '/auth/verify-otp', method: 'POST', body }),
      transformResponse: (r: Ok<{ token: string; user: PublicUser }>) => r.data,
    }),
    transactions: b.query<{ items: Txn[]; nextCursor: string | null }, { cursor?: string; type?: string; category?: string }>({
      query: (q) => {
        const p = new URLSearchParams();
        if (q.cursor) p.set('cursor', q.cursor);
        if (q.type) p.set('type', q.type);
        if (q.category) p.set('category', q.category);
        return `/transactions?${p}`;
      },
      transformResponse: (r: Ok<{ items: Txn[]; nextCursor: string | null }>) => r.data,
      // one cache entry per filter combo; pages merged in
      serializeQueryArgs: ({ queryArgs }) => JSON.stringify({ t: queryArgs.type, c: queryArgs.category }),
      merge: (cur, incoming, { arg }) => {
        if (!arg.cursor) return incoming;
        const seen = new Set(cur.items.map(i => i.id));
        cur.items.push(...incoming.items.filter(i => !seen.has(i.id)));
        cur.nextCursor = incoming.nextCursor;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.cursor !== previousArg?.cursor,
      providesTags: ['Txns'],
    }),
    contacts: b.query<{ items: ContactDto[] }, void>({
      query: () => '/contacts',
      transformResponse: (r: Ok<{ items: ContactDto[] }>) => r.data,
      providesTags: ['Contacts'],
    }),
    createContact: b.mutation<ContactDto, Record<string, unknown>>({
      query: (body) => ({ url: '/contacts', method: 'POST', body }),
      transformResponse: (r: Ok<ContactDto>) => r.data,
      invalidatesTags: ['Contacts'],
    }),
    banks: b.query<{ items: NamedItem[] }, void>({
      query: () => '/banks',
      transformResponse: (r: Ok<{ items: NamedItem[] }>) => r.data,
    }),
    resolveTitle: b.mutation<{ accountTitle: string }, { bankId: string; iban: string }>({
      query: (body) => ({ url: '/banks/resolve-title', method: 'POST', body }),
      transformResponse: (r: Ok<{ accountTitle: string }>) => r.data,
    }),
    createTransfer: b.mutation<PendingAction, { to: Record<string, unknown>; amountPaisa: number; note?: string }>({
      query: (body) => ({ url: '/transfers', method: 'POST', body }),
      transformResponse: (r: Ok<PendingAction>) => r.data,
    }),
    billers: b.query<{ items: NamedItem[] }, void>({
      query: () => '/billers',
      transformResponse: (r: Ok<{ items: NamedItem[] }>) => r.data,
    }),
    lookupBill: b.mutation<BillLookup, { billerId: string; consumerNo: string }>({
      query: (body) => ({ url: '/bills/lookup', method: 'POST', body }),
      transformResponse: (r: Ok<BillLookup>) => r.data,
    }),
    payBill: b.mutation<PendingAction, { billId: string }>({
      query: (body) => ({ url: '/bills/pay', method: 'POST', body }),
      transformResponse: (r: Ok<PendingAction>) => r.data,
    }),
    telcos: b.query<{ items: NamedItem[] }, void>({
      query: () => '/telcos',
      transformResponse: (r: Ok<{ items: NamedItem[] }>) => r.data,
    }),
    createRecharge: b.mutation<PendingAction, { telcoId: string; phone: string; amountPaisa: number }>({
      query: (body) => ({ url: '/recharges', method: 'POST', body }),
      transformResponse: (r: Ok<PendingAction>) => r.data,
    }),
    requests: b.query<{ items: RequestDto[] }, void>({
      query: () => '/requests',
      transformResponse: (r: Ok<{ items: RequestDto[] }>) => r.data,
      providesTags: ['Requests'],
    }),
    createRequest: b.mutation<{ request: RequestDto }, { fromPhone: string; amountPaisa: number; note?: string }>({
      query: (body) => ({ url: '/requests', method: 'POST', body }),
      transformResponse: (r: Ok<{ request: RequestDto }>) => r.data,
      invalidatesTags: ['Requests'],
    }),
    approveRequest: b.mutation<PendingAction, string>({
      query: (id) => ({ url: `/requests/${id}/approve`, method: 'POST' }),
      transformResponse: (r: Ok<PendingAction>) => r.data,
      invalidatesTags: ['Requests'],
    }),
    declineRequest: b.mutation<{ declined: true }, string>({
      query: (id) => ({ url: `/requests/${id}/decline`, method: 'POST' }),
      transformResponse: (r: Ok<{ declined: true }>) => r.data,
      invalidatesTags: ['Requests'],
    }),
    pockets: b.query<{ items: PocketDto[] }, void>({
      query: () => '/pockets',
      transformResponse: (r: Ok<{ items: PocketDto[] }>) => r.data,
      providesTags: ['Pockets'],
    }),
    createPocket: b.mutation<PocketDto, { name: string; urduName?: string; emoji: string; goalPaisa?: number }>({
      query: (body) => ({ url: '/pockets', method: 'POST', body }),
      transformResponse: (r: Ok<PocketDto>) => r.data,
      invalidatesTags: ['Pockets'],
    }),
    pocketMove: b.mutation<PendingAction, { id: string; op: 'deposit' | 'withdraw'; amountPaisa: number }>({
      query: ({ id, op, amountPaisa }) => ({ url: `/pockets/${id}/${op}`, method: 'POST', body: { amountPaisa } }),
      transformResponse: (r: Ok<PendingAction>) => r.data,
    }),
    myQr: b.query<{ payload: string }, void>({
      query: () => '/qr/mine',
      transformResponse: (r: Ok<{ payload: string }>) => r.data,
    }),
    resolveQr: b.mutation<{ user: { name: string; urduName?: string; phone: string; avatar?: string } }, { payload: string }>({
      query: (body) => ({ url: '/qr/resolve', method: 'POST', body }),
      transformResponse: (r: Ok<{ user: { name: string; urduName?: string; phone: string; avatar?: string } }>) => r.data,
    }),
    card: b.query<CardDto, void>({
      query: () => '/cards/mine',
      transformResponse: (r: Ok<CardDto>) => r.data,
      providesTags: ['Card'],
    }),
    freezeCard: b.mutation<CardDto, { frozen: boolean }>({
      query: (body) => ({ url: '/cards/mine/freeze', method: 'POST', body }),
      transformResponse: (r: Ok<CardDto>) => r.data,
      invalidatesTags: ['Card'],
    }),
    statements: b.query<{ items: StatementMeta[] }, void>({
      query: () => '/statements',
      transformResponse: (r: Ok<{ items: StatementMeta[] }>) => r.data,
      providesTags: ['Statements'],
    }),
    generateStatement: b.mutation<{ statementId: string; summary: Record<string, unknown> }, { year: number; month?: number }>({
      query: (body) => ({ url: '/statements', method: 'POST', body }),
      transformResponse: (r: Ok<{ statementId: string; summary: Record<string, unknown> }>) => r.data,
      invalidatesTags: ['Statements'],
    }),
    executeAction: b.mutation<{ transaction: Txn }, { id: string; pin?: string }>({
      query: ({ id, pin }) => ({ url: `/actions/${id}/execute`, method: 'POST', body: pin ? { pin } : {} }),
      transformResponse: (r: Ok<{ transaction: Txn }>) => r.data,
      invalidatesTags: ['Me', 'Txns', 'Pockets', 'Requests'],
    }),
    cancelAction: b.mutation<{ cancelled: true }, string>({
      query: (id) => ({ url: `/actions/${id}/cancel`, method: 'POST' }),
      transformResponse: (r: Ok<{ cancelled: true }>) => r.data,
    }),
  }),
});

export const {
  useMeQuery, useLoginMutation, useSignupMutation, useVerifyOtpMutation,
  useTransactionsQuery, useContactsQuery, useCreateContactMutation,
  useBanksQuery, useResolveTitleMutation, useCreateTransferMutation,
  useBillersQuery, useLookupBillMutation, usePayBillMutation,
  useTelcosQuery, useCreateRechargeMutation,
  useRequestsQuery, useCreateRequestMutation, useApproveRequestMutation, useDeclineRequestMutation,
  usePocketsQuery, useCreatePocketMutation, usePocketMoveMutation,
  useMyQrQuery, useResolveQrMutation,
  useCardQuery, useFreezeCardMutation,
  useStatementsQuery, useGenerateStatementMutation,
  useExecuteActionMutation, useCancelActionMutation,
} = payoApi;

export function apiErr(e: unknown): { code: string; message: string } {
  const data = (e as { data?: { code?: string; message?: string } })?.data;
  return { code: data?.code ?? 'NETWORK', message: data?.message ?? 'Network error' };
}
