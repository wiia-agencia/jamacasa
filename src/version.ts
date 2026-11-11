// La app instalada puede pasar días abierta en segundo plano (y al tocar un aviso solo se trae al frente), así que
// nunca vería lo nuevo que se sube (Javi, 11 de noviembre: «en la aplicación no está subido ese cambio»). Al volver a
// ella, mira si hay una versión nueva (el archivo principal lleva una huella en el nombre que cambia con cada subida)
// y, si la hay, se recarga sola. Si estabas escribiendo algo, no te lo pierde: sale un aviso arriba para actualizar.

const ESPERA = 60_000; // como mucho, una vez por minuto

function scriptPrincipal(html: string): string | null {
  const m = html.match(/<script[^>]*\ssrc="([^"]*\/assets\/[^"]+\.js)"/);
  return m ? new URL(m[1], location.href).pathname : null;
}

function escribiendo(): boolean {
  return [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('textarea, input[type="text"], input[type="search"], input:not([type])')]
    .some((e) => e.value.trim() !== '');
}

function avisar() {
  if (document.getElementById('version-nueva')) return;
  const b = document.createElement('button');
  b.id = 'version-nueva';
  b.type = 'button';
  b.textContent = 'Hay una versión nueva · Toca para actualizar';
  b.style.cssText = [
    'position:fixed', 'z-index:9999', 'left:50%', 'transform:translateX(-50%)',
    'top:calc(10px + env(safe-area-inset-top, 0px))', 'border:0', 'border-radius:999px', 'padding:10px 16px',
    'background:#13233a', 'color:#ffffff', 'font:700 14px/1.2 system-ui, sans-serif',
    'box-shadow:0 10px 24px -10px rgba(0,0,0,.5)', 'white-space:nowrap',
  ].join(';');
  b.addEventListener('click', () => location.reload());
  document.body.appendChild(b);
}

/** Vigila si se ha subido una versión nueva: al volver a la app, recarga (o avisa, si estabas escribiendo). */
export function vigilarVersion() {
  const mia = scriptPrincipal(document.documentElement.outerHTML);
  if (!mia) return; // en desarrollo no hay huellas
  let ultima = 0;
  const mirar = async () => {
    if (document.visibilityState !== 'visible' || Date.now() - ultima < ESPERA) return;
    ultima = Date.now();
    try {
      const r = await fetch('/', { cache: 'no-store' });
      if (!r.ok) return;
      const nueva = scriptPrincipal(await r.text());
      if (!nueva || nueva === mia) return;
      if (escribiendo()) avisar();
      else location.reload();
    } catch {
      // sin conexión: ya mirará la próxima vez
    }
  };
  document.addEventListener('visibilitychange', mirar);
  window.addEventListener('focus', mirar);
}
