/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare const __APP_VERSION__: string
/** True only in the Playwright e2e build (VITE_E2E_MOCK=1); a literal, so dead code is dropped. */
declare const __E2E_MOCK__: boolean
