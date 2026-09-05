import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { apiBase } from '../lib/backendUrl';
import type { RootState } from '../store';
import { signedOut } from '../store/authSlice';
import { shouldSignOut } from './authGuard';
import type {
  Me, Txn, PendingAction, PocketDto, RequestDto, CardDto,
  StatementMeta, BillLookup, NamedItem, PublicUser, DueBill,
  RecipientSuggestion, BillerSuggestion, RecipientDto, SavedBillerDto,
  InstitutionDto, ResolvedRecipient, ExecuteActionResult,
  GuardianState, ApprovalDto, DigestDto,
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
    const code = (result.error?.data as { code?: string } | undefined)?.code;
    if (shouldSignOut(result.error?.status, url, !!(api.getState() as RootState).auth.token, code)) {
      api.dispatch(signedOut());
    }
    return result;
  };

export const payoApi = createApi({
  reducerPath: 'payoApi',
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    'Me', 'Txns', 'Pockets', 'Requests', 'Card', 'Statements', 'DueBills', 'Recipients', 'SavedBillers',
    'Guardian', 'Approvals',
  ],
  endpoints: (b) => ({
    me: b.query<Me, void>({
      query: () => '/me',
      transformResponse: (r: Ok<Me>) => r.data,
      providesTags: ['Me'],
    }),
    requestOtp: b.mutation<{ demoOtp: string; isNewUser: boolean }, { phone: string }>({
      query: (body) => ({ url: '/auth/request-otp', method: 'POST', body }),
      transformResponse: (r: Ok<{ demoOtp: string; isNewUser: boolean }>) => r.data,
    }),
    verifyOtp: b.mutation<{ otpToken: string; isNewUser: boolean; pinSet: boolean }, { phone: string; otp: string }>({
      query: (body) => ({ url: '/auth/verify-otp', method: 'POST', body }),
      transformResponse: (r: Ok<{ otpToken: string; isNewUser: boolean; pinSet: boolean }>) => r.data,
    }),
    // set-pin / verify-pin are called while the user has no session token yet (only a
    // short-lived otp-scope token), so the otpToken is sent explicitly here rather than
    // relying on baseQueryWithAuth's prepareHeaders (which only injects the session token).
    setPin: b.mutation<{ token: string; user: PublicUser }, { pin: string; otpToken: string }>({
      query: ({ pin, otpToken }) => ({
        url: '/auth/set-pin', method: 'POST', body: { pin },
        headers: { Authorization: `Bearer ${otpToken}` },
      }),
      transformResponse: (r: Ok<{ token: string; user: PublicUser }>) => r.data,
    }),
    verifyPinWithOtp: b.mutation<{ token: string; user: PublicUser }, { pin: string; otpToken: string }>({
      query: ({ pin, otpToken }) => ({
        url: '/auth/verify-pin', method: 'POST', body: { pin },
        headers: { Authorization: `Bearer ${otpToken}` },
      }),
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
    institutions: b.query<{ items: InstitutionDto[] }, string | void>({
      query: (q) => `/institutions${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      transformResponse: (r: Ok<{ items: InstitutionDto[] }>) => r.data,
    }),
    resolveRecipient: b.mutation<ResolvedRecipient, { institutionId: string; identifier: string }>({
      query: (body) => ({ url: '/transfers/resolve', method: 'POST', body }),
      transformResponse: (r: Ok<ResolvedRecipient>) => r.data,
    }),
    recipients: b.query<{ items: RecipientDto[] }, string | void>({
      query: (q) => `/recipients${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      transformResponse: (r: Ok<{ items: RecipientDto[] }>) => r.data,
      providesTags: ['Recipients'],
    }),
    deleteRecipient: b.mutation<{ deleted: true }, string>({
      query: (id) => ({ url: `/recipients/${id}`, method: 'DELETE' }),
      transformResponse: (r: Ok<{ deleted: true }>) => r.data,
      invalidatesTags: ['Recipients'],
    }),
    createTransfer: b.mutation<
      PendingAction,
      { to: { recipientId: string } | { institutionId: string; identifier: string }; amountPaisa: number; note?: string }
    >({
      query: (body) => ({ url: '/transfers', method: 'POST', body }),
      transformResponse: (r: Ok<PendingAction>) => r.data,
    }),
    billers: b.query<{ items: NamedItem[] }, void>({
      query: () => '/billers',
      transformResponse: (r: Ok<{ items: NamedItem[] }>) => r.data,
    }),
    dueBills: b.query<{ items: DueBill[] }, void>({
      query: () => '/bills/due',
      transformResponse: (r: Ok<{ items: DueBill[] }>) => r.data,
      providesTags: ['DueBills'],
    }),
    lookupBill: b.mutation<BillLookup, { billerId: string; consumerNo: string }>({
      query: (body) => ({ url: '/bills/lookup', method: 'POST', body }),
      transformResponse: (r: Ok<BillLookup>) => r.data,
    }),
    payBill: b.mutation<PendingAction, { billId: string }>({
      query: (body) => ({ url: '/bills/pay', method: 'POST', body }),
      transformResponse: (r: Ok<PendingAction>) => r.data,
      invalidatesTags: ['DueBills'],
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
    executeAction: b.mutation<
      ExecuteActionResult,
      { id: string; pin?: string }
    >({
      query: ({ id, pin }) => ({ url: `/actions/${id}/execute`, method: 'POST', body: pin ? { pin } : {} }),
      transformResponse: (r: Ok<ExecuteActionResult>) => r.data,
      invalidatesTags: ['Me', 'Txns', 'Pockets', 'Requests', 'DueBills', 'Card'],
    }),
    cancelAction: b.mutation<{ cancelled: true }, string>({
      query: (id) => ({ url: `/actions/${id}/cancel`, method: 'POST' }),
      transformResponse: (r: Ok<{ cancelled: true }>) => r.data,
    }),
    // Save-prompt flow (V3.2): fired after a successful send/pay when the response
    // carries a recipientSuggestion/billerSuggestion the user chose to save.
    createRecipient: b.mutation<RecipientDto, { nickname: string; institutionId: string; identifier: string }>({
      query: (body) => ({ url: '/recipients', method: 'POST', body }),
      transformResponse: (r: Ok<RecipientDto>) => r.data,
      invalidatesTags: ['Recipients'],
    }),
    savedBillers: b.query<{ items: SavedBillerDto[] }, void>({
      query: () => '/saved-billers',
      transformResponse: (r: Ok<{ items: SavedBillerDto[] }>) => r.data,
      providesTags: ['SavedBillers'],
    }),
    createSavedBiller: b.mutation<SavedBillerDto, { nickname: string; billerId: string; consumerNo: string }>({
      query: (body) => ({ url: '/saved-billers', method: 'POST', body }),
      transformResponse: (r: Ok<SavedBillerDto>) => r.data,
      invalidatesTags: ['SavedBillers'],
    }),
    // ---- v6: trusted contact, scam check-in, guardian approvals, digest ----
    updateMe: b.mutation<PublicUser, { name?: string; urduName?: string; language?: 'ur' | 'en'; preferences?: { proactiveGreeting?: boolean } }>({
      query: (body) => ({ url: '/me', method: 'PATCH', body }),
      transformResponse: (r: Ok<PublicUser>) => r.data,
      invalidatesTags: ['Me'],
    }),
    guardian: b.query<GuardianState, void>({
      query: () => '/guardian',
      transformResponse: (r: Ok<GuardianState>) => r.data,
      providesTags: ['Guardian'],
    }),
    setGuardian: b.mutation<GuardianState, { phone: string; pin: string }>({
      query: (body) => ({ url: '/guardian', method: 'PUT', body }),
      transformResponse: (r: Ok<GuardianState>) => r.data,
      invalidatesTags: ['Guardian', 'Me'],
    }),
    removeGuardian: b.mutation<GuardianState, { pin: string }>({
      query: (body) => ({ url: '/guardian', method: 'DELETE', body }),
      transformResponse: (r: Ok<GuardianState>) => r.data,
      invalidatesTags: ['Guardian', 'Me'],
    }),
    updateCeiling: b.mutation<GuardianState, { ceilingPaisa: number; pin: string }>({
      query: (body) => ({ url: '/guardian/ceiling', method: 'PATCH', body }),
      transformResponse: (r: Ok<GuardianState>) => r.data,
      invalidatesTags: ['Guardian'],
    }),
    // Polled every 3 s by the waiting-approval card — deliberately untagged so a
    // mutation elsewhere can never make the poll restart from scratch.
    action: b.query<PendingAction, string>({
      query: (id) => `/actions/${id}`,
      transformResponse: (r: Ok<PendingAction>) => r.data,
    }),
    checkInAction: b.mutation<PendingAction, { id: string; someoneAsked: boolean }>({
      query: ({ id, someoneAsked }) => ({ url: `/actions/${id}/check-in`, method: 'POST', body: { someoneAsked } }),
      transformResponse: (r: Ok<PendingAction>) => r.data,
    }),
    remindGuardian: b.mutation<{ reminded: true; action: PendingAction }, string>({
      query: (id) => ({ url: `/actions/${id}/remind`, method: 'POST' }),
      transformResponse: (r: Ok<{ reminded: true; action: PendingAction }>) => r.data,
    }),
    approvals: b.query<{ items: ApprovalDto[] }, void>({
      query: () => '/approvals',
      transformResponse: (r: Ok<{ items: ApprovalDto[] }>) => r.data,
      providesTags: ['Approvals'],
    }),
    approveApproval: b.mutation<PendingAction, { id: string; pin: string }>({
      query: ({ id, pin }) => ({ url: `/approvals/${id}/approve`, method: 'POST', body: { pin } }),
      transformResponse: (r: Ok<PendingAction>) => r.data,
      invalidatesTags: ['Approvals'],
    }),
    declineApproval: b.mutation<PendingAction, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({ url: `/approvals/${id}/decline`, method: 'POST', body: reason ? { reason } : {} }),
      transformResponse: (r: Ok<PendingAction>) => r.data,
      invalidatesTags: ['Approvals'],
    }),
    // A MUTATION, not a query: `?ack=1` moves the server-side digest cursor, so it
    // must never be re-run by a cache refetch. Home calls it at most once per 4 h.
    digest: b.mutation<DigestDto, { ack?: boolean } | void>({
      query: (arg) => ({ url: `/me/digest${arg && arg.ack ? '?ack=1' : ''}`, method: 'GET' }),
      transformResponse: (r: Ok<DigestDto>) => r.data,
    }),
    deleteSavedBiller: b.mutation<{ deleted: true }, string>({
      query: (id) => ({ url: `/saved-billers/${id}`, method: 'DELETE' }),
      transformResponse: (r: Ok<{ deleted: true }>) => r.data,
      invalidatesTags: ['SavedBillers'],
    }),
  }),
});

export const {
  useMeQuery, useRequestOtpMutation, useVerifyOtpMutation, useSetPinMutation, useVerifyPinWithOtpMutation,
  useTransactionsQuery,
  useInstitutionsQuery, useResolveRecipientMutation, useCreateTransferMutation,
  useRecipientsQuery, useDeleteRecipientMutation,
  useBillersQuery, useDueBillsQuery, useLookupBillMutation, usePayBillMutation,
  useTelcosQuery, useCreateRechargeMutation,
  useRequestsQuery, useCreateRequestMutation, useApproveRequestMutation, useDeclineRequestMutation,
  usePocketsQuery, useCreatePocketMutation, usePocketMoveMutation,
  useMyQrQuery, useResolveQrMutation,
  useCardQuery, useFreezeCardMutation,
  useStatementsQuery, useGenerateStatementMutation,
  useExecuteActionMutation, useCancelActionMutation,
  useCreateRecipientMutation, useCreateSavedBillerMutation,
  useSavedBillersQuery, useDeleteSavedBillerMutation,
  useUpdateMeMutation,
  useGuardianQuery, useSetGuardianMutation, useRemoveGuardianMutation, useUpdateCeilingMutation,
  useActionQuery, useCheckInActionMutation, useRemindGuardianMutation,
  useApprovalsQuery, useApproveApprovalMutation, useDeclineApprovalMutation,
  useDigestMutation,
} = payoApi;

// Resolves the PAYO wallet institution (id + record) so callers that already know a
// user's phone (QR resolve, deep links) can skip the institution picker and go straight
// to /transfers/resolve. Institution.code is the authoritative match; name is a fallback
// for older seeds without a code field.
export function usePayoInstitution(): InstitutionDto | undefined {
  const { data } = useInstitutionsQuery('PAYO');
  return data?.items.find((i) => i.code === 'PAYO' || i.name === 'PAYO');
}

export function apiErr(e: unknown): { code: string; message: string } {
  const data = (e as { data?: { code?: string; message?: string } })?.data;
  return { code: data?.code ?? 'NETWORK', message: data?.message ?? 'Network error' };
}
