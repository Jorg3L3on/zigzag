export const ACCESS_OFICIOS = [
  'Clima y refrigeración',
  'Plomería',
  'Electricidad',
  'Mantenimiento general',
  'Otro',
] as const;

export type AccessOficio = (typeof ACCESS_OFICIOS)[number];

export type AccessRequestValues = {
  nombre: string;
  negocio: string;
  whatsapp: string;
  oficio: AccessOficio;
};

export type AccessRequestErrors = Partial<Record<'nombre' | 'whatsapp', string>>;

/** Nombre and WhatsApp are required; the rest is optional. */
export const validateAccessRequest = (values: AccessRequestValues): AccessRequestErrors => {
  const errors: AccessRequestErrors = {};
  if (!values.nombre.trim()) errors.nombre = 'Escribe tu nombre.';
  if (!values.whatsapp.trim()) errors.whatsapp = 'Escribe tu WhatsApp.';
  return errors;
};

/**
 * Landing "Pide tu acceso" submit. Owner decision: for now the form sends and
 * stores nothing, so this resolves locally with no network call and no storage.
 *
 * This is the single future email hook: when access requests should reach the
 * team, send them from here (no other code path submits the form).
 */
export const submitAccessRequest = async (values: AccessRequestValues): Promise<void> => {
  void values;
};
