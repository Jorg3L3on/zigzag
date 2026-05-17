'use client';

import React from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { Service } from '@/db/schema';
import { createService } from '@/actions/services';
import { useCompany } from '@/contexts/company-context';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import { Loader2, CheckCircle2 } from 'lucide-react';

const serviceSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().min(1, 'La descripción es obligatoria'),
  price: z
    .string()
    .min(1, 'El precio es obligatorio')
    .refine(
      (val) => !Number.isNaN(parseFloat(val)) && parseFloat(val) >= 0,
      'El precio debe ser un número válido',
    ),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

interface ServiceFormProps {
  onSuccess?: (savedService: Service) => void;
  onCancel?: () => void;
}

export function ServiceForm({ onSuccess, onCancel }: ServiceFormProps) {
  const { selectedCompany } = useCompany();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      price: '',
    },
  });

  const handleSubmit = async (data: ServiceFormValues) => {
    if (!selectedCompany?.id) {
      toast.error('Selecciona una empresa para continuar. Código: CO006');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createService({
        name: data.name.trim(),
        description: data.description.trim(),
        price: parseFloat(data.price),
        company_id: selectedCompany.id,
      });

      if (result.success && result.data) {
        toast.success('Servicio creado correctamente');
        form.reset();
        onSuccess?.(result.data);
      } else {
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'Error al crear el servicio',
          ),
        );
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
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="text-sm font-medium text-foreground">
                Nombre del servicio
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Ej: Limpieza de oficinas"
                  className="h-12 border-2 focus:border-primary transition-colors"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="text-sm font-medium text-foreground">
                Descripción
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe el servicio..."
                  className="min-h-[88px] border-2 focus:border-primary transition-colors"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="text-sm font-medium text-foreground">
                Precio base
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="h-12 border-2 pl-8 focus:border-primary transition-colors"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              Volver
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Crear servicio
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
