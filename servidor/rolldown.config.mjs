// Junta la función de los avisos (y las reglas de src/core que usa) en un solo archivo para Vercel.
export default {
  input: 'servidor/avisos.ts',
  platform: 'node',
  output: {
    file: 'api/avisos.js',
    format: 'esm',
    banner: '// Generado desde servidor/avisos.ts con «npm run servidor». No se edita a mano.',
  },
};
