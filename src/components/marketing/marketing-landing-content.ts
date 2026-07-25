export const LANDING_HERO = {
  brand: 'ZigZag',
  headline: 'Tickets, cobranza y facturas PDF para empresas de servicios',
  support:
    'Deja atrás hojas de cálculo y WhatsApp. Opera clientes, servicios y cobros en una sola plataforma multi-empresa, lista para móvil.',
  primaryCta: { href: '/login', label: 'Iniciar sesión' },
  secondaryCta: { href: '#como-funciona', label: 'Ver cómo funciona' },
  heroImage: {
    src: '/guides/images/empresa/01-dashboard.webp',
    alt: 'Dashboard de ZigZag con métricas de ingresos y tickets',
  },
} as const;

export const LANDING_PROBLEM = {
  id: 'problema',
  title: 'El problema',
  body: 'HVAC, mantenimiento e instalaciones viven en herramientas fragmentadas: Excel, chats y facturas manuales. Pierdes visibilidad de cobros, no hay trazabilidad entre sucursales y el equipo improvisa cada día.',
} as const;

export const LANDING_FLOW_STEPS = [
  {
    key: 'cliente',
    title: 'Cliente',
    body: 'Registra hoteles, clínicas y comercios con datos listos para el ticket.',
    image: {
      src: '/guides/images/empresa/04-clientes.webp',
      alt: 'Listado de clientes en ZigZag',
    },
  },
  {
    key: 'ticket',
    title: 'Ticket',
    body: 'Abre el trabajo, asigna estado y sigue el ciclo hasta el cierre.',
    image: {
      src: '/guides/images/empresa/08-crear-ticket.webp',
      alt: 'Formulario para crear un ticket de servicio',
    },
  },
  {
    key: 'servicios',
    title: 'Servicios',
    body: 'Agrega líneas del catálogo con precios reutilizables.',
    image: {
      src: '/guides/images/empresa/09-agregar-servicios.webp',
      alt: 'Agregar servicios a un ticket',
    },
  },
  {
    key: 'cobro',
    title: 'Cobro',
    body: 'Registra pagos parciales o totales con historial claro.',
    image: {
      src: '/guides/images/empresa/06-detalle-ticket.webp',
      alt: 'Detalle de ticket con estado de cobro',
    },
  },
  {
    key: 'factura',
    title: 'Factura PDF',
    body: 'Descarga la factura generada en el servidor, con logo y RFC.',
    image: {
      src: '/guides/images/empresa/10-factura-pdf.webp',
      alt: 'Factura PDF generada por ZigZag',
    },
  },
] as const;

export const LANDING_CAPABILITIES = [
  {
    title: 'Multi-empresa nativo',
    body: 'Aislamiento por Company y consola para operar varios tenants.',
  },
  {
    title: 'Factura PDF en servidor',
    body: 'Sin subir archivos: el PDF se genera al momento desde el ticket.',
  },
  {
    title: 'Roles y permisos',
    body: 'Admin, Operator y Viewer con control por módulo.',
  },
  {
    title: 'Auditoría',
    body: 'Eventos inmutables en pagos y cambios sensibles.',
  },
  {
    title: 'Recordatorios',
    body: 'Mantenimientos recurrentes con avisos dentro de la app.',
  },
  {
    title: 'PWA instalable',
    body: 'Acceso desde el teléfono sin app store; datos con red.',
  },
] as const;

export const LANDING_DEMO = {
  id: 'demo',
  title: 'Datos de evaluación — ClimaTotal Demo',
  body: 'Un tenant de demostración con datos realistas para evaluar el producto. No son testimonios inventados: es el entorno de evaluación de ZigZag.',
  stats: [
    { value: '53', label: 'Tickets', detail: 'Activos, finalizados y con pagos parciales' },
    { value: '21', label: 'Clientes', detail: 'Hoteles, clínicas, comercios y más' },
    { value: '$104K+', label: 'Volumen demo', detail: 'Historial de 12 meses en el dashboard' },
    { value: '14', label: 'Recordatorios', detail: 'Próximos, atrasados y pausados' },
  ],
  images: [
    {
      src: '/guides/images/empresa/02-tickets.webp',
      alt: 'Lista de tickets en ClimaTotal Demo',
    },
    {
      src: '/guides/images/empresa/12-mobile-tickets.webp',
      alt: 'Vista móvil de tickets en ZigZag',
    },
  ],
} as const;

export const LANDING_FINAL_CTA = {
  title: '¿Listo para ver ZigZag en acción?',
  body: 'Entra a la plataforma o recorre el flujo completo en esta página.',
  primaryCta: { href: '/login', label: 'Iniciar sesión' },
  secondaryCta: { href: '#como-funciona', label: 'Ver cómo funciona' },
} as const;

export const LANDING_NAV_LINKS = [
  { href: '#problema', label: 'Problema' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#capacidades', label: 'Capacidades' },
  { href: '#demo', label: 'Demo' },
] as const;
