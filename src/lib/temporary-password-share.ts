/** wa.me link that pre-writes the message; the sender picks the chat. */
export const buildTemporaryPasswordWhatsAppHref = (
  name: string,
  password: string,
): string => {
  const greeting = name.trim() ? `Hola ${name.trim()}, ` : 'Hola, ';
  const text = `${greeting}tu contraseña temporal de Zigzag es: ${password}\nEntra y elige una nueva contraseña.`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};

/** WhatsApp for a person just added in Equipo (ZIG-I32-2): company, email and the temporary password. */
export const buildNewMemberWhatsAppHref = (input: {
  name: string;
  companyName: string;
  email: string;
  password: string;
}): string => {
  const greeting = input.name.trim() ? `Hola ${input.name.trim()}, ` : 'Hola, ';
  const company = input.companyName.trim();
  const text = [
    `${greeting}ya tienes acceso a ZigZag${company ? ` de ${company}` : ''}.`,
    `Correo: ${input.email.trim()}`,
    `Contraseña temporal: ${input.password}`,
    'Deberás cambiarla al entrar.',
  ].join('\n');
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};
