/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  // '1' en la versión publicada para el teléfono (sin el servidor del PC)
  readonly VITE_STANDALONE?: string;
}
