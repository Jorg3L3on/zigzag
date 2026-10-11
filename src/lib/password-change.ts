/** Screen a person lands on after logging in with a temporary password (ZIG-I18-11). */
export const CHANGE_PASSWORD_PATH = '/cambiar-contrasena';

export const NEW_PASSWORD_MIN_LENGTH = 8;

/** First problem with a new password, in words a person understands; null when fine. */
export const validateNewPassword = (
  newPassword: string,
  confirmPassword: string,
): string | null => {
  if (newPassword.length < NEW_PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${NEW_PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (newPassword !== confirmPassword) {
    return 'Las dos contraseñas no son iguales. Escríbelas otra vez.';
  }
  return null;
};
