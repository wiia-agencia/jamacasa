// Conexión con la base de datos compartida (Supabase).
// La URL y la clave "publishable" son públicas por diseño: la seguridad la ponen
// las reglas de la base de datos (código de la casa + PIN de cada uno).
export const SUPABASE = {
  url: 'https://sxecthlpgtjbynbimbos.supabase.co',
  clave: 'sb_publishable_Y1yB3x7MQ9-4KSJ-Awy04Q_3s5dD9l-',
};

// Llave pública de los avisos al móvil (VAPID). Es pública por diseño: con ella el móvil
// sabe que los avisos vienen de la Jamacasa. La privada, la que firma, solo está en Vault.
export const VAPID_PUBLICA = 'BFthnBi28hOeDlR4wjdCmKF5p63ch3OYrWrRVvLdV7e0WDFMp5k3voPI9Fpk6ePuZZ1SZiRuZlGMfKjwqOS-iT0';
