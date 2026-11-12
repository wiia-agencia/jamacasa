import { Flame } from 'lucide-react';
import { tareaDe } from '../core/estado';
import { rangoSemana } from '../core/tiempo';
import { useCasa } from './contexto';
import { Avatar } from './piezas';

// La cabecera de Hoy: sin foto (la B, la que eligió Javi el 12 de noviembre; antes iba el icono de la app como
// foto de portada y «queda fatal»). Color, la semana, la racha y quién tiene cada piso esta semana.

const CORTO: Record<string, string> = { abajo: 'Abajo', medio: 'Medio', arriba: 'Arriba' };

export function PortadaHoy() {
  const { estado, config, yo, abrir } = useCasa();
  const rey = estado.titulos[estado.mes]?.rey ?? [];
  return (
    <header className="portada-hoy portada-limpia">
      <div className="portada-titulo margen">
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
      {estado.empezado && (
        <div className="portada-quien margen" aria-label="Quién tiene cada piso esta semana">
          {config.miembros.map((m) => {
            const t = tareaDe(estado, estado.semana, m.id);
            return (
              <span key={m.id} className="portada-persona">
                <Avatar id={m.id} />
                <span>
                  <b>{m.nombre}</b>
                  <small>{t ? CORTO[t.zona.id] ?? t.zona.nombre : '—'}</small>
                </span>
              </span>
            );
          })}
        </div>
      )}
    </header>
  );
}
