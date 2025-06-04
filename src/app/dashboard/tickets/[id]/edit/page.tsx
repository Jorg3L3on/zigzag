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
} from 'lucide-react';
import * as React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useEffect, useState, useRef } from 'react';
import InvoiceTemplate from '@/components/pdf/invoice-template';
import html2pdf from 'html2pdf.js';
import { getClients, Client } from '@/actions/clients';
import { useCompany } from '@/contexts/company-context';

const formSchema = z.object({
  client_id: z.number().optional(),
  client_name: z.string().min(1, 'El nombre es obligatorio'),
  client_tel: z.string().min(1, 'El teléfono es obligatorio'),
  email: z.string().email('Correo inválido').optional(),
  document: z.string().optional(),
  ticket_date: z.date({ required_error: 'Selecciona una fecha' }),
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
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = React.use(params);
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const [ticketServices, setTicketServices] = useState<ServiceTicket[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
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

  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const response = await fetch(`/api/tickets/${resolvedParams.id}`);
        const data = await response.json();

        if (data.success) {
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

          // If there's a client_id, fetch the client details
          if (data.data.client_id) {
            const clientsResult = await getClients(selectedCompany?.id ?? null);
            if (clientsResult.success && clientsResult.data) {
              const client = clientsResult.data.find(
                (c) => c.id === data.data.client_id,
              );
              if (client) {
                setSelectedClient(client);
              }
            }
          }
        } else {
          toast.error('No se pudo cargar el ticket');
          router.push('/dashboard/tickets');
        }
      } catch (error: unknown) {
        console.error('Error fetching ticket:', error);
        toast.error('Ocurrió un error al cargar el ticket');
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  async function onSubmit(values: FormValues) {
    try {
      const result = await updateTicket(Number(resolvedParams.id), values);
      if (result.success) {
        toast.success('Ticket actualizado correctamente');
        router.push('/dashboard/tickets');
      } else {
        toast.error('No se pudo actualizar el ticket');
      }
    } catch {
      toast.error('Ocurrió un error');
    }
  }

  const generatePDF = async () => {
    try {
      const documentName = `${form.getValues('client_name')}_${format(
        new Date(),
        'yyyy-MM-dd',
      )}.pdf`;

      if (pdfRef.current) {
        const element = pdfRef.current;
        const opt = {
          margin: 0.2,
          filename: documentName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 1.5,
            useCORS: true,
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
          },
        };

        // Generate PDF
        const pdf = await html2pdf().set(opt).from(element).output('blob');

        // Create a URL for the PDF
        const pdfUrl = URL.createObjectURL(pdf);

        // Open PDF in new tab
        window.open(pdfUrl, '_blank');

        // Create FormData and append the PDF
        const formData = new FormData();
        formData.append('file', pdf, documentName);

        // Upload the PDF to the server
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload PDF');
        }

        const uploadResult = await uploadResponse.json();

        // Update ticket with PDF information
        const result = await finishTicket(
          Number(resolvedParams.id),
          uploadResult.path,
          calculateTotal(),
        );

        if (result.success) {
          toast.success('PDF generado correctamente');
          router.push('/dashboard/tickets');
        } else {
          toast.error('No se pudo generar el PDF');
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Ocurrió un error al generar el PDF');
    }
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/tickets">
                  Tickets
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Editar Ticket</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full max-w-2xl">
          <Card className="border-0 shadow-lg mb-6">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">
                    Información del Cliente
                  </CardTitle>
                  <CardDescription>
                    Información del cliente asociado al ticket
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {!isFinished && (
                    <Button
                      onClick={generatePDF}
                      className="h-12 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 transform hover:scale-[1.02]"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Generar PDF
                    </Button>
                  )}
                </div>
              </div>
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
                              </PopoverContent>
                            )}
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {!isFinished && (
                    <div className="flex flex-col gap-4 pt-6">
                      <Button
                        type="submit"
                        className="h-12 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 transform hover:scale-[1.02]"
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
                            Actualizar Ticket
                          </>
                        )}
                      </Button>

                      <p className="text-center text-xs text-muted-foreground">
                        Los cambios se guardarán automáticamente
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
                    onClick={() =>
                      router.push(
                        `/dashboard/tickets/${resolvedParams.id}/services`,
                      )
                    }
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
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
                  <div
                    key={serviceTicket.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium">
                        {serviceTicket.service.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {serviceTicket.service.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Cantidad</p>
                        <p className="font-medium">{serviceTicket.quantity}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Precio</p>
                        <p className="font-medium">
                          {formatCurrency(serviceTicket.price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Subtotal</p>
                        <p className="font-medium">
                          {formatCurrency(
                            serviceTicket.quantity * serviceTicket.price,
                          )}
                        </p>
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div style={{ display: 'none' }}>
        <div ref={pdfRef}>
          <InvoiceTemplate
            data={{
              clientName: form.getValues('client_name'),
              clientAddress: form.getValues('client_tel'),
              clientCity: '',
              clientCountry: 'México',
              invoiceNumber: resolvedParams.id.toString().padStart(6, '0'),
              issueDate: form.getValues('ticket_date')
                ? format(form.getValues('ticket_date'), 'dd/MM/yyyy')
                : format(new Date(), 'dd/MM/yyyy'),
              dueDate: format(new Date(), 'dd/MM/yyyy'),
              items: ticketServices.map((st) => ({
                description: st.service.name,
                quantity: st.quantity.toString(),
                unitPrice: st.price.toFixed(2),
                total: (st.quantity * st.price).toFixed(2),
              })),
              total: calculateTotal().toFixed(2),
            }}
          />
        </div>
      </div>
    </>
  );
}
