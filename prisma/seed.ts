import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  // Insertar compania raiz para contexto multi-tenant
  await prisma.company.create({
    data: {
      id: 1,
      name: 'Root Company',
      address: 'Local Address',
      phone: '0000000000',
      email: 'root@local.dev',
      is_system: true,
    },
  });

  // Insertar servicios
  await prisma.service.createMany({
    data: [
      {
        id: 1,
        name: 'Mantenimiento A/C',
        description: 'Mantenimiento general de aire acondicionado',
        price: 700.0,
      },
      {
        id: 2,
        name: 'Instalación A/C',
        description: 'Instalación de nuevo equipo de aire acondicionado',
        price: 1200.0,
      },
      {
        id: 3,
        name: 'Revisión de forros de tuvería',
        description: 'Revisión y ajuste de forros de tubería',
        price: 0.0,
      },
      {
        id: 4,
        name: 'Ajuste de presión de Refrigerador',
        description: 'Ajuste de presión en sistema de refrigeración',
        price: 0.0,
      },
      {
        id: 5,
        name: 'Lavado de condensador',
        description: 'Limpieza y lavado de condensador',
        price: 0.0,
      },
      {
        id: 6,
        name: 'Desmontar equipo',
        description: 'Desmontaje de equipo de aire acondicionado',
        price: 0.0,
      },
    ],
  });

  // Insertar tickets
  await prisma.ticket.createMany({
    data: [
      {
        id: 1,
        client_name: 'Primera prueba',
        client_tel: '9613151559',
        ticket_date: new Date('2024-10-02'),
        email: 'jorgeleon983@gmail.com',
        finished: false,
        created_at: new Date('2024-10-03T08:20:32'),
        updated_at: new Date('2024-10-03T08:20:32'),
      },
      {
        id: 2,
        client_name: 'Segunda prueba',
        client_tel: '9613151559',
        ticket_date: new Date('2024-10-01'),
        email: 'jorgeleon983@gmail.com',
        finished: false,
        created_at: new Date('2024-10-03T08:31:56'),
        updated_at: new Date('2024-10-03T08:31:56'),
      },
    ],
  });

  // Insertar relación services_tickets
  await prisma.servicesTickets.create({
    data: {
      id: 1,
      service_id: 2,
      ticket_id: 1,
      price: 1200.0,
      quantity: 1,
      created_at: new Date('2024-10-03T08:22:41'),
      updated_at: new Date('2024-10-03T08:22:41'),
    },
  });

  // Insertar usuario
  await prisma.user.create({
    data: {
      id: 1,
      name: 'jorge',
      email: 'jorgeleon983@outlook.com',
      company_id: 1,
      password:
        '$2b$12$XRd9/lHxdk7pzGgss6VIEuHvGFImk0198cPJRyEYOsXKSYTImV2pi',
      created_at: new Date('2024-10-03T08:15:18'),
      updated_at: new Date('2024-10-03T08:15:18'),
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
