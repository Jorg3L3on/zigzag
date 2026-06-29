'use client';

import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/company-context';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledPageHeader,
  TripledStepper,
} from '@/components/tripled';
import { TicketAddServicePanel } from '@/components/tickets/ticket-add-service-panel';
import { TicketServicesTable } from '@/components/tickets/ticket-services-table';
import { useTicketServicesList } from '@/components/tickets/use-ticket-services-list';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function TicketServicesListClient({
  ticketId,
  prefillServiceId,
}: {
  ticketId: string;
  prefillServiceId?: string;
}) {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const {
    services,
    ticketServices,
    filteredServices,
    selectedService,
    quantity,
    price,
    isDialogOpen,
    isSubmitting,
    searchTerm,
    isCreatingNewService,
    setIsDialogOpen,
    setSearchTerm,
    setQuantity,
    setPrice,
    setIsCreatingNewService,
    resetForm,
    handleServiceSelect,
    handleAddService,
    handleUpdateService,
    handleServiceQuantityChange,
    handleServicePriceChange,
    handleDeleteService,
    handleServiceCreated,
  } = useTicketServicesList({
    ticketId,
    companyId: selectedCompany?.id,
    prefillServiceId,
  });

  return (
    <>
      <TripledPageHeader
        className="hidden md:flex"
        items={[
          { label: 'Tickets', href: '/tickets' },
          { label: `Ticket #${ticketId}`, href: `/tickets/${ticketId}/edit` },
          { label: 'Servicios' },
        ]}
      />

      <TripledDashboardShell maxWidthClassName="max-w-2xl">
        <TripledMobileAppBar
          title={`Ticket #${ticketId}`}
          subtitle="Servicios"
          backHref={`/tickets/${ticketId}/edit`}
          className="mb-3"
        />
        <div className="space-y-4">
          <TripledStepper
            steps={[
              { id: 'create', title: 'Datos del ticket' },
              { id: 'services', title: 'Servicios' },
              { id: 'review', title: 'Revisión y PDF' },
            ]}
            currentStepId="services"
          />
          <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl ring-1 ring-black/5 dark:ring-white/10">
            <CardHeader className="border-b border-border/50 bg-gradient-to-br from-muted/35 via-background to-background px-5 py-6 sm:px-8 sm:py-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="text-balance text-2xl font-semibold tracking-tight">
                    Servicios asignados
                  </CardTitle>
                  <CardDescription className="text-base">
                    Lista de servicios asignados a este ticket
                  </CardDescription>
                </div>
                <TicketAddServicePanel
                  isOpen={isDialogOpen}
                  onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                      resetForm();
                    }
                  }}
                  services={services}
                  filteredServices={filteredServices}
                  selectedService={selectedService}
                  onServiceSelect={handleServiceSelect}
                  searchTerm={searchTerm}
                  onSearchTermChange={setSearchTerm}
                  quantity={quantity}
                  onQuantityChange={setQuantity}
                  onQuantityAdjust={(nextValue) =>
                    setQuantity(String(Math.max(nextValue, 1)))
                  }
                  price={price}
                  onPriceChange={setPrice}
                  onPriceAdjust={(nextValue) =>
                    setPrice(String(Math.max(nextValue, 0)))
                  }
                  isCreatingNewService={isCreatingNewService}
                  onStartCreateService={() => setIsCreatingNewService(true)}
                  onCancelCreateService={() => setIsCreatingNewService(false)}
                  onServiceCreated={handleServiceCreated}
                  isSubmitting={isSubmitting}
                  onAddService={handleAddService}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6 px-5 pb-8 pt-6 sm:px-8">
              <TicketServicesTable
                ticketId={ticketId}
                ticketServices={ticketServices}
                onUpdate={handleUpdateService}
                onQuantityInput={handleServiceQuantityChange}
                onPriceInput={handleServicePriceChange}
                onDelete={handleDeleteService}
                onBack={() =>
                  router.push(`/tickets/${ticketId}/edit?step=create`)
                }
                onContinue={() =>
                  router.push(`/tickets/${ticketId}/edit?step=review`)
                }
              />
            </CardContent>
          </Card>
        </div>
      </TripledDashboardShell>
    </>
  );
}
