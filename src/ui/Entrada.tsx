import { Delete } from 'lucide-react';
import { useEffect, useState } from 'react';
import portada from '../assets/portada.webp';
import type { Config, MiembroId } from '../core/tipos';
import { casaDisponible, entrarEnLaCasa, miembrosDeLaCasa, type MiembroPuerta } from '../datos/casa';
import { leerInvitacion, olvidarInvitacion } from '../datos/invitacion';
import { claseColor } from './contexto';
import { Figura } from './piezas';

type Paso = 'inicio' | 'codigo' | 'quien' | 'pin';

export function Entrada({ configPrueba, entrarPrueba, entrarCasa }: { configPrueba: Config; entrarPrueba: (yo: MiembroId) => void; entrarCasa: () => void }) {
  const hayCasa = !__VISTA__ && casaDisponible();
  const [paso, setPaso] = useState<Paso>('inicio');
  const [codigo, setCodigo] = useState(() => (hayCasa ? leerInvitacion() : ''));
  // Si el enlace se abre con la app ya abierta, la página no se recarga: escuchamos el cambio
  useEffect(() => {
    if (!hayCasa) return;
    const alCambiar = () => { const c = leerInvitacion(); if (c) setCodigo(c); };
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, [hayCasa]);
  const [miembros, setMiembros] = useState<MiembroPuerta[]>([]);
  const [quien, setQuien] = useState<MiembroPuerta | null>(null);
  const [pin, setPin] = useState('');
  const [primerPin, setPrimerPin] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const pedirMiembros = async () => {
    setError('');
    setOcupado(true);
    try {
      setMiembros(await miembrosDeLaCasa(codigo));
      setPaso('quien');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const pulsar = async (d: string) => {
    if (ocupado) return;
    setError('');
    const nuevo = (pin + d).slice(0, 4);
    setPin(nuevo);
    if (nuevo.length < 4 || !quien) return;
    if (!quien.tienePin && !primerPin) {
      setPrimerPin(nuevo);
      setPin('');
      return;
    }
    if (!quien.tienePin && primerPin !== nuevo) {
      setError('No coinciden. Vuelve a crear tu PIN.');
      setPrimerPin('');
      setPin('');
      return;
    }
    setOcupado(true);
    try {
      await entrarEnLaCasa(codigo, quien.id, nuevo);
      olvidarInvitacion();
      entrarCasa();
    } catch (e: any) {
      setError(e.message);
      setPin('');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <main className="puerta pila">
      <header className="portada">
        <img src={portada} alt="La Jamacasa al atardecer con los tres jamaos" />
      </header>
      <div className="margen pila">
        <div className="pila-s">
          <h1 className="display">La Jamacasa</h1>
          <p className="suave">Quién limpia qué, quién debe qué y quién va ganando en la casa de los jamaos.</p>
        </div>

        {paso === 'inicio' && !hayCasa && (
          <div className="pila-s">
            <p className="negrita">¿Quién eres?</p>
            <div className="personas">
              {configPrueba.miembros.map((m) => (
                <button key={m.id} type="button" className="persona" onClick={() => entrarPrueba(m.id)}>
                  <span className={`avatar l ${claseColor(m.color)}`}><Figura figura={m.figura} letra={m.nombre.slice(0, 1)} /></span>
                  {m.nombre}
                </button>
              ))}
            </div>
            <p className="tenue peq">Vista previa con un mes inventado para que lo toques todo. Puedes cambiar de persona cuando quieras tocando tu muñeco, arriba a la derecha.</p>
          </div>
        )}

        {paso === 'inicio' && hayCasa && (
          <div className="pila-s">
            <button type="button" className="boton ancho" onClick={() => setPaso('codigo')}>Entrar en la casa</button>
            <p className="tenue peq">Necesitas el código de la casa. Te lo pasa uno de los jamaos.</p>
            <button type="button" className="enlace" style={{ alignSelf: 'flex-start' }} onClick={() => entrarPrueba(configPrueba.miembros[0].id)}>
              Ver antes una prueba con datos inventados
            </button>
          </div>
        )}

        {paso === 'codigo' && (
          <form
            className="pila-s"
            onSubmit={(e) => { e.preventDefault(); if (codigo.trim()) pedirMiembros(); }}
          >
            <div className="campo">
              <label htmlFor="codigo">Código de la casa</label>
              <input id="codigo" className="entrada" autoCapitalize="none" autoComplete="off" spellCheck={false} value={codigo} onChange={(e) => setCodigo(e.target.value.toLowerCase())} placeholder="jama-xxxx-xxxx" />
              <p className="tenue peq">{codigo ? 'Ya está puesto el de tu invitación.' : 'Está en el mensaje de invitación: empieza por «jama-».'}</p>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="boton ancho" disabled={!codigo.trim() || ocupado}>{ocupado ? 'Comprobando…' : 'Seguir'}</button>
          </form>
        )}

        {paso === 'quien' && (
          <div className="pila-s">
            <p className="negrita">¿Quién eres?</p>
            <div className="personas">
              {miembros.map((m) => (
                <button key={m.id} type="button" className="persona" onClick={() => { setQuien(m); setPin(''); setPrimerPin(''); setPaso('pin'); }}>
                  <span className={`avatar l ${claseColor(m.color)}`}><Figura figura={m.figura} letra={m.nombre.slice(0, 1)} /></span>
                  {m.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {paso === 'pin' && quien && (
          <div className="pila-s">
            <p className="negrita">
              {quien.tienePin ? `Tu PIN, ${quien.nombre}` : primerPin ? 'Repite tu PIN' : `Crea tu PIN, ${quien.nombre}`}
            </p>
            {!quien.tienePin && !primerPin && <p className="tenue peq">Cuatro números. Te lo pedirá si entras desde otro móvil.</p>}
            <div className="pin-puntos" aria-label={`${pin.length} de 4`}>
              {[0, 1, 2, 3].map((k) => <span key={k} className={k < pin.length ? 'lleno' : ''} />)}
            </div>
            {error && <p className="error" role="alert" style={{ textAlign: 'center' }}>{error}</p>}
            <div className="pin">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} type="button" onClick={() => pulsar(d)}>{d}</button>
              ))}
              <button type="button" onClick={() => { setPaso('quien'); setError(''); }} style={{ fontSize: '0.95rem' }}>Volver</button>
              <button type="button" onClick={() => pulsar('0')}>0</button>
              <button type="button" onClick={() => setPin(pin.slice(0, -1))} aria-label="Borrar"><Delete size={22} /></button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
