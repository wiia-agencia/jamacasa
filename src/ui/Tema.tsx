// Tu tema (Javi, 19 de noviembre: «el tema que lo elija cada uno y punto»): el color del fondo de Hoy y la luz de la
// app, solo en este móvil. Se elige en Ajustes y con la paleta de arriba de Hoy; se ve al momento.
import { Check, Moon, Smartphone, Sun, Sunrise, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { COLORES_TEMA, type ColorTema, type LuzTema } from '../core/tema';
import { useCasa } from './contexto';
import { Hoja } from './piezas';

/** Cada color en pequeño: su luz y su fondo oscuro. */
const MUESTRA: Record<ColorTema, [string, string, string]> = {
  naranja: ['#ff8a3d', '#3a2a1e', '#120d0a'],
  azul: ['#3d8bff', '#1c2a46', '#090e19'],
  verde: ['#2fbf6b', '#183526', '#09110c'],
  morado: ['#9b6cff', '#2b1f42', '#0e0a17'],
  rosa: ['#ff5f8f', '#3a2030', '#120b0f'],
  grafito: ['#d9d9dd', '#333336', '#0d0d0e'],
};
const LUCES: { id: LuzTema; texto: string; Icono: LucideIcon }[] = [
  { id: 'auto', texto: 'Como el móvil', Icono: Smartphone },
  { id: 'claro', texto: 'Claro', Icono: Sun },
  { id: 'oscuro', texto: 'Oscuro', Icono: Moon },
  { id: 'sol', texto: 'Con el sol', Icono: Sunrise },
];

export function ElegirTema() {
  const { color, cambiarColor, tema, cambiarTema } = useCasa();
  return (
    <div className="tema-elegir">
      <p className="tema-et">Color de Hoy</p>
      <div className="tema-colores" role="radiogroup" aria-label="Color de Hoy">
        {COLORES_TEMA.map((c) => {
          const [m1, m2, m3] = MUESTRA[c.id];
          return (
            <button key={c.id} type="button" role="radio" aria-checked={color === c.id} className="tema-color" onClick={() => cambiarColor(c.id)}>
              <span className="tema-muestra" style={{ ['--m1' as string]: m1, ['--m2' as string]: m2, ['--m3' as string]: m3 } as CSSProperties}>
                <Check size={18} />
              </span>
              {c.nombre}
            </button>
          );
        })}
      </div>
      <p className="tema-et">Luz</p>
      <div className="tema-luces" role="radiogroup" aria-label="Luz">
        {LUCES.map(({ id, texto, Icono }) => (
          <button key={id} type="button" role="radio" aria-checked={tema === id} className="tema-luz" onClick={() => cambiarTema(id)}>
            <Icono size={20} />
            <span>{texto}</span>
          </button>
        ))}
      </div>
      <p className="tema-nota">
        {tema === 'sol'
          ? 'Con el sol: clara de día, oscura de noche y dorada al amanecer y al atardecer, como la casa en 3D.'
          : 'Solo cambia en tu móvil: cada uno elige el suyo. La luz es la de toda la app; el color, el del fondo de Hoy.'}
      </p>
    </div>
  );
}

/** La hoja de tu tema (la paleta de arriba de Hoy). */
export function HojaTema() {
  const { cerrar } = useCasa();
  return (
    <Hoja titulo="Tu tema" subtitulo="Solo cambia en tu móvil: cada uno elige el suyo." onCerrar={cerrar}>
      <ElegirTema />
    </Hoja>
  );
}
