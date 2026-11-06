import type { Config, Zona } from '../core/tipos';

// Datos de ejemplo que van en el código público: estructura de la casa, sin
// importes ni datos reales. La casa de verdad vive en la base de datos.

export const ZONAS: Zona[] = [
  {
    id: 'abajo',
    nombre: 'Piso de abajo',
    incluye: 'Cocina grande, baño y escaleras',
    checklist: ['Suelo barrido y fregado', 'Encimera, fuegos y fregadero', 'Frentes de los muebles', 'Mesa del comedor', 'Baño: váter, lavabo, ducha y espejo', 'Escaleras'],
  },
  {
    id: 'medio',
    nombre: 'Piso del medio',
    incluye: 'Entrada, salón, terraza y escalera',
    checklist: ['Suelo barrido y fregado', 'Entrada y felpudo', 'Salón ordenado y sin polvo', 'Terraza barrida', 'Escalera'],
  },
  {
    id: 'arriba',
    nombre: 'Piso de arriba',
    incluye: 'Salón, entradilla y cocina',
    checklist: ['Suelo barrido y fregado', 'Encimera, fuegos, fregadero y microondas', 'Frentes de los muebles', 'Salón: polvo, mesa y sofá', 'Entradilla y escaleras'],
  },
];

export function configEjemplo(inicio: string, desde: string): Config {
  return {
    nombre: 'La Jamacasa',
    inicio,
    semilla: 11,
    miembros: [
      { id: 'ana', nombre: 'Ana', color: 'naranja', figura: 'pino' },
      { id: 'bruno', nombre: 'Bruno', color: 'verde', figura: 'escala' },
      { id: 'carla', nombre: 'Carla', color: 'azul', figura: 'mortal' },
    ],
    zonas: ZONAS,
    alquiler: { total: 120000, paga: 'bruno', partes: { ana: 40000, bruno: 40000, carla: 40000 }, dia: 10, desde },
    facturas: [
      { id: 'luz', nombre: 'Luz', paga: 'carla' },
      { id: 'agua', nombre: 'Agua', paga: 'bruno' },
      { id: 'internet', nombre: 'Internet', paga: 'bruno' },
      { id: 'gasoleo', nombre: 'Gasóleo', paga: null },
      { id: 'suscripciones', nombre: 'Suscripciones', paga: 'ana' },
    ],
  };
}

export const FOTOS_EJEMPLO: Record<string, string> = {};
