import { ArrowRight, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { alquilerPendiente, euros, type Gasto } from '../core/cuentas';
import { diaLocal, fechaCorta, mesDeDia, nombreMes, diaDeTexto } from '../core/tiempo';
import { useCasa } from './contexto';
import { Avatar, Nombre, Seccion } from './piezas';

export function Cuentas() {
  const { estado, config, yo, abrir, acciones, avisar } = useCasa();
  const c = estado.cuentas;
  const debo = c.transferencias.filter((t) => t.de === yo);
  const meDeben = c.transferencias.filter((t) => t.a === yo);
  const totalMeDeben = meDeben.reduce((a, t) => a + t.importe, 0);
  const al = config.alquiler;
  const alquilerMes = c.alquiler.filter((x) => x.mes === estado.mes);
  const [verAnulados, setVerAnulados] = useState(false);

  const gastos = c.gastos.filter((g) => verAnulados || !g.anulado);
  const porMes = new Map<string, Gasto[]>();
  for (const g of gastos) {
    const m = mesDeDia(diaDeTexto(g.fecha));
    (porMes.get(m) ?? porMes.set(m, []).get(m)!).push(g);
  }

  return (
    <div className="margen pila">
      <header className="cabecera">
        <h1 className="display titulo-pantalla">Cuentas</h1>
      </header>

      <section className="tarjeta pila-s" aria-label="Tu saldo">
        {debo.length > 0 ? (
          debo.map((t) => {
            const pend = alquilerPendiente(c, yo, estado.mes);
            const conAlquiler = pend && t.a === al.paga;
            return (
              <div key={t.a} className="pila-s">
                <p className="suave peq">Le debes a <Nombre id={t.a} /></p>
                <div className="fila entre">
                  <span className="cifra" style={{ fontSize: '3rem' }}>{euros(t.importe)}</span>
                  <Avatar id={t.a} tam="l" />
                </div>
                {conAlquiler && (
                  <div className="pila-s peq" style={{ gap: 4 }}>
                    <div className="fila entre"><span className="suave">Alquiler de {nombreMes(estado.mes)}</span><span>{euros(pend!.parte)}</span></div>
                    <div className="fila entre"><span className="suave">Gastos comunes</span><span>{euros(t.importe - pend!.parte)}</span></div>
                  </div>
                )}
                <button type="button" className="boton ancho" onClick={() => abrir({ tipo: 'saldar', transferencia: t, alquiler: conAlquiler ? estado.mes : undefined })}>
                  Ya se lo he pagado
                </button>
              </div>
            );
          })
        ) : meDeben.length > 0 ? (
          <div className="pila-s">
            <p className="suave peq">Te deben</p>
            <span className="cifra" style={{ fontSize: '3rem' }}>{euros(totalMeDeben)}</span>
            <div className="lista">
              {meDeben.map((t) => (
                <div key={t.de} className="item">
                  <Avatar id={t.de} tam="s" />
                  <span className="crece"><Nombre id={t.de} /></span>
                  <span className="negrita">{euros(t.importe)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="pila-s">
            <p className="display" style={{ fontSize: 'var(--t-xl)' }}>Estás en paz</p>
            <p className="suave peq">No debes nada a nadie y nadie te debe nada.</p>
          </div>
        )}
      </section>

      <Seccion titulo="Cómo quedan las cuentas">
        <div className="caja">
          <div className="lista">
            {c.transferencias.length === 0 && <p className="vacio">Todo saldado entre los tres.</p>}
            {c.transferencias.map((t) => (
              <div key={`${t.de}-${t.a}`} className="item">
                <Avatar id={t.de} tam="s" />
                <ArrowRight size={16} className="tenue" />
                <Avatar id={t.a} tam="s" />
                <span className="crece peq"><Nombre id={t.de} /> le debe a <Nombre id={t.a} /></span>
                <span className="negrita">{euros(t.importe)}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="tenue mini">Ya está todo simplificado: como mucho, dos Bizums cierran las cuentas de la casa.</p>
      </Seccion>

      {al.total > 0 && (
        <Seccion titulo={`Alquiler de ${nombreMes(estado.mes)}`}>
          <div className="caja">
            <div className="lista">
              {alquilerMes.map((x) => {
                const vence = diaDeTexto(`${estado.mes}-${String(al.dia).padStart(2, '0')}`);
                const tarde = !x.pagadoEn && diaLocal(estado.ahora) > vence;
                return (
                  <div key={x.persona} className="item">
                    <Avatar id={x.persona} />
                    <div className="crece">
                      <p className="negrita"><Nombre id={x.persona} />: {euros(x.parte)}</p>
                      <p className={`peq ${tarde ? 'mal' : 'suave'}`}>
                        {x.pagadoEn
                          ? `Pagado el ${fechaCorta(diaLocal(x.pagadoEn))}${x.diasTarde ? `, ${x.diasTarde} ${x.diasTarde === 1 ? 'día' : 'días'} tarde` : ''}`
                          : tarde
                            ? `Sin pagar: vencía el ${fechaCorta(vence)}`
                            : `Pendiente: vence el ${fechaCorta(vence)}`}
                      </p>
                    </div>
                    {!x.pagadoEn && x.persona === yo && (
                      <button
                        type="button"
                        className="boton mini"
                        onClick={async () => {
                          await acciones.pago(yo, al.paga, x.parte, estado.mes);
                          avisar(`Apuntado: alquiler de ${nombreMes(estado.mes)} pagado.`);
                        }}
                      >
                        Ya lo pagué
                      </button>
                    )}
                    {x.pagadoEn && <span className="chapa oro">Pagado</span>}
                  </div>
                );
              })}
              <div className="item">
                <Avatar id={al.paga} />
                <p className="crece peq suave"><Nombre id={al.paga} /> paga los {euros(al.total)} al casero. Su parte son {euros(al.partes[al.paga] ?? 0)}.</p>
              </div>
            </div>
          </div>
        </Seccion>
      )}

      <Seccion
        titulo="Gastos"
        extra={
          c.gastos.some((g) => g.anulado) ? (
            <button type="button" className="enlace" onClick={() => setVerAnulados(!verAnulados)}>
              {verAnulados ? 'Ocultar anulados' : 'Ver anulados'}
            </button>
          ) : undefined
        }
      >
        <button type="button" className="boton ancho" onClick={() => abrir({ tipo: 'gasto' })}>
          <Plus size={20} /> Apuntar un gasto
        </button>
        {[...porMes.entries()].map(([m, lista]) => (
          <div key={m} className="pila-s">
            <p className="etiqueta" style={{ marginTop: 8 }}>{nombreMes(m).charAt(0).toUpperCase() + nombreMes(m).slice(1)}</p>
            <div className="caja">
              <div className="lista">
                {lista.map((g) => (
                  <button key={g.id} type="button" className="item item-boton" onClick={() => abrir({ tipo: 'detalle-gasto', gasto: g })}>
                    <Avatar id={g.pagador} tam="s" />
                    <span className="crece">
                      <span className="negrita" style={{ display: 'block', textDecoration: g.anulado ? 'line-through' : undefined }}>{g.concepto}</span>
                      <span className="peq suave">
                        Pagó <Nombre id={g.pagador} />. {g.partes[yo] ? `Te toca ${euros(g.partes[yo])}` : 'No te toca nada'}
                      </span>
                    </span>
                    <span className="negrita">{euros(g.importe)}</span>
                    <ChevronRight size={18} className="tenue" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </Seccion>

      {c.pagos.length > 0 && (
        <Seccion titulo="Pagos entre vosotros">
          <div className="caja">
            <div className="lista">
              {c.pagos.slice(0, 20).map((p) => (
                <div key={p.id} className="item">
                  <Avatar id={p.de} tam="s" />
                  <ArrowRight size={16} className="tenue" />
                  <Avatar id={p.a} tam="s" />
                  <span className="crece peq">
                    <span style={{ textDecoration: p.anulado ? 'line-through' : undefined }}>
                      {p.alquiler ? `Alquiler de ${nombreMes(p.alquiler)}` : p.nota || 'Pago'}
                    </span>
                    <span className="tenue" style={{ display: 'block' }}>{fechaCorta(diaLocal(p.evento.ts))}{p.anulado ? ', anulado' : ''}</span>
                  </span>
                  <span className="negrita">{euros(p.importe)}</span>
                  {!p.anulado && (p.de === yo || p.a === yo) && (
                    <button
                      type="button"
                      className="enlace"
                      onClick={async () => {
                        await acciones.anularPago(p.id);
                        avisar('Pago anulado.');
                      }}
                    >
                      Anular
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Seccion>
      )}

      <Seccion titulo="Quién paga cada factura">
        <div className="caja">
          <div className="lista">
            {config.facturas.map((f) => (
              <div key={f.id} className="item">
                <span className="crece">{f.nombre}</span>
                {f.paga ? (
                  <span className="fila" style={{ gap: 8 }}>
                    <span className="peq"><Nombre id={f.paga} /></span>
                    <Avatar id={f.paga} tam="s" />
                  </span>
                ) : (
                  <span className="peq suave">El que esté</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Seccion>
    </div>
  );
}
