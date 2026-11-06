// Avisos al móvil, en el móvil: pedir permiso, apuntar este móvil y renovarlo.
// El aviso en sí lo pinta el service worker (public/sw.js) y lo manda la función api/avisos.
// La llave pública con la que se apunta el móvil la da la casa (la crea la propia app la primera vez).

/**
 * 'no': este navegador no puede (o es la vista previa) ·
 * 'apagados': puede, pero aún no se han activado en este móvil ·
 * 'activos': llegan a este móvil ·
 * 'bloqueados': se dijo que no al permiso y hay que activarlo en los ajustes del móvil.
 */
export type EstadoAvisos = 'no' | 'apagados' | 'activos' | 'bloqueados';

export interface DatosSuscripcion { endpoint: string; p256dh: string; auth: string }
/** Lo que pone la casa: dónde guardar la dirección de este móvil y cuál es la llave pública. */
export interface CasaAvisos {
  guardar: (s: DatosSuscripcion) => Promise<void>;
  llave: () => Promise<string | null>;
}
const NO_LISTOS = 'Los avisos aún no están listos en la casa: se activarán solos en cuanto lo estén.';

export function avisosPosibles(): boolean {
  return (
    !__VISTA__ &&
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function bytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob(b64);
  const r = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) r[i] = bin.charCodeAt(i);
  return r;
}

function aTexto(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  let s = '';
  for (const x of new Uint8Array(buf)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function datosDe(sub: PushSubscription): DatosSuscripcion {
  return { endpoint: sub.endpoint, p256dh: aTexto(sub.getKey('p256dh')), auth: aTexto(sub.getKey('auth')) };
}

/** ¿La suscripción es de nuestra llave? (si un día se cambia la llave, hay que hacer otra) */
function esNuestra(sub: PushSubscription, llave: string): boolean {
  const k = sub.options?.applicationServerKey;
  return !k || aTexto(k) === llave;
}

async function registro(): Promise<ServiceWorkerRegistration> {
  const r = await navigator.serviceWorker.getRegistration();
  if (r) return navigator.serviceWorker.ready;
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export async function estadoAvisos(): Promise<EstadoAvisos> {
  if (!avisosPosibles()) return 'no';
  if (Notification.permission === 'denied') return 'bloqueados';
  if (Notification.permission !== 'granted') return 'apagados';
  try {
    const r = await navigator.serviceWorker.getRegistration();
    const sub = await r?.pushManager.getSubscription();
    return sub ? 'activos' : 'apagados';
  } catch {
    return 'apagados';
  }
}

async function suscripcion(llave: string): Promise<PushSubscription> {
  const r = await registro();
  let sub = await r.pushManager.getSubscription();
  if (sub && !esNuestra(sub, llave)) {
    await sub.unsubscribe();
    sub = null;
  }
  return sub ?? r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(llave) });
}

/** Pide permiso (tiene que ir después de un toque) y apunta este móvil en la casa. */
export async function activarAvisos(casa: CasaAvisos): Promise<EstadoAvisos> {
  if (!avisosPosibles()) return 'no';
  const permiso = await Notification.requestPermission();
  if (permiso === 'denied') return 'bloqueados';
  if (permiso !== 'granted') return 'apagados';
  const llave = await casa.llave();
  if (!llave) throw new Error(NO_LISTOS);
  await casa.guardar(datosDe(await suscripcion(llave)));
  return 'activos';
}

/** Al abrir la app: si ya hay permiso, vuelve a apuntar este móvil (el navegador a veces cambia la dirección). */
export async function renovarAvisos(casa: CasaAvisos): Promise<void> {
  if (!avisosPosibles() || Notification.permission !== 'granted') return;
  try {
    const llave = await casa.llave();
    if (llave) await casa.guardar(datosDe(await suscripcion(llave)));
  } catch {
    /* sin conexión: ya se hará la próxima vez */
  }
}

/** Al salir de la casa en este móvil: deja de recibir avisos. Devuelve la dirección que tenía. */
export async function apagarAvisos(): Promise<string | null> {
  if (!avisosPosibles()) return null;
  try {
    const r = await navigator.serviceWorker.getRegistration();
    const sub = await r?.pushManager.getSubscription();
    if (!sub) return null;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    return endpoint;
  } catch {
    return null;
  }
}
