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
import { requirePagePermission } from '@/lib/page-authz';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TicketsPage() {
  await requirePagePermission('tickets.read');

  return (
    <>
      <TripledPageHeader items={[{ label: 'Tickets' }]} />

      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-x-hidden p-4 sm:p-6">
        <div className="mx-auto w-full min-w-0">
          <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl ring-1 ring-black/5 dark:ring-white/10">
            <CardHeader className="space-y-0 border-b border-border/50 bg-gradient-to-br from-muted/35 via-background to-background px-5 py-5 sm:px-8 sm:py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0 space-y-1.5">
                  <CardTitle className="text-balance text-2xl font-semibold tracking-tight">
                    Tickets
                  </CardTitle>
                  <CardDescription className="text-base">
                    Lista de todos los tickets registrados
                  </CardDescription>
                </div>
                <Link
                  href="/dashboard/tickets/create"
                  className="shrink-0 self-end sm:self-start"
                >
                  <Button
                    className="min-h-11 gap-1.5 bg-gradient-to-r from-blue-600 to-purple-600 px-4 text-sm font-semibold shadow-md hover:from-blue-700 hover:to-purple-700"
                  >
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                    Nuevo Ticket
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-5 sm:p-6 sm:pt-6">
              <TicketsList />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
