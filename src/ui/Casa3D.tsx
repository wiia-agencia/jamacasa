import { useEffect, useRef, useState } from 'react';
import type { EscenaCasa } from '../core/escena';
import type { Luz } from '../core/luz';
import type { Miembro, MiembroId } from '../core/tipos';
import '../casa3d/visor.css';

// La casa en 3D. three.js va en un archivo aparte que solo se baja al abrir Limpieza (o la casa de un día en el
// historial), y la casa se construye una sola vez: al cambiar de pantalla se aparca y al volver se vuelve a enganchar.
// Dos formas: la pantalla de juego de Limpieza (la D: los pisos separados, la cámara va al piso de quien toques y
// encima de cada muñeco su bocadillo) y la casa de siempre (la del historial).

type Modulo = typeof import('../casa3d/index.js');
type Visor = ReturnType<Modulo['crearVisor']>;

/** Estilo de la casa */
export const ESTILO_CASA = 'juguete_vivo'; // la A3, «Casita viva»: la que eligió Javi el 9 de noviembre

const COLORES: Record<string, string> = { naranja: '#d96a14', verde: '#1a9150', azul: '#2569db' };

export interface BurbujaCasa {
  id: MiembroId;
  titulo: string;
  sub?: string;
  tono: string;
  alTocar?: () => void;
}

/** «Mi parte»: tus cuartos (los nombres del plano), los días que lleva cada uno sin limpiarse (null: sin apuntar) y
 *  cuánto brilla (recién limpio: 3, 2, 1; si no, 0) */
export interface ParteCasa {
  cuartos: string[];
  dias: Record<string, number | null>;
  brillo: Record<string, number>;
  /** El cuarto que se mira (al tocarlo en «Tu parte»): se ve de cerca, con un marco de tu color y tú dentro */
  foco?: string | null;
}

export interface JuegoCasa {
  /** El piso que se mira: el de esa persona (null: el tuyo). Se ven los tres; ese, entero y los otros, medio transparentes */
  foco: MiembroId | null;
  /** Con el cajón abierto: el piso que se mira, de cerca */
  cerca: boolean;
  /** «Mi parte»: solo tus cuartos (null: la casa de los tres) */
  parte: ParteCasa | null;
  burbujas: BurbujaCasa[];
  luz: Luz;
  /** Lo que tapan la cabecera y el cajón (para que los bocadillos no se metan debajo) */
  margenes: { arriba: number; abajo: number };
  /** Cuando la casa está lista: las caras de los muñecos y el color de arriba del cielo */
  alListo?: (v: { caras: Record<string, string>; cielo: string }) => void;
}

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

export function Casa3D({ miembros, escena, yo, juego, alFallar }: { miembros: Miembro[]; escena: EscenaCasa; yo: MiembroId; juego?: JuegoCasa; alFallar?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const ultima = useRef(escena);
  ultima.current = escena;
  const ultimoJuego = useRef(juego);
  ultimoJuego.current = juego;
  const modo = juego ? 'juego' : 'casa';

  useEffect(() => {
    const fallar = () => { setFallo(true); alFallar?.(); };
    if (!hayWebGL()) { fallar(); return; }
    let vivo = true;
    (modulo ??= import('../casa3d/index.js'))
      .then((m) => {
        if (!vivo || !host.current) return;
        const clave = `${modo}|${ESTILO_CASA}|${miembros.map((x) => `${x.id}:${x.nombre}:${x.color}:${JSON.stringify(x.aspecto ?? {})}`).join('|')}`;
        const j = ultimoJuego.current;
        if (!unico || unico.clave !== clave) {
          if (unico) { unico.visor.destruir(); unico.marco.remove(); unico = null; }
          m.configurarPersonas(miembros.map((x) => ({ id: x.id, nombre: x.nombre, color: COLORES[x.color] ?? x.color, aspecto: x.aspecto })));
          const marco = document.createElement('div');
          marco.className = j ? 'c3-visor casa3d-escenario' : 'c3-visor casa3d-marco';
          host.current.appendChild(marco);
          const visor = m.crearVisor(marco, j
            ? { estilo: ESTILO_CASA, verComo: yo, escena: ultima.current, juego: true, luz: j.luz }
            : { estilo: ESTILO_CASA, verComo: yo, escena: ultima.current, vista: 'foco' });
          unico = { marco, visor, clave };
        } else {
          host.current.appendChild(unico.marco);
          unico.visor.setVerComo(yo);
          unico.visor.setEscena(ultima.current);
          unico.visor.seguir();
        }
        if (j) {
          const v = unico.visor;
          v.setMargenes(j.margenes);
          v.setLuz(j.luz);
          v.setFoco(j.foco ? v.nivelDe(j.foco) : null);
          v.setCerca(j.cerca);
          v.setParte(j.parte);
          v.setBurbujas(j.burbujas);
          j.alListo?.({ caras: v.retratos(), cielo: v.cielo() });
        }
        setListo(true);
      })
      .catch(() => {
        if (unico) { unico.marco.remove(); unico = null; }
        fallar();
      });
    return () => {
      vivo = false;
      if (unico) { unico.visor.pausar(); unico.marco.remove(); }
    };
    // Se engancha una vez; la escena, la persona y lo del juego cambian abajo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (listo && unico) unico.visor.setEscena(escena); }, [escena, listo]);
  useEffect(() => { if (listo && unico) unico.visor.setVerComo(yo); }, [yo, listo]);
  const foco = juego?.foco ?? null;
  const burbujas = juego?.burbujas;
  const luz = juego?.luz;
  const margenes = juego?.margenes;
  useEffect(() => { if (listo && unico && juego) unico.visor.setFoco(foco ? unico.visor.nivelDe(foco) : null); }, [foco, listo, escena]); // eslint-disable-line react-hooks/exhaustive-deps
  const cerca = !!juego?.cerca;
  useEffect(() => { if (listo && unico && juego) unico.visor.setCerca(cerca); }, [cerca, listo]); // eslint-disable-line react-hooks/exhaustive-deps
  const parte = juego?.parte ?? null;
  const claveParte = parte ? JSON.stringify(parte) : '';
  useEffect(() => { if (listo && unico && juego) unico.visor.setParte(parte); }, [claveParte, listo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (listo && unico && burbujas) unico.visor.setBurbujas(burbujas); }, [burbujas, listo]);
  useEffect(() => {
    if (!listo || !unico || !luz) return;
    unico.visor.setLuz(luz);
    ultimoJuego.current?.alListo?.({ caras: unico.visor.retratos(), cielo: unico.visor.cielo() });
  }, [luz, listo]);
  useEffect(() => { if (listo && unico && margenes) unico.visor.setMargenes(margenes); }, [margenes?.arriba, margenes?.abajo, listo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fallo) return null;
  if (juego) {
    return (
      <div className="casa3d-juego" ref={host} role="group" aria-label="La casa en 3D con los tres pisos: el que miras, entero, y los otros, medio transparentes. Toca una cara de arriba para ver su piso.">
        {!listo && <div className="casa3d-cargando">Dibujando la casa…</div>}
      </div>
    );
  }
  return (
    <div className="casa3d" ref={host} role="group" aria-label="La casa en 3D: tu piso delante y los de los otros dos detrás. Toca el rótulo de un piso para verlo de cerca.">
      {!listo && <div className="casa3d-cargando">Dibujando la casa…</div>}
    </div>
  );
}
