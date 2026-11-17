// «Estoy fuera» (Javi, 17 de noviembre: «aún no resolvimos bien lo de cuando Josu se vaya»): las fechas, lo que pasa
// mientras (su piso libre si está fuera casi toda la semana, la basura al siguiente, sin avisos) y el aviso en Hoy.
import { useState } from 'react';
import { basuraDe } from '../core/calendario';
import { zonaDe } from '../core/calendario';
import { DIAS_LIBRE, diasFuera, elDia, estaFuera, fueraDe, pisoLibre, rangoFuera, siguienteEnCasa, type Fuera } from '../core/fuera';
import { diaDeTexto, diaLocal, inicioDia, lunesDe, semana, textoDeDia } from '../core/tiempo';
import type { MiembroId } from '../core/tipos';
import { EligeQuien } from './Cuadro';
import { miembro, useCasa } from './contexto';
import { BotonAccion, Hoja } from './piezas';

/** Las fechas de quien se va (tú, o a quien elijas) y, antes de apuntarlo, lo que va a pasar. */
export function HojaFuera({ quien: inicial }: { quien?: MiembroId }) {
  const { cerrar, acciones, avisar, estado, config, yo } = useCasa();
  const [p, setP] = useState<MiembroId>(inicial ?? yo);
  const hoy = diaLocal(estado.ahora);
  const domingo = lunesDe(estado.semana) + 6;
  const [desde, setDesde] = useState(textoDeDia(hoy));
  const [hasta, setHasta] = useState(textoDeDia(domingo > hoy + 1 ? domingo : hoy + 3));
  const tu = p === yo;
  const n = (m: MiembroId) => miembro(config, m).nombre;
  const P = n(p);
  const ya = fueraDe(estado.fuera, p, estado.ahora);
  const d0 = diaDeTexto(desde), d1 = diaDeTexto(hasta);
  const valido = Number.isFinite(d0) && Number.isFinite(d1) && d1 >= d0 && d1 >= hoy;
  const nueva: Fuera | null = valido
    ? { id: 'nueva', quien: p, desde: inicioDia(d0), hasta: inicioDia(d1 + 1) - 1, evento: { id: 'nueva', tipo: 'fuera', autor: yo, ts: estado.ahora, datos: {} }, por: yo }
    : null;
  // lo que pasa con esas fechas: su piso de cada semana (libre o no), la basura y los avisos
  const lineas: string[] = [];
  if (nueva) {
    const fueras = [...estado.fuera, nueva];
    const dias = d1 - d0 + 1;
    lineas.push(`${dias === 1 ? '1 día' : `${dias} días`}: ${rangoFuera(nueva, estado.ahora - 1)}.`);
    for (let w = Math.max(estado.semana, semana(nueva.desde)); w <= semana(nueva.hasta); w++) {
      const z = zonaDe(config, w, p);
      if (!z) continue;
      const cuando = w === estado.semana ? 'esta semana' : w === estado.semana + 1 ? 'la semana que viene' : `la semana del ${elDia(inicioDia(lunesDe(w))).slice(3)}`;
      const su = tu ? 'Tu' : 'Su';
      if (pisoLibre(fueras, p, w)) lineas.push(`${su} ${z.nombre.toLowerCase()} de ${cuando} queda libre: si nadie lo limpia, se queda así y nadie pierde puntos.`);
      else if (diasFuera(fueras, p, w) > 0) lineas.push(`${su} ${z.nombre.toLowerCase()} de ${cuando} no queda libre (menos de ${DIAS_LIBRE} días fuera): ${tu ? 'límpialo' : 'que lo limpie'} antes o a la vuelta.`);
    }
    // la basura: la de esta semana, si la tiene, y la de la semana que viene, si le toca
    const tieneAhora = estado.basura === p && nueva.desde <= inicioDia(domingo + 1);
    if (tieneAhora) lineas.push(`La basura la lleva ${n(siguienteEnCasa(config, fueras, p, Math.max(nueva.desde, estado.ahora)))} mientras.`);
    const proxima = basuraDe(config, estado.semana + 1);
    if (proxima === p && nueva.hasta > inicioDia(domingo + 1)) lineas.push(`La de la semana que viene también la lleva otro mientras ${tu ? 'estés' : 'esté'} fuera.`);
    lineas.push(tu ? 'Mientras, no te llegan avisos.' : `Mientras, no le llegan avisos.`);
  }
  return (
    <Hoja
      titulo={tu ? '¿Te vas unos días?' : `¿${P} está fuera?`}
      subtitulo="Dinos cuándo y la casa se organiza sola."
      onCerrar={cerrar}
      pie={
        <BotonAccion
          desactivado={!nueva}
          hacer={async () => {
            await acciones.fuera(nueva!.desde, nueva!.hasta, p);
            cerrar();
            avisar(tu ? `Apuntado: estás fuera ${rangoFuera(nueva!, estado.ahora - 1)}. Ya lo saben.` : `Apuntado: ${P} está fuera ${rangoFuera(nueva!, estado.ahora - 1)}. Ya lo sabe.`);
          }}
        >
          {tu ? 'Me voy esos días' : `${P} está fuera esos días`}
        </BotonAccion>
      }
    >
      <div className="pila-s" style={{ gap: 18 }}>
        <EligeQuien quien={p} elegir={setP} />
        {ya && (
          <div className="fuera-ya">
            <b>✈️ {tu ? 'Ya estás fuera' : `${P} ya está fuera`} {rangoFuera(ya, estado.ahora)}</b>
            <div className="fuera-ya-botones">
              {ya.desde <= estado.ahora ? (
                <BotonAccion clase="boton mini" hacer={async () => { await acciones.anularFuera(ya.id, estado.ahora); cerrar(); avisar(tu ? '¡Bienvenido! Vuelves a estar en casa.' : `Apuntado: ${P} ha vuelto.`); }}>
                  {tu ? 'Ya he vuelto' : `${P} ha vuelto`}
                </BotonAccion>
              ) : (
                <BotonAccion clase="boton mini claro" hacer={async () => { await acciones.anularFuera(ya.id); cerrar(); avisar('Anulado.'); }}>
                  Anular
                </BotonAccion>
              )}
            </div>
          </div>
        )}
        <div className="fuera-fechas">
          <label className="campo">
            <span className="etiqueta">Desde</span>
            <input type="date" className="entrada" value={desde} min={textoDeDia(hoy)} onChange={(e) => { if (!e.target.value) return; setDesde(e.target.value); if (diaDeTexto(e.target.value) > diaDeTexto(hasta)) setHasta(e.target.value); }} />
          </label>
          <label className="campo">
            <span className="etiqueta">Hasta (vuelve al día siguiente)</span>
            <input type="date" className="entrada" value={hasta} min={desde} onChange={(e) => e.target.value && setHasta(e.target.value)} />
          </label>
        </div>
        {lineas.length > 0 && (
          <ul className="fuera-lineas">
            {lineas.map((l) => <li key={l}>{l}</li>)}
          </ul>
        )}
      </div>
    </Hoja>
  );
}

