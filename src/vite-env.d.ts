/// <reference types="vite/client" />

declare const __OFFLINE_SINGLE_FILE__: boolean;

declare module '*?url' {
  const src: string;
  export default src;
}
