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
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormProps {
  client?: Client;
  onSuccess?: (savedClient?: Client) => void;
}

export function ClientForm({ client, onSuccess }: ClientFormProps) {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: client?.name ?? '',
      phone: client?.phone ? sanitizePhoneDigits(client.phone) : '',
      email: client?.email ?? '',
      address: client?.address ?? '',
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
        email: data.email || null,
        address: data.address || null,
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
            router.push('/dashboard/clients');
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
            router.push('/dashboard/clients');
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="Email del cliente (opcional)"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección</FormLabel>
              <FormControl>
                <Input
                  placeholder="Dirección del cliente (opcional)"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/clients')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isSubmitting ? 'Guardando...' : client ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
