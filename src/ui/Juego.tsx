import { Flame } from 'lucide-react';
import type { ReactNode } from 'react';
import { nivel, puntosDelMes } from '../core/estado';
import { MEDALLAS, TITULOS } from '../core/juego';
import { nota } from '../core/noticias';
import { cuando, nombreMes, rangoSemana } from '../core/tiempo';
import { useCasa } from './contexto';
import { Avatar, Nombre, Puntos, Seccion } from './piezas';

export function Juego() {
  const { estado, config, yo, abrir } = useCasa();
  const mes = estado.mes;
  const titulos = estado.titulos[mes] ?? {};
  const filas = config.miembros
    .map((m) => ({ id: m.id, puntos: puntosDelMes(estado, m.id), nivel: nivel(estado, m.id) }))
    .sort((a, b) => b.puntos - a.puntos);
  const miNivel = nivel(estado, yo);
  const misApuntes = estado.apuntes.filter((a) => a.miembro === yo && a.mes === mes);
  const misMedallas = estado.medallas[yo] ?? {};
  const n = estado.normas;
  const pasados = estado.meses.filter((m) => m < mes).reverse();
  const ultimas = estado.racha.historial.slice(-8);

  return (
    <div className="margen pila">
      <header className="cabecera">
        <div>
          <h1 className="display titulo-pantalla">Ranking de {nombreMes(mes)}</h1>
          <p className="suave peq" style={{ marginTop: 6 }}>Se reinicia el día 1. Los títulos son provisionales hasta fin de mes.</p>
        </div>
      </header>

      <section className="caja ranking" aria-label="Ranking del mes">
        <div className="lista">
          {filas.map((f, k) => (
            <div key={f.id} className="item">
              <span className="pos">{k + 1}</span>
              <Avatar id={f.id} tam="l" corona={(titulos.rey ?? []).includes(f.id)} />
              <div className="crece">
                <p className="negrita"><Nombre id={f.id} /></p>
                <p className="peq suave">{f.nivel.actual.nombre}</p>
              </div>
              <span className="cifra">{nota(f.puntos)}</span>
            </div>
          ))}
        </div>
      </section>

      <Seccion titulo="Títulos del mes">
        <div className="caja">
          <div className="lista">
            {TITULOS.map((t) => {
              const quien = titulos[t.id] ?? [];
              return (
                <button key={t.id} type="button" className="item item-boton" onClick={() => abrir({ tipo: 'medalla', def: t, titulo: true })}>
                  <span style={{ fontSize: '1.5rem', width: 36, textAlign: 'center' }} aria-hidden="true">{t.emoji}</span>
                  <span className="crece">
                    <span className="negrita" style={{ display: 'block' }}>{t.nombre}</span>
                    <span className="peq suave">{quien.length ? quien.map((q) => config.miembros.find((m) => m.id === q)?.nombre).join(' y ') : 'Nadie por ahora'}</span>
                  </span>
                  <span className="fila" style={{ gap: 4 }}>
                    {quien.map((q) => <Avatar key={q} id={q} tam="s" />)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Racha de la casa">
        <div className="caja" style={{ padding: 16 }}>
          <div className="fila">
            <Flame size={28} className="oro" />
            <span className="cifra" style={{ fontSize: '2.4rem' }}>{estado.racha.actual}</span>
            <p className="crece peq suave">{estado.racha.actual === 1 ? 'semana seguida' : 'semanas seguidas'} con los tres pisos marcados dentro de su semana</p>
          </div>
          {ultimas.length > 0 && (
            <div className="pila-s" style={{ marginTop: 14 }}>
              <div className="puntos-racha" aria-label="Últimas semanas">
                {ultimas.map((h) => (
                  <span key={h.semana} className={h.estado === 'ok' ? 'ok' : h.estado === 'rota' ? 'rota' : ''} title={rangoSemana(h.semana)} />
                ))}
              </div>
              {ultimas.some((h) => h.estado === 'rota') && (
                <p className="tenue mini">
                  La última la rompió {(() => {
                    const r = [...ultimas].reverse().find((h) => h.estado === 'rota')!;
                    return r.culpables.map((c) => config.miembros.find((m) => m.id === c)?.nombre).join(' y ');
                  })()}.
                </p>
              )}
            </div>
          )}
        </div>
      </Seccion>

      <Seccion titulo="Tu nivel">
        <div className="caja pila-s" style={{ padding: 16 }}>
          <div className="fila entre">
            <p className="display" style={{ fontSize: 'var(--t-xl)' }}>{miNivel.actual.nombre}</p>
            <span className="cifra" style={{ fontSize: '1.6rem' }}>{nota(miNivel.total)}</span>
          </div>
          <div className="barra" aria-hidden="true"><span style={{ width: `${Math.round(miNivel.progreso * 100)}%` }} /></div>
          <p className="peq suave">
            {miNivel.siguiente
              ? `Te faltan ${nota(Math.max(0, miNivel.siguiente.desde - miNivel.total))} puntos para ${miNivel.siguiente.nombre}. El nivel suma todo lo que ganas desde el principio y nunca baja.`
              : 'Has llegado arriba del todo.'}
          </p>
        </div>
      </Seccion>

      <Seccion titulo="Tus medallas">
        <div className="medallas">
          {MEDALLAS.map((m) => {
            const veces = misMedallas[m.id] ?? 0;
            return (
              <button key={m.id} type="button" className={`medalla ${m.mala ? 'mala' : ''} ${veces ? '' : 'bloqueada'}`} onClick={() => abrir({ tipo: 'medalla', def: m })}>
                <span className="moneda" aria-hidden="true">{m.emoji}</span>
                <span className="nombre">{m.nombre}</span>
                <span className="veces">{m.proximamente ? 'Próximamente' : veces ? `×${veces}` : 'Aún no'}</span>
              </button>
            );
          })}
        </div>
      </Seccion>

      <Seccion titulo={`Tus puntos de ${nombreMes(mes)}`}>
        <div className="caja">
          <div className="lista">
            {misApuntes.length === 0 && <p className="vacio">Aún no has sumado ni restado nada este mes.</p>}
            {misApuntes.map((a, k) => (
              <div key={k} className="item">
                <span className="crece">
                  <span style={{ display: 'block' }}>{a.motivo}</span>
                  <span className="peq tenue">{cuando(a.ts, estado.ahora)}</span>
                </span>
                <Puntos valor={a.puntos} />
              </div>
            ))}
          </div>
        </div>
      </Seccion>

      {pasados.length > 0 && (
        <Seccion titulo="Meses anteriores">
          <div className="caja">
            <div className="lista">
              {pasados.map((m) => {
                const t = estado.titulos[m] ?? {};
                return (
                  <div key={m} className="item" style={{ alignItems: 'flex-start' }}>
                    <span className="crece pila-s" style={{ gap: 4 }}>
                      <span className="negrita">{nombreMes(m).charAt(0).toUpperCase() + nombreMes(m).slice(1)}</span>
                      <span className="peq suave">Rey: {(t.rey ?? []).map((q) => config.miembros.find((x) => x.id === q)?.nombre).join(' y ') || 'nadie'}</span>
                      <span className="peq suave">Escoba: {(t.escoba ?? []).map((q) => config.miembros.find((x) => x.id === q)?.nombre).join(' y ') || 'nadie'}</span>
                    </span>
                    <span className="pila-s" style={{ gap: 6 }}>
                      {config.miembros
                        .map((x) => ({ id: x.id, p: estado.puntosMes[m]?.[x.id] ?? 0 }))
                        .sort((a, b) => b.p - a.p)
                        .map((x) => (
                          <span key={x.id} className="fila" style={{ gap: 8, justifyContent: 'flex-end' }}>
                            <Avatar id={x.id} tam="s" />
                            <span className="cifra" style={{ fontSize: '1.15rem', minWidth: 34, textAlign: 'right' }}>{nota(x.p)}</span>
                          </span>
                        ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Seccion>
      )}

      <Seccion titulo="Las normas">
        <div className="caja">
          <div className="lista peq">
            <Norma texto="Nota para aprobar" valor={`${n.notaMinima} o más`} />
            <Norma texto="Plazo para puntuar" valor={`${n.horasRevision} h; si nadie puntúa, un ${n.notaAutomatica}`} />
            <Norma texto="Piso aprobado" valor="Tu nota media en puntos" />
            <Norma texto="Puntuar a tiempo" valor={<Puntos valor={n.puntosRevisar} />} />
            <Norma texto="Semana de basura sin quejas" valor={<Puntos valor={n.puntosBasuraSemana} />} />
            <Norma texto={`Basura sin sacar en ${n.horasBasura} h`} valor={<Puntos valor={n.puntosQuejaBasura} />} />
            <Norma texto={`«Esto es tuyo» sin recoger en ${n.horasEstoEsTuyo} h`} valor={<Puntos valor={n.puntosEstoEsTuyo} />} />
            <Norma texto="Retraso, por día (desde el lunes)" valor={<Puntos valor={n.puntosRetrasoDia} />} />
            <Norma texto="Piso suspendido" valor={<Puntos valor={n.puntosSuspenso} />} />
            <Norma texto="Sin hacer el miércoles a las 23:59" valor={<Puntos valor={n.puntosSinHacer} />} />
          </div>
        </div>
        <p className="tenue mini">Son las normas de arranque. Más adelante las cambiaréis votando desde aquí: con dos de tres votos, se cambian.</p>
      </Seccion>
    </div>
  );
}

function Norma({ texto, valor }: { texto: string; valor: ReactNode }) {
  return (
    <div className="item">
      <span className="crece">{texto}</span>
      <span className="negrita" style={{ textAlign: 'right' }}>{valor}</span>
    </div>
  );
}
