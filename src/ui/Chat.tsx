// El chat de la casa (la B, la que eligió Javi): mensajes con fotos y audios y, entre ellos,
// lo que va pasando en la casa (pisos terminados con su «Ponle nota», la basura, los comunicados…).
// Mantener pulsado un mensaje abre sus opciones: fijarlo arriba, copiarlo o borrarlo (si es tuyo).
import { Camera, Mic, Pause, Pin, Play, SendHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as EventoPuntero } from 'react';
import { resumen, type Mensaje } from '../core/chat';
import { avisosBasuraAbiertos, paraPuntuar, tuyosAbiertos } from '../core/estado';
import type { Noticia } from '../core/noticias';
import { diaLocal, fechaCorta, hora, nombreDia } from '../core/tiempo';
import { claseColor, miembro, useCasa } from './contexto';
import { Avatar, FotoRef, Nombre } from './piezas';

type Item = { k: 'dia'; id: string; texto: string } | { k: 'msg'; m: Mensaje; seguido: boolean } | { k: 'casa'; n: Noticia };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function etiquetaDia(ts: number, ahora: number): string {
  const d = diaLocal(ahora) - diaLocal(ts);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  const t = `${nombreDia(ts)} ${fechaCorta(diaLocal(ts))}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function Chat() {
  const { estado, config } = useCasa();
  const { mensajes, fijado } = estado.chat;

  const items = useMemo(() => {
    const todo: ({ ts: number } & ({ m: Mensaje } | { n: Noticia }))[] = [
      ...mensajes.map((m) => ({ ts: m.ts, m })),
      ...estado.noticias.map((n) => ({ ts: n.ts, n })),
    ].sort((a, b) => a.ts - b.ts);
    const r: Item[] = [];
    let dia = -1;
    let anterior: Mensaje | null = null;
    for (const x of todo) {
      const d = diaLocal(x.ts);
      if (d !== dia) {
        r.push({ k: 'dia', id: `d${d}`, texto: etiquetaDia(x.ts, estado.ahora) });
        dia = d;
        anterior = null;
      }
      if ('m' in x) {
        const seguido = Boolean(anterior && anterior.autor === x.m.autor && x.m.ts - anterior.ts < 5 * 60_000);
        r.push({ k: 'msg', m: x.m, seguido });
        anterior = x.m;
      } else {
        r.push({ k: 'casa', n: x.n });
        anterior = null;
      }
    }
    return r;
  }, [mensajes, estado.noticias, estado.ahora]);

  // Al abrir, abajo del todo; y si llega algo y estabas abajo, se sigue bajando
  const fin = useRef<HTMLDivElement>(null);
  const primera = useRef(true);
  useEffect(() => {
    const cerca = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 280;
    // Hasta el final de la página: así lo último queda por encima de la barra de escribir
    if (primera.current || cerca) window.scrollTo({ top: document.documentElement.scrollHeight });
    primera.current = false;
  }, [items.length]);

  const irA = (id: string) => {
    const el = document.getElementById(`m-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('resalta');
    window.setTimeout(() => el.classList.remove('resalta'), 1600);
  };

  return (
    <div className="chat">
      <div className="chat-arriba">
        <header className="chat-cab margen">
          <div>
            <h1 className="display">Chat de la casa</h1>
            <p className="peq suave" style={{ marginTop: 4 }}>{config.miembros.map((m) => m.nombre).join(', ').replace(/, ([^,]*)$/, ' y $1')}</p>
          </div>
          <div className="tres" aria-hidden="true">
            {config.miembros.map((m) => <Avatar key={m.id} id={m.id} tam="s" />)}
          </div>
        </header>
        {fijado && (
          <button type="button" className="fijado" onClick={() => irA(fijado.id)}>
            <Pin size={18} />
            <span className="crece">
              <b>FIJADO · <Nombre id={fijado.autor} /></b>
              {resumen(fijado, 90)}
            </span>
          </button>
        )}
      </div>
      <div className="hilo margen">
        {items.length === 0 && <p className="vacio" style={{ textAlign: 'center' }}>Aún no hay nada. Escribe el primer mensaje 👇</p>}
        {items.map((it) =>
          it.k === 'dia' ? (
            <div key={it.id} className="dia">{it.texto}</div>
          ) : it.k === 'msg' ? (
            <Burbuja key={it.m.id} m={it.m} seguido={it.seguido} />
          ) : (
            <EnCasa key={it.n.id} n={it.n} />
          ),
        )}
        <div ref={fin} />
      </div>
      <Escribir />
    </div>
  );
}

