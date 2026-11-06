// Sustituto público de los datos privados (la carpeta privado/ no se sube a GitHub).
import type { Config } from '../core/tipos';
export const configPrivada: ((inicio: string, desde: string) => Config) | undefined = undefined;
export const FOTOS_PRIVADAS: Record<string, string> = {};
