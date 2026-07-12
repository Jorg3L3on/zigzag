'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
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
import { toast } from 'sonner';
import { createClient, updateClient, Client } from '@/actions/clients';
import { useCompany } from '@/contexts/company-context';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import { cn } from '@/lib/utils';

const PHONE_MIN_DIGITS = 7;
const PHONE_MAX_DIGITS = 20;

const sanitizePhoneDigits = (value: string) => value.replace(/\D/g, '');

const clientSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z
    .string()
    .min(1, 'El teléfono es requerido')
    .regex(/^\d+$/, 'El teléfono solo puede contener números')
    .min(PHONE_MIN_DIGITS, `El teléfono debe tener al menos ${PHONE_MIN_DIGITS} dígitos`)
    .max(PHONE_MAX_DIGITS, `El teléfono no puede exceder ${PHONE_MAX_DIGITS} dígitos`),
  email: z
    .string()
    .trim()
    .pipe(
      z.union([
        z.literal(''),
        z.string().email('El correo electrónico no es válido'),
      ]),
    ),
  street: z.string().optional().or(z.literal('')),
  exterior_number: z.string().optional().or(z.literal('')),
  interior_number: z.string().optional().or(z.literal('')),
  neighborhood: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  postal_code: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
});

type ClientFormValues = z.infer<typeof clientSchema>;

const emptyToNull = (value: string | null | undefined) => {
  const nextValue = value?.trim();
  return nextValue ? nextValue : null;
};

interface ClientFormProps {
  client?: Client;
  compact?: boolean;
  onSuccess?: (savedClient?: Client) => void;
  onCancel?: () => void;
}

export function ClientForm({
  client,
  compact = false,
  onSuccess,
  onCancel,
}: ClientFormProps) {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: client?.name ?? '',
      phone: client?.phone ? sanitizePhoneDigits(client.phone) : '',
      email: client?.email ?? '',
      street: client?.street ?? client?.address ?? '',
      exterior_number: client?.exterior_number ?? '',
      interior_number: client?.interior_number ?? '',
      neighborhood: client?.neighborhood ?? '',
      city: client?.city ?? '',
      state: client?.state ?? '',
      postal_code: client?.postal_code ?? '',
      country: client?.country ?? 'México',
    },
  });

  const onSubmit = async (data: ClientFormValues) => {
    if (!selectedCompany?.id) {
      toast.error('Selecciona una empresa para continuar. Código: CO006');
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = {
        ...data,
        email: emptyToNull(data.email),
        address: null,
        street: emptyToNull(data.street),
        exterior_number: emptyToNull(data.exterior_number),
        interior_number: emptyToNull(data.interior_number),
        neighborhood: emptyToNull(data.neighborhood),
        city: emptyToNull(data.city),
        state: emptyToNull(data.state),
        postal_code: emptyToNull(data.postal_code),
        country: emptyToNull(data.country),
        company_id: selectedCompany.id,
      };

      if (client) {
        const result = await updateClient({
          id: client.id,
          ...formData,
        });

        if (result.success) {
          toast.success('Cliente actualizado correctamente');
          onSuccess?.(result.data);
          if (!onSuccess) {
            router.push('/clients');
            router.refresh();
          }
        } else {
          const errorType = classifyClientError(null, undefined, result.errorType);
          toast.error(
            getErrorMessageByType(
              errorType,
              result.error || 'Error al actualizar el cliente',
            ),
          );
        }
      } else {
        const result = await createClient(formData);

        if (result.success) {
          toast.success('Cliente creado correctamente');
          onSuccess?.(result.data);
          if (!onSuccess) {
            router.push('/clients');
            router.refresh();
          }
        } else {
          const errorType = classifyClientError(null, undefined, result.errorType);
          toast.error(
            getErrorMessageByType(
              errorType,
              result.error || 'Error al crear el cliente',
            ),
          );
        }
      }
    } catch (error) {
      console.error(error);
      const errorType = classifyClientError(error);
      toast.error(
        getErrorMessageByType(errorType, 'Error al procesar la solicitud'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn(compact && 'flex min-h-0 min-w-0 flex-1 flex-col')}>
      <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          compact ? 'gap-0' : 'space-y-8',
        )}
      >
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto',
            compact ? 'space-y-4 px-6 py-4' : 'space-y-8',
          )}
        >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Nombre del cliente" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="Teléfono del cliente"
                  maxLength={PHONE_MAX_DIGITS}
                  {...field}
                  onChange={(event) =>
                    field.onChange(sanitizePhoneDigits(event.target.value))
                  }
                />
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
              <FormLabel>Correo</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="Correo del cliente (opcional)"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Dirección</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Todos los campos de dirección son opcionales.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Calle</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nombre de la calle"
                      autoComplete="street-address"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="exterior_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número exterior</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. 123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="interior_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número interior</FormLabel>
                  <FormControl>
                    <Input placeholder="Opcional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="neighborhood"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Colonia</FormLabel>
                  <FormControl>
                    <Input placeholder="Colonia o barrio" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ciudad o municipio</FormLabel>
                  <FormControl>
                    <Input autoComplete="address-level2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <Input autoComplete="address-level1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postal_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código postal</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="CP"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>País</FormLabel>
                  <FormControl>
                    <Input autoComplete="country-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        </div>

        <div
          className={cn(
            'flex shrink-0 flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4',
            compact &&
              'border-t border-border/60 bg-background px-6 py-4',
          )}
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-10"
            onClick={() => {
              if (onCancel) {
                onCancel();
                return;
              }

              router.push('/clients');
            }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 sm:min-h-10"
          >
            {isSubmitting ? 'Guardando...' : client ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Form>
    </div>
  );
}
