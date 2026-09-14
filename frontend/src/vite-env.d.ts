/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Add crypto to global for randomUUID
declare global {
  interface Window {
    crypto: Crypto;
  }
}