'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { updateTicket, getTicketById } from '@/actions/tickets';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  User,
  Mail,
  Phone,
  Loader2,
  CheckCircle2,
  PlusCircle,
  Download,
} from 'lucide-react';
import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useEffect, useState } from 'react';
import type { Company } from '@/db/schema';
import { getClients, Client } from '@/actions/clients';
import { useCompany } from '@/contexts/company-context';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledMobileStickyActionBar,
  TripledPageHeader,
  TripledStepper,
} from '@/components/tripled';
import { ClientPhoneLink } from '@/components/client-phone-link';
import { fetchAndDeliverTicketInvoice } from '@/lib/ticket-invoice-download';
import {
  buildToastErrorContent,
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import {
  buildTicketDraftStorageKey,
  clearTicketFormDraft,
  readTicketFormDraft,
  writeTicketFormDraft,
} from '@/lib/ticket-form-drafts';
import { isTicketFullyPaid } from '@/lib/ticket-payment-status';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const EDIT_TICKET_FORM_ID = 'edit-ticket-form';

const formSchema = z.object({
  client_id: z.number().optional(),
  client_name: z.string().min(1, 'El nombre es obligatorio').max(100),
  client_tel: z.string().min(1, 'El teléfono es obligatorio').max(20),
  email: z.string().email('Correo inválido').max(40).optional(),
  document: z.string().max(100).optional(),
  ticket_date: z.date().optional(),
  services: z.array(
    z.object({
      service_id: z.number(),
      quantity: z.number().finite().min(1),
      price: z.number().finite().min(0),
    }),
  ),
});

type FormValues = z.infer<typeof formSchema>;
const EDIT_TICKET_RETRY_GUIDANCE =
  'Conservamos tus cambios en el formulario. Revisa tu conexión y vuelve a intentar guardar.';

interface ServiceTicket {
  id: number;
  service_id: number;
  quantity: number;
  price: number;
  service: {
    name: string;
    description: string;
  };
}

export default function EditTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const resolvedParams = React.use(params);
  const resolvedSearchParams = React.use(searchParams);
  const router = useRouter();

  React.useEffect(() => {
    if (resolvedSearchParams.step === 'review') {
      router.replace(`/tickets/${resolvedParams.id}`);
    }
  }, [resolvedParams.id, resolvedSearchParams.step, router]);
  const pathname = usePathname();
  const { selectedCompany } = useCompany();
  const [ticketServices, setTicketServices] = useState<ServiceTicket[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [ticketCompany, setTicketCompany] = useState<Company | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [hasLoadedTicket, setHasLoadedTicket] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: undefined,
      client_name: '',
      client_tel: '',
      email: '',
      document: '',
      ticket_date: undefined,
      services: [],
    },
  });

  const { isDirty } = form.formState;
  const draftKey = React.useMemo(
    () =>
      buildTicketDraftStorageKey({
        route: pathname,
        ticketId: resolvedParams.id,
        companyId: selectedCompany?.id,
      }),
    [pathname, resolvedParams.id, selectedCompany?.id],
  );

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const result = await getTicketById(
          Number(resolvedParams.id),
          selectedCompany?.id,
        );

        if (result.success) {
          const data = result.data;
          setTicketCompany(data.company ?? null);
          const totalFromTicket =
            typeof data.total === 'number' ? data.total : 0;
          const paidFromTicket =
            typeof data.paid === 'number' ? data.paid : null;

          const serverValues: FormValues = {
            client_id: data.client_id ?? undefined,
            client_name: data.client_name ?? '',
            client_tel: data.client_tel ?? '',
            email: data.email || '',
            document: data.document || '',
            ticket_date: data.ticket_date
              ? new Date(data.ticket_date)
              : undefined,
            services: data.services_tickets.map((st) => ({
              service_id: st.service_id,
              quantity: st.quantity,
              price: Number(st.price),
            })),
          };
          const draft = readTicketFormDraft(draftKey);
          form.reset(
            draft
              ? {
                  ...serverValues,
                  client_id: draft.client_id ?? serverValues.client_id,
                  client_name: draft.client_name ?? serverValues.client_name,
                  client_tel: draft.client_tel ?? serverValues.client_tel,
                  email: draft.email ?? serverValues.email,
                  document: draft.document ?? serverValues.document,
                  ticket_date: draft.ticket_date
                    ? new Date(draft.ticket_date)
                    : serverValues.ticket_date,
                }
              : serverValues,
          );
          setTicketServices(
            data.services_tickets.map((st) => ({
              id: st.id,
              service_id: st.service_id,
              quantity: st.quantity,
              price: Number(st.price),
              service: {
                name: st.service?.name ?? '',
                description: st.service?.description ?? '',
              },
            })),
          );
          setIsFinished(data.finished);
          setHasLoadedTicket(true);

          if (isTicketFullyPaid(totalFromTicket, paidFromTicket)) {
            toast.error('Este ticket ya está saldado y no se puede editar', {
              description: 'Código: TC010',
            });
            router.replace(`/tickets/${resolvedParams.id}`);
            return;
          }

          if (data.client_id) {
            const clientsResult = await getClients({
              companyId: selectedCompany?.id ?? null,
              page: 1,
              pageSize: 200,
            });
            if (clientsResult.success && clientsResult.data) {
              const client = clientsResult.data.items.find(
                (c) => c.id === data.client_id,
              );
              if (client) {
                setSelectedClient(client);
              }
            }
          }
        } else {
          const errorContent = buildToastErrorContent(
            result,
            'No se pudo cargar el ticket',
            classifyClientError(null, undefined, result.errorType),
          );
          toast.error(errorContent.title, {
            description: errorContent.description,
          });
          router.push('/tickets');
        }
      } catch (error: unknown) {
        console.error('Error fetching ticket:', error);
        const errorType = classifyClientError(error);
        toast.error(
          getErrorMessageByType(errorType, 'Ocurrió un error al cargar el ticket'),
        );
        router.push('/tickets');
      }
    };

    fetchTicket();
  }, [resolvedParams.id, draftKey, form, router, selectedCompany?.id]);

  useEffect(() => {
    if (!hasLoadedTicket || isFinished) return;

    const subscription = form.watch((values) => {
      writeTicketFormDraft(draftKey, {
        client_id: values.client_id,
        client_name: values.client_name,
        client_tel: values.client_tel,
        email: values.email,
        document: values.document,
        ticket_date: values.ticket_date,
      });
    });

    return () => subscription.unsubscribe();
  }, [draftKey, form, hasLoadedTicket, isFinished]);

  useEffect(() => {
    if (!hasLoadedTicket || isFinished) return;

    writeTicketFormDraft(draftKey, {
      client_id: form.getValues('client_id'),
      client_name: form.getValues('client_name'),
      client_tel: form.getValues('client_tel'),
      email: form.getValues('email'),
      document: form.getValues('document'),
      ticket_date: form.getValues('ticket_date'),
    });
  }, [draftKey, form, hasLoadedTicket, isFinished]);

  const calculateTotal = () => {
    return ticketServices.reduce(
      (total, service) => total + service.quantity * service.price,
      0,
    );
  };

  const formatCurrency = (amount: number) => {
    const currency =
      ticketCompany?.settings?.default_currency?.trim() || 'MXN';

    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  async function onSubmit(values: FormValues) {
    try {
      const result = await updateTicket(Number(resolvedParams.id), {
        ...values,
        company_id: selectedCompany?.id ?? ticketCompany?.id ?? undefined,
      });
      if (result.success) {
        toast.success('Ticket actualizado correctamente');
        clearTicketFormDraft(draftKey);
        router.push(`/tickets/${resolvedParams.id}`);
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudo actualizar el ticket',
          ),
          {
            description:
              errorType === 'network' ? EDIT_TICKET_RETRY_GUIDANCE : undefined,
          },
        );
      }
    } catch (error) {
      const errorType = classifyClientError(error);
      const description = getErrorMessageByType(errorType, 'Ocurrió un error');
      toast.error(errorType === 'network' ? 'Sin conexión' : description, {
        description:
          errorType === 'network'
            ? `${description} ${EDIT_TICKET_RETRY_GUIDANCE}`
            : undefined,
      });
    }
  }

  const buildTicketPdfFileName = () =>
    `${form.getValues('client_name')}_${format(new Date(), 'yyyy-MM-dd')}_${resolvedParams.id}.pdf`;

  const downloadServerTicketPdf = () =>
    fetchAndDeliverTicketInvoice({
      ticketId: resolvedParams.id,
      companyId: selectedCompany?.id,
      downloadFileName: buildTicketPdfFileName(),
    });

  const downloadTicketPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const deliveryResult = await downloadServerTicketPdf();
      if (deliveryResult === 'shared') {
        toast.success('PDF compartido correctamente');
      } else if (deliveryResult === 'downloaded') {
        toast.success('PDF descargado correctamente');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('No se pudo generar el PDF. Código: PDF001');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <>
      <TripledPageHeader
        className="hidden md:flex"
        items={[
          { label: 'Tickets', href: '/tickets' },
          {
            label: `Ticket #${resolvedParams.id}`,
            href: `/tickets/${resolvedParams.id}`,
          },
          { label: 'Editar Ticket' },
        ]}
      />

      <TripledDashboardShell
        maxWidthClassName="max-w-2xl"
        hasMobileStickyAction={!isFinished}
      >
          <TripledMobileAppBar
            title={`Ticket #${resolvedParams.id}`}
            subtitle="Editar ticket"
            backHref={`/tickets/${resolvedParams.id}`}
            className="mb-3"
          />
          <TripledStepper
            steps={[
              { id: 'create', title: 'Datos del ticket' },
              { id: 'services', title: 'Servicios' },
              { id: 'review', title: 'Detalle' },
            ]}
            currentStepId={
              resolvedSearchParams.step === 'create'
                ? 'create'
                : resolvedSearchParams.step === 'services'
                  ? 'services'
                  : 'review'
            }
          />
          <Card className="border-0 shadow-lg mb-6">
            <CardHeader className="space-y-4 pb-8">
              <div className="space-y-1">
                <CardTitle className="text-xl">Información del cliente</CardTitle>
                <CardDescription>
                  Información del cliente asociado al ticket
                </CardDescription>
              </div>
              {isFinished && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-100">
                      Ticket finalizado
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-300">
                      Este ticket ya fue finalizado. Puedes descargar el PDF cuando
                      lo necesites.
                    </p>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-background dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                          onClick={downloadTicketPdf}
                          disabled={isGeneratingPdf}
                          aria-label="Descargar PDF del ticket"
                        >
                          {isGeneratingPdf ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden data-icon="inline-start"/>
                          ) : (
                            <Download className="h-4 w-4" aria-hidden data-icon="inline-start"/>
                          )}
                          <span className="sr-only">Descargar PDF</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Descargar PDF</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-8">
              {selectedClient && (
                <div className="rounded-lg border bg-card p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{selectedClient.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <ClientPhoneLink
                        phone={selectedClient.phone}
                        className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    {selectedClient.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedClient.email}</span>
                      </div>
                    )}
                    {selectedClient.document && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Doc:</span>
                        <span>{selectedClient.document}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Form {...form}>
                <form
                  id={EDIT_TICKET_FORM_ID}
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-8"
                >
                  <div className="grid gap-6">
                    <FormField
                      control={form.control}
                      name="ticket_date"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-sm font-medium text-foreground">
                            Fecha de creación
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={cn(
                                    'w-full h-12 pl-10 text-left font-normal hover:border-primary transition-colors relative',
                                    !field.value && 'text-muted-foreground',
                                    isFinished &&
                                      'opacity-50 cursor-not-allowed',
                                  )}
                                  disabled={isFinished}
                                >
                                  <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" data-icon="inline-start"/>
                                  {field.value &&
                                  !isNaN(field.value.getTime()) ? (
                                    format(field.value, 'PPP', { locale: es })
                                  ) : (
                                    <span>Selecciona una fecha</span>
                                  )}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            {!isFinished && (
                              <PopoverContent
                                className="w-auto p-0"
                                align="start"
                              >
                                <CalendarComponent
                                  mode="single"
                                  selected={
                                    field.value && !isNaN(field.value.getTime())
                                      ? field.value
                                      : undefined
                                  }
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date > new Date() ||
                                    date < new Date('1900-01-01')
                                  }
                                  initialFocus
                                />
                                <div className="border-t p-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => field.onChange(new Date())}
                                  >
                                    Hoy
                                  </Button>
                                </div>
                              </PopoverContent>
                            )}
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {!isFinished && (
                    <div className="hidden flex-col gap-4 pt-6 md:flex">
                      {isDirty ? (
                        <Button
                          type="submit"
                          variant="ghost"
                          className="h-12 w-full border border-border hover:bg-muted"
                          disabled={form.formState.isSubmitting}
                        >
                          {form.formState.isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" data-icon="inline-start"/>
                              Actualizando ticket...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" data-icon="inline-start"/>
                              Guardar cambios
                            </>
                          )}
                        </Button>
                      ) : null}

                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full"
                        onClick={() =>
                          router.push(`/tickets/${resolvedParams.id}`)
                        }
                      >
                        Ver ticket
                      </Button>

                      {isDirty ? (
                        <p className="text-center text-xs text-muted-foreground">
                          Guarda cambios si ajustaste la fecha antes de finalizar.
                        </p>
                      ) : null}
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Servicios</CardTitle>
                  <CardDescription>
                    Gestiona los servicios del ticket
                  </CardDescription>
                </div>
                {!isFinished && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      router.push(
                        `/tickets/${resolvedParams.id}/services`,
                      )
                    }
                  >
                    <PlusCircle
                      className="mr-2 h-4 w-4"
                      data-icon="inline-start"
                    />
                    Gestionar servicios
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ticketServices.map((serviceTicket) => (
                  <div key={serviceTicket.id} className="rounded-lg border p-4">
                    <div className="space-y-4">
                      <div className="min-w-0">
                        <h3 className="font-medium break-words">
                          {serviceTicket.service.name}
                        </h3>
                        <p className="text-sm text-muted-foreground break-words">
                          {serviceTicket.service.description}
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-md border bg-muted/40 p-3">
                          <p className="text-sm text-muted-foreground">Cantidad</p>
                          <p className="font-medium break-all">
                            {serviceTicket.quantity}
                          </p>
                        </div>
                        <div className="rounded-md border bg-muted/40 p-3">
                          <p className="text-sm text-muted-foreground">Precio</p>
                          <p className="font-medium break-all">
                            {formatCurrency(serviceTicket.price)}
                          </p>
                        </div>
                        <div className="rounded-md border bg-muted/40 p-3">
                          <p className="text-sm text-muted-foreground">Subtotal</p>
                          <p className="font-medium break-all">
                            {formatCurrency(
                              serviceTicket.quantity * serviceTicket.price,
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {ticketServices.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    No hay servicios asignados a este ticket
                  </div>
                )}

                <div className="mt-6 text-right">
                  <p className="text-xl font-bold">
                    Total: {formatCurrency(calculateTotal())}
                  </p>
                </div>

                {!isFinished && (
                  <div className="mt-6 rounded-lg border bg-muted/20 p-4">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-foreground">
                        Finalizar ticket
                      </p>
                      <p className="text-xs text-muted-foreground">
                        El pago inicial y el recibo se registran desde el detalle
                        del ticket.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        onClick={() =>
                          router.push(`/tickets/${resolvedParams.id}#finalizar`)
                        }
                      >
                        Ir a finalizar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
      </TripledDashboardShell>

      {!isFinished && (
        <TripledMobileStickyActionBar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {isDirty ? 'Cambios pendientes' : 'Sin cambios pendientes'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Ticket #{resolvedParams.id}
            </p>
          </div>
          <Button
            type="submit"
            form={EDIT_TICKET_FORM_ID}
            className="h-12 shrink-0 rounded-xl bg-primary px-5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            disabled={form.formState.isSubmitting || !isDirty}
          >
            {form.formState.isSubmitting ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden
                data-icon="inline-start"
              />
            ) : (
              'Guardar'
            )}
          </Button>
        </TripledMobileStickyActionBar>
      )}

    </>
  );
}
