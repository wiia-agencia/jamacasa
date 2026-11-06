/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// "vista": una sola página HTML con todo dentro, para la vista previa privada.
export default defineConfig(({ mode }) => {
  const vista = mode === 'vista';
  // Los datos reales (alquiler, foto) solo entran en la vista previa privada, nunca en la app pública
  const privado = resolve(__dirname, 'src/demo/privado/datos.ts');
  const datosPrivados = vista && existsSync(privado) ? privado : resolve(__dirname, 'src/demo/sinPrivado.ts');
  return {
    resolve: { alias: { 'datos-privados': datosPrivados } },
    plugins: [react(), ...(vista ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    define: { __VISTA__: JSON.stringify(vista) },
    build: vista
      ? { outDir: 'dist-vista', assetsInlineLimit: 100_000_000, cssCodeSplit: false, emptyOutDir: true }
      : { outDir: 'dist', emptyOutDir: true },
    test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  };
});
