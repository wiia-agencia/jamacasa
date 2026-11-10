import confetti from 'canvas-confetti';
import { House, MessageCircle, Sparkles, Trophy, Wallet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sinLeer } from './core/chat';
import { diaLocal } from './core/tiempo';
import { avisosBasuraAbiertos, derivar, paraPuntuar, tuyosAbiertos } from './core/estado';
import type { Evento, MiembroId, TipoEvento } from './core/tipos';
import type { Almacen } from './datos/almacen';
import { activarAvisos as pedirAvisos, estadoAvisos, renovarAvisos, type EstadoAvisos } from './datos/avisos';
import { abrirCasa, casaDisponible } from './datos/casa';
import { guardar, leer } from './datos/guardado';
import { almacenPrueba, configPrueba } from './datos/prueba';
import { Contexto, type Acciones, type Ctx, type Hoja, type Pantalla } from './ui/contexto';
import { Chat } from './ui/Chat';
import { Cuentas } from './ui/Cuentas';
import { Entrada } from './ui/Entrada';
import { Historial } from './ui/Historial';
import { Hojas } from './ui/hojas';
import { Hoy } from './ui/Hoy';
import { Juego } from './ui/Juego';
import { Limpieza } from './ui/Limpieza';
import { Sorteo } from './ui/Sorteo';

type Tema = 'auto' | 'claro' | 'oscuro';


let temaPuestoPorMi = false;
function aplicarTema(t: Tema) {
  const raiz = document.documentElement;
  if (t === 'auto') {
    if (temaPuestoPorMi) raiz.removeAttribute('data-theme');
    temaPuestoPorMi = false;
  } else {
    raiz.setAttribute('data-theme', t === 'oscuro' ? 'dark' : 'light');
    temaPuestoPorMi = true;
  }
}

export default function App() {
  const [almacen, setAlmacen] = useState<Almacen | null>(null);
  const [fase, setFase] = useState<'cargando' | 'puerta' | 'dentro'>('cargando');
  const [tema, setTema] = useState<Tema>(() => (leer('jamacasa-tema') as Tema) || 'auto');

  useEffect(() => { aplicarTema(tema); }, [tema]);

  useEffect(() => {
    (async () => {
      if (!__VISTA__ && casaDisponible()) {
        try {
          const a = await abrirCasa();
          if (a) { setAlmacen(a); setFase('dentro'); return; }
        } catch { /* sigue a la puerta */ }
      }
      if (leer('jamacasa-modo') === 'prueba') {
        setAlmacen(almacenPrueba(Date.now()));
        setFase('dentro');
        return;
      }
      setFase('puerta');
    })();
  }, []);

  if (fase === 'cargando') return <div className="puerta" aria-busy="true" />;
  if (fase === 'puerta' || !almacen) {
    return (
      <Entrada
        configPrueba={configPrueba(Date.now())}
        entrarPrueba={(yo) => {
          const a = almacenPrueba(Date.now());
          a.cambiarYo?.(yo);
          guardar('jamacasa-modo', 'prueba');
          setAlmacen(a);
          setFase('dentro');
        }}
        entrarCasa={async () => {
          const a = await abrirCasa();
          if (a) { guardar('jamacasa-modo', 'casa'); setAlmacen(a); setFase('dentro'); }
        }}
      />
    );
  }
  return (
    <Casa
      key={`${almacen.modo}`}
      almacen={almacen}
      tema={tema}
      cambiarTema={(t) => { setTema(t); guardar('jamacasa-tema', t === 'auto' ? null : t); }}
      salir={async () => {
        await almacen.salir();
        guardar('jamacasa-modo', null);
        setAlmacen(null);
        setFase('puerta');
      }}
    />
  );
}

