/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Context.dev Logo Link public client id; without it every logo is a monogram. */
  readonly VITE_CONTEXT_DEV_PUBLIC_CLIENT_ID?: string;
  /** The API's origin, no path. A build without it talks to the local API. */
  readonly VITE_API_URL?: string;
}
