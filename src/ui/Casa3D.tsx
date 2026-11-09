import { useEffect, useRef, useState } from 'react';
import type { EscenaCasa } from '../core/escena';
import type { Miembro, MiembroId } from '../core/tipos';
import '../casa3d/visor.css';

// La casa en 3D de Limpieza. three.js va en un archivo aparte que solo se baja al abrir esta pantalla,
// y la casa se construye una sola vez: al cambiar de pantalla se aparca y al volver se vuelve a enganchar.

type Modulo = typeof import('../casa3d/index.js');
type Visor = ReturnType<Modulo['crearVisor']>;

/** Estilo de la casa: la A2 (la A con menos gris) mientras Javi no elija otra. */
export const ESTILO_CASA = 'juguete_vivo'; // la A3, «Casita viva»: la que eligió Javi el 9 de noviembre

const COLORES: Record<string, string> = { naranja: '#d96a14', verde: '#1a9150', azul: '#2569db' };

let modulo: Promise<Modulo> | null = null;
let unico: { marco: HTMLDivElement; visor: Visor; clave: string } | null = null;

function hayWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Casa3D({ miembros, escena, yo }: { miembros: Miembro[]; escena: EscenaCasa; yo: MiembroId }) {
  const host = useRef<HTMLDivElement>(null);
  const [listo, setListo] = useState(Boolean(unico));
  const [fallo, setFallo] = useState(false);
  const ultima = useRef(escena);
  ultima.current = escena;

  useEffect(() => {
    if (!hayWebGL()) { setFallo(true); return; }
    let vivo = true;
    (modulo ??= import('../casa3d/index.js'))
      .then((m) => {
        if (!vivo || !host.current) return;
        const clave = `${ESTILO_CASA}|${miembros.map((x) => `${x.id}:${x.nombre}:${x.color}:${JSON.stringify(x.aspecto ?? {})}`).join('|')}`;
        if (!unico || unico.clave !== clave) {
          if (unico) { unico.visor.destruir(); unico.marco.remove(); unico = null; }
          m.configurarPersonas(miembros.map((x) => ({ id: x.id, nombre: x.nombre, color: COLORES[x.color] ?? x.color, aspecto: x.aspecto })));
          const marco = document.createElement('div');
          marco.className = 'c3-visor casa3d-marco';
          host.current.appendChild(marco);
          const visor = m.crearVisor(marco, { estilo: ESTILO_CASA, verComo: yo, escena: ultima.current, vista: 'foco' });
          unico = { marco, visor, clave };
        } else {
          host.current.appendChild(unico.marco);
          unico.visor.setVerComo(yo);
          unico.visor.setEscena(ultima.current);
          unico.visor.seguir();
        }
        setListo(true);
      })
      .catch(() => {
        if (unico) { unico.marco.remove(); unico = null; }
        setFallo(true);
      });
    return () => {
      vivo = false;
      if (unico) { unico.visor.pausar(); unico.marco.remove(); }
    };
    // Se engancha una vez; la escena y la persona cambian abajo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (listo && unico) unico.visor.setEscena(escena); }, [escena, listo]);
  useEffect(() => { if (listo && unico) unico.visor.setVerComo(yo); }, [yo, listo]);

  if (fallo) return null;
  return (
    <div className="casa3d" ref={host} role="group" aria-label="La casa en 3D: tu piso delante y los de los otros dos detrás. Toca el rótulo de un piso para verlo de cerca.">
      {!listo && <div className="casa3d-cargando">Dibujando la casa…</div>}
    </div>
  );
}
