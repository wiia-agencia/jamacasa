// Tipos de la Jamacasa. Todo lo que pasa en la casa es un "evento" que no se
// borra nunca; el estado (puntos, notas, saldos, medallas) se calcula a partir
// de ellos. Así, si cambian las normas, todo se recalcula solo.

export type MiembroId = string;

export interface Miembro {
  id: MiembroId;
  nombre: string;
  color: string; // color fijo de la persona en toda la app: 'naranja' | 'verde' | 'azul'
  figura?: 'pino' | 'mortal' | 'escala'; // su silueta del icono
  aspecto?: Aspecto; // cómo es su muñeco de la casa en 3D
}

/** Cómo es el muñeco de cada uno en la casa en 3D. Va en la config de la casa (`aspectos`), nunca en el código. */
export interface Aspecto {
  alto?: number; // en metros
  pelo?: 'corto' | 'tupe' | 'calvo' | 'fino' | 'largo' | 'arriba'; // arriba: hacia arriba, con la parte de encima casi plana
  colorPelo?: string;
  barba?: 'corta' | 'normal' | 'candado' | null; // candado: bigote y perilla cerrados, y poca por los lados
  colorBarba?: string;
  ropa?: 'normal' | 'ancha';
}

export interface Zona {
  id: string;
  nombre: string; // "Piso de arriba"
  incluye: string; // "Salón, entradilla y cocina"
  checklist: string[];
  /** Partes que solo entran cuando el piso le toca a alguno de `para` (p. ej. el pasillo de las habitaciones de arriba,
   *  que es de los que duermen ahí). `id` es el nombre de esa parte en la casa en 3D. */
  extras?: { id: string; nombre: string; para: MiembroId[] }[];
}

export interface Factura {
  id: string;
  nombre: string;
  paga: MiembroId | null; // quien la paga normalmente (null: el que esté)
}

export interface Alquiler {
  total: number; // céntimos
  paga: MiembroId; // quien paga al casero
  partes: Record<MiembroId, number>; // céntimos por persona
  dia: number; // día del mes en que se paga
  desde: string; // 'YYYY-MM' primer mes que cuenta en la app
}

export interface Normas {
  notaMinima: number;
  notaAutomatica: number;
  horasRevision: number;
  horasBasura: number;
  horasEstoEsTuyo: number;
  puntosRevisar: number;
  puntosBasuraSemana: number;
  puntosQuejaBasura: number;
  puntosEstoEsTuyo: number;
  puntosRetrasoDia: number;
  puntosSuspenso: number;
  puntosSinHacer: number;
  diasGracia: number; // días después del domingo hasta "sin hacer"
}

export interface Config {
  nombre: string;
  inicio: string; // 'YYYY-MM-DD', un lunes: primera semana de la app
  semilla: number; // decide los sorteos (rotación y basura)
  miembros: Miembro[];
  zonas: Zona[];
  alquiler: Alquiler;
  facturas: Factura[];
  normas?: Partial<Normas>;
  notaLimpieza?: string; // lo que no entra en la rotación (habitaciones, etc.)
  aspectos?: Partial<Record<MiembroId, Aspecto>>; // el muñeco de cada uno en la casa en 3D
}

export type TipoEvento =
  | 'zona_empezada' // «Empezar a limpiar»: tu muñeco se pone a barrer y se avisa a los otros dos
  | 'zona_hecha'
  | 'puntuacion'
  | 'basura_llena'
  | 'basura_sacada'
  | 'esto_es_tuyo'
  | 'recogido'
  | 'gasto'
  | 'gasto_anulado'
  | 'pago'
  | 'pago_anulado'
  | 'aviso_prueba' // «Probar los avisos»: se avisa solo a quien lo pulsa
  | 'mensaje' // el chat de la casa
  | 'mensaje_fijado' // fija un mensaje arriba del chat (o lo quita, con mensaje: null)
  | 'mensaje_borrado' // su autor lo borra: queda «Mensaje borrado» en su sitio
  | 'espacio_cosa' // «Tu espacio»: apuntas una cosa tuya (tu habitación, tu baño…) o le cambias el nombre o cada cuánto
  | 'espacio_cosa_quitada' // la quitas de tu espacio
  | 'espacio_hecho'; // la acabas de limpiar (solo lo ves tú: la base de datos no se lo da a los otros dos)

export interface Evento {
  id: string;
  ts: number; // instante en milisegundos
  autor: MiembroId;
  tipo: TipoEvento;
  datos: any;
}

// Datos de cada tipo de evento (lo que se guarda en "datos")
export interface DatosZonaEmpezada { semana: number }
export interface DatosZonaHecha { semana: number; fotos?: string[]; nota?: string }
export interface DatosPuntuacion {
  semana: number;
  de: MiembroId;
  intento: number;
  nota: number;
  faltan?: string[];
  fotos?: string[];
  comentario?: string;
}
export interface DatosBasuraLlena { fotos?: string[] }
export interface DatosEstoEsTuyo { para: MiembroId; fotos?: string[]; que?: string }
export interface DatosRecogido { aviso: string }
export interface DatosGasto {
  concepto: string;
  categoria: string; // id de factura, 'compra' u 'otro'
  importe: number; // céntimos
  pagador: MiembroId;
  participantes: MiembroId[]; // entre quién se reparte a partes iguales
  fecha: string; // 'YYYY-MM-DD'
  fotos?: string[];
}
export interface DatosPago { de: MiembroId; a: MiembroId; importe: number; alquiler?: string; nota?: string }
export interface DatosMensaje { texto?: string; fotos?: string[]; audio?: { ref: string; segundos: number } }
export interface DatosFijado { mensaje: string | null }
export interface DatosBorrado { mensaje: string }
