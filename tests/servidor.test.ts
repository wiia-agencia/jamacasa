// Prueba la función de los avisos tal cual se sube a Vercel (api/avisos.js): pide los datos a una
// Supabase de pega, calcula a quién avisar y manda el aviso cifrado a un «servicio de avisos»
// local, que lo descifra como lo haría el móvil. Así se comprueba la firma y el cifrado de verdad.
import { execFileSync } from 'node:child_process';
import { createECDH, createPublicKey, randomBytes, verify } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { VAPID_PUBLICA } from '../src/conexion';
import { instanteLocal } from '../src/core/tiempo';

const require = createRequire(import.meta.url);
const ece = require('http_ece');
const webpush = require('web-push');

const dir = mkdtempSync(join(tmpdir(), 'jc-avisos-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });

// El móvil de Bea: sus llaves de avisos
const movil = createECDH('prime256v1');
movil.generateKeys();
const auth = randomBytes(16);
const vapidPrueba = webpush.generateVAPIDKeys();

const recibidos: { url: string; headers: any; cuerpo: any }[] = [];
const servidor = createServer({ key: readFileSync(join(dir, 'k.pem')), cert: readFileSync(join(dir, 'c.pem')) }, (req, res) => {
  const trozos: Buffer[] = [];
  req.on('data', (t) => trozos.push(t));
  req.on('end', () => {
    if (req.url === '/push/vieja') {
      res.writeHead(410).end();
      return;
    }
    const claro = ece.decrypt(Buffer.concat(trozos), { version: 'aes128gcm', privateKey: movil, authSecret: auth });
    recibidos.push({ url: req.url!, headers: req.headers, cuerpo: JSON.parse(claro.toString('utf8')) });
    res.writeHead(201).end();
  });
});
let puerto = 0;
const quitadas: string[][] = [];

const t0 = instanteLocal(2026, 10, 6, 10);
const datos = () => ({
  config: {
    nombre: 'Casa de prueba',
    inicio: '2026-10-05',
    semilla: 2026,
    zonas: [
      { id: 'abajo', nombre: 'Piso de abajo', incluye: '', checklist: [] },
      { id: 'medio', nombre: 'Piso del medio', incluye: '', checklist: [] },
      { id: 'arriba', nombre: 'Piso de arriba', incluye: '', checklist: [] },
    ],
    alquiler: { total: 134500, paga: 'b', partes: { a: 42500, c: 39000, b: 53000 }, dia: 10, desde: '2026-10' },
    facturas: [],
  },
  miembros: [
    { id: 'a', nombre: 'Ana', color: 'naranja', figura: null },
    { id: 'b', nombre: 'Bea', color: 'verde', figura: null },
    { id: 'c', nombre: 'Cris', color: 'azul', figura: null },
  ],
  eventos: [{ id: 'ev-1', ts: t0, autor: 'a', tipo: 'esto_es_tuyo', datos: { para: 'b', que: 'las pesas' } }],
  suscripciones: [
    { endpoint: `https://localhost:${puerto}/push/bea`, miembro: 'b', p256dh: movil.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
    { endpoint: `https://localhost:${puerto}/push/vieja`, miembro: 'b', p256dh: movil.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
    { endpoint: `https://localhost:${puerto}/push/cris`, miembro: 'c', p256dh: movil.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
  ],
  vapid: vapidPrueba.privateKey,
});

beforeAll(async () => {
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', () => ok()));
  puerto = (servidor.address() as any).port;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // el servicio de avisos de pega usa un certificado propio
  vi.stubGlobal('fetch', async (url: string, op: any) => {
    const args = JSON.parse(op.body);
    if (String(url).endsWith('/rpc/jc_avisos_datos')) {
      if (args.p_clave !== 'clave-de-prueba-0123456789') return new Response('{"message":"clave"}', { status: 400 });
      return new Response(JSON.stringify(datos()), { status: 200 });
    }
    if (String(url).endsWith('/rpc/jc_avisos_quitar')) {
      quitadas.push(args.p_endpoints);
      return new Response('', { status: 204 });
    }
    return new Response('', { status: 404 });
  });
});
afterAll(() => {
  servidor.close();
  vi.unstubAllGlobals();
  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
});

const llamar = async (cabeceras: any, body: any) => {
  const ruta = '../api/avisos.js'; // la función tal cual se sube (sin tipos: es un archivo generado)
  const { default: handler } = (await import(/* @vite-ignore */ ruta)) as { default: (req: any, res: any) => Promise<any> };
  const res: any = { code: 0, json(o: any) { this.cuerpo = o; return this; }, status(c: number) { this.code = c; return this; } };
  await handler({ method: 'POST', headers: cabeceras, body }, res);
  return res;
};

describe('la función de los avisos (api/avisos.js)', () => {
  it('sin la clave buena no hace nada', async () => {
    expect((await llamar({}, { tipo: 'evento', id: 'ev-1' })).code).toBe(401);
    expect((await llamar({ 'x-clave': 'otra-clave-que-no-vale-nada' }, { tipo: 'evento', id: 'ev-1' })).code).toBe(401);
    expect(recibidos).toHaveLength(0);
  });

  it('manda el aviso cifrado solo a los móviles de quien toca y quita la dirección muerta', async () => {
    const r = await llamar({ 'x-clave': 'clave-de-prueba-0123456789' }, JSON.stringify({ tipo: 'evento', id: 'ev-1' }));
    expect(r.code).toBe(200);
    expect(r.cuerpo).toMatchObject({ avisos: 1, enviados: 1, fallidos: 0, quitadas: 1 });
    expect(recibidos).toHaveLength(1);
    const m = recibidos[0];
    expect(m.url).toBe('/push/bea');
    expect(m.cuerpo).toEqual({ titulo: '🧦 Ana dice que esto es tuyo', texto: 'Las pesas. Tienes 12 horas para recogerlo.', pantalla: 'hoy', etiqueta: 'tuyo-ev-1' });
    expect(m.headers['content-encoding']).toBe('aes128gcm');
    expect(m.headers.urgency).toBe('high');
    // La firma VAPID: va con la llave pública de la app y se comprueba con la que le dio Supabase
    const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(m.headers.authorization)!;
    expect(k).toBe(VAPID_PUBLICA);
    const [cab, carga, firma] = t.split('.');
    expect(JSON.parse(Buffer.from(carga, 'base64url').toString()).aud).toBe(`https://localhost:${puerto}`);
    const pub = Buffer.from(vapidPrueba.publicKey, 'base64url');
    const clave = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' });
    expect(verify('sha256', Buffer.from(`${cab}.${carga}`), { key: clave, dsaEncoding: 'ieee-p1363' }, Buffer.from(firma, 'base64url'))).toBe(true);
    expect(quitadas).toEqual([[`https://localhost:${puerto}/push/vieja`]]);
  });
});
