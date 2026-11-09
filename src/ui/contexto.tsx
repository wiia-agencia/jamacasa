import { createContext, useContext } from 'react';
import type { Mensaje } from '../core/chat';
import type { Gasto, Transferencia } from '../core/cuentas';
import type { Estado } from '../core/estado';
import type { DefMedalla } from '../core/juego';
import type { Intento, Tarea } from '../core/limpieza';
import type { Config, DatosGasto, Miembro, MiembroId, Zona } from '../core/tipos';
import type { Almacen } from '../datos/almacen';
import type { EstadoAvisos } from '../datos/avisos';

export type Pantalla = 'hoy' | 'limpieza' | 'cuentas' | 'juego' | 'chat';

export type Hoja =
  | { tipo: 'hecho'; tarea: Tarea }
  | { tipo: 'puntuar'; tarea: Tarea; intento: Intento }
  | { tipo: 'basura' }
  | { tipo: 'tuyo' }
  | { tipo: 'gasto' }
  | { tipo: 'detalle-gasto'; gasto: Gasto }
  | { tipo: 'saldar'; transferencia?: Transferencia; alquiler?: string }
  | { tipo: 'zona'; zona: Zona }
  | { tipo: 'tarea'; tarea: Tarea }
  | { tipo: 'medalla'; def: DefMedalla; titulo?: boolean }
  | { tipo: 'ajustes' }
  | { tipo: 'mensaje'; mensaje: Mensaje }
  | { tipo: 'sorteo' };

export interface Acciones {
  empezar(semana: number): Promise<void>;
  marcarHecho(semana: number, fotos: string[], nota?: string): Promise<void>;
  puntuar(t: Tarea, i: Intento, nota: number, faltan: string[], fotos: string[], comentario?: string): Promise<void>;
  basuraLlena(fotos: string[]): Promise<void>;
  basuraSacada(): Promise<void>;
  estoEsTuyo(para: MiembroId, fotos: string[], que?: string): Promise<void>;
  recogido(aviso: string): Promise<void>;
  gasto(d: DatosGasto): Promise<void>;
  anularGasto(id: string): Promise<void>;
  pago(de: MiembroId, a: MiembroId, importe: number, alquiler?: string, nota?: string): Promise<void>;
  anularPago(id: string): Promise<void>;
  mensaje(m: { texto?: string; fotos?: string[]; audio?: { ref: string; segundos: number } }): Promise<void>;
  fijar(mensaje: string | null): Promise<void>;
  borrarMensaje(mensaje: string): Promise<void>;
  /** «Tu espacio»: apuntar una cosa tuya (o cambiarla), quitarla y marcarla como hecha */
  espacioCosa(cosa: string, nombre: string, cada: number): Promise<void>;
  espacioQuitar(cosa: string): Promise<void>;
  espacioHecho(cosa: string): Promise<void>;
}

export interface Ctx {
  almacen: Almacen;
  config: Config;
  estado: Estado;
  yo: MiembroId;
  acciones: Acciones;
  abrir(h: Hoja): void;
  cerrar(): void;
  ir(p: Pantalla): void;
  avisar(texto: string): void;
  cambiarYo(m: MiembroId): void;
  tema: 'auto' | 'claro' | 'oscuro';
  cambiarTema(t: 'auto' | 'claro' | 'oscuro'): void;
  reiniciarPrueba(): void;
  salir(): void;
  /** Avisos al móvil en este móvil */
  avisos: EstadoAvisos;
  activarAvisos(): Promise<void>;
  probarAvisos(): Promise<void>;
}

export const Contexto = createContext<Ctx | null>(null);

export function useCasa(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error('Falta el contexto de la casa');
  return c;
}

export function miembro(config: Config, id: MiembroId): Miembro {
  return config.miembros.find((m) => m.id === id) ?? { id, nombre: id, color: 'gris' };
}

export const claseColor = (color: string) => (['naranja', 'verde', 'azul'].includes(color) ? `c-${color}` : '');
