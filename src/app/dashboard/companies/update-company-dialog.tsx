'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { updateCompany } from '@/actions/companies';
import { useRouter } from 'next/navigation';
import type { Company } from '@/db/schema';
import { toast } from 'sonner';
import { useEffect } from 'react';

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('El correo electrónico no es válido'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  address: z.string().min(1, 'La dirección es requerida'),
  logo: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface UpdateCompanyDialogProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateCompanyDialog({
  company,
  open,
  onOpenChange,
}: UpdateCompanyDialogProps) {
  const router = useRouter();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: company.name,
      email: company.email,
      phone: company.phone,
      address: company.address,
      logo: company.logo || '',
    },
  });
  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    form.reset({
      name: company.name,
      email: company.email,
      phone: company.phone,
      address: company.address,
      logo: company.logo || '',
    });
  }, [company, form]);

  async function onSubmit(data: FormData) {
    const result = await updateCompany(company.id, data);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onOpenChange(false);
    router.refresh();
    toast.success('Empresa actualizada correctamente');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          form.reset({
            name: company.name,
            email: company.email,
            phone: company.phone,
            address: company.address,
            logo: company.logo || '',
          });
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actualizar Empresa</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
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
                    <Input {...field} />
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL del Logo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Actualizando...' : 'Actualizar Empresa'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
