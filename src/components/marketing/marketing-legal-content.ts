export const LEGAL_PLACEHOLDERS = {
  responsable: '[NOMBRE DEL RESPONSABLE / RAZÓN SOCIAL]',
  domicilio: '[DOMICILIO DEL RESPONSABLE]',
  email: '[EMAIL DE PRIVACIDAD]',
  vigencia: '[FECHA DE VIGENCIA]',
} as const;

export const LEGAL_DISCLAIMER =
  'Este documento es una plantilla informativa y no sustituye la revisión de un abogado ni constituye asesoría legal.';

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: '1. Identidad del responsable',
    paragraphs: [
      `El responsable del tratamiento de los datos personales es ${LEGAL_PLACEHOLDERS.responsable}, con domicilio en ${LEGAL_PLACEHOLDERS.domicilio}.`,
      `Para ejercer derechos o aclaraciones relacionadas con privacidad, escribe a ${LEGAL_PLACEHOLDERS.email}.`,
    ],
  },
  {
    title: '2. Datos personales que tratamos',
    paragraphs: [
      'Podemos tratar datos de identificación y contacto (nombre, correo electrónico, teléfono), datos de la empresa usuaria (razón social, RFC, dirección) y datos técnicos de sesión necesarios para autenticar el acceso a la plataforma ZigZag.',
      'No solicitamos categorías especiales de datos personales a través de las páginas públicas de marketing.',
    ],
  },
  {
    title: '3. Finalidades del tratamiento',
    paragraphs: [
      'Tratamos datos para: (i) prestar el servicio SaaS multi-empresa de tickets, clientes, servicios y emisión de recibos; (ii) autenticar usuarios y aplicar roles/permisos; (iii) generar recibos PDF y registros de auditoría; (iv) atender solicitudes de soporte; y (v) cumplir obligaciones legales aplicables.',
      'Las páginas públicas de marketing no incluyen formulario de captación de leads en esta versión.',
    ],
  },
  {
    title: '4. Cookies y sesión',
    paragraphs: [
      'ZigZag utiliza cookies o almacenamiento equivalente de sesión (por ejemplo, el token de autenticación) para mantener iniciada la sesión del usuario y proteger rutas de la aplicación.',
      'Estas cookies son necesarias para el funcionamiento del servicio y no se usan en las páginas públicas para publicidad de terceros.',
    ],
  },
  {
    title: '5. Conservación',
    paragraphs: [
      'Conservamos los datos mientras la cuenta de la Company permanezca activa y durante los plazos adicionales que exijan la ley, la auditoría del servicio o la defensa de reclamaciones.',
      'Los datos de empresas dadas de baja se tratan conforme a los flujos de soft-delete y offboarding de la plataforma.',
    ],
  },
  {
    title: '6. Derechos ARCO y medios de ejercicio',
    paragraphs: [
      'Puedes solicitar acceso, rectificación, cancelación u oposición al tratamiento de tus datos personales, así como limitar el uso o revocar el consentimiento cuando aplique, contactando a ${LEGAL_PLACEHOLDERS.email}.',
      'Te pediremos información razonable para verificar tu identidad antes de atender la solicitud.',
    ],
  },
  {
    title: '7. Transferencias y encargados',
    paragraphs: [
      'Podemos compartir datos con proveedores de infraestructura (hosting, base de datos, almacenamiento de archivos) estrictamente necesarios para operar ZigZag, bajo obligaciones de confidencialidad y seguridad.',
      'No vendemos datos personales.',
    ],
  },
  {
    title: '8. Seguridad',
    paragraphs: [
      'Aplicamos medidas técnicas y organizativas razonables: aislamiento multi-tenant por company_id, control de acceso basado en roles, y registro de eventos sensibles en auditoría.',
    ],
  },
  {
    title: '9. Cambios a este aviso',
    paragraphs: [
      `Este aviso entra en vigor el ${LEGAL_PLACEHOLDERS.vigencia}. Publicaremos la versión actualizada en esta misma URL cuando existan cambios materiales.`,
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: '1. Aceptación',
    paragraphs: [
      `Al acceder o usar ZigZag aceptas estos Términos y condiciones. Si no estás de acuerdo, no uses el servicio. Vigencia: ${LEGAL_PLACEHOLDERS.vigencia}.`,
      LEGAL_DISCLAIMER,
    ],
  },
  {
    title: '2. Descripción del servicio',
    paragraphs: [
      'ZigZag es una plataforma SaaS multi-empresa para gestionar clientes, servicios, tickets, cobranza y recibos PDF generados en servidor, con roles, permisos y auditoría.',
      'El proveedor del servicio es ${LEGAL_PLACEHOLDERS.responsable}, con domicilio en ${LEGAL_PLACEHOLDERS.domicilio}.',
    ],
  },
  {
    title: '3. Cuentas y acceso',
    paragraphs: [
      'Debes proporcionar información veraz al registrarte o al ser invitado a una Company. Eres responsable de custodiar tus credenciales y de la actividad realizada con tu cuenta.',
      'Podemos suspender el acceso ante uso indebido, riesgo de seguridad o incumplimiento de estos términos.',
    ],
  },
  {
    title: '4. Uso multi-empresa (Company)',
    paragraphs: [
      'Los datos de cada Company están aislados por diseño. No debes intentar acceder a datos de otra Company ni eludir controles de autorización.',
      'Los usuarios de la empresa sistema (System company) pueden operar funciones de plataforma conforme a los permisos configurados.',
    ],
  },
  {
    title: '5. Uso aceptable',
    paragraphs: [
      'No está permitido: (i) abusar, interferir o sobrecargar el servicio; (ii) cargar malware o contenido ilícito; (iii) suplantar identidades; (iv) realizar ingeniería inversa no autorizada; ni (v) usar ZigZag para actividades ilegales.',
    ],
  },
  {
    title: '6. Recibos PDF y contenido del cliente',
    paragraphs: [
      'Los recibos PDF se generan a partir de los datos que captura tu Company. Eres responsable de la exactitud fiscal y comercial de esa información (incluyendo RFC, dirección y montos).',
      'ZigZag no recibe PDFs cargados por el usuario como fuente de verdad del recibo en producción.',
    ],
  },
  {
    title: '7. Propiedad intelectual',
    paragraphs: [
      'ZigZag, su marca, interfaz y software son propiedad del proveedor o de sus licenciantes. Tú conservas la propiedad de los datos de negocio que cargas en tu Company.',
    ],
  },
  {
    title: '8. Disponibilidad y cambios',
    paragraphs: [
      'Podemos modificar funciones, planes o estos términos. El servicio se ofrece “tal cual”, procurando disponibilidad razonable, sin garantizar operación ininterrumpida.',
    ],
  },
  {
    title: '9. Limitación de responsabilidad',
    paragraphs: [
      'En la máxima medida permitida por la ley aplicable, el proveedor no será responsable por daños indirectos, lucro cesante, pérdida de datos o interrupciones del negocio derivados del uso o la imposibilidad de uso de ZigZag.',
      'La responsabilidad total agregada, si existiera, se limitará a los montos efectivamente pagados por el servicio en los tres meses previos al reclamo, salvo norma imperativa en contrario.',
    ],
  },
  {
    title: '10. Contacto',
    paragraphs: [
      `Para dudas sobre estos términos: ${LEGAL_PLACEHOLDERS.email}.`,
    ],
  },
];

/** Expand ${LEGAL_PLACEHOLDERS.*} tokens left as literal placeholders in copy. */
export const resolveLegalText = (text: string): string => {
  return text
    .replaceAll('${LEGAL_PLACEHOLDERS.email}', LEGAL_PLACEHOLDERS.email)
    .replaceAll(
      '${LEGAL_PLACEHOLDERS.responsable}',
      LEGAL_PLACEHOLDERS.responsable,
    )
    .replaceAll(
      '${LEGAL_PLACEHOLDERS.domicilio}',
      LEGAL_PLACEHOLDERS.domicilio,
    )
    .replaceAll(
      '${LEGAL_PLACEHOLDERS.vigencia}',
      LEGAL_PLACEHOLDERS.vigencia,
    );
};
