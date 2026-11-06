import confetti from 'canvas-confetti';
import { House, Sparkles, Trophy, Wallet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { avisosBasuraAbiertos, derivar, paraPuntuar, tuyosAbiertos } from './core/estado';
import type { Evento, MiembroId, TipoEvento } from './core/tipos';
import type { Almacen } from './datos/almacen';
import { abrirCasa, casaDisponible } from './datos/casa';
import { almacenPrueba, configPrueba } from './datos/prueba';
import { Contexto, type Acciones, type Ctx, type Hoja, type Pantalla } from './ui/contexto';
import { Cuentas } from './ui/Cuentas';
import { Entrada } from './ui/Entrada';
import { Hojas } from './ui/hojas';
import { Hoy } from './ui/Hoy';
import { Juego } from './ui/Juego';
import { Limpieza } from './ui/Limpieza';
import { Sorteo } from './ui/Sorteo';

type Tema = 'auto' | 'claro' | 'oscuro';

const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

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

  // Color de la barra del móvil: el cielo en la portada, el fondo en el resto
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const fondo = getComputedStyle(document.documentElement).getPropertyValue('--seran').trim();
    meta.setAttribute('content', pantalla === 'hoy' ? '#e86569' : fondo || '#edf1f6');
  }, [pantalla, tema]);

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
    ir: (p) => { setPantalla(p); window.scrollTo({ top: 0 }); },
    avisar,
    cambiarYo: (m) => { almacen.cambiarYo?.(m); setYo(m); },
    tema,
    cambiarTema,
    reiniciarPrueba: () => { almacen.reiniciar?.(); cargar(); avisar('Prueba reiniciada con el mes de ejemplo.'); },
    salir,
  };
  const pendientes = paraPuntuar(estado, yo).length + tuyosAbiertos(estado, yo).length + (estado.basura === yo ? avisosBasuraAbiertos(estado).length : 0);

  if (!listo) return <div className="puerta" aria-busy="true" />;

  return (
    <Contexto.Provider value={ctx}>
      {almacen.modo === 'prueba' && (
        <div className="banda-prueba" role="note">Modo prueba con datos inventados. Toca tu muñeco de arriba para cambiar de persona.</div>
      )}
      {errorCarga && <div className="banda-prueba" role="alert" style={{ background: 'var(--vermello-suave)', color: 'var(--vermello)' }}>{errorCarga}</div>}
      <div className="app">
        {pantalla === 'hoy' && <Hoy />}
        {pantalla === 'limpieza' && <Limpieza />}
        {pantalla === 'cuentas' && <Cuentas />}
        {pantalla === 'juego' && <Juego />}
      </div>
      <nav className="nav" aria-label="Secciones">
        <div className="nav-dentro">
          {([
            ['hoy', 'Hoy', House],
            ['limpieza', 'Limpieza', Sparkles],
            ['cuentas', 'Cuentas', Wallet],
            ['juego', 'Juego', Trophy],
          ] as const).map(([id, texto, Icono]) => (
            <button key={id} type="button" aria-current={pantalla === id ? 'page' : undefined} onClick={() => ctx.ir(id)}>
              <Icono size={22} strokeWidth={pantalla === id ? 2.4 : 1.9} />
              {texto}
              {id === 'hoy' && pendientes > 0 && <span className="globo">{pendientes}</span>}
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
