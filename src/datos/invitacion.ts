// Código de la casa que llega en el enlace de invitación (#casa-…).
// Se guarda en el móvil para que la app instalada (que abre sin el enlace) lo siga teniendo,
// y se quita de la barra de direcciones para que no quede a la vista.
const CLAVE = 'jamacasa-invitacion';

export function leerInvitacion(): string {
  try {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (h.startsWith('casa-') && h.length > 5) {
      const codigo = h.slice(5).trim();
      try { localStorage.setItem(CLAVE, codigo); } catch { /* sin almacenamiento */ }
      try { history.replaceState(null, '', location.pathname + location.search); } catch { /* da igual */ }
      return codigo;
    }
  } catch { /* enlace raro */ }
  try { return localStorage.getItem(CLAVE) ?? ''; } catch { return ''; }
}

export function olvidarInvitacion(): void {
  try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
}
