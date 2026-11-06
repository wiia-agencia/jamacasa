/// <reference types="vite/client" />
declare const __VISTA__: boolean;
declare module 'canvas-confetti';
declare module 'datos-privados' {
  import type { Config } from './core/tipos';
  export const configPrivada: ((inicio: string, desde: string) => Config) | undefined;
  export const FOTOS_PRIVADAS: Record<string, string>;
}
