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
import { createTicket } from '@/actions/tickets';
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
import { useCompany } from '@/contexts/company-context';
import { getClients, Client } from '@/actions/clients';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ClientForm } from '@/components/clients/client-form';
import { TripledPageHeader, TripledStepper } from '@/components/tripled';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';

const formSchema = z.object({
  client_id: z.number().optional(),
  client_name: z.string().min(1, 'El nombre es obligatorio'),
  client_tel: z.string().min(1, 'El teléfono es obligatorio'),
  email: z
    .string()
    .email('Correo inválido')
    .optional()
    .or(z.literal('')),
  document: z.string().optional(),
  ticket_date: z.date(),
  services: z.array(
    z.object({
      service_id: z.number(),
      quantity: z.number().min(1),
      price: z.number().min(0),
    }),
  ),
  company_id: z.number(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateTicketPage() {
  const { selectedCompany } = useCompany();
  const router = useRouter();
  const [clients, setClients] = React.useState<Client[]>([]);
  const [isClientsLoading, setIsClientsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] =
    React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(
    null,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: undefined,
      client_name: '',
      client_tel: '',
      email: '',
      document: '',
      ticket_date: new Date(),
      services: [],
      company_id: selectedCompany?.id ?? 0,
    },
  });

  React.useEffect(() => {
    if (selectedCompany?.id && selectedCompany?.name !== 'System') {
      form.setValue('company_id', selectedCompany.id);
    }
  }, [selectedCompany?.id, selectedCompany?.name, form]);

  React.useEffect(() => {
    let cancelled = false;

    const fetchClients = async () => {
      if (!selectedCompany?.id) {
        if (!cancelled) {
          setIsClientsLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setIsClientsLoading(true);
      }

      const result = await getClients({
        companyId: selectedCompany.id,
        page: 1,
        pageSize: 200,
      });

      if (cancelled) {
        return;
      }

      if (result.success && result.data) {
        setClients(result.data.items);
      } else if (!result.success) {
        const errorType = classifyClientError(
          null,
          undefined,
          result.errorType,
        );
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudieron cargar los clientes',
          ),
        );
      }
      setIsClientsLoading(false);
    };

    void fetchClients();

    return () => {
      cancelled = true;
    };
  }, [selectedCompany?.id]);

  const handleClientSelect = (clientId: string) => {
    const client = clients.find((c) => c.id === parseInt(clientId, 10));
    if (client) {
      setSelectedClient(client);
      form.setValue('client_id', client.id);
      form.setValue('client_name', client.name);
      form.setValue('client_tel', client.phone || '');
      form.setValue('email', client.email || '');
      form.setValue('document', client.document || '');
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      const result = await createTicket({
        ...values,
        company_id: selectedCompany?.id ?? 0,
      });
      if (result.success && result.data) {
        toast.success('Ticket creado correctamente');
        router.push(`/dashboard/tickets/${result.data.id}/services`);
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudo crear el ticket',
          ),
        );
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      const errorType = classifyClientError(error);
      toast.error(
        getErrorMessageByType(errorType, 'Ocurrió un error al crear el ticket'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isClientListEmpty = !isClientsLoading && clients.length === 0;

  return (
    <>
      <TripledPageHeader
        items={[
          { label: 'Tickets', href: '/dashboard/tickets' },
          { label: 'Crear Ticket' },
        ]}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-x-hidden p-4 sm:p-6">
        <div className="mx-auto w-full min-w-0 max-w-2xl space-y-4">
          <TripledStepper
            navigationLabel="Progreso de creación del ticket"
            steps={[
              { id: 'create', title: 'Datos del ticket' },
              { id: 'services', title: 'Servicios' },
              { id: 'review', title: 'Revisión y PDF' },
            ]}
            currentStepId="create"
          />
          <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl ring-1 ring-black/5 dark:ring-white/10">
            <CardHeader className="border-b border-border/50 bg-gradient-to-br from-muted/35 via-background to-background px-5 py-6 sm:px-8 sm:py-7">
              <div className="space-y-1.5">
                <CardTitle className="text-balance text-2xl font-semibold tracking-tight">
                  Información del Cliente
                </CardTitle>
                <CardDescription className="text-base">
                  Selecciona un cliente existente o crea uno nuevo
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 px-5 pb-8 pt-6 sm:px-8">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-8"
                >
                  <div className="grid gap-6">
                    <FormField
                      control={form.control}
                      name="client_id"
                      render={({ field }) => (
                        <FormItem className="min-w-0 space-y-3">
                          <FormLabel className="text-sm font-medium text-foreground">
                            Seleccionar Cliente
                          </FormLabel>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                              <Select
                                disabled={isClientsLoading}
                                onValueChange={handleClientSelect}
                                value={
                                  field.value != null
                                    ? String(field.value)
                                    : undefined
                                }
                              >
                                <FormControl>
                                  <SelectTrigger
                                    className="h-10 w-full border border-input bg-background shadow-sm transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
                                    aria-busy={isClientsLoading}
                                  >
                                    {isClientsLoading ? (
                                      <span className="flex w-full items-center gap-2 text-muted-foreground">
                                        <Loader2
                                          className="h-4 w-4 shrink-0 animate-spin"
                                          aria-hidden
                                        />
                                        <span>Cargando clientes…</span>
                                      </span>
                                    ) : (
                                      <SelectValue placeholder="Selecciona un cliente" />
                                    )}
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {clients.map((client) => (
                                    <SelectItem
                                      key={client.id}
                                      value={client.id.toString()}
                                    >
                                      {client.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <Dialog
                              open={isNewClientDialogOpen}
                              onOpenChange={setIsNewClientDialogOpen}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-10 w-full shrink-0 gap-2 border-input bg-background px-4 shadow-sm transition-colors hover:bg-accent sm:w-auto"
                                >
                                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                                  Nuevo Cliente
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Crear Nuevo Cliente</DialogTitle>
                                  <DialogDescription>
                                    Completa los datos del nuevo cliente
                                  </DialogDescription>
                                </DialogHeader>
                                <ClientForm
                                  onSuccess={(savedClient) => {
                                    setIsNewClientDialogOpen(false);
                                    if (savedClient) {
                                      setClients((prevClients) => {
                                        const alreadyExists = prevClients.some(
                                          (clientItem) =>
                                            clientItem.id === savedClient.id,
                                        );
                                        return alreadyExists
                                          ? prevClients
                                          : [savedClient, ...prevClients];
                                      });
                                      setSelectedClient(savedClient);
                                      form.setValue('client_id', savedClient.id);
                                      form.setValue(
                                        'client_name',
                                        savedClient.name,
                                      );
                                      form.setValue(
                                        'client_tel',
                                        savedClient.phone || '',
                                      );
                                      form.setValue(
                                        'email',
                                        savedClient.email || '',
                                      );
                                      form.setValue(
                                        'document',
                                        savedClient.document || '',
                                      );
                                      return;
                                    }

                                    if (selectedCompany?.id) {
                                      getClients({
                                        companyId: selectedCompany.id,
                                        page: 1,
                                        pageSize: 200,
                                      }).then((result) => {
                                        if (result.success && result.data) {
                                          setClients(result.data.items);
                                        }
                                      });
                                    }
                                  }}
                                />
                              </DialogContent>
                            </Dialog>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isClientListEmpty && (
                      <p
                        className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
                        role="status"
                      >
                        No hay clientes registrados. Usa{' '}
                        <span className="font-medium text-foreground">
                          Nuevo Cliente
                        </span>{' '}
                        para crear el primero.
                      </p>
                    )}

                    {selectedClient && (
                      <div className="rounded-xl border border-border/60 bg-muted/25 p-4 shadow-inner sm:p-5">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Cliente seleccionado
                        </p>
                        <div className="space-y-3 text-sm">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <User
                              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            <span className="font-semibold leading-snug">
                              {selectedClient.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <Phone
                              className="h-4 w-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            <span className="tabular-nums leading-snug">
                              {selectedClient.phone}
                            </span>
                          </div>
                          {selectedClient.email && (
                            <div className="flex min-w-0 items-start gap-2.5">
                              <Mail
                                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                              <span className="break-all leading-snug">
                                {selectedClient.email}
                              </span>
                            </div>
                          )}
                          {selectedClient.document && (
                            <div className="flex flex-wrap gap-x-2 gap-y-1 border-t border-border/50 pt-3 text-muted-foreground">
                              <span className="text-xs font-medium uppercase tracking-wide">
                                Documento
                              </span>
                              <span className="font-medium text-foreground">
                                {selectedClient.document}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

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
                                    'relative h-10 w-full pl-10 text-left font-normal shadow-sm transition-colors hover:border-primary',
                                    !field.value && 'text-muted-foreground',
                                  )}
                                >
                                  <CalendarIcon
                                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden
                                  />
                                  {field.value ? (
                                    format(field.value, 'PPP', { locale: es })
                                  ) : (
                                    <span>Selecciona una fecha</span>
                                  )}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <CalendarComponent
                                mode="single"
                                selected={field.value}
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
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-4 border-t border-border/40 pt-8">
                    <Button
                      type="submit"
                      className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-base font-semibold text-white shadow-md transition-colors duration-200 hover:from-blue-700 hover:to-purple-700 motion-safe:hover:brightness-105"
                      disabled={isSubmitting || !selectedClient}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2
                            className="mr-2 h-4 w-4 animate-spin"
                            aria-hidden
                          />
                          Creando ticket...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                          Crear Ticket
                        </>
                      )}
                    </Button>

                    <p className="mx-auto max-w-md text-center text-xs leading-relaxed text-muted-foreground">
                      Al crear el ticket, se generará automáticamente un número
                      de seguimiento
                    </p>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
