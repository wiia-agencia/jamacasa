import { Camera, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { nota } from '../core/noticias';
import type { MiembroId } from '../core/tipos';
import figuraEscala from '../assets/figura-escala.png';
import figuraMortal from '../assets/figura-mortal.png';
import figuraPino from '../assets/figura-pino.png';
import { claseColor, miembro, useCasa } from './contexto';

const FIGURAS: Record<string, string> = { pino: figuraPino, mortal: figuraMortal, escala: figuraEscala };

export function Figura({ figura, letra }: { figura?: string; letra: string }) {
  const img = figura ? FIGURAS[figura] : undefined;
  if (!img) return <>{letra}</>;
  return <span className="figura" style={{ ['--fig' as any]: `url("${img}")` }} aria-hidden="true" />;
}

export function Avatar({ id, tam = '', corona = false, onClick }: { id: MiembroId; tam?: '' | 's' | 'l' | 'punto'; corona?: boolean; onClick?: () => void }) {
  const { config } = useCasa();
  const m = miembro(config, id);
  const clase = `avatar ${tam} ${claseColor(m.color)} ${corona ? 'corona' : ''}`;
  const dentro = tam === 'punto' ? null : <Figura figura={m.figura} letra={m.nombre.slice(0, 1)} />;
  if (onClick) {
    return (
      <button type="button" className={clase} onClick={onClick} aria-label={`${m.nombre}: ajustes`}>
        {dentro}
      </button>
    );
  }
  return (
    <span className={clase} role={tam === 'punto' ? undefined : 'img'} aria-label={tam === 'punto' ? undefined : m.nombre} aria-hidden={tam === 'punto' ? true : undefined}>
      {dentro}
    </span>
  );
}

export function Nombre({ id }: { id: MiembroId }) {
  const { config } = useCasa();
  return <>{miembro(config, id).nombre}</>;
}

/** Nota en formato marcador de gimnasia. */
export function Placa({ valor, peq = false, suspensa = false, auto = false, etiqueta }: { valor: number; peq?: boolean; suspensa?: boolean; auto?: boolean; etiqueta?: string }) {
  return (
    <span className={`placa ${peq ? 'peq' : ''} ${suspensa ? 'suspensa' : ''} ${auto ? 'auto' : ''}`} aria-label={etiqueta ?? `Nota ${nota(valor)}`}>
      <span className="cifra">{nota(valor)}</span>
    </span>
  );
}

export function Puntos({ valor }: { valor: number }) {
  const signo = valor > 0 ? '+' : valor < 0 ? '−' : '';
  return <span className={`puntos-signo ${valor > 0 ? 'mas' : valor < 0 ? 'menos' : ''}`}>{signo}{nota(Math.abs(valor))}</span>;
}

export function Hoja({ titulo, subtitulo, children, pie, onCerrar }: { titulo: ReactNode; subtitulo?: ReactNode; children: ReactNode; pie?: ReactNode; onCerrar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = anterior;
    };
  }, [onCerrar]);
  return (
    <div className="velo" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="hoja" role="dialog" aria-modal="true">
        <div className="asa" />
        <div className="hoja-cabeza margen">
          <div className="crece" style={{ flex: 1, minWidth: 0 }}>
            <h2 className="display">{titulo}</h2>
            {subtitulo && <p className="suave peq" style={{ marginTop: 6 }}>{subtitulo}</p>}
          </div>
          <button type="button" className="icono-boton" onClick={onCerrar} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="hoja-cuerpo margen">{children}</div>
        {pie && <div className="hoja-pie margen">{pie}</div>}
      </div>
    </div>
  );
}

const cacheUrls = new Map<string, string>();

export function FotoRef({ ref_, grande = false, onQuitar }: { ref_: string; grande?: boolean; onQuitar?: () => void }) {
  const { almacen } = useCasa();
  const [url, setUrl] = useState(cacheUrls.get(ref_) ?? '');
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (!cacheUrls.has(ref_)) {
      almacen.urlFoto(ref_).then((u) => {
        if (!u) return;
        if (!ref_.startsWith('sb:')) cacheUrls.set(ref_, u);
        if (vivo) setUrl(u);
      });
    }
    return () => { vivo = false; };
  }, [ref_, almacen]);
  return (
    <>
      <div className={`foto ${grande ? 'grande' : ''}`}>
        <button type="button" className="foto-ver" onClick={() => url && setAbierta(true)} aria-label="Ver foto">
          {url && <img src={url} alt="" loading="lazy" />}
        </button>
        {onQuitar && (
          <button type="button" className="quitar" aria-label="Quitar foto" onClick={onQuitar}>
            <X size={15} />
          </button>
        )}
      </div>
      {abierta && (
        <div className="visor" onClick={() => setAbierta(false)} role="dialog" aria-label="Foto">
          <img src={url} alt="" />
        </div>
      )}
    </>
  );
}

/** Añadir fotos: sube cada una al momento y devuelve las referencias. */
export function SelectorFotos({ fotos, cambiar, max = 4, texto = 'Añadir foto' }: { fotos: string[]; cambiar: (f: string[]) => void; max?: number; texto?: string }) {
  const { almacen } = useCasa();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState('');
  const elegir = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setError('');
    const archivos = [...lista].slice(0, max - fotos.length);
    setSubiendo(archivos.length);
    const nuevas: string[] = [];
    for (const a of archivos) {
      try {
        nuevas.push(await almacen.subirFoto(a));
      } catch (e: any) {
        setError(e?.message ?? 'No se pudo subir la foto.');
      }
      setSubiendo((n) => n - 1);
    }
    cambiar([...fotos, ...nuevas]);
    if (entrada.current) entrada.current.value = '';
  };
  return (
    <div className="pila-s">
      <div className="fotos">
        {fotos.map((f) => (
          <FotoRef key={f} ref_={f} onQuitar={() => cambiar(fotos.filter((x) => x !== f))} />
        ))}
        {subiendo > 0 && <div className="foto-nueva">Subiendo…</div>}
        {fotos.length + subiendo < max && (
          <button type="button" className="foto-nueva" onClick={() => entrada.current?.click()}>
            <Camera size={22} />
            {texto}
          </button>
        )}
      </div>
      <input ref={entrada} type="file" accept="image/*" multiple hidden onChange={(e) => elegir(e.target.files)} />
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function Seccion({ titulo, extra, children }: { titulo: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="pila-s">
      <div className="cabecera-seccion">
        <h2 className="titulo-seccion">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

/** Botón que muestra "Guardando…" mientras dura la acción y no deja pulsar dos veces. */
export function BotonAccion({ hacer, children, clase = 'boton ancho', desactivado = false }: { hacer: () => Promise<void> | void; children: ReactNode; clase?: string; desactivado?: boolean }) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <button
      type="button"
      className={clase}
      disabled={ocupado || desactivado}
      onClick={async () => {
        setOcupado(true);
        try { await hacer(); } finally { setOcupado(false); }
      }}
    >
      {ocupado ? 'Guardando…' : children}
    </button>
  );
}
