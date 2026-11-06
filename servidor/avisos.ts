// Función de Vercel que manda los avisos al móvil. api/avisos.js se genera desde aquí
// con «npm run servidor» (un solo archivo, con las reglas de src/core dentro): no se edita a mano.
//
// La llama la base de datos: cada vez que alguien apunta algo ({ tipo: 'evento', id }) y cada
// hora ({ tipo: 'reloj' }), siempre con la clave de los avisos en la cabecera x-clave. Con esa
// clave pide a Supabase lo apuntado, las direcciones de avisos y la llave que firma; sin ella,
// Supabase no da nada. Esta función no guarda nada.
import webpush from 'web-push';
import { avisosDeEvento, avisosDelReloj, type Aviso } from '../src/core/avisos';
import { HORA } from '../src/core/tiempo';
import type { Config, Evento } from '../src/core/tipos';
import { SUPABASE, VAPID_PUBLICA } from '../src/conexion';

export interface Suscripcion { endpoint: string; miembro: string; p256dh: string; auth: string }
type Enviar = (s: Suscripcion, cuerpo: string, privada: string) => Promise<void>;

async function rpc(fn: string, args: object): Promise<any> {
  const r = await fetch(`${SUPABASE.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE.clave, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw Object.assign(new Error(`${fn}: ${r.status}`), { estado: r.status });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const enviarWebPush: Enviar = async (s, cuerpo, privada) => {
  await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo, {
    vapidDetails: { subject: 'https://jamacasa.vercel.app', publicKey: VAPID_PUBLICA, privateKey: privada },
    TTL: 24 * 3600,
    urgency: 'high',
  });
};

/** Manda cada aviso a todos los móviles de esa persona. Devuelve las direcciones que ya no existen. */
export async function mandar(avisos: Aviso[], suscripciones: Suscripcion[], privada: string, enviar: Enviar = enviarWebPush) {
  let enviados = 0;
  let fallidos = 0;
  const muertas: string[] = [];
  await Promise.all(
    avisos.flatMap((a) =>
      suscripciones
        .filter((s) => s.miembro === a.para)
        .map(async (s) => {
          try {
            await enviar(s, JSON.stringify({ titulo: a.titulo, texto: a.texto, pantalla: a.pantalla, etiqueta: a.etiqueta }), privada);
            enviados++;
          } catch (e: any) {
            if (e?.statusCode === 404 || e?.statusCode === 410) muertas.push(s.endpoint);
            else fallidos++;
          }
        }),
    ),
  );
  return { enviados, fallidos, muertas };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'solo POST' });
  const clave = String(req.headers?.['x-clave'] ?? '');
  if (clave.length < 20) return res.status(401).json({ error: 'clave' });

  let datos: any;
  try {
    datos = await rpc('jc_avisos_datos', { p_clave: clave });
  } catch (e: any) {
    // Supabase dice que no a una clave mala (400) o no responde
    return res.status(e?.estado && e.estado < 500 ? 401 : 502).json({ error: 'datos' });
  }
  if (!datos?.config || !datos.vapid) return res.status(200).json({ avisos: 0, nota: 'sin configurar' });

  let cuerpo: any = req.body ?? {};
  if (typeof cuerpo === 'string') {
    try { cuerpo = JSON.parse(cuerpo || '{}'); } catch { cuerpo = {}; }
  }
  const config: Config = {
    ...datos.config,
    miembros: (datos.miembros ?? []).map((m: any) => ({ id: m.id, nombre: m.nombre, color: m.color, figura: m.figura ?? undefined })),
  };
  const eventos: Evento[] = (datos.eventos ?? []).map((e: any) => ({ id: e.id, ts: Number(e.ts), autor: e.autor, tipo: e.tipo, datos: e.datos ?? {} }));

  const ahora = Date.now();
  let avisos: Aviso[] = [];
  if (cuerpo.tipo === 'evento' && typeof cuerpo.id === 'string') {
    avisos = avisosDeEvento(config, eventos, cuerpo.id);
  } else if (cuerpo.tipo === 'reloj') {
    // La hora en punto que acaba de pasar: así no se repite ni se salta nada aunque el reloj se retrase
    const hasta = Math.floor(ahora / HORA) * HORA;
    avisos = avisosDelReloj(config, eventos, hasta - HORA, hasta, ahora);
  }

  const r = await mandar(avisos, datos.suscripciones ?? [], datos.vapid);
  if (r.muertas.length) await rpc('jc_avisos_quitar', { p_clave: clave, p_endpoints: r.muertas }).catch(() => {});
  return res.status(200).json({ avisos: avisos.length, enviados: r.enviados, fallidos: r.fallidos, quitadas: r.muertas.length });
}
