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
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Wrench } from 'lucide-react';
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
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledResourceCard,
} from '@/components/tripled';
import { useEffect, useState, useCallback } from 'react';
import { useCompany } from '@/contexts/company-context';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import { CompanyEntitlementNotice } from '@/components/companies/company-entitlement-notice';

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().min(1, 'La descripción es obligatoria'),
  price: z
    .string()
    .min(1, 'El precio es obligatorio')
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
      'El precio debe ser un número válido',
    ),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { selectedCompany } = useCompany();
  const router = useRouter();
  const resolvedParams = React.use(params);
  const [serviceId, setServiceId] = useState<string>('');
  const isNew = serviceId === 'new';
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      price: '',
    },
  });

  const fetchService = useCallback(async () => {
    try {
      const response = await fetch(`/api/services/${serviceId}`);
      const data = await response.json();

      if (data.success) {
        form.reset({
          name: data.data.name,
          description: data.data.description,
          price: data.data.price.toString(),
        });
      } else {
        const errorType = classifyClientError(
          null,
          response.status,
          data.errorType,
        );
        toast.error(
          getErrorMessageByType(errorType, 'No se pudo cargar el servicio'),
        );
        router.push('/services');
      }
    } catch (error) {
      console.error('Error fetching service:', error);
      const errorType = classifyClientError(error);
      toast.error(
        getErrorMessageByType(errorType, 'Ocurrió un error al cargar el servicio'),
      );
      router.push('/services');
    }
  }, [serviceId, form, router]);

  useEffect(() => {
    setServiceId(resolvedParams.id);
  }, [resolvedParams.id]);

  useEffect(() => {
    if (!isNew && serviceId) {
      fetchService();
    }
  }, [serviceId, isNew, fetchService]);

  async function onSubmit(values: FormValues) {
    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew
        ? `/api/services?company_id=${selectedCompany?.id}`
        : `/api/services/${serviceId}?company_id=${selectedCompany?.id}`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          price: parseFloat(values.price),
          company_id: selectedCompany?.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          isNew
            ? 'Servicio creado correctamente'
            : 'Servicio actualizado correctamente',
        );
        router.push('/services');
      } else {
        const errorType = classifyClientError(
          null,
          response.status,
          data.errorType,
        );
        toast.error(
          getErrorMessageByType(
            errorType,
            isNew
              ? 'No se pudo crear el servicio'
              : 'No se pudo actualizar el servicio',
          ),
        );
      }
    } catch (e) {
      console.error('Error:', e);
      const errorType = classifyClientError(e);
      toast.error(getErrorMessageByType(errorType, 'Ocurrió un error'));
    }
  }

  return (
    <>
      <header className="hidden h-16 shrink-0 items-center gap-2 md:flex">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/services">
                  Servicios
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {isNew ? 'Nuevo servicio' : 'Editar servicio'}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <TripledDashboardShell maxWidthClassName="max-w-2xl">
        <TripledMobileAppBar
          title={isNew ? 'Nuevo servicio' : 'Editar servicio'}
          subtitle={isNew ? 'Catalogo' : 'Datos del servicio'}
          backHref="/services"
          className="mb-3"
        />
        {isNew ? <CompanyEntitlementNotice metric="services" /> : null}
        <TripledResourceCard
          title={isNew ? 'Nuevo servicio' : 'Editar servicio'}
          description={
            isNew
              ? 'Completa los datos para crear un nuevo servicio.'
              : 'Modifica los datos del servicio.'
          }
          icon={<Wrench className="size-5" aria-hidden />}
        >
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-8"
                >
                  <div className="grid gap-6">
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
                              className="min-h-[100px] border-2 focus:border-primary transition-colors"
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
                            Precio
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
                                className="pl-8 h-12 border-2 focus:border-primary transition-colors"
                                {...field}
                              />
                            </div>
                          </FormControl>
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
                          {isNew
                            ? 'Creando servicio...'
                            : 'Actualizando servicio...'}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {isNew ? 'Crear servicio' : 'Actualizar servicio'}
                        </>
                      )}
                    </Button>

                    <p className="text-center text-xs text-muted-foreground">
                      {isNew
                        ? 'Al crear el servicio, estará disponible inmediatamente para los tickets'
                        : 'Los cambios se guardarán automáticamente'}
                    </p>
                  </div>
                </form>
              </Form>
        </TripledResourceCard>
      </TripledDashboardShell>
    </>
  );
}
