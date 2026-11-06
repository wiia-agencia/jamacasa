// La casa de verdad: base de datos compartida en Supabase.
// Seguridad: cada móvil entra con el código de la casa y el PIN de su persona;
// la base de datos solo deja leer y escribir a los móviles que han entrado así,
// y apunta cada cosa a nombre de quien la hace (nadie puede firmar por otro).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config, Evento, Miembro, MiembroId } from '../core/tipos';
import { SUPABASE } from '../conexion';
import { comprimirFoto, nuevoId, type Almacen } from './almacen';
import { apagarAvisos } from './avisos';

let cliente: SupabaseClient | null = null;

export const casaDisponible = () => Boolean(SUPABASE.url && SUPABASE.clave);

function sb(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(SUPABASE.url, SUPABASE.clave, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'jamacasa-sesion' },
    });
  }
  return cliente;
}

async function sesion(): Promise<void> {
  const { data } = await sb().auth.getSession();
  if (data.session) return;
  const { error } = await sb().auth.signInAnonymously();
  if (error) throw new Error('No se pudo conectar con la casa. Revisa la conexión y vuelve a probar.');
}

export interface MiembroPuerta { id: MiembroId; nombre: string; color: string; figura?: string; tienePin: boolean }

const mensajes: Record<string, string> = {
  codigo: 'Ese código no es el de la casa. Revisa que esté bien escrito.',
  pin: 'Ese PIN no es correcto.',
  bloqueado: 'Demasiados intentos con ese PIN. Espera 15 minutos y vuelve a probar.',
  pin_formato: 'El PIN tiene que tener de 4 a 8 números.',
};
const traducir = (e: any) => new Error(mensajes[String(e?.message ?? '').trim()] ?? 'Algo ha fallado al hablar con la casa. Vuelve a probar en un momento.');

/** Paso 1 de la puerta: con el código, ver quién vive en la casa. */
export async function miembrosDeLaCasa(codigo: string): Promise<MiembroPuerta[]> {
  await sesion();
  const { data, error } = await sb().rpc('jc_miembros', { p_codigo: codigo.trim() });
  if (error) throw traducir(error);
  return (data as any[]).map((m) => ({ id: m.id, nombre: m.nombre, color: m.color, figura: m.figura ?? undefined, tienePin: m.tiene_pin }));
}

/** Paso 2: elegir quién eres y poner tu PIN (la primera vez, lo creas). */
export async function entrarEnLaCasa(codigo: string, miembro: MiembroId, pin: string): Promise<void> {
  await sesion();
  const { data, error } = await sb().rpc('jc_unirse', { p_codigo: codigo.trim(), p_miembro: miembro, p_pin: pin });
  if (error) throw traducir(error);
  if (data !== 'ok') throw traducir({ message: data });
}

/** ¿Este móvil ya entró? Devuelve el almacén de la casa o null. */
export async function abrirCasa(): Promise<Almacen | null> {
  if (!casaDisponible()) return null;
  const { data: s } = await sb().auth.getSession();
  if (!s.session) return null;
  const { data: yo, error } = await sb().rpc('jc_yo');
  if (error || !yo) return null;

  const [{ data: casa, error: e1 }, { data: miembros, error: e2 }] = await Promise.all([
    sb().from('jc_casa').select('config').eq('id', 1).single(),
    sb().from('jc_miembros').select('id,nombre,color,figura,orden').order('orden'),
  ]);
  if (e1 || e2 || !casa) throw new Error('No se pudo abrir la casa. Vuelve a probar en un momento.');
  const config: Config = { ...(casa.config as Config), miembros: (miembros as any[]).map((m): Miembro => ({ id: m.id, nombre: m.nombre, color: m.color, figura: m.figura ?? undefined })) };

  const aEvento = (r: any): Evento => ({ id: r.id, ts: new Date(r.ts).getTime(), autor: r.autor, tipo: r.tipo, datos: r.datos ?? {} });
  const urls = new Map<string, { url: string; caduca: number }>();

  return {
    modo: 'casa',
    config,
    yo: yo as string,
    async cargarEventos() {
      const todos: Evento[] = [];
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await sb().from('jc_eventos').select('*').order('ts').range(desde, desde + 999);
        if (error) throw new Error('No se pudieron cargar los datos de la casa.');
        todos.push(...(data ?? []).map(aEvento));
        if (!data || data.length < 1000) break;
      }
      return todos;
    },
    escuchar(alLlegar) {
      const canal = sb()
        .channel('jc-eventos')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jc_eventos' }, (p) => alLlegar(aEvento(p.new)))
        .subscribe();
      return () => { sb().removeChannel(canal); };
    },
    async apuntar(tipo, datos) {
      const { data, error } = await sb().from('jc_eventos').insert({ id: nuevoId(), tipo, datos }).select().single();
      if (error) throw new Error('No se pudo guardar. Revisa la conexión y vuelve a probar.');
      return aEvento(data);
    },
    async subirFoto(archivo) {
      const foto = await comprimirFoto(archivo);
      const ruta = `${yo}/${nuevoId()}.jpg`;
      const { error } = await sb().storage.from('jc-fotos').upload(ruta, foto, { contentType: 'image/jpeg' });
      if (error) throw new Error('No se pudo subir la foto. Vuelve a probar.');
      return `sb:${ruta}`;
    },
    async urlFoto(ref) {
      if (!ref.startsWith('sb:')) return ref;
      const c = urls.get(ref);
      if (c && c.caduca > Date.now()) return c.url;
      const { data } = await sb().storage.from('jc-fotos').createSignedUrl(ref.slice(3), 3600);
      const url = data?.signedUrl ?? '';
      urls.set(ref, { url, caduca: Date.now() + 50 * 60 * 1000 });
      return url;
    },
    async llaveAvisos() {
      const { data, error } = await sb().rpc('jc_vapid_publica');
      return error ? null : ((data as string | null) ?? null);
    },
    async suscribir(x) {
      const { error } = await sb().rpc('jc_suscribir', { p_endpoint: x.endpoint, p_p256dh: x.p256dh, p_auth: x.auth });
      // PGRST202: la casa aún no tiene la parte de los avisos (falta pegar el SQL). Este móvil ya
      // tiene el permiso, así que se apuntará solo al abrir la app cuando esté.
      if (error?.code === 'PGRST202') throw new Error('Los avisos aún no están listos en la casa: se activarán solos en cuanto lo estén.');
      if (error) throw new Error('No se pudieron activar los avisos. Vuelve a probar en un momento.');
    },
    async salir() {
      // Este móvil deja de recibir los avisos de esta persona
      const endpoint = await apagarAvisos();
      if (endpoint) await sb().rpc('jc_desuscribir', { p_endpoint: endpoint });
      await sb().rpc('jc_salir');
      await sb().auth.signOut();
    },
  };
}