function Burbuja({ m, seguido }: { m: Mensaje; seguido: boolean }) {
  const { yo, config, abrir } = useCasa();
  const mio = m.autor === yo;
  const autor = miembro(config, m.autor);
  const reloj = useRef(0);
  const inicio = useRef({ x: 0, y: 0 });
  const menu = () => abrir({ tipo: 'mensaje', mensaje: m });
  const soltar = () => window.clearTimeout(reloj.current);
  const pulsar = (e: EventoPuntero) => {
    inicio.current = { x: e.clientX, y: e.clientY };
    reloj.current = window.setTimeout(menu, 520);
  };
  const mover = (e: EventoPuntero) => {
    if (Math.abs(e.clientX - inicio.current.x) + Math.abs(e.clientY - inicio.current.y) > 12) soltar();
  };
  return (
    <div id={`m-${m.id}`} className={`msg ${mio ? 'mio' : ''} ${seguido ? 'seguido' : ''}`}>
      {!mio && (seguido ? <span className="hueco-avatar" /> : <Avatar id={m.autor} tam="s" />)}
      <div
        className={`burbuja ${claseColor(autor.color)} ${m.borrado ? 'borrada' : ''}`}
        onContextMenu={(e) => {
          e.preventDefault();
          soltar();
          menu();
        }}
        onPointerDown={pulsar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerLeave={soltar}
        onPointerCancel={soltar}
      >
        {!mio && !seguido && <div className="quien">{autor.nombre}</div>}
        {m.borrado ? (
          <p className="msg-texto">Mensaje borrado</p>
        ) : (
          <>
            {m.fotos.length > 0 && (
              <div className={`msg-fotos ${m.fotos.length > 1 ? 'varias' : ''}`}>
                {m.fotos.map((f) => <FotoRef key={f} ref_={f} grande />)}
              </div>
            )}
            {m.audio && <NotaDeVoz refAudio={m.audio.ref} segundos={m.audio.segundos} />}
            {m.texto && <p className="msg-texto">{m.texto}</p>}
          </>
        )}
        <div className="hora">{hora(m.ts)}</div>
      </div>
    </div>
  );
}

function NotaDeVoz({ refAudio, segundos }: { refAudio: string; segundos: number }) {
  const { almacen, avisar } = useCasa();
  const el = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState('');
  const [sonando, setSonando] = useState(false);
  const [t, setT] = useState(0);
  const total = Math.max(1, segundos);
  const alternar = async () => {
    const a = el.current;
    if (!a) return;
    if (sonando) {
      a.pause();
      return;
    }
    try {
      if (!url) {
        const u = await almacen.urlFoto(refAudio);
        setUrl(u);
        a.src = u;
      }
      await a.play();
    } catch {
      avisar('No se pudo reproducir el audio.');
    }
  };
  return (
    <div className="nota-voz">
      <button type="button" className="play" onClick={alternar} aria-label={sonando ? 'Pausar el audio' : 'Escuchar el audio'}>
        {sonando ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <span className="barra-voz" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (t / total) * 100)}%` }} />
      </span>
      <span className="dur">{mmss(sonando || t > 0 ? t : segundos)}</span>
      <audio
        ref={el}
        preload="none"
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={() => {
          setSonando(false);
          setT(0);
        }}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
      />
    </div>
  );
}

const EMOJI: Record<string, string> = { h: '🧹', r: '✅', sh: '📢', b: '🗑️', q: '📢', s: '🗑️', t: '🧦', tr: '🧦', tm: '📢', g: '💶', p: '💸', cu: '🤝', bc: '🤝' };

/** Lo que pasa en la casa, en medio de la conversación (con su botón si te toca hacer algo). */
function EnCasa({ n }: { n: Noticia }) {
  const { estado, yo, abrir, acciones, avisar } = useCasa();
  const tipo = n.id.slice(n.id.lastIndexOf('-') + 1);
  const base = n.id.slice(0, n.id.lastIndexOf('-'));
  let accion: { texto: string; hacer: () => void } | null = null;
  if (tipo === 'h') {
    const p = paraPuntuar(estado, yo).find((x) => x.intento.hecho.id === base);
    if (p) accion = { texto: 'Ponle nota', hacer: () => abrir({ tipo: 'puntuar', tarea: p.tarea, intento: p.intento }) };
  } else if (tipo === 'b') {
    const a = avisosBasuraAbiertos(estado).find((x) => x.responsable === yo && x.pulsaciones.some((p) => p.id === base));
    if (a) accion = { texto: 'Ya la saqué', hacer: async () => { await acciones.basuraSacada(); avisar('Basura sacada. ¡Gracias!'); } };
  } else if (tipo === 't') {
    const a = tuyosAbiertos(estado, yo).find((x) => x.id === base);
    if (a) accion = { texto: 'Ya lo recogí', hacer: async () => { await acciones.recogido(a.id); avisar('Recogido. ¡Bien!'); } };
  }
  const emoji = n.oficial ? '📢' : tipo === 'r' && /suspend/i.test(n.texto) ? '❌' : EMOJI[tipo] ?? '🏠';
  return (
    <div className={`en-casa ${n.oficial ? 'oficial' : ''}`}>
      <span className="e" aria-hidden="true">{emoji}</span>
      <span className="crece">
        {n.oficial && <b className="oficial-etiqueta">COMUNICADO OFICIAL</b>}
        {n.texto}
        {n.fotos && n.fotos.length > 0 && (
          <span className="en-casa-fotos">
            {n.fotos.slice(0, 2).map((f) => <FotoRef key={f} ref_={f} />)}
          </span>
        )}
      </span>
      {accion && (
        <button type="button" className="boton mini dorado" onClick={accion.hacer}>
          {accion.texto}
        </button>
      )}
    </div>
  );
}

function Escribir() {
  const { almacen, acciones, avisar } = useCasa();
  const [texto, setTexto] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [grabando, setGrabando] = useState<number | null>(null);
  const [seg, setSeg] = useState(0);
  const grabadora = useRef<MediaRecorder | null>(null);
  const cancelado = useRef(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const hayAlgo = texto.trim().length > 0 || fotos.length > 0;

  // Mientras escribes, el menú de abajo se aparta (y el teclado no tapa lo que escribes)
  const quitarFoco = () => document.documentElement.classList.remove('escribiendo');
  useEffect(() => quitarFoco, []);

  useEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = 'auto';
    a.style.height = `${Math.min(a.scrollHeight, 140)}px`;
  }, [texto]);

  useEffect(() => {
    if (grabando === null) return;
    const t = window.setInterval(() => {
      const s = Math.floor((Date.now() - grabando) / 1000);
      setSeg(s);
      if (s >= 180) parar(true); // como mucho, 3 minutos
    }, 250);
    return () => window.clearInterval(t);
  }, [grabando]);

  const enviar = async () => {
    if (!hayAlgo || enviando || subiendo) return;
    setEnviando(true);
    try {
      await acciones.mensaje({ texto: texto.trim() || undefined, fotos: fotos.length ? fotos : undefined });
      setTexto('');
      setFotos([]);
    } catch {
      /* la app ya avisa */
    } finally {
      setEnviando(false);
    }
  };

  const elegirFotos = async (lista: FileList | null) => {
    if (!lista?.length) return;
    const archivos = [...lista].slice(0, 6 - fotos.length);
    setSubiendo(archivos.length);
    const nuevas: string[] = [];
    for (const a of archivos) {
      try {
        nuevas.push(await almacen.subirFoto(a));
      } catch (e: any) {
        avisar(e?.message ?? 'No se pudo subir la foto.');
      }
      setSubiendo((x) => x - 1);
    }
    setFotos((f) => [...f, ...nuevas]);
    if (archivo.current) archivo.current.value = '';
  };

  const empezar = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      avisar('Este móvil no deja grabar audios desde aquí.');
      return;
    }
    let flujo: MediaStream;
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      avisar('Para mandar audios, deja que la app use el micrófono.');
      return;
    }
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t));
    const r = new MediaRecorder(flujo, tipo ? { mimeType: tipo, audioBitsPerSecond: 32_000 } : undefined);
    const trozos: Blob[] = [];
    const desde = Date.now();
    cancelado.current = false;
    r.ondataavailable = (e) => {
      if (e.data.size) trozos.push(e.data);
    };
    r.onstop = async () => {
      flujo.getTracks().forEach((t) => t.stop());
      setGrabando(null);
      setSeg(0);
      const segundos = Math.round((Date.now() - desde) / 1000);
      if (cancelado.current || segundos < 1 || !trozos.length) return;
      setEnviando(true);
      try {
        const ref = await almacen.subirAudio(new Blob(trozos, { type: r.mimeType || 'audio/webm' }));
        await acciones.mensaje({ audio: { ref, segundos } });
      } catch (e: any) {
        avisar(e?.message ?? 'No se pudo enviar el audio.');
      } finally {
        setEnviando(false);
      }
    };
    r.start();
    grabadora.current = r;
    setGrabando(desde);
  };

  const parar = (enviarlo: boolean) => {
    cancelado.current = !enviarlo;
    if (grabadora.current?.state === 'recording') grabadora.current.stop();
    grabadora.current = null;
  };

  // Que el toque en «Enviar» no quite antes el foco del texto (si no, el menú vuelve y el botón se mueve)
  const sinPerderFoco = (e: EventoPuntero) => e.preventDefault();

  return (
    <div className="escribir">
      {(fotos.length > 0 || subiendo > 0) && (
        <div className="escribir-fotos">
          {fotos.map((f) => <FotoRef key={f} ref_={f} onQuitar={() => setFotos((x) => x.filter((y) => y !== f))} />)}
          {subiendo > 0 && <div className="foto-nueva">Subiendo…</div>}
        </div>
      )}
      {grabando !== null ? (
        <div className="fila-escribir">
          <button type="button" className="redondo" onClick={() => parar(false)} aria-label="Cancelar el audio">
            <Trash2 size={20} />
          </button>
          <span className="grabando" role="status">
            <span className="punto-rojo" aria-hidden="true" /> Grabando · {mmss(seg)}
          </span>
          <button type="button" className="redondo enviar" onClick={() => parar(true)} aria-label="Enviar el audio">
            <SendHorizontal size={20} />
          </button>
        </div>
      ) : (
        <div className="fila-escribir">
          <button type="button" className="redondo" onClick={() => archivo.current?.click()} disabled={enviando} aria-label="Mandar una foto">
            <Camera size={21} />
          </button>
          <textarea
            ref={area}
            rows={1}
            value={texto}
            maxLength={2000}
            placeholder="Escribe a la casa…"
            aria-label="Mensaje"
            onChange={(e) => setTexto(e.target.value)}
            onFocus={() => document.documentElement.classList.add('escribiendo')}
            onBlur={quitarFoco}
          />
          {hayAlgo ? (
            <button type="button" className="redondo enviar" onPointerDown={sinPerderFoco} onClick={enviar} disabled={enviando || subiendo > 0} aria-label="Enviar">
              <SendHorizontal size={20} />
            </button>
          ) : (
            <button type="button" className="redondo enviar" onClick={empezar} disabled={enviando} aria-label="Grabar un audio">
              <Mic size={21} />
            </button>
          )}
        </div>
      )}
      <input ref={archivo} type="file" accept="image/*" multiple hidden onChange={(e) => elegirFotos(e.target.files)} />
    </div>
  );
}
