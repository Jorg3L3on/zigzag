import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import TicketsList from '@/components/tickets/tickets-list';
import { TripledPageHeader } from '@/components/tripled';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TicketsPage() {
  return (
    <>
      <TripledPageHeader items={[{ label: 'Tickets' }]} />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full">
          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Tickets</CardTitle>
                  <CardDescription>
                    Lista de todos los tickets registrados
                  </CardDescription>
                </div>
                <Link href="/dashboard/tickets/create">
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Ticket
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <TicketsList />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
