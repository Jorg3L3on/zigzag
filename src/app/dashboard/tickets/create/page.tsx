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
  company_id: z.number(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateTicketPage() {
  const { selectedCompany } = useCompany();
  const router = useRouter();
  const [clients, setClients] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(true);
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
    const fetchClients = async () => {
      if (selectedCompany?.id) {
        const result = await getClients({
          companyId: selectedCompany.id,
          page: 1,
          pageSize: 200,
        });
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
      }
      setLoading(false);
    };

    fetchClients();
  }, [selectedCompany?.id]);

  const handleClientSelect = (clientId: string) => {
    const client = clients.find((c) => c.id === parseInt(clientId));
    if (client) {
      setSelectedClient(client);
      form.setValue('client_id', client.id);
      form.setValue('client_name', client.name);
      form.setValue('client_tel', client.phone || '');
      form.setValue('email', client.email || '');
      form.setValue('document', client.document || '');
    }
  };

  async function onSubmit(values: FormValues) {
    try {
      setLoading(true);
      console.log('Submitting form with values:', values);
      const result = await createTicket({
        ...values,
        company_id: selectedCompany?.id ?? 0,
      });
      console.log('Create ticket result:', result);
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
      setLoading(false);
    }
  }

  return (
    <>
      <TripledPageHeader
        items={[
          { label: 'Tickets', href: '/dashboard/tickets' },
          { label: 'Crear Ticket' },
        ]}
      />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full max-w-2xl">
          <TripledStepper
            steps={[
              { id: 'create', title: 'Datos del ticket' },
              { id: 'services', title: 'Servicios' },
              { id: 'review', title: 'Revisión y PDF' },
            ]}
            currentStepId="create"
          />
          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">
                    Información del Cliente
                  </CardTitle>
                  <CardDescription>
                    Selecciona un cliente existente o crea uno nuevo
                  </CardDescription>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                  <User className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              <Form {...form}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    console.log('Form submitted');
                    form.handleSubmit(onSubmit)(e);
                  }}
                  className="space-y-8"
                >
                  <div className="grid gap-6">
                    <div className="flex items-center gap-4">
                      <FormField
                        control={form.control}
                        name="client_id"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-sm font-medium text-foreground">
                              Seleccionar Cliente
                            </FormLabel>
                            <Select
                              onValueChange={handleClientSelect}
                              value={field.value?.toString() ?? ''}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12 border-2 focus:border-primary transition-colors">
                                  <SelectValue placeholder="Selecciona un cliente" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {loading ? (
                                  <SelectItem value="loading" disabled>
                                    Cargando...
                                  </SelectItem>
                                ) : (
                                  clients.map((client) => (
                                    <SelectItem
                                      key={client.id}
                                      value={client.id.toString()}
                                    >
                                      {client.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Dialog
                        open={isNewClientDialogOpen}
                        onOpenChange={setIsNewClientDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-12 mt-6"
                          >
                            <Plus className="h-4 w-4 mr-2" />
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
                                    (clientItem) => clientItem.id === savedClient.id,
                                  );
                                  return alreadyExists
                                    ? prevClients
                                    : [savedClient, ...prevClients];
                                });
                                setSelectedClient(savedClient);
                                form.setValue('client_id', savedClient.id);
                                form.setValue('client_name', savedClient.name);
                                form.setValue('client_tel', savedClient.phone || '');
                                form.setValue('email', savedClient.email || '');
                                form.setValue('document', savedClient.document || '');
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

                    {selectedClient && (
                      <div className="rounded-lg border bg-card p-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {selectedClient.name}
                            </span>
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
                              <span className="text-muted-foreground">
                                Doc:
                              </span>
                              <span>{selectedClient.document}</span>
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
                                  variant="outline"
                                  className={cn(
                                    'w-full h-12 pl-10 text-left font-normal hover:border-primary transition-colors relative',
                                    !field.value && 'text-muted-foreground',
                                  )}
                                >
                                  <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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

                  <div className="flex flex-col gap-4 pt-6">
                    <Button
                      type="submit"
                      className="h-12 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 transform hover:scale-[1.02]"
                      disabled={loading || !selectedClient}
                      onClick={() => console.log('Button clicked')}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creando ticket...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Crear Ticket
                        </>
                      )}
                    </Button>

                    <p className="text-center text-xs text-muted-foreground">
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
