// Compras de casa (Javi, 17 de noviembre): el súper de casa por turnos (le toca al que menos ha aportado; no es deuda),
// lo que hace falta («Se ha acabado el aceite») y «Lo compré» / «Ahora no puedo».
import { Plus, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { abierta, COSAS_DE_CASA, type Falta } from '../core/compras';
import { euros, leerImporte } from '../core/cuentas';
import { duracion } from '../core/tiempo';
import type { MiembroId } from '../core/tipos';
import { miembro, useCasa } from './contexto';
import { Avatar, BotonAccion, Hoja, Seccion } from './piezas';

const hace = (ms: number, ahora: number) => {
  const dif = ahora - ms;
  if (dif < 60_000) return 'ahora mismo';
  const dias = Math.floor(dif / 86_400_000);
  return dias >= 1 ? `hace ${dias === 1 ? '1 día' : `${dias} días`}` : `hace ${duracion(dif)}`;
};

/** Lo que hace falta: quién lo pidió, a quién le toca y, si eres tú, «Lo compré» o «Ahora no puedo». */
function TarjetaFalta({ f }: { f: Falta }) {
  const { estado, config, yo, abrir, acciones, avisar } = useCasa();
  const n = (m: MiembroId) => (m === yo ? 'ti' : miembro(config, m).nombre);
  const mia = f.toca === yo;
  const suave = estado.super.suave[yo] ?? false;
  return (
    <div className={`falta ${mia ? 'mia' : ''}`}>
      <div className="fila" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span className="falta-icono" aria-hidden="true"><ShoppingCart size={20} /></span>
        <div className="crece pila-s" style={{ gap: 2 }}>
          <b>{f.cosa}</b>
          <span className="peq suave">
            Lo pidió {f.pide === yo ? 'tú' : miembro(config, f.pide).nombre} {hace(f.desde, estado.ahora)} · le toca a {n(f.toca)}
            {f.pasaron.length > 0 && ` (${f.pasaron.map((m) => miembro(config, m).nombre).join(' y ')} no ${f.pasaron.length > 1 ? 'pueden' : 'puede'})`}
          </span>
        </div>
        <Avatar id={f.toca} tam="s" />
      </div>
      <div className="falta-botones">
        <button type="button" className="boton mini verde" onClick={() => abrir({ tipo: 'comprado', falta: f })}>{mia ? 'Lo compré' : 'Lo compré yo'}</button>
        {mia && (
          <BotonAccion clase="boton mini claro" hacer={async () => { await acciones.faltaPaso(f.id); avisar('Vale: se lo pasamos al siguiente.'); }}>
            Ahora no puedo
          </BotonAccion>
        )}
        {f.pide === yo && !mia && (
          <BotonAccion clase="enlace" hacer={async () => { await acciones.faltaQuitada(f.id); avisar('Quitado: ya no hace falta.'); }}>
            Ya no hace falta
          </BotonAccion>
        )}
      </div>
      {mia && (
        <p className="mini tenue">
          {suave ? 'Te lo recuerdo una vez al día. ' : 'Te lo recuerdo cada día; si tarda, más veces (a los 5 días, 5 al día; a la semana, 12). '}
          <button type="button" className="enlace" onClick={async () => { await acciones.comprasSuave(!suave); avisar(suave ? 'Vuelve el modo pesado.' : 'Hecho: una vez al día.'); }}>
            {suave ? 'Volver al modo pesado' : 'Solo una vez al día'}
          </button>
        </p>
      )}
    </div>
  );
}

/** En Cuentas, arriba: a quién le toca comprar, cuánto ha aportado cada uno y lo que hace falta. */
export function SuperDeCasa() {
  const { estado, config, yo, abrir } = useCasa();
  const sup = estado.super;
  const ids = config.miembros.map((m) => m.id);
  const max = Math.max(1, ...ids.map((m) => sup.aportado[m] ?? 0));
  const orden = ids.slice().sort((a, b) => (sup.aportado[b] ?? 0) - (sup.aportado[a] ?? 0));
  const abiertas = sup.faltas.filter(abierta);
  const T = miembro(config, sup.toca);
  return (
    <Seccion titulo="Súper de casa">
      <div className="caja super-casa">
        <div className="super-toca">
          <Avatar id={sup.toca} tam="l" />
          <div className="crece">
            <p className="etiqueta">{sup.toca === yo ? 'Te toca comprar' : 'Le toca comprar a'}</p>
            <p className="super-quien">{sup.toca === yo ? 'A ti' : T.nombre}</p>
            <p className="peq suave">{sup.toca === yo ? 'Eres' : 'Es'} el que menos ha aportado. No es deuda: va por turnos.</p>
          </div>
        </div>
        <div className="super-marcador" aria-label="Lo que ha aportado cada uno">
          {orden.map((m) => {
            const v = sup.aportado[m] ?? 0;
            const c = miembro(config, m);
            return (
              <div key={m} className="super-fila">
                <span className="super-nombre">{m === yo ? 'Tú' : c.nombre}</span>
                <span className="super-barra"><span className={`c-${c.color}`} style={{ width: `${Math.max(v ? 4 : 0, (v / max) * 100)}%` }} /></span>
                <span className="super-cifra">{euros(v)}</span>
              </div>
            );
          })}
        </div>
      </div>
      {abiertas.length > 0 && (
        <div className="pila-s">
          <p className="etiqueta">Hace falta</p>
          {abiertas.map((f) => <TarjetaFalta key={f.id} f={f} />)}
        </div>
      )}
      <button type="button" className="boton ancho claro" onClick={() => abrir({ tipo: 'falta' })}>
        <Plus size={20} /> Se ha acabado algo
      </button>
    </Seccion>
  );
}

/** «Se ha acabado…»: qué (de un toque o escrito) y a quién le llega. */
export function HojaFalta() {
  const { cerrar, acciones, avisar, estado, config, yo } = useCasa();
  const [cosa, setCosa] = useState('');
  const toca = estado.super.toca;
  const T = toca === yo ? 'ti' : miembro(config, toca).nombre;
  const ya = new Set(estado.super.faltas.filter(abierta).map((f) => f.cosa.toLowerCase()));
  return (
    <Hoja
      titulo="¿Qué se ha acabado?"
      subtitulo={toca === yo ? 'Te toca comprarlo a ti: eres el que menos ha aportado.' : `Le llega a ${T}, que es el que menos ha aportado. Se lo recordamos cada día hasta que lo compre.`}
      onCerrar={cerrar}
      pie={
        <BotonAccion
          desactivado={!cosa.trim()}
          hacer={async () => {
            await acciones.falta(cosa.trim());
            cerrar();
            avisar(toca === yo ? `Apuntado: ${cosa.trim().toLowerCase()}. Te toca a ti.` : `Avisado: ${T} compra ${cosa.trim().toLowerCase()}.`);
          }}
        >
          {cosa.trim() ? (toca === yo ? `Apuntar: ${cosa.trim().toLowerCase()}` : `Avisar a ${T}`) : 'Elige o escribe qué falta'}
        </BotonAccion>
      }
    >
      <div className="pila-s" style={{ gap: 16 }}>
        <div className="opciones">
          {COSAS_DE_CASA.filter((c) => !ya.has(c.toLowerCase())).map((c) => (
            <button key={c} type="button" className="opcion" aria-pressed={cosa === c} onClick={() => setCosa(c)}>{c}</button>
          ))}
        </div>
        <div className="campo">
          <label htmlFor="falta-cosa">U otra cosa</label>
          <input id="falta-cosa" className="entrada" value={COSAS_DE_CASA.includes(cosa) ? '' : cosa} onChange={(e) => setCosa(e.target.value)} placeholder="Pastillas del lavavajillas, servilletas…" />
        </div>
      </div>
    </Hoja>
  );
}

/** «Lo compré»: cuánto ha costado (va al súper de casa: cuenta para ti en el marcador). */
export function HojaComprado({ falta }: { falta: Falta }) {
  const { cerrar, acciones, avisar } = useCasa();
  const [importe, setImporte] = useState('');
  const cent = leerImporte(importe);
  return (
    <Hoja
      titulo={`Has comprado: ${falta.cosa.toLowerCase()}`}
      subtitulo="¿Cuánto ha costado? Cuenta para ti en el súper de casa (no es deuda de nadie)."
      onCerrar={cerrar}
      pie={
        <BotonAccion
          desactivado={!cent}
          hacer={async () => {
            await acciones.comprado(falta.id, falta.cosa, cent!);
            cerrar();
            avisar(`¡Gracias! ${euros(cent!)} para tu marcador.`);
          }}
        >
          {cent ? `Lo compré · ${euros(cent)}` : 'Escribe cuánto ha costado'}
        </BotonAccion>
      }
    >
      <div className="campo">
        <label htmlFor="comprado-importe">Importe</label>
        <input id="comprado-importe" className="entrada importe" inputMode="decimal" autoComplete="off" autoFocus value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0,00 €" />
      </div>
    </Hoja>
  );
}

/** En Hoy: lo que te toca comprar. */
export function AvisoCompras() {
  const { estado, config, yo, abrir } = useCasa();
  const mias = estado.super.faltas.filter((f) => abierta(f) && f.toca === yo);
  if (!mias.length) return null;
  const cosas = mias.map((f) => f.cosa.toLowerCase());
  const lista = cosas.length > 1 ? `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}` : cosas[0];
  const vieja = mias.reduce((a, f) => (f.desde < a.desde ? f : a));
  return (
    <button type="button" className="aviso-compra" onClick={() => (mias.length === 1 ? abrir({ tipo: 'comprado', falta: mias[0] }) : document.getElementById('super-casa')?.scrollIntoView())}>
      <span className="falta-icono" aria-hidden="true"><ShoppingCart size={20} /></span>
      <span className="crece">
        <b>Te toca comprar: {lista}</b>
        <span>Lo pidió {vieja.pide === yo ? 'tú' : miembro(config, vieja.pide).nombre} {hace(vieja.desde, estado.ahora)}. Cuando lo compres, toca aquí.</span>
      </span>
    </button>
  );
}
