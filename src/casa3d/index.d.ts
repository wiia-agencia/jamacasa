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
}
export function crearVisor(contenedor: HTMLElement, opciones: Record<string, unknown>): Visor;
export function configurarPersonas(lista: { id: string; nombre: string; color: string; aspecto?: import('../core/tipos').Aspecto }[]): void;
export const ESTILOS: Record<string, { nombre: string; letra: string }>;
