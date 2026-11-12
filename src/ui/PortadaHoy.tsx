import { Camera, Flame } from 'lucide-react';
import { useMemo, useState } from 'react';
import { escenaCasa } from '../core/escena';
import { tareaDe } from '../core/estado';
import { luzDe } from '../core/luz';
import { rangoSemana } from '../core/tiempo';
import portada from '../assets/portada.webp';
import { Casa3D } from './Casa3D';
import { useCasa } from './contexto';
import { horaForzada } from './Limpieza';
import { Avatar } from './piezas';

// La cabecera de Hoy. Javi, 12 de noviembre: «que esté el icono así como foto de inicio queda fatal». Mientras
// elige, la vista previa enseña las propuestas con ?portada=casa | limpia | foto (la de ahora es «icono»).
type Variante = 'icono' | 'casa' | 'limpia' | 'foto';

function variante(): Variante {
  if (!__VISTA__) return 'icono';
  try {
    const v = new URLSearchParams(location.search).get('portada');
    return v === 'casa' || v === 'limpia' || v === 'foto' ? v : 'icono';
  } catch {
    return 'icono';
  }
}

function Titulo({ claro = false }: { claro?: boolean }) {
  const { estado, yo, abrir } = useCasa();
  const rey = estado.titulos[estado.mes]?.rey ?? [];
  return (
    <div className={`portada-titulo margen ${claro ? 'claro' : ''}`}>
      <div>
        <h1 className="display marca">JAMACASA</h1>
        <p className="semana">
          <span>Semana {rangoSemana(estado.semana, true)}</span>
          {estado.racha.actual > 0 && (
            <span className="racha">
              <Flame size={15} /> {estado.racha.actual} {estado.racha.actual === 1 ? 'semana' : 'semanas'} de racha
            </span>
          )}
        </p>
      </div>
      <Avatar id={yo} tam="l" corona={rey.includes(yo)} onClick={() => abrir({ tipo: 'ajustes' })} />
    </div>
  );
}

export function PortadaHoy() {
  const v = variante();
  if (v === 'casa') return <PortadaCasa />;
  if (v === 'limpia') return <PortadaLimpia />;
  if (v === 'foto') return <PortadaFoto />;
  return (
    <header className="portada-hoy">
      <div className="banda-cielo">
        <Titulo />
      </div>
      <div className="portada">
        <img src={portada} alt="La Jamacasa al atardecer: uno hace el pino en el tejado, otro escala las columnas y otro da un mortal en el jardín" />
      </div>
    </header>
  );
}

/** A · La casa viva: la misma casa en 3D de Limpieza (los tres pisos, el tuyo entero), con el cielo de la hora. */
function PortadaCasa() {
  const { estado, config, yo, ir } = useCasa();
  const escena = useMemo(() => escenaCasa(estado), [estado]);
  const minuto = Math.floor(estado.ahora / 60_000);
  const luz = useMemo(() => luzDe(horaForzada(estado.ahora) ?? estado.ahora), [minuto]); // eslint-disable-line react-hooks/exhaustive-deps
  const [cielo, setCielo] = useState('');
  const [sin3D, setSin3D] = useState(false);
  const deNoche = luz.dia < 0.45;
  if (!escena || sin3D) return <PortadaLimpia />;
  return (
    <header className={`portada-hoy portada-casa ${deNoche ? 'de-noche' : ''}`} style={{ ['--cielo-arriba' as string]: cielo || undefined }}>
      <Casa3D
        miembros={config.miembros}
        escena={escena}
        yo={yo}
        alFallar={() => setSin3D(true)}
        juego={{ foco: null, cerca: true, parte: null, burbujas: [], luz, margenes: { arriba: 104, abajo: 40 }, alListo: (x) => setCielo(x.cielo) }}
      />
      <button type="button" className="portada-tocar" aria-label="Ver la casa en Limpieza" onClick={() => ir('limpieza')} />
      <Titulo claro={deNoche} />
    </header>
  );
}

/** B · Sin foto: la cabecera de color, con quién tiene cada piso esta semana. */
function PortadaLimpia() {
  const { estado, config } = useCasa();
  const corto: Record<string, string> = { abajo: 'Abajo', medio: 'Medio', arriba: 'Arriba' };
  return (
    <header className="portada-hoy portada-limpia">
      <Titulo />
      {estado.empezado && (
        <div className="portada-quien margen" aria-label="Quién tiene cada piso esta semana">
          {config.miembros.map((m) => {
            const t = tareaDe(estado, estado.semana, m.id);
            return (
              <span key={m.id} className="portada-persona">
                <Avatar id={m.id} />
                <span>
                  <b>{m.nombre}</b>
                  <small>{t ? corto[t.zona.id] ?? t.zona.nombre : '—'}</small>
                </span>
              </span>
            );
          })}
        </div>
      )}
    </header>
  );
}

/** C · Vuestra foto: la que pongáis en Ajustes (solo en la base de datos de la casa, nunca en el código). */
function PortadaFoto() {
  const { abrir, config } = useCasa();
  return (
    <header className="portada-hoy">
      <div className="banda-cielo">
        <Titulo />
      </div>
      <button type="button" className="portada portada-vacia" onClick={() => abrir({ tipo: 'ajustes' })}>
        <Camera size={34} aria-hidden="true" />
        <b>Vuestra foto aquí</b>
        <small>De los {config.miembros.length}, de la casa… La elegís en Ajustes</small>
      </button>
    </header>
  );
}
