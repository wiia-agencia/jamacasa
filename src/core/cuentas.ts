import { diaDeTexto, diaLocal, mes, mesesEntre, nombreMes } from './tiempo';
import type { Config, DatosGasto, DatosPago, Evento, MiembroId } from './tipos';

export interface Gasto {
  id: string;
  evento?: Evento; // no existe en el alquiler, que se crea solo cada mes
  concepto: string;
  categoria: string;
  importe: number;
  pagador: MiembroId;
  partes: Record<MiembroId, number>;
  fecha: string; // YYYY-MM-DD
  fotos: string[];
  alquiler?: string; // YYYY-MM si es el alquiler de ese mes
  anulado: boolean;
}

export interface Pago {
  id: string;
  evento: Evento;
  de: MiembroId;
  a: MiembroId;
  importe: number;
  alquiler?: string;
  nota?: string;
  anulado: boolean;
}

export interface Transferencia { de: MiembroId; a: MiembroId; importe: number }

export interface EstadoAlquiler {
  mes: string;
  persona: MiembroId;
  parte: number;
  pagadoEn?: number;
  diasTarde: number; // días pasados del día de pago (0 si a tiempo)
}

export interface Cuentas {
  gastos: Gasto[]; // incluye el alquiler de cada mes
  pagos: Pago[];
  saldo: Record<MiembroId, number>; // + te deben, − debes
  transferencias: Transferencia[];
  alquiler: EstadoAlquiler[];
}

/** Reparte un importe a partes iguales; los céntimos que sobran van primero al que pagó. */
export function repartir(importe: number, participantes: MiembroId[], pagador: MiembroId, orden: MiembroId[]): Record<MiembroId, number> {
  const lista = orden.filter((m) => participantes.includes(m));
  if (lista.length === 0) return {};
  const base = Math.floor(importe / lista.length);
  let resto = importe - base * lista.length;
  const r: Record<MiembroId, number> = {};
  for (const m of lista) r[m] = base;
  const prioridad = [pagador, ...lista.filter((m) => m !== pagador)].filter((m) => lista.includes(m));
  for (const m of prioridad) {
    if (resto <= 0) break;
    r[m] += 1;
    resto -= 1;
  }
  return r;
}

export function simplificar(saldo: Record<MiembroId, number>): Transferencia[] {
  const acreedores = Object.entries(saldo).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const deudores = Object.entries(saldo).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const r: Transferencia[] = [];
  let i = 0;
  let j = 0;
  while (i < deudores.length && j < acreedores.length) {
    const x = Math.min(deudores[i].v, acreedores[j].v);
    if (x > 0) r.push({ de: deudores[i].id, a: acreedores[j].id, importe: x });
    deudores[i].v -= x;
    acreedores[j].v -= x;
    if (deudores[i].v === 0) i++;
    if (acreedores[j].v === 0) j++;
  }
  return r;
}

