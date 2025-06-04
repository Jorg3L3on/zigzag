// /api/companies

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: BigInt(session.user.id) },
      include: { company: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('user', user);

    // If user belongs to system company, show all companies
    if (user.company?.is_system) {
      console.log('user.company.is_system', user.company.is_system);
      const companies = await db.company.findMany({
        include: {
          _count: {
            select: {
              users: true,
              tickets: true,
              services: true,
            },
          },
        },
      });
      return NextResponse.json(companies);
    }

    console.log('user.company_id', user.company_id);

    // If user belongs to a regular company, show only their company
    if (!user.company_id) {
      return NextResponse.json([]);
    }

    const company = await db.company.findUnique({
      where: { id: user.company_id },
      include: {
        _count: {
          select: {
            users: true,
            tickets: true,
            services: true,
          },
        },
      },
    });

    return NextResponse.json(company ? [company] : []);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: BigInt(session.user.id) },
      include: { company: true },
    });

    if (!user || !user.company?.is_system) {
      return NextResponse.json(
        { error: 'Only system company users can create new companies' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const company = await db.company.create({
      data: {
        ...body,
        is_system: false,
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: BigInt(session.user.id) },
      include: { company: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();

    // Only allow system company users to update any company
    // or users to update their own company
    if (!user.company?.is_system && user.company_id !== body.id) {
      return NextResponse.json(
        { error: 'You can only update your own company' },
        { status: 403 },
      );
    }

    const company = await db.company.update({
      where: { id: body.id },
      data: body,
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
