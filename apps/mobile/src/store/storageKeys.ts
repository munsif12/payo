// AsyncStorage keys, kept in their own module so a consumer that only needs a
// key name (src/i18n) doesn't have to import the whole auth slice — and, with
// it, the AsyncStorage native module — at load time.

/** The persisted `{ token, user }` session blob. */
export const AUTH_STORAGE_KEY = 'payo.auth';

/** On-device phone→name cache used only for the Enter PIN greeting. */
export const NAME_CACHE_STORAGE_KEY = 'payo.nameCache';
