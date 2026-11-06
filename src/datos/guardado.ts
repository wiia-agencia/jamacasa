// Cosas pequeñas que se recuerdan en este móvil (el tema, si ya se vio el sorteo…).
// Si el navegador no deja guardar, la app sigue funcionando igual.
export const leer = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export const guardar = (k: string, v: string | null): void => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento */
  }
};
