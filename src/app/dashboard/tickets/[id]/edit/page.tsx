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
import { updateTicket, finishTicket } from '@/actions/tickets';
import { useRouter } from 'next/navigation';
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
  FileText,
  Download,
  CircleCheck,
  Circle,
  Minus,
  Plus,
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
import { TripledPageHeader, TripledStepper } from '@/components/tripled';
import { buildTicketInvoiceDownloadUrl } from '@/lib/ticket-invoice-url';
import {
  buildToastErrorContent,
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const formSchema = z.object({
  client_id: z.number().optional(),
  client_name: z.string().min(1, 'El nombre es obligatorio'),
  client_tel: z.string().min(1, 'El teléfono es obligatorio'),
  email: z.string().email('Correo inválido').optional(),
  document: z.string().optional(),
  ticket_date: z.date(),
  services: z.array(
    z.object({
      service_id: z.number(),
      quantity: z.number().min(1),
      price: z.number().min(0),
    }),
  ),
});

type FormValues = z.infer<typeof formSchema>;

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
  const { selectedCompany } = useCompany();
  const [ticketServices, setTicketServices] = useState<ServiceTicket[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [ticketCompany, setTicketCompany] = useState<Company | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isFullyPaid, setIsFullyPaid] = useState(true);
  const [paidAmountInput, setPaidAmountInput] = useState('');
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

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const response = await fetch(`/api/tickets/${resolvedParams.id}`);
        const data = await response.json();

        if (data.success) {
          setTicketCompany(data.data.company ?? null);
          const totalFromTicket =
            typeof data.data.total === 'number' ? data.data.total : 0;
          const paidFromTicket =
            typeof data.data.paid === 'number' ? data.data.paid : null;

          form.reset({
            client_id: data.data.client_id,
            client_name: data.data.client_name,
            client_tel: data.data.client_tel,
            email: data.data.email || '',
            document: data.data.document || '',
            ticket_date: data.data.ticket_date
              ? new Date(data.data.ticket_date)
              : undefined,
            services: data.data.services_tickets.map((st: ServiceTicket) => ({
              service_id: st.service_id,
              quantity: st.quantity,
              price: st.price,
            })),
          });
          setTicketServices(data.data.services_tickets);
          setIsFinished(data.data.finished);
          if (paidFromTicket !== null) {
            const normalizedPaid = Math.max(paidFromTicket, 0);
            setIsFullyPaid(normalizedPaid >= totalFromTicket && totalFromTicket > 0);
            setPaidAmountInput(normalizedPaid.toString());
          } else {
            setIsFullyPaid(true);
            setPaidAmountInput('');
          }

          // If there's a client_id, fetch the client details
          if (data.data.client_id) {
            const clientsResult = await getClients({
              companyId: selectedCompany?.id ?? null,
              page: 1,
              pageSize: 200,
            });
            if (clientsResult.success && clientsResult.data) {
              const client = clientsResult.data.items.find(
                (c) => c.id === data.data.client_id,
              );
              if (client) {
                setSelectedClient(client);
              }
            }
          }
        } else {
          const errorContent = buildToastErrorContent(
            data,
            'No se pudo cargar el ticket',
            classifyClientError(null, response.status, data.errorType),
          );
          toast.error(errorContent.title, {
            description: errorContent.description,
          });
          router.push('/dashboard/tickets');
        }
      } catch (error: unknown) {
        console.error('Error fetching ticket:', error);
        const errorType = classifyClientError(error);
        toast.error(
          getErrorMessageByType(errorType, 'Ocurrió un error al cargar el ticket'),
        );
        router.push('/dashboard/tickets');
      }
    };

    fetchTicket();
  }, [resolvedParams.id, form, router, selectedCompany?.id]);

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

  const parsePaidInput = (value: string): number => {
    if (!value.trim()) return 0;
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(parsed, 0);
  };

  const updatePaidAmountInput = (nextValue: number) => {
    setPaidAmountInput(String(Math.max(Number(nextValue.toFixed(2)), 0)));
  };

  const getFinalPaidAmount = (): number => {
    if (isFullyPaid) return calculateTotal();
    return parsePaidInput(paidAmountInput);
  };

  async function onSubmit(values: FormValues) {
    try {
      const result = await updateTicket(Number(resolvedParams.id), values);
      if (result.success) {
        toast.success('Ticket actualizado correctamente');
        router.push('/dashboard/tickets');
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudo actualizar el ticket',
          ),
        );
      }
    } catch (error) {
      const errorType = classifyClientError(error);
      toast.error(getErrorMessageByType(errorType, 'Ocurrió un error'));
    }
  }

  const buildTicketPdfFileName = () =>
    `${form.getValues('client_name')}_${format(new Date(), 'yyyy-MM-dd')}_${resolvedParams.id}.pdf`;

  const downloadServerTicketPdf = async () => {
    const response = await fetch(
      buildTicketInvoiceDownloadUrl(resolvedParams.id, selectedCompany?.id),
      { cache: 'no-store' },
    );

    if (!response.ok) {
      throw new Error(`PDF request failed with status ${response.status}`);
    }

    const pdf = await response.blob();
    const pdfUrl = URL.createObjectURL(pdf);
    const downloadLink = document.createElement('a');
    downloadLink.href = pdfUrl;
    downloadLink.download = buildTicketPdfFileName();
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(pdfUrl);
  };

  const generatePDF = async () => {
    try {
      setIsGeneratingPdf(true);

      const finalPaidAmount = getFinalPaidAmount();
      const total = calculateTotal();

      if (!isFullyPaid && finalPaidAmount > total) {
        toast.error('El monto pagado no puede ser mayor al total. Código: TC009');
        return;
      }

      const result = await finishTicket(
        Number(resolvedParams.id),
        total,
        finalPaidAmount,
      );

      if (result.success) {
        await downloadServerTicketPdf();
        toast.success('PDF generado correctamente');
        setIsFinished(true);
        router.replace(`/dashboard/tickets/${resolvedParams.id}`);
        router.refresh();
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudo generar el PDF',
          ),
        );
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      const errorType = classifyClientError(error);
      toast.error(
        getErrorMessageByType(errorType, 'Ocurrió un error al generar el PDF'),
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const downloadTicketPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await downloadServerTicketPdf();
      toast.success('PDF descargado correctamente');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('No se pudo descargar el PDF. Código: PDF002');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <>
      <TripledPageHeader
        items={[
          { label: 'Tickets', href: '/dashboard/tickets' },
          { label: 'Editar Ticket' },
        ]}
      />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <div className="mx-auto w-full max-w-2xl">
          <TripledStepper
            steps={[
              { id: 'create', title: 'Datos del ticket' },
              { id: 'services', title: 'Servicios' },
              { id: 'review', title: 'Revisión y PDF' },
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
                <CardTitle className="text-xl">Información del Cliente</CardTitle>
                <CardDescription>
                  Información del cliente asociado al ticket
                </CardDescription>
              </div>
              {isFinished && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div>
                    <p className="text-sm font-medium text-emerald-700">
                      Ticket finalizado
                    </p>
                    <p className="text-xs text-emerald-600">
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
                          className="border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
                          onClick={downloadTicketPdf}
                          disabled={isGeneratingPdf}
                          aria-label="Descargar PDF del ticket"
                        >
                          {isGeneratingPdf ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Download className="h-4 w-4" aria-hidden />
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
                      <span>{selectedClient.phone}</span>
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
                                  variant="outline"
                                  className={cn(
                                    'w-full h-12 pl-10 text-left font-normal hover:border-primary transition-colors relative',
                                    !field.value && 'text-muted-foreground',
                                    isFinished &&
                                      'opacity-50 cursor-not-allowed',
                                  )}
                                  disabled={isFinished}
                                >
                                  <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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

                  {!isFinished && isDirty && (
                    <div className="flex flex-col gap-4 pt-6">
                      <Button
                        type="submit"
                        variant="ghost"
                        className="h-12 w-full border border-border hover:bg-muted"
                        disabled={form.formState.isSubmitting}
                      >
                        {form.formState.isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Actualizando ticket...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Guardar cambios
                          </>
                        )}
                      </Button>

                      <p className="text-center text-xs text-muted-foreground">
                        Guarda cambios si ajustaste la fecha antes de finalizar.
                      </p>
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
                        `/dashboard/tickets/${resolvedParams.id}/services`,
                      )
                    }
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Gestionar Servicios
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
                        <p className="text-sm text-gray-500 break-words">
                          {serviceTicket.service.description}
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-md border bg-gray-50 p-3">
                          <p className="text-sm text-gray-500">Cantidad</p>
                          <p className="font-medium break-all">
                            {serviceTicket.quantity}
                          </p>
                        </div>
                        <div className="rounded-md border bg-gray-50 p-3">
                          <p className="text-sm text-gray-500">Precio</p>
                          <p className="font-medium break-all">
                            {formatCurrency(serviceTicket.price)}
                          </p>
                        </div>
                        <div className="rounded-md border bg-gray-50 p-3">
                          <p className="text-sm text-gray-500">Subtotal</p>
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
                  <div className="text-center py-8 text-gray-500">
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
                        Paso final
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Al guardar, se genera el PDF y el ticket quedará en modo
                        solo lectura con el estado de pago seleccionado.
                      </p>
                      <div className="space-y-3 rounded-md border bg-white p-3">
                        <p className="text-sm font-medium text-foreground">
                          Pago del ticket
                        </p>
                        <div className="grid gap-2">
                          <button
                            type="button"
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                              isFullyPaid
                                ? 'border-blue-300 bg-blue-50 text-blue-700'
                                : 'border-border bg-background hover:bg-muted/50',
                            )}
                            onClick={() => setIsFullyPaid(true)}
                          >
                            {isFullyPaid ? (
                              <CircleCheck className="h-4 w-4" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                            Pagado completo ({formatCurrency(calculateTotal())})
                          </button>
                          <button
                            type="button"
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                              !isFullyPaid
                                ? 'border-blue-300 bg-blue-50 text-blue-700'
                                : 'border-border bg-background hover:bg-muted/50',
                            )}
                            onClick={() => setIsFullyPaid(false)}
                          >
                            {!isFullyPaid ? (
                              <CircleCheck className="h-4 w-4" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                            Pago parcial
                          </button>
                        </div>
                        {!isFullyPaid && (
                          <div className="space-y-2">
                            <label
                              htmlFor="paid-amount"
                              className="text-xs text-muted-foreground"
                            >
                              Cuánto pagó el cliente
                            </label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                onClick={() =>
                                  updatePaidAmountInput(
                                    parsePaidInput(paidAmountInput) - 1,
                                  )
                                }
                                aria-label="Reducir monto pagado"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <input
                                id="paid-amount"
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={paidAmountInput}
                                onChange={(event) =>
                                  setPaidAmountInput(event.target.value)
                                }
                                onBlur={(event) =>
                                  updatePaidAmountInput(
                                    parsePaidInput(event.target.value),
                                  )
                                }
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-center text-sm"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                onClick={() =>
                                  updatePaidAmountInput(
                                    parsePaidInput(paidAmountInput) + 1,
                                  )
                                }
                                aria-label="Aumentar monto pagado"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            {parsePaidInput(paidAmountInput) >
                              calculateTotal() && (
                              <p className="text-xs text-red-600">
                                El monto pagado no puede superar el total del
                                ticket.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        onClick={generatePDF}
                        disabled={
                          isGeneratingPdf ||
                          ticketServices.length === 0 ||
                          (!isFullyPaid &&
                            parsePaidInput(paidAmountInput) > calculateTotal())
                        }
                        className="h-12 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200"
                      >
                        {isGeneratingPdf ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <FileText className="mr-2 h-4 w-4" />
                            Guardar y generar PDF
                          </>
                        )}
                      </Button>
                      {ticketServices.length === 0 && (
                        <p className="text-xs text-amber-600">
                          Agrega al menos un servicio para poder guardar el
                          ticket.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

    </>
  );
}
