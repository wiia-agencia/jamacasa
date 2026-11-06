// Capturas de la vista previa a tamaño de móvil (para revisar el diseño).
// Uso: node scripts/capturas.mjs <carpeta-salida> [oscuro]
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const salida = process.argv[2] ?? '.';
const oscuro = process.argv[3] === 'oscuro';
const navegador = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: oscuro ? 'dark' : 'light',
  locale: 'es-ES',
  timezoneId: 'Europe/Madrid',
});
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
await p.goto(pathToFileURL(resolve('dist-vista/index.html')).href);
await p.waitForTimeout(600);
const s = oscuro ? '-oscuro' : '';
const foto = (n, full = false) => p.screenshot({ path: `${salida}/${n}${s}.png`, fullPage: full });

await foto('01-entrada');
await p.getByRole('button', { name: /Javi/ }).first().click();
await p.waitForTimeout(800);
await foto('02-sorteo-girando');
await p.waitForTimeout(4600);
await foto('03-sorteo');
await p.getByRole('button', { name: 'Vamos' }).click();
await p.waitForTimeout(500);
await foto('04-hoy', true);
const puntuar = p.getByRole('button', { name: 'Puntuar' }).first();
if (await puntuar.count()) {
  await puntuar.click();
  await p.waitForTimeout(400);
  await p.getByRole('radio', { name: '4' }).click();
  await p.waitForTimeout(300);
  const info = await p.evaluate(() => {
    const b = [...document.querySelectorAll('.hoja-pie button')][0];
    return b ? { texto: b.textContent, disabled: b.disabled, opacidad: getComputedStyle(b).opacity, fondo: getComputedStyle(b).backgroundColor } : null;
  });
  console.log('boton enviar', JSON.stringify(info));
  await foto('05-puntuar');
  await p.getByRole('button', { name: 'Cerrar' }).click();
}
await p.getByRole('button', { name: 'Marcar como hecho' }).first().click();
await p.waitForTimeout(400);
await foto('06-marcar');
await p.getByRole('button', { name: 'Cerrar' }).click();
for (const [n, nombre] of [['07-limpieza', 'Limpieza'], ['08-cuentas', 'Cuentas'], ['09-juego', 'Juego']]) {
  await p.getByRole('navigation').getByRole('button', { name: nombre }).click();
  await p.waitForTimeout(400);
  await foto(n, true);
}
await p.getByRole('navigation').getByRole('button', { name: 'Cuentas' }).click();
await p.getByRole('button', { name: 'Apuntar un gasto' }).click();
await p.waitForTimeout(400);
await foto('10-gasto');
console.log(JSON.stringify({ errores }, null, 1));
await navegador.close();