/** En Hoy: quién está fuera (ahora o en los próximos días) y qué pasa mientras. */
export function AvisoFuera() {
  const { estado, config, yo, abrir } = useCasa();
  const n = (m: MiembroId) => miembro(config, m).nombre;
  const pronto = estado.fuera.filter((f) => f.hasta >= estado.ahora && f.desde <= estado.ahora + 7 * 86_400_000);
  if (!pronto.length) return null;
  return (
    <div className="pila-s">
      {pronto.map((f) => {
        const tu = f.quien === yo;
        const ahora = estaFuera(estado.fuera, f.quien, estado.ahora);
        const t = estado.tareas.find((x) => x.semana === estado.semana && x.miembro === f.quien);
        const lleva = estado.semanasBasura.find((x) => x.semana === estado.semana)?.tramos.find((x) => x.fuera === f.quien);
        const partes: string[] = [];
        if (t?.libre && t.estado === 'pendiente') partes.push(`${tu ? 'Tu' : 'Su'} ${t.zona.nombre.toLowerCase()} queda libre${t.cubre ? `: lo limpia ${t.cubre === yo ? 'tú' : n(t.cubre)}` : ''}`);
        if (lleva) partes.push(`la basura la lleva ${lleva.quien === yo ? 'tú' : n(lleva.quien)}`);
        if (tu) partes.push('no te llegan avisos');
        const texto = partes.join(' · ');
        return (
          <button key={f.id} type="button" className="aviso-fuera" onClick={() => abrir({ tipo: 'fuera', quien: f.quien })}>
            <span className="e" aria-hidden="true">✈️</span>
            <span className="crece">
              <b>{tu ? (ahora ? 'Estás fuera' : 'Te vas') : `${n(f.quien)} ${ahora ? 'está fuera' : 'se va'}`} {rangoFuera(f, estado.ahora)}</b>
              {texto && <span>{texto.charAt(0).toUpperCase() + texto.slice(1)}.</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
