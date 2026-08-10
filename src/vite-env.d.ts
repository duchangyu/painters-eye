/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Clerk publishable (client-safe) key used by @clerk/clerk-react. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  /** Supabase project URL used to reach the Edge Functions. */
  readonly VITE_SUPABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
