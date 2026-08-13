'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPresupuesto } from '@/actions/presupuestos';
import { getClients, type Client } from '@/actions/clients';
import { useCompany } from '@/contexts/company-context';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TripledDashboardShell,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';
import { cn } from '@/lib/utils';
import { getErrorDisplayMessage } from '@/lib/network-awareness';

const formSchema = z.object({
  client_id: z.string().optional(),
  client_name: z.string().min(1, 'El nombre del cliente es obligatorio').max(100),
  client_tel: z.string().min(1, 'El teléfono del cliente es obligatorio').max(20),
  email: z.string().email('Correo inválido').max(40).optional().or(z.literal('')),
  ticket_date: z.date(),
  expires_at: z.date().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreatePresupuestoPage() {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const [clients, setClients] = React.useState<Client[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: undefined,
      client_name: '',
      client_tel: '',
      email: '',
      ticket_date: new Date(),
      expires_at: null,
    },
  });

  React.useEffect(() => {
    const loadClients = async () => {
      if (!selectedCompany?.id) {
        setClients([]);
        return;
      }
      const result = await getClients({
        companyId: selectedCompany.id,
        pageSize: 100,
      });
      if (result.success && result.data) {
        setClients(result.data.items);
      }
    };
    void loadClients();
  }, [selectedCompany?.id]);

  const handleClientSelect = (clientId: string) => {
    form.setValue('client_id', clientId);
    const client = clients.find((row) => String(row.id) === clientId);
    if (!client) return;
    form.setValue('client_name', client.name ?? '');
    form.setValue('client_tel', client.phone ?? '');
    form.setValue('email', client.email ?? '');
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!selectedCompany?.id) {
      toast.error('Selecciona una empresa');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createPresupuesto({
        company_id: selectedCompany.id,
        client_id: values.client_id ? Number(values.client_id) : undefined,
        client_name: values.client_name,
        client_tel: values.client_tel,
        email: values.email,
        ticket_date: values.ticket_date,
        expires_at: values.expires_at ?? null,
      });
      if (!result.success || !result.data) {
        toast.error(
          getErrorDisplayMessage(result, 'No se pudo crear el presupuesto'),
        );
        return;
      }
      toast.success('Presupuesto creado. Agrega servicios desde el ticket.');
      router.push(`/tickets/${result.data.id}/services`);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <>
      <TripledPageHeader
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Presupuestos', href: '/presupuestos' },
          { label: 'Nuevo' },
        ]}
      />
      <TripledDashboardShell>
        <TripledResourceCard
          title="Nuevo presupuesto"
          description="Cotiza con cliente y fecha. Luego agrega servicios y convierte a ticket."
        >
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormItem>
                <FormLabel>Cliente existente</FormLabel>
                <Select
                  onValueChange={handleClientSelect}
                  value={form.watch('client_id')}
                >
                  <SelectTrigger aria-label="Seleccionar cliente">
                    <SelectValue placeholder="Opcional — autocompleta datos" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={String(client.id)}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>

              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del cliente</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_tel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="tel" autoComplete="tel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" autoComplete="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ticket_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              'min-h-11 justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" aria-hidden />
                            {field.value
                              ? format(field.value, 'PPP', { locale: es })
                              : 'Elegir fecha'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => date && field.onChange(date)}
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expires_at"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Vence (opcional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              'min-h-11 justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" aria-hidden />
                            {field.value
                              ? format(field.value, 'PPP', { locale: es })
                              : 'Sin fecha de vencimiento'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ?? undefined}
                          onSelect={(date) => field.onChange(date ?? null)}
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={submitting || !selectedCompany?.id}
                  className="min-h-11"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  Crear presupuesto
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => router.push('/presupuestos')}
                >
                  Volver
                </Button>
              </div>
            </form>
          </Form>
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