export function calcularCuentas(config: Config, eventos: Evento[], ahora: number): Cuentas {
  const orden = config.miembros.map((m) => m.id);
  const anuladosG = new Set(eventos.filter((e) => e.tipo === 'gasto_anulado').map((e) => e.datos?.gasto));
  const anuladosP = new Set(eventos.filter((e) => e.tipo === 'pago_anulado').map((e) => e.datos?.pago));

  const gastos: Gasto[] = eventos
    .filter((e) => e.tipo === 'gasto')
    .map((e) => {
      const d = e.datos as DatosGasto;
      const participantes = d.participantes?.length ? d.participantes : orden;
      return {
        id: e.id,
        evento: e,
        concepto: d.concepto,
        categoria: d.categoria,
        importe: Math.round(d.importe),
        pagador: d.pagador,
        partes: repartir(Math.round(d.importe), participantes, d.pagador, orden),
        fecha: d.fecha,
        fotos: d.fotos ?? [],
        anulado: anuladosG.has(e.id),
      };
    });

  // El alquiler se apunta solo cada mes desde el mes en que empieza a contar
  const al = config.alquiler;
  const mesAhora = mes(ahora);
  if (al && al.total > 0) {
    for (const m of mesesEntre(al.desde, mesAhora)) {
      gastos.push({
        id: `alquiler-${m}`,
        concepto: `Alquiler de ${nombreMes(m)}`,
        categoria: 'alquiler',
        importe: al.total,
        pagador: al.paga,
        partes: { ...al.partes },
        fecha: `${m}-01`,
        fotos: [],
        alquiler: m,
        anulado: false,
      });
    }
  }
  gastos.sort((a, b) => (a.fecha === b.fecha ? (b.evento?.ts ?? 0) - (a.evento?.ts ?? 0) : a.fecha < b.fecha ? 1 : -1));

  const pagos: Pago[] = eventos
    .filter((e) => e.tipo === 'pago')
    .map((e) => {
      const d = e.datos as DatosPago;
      return { id: e.id, evento: e, de: d.de, a: d.a, importe: Math.round(d.importe), alquiler: d.alquiler, nota: d.nota, anulado: anuladosP.has(e.id) };
    })
    .sort((a, b) => b.evento.ts - a.evento.ts);

  const saldo: Record<MiembroId, number> = {};
  for (const m of orden) saldo[m] = 0;
  for (const g of gastos) {
    if (g.anulado) continue;
    if (saldo[g.pagador] !== undefined) saldo[g.pagador] += g.importe;
    for (const [m, v] of Object.entries(g.partes)) if (saldo[m] !== undefined) saldo[m] -= v;
  }
  for (const p of pagos) {
    if (p.anulado) continue;
    if (saldo[p.de] !== undefined) saldo[p.de] += p.importe;
    if (saldo[p.a] !== undefined) saldo[p.a] -= p.importe;
  }

  const alquiler: EstadoAlquiler[] = [];
  if (al && al.total > 0) {
    const hoy = diaLocal(ahora);
    for (const m of mesesEntre(al.desde, mesAhora)) {
      const vence = diaDeTexto(`${m}-${String(al.dia).padStart(2, '0')}`);
      for (const persona of orden) {
        if (persona === al.paga) continue;
        const pagosMes = pagos
          .filter((p) => !p.anulado && p.de === persona && p.a === al.paga && p.alquiler === m)
          .sort((a, b) => a.evento.ts - b.evento.ts);
        const pagadoEn = pagosMes[0]?.evento.ts;
        const dia = pagadoEn !== undefined ? diaLocal(pagadoEn) : hoy;
        alquiler.push({ mes: m, persona, parte: al.partes[persona] ?? 0, pagadoEn, diasTarde: Math.max(0, dia - vence) });
      }
    }
  }

  return { gastos, pagos, saldo, transferencias: simplificar(saldo), alquiler };
}

/** Lo que una persona tiene pendiente del alquiler del mes (para el desglose del Bizum). */
export function alquilerPendiente(c: Cuentas, persona: MiembroId, m: string): EstadoAlquiler | undefined {
  return c.alquiler.find((x) => x.mes === m && x.persona === persona && x.pagadoEn === undefined);
}

export function euros(cent: number, conSigno = false): string {
  const v = Math.abs(cent) / 100;
  const t = v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
  const signo = conSigno ? (cent > 0 ? '+' : cent < 0 ? '−' : '') : cent < 0 ? '−' : '';
  return `${signo}${t} €`;
}

/** "36,8" o "36,80" o "36" → céntimos. Devuelve null si no es un importe válido. */
export function leerImporte(texto: string): number | null {
  let limpio = texto.replace(/\s|€/g, '');
  if (limpio.includes(',')) limpio = limpio.replace(/\./g, '').replace(',', '.');
  else if (!/^\d+\.\d{1,2}$/.test(limpio)) limpio = limpio.replace(/\./g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(limpio)) return null;
  const v = Math.round(parseFloat(limpio) * 100);
  return v > 0 ? v : null;
}
