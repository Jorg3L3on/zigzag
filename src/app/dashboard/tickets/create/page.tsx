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
import { Input } from '@/components/ui/input';
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

const formSchema = z.object({
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

export default function CreateTicketPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_name: '',
      client_tel: '',
      email: '',
      document: '',
      ticket_date: undefined,
      services: [],
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const result = await createTicket(values);
      if (result.success && result.data) {
        toast.success('Ticket creado correctamente');
        router.push(`/dashboard/tickets/${result.data.id}/services`);
      } else {
        toast.error('No se pudo crear el ticket');
      }
    } catch {
      toast.error('Ocurrió un error');
    }
  }

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
                <BreadcrumbPage>Crear Ticket</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full max-w-2xl">
          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">
                    Información del Cliente
                  </CardTitle>
                  <CardDescription>
                    Completa todos los campos para crear el ticket
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
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-8"
                >
                  <div className="grid gap-6">
                    <FormField
                      control={form.control}
                      name="client_name"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-sm font-medium text-foreground">
                            Nombre del cliente o empresa
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="Hotel Ejemplo, Empresa ABC..."
                                className="pl-10 h-12 border-2 focus:border-primary transition-colors"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-6 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="client_tel"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel className="text-sm font-medium text-foreground">
                              Número de teléfono
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  placeholder="55 1234 5678"
                                  className="pl-10 h-12 border-2 focus:border-primary transition-colors"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel className="text-sm font-medium text-foreground">
                              Correo electrónico
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  type="email"
                                  placeholder="ejemplo@correo.com"
                                  className="pl-10 h-12 border-2 focus:border-primary transition-colors"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

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
                                <div
                                  className={cn(
                                    'w-full h-12 border-2 pl-10 text-left font-normal hover:border-primary transition-colors flex items-center cursor-pointer rounded-md',
                                    !field.value && 'text-muted-foreground',
                                  )}
                                >
                                  <CalendarComponent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                  {field.value ? (
                                    format(field.value, 'PPP', { locale: es })
                                  ) : (
                                    <span>Selecciona una fecha</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </div>
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
                      disabled={form.formState.isSubmitting}
                    >
                      {form.formState.isSubmitting ? (
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
