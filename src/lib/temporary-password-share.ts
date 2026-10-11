/** wa.me link that pre-writes the message; the sender picks the chat. */
export const buildTemporaryPasswordWhatsAppHref = (
  name: string,
  password: string,
): string => {
  const greeting = name.trim() ? `Hola ${name.trim()}, ` : 'Hola, ';
  const text = `${greeting}tu contraseña temporal de Zigzag es: ${password}\nEntra y elige una nueva contraseña.`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};
