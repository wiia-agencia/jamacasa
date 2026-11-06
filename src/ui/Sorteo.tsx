import confetti from 'canvas-confetti';
import { useEffect, useMemo, useRef, useState } from 'react';
import { azarDe, barajar } from '../core/azar';
import { basuraDe, bolsaAntesDe, repartoSemana } from '../core/calendario';
import { rangoSemana } from '../core/tiempo';
import { useCasa } from './contexto';
import { Avatar } from './piezas';

const ALTO = 108;

export function Sorteo({ onCerrar }: { onCerrar: () => void }) {
  const { config, estado } = useCasa();
  const w = estado.semana;
  const reparto = repartoSemana(config, w);
  const ganador = basuraDe(config, w)!;
  const bolsa = bolsaAntesDe(config, w);
  const nombre = (id: string) => config.miembros.find((m) => m.id === id)?.nombre ?? id;
  const sinMovimiento = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const cinta = useMemo(() => {
    if (bolsa.length <= 1) return [ganador];
    const orden = barajar(bolsa, azarDe(w, 'tambor'));
    const r: string[] = [];
    for (let k = 0; k < 7; k++) r.push(...orden);
    r.push(ganador);
    return r;
  }, [w]);

  const [girando, setGirando] = useState(bolsa.length > 1 && !sinMovimiento);
  const tira = useRef<HTMLDivElement>(null);
  const restantes = bolsa.filter((b) => b !== ganador);

  useEffect(() => {
    if (!girando || !tira.current) return;
    const el = tira.current;
    const destino = -(cinta.length - 1) * ALTO;
    const anim = el.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${destino}px)` }], {
      duration: 3200,
      delay: 900,
      easing: 'cubic-bezier(0.12, 0.8, 0.18, 1)',
      fill: 'forwards',
    });
    anim.onfinish = () => {
      setGirando(false);
      try {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.45 }, colors: ['#f6c14f', '#ec6b67', '#ffffff', '#0e2a47'] });
      } catch {
        /* sin confeti no pasa nada */
      }
    };
    return () => anim.cancel();
  }, [girando]);

  return (
    <div className="sorteo" role="dialog" aria-modal="true" aria-label="Sorteo de la semana">
      <div className="sorteo-dentro margen">
        <div>
          <p className="negrita peq" style={{ opacity: 0.8 }}>Semana {rangoSemana(w, true)}</p>
          <h1 className="display" style={{ fontSize: 'var(--t-xxl)', marginTop: 6 }}>Sorteo de la semana</h1>
        </div>
        <div className="pila-s">
          {reparto.map((r, k) => (
            <div key={r.miembro} className="reparto-fila" style={{ animationDelay: `${k * 160}ms` }}>
              <Avatar id={r.miembro} />
              <span className="crece negrita">{nombre(r.miembro)}</span>
              <span className="negrita">{r.zona.nombre}</span>
            </div>
          ))}
        </div>
        <div className="pila-s">
          <p className="negrita">La basura</p>
          <div className="tambor" aria-live="polite">
            {girando ? (
              <div className="tambor-cinta" ref={tira}>
                {cinta.map((id, k) => (
                  <div key={k}>{nombre(id)}</div>
                ))}
              </div>
            ) : (
              <div className="tambor-cinta">
                <div>{nombre(ganador)}</div>
              </div>
            )}
          </div>
          <p className="peq" style={{ minHeight: '2.6em' }}>
            {girando
              ? `En la bolsa: ${bolsa.map(nombre).join(', ')}.`
              : bolsa.length <= 1
                ? `Solo quedaba ${nombre(ganador)} en la bolsa. La semana que viene se vuelve a llenar.`
                : `Le toca a ${nombre(ganador)}. En la bolsa ${restantes.length === 1 ? 'queda' : 'quedan'} ${restantes.map(nombre).join(' y ')}.`}
          </p>
        </div>
        <button type="button" className="boton ancho" style={{ marginTop: 'auto' }} onClick={onCerrar} disabled={girando}>
          {girando ? 'Sorteando…' : 'Vamos'}
        </button>
      </div>
    </div>
  );
}
