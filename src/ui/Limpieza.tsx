import { ChevronRight, Dices } from 'lucide-react';
import { rotacionFutura, semanaBasura, tareaDe } from '../core/estado';
import type { Tarea } from '../core/limpieza';
import { rangoSemana } from '../core/tiempo';
import type { Zona } from '../core/tipos';
import { useCasa } from './contexto';
import { Avatar, Nombre, Placa, Seccion } from './piezas';

export const corto = (z: Zona | null | undefined) => {
  if (!z) return '—';
  const t = z.nombre.replace(/^piso (de la |del |de )?/i, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function ChapaEstado({ t }: { t: Tarea }) {
  const i = t.intentos[t.intentos.length - 1];
  if (t.estado === 'aprobada') return <Placa valor={i.media!} peq auto={i.auto} />;
  if (t.estado === 'suspendida') return <Placa valor={i.media!} peq suspensa />;
  if (t.estado === 'esperando') return <span className="chapa">Esperando nota</span>;
  if (!t.enCurso) return <span className="chapa mal">{t.sinHacer ? 'Sin hacer' : 'Tarde'}</span>;
  return <span className="chapa">Pendiente</span>;
}

export function Limpieza() {
  const { estado, config, abrir } = useCasa();
  const w = estado.semana;
  const basura = semanaBasura(estado, w);
  const futuras = rotacionFutura(config, Math.max(w, estado.semanaInicio), 6);
  const historial = [];
  for (let k = w - 1; k >= Math.max(estado.semanaInicio, w - 8); k--) historial.push(k);

  return (
    <div className="margen pila">
      <header className="cabecera">
        <div>
          <h1 className="display titulo-pantalla">Limpieza</h1>
          <p className="suave peq" style={{ marginTop: 6 }}>Semana {rangoSemana(w, true)}</p>
        </div>
        {estado.empezado && (
          <button type="button" className="boton mini claro" onClick={() => abrir({ tipo: 'sorteo' })}>
            <Dices size={17} /> Sorteo
          </button>
        )}
      </header>

      {estado.empezado && (
        <Seccion titulo="Esta semana">
          <div className="caja">
            <div className="lista">
              {config.miembros.map((m) => {
                const t = tareaDe(estado, w, m.id);
                if (!t) return null;
                return (
                  <button key={m.id} type="button" className="item item-boton" onClick={() => abrir({ tipo: 'tarea', tarea: t })}>
                    <Avatar id={m.id} />
                    <span className="crece">
                      <span className="negrita" style={{ display: 'block' }}>{t.zona.nombre}</span>
                      <span className="peq suave">{m.nombre}</span>
                    </span>
                    <ChapaEstado t={t} />
                    <ChevronRight size={18} className="tenue" />
                  </button>
                );
              })}
              {basura && (
                <div className="item">
                  <span className="avatar" style={{ background: 'var(--papel-2)', fontSize: '1.1rem' }} aria-hidden="true">🗑️</span>
                  <span className="crece">
                    <span className="negrita" style={{ display: 'block' }}>La basura</span>
                    <span className="peq suave"><Nombre id={basura.responsable} />{basura.avisos.length ? `: ${basura.avisos.length} ${basura.avisos.length === 1 ? 'aviso' : 'avisos'} esta semana` : ', sin avisos esta semana'}</span>
                  </span>
                  <Avatar id={basura.responsable} tam="s" />
                </div>
              )}
            </div>
          </div>
        </Seccion>
      )}

      <Seccion titulo="Próximas semanas">
        <div className="caja" style={{ padding: 16 }}>
          <div className="rotacion" role="table" aria-label="Rotación de pisos">
            <span />
            {config.miembros.map((m) => (
              <span key={m.id} className="fila" style={{ gap: 6 }}>
                <Avatar id={m.id} tam="s" />
                <span className="peq negrita">{m.nombre}</span>
              </span>
            ))}
            {futuras.map((f) => (
              <Fila key={f.semana} semana={f.semana} hoy={f.semana === w} celdas={f.reparto.map((r) => corto(r.zona))} />
            ))}
          </div>
          <p className="tenue mini" style={{ marginTop: 14 }}>Cada uno avanza un piso por semana. La basura se sortea cada lunes: sale uno de la bolsa y no vuelve a entrar hasta que hayan salido los tres.</p>
        </div>
      </Seccion>

      <Seccion titulo="Los pisos">
        <div className="caja">
          <div className="lista">
            {config.zonas.map((z) => (
              <button key={z.id} type="button" className="item item-boton" onClick={() => abrir({ tipo: 'zona', zona: z })}>
                <span className="crece">
                  <span className="negrita" style={{ display: 'block' }}>{z.nombre}</span>
                  <span className="peq suave">{z.incluye}</span>
                </span>
                <ChevronRight size={18} className="tenue" />
              </button>
            ))}
          </div>
        </div>
        <p className="tenue mini">{config.notaLimpieza ?? 'Cada uno limpia su habitación y su baño.'}</p>
      </Seccion>

      {historial.length > 0 && (
        <Seccion titulo="Semanas anteriores">
          <div className="caja" style={{ padding: 16 }}>
            <div className="rotacion">
              <span />
              {config.miembros.map((m) => (
                <span key={m.id} className="fila" style={{ gap: 6 }}>
                  <Avatar id={m.id} tam="s" />
                </span>
              ))}
              {historial.map((k) => (
                <HistFila key={k} semana={k} />
              ))}
            </div>
          </div>
        </Seccion>
      )}
    </div>
  );
}

function Fila({ semana, hoy, celdas }: { semana: number; hoy: boolean; celdas: string[] }) {
  return (
    <>
      <span className={`sem ${hoy ? 'hoy' : ''}`}>{hoy ? 'Esta' : rangoSemana(semana)}</span>
      {celdas.map((c, k) => (
        <span key={k} className="celda-zona"><span>{c}</span></span>
      ))}
    </>
  );
}

function HistFila({ semana }: { semana: number }) {
  const { estado, config, abrir } = useCasa();
  return (
    <>
      <span className="sem">{rangoSemana(semana)}</span>
      {config.miembros.map((m) => {
        const t = tareaDe(estado, semana, m.id);
        return (
          <span key={m.id} className="celda-zona">
            {t ? (
              <button type="button" className="item-boton" style={{ padding: 0 }} onClick={() => abrir({ tipo: 'tarea', tarea: t })} aria-label={`${m.nombre}: ${t.zona.nombre}`}>
                <ChapaEstado t={t} />
              </button>
            ) : (
              <span className="tenue">—</span>
            )}
          </span>
        );
      })}
    </>
  );
}