function Casa({ almacen, tema, cambiarTema, salir }: { almacen: Almacen; tema: Tema; cambiarTema: (t: Tema) => void; salir: () => void }) {
  const config = almacen.config;
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [listo, setListo] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [ahora, setAhora] = useState(Date.now());
  const [yo, setYo] = useState<MiembroId>(almacen.yo);
  const [pantalla, setPantalla] = useState<Pantalla>('hoy');
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [historial, setHistorial] = useState<{ dia: number; vista: 'dia' | 'mes' } | null>(null);
  const [tostada, setTostada] = useState('');
  const temporizador = useRef<number>(0);

  const cargar = useCallback(async () => {
    try {
      const lista = await almacen.cargarEventos();
      setEventos(lista);
      setErrorCarga('');
    } catch (e: any) {
      setErrorCarga(e?.message ?? 'No se pudieron cargar los datos.');
    } finally {
      setListo(true);
    }
  }, [almacen]);

  useEffect(() => {
    cargar();
    const dejar = almacen.escuchar((e) => setEventos((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e])));
    const reloj = window.setInterval(() => setAhora(Date.now()), 30_000);
    const alVolver = () => {
      if (document.visibilityState === 'visible') {
        setAhora(Date.now());
        if (almacen.modo === 'casa') cargar();
      }
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => { dejar(); clearInterval(reloj); document.removeEventListener('visibilitychange', alVolver); };
  }, [almacen, cargar]);

  const estado = useMemo(() => derivar(config, eventos, ahora), [config, eventos, ahora]);

  // Avisos al móvil: cómo están en este móvil y, si ya hay permiso, renovar su dirección
  const [avisos, setAvisos] = useState<EstadoAvisos>('no');
  const casaAvisos = useMemo(
    () => (almacen.suscribir && almacen.llaveAvisos ? { guardar: almacen.suscribir, llave: almacen.llaveAvisos } : null),
    [almacen],
  );
  useEffect(() => {
    if (!casaAvisos) return;
    estadoAvisos().then(setAvisos);
    renovarAvisos(casaAvisos);
  }, [casaAvisos]);

  // Al tocar un aviso se abre la app en su pantalla (#limpieza…) o, si ya estaba abierta, el service worker lo dice
  useEffect(() => {
    const irA = (p: unknown) => {
      if (p === 'hoy' || p === 'limpieza' || p === 'cuentas' || p === 'juego' || p === 'chat') {
        setHistorial(null);
        setPantalla(p);
        window.scrollTo({ top: 0 });
      } else if (p === 'historial') {
        setHistorial({ dia: diaLocal(Date.now()), vista: 'dia' });
        window.scrollTo({ top: 0 });
      }
    };
    const h = location.hash.slice(1);
    if (['hoy', 'limpieza', 'cuentas', 'juego', 'chat', 'historial'].includes(h)) {
      irA(h);
      history.replaceState(null, '', location.pathname + location.search);
    }
    const alMensaje = (e: MessageEvent) => {
      if (e.data?.tipo === 'ir') irA(e.data.pantalla);
    };
    navigator.serviceWorker?.addEventListener('message', alMensaje);
    return () => navigator.serviceWorker?.removeEventListener('message', alMensaje);
  }, []);

  // Color de la barra de arriba del móvil (la de la hora): el cielo en la portada, el fondo en el resto.
  // En Limpieza la pone la propia pantalla: el color del cielo de la casa a esa hora.
  // La barra de gestos de abajo no la cambia esto: sale del theme_color del manifiesto (ver .nav en styles.css).
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    if (pantalla === 'limpieza' && !historial) return;
    const fondo = getComputedStyle(document.documentElement).getPropertyValue('--seran').trim();
    meta.setAttribute('content', pantalla === 'hoy' && !historial ? '#e86569' : fondo || '#edf1f6');
  }, [pantalla, tema, historial]);

  // Chat: hasta dónde se ha leído en este móvil (la primera vez, desde ahora)
  const claveLeido = `jamacasa-chat-leido-${almacen.modo}-${yo}`;
  const [leido, setLeido] = useState<number>(() => {
    const v = Number(leer(claveLeido));
    if (v) return v;
    guardar(claveLeido, String(Date.now()));
    return Date.now();
  });
  useEffect(() => {
    setLeido(Number(leer(claveLeido)) || Date.now()); // al cambiar de persona (modo prueba)
  }, [claveLeido]);
  const ultimoChat = estado.chat.mensajes[estado.chat.mensajes.length - 1]?.ts ?? 0;
  useEffect(() => {
    if (pantalla !== 'chat') return;
    const t = Math.max(Date.now(), ultimoChat);
    setLeido(t);
    guardar(claveLeido, String(t));
  }, [pantalla, ultimoChat, claveLeido]);

  // El sorteo se enseña una vez por semana en cada móvil
  const claveSorteo = `jamacasa-sorteo-${almacen.modo}`;
  const [sorteo, setSorteo] = useState(false);
  useEffect(() => {
    if (listo && estado.empezado && leer(claveSorteo) !== String(estado.semana)) setSorteo(true);
  }, [listo, estado.semana, estado.empezado]);

  const avisar = useCallback((t: string) => {
    setTostada(t);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setTostada(''), 3200);
  }, []);

  const apuntar = useCallback(
    async (tipo: TipoEvento, datos: any) => {
      try {
        const e = await almacen.apuntar(tipo, datos);
        setEventos((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
        setAhora(Date.now());
      } catch (err: any) {
        avisar(err?.message ?? 'No se pudo guardar.');
        throw err;
      }
    },
    [almacen, avisar],
  );

  const acciones: Acciones = useMemo(
    () => ({
      empezar: (semana) => apuntar('zona_empezada', { semana }),
      marcarCosa: (semana, cosa, hecha) => apuntar('zona_cosa', { semana, cosa, hecha }),
      async marcarHecho(semana, fotos, nota) {
        await apuntar('zona_hecha', { semana, fotos, nota });
        try { confetti({ particleCount: 70, spread: 65, origin: { y: 0.7 }, colors: ['#f6c14f', '#ec6b67', '#fa8f59'] }); } catch { /* nada */ }
      },
      puntuar: (t, i, nota, faltan, fotos, comentario) => apuntar('puntuacion', { semana: t.semana, de: t.miembro, intento: i.n, nota, faltan, fotos, comentario }),
      basuraLlena: (fotos) => apuntar('basura_llena', { fotos }),
      basuraSacada: () => apuntar('basura_sacada', {}),
      estoEsTuyo: (para, fotos, que) => apuntar('esto_es_tuyo', { para, fotos, que }),
      recogido: (aviso) => apuntar('recogido', { aviso }),
      gasto: (d) => apuntar('gasto', d),
      anularGasto: (id) => apuntar('gasto_anulado', { gasto: id }),
      pago: (de, a, importe, alquiler, nota) => apuntar('pago', { de, a, importe, alquiler, nota }),
      anularPago: (id) => apuntar('pago_anulado', { pago: id }),
      mensaje: (m) => apuntar('mensaje', m),
      fijar: (mensaje) => apuntar('mensaje_fijado', { mensaje }),
      borrarMensaje: (mensaje) => apuntar('mensaje_borrado', { mensaje }),
      espacioCosa: (cosa, nombre, cada) => apuntar('espacio_cosa', { cosa, nombre, cada }),
      espacioQuitar: (cosa) => apuntar('espacio_cosa_quitada', { cosa }),
      espacioHecho: (cosa) => apuntar('espacio_hecho', { cosa }),
    }),
    [apuntar],
  );

  const ctx: Ctx = {
    almacen,
    config,
    estado,
    yo,
    acciones,
    abrir: (h) => (h.tipo === 'sorteo' ? setSorteo(true) : setHoja(h)),
    cerrar: () => setHoja(null),
    ir: (p) => { setHistorial(null); setPantalla(p); window.scrollTo({ top: 0 }); },
    eventos,
    ahora,
    abrirHistorial: (dia, vista = 'dia') => { setHoja(null); setHistorial({ dia: dia ?? diaLocal(ahora), vista }); window.scrollTo({ top: 0 }); },
    avisar,
    cambiarYo: (m) => { almacen.cambiarYo?.(m); setYo(m); },
    tema,
    cambiarTema,
    reiniciarPrueba: () => { almacen.reiniciar?.(); cargar(); avisar('Prueba reiniciada con el mes de ejemplo.'); },
    salir,
    avisos,
    async activarAvisos() {
      if (!casaAvisos) return;
      try {
        const e = await pedirAvisos(casaAvisos);
        setAvisos(e);
        if (e === 'activos') avisar('Avisos activados en este móvil.');
        if (e === 'bloqueados') avisar('El móvil tiene bloqueados los avisos de la app.');
      } catch (err: any) {
        avisar(err?.message ?? 'No se pudieron activar los avisos.');
      }
    },
    async probarAvisos() {
      await apuntar('aviso_prueba', {});
      avisar('Aviso de prueba enviado: te llegará en unos segundos.');
    },
  };
  const nuevosChat = pantalla === 'chat' ? 0 : sinLeer(estado.chat, yo, leido);
  const pendientes = paraPuntuar(estado, yo).length + tuyosAbiertos(estado, yo).length + (estado.basura === yo ? avisosBasuraAbiertos(estado).length : 0);

  if (!listo) return <div className="puerta" aria-busy="true" />;

  return (
    <Contexto.Provider value={ctx}>
      {almacen.modo === 'prueba' && (
        <div className="banda-prueba" role="note">Modo prueba con datos inventados. Toca tu muñeco de arriba para cambiar de persona.</div>
      )}
      {errorCarga && <div className="banda-prueba" role="alert" style={{ background: 'var(--vermello-suave)', color: 'var(--vermello)' }}>{errorCarga}</div>}
      <div className="app">
        {historial ? (
          <Historial dia={historial.dia} vista={historial.vista} onCerrar={() => { setHistorial(null); window.scrollTo({ top: 0 }); }} />
        ) : (
          <>
            {pantalla === 'hoy' && <Hoy />}
            {pantalla === 'limpieza' && <Limpieza />}
            {pantalla === 'cuentas' && <Cuentas />}
            {pantalla === 'juego' && <Juego />}
            {pantalla === 'chat' && <Chat />}
          </>
        )}
      </div>
      <nav className="nav" aria-label="Secciones">
        <div className="nav-dentro">
          {([
            ['hoy', 'Hoy', House],
            ['limpieza', 'Limpieza', Sparkles],
            ['cuentas', 'Cuentas', Wallet],
            ['juego', 'Ranking', Trophy],
            ['chat', 'Chat', MessageCircle],
          ] as const).map(([id, texto, Icono]) => (
            <button key={id} type="button" aria-current={pantalla === id ? 'page' : undefined} onClick={() => ctx.ir(id)}>
              <Icono size={22} strokeWidth={pantalla === id ? 2.4 : 1.9} />
              {texto}
              {id === 'hoy' && pendientes > 0 && <span className="globo">{pendientes}</span>}
              {id === 'chat' && nuevosChat > 0 && <span className="globo">{nuevosChat > 99 ? '99+' : nuevosChat}</span>}
            </button>
          ))}
        </div>
      </nav>
      {hoja && <Hojas hoja={hoja} />}
      {sorteo && <Sorteo onCerrar={() => { setSorteo(false); guardar(claveSorteo, String(estado.semana)); }} />}
      {tostada && <div className="tostada" role="status">{tostada}</div>}
    </Contexto.Provider>
  );
}
