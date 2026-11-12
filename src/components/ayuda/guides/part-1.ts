import type { GuideContent } from '@/components/ayuda/guide-registry';

/**
 * Guides of ZIG-I40-3 (tickets, cobro, presupuestos), keyed by slug. Every
 * label in quotes was checked against the app source; the list is in the PR.
 * Phone first; the computer (from 1024px) is named where it differs.
 */
export const GUIDES_PART_1_CONTENT: Partial<Record<string, GuideContent>> = {
  'agregar-materiales-a-un-ticket': {
    description:
      'Cómo sumar materiales a un servicio del ticket en ZigZag: Materiales, Agregar, cantidad, precio y guardar.',
    intro:
      'Los materiales van dentro de cada servicio: el tubo, el gas o la pieza que pusiste. ZigZag los suma al precio del servicio y salen en el recibo.',
    steps: [
      {
        title: 'Abre el servicio',
        body: 'En un ticket nuevo, toca “Agregar servicio”. Si el ticket ya existe, ábrelo, toca “Editar” en Servicios y luego toca la línea del servicio.',
        piece: {
          kind: 'services-list',
          lines: [{ name: 'Instalación de minisplit 1.5 ton', amount: 2800 }],
        },
      },
      {
        title: 'Toca + Agregar en Materiales',
        body: 'Abajo del servicio está Materiales. Toca “Agregar”. Si el servicio es de tu lista y ya trae materiales, aparecen solos.',
        piece: {
          kind: 'materials-list',
          service: { name: 'Instalación de minisplit 1.5 ton', amount: 2800 },
          materials: [],
          ring: 'add',
        },
      },
      {
        title: 'Elige o escribe el material',
        body: 'En “Mis materiales” lo buscas en tu catálogo. En “Escribir” lo escribes tú. Pon la cantidad y el precio, y toca “Agregar material”.',
        piece: {
          kind: 'material-step',
          mode: 'custom',
          material: { name: 'Tubo de cobre 1/4', quantity: 3, unit: 'm', price: 85 },
        },
      },
      {
        title: 'Revisa la suma',
        body: 'Ves el servicio, los materiales y la Suma. Para cambiar un material, tócalo. Cuando esté bien, toca “Agregar al ticket” (si estás editando, dice “Guardar cambios”).',
        piece: {
          kind: 'materials-list',
          service: { name: 'Instalación de minisplit 1.5 ton', amount: 2800 },
          materials: [
            { name: 'Tubo de cobre 1/4', quantity: 3, unit: 'm', price: 85 },
            { name: 'Cinta para ducto', quantity: 1, price: 60 },
          ],
          ring: 'submit',
        },
      },
      {
        title: 'Guarda el ticket',
        body: 'Toca “Guardar”. Si estabas editando un ticket, el botón dice “Guardar cambios”. En la computadora el botón está a la derecha, junto al Total.',
        piece: { kind: 'save-bar', countLabel: '1 servicio', total: 3115, label: 'Guardar' },
      },
    ],
    note: {
      title: '¿Ya está pagado?',
      body: 'Un ticket Pagado ya no se edita. Si te faltó un material, hazlo en un ticket nuevo.',
    },
    next: 'terminar-un-ticket',
  },

  'terminar-un-ticket': {
    description:
      'Cómo terminar un ticket en ZigZag: di cómo te pagó y toca Terminar y generar recibo.',
    intro:
      'Un ticket queda En proceso mientras trabajas. Al terminarlo dices cómo te pagó y ZigZag hace el recibo.',
    steps: [
      {
        title: 'Abre el ticket',
        body: 'Toca Tickets en la barra de abajo y toca el ticket. Dice “En proceso”. Necesita al menos un servicio para poder terminarlo.',
        piece: {
          kind: 'ticket-actions',
          folio: 'T-0142',
          clientName: 'Hotel Riviera Dorada',
          state: 'working',
          total: 3115,
          paid: 0,
        },
      },
      {
        title: 'Di cómo te pagó',
        body: 'En la tarjeta “Terminar ticket” elige Todo, Una parte o Nada aún. En la computadora la tarjeta está a la derecha y dice “Pagó todo”, “Pagó una parte” y “Aún no paga”. Pruébalo aquí.',
        piece: {
          kind: 'payment-choice',
          initial: 'full',
          explanations: {
            full: 'El ticket queda Pagado.',
            partial:
              'Escribes cuánto te pagó. El ticket queda en Pago parcial y lo que falta va a Cobranza.',
            pending: 'El ticket queda Por cobrar en Cobranza hasta que te pague.',
          },
        },
      },
      {
        title: 'Toca Terminar y generar recibo',
        body: 'ZigZag guarda el pago y hace el recibo en PDF. En la computadora también puedes tocar “Terminar ticket” arriba: te lleva a la misma tarjeta.',
        piece: { kind: 'finish-ticket-card', total: 3115, chosen: 'full' },
      },
      {
        title: 'Manda el recibo',
        body: 'El ticket ya está terminado. Toca “WhatsApp” para mandarle el recibo a tu cliente, o “PDF” para bajarlo.',
        piece: {
          kind: 'ticket-actions',
          folio: 'T-0142',
          clientName: 'Hotel Riviera Dorada',
          state: 'paid',
          total: 3115,
          paid: 3115,
          ring: 'WhatsApp',
        },
      },
    ],
    note: {
      title: '¿Te pregunta por recordatorios?',
      body: 'Si el ticket tiene servicios de tu lista, al terminar sale “Recordatorios de servicio”. Marca los que quieras programar y toca “Terminar y continuar”, o toca “Omitir”. El ticket ya quedó terminado de todos modos.',
    },
    next: 'anotar-un-pago-o-un-anticipo',
  },

  'anotar-un-pago-o-un-anticipo': {
    description:
      'Cómo anotar en ZigZag un anticipo al terminar el ticket y los pagos que llegan después con Cobrar.',
    intro:
      'ZigZag anota lo que te pagan; el dinero no pasa por ZigZag. El primer pago o anticipo se anota al terminar el ticket. Lo que llega después, con Cobrar.',
    steps: [
      {
        title: 'Un anticipo: Una parte',
        body: 'Al crear o terminar el ticket, elige “Una parte” y escribe en “Cuánto pagó” lo que te dio. En la computadora es “Pagó una parte” (dice “Anticipo o primer abono”). El ticket queda terminado y lo que falta, en Cobranza.',
        piece: {
          kind: 'payment-choice',
          initial: 'partial',
          explanations: {
            full: 'Si te pagó todo, el ticket queda Pagado.',
            partial: 'Escribes el anticipo. Lo que falta queda por cobrar en Cobranza.',
            pending: 'Sin anticipo: todo queda por cobrar en Cobranza.',
          },
        },
      },
      {
        title: 'Cuando te pague más, toca Cobrar',
        body: 'Abre el ticket y toca “Cobrar”. También está en Cobranza, en la tarjeta de cada ticket. En la computadora, “Cobrar” está en la tarjeta “Saldo por cobrar”, a la derecha.',
        piece: {
          kind: 'ticket-actions',
          folio: 'T-0138',
          clientName: 'Gimnasio FitPro',
          state: 'partial',
          total: 4200,
          paid: 1500,
          ring: 'Cobrar',
        },
      },
      {
        title: '¿Te pagó todo lo que faltaba?',
        body: 'Toca el botón azul que dice “Pagó todo” y el saldo. El ticket queda Pagado.',
        piece: { kind: 'payment-sheet', total: 4200, paid: 1500, view: 'start' },
      },
      {
        title: '¿Te pagó otra parte?',
        body: 'Toca “Pagó una parte”, escribe en “¿Cuánto pagó?” o toca “La mitad”, y toca “Anotar este pago”. En la computadora eliges “Todo el saldo”, la mitad u “Otro monto” y tocas “Anotar cobro”.',
        piece: { kind: 'payment-sheet', total: 4200, paid: 1500, view: 'partial', amount: 1000 },
      },
      {
        title: 'Listo',
        body: 'Sale “Cobro anotado”, o “Listo, quedó pagado” si ya no debe nada. El saldo baja y el pago queda en la lista de pagos del ticket.',
        piece: {
          kind: 'ticket-actions',
          folio: 'T-0138',
          clientName: 'Gimnasio FitPro',
          state: 'partial',
          total: 4200,
          paid: 2500,
        },
      },
    ],
    note: {
      title: '¿Y si el ticket no está terminado?',
      body: 'Un ticket En proceso no tiene Cobrar: el primer pago se anota al terminarlo, en la tarjeta “Terminar ticket”.',
    },
    next: 'ver-quien-me-debe',
  },

  'ver-quien-me-debe': {
    description:
      'Cómo ver en Cobranza de ZigZag qué tickets tienen saldo, cuánto te deben y desde cuándo.',
    intro:
      'Cobranza junta los tickets terminados que tienen saldo: quién te debe, cuánto y desde cuándo. Lo que sigue En proceso no sale aquí.',
    steps: [
      {
        title: 'Toca Cobranza',
        body: 'Está en la barra de abajo. En la computadora está en el menú de la izquierda.',
        piece: { kind: 'dock-tab', tab: 'Cobranza' },
      },
      {
        title: 'Mira quién te debe',
        body: 'Arriba ves cuántos tickets tienen saldo y el “Total por cobrar”. En “Ordenar” eliges “Días sin pagar”, “Mayor saldo” o “Más recientes”. En la computadora, las tarjetas de arriba separan “0–30 días”, “31–90 días” y “Más de 90 días”.',
        piece: {
          kind: 'cobranza-list',
          count: 3,
          totalDue: 7450,
          ring: 'sort',
          card: {
            clientName: 'Plaza Comercial Aurora',
            folio: 'T-0121',
            services: 'Mantenimiento preventivo A/C',
            dateLabel: '28 oct 2026',
            days: 15,
            total: 3600,
            paid: 1000,
          },
        },
      },
      {
        title: 'Recuérdale por WhatsApp',
        body: 'Toca “Recordar por WhatsApp”. Se abre tu WhatsApp con el saldo escrito; tú lo mandas. Si el cliente no tiene teléfono, dice “Sin teléfono”. En la computadora está en el menú ⋯ de cada renglón.',
        piece: {
          kind: 'cobranza-list',
          count: 3,
          totalDue: 7450,
          ring: 'whatsapp',
          card: {
            clientName: 'Plaza Comercial Aurora',
            folio: 'T-0121',
            services: 'Mantenimiento preventivo A/C',
            dateLabel: '28 oct 2026',
            days: 15,
            total: 3600,
            paid: 1000,
          },
        },
      },
      {
        title: 'Cuando te pague, toca Cobrar',
        body: 'Toca “Cobrar” en su tarjeta y anota lo que te dio. Si ya no debe nada, el ticket sale de Cobranza.',
        piece: {
          kind: 'cobranza-list',
          count: 3,
          totalDue: 7450,
          ring: 'cobrar',
          card: {
            clientName: 'Plaza Comercial Aurora',
            folio: 'T-0121',
            services: 'Mantenimiento preventivo A/C',
            dateLabel: '28 oct 2026',
            days: 15,
            total: 3600,
            paid: 1000,
          },
        },
      },
    ],
    next: 'mandar-el-recibo-por-whatsapp',
  },

  'mandar-el-recibo-por-whatsapp': {
    description:
      'Cómo mandar el recibo de un ticket por WhatsApp desde ZigZag: el mensaje con los montos o el PDF.',
    intro:
      'Cuando terminas un ticket, ZigZag hace el recibo. Puedes mandarlo por WhatsApp como mensaje con los montos o como PDF.',
    steps: [
      {
        title: 'Al terminar, toca Enviar recibo',
        body: 'Si terminas el ticket al crearlo, ZigZag te pregunta “¿Le envías el recibo a tu cliente?”. Toca “Enviar recibo” y elige WhatsApp. Si no es buen momento, toca “Ahora no”.',
        piece: {
          kind: 'share-receipt',
          view: 'prompt',
          folio: 'T-0142',
          clientName: 'Sra. Lupita',
          companyName: 'Clima Express',
          total: 1650,
          paid: 1650,
        },
      },
      {
        title: 'Después: abre el ticket y toca WhatsApp',
        body: 'En cualquier momento abre el ticket terminado y toca “WhatsApp”. Si el cliente no tiene teléfono, ese botón no sale. En la computadora está en el menú ⋯ de arriba.',
        piece: {
          kind: 'ticket-actions',
          folio: 'T-0142',
          clientName: 'Sra. Lupita',
          state: 'paid',
          total: 1650,
          paid: 1650,
          ring: 'WhatsApp',
        },
      },
      {
        title: 'Revisa el mensaje y envíalo',
        body: 'Se abre tu WhatsApp con el número del cliente y este mensaje escrito. Tú tocas enviar. Si queda saldo, el mensaje lo dice y lleva tus datos para transferencia si los diste de alta.',
        piece: {
          kind: 'share-receipt',
          view: 'message',
          folio: 'T-0142',
          clientName: 'Sra. Lupita',
          companyName: 'Clima Express',
          total: 1650,
          paid: 1650,
        },
      },
      {
        title: '¿Quieres mandar el PDF?',
        body: 'En un ticket Pagado toca “Compartir recibo” abajo y elige WhatsApp: se manda el recibo en PDF. Con saldo, toca “PDF” para bajarlo y mándalo tú. En la computadora, “Compartir recibo” está en el menú ⋯.',
        piece: {
          kind: 'share-receipt',
          view: 'share-bar',
          folio: 'T-0142',
          clientName: 'Sra. Lupita',
          companyName: 'Clima Express',
          total: 1650,
          paid: 1650,
        },
      },
    ],
    note: {
      title: 'El recibo no es factura.',
      body: 'No es un CFDI: dice qué hiciste y cuánto te pagaron. Si tu cliente necesita factura, hazla en tu sistema de facturación. ZigZag tampoco cobra por ti: sólo anota los pagos.',
    },
    next: 'hacer-un-presupuesto',
  },

  'hacer-un-presupuesto': {
    description:
      'Cómo hacer un presupuesto en ZigZag: cliente, vigencia, servicios, Guardar y compartirlo.',
    intro:
      'Un presupuesto es una cotización: lo que cobrarías antes de hacer el trabajo. No cuenta en Cobranza ni en Hoy hasta que lo conviertes en ticket.',
    steps: [
      {
        title: 'Toca + y elige Nuevo presupuesto',
        body: 'El + está en medio de la barra de abajo. En la computadora entra a Presupuestos y toca “Nuevo presupuesto”.',
        piece: { kind: 'create-menu', item: 'Nuevo presupuesto' },
      },
      {
        title: 'Elige al cliente',
        body: 'Toca “Busca o elige un cliente” y tócalo en la lista. Si es nuevo, toca “Nuevo cliente”.',
        piece: {
          kind: 'client-card',
          name: 'Plaza Comercial Aurora',
          phone: '998 765 4321',
          dateLabel: 'Hoy, 12 nov',
        },
      },
      {
        title: 'Di hasta cuándo vale',
        body: 'En “Vence” toca 7, 15 o 30 días, o elige otra fecha. Es opcional: si no eliges, queda “Sin vencimiento”.',
        piece: { kind: 'expires-at-field', days: 15, dateLabel: '27 de noviembre' },
      },
      {
        title: 'Agrega los servicios',
        body: 'Toca “Agregar servicio”, elige uno de tu lista y toca “Agregar al presupuesto”. También puedes sumarle materiales. ZigZag hace la suma.',
        piece: {
          kind: 'services-list',
          lines: [
            { name: 'Instalación de minisplit 1.5 ton', amount: 2800 },
            { name: 'Base para condensadora', amount: 650 },
          ],
        },
      },
      {
        title: 'Toca Guardar',
        body: 'En la computadora el botón dice “Guardar presupuesto”. Se abre el presupuesto con su folio.',
        piece: { kind: 'save-bar', countLabel: '2 servicios', total: 3450, label: 'Guardar' },
      },
      {
        title: 'Compártelo',
        body: 'Toca “Compartir” arriba y elige WhatsApp: se manda el PDF. En la computadora tienes los botones WhatsApp y PDF.',
        piece: {
          kind: 'presupuesto-card',
          view: 'detail',
          folio: 'P-0031',
          clientName: 'Plaza Comercial Aurora',
          total: 3450,
          expiresLabel: 'Vence el 27 de noviembre',
          ring: 'share',
        },
      },
    ],
    next: 'convertir-un-presupuesto-a-ticket',
  },

  'convertir-un-presupuesto-a-ticket': {
    description:
      'Cómo convertir en ZigZag un presupuesto aceptado en un ticket con los mismos servicios y precios.',
    intro:
      'Cuando el cliente acepta, conviertes el presupuesto en ticket. No vuelves a escribir nada: pasan los mismos servicios y precios.',
    steps: [
      {
        title: 'Abre el presupuesto',
        body: 'Toca Más en la barra de abajo, luego Presupuestos, y toca el presupuesto. En la computadora, Presupuestos está en el menú de la izquierda.',
        piece: {
          kind: 'presupuesto-card',
          view: 'row',
          folio: 'P-0031',
          clientName: 'Plaza Comercial Aurora',
          total: 3450,
          expiresLabel: 'Vence el 27 de noviembre',
        },
      },
      {
        title: 'Toca Convertir a ticket',
        body: 'Está en la tarjeta “¿Lo aceptó el cliente?”. En la computadora también está arriba, junto al título. Un presupuesto Vencido también se puede convertir.',
        piece: {
          kind: 'presupuesto-card',
          view: 'detail',
          folio: 'P-0031',
          clientName: 'Plaza Comercial Aurora',
          total: 3450,
          expiresLabel: 'Vence el 27 de noviembre',
          ring: 'convert',
        },
      },
      {
        title: 'Confirma',
        body: 'ZigZag te pregunta si lo conviertes. Toca “Convertir a ticket”. El presupuesto queda como Aceptado y se abre el ticket nuevo.',
        piece: {
          kind: 'presupuesto-card',
          view: 'confirm',
          folio: 'P-0031',
          clientName: 'Plaza Comercial Aurora',
          total: 3450,
          expiresLabel: 'Vence el 27 de noviembre',
        },
      },
      {
        title: 'Trabaja y termina el ticket',
        body: 'El ticket nace En proceso. Cuando acabes, termínalo en la tarjeta “Terminar ticket” y di cómo te pagó. Si te dio anticipo, elige “Una parte”.',
        piece: { kind: 'finish-ticket-card', total: 3450, chosen: 'partial' },
      },
    ],
    note: {
      title: '¿Dónde quedó el ticket?',
      body: 'Desde el presupuesto Aceptado, “Ver ticket” te lleva al ticket que se creó.',
    },
    next: 'terminar-un-ticket',
  },
};
