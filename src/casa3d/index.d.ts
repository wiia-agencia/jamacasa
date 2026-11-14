// Tipos de lo que usa la app de la casa en 3D (el dibujo está en JavaScript).
export interface Visor {
  setEscena(escena: unknown): void;
  setVerComo(id: string): void;
  setEstilo(id: string): void;
  visitar(nivel: number | null): void;
  girar(delta: number): void;
  acercar(factor: number): void;
  centrar(): void;
  pausar(): void;
  seguir(): void;
  destruir(): void;
  // pantalla de juego (Limpieza)
  setFoco(nivel: number | null): void;
  setCerca(cerca: boolean): void;
  setParte(parte: { cuartos: string[]; dias: Record<string, number | null>; brillo: Record<string, number>; foco?: string | null } | null): void;
  setBurbujas(lista: { id: string; titulo: string; sub?: string; tono: string; alTocar?: () => void }[]): void;
  setLuz(luz: import('../core/luz').Luz | null): void;
  setMargenes(m: { arriba?: number; abajo?: number }): void;
  cielo(): string;
  nivelDe(id: string): number | null;
  retratos(tam?: number): Record<string, string>;
}
export function crearVisor(contenedor: HTMLElement, opciones: Record<string, unknown>): Visor;
export function configurarPersonas(lista: { id: string; nombre: string; color: string; aspecto?: import('../core/tipos').Aspecto }[]): void;
export const ESTILOS: Record<string, { nombre: string; letra: string }>;
