// Las caras de los muñecos (el dibujo de cada uno que saca la casa en 3D: `retratos()` del visor). Se guardan en este
// móvil para poder enseñarlas fuera de Limpieza (en Hoy, en el cuadro…) sin cargar la casa en 3D.
import { guardar, leer } from '../datos/guardado';

const CLAVE = 'jamacasa-caras';
let memoria: Record<string, string> = {};

export function guardarCaras(caras: Record<string, string>): void {
  if (!caras || !Object.keys(caras).length) return;
  memoria = caras;
  guardar(CLAVE, JSON.stringify(caras));
}

export function carasDe(): Record<string, string> {
  if (Object.keys(memoria).length) return memoria;
  try {
    const c = JSON.parse(leer(CLAVE) ?? '{}');
    if (c && typeof c === 'object') memoria = c;
  } catch {
    /* nada guardado */
  }
  return memoria;
}
