import type { GuideContent } from '@/components/ayuda/guide-registry';

/**
 * Copy of the second batch of help guides (ZIG-I40-4), keyed by slug and
 * attached to GUIDES in the registry. Every button and screen label quoted
 * here was checked against the app source (labels → files in the ticket).
 */

const MORE_MENU = [
  'Tickets',
  'Cobranza',
  'Presupuestos',
  'Recordatorios de servicio',
  'Servicios',
  'Clientes',
  'Mi empresa',
];

export const GUIDES_PART_2_CONTENT: Partial<Record<string, GuideContent>> = {
  'guardar-un-cliente': {
    description:
      'Cómo guardar un cliente en ZigZag: nombre, teléfono y, si quieres, su dirección. Luego solo lo eliges en tus tickets.',
    intro:
      'Guarda a tu cliente una vez y después solo lo eliges al hacer un ticket o un presupuesto. Solo necesitas su nombre y su teléfono.',
    steps: [
      {
        title: 'Toca el botón +',
        body: 'Está en medio de la barra de abajo. Elige “Nuevo cliente”. En la computadora, entra a Clientes y toca “Nuevo cliente”.',
        piece: { kind: 'create-menu', highlight: 'Nuevo cliente' },
      },
      {
        title: 'Escribe nombre y teléfono',
        body: 'Los dos son obligatorios. El teléfono va solo con números: si escribes espacios o guiones, ZigZag los quita y te avisa. El correo es opcional.',
        piece: {
          kind: 'client-form',
          fields: [
            { label: 'Nombre', value: 'Clínica Dental Sonrisa' },
            { label: 'Teléfono', value: '9981234567' },
            { label: 'Correo', value: '' },
          ],
          ring: 'field',
        },
      },
      {
        title: 'Agrega la dirección y toca Crear',
        body: 'Calle, número, colonia, ciudad y código postal. Todos los campos de dirección son opcionales: llénalos si vas a su local. Luego toca “Crear”.',
        piece: {
          kind: 'client-form',
          fields: [
            { label: 'Calle', value: 'Av. Tulum' },
            { label: 'Número exterior', value: '120' },
            { label: 'Colonia', value: 'Centro' },
            { label: 'Ciudad o municipio', value: 'Cancún' },
          ],
          ring: 'submit',
        },
      },
      {
        title: 'Elígelo en tu ticket',
        body: 'Al hacer un ticket, toca “Busca o elige un cliente” y escribe su nombre o su teléfono. Ya sale en la lista.',
        piece: {
          kind: 'client-card',
          name: 'Clínica Dental Sonrisa',
          phone: '998 123 4567',
          dateLabel: 'Hoy, 12 nov',
        },
      },
    ],
    note: {
      title: '¿Tienes muchos clientes?',
      body: 'En Clientes toca “Importar CSV” y súbelos todos de una vez desde una hoja de cálculo.',
    },
    next: 'armar-mi-lista-de-precios',
  },

  'armar-mi-lista-de-precios': {
    description:
      'Cómo armar tu lista de precios en ZigZag: cada servicio con su nombre, descripción, precio y materiales.',
    intro:
      'Tu lista de precios son tus servicios. Los escribes una vez y en cada ticket solo los eliges: ZigZag pone el precio y hace la suma.',
    steps: [
      {
        title: 'Abre Servicios',
        body: 'En el teléfono toca “Más”, abajo a la derecha, y luego “Servicios”. En la computadora, Servicios está en la barra de la izquierda.',
        piece: { kind: 'more-sheet', items: MORE_MENU, highlight: 'Servicios' },
      },
      {
        title: 'Toca Nuevo servicio',
        body: 'Está arriba de tu lista. En la lista ves cada servicio con su precio; toca uno para cambiarlo.',
        piece: {
          kind: 'services-catalog',
          services: [
            { name: 'Mantenimiento preventivo A/C', price: 850 },
            { name: 'Recarga de gas refrigerante', price: 1400 },
          ],
        },
      },
      {
        title: 'Escribe nombre, descripción y precio',
        body: 'Los tres son obligatorios. La descripción dice qué incluye el servicio. En Precio escribe solo el número: el signo $ ya está puesto.',
        piece: {
          kind: 'service-form',
          name: 'Instalación de minisplit',
          description: 'Instalación de equipo de hasta 2 toneladas, con prueba de funcionamiento.',
          price: 2500,
          materials: [],
          ring: 'fields',
        },
      },
      {
        title: 'Agrega materiales si los usas',
        body: 'Toca “Agregar material” por cada pieza que llevas siempre. Se agregan al ticket o presupuesto con este servicio, y ahí los puedes ajustar.',
        piece: {
          kind: 'service-form',
          name: 'Instalación de minisplit',
          description: '',
          price: 2500,
          materials: [
            { name: 'Tubo de cobre 3 m', amount: 450 },
            { name: 'Base para condensador', amount: 380 },
          ],
          ring: 'materials',
        },
      },
      {
        title: 'Toca Crear servicio',
        body: 'Listo: ya sale en tu lista y en “Agregar servicio” cuando haces un ticket. Repite por cada trabajo que cobras.',
        piece: {
          kind: 'service-form',
          name: 'Instalación de minisplit',
          description: '',
          price: 2500,
          materials: [
            { name: 'Tubo de cobre 3 m', amount: 450 },
            { name: 'Base para condensador', amount: 380 },
          ],
          ring: 'submit',
        },
      },
    ],
    note: {
      title: '¿Ya tienes tus precios en Excel?',
      body: 'En Servicios toca “Importar CSV” y súbelos todos de una vez.',
    },
    next: 'programar-un-mantenimiento',
  },

  'programar-un-mantenimiento': {
    description:
      'Cómo programar un recordatorio de mantenimiento en ZigZag para saber cuándo volver con cada cliente.',
    intro:
      'Un recordatorio te dice cuándo le toca su próximo servicio a un cliente: cada 3 meses, cada 6, cada año. Así vuelves a tiempo y no pierdes el trabajo.',
    steps: [
      {
        title: 'Abre Recordatorios de servicio',
        body: 'En el teléfono toca “Más” y luego “Recordatorios de servicio”. En la computadora está en la barra de la izquierda.',
        piece: { kind: 'more-sheet', items: MORE_MENU, highlight: 'Recordatorios de servicio' },
      },
      {
        title: 'Elige cliente y servicio',
        body: 'Toca “Nuevo recordatorio”. En Cliente busca por nombre. En Servicio elige uno de tu lista de precios.',
        piece: {
          kind: 'reminder-form',
          client: 'Hotel Riviera Dorada',
          service: 'Mantenimiento preventivo A/C',
          lastService: '2026-11-12',
          months: 6,
          ring: 'pick',
        },
      },
      {
        title: 'Di cada cuánto',
        body: 'En “Último servicio” pon el día que fuiste. En “Cada” toca los meses: 1, 2, 3, 6 o 12. Con “Otro…” pones días o meses a tu gusto. Pruébalo aquí: ZigZag te dice la fecha del próximo.',
        piece: {
          kind: 'reminder-form',
          client: 'Hotel Riviera Dorada',
          service: 'Mantenimiento preventivo A/C',
          lastService: '2026-11-12',
          months: 6,
          ring: 'every',
        },
      },
      {
        title: 'Toca Guardar',
        body: 'El recordatorio queda en tu lista con la fecha del próximo servicio. Cuando se acerca, también lo ves en Hoy, en “Recordatorios”.',
        piece: {
          kind: 'reminder-form',
          client: 'Hotel Riviera Dorada',
          service: 'Mantenimiento preventivo A/C',
          lastService: '2026-11-12',
          months: 6,
          ring: 'save',
        },
      },
      {
        title: 'Cuando toque, avísale',
        body: 'En la tarjeta del recordatorio toca “WhatsApp” para escribirle al cliente, o “Crear ticket” cuando vayas. “Posponer” lo mueve una semana.',
        piece: {
          kind: 'reminder-card',
          client: 'Hotel Riviera Dorada',
          service: 'Mantenimiento preventivo A/C',
          months: 6,
          nextLabel: '12 de mayo de 2027',
        },
      },
    ],
    note: {
      title: '¿Acabas de terminar el trabajo?',
      body: 'Al terminar un ticket con señal aparece “Programar el próximo servicio”. Marca el servicio y el recordatorio se guarda junto con el ticket.',
    },
    next: 'instalar-zigzag-en-mi-telefono',
  },

  'instalar-zigzag-en-mi-telefono': {
    description:
      'Cómo instalar ZigZag en tu teléfono Android o iPhone para abrirlo desde un ícono, a pantalla completa.',
    intro:
      'ZigZag no se baja de la tienda: se instala desde el navegador en un minuto. Queda un ícono en tu pantalla de inicio y se abre a pantalla completa.',
    steps: [
      {
        title: 'En Android, toca Instalar',
        body: 'Abre ZigZag en Chrome y entra con tu cuenta. Arriba sale el aviso “Instala ZigZag para acceso rápido desde tu pantalla de inicio.” Toca “Instalar” y luego confirma en el mensaje de Chrome.',
        piece: { kind: 'install-card', variant: 'banner' },
      },
      {
        title: '¿Cerraste el aviso? Hazlo desde tu cuenta',
        body: 'Toca “Más”, luego tu nombre hasta abajo y “Cuenta”. En “Instalar ZigZag” toca el botón “Instalar ZigZag”. Si no sale, en el menú de Chrome (los tres puntos) busca “Instalar app” o “Agregar a la pantalla principal”.',
        piece: { kind: 'install-card', variant: 'account' },
      },
      {
        title: 'En iPhone, usa Safari',
        body: 'Abre ZigZag en Safari. Toca Compartir (el cuadro con la flecha hacia arriba) y luego “Agregar a inicio”. Tu cuenta te lo recuerda en “Instalar ZigZag”.',
        piece: { kind: 'install-card', variant: 'ios' },
      },
      {
        title: 'Ábrelo desde el ícono',
        body: 'Busca el ícono de ZigZag en tu pantalla de inicio y ábrelo desde ahí. En iPhone, los avisos solo llegan si lo abres así.',
        piece: { kind: 'install-card', variant: 'home-icon' },
      },
    ],
    note: {
      title: '¿En la computadora?',
      body: 'No hace falta instalar nada: entra a ZigZag desde el navegador. El aviso y el botón de instalar solo salen en el teléfono.',
    },
    next: 'trabajar-sin-senal',
  },

  'trabajar-sin-senal': {
    description:
      'Cómo trabajar en ZigZag sin señal: el ticket se guarda en tu teléfono y se sube solo cuando vuelve la señal.',
    intro:
      'Sin señal puedes hacer tickets y presupuestos igual. Se quedan en tu teléfono y se suben solos cuando vuelve la señal; ahí toman su folio.',
    steps: [
      {
        title: 'Ábrelo una vez con señal',
        body: 'La primera vez, con señal, ZigZag se prepara: sale “Preparando para trabajar sin señal…” y luego “Listo para trabajar sin señal”. Desde ahí ya tienes tus clientes y servicios en el teléfono.',
        piece: { kind: 'offline-notice', variant: 'ready' },
      },
      {
        title: 'Sin señal, haz tu ticket igual',
        body: 'Arriba sale “Sin conexión a internet”. Toca + y “Nuevo ticket” como siempre. El ticket te avisa que se guarda en el teléfono y que es provisional: no es factura.',
        piece: { kind: 'offline-notice', variant: 'composer' },
      },
      {
        title: 'Toca Guardar',
        body: 'Sale “Ticket guardado sin conexión”. En la computadora el botón dice “Guardar sin conexión”. No lo borres ni cierres sesión: espera a tener señal.',
        piece: { kind: 'save-bar', countLabel: '1 servicio', total: 850, label: 'Guardar' },
      },
      {
        title: 'Mira tus pendientes',
        body: 'En Tickets, arriba, están los “Tickets sin sincronizar” con “Pendiente de sincronizar”. Toca “Abrir” si quieres corregir algo. Con señal se suben solos y sale “Ya tiene su folio.”',
        piece: {
          kind: 'pending-documents',
          client: 'Hotel Riviera Dorada',
          notes: 'Limpieza de 3 equipos',
          total: 850,
        },
      },
    ],
    note: {
      title: '¿Dice Revisar?',
      body: 'Algo no se pudo subir. Toca “Revisar”, corrige lo que te pide y vuelve a guardar, o toca “Reintentar”.',
    },
    next: 'poner-el-texto-grande',
  },

  'poner-el-texto-grande': {
    description:
      'Cómo poner el texto más grande en ZigZag para leer mejor en tu teléfono.',
    intro:
      'Si te cuesta leer, ZigZag puede poner todo el texto más grande. Es un solo botón y se queda así en ese teléfono.',
    steps: [
      {
        title: 'Toca Más',
        body: 'Está abajo a la derecha. En la computadora, ve a la parte de abajo de la barra de la izquierda.',
        piece: { kind: 'more-sheet', items: ['Servicios', 'Clientes', 'Mi empresa', 'Texto grande'], highlight: 'Texto grande' },
      },
      {
        title: 'Prende Texto grande',
        body: 'Toca el interruptor junto a “Texto grande”. Todo ZigZag se ve más grande al momento. Pruébalo aquí.',
        piece: { kind: 'text-size-switch', initial: false },
      },
      {
        title: 'Se queda en este teléfono',
        body: 'No tienes que hacerlo cada vez. En otro teléfono o en la computadora, préndelo ahí también. Para regresar al tamaño normal, apágalo.',
        piece: { kind: 'text-size-switch', initial: true },
      },
    ],
    next: 'invitar-a-mi-equipo',
  },

  'invitar-a-mi-equipo': {
    description:
      'Cómo agregar a tu equipo en ZigZag: nombre, correo, rol y una contraseña temporal que tú le pasas.',
    intro:
      'Agrega a tus técnicos para que hagan tickets desde su teléfono. Tú le das su acceso: no se manda correo de invitación.',
    steps: [
      {
        title: 'Abre Mi empresa',
        body: 'En el teléfono toca “Más” y luego “Mi empresa”. En la computadora está en la barra de la izquierda. Entra a la pestaña “Equipo”.',
        piece: { kind: 'more-sheet', items: MORE_MENU, highlight: 'Mi empresa' },
      },
      {
        title: 'Toca Agregar persona',
        body: 'En Equipo ves a todos con su rol. En el teléfono, “Agregar persona” está abajo; en la computadora, arriba de la lista.',
        piece: {
          kind: 'team-list',
          members: [
            { name: 'Jorge Ramírez', role: 'Admin', access: 'Activo' },
            { name: 'Ana Torres', role: 'Operador', access: 'Activo' },
          ],
          ring: 'add',
        },
      },
      {
        title: 'Escribe nombre, correo y rol',
        body: 'Con ese correo va a entrar. Elige su rol: Operador hace tickets, clientes y servicios; Solo lectura solo consulta. Toca “Agregar”.',
        piece: {
          kind: 'invite-form',
          name: 'Luis Méndez',
          email: 'luis@ejemplo.com',
          roles: ['Admin', 'Operador', 'Solo lectura'],
          role: 'Operador',
        },
      },
      {
        title: 'Pásale su contraseña',
        body: 'ZigZag crea una “Contraseña temporal”. Toca “WhatsApp” para mandársela con su correo, o “Copiar”. Se muestra una sola vez.',
        piece: { kind: 'temporary-password', name: 'Luis Méndez', password: 'kemo-7pdx' },
      },
      {
        title: 'Que entre y la cambie',
        body: 'Entra con su correo y esa contraseña, y ZigZag le pide “Elige tu contraseña nueva”. Mientras no la cambie, en Equipo sale “Debe cambiar contraseña”.',
        piece: {
          kind: 'team-list',
          members: [{ name: 'Luis Méndez', role: 'Operador', access: 'Debe cambiar contraseña' }],
          ring: 'none',
        },
      },
    ],
    next: 'elegir-que-ve-cada-quien',
  },

  'elegir-que-ve-cada-quien': {
    description:
      'Cómo elegir qué ve y qué edita cada persona de tu equipo en ZigZag con roles: Ver o Editar por módulo.',
    intro:
      'Un rol dice qué puede ver y qué puede cambiar una persona. Usa los que ya trae ZigZag o crea uno a tu medida.',
    steps: [
      {
        title: 'Abre Roles y toca Nuevo rol',
        body: 'Entra a Mi empresa y a la pestaña “Roles”. Ahí están Admin, Operador y Solo lectura, que trae ZigZag. Toca “Nuevo rol”.',
        piece: {
          kind: 'roles-list',
          roles: [
            { name: 'Admin', people: 1, hint: 'Rol administrador con acceso completo dentro de la empresa' },
            { name: 'Operador', people: 2, hint: 'Puede gestionar tickets, clientes y servicios pero no administración global' },
          ],
        },
      },
      {
        title: 'Ponle nombre y una plantilla',
        body: 'Escribe el “Nombre del rol”, por ejemplo Técnico de campo. En “Empezar desde una plantilla” toca Administrador, Técnico o Solo lectura para no empezar de cero.',
        piece: { kind: 'role-template', name: 'Técnico de campo', template: 'tecnico' },
      },
      {
        title: 'Marca Ver o Editar',
        body: 'Por cada módulo: Ver deja mirar; Editar deja crear y cambiar. Editar incluye Ver. Mi empresa tiene una sola casilla, Administrar. Pruébalo aquí y luego toca “Crear rol”.',
        piece: { kind: 'role-permissions-grid', template: 'tecnico' },
      },
      {
        title: 'Dale el rol a la persona',
        body: 'En Equipo toca ⋯ junto a la persona, luego “Cambiar rol”. Elige el rol y toca “Guardar rol”. Aplica desde su siguiente acción.',
        piece: {
          kind: 'team-list',
          members: [
            { name: 'Luis Méndez', role: 'Operador', access: 'Activo' },
            { name: 'Ana Torres', role: 'Operador', access: 'Activo' },
          ],
          ring: 'change-role',
        },
      },
    ],
    note: {
      title: '¿No puedes cambiar Admin, Operador o Solo lectura?',
      body: 'Son roles compartidos de ZigZag. Ábrelo y toca “Duplicar” para hacer tu copia y cambiar esa.',
    },
  },
};
