'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { PasswordInput } from '@/components/ui/password-input';
import { toast } from 'sonner';
import { updateUser } from '@/actions/users';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect } from 'react';
import { Resolver } from 'react-hook-form';
import { useSession } from 'next-auth/react';

const formSchema = z
  .object({
    name: z.string().min(1, 'El nombre es requerido'),
    email: z.string().email('El correo electrónico no es válido'),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    changePassword: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.changePassword) {
      if (!data.password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La contraseña es requerida',
          path: ['password'],
        });
      }
      if (data.password !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Las contraseñas no coinciden',
          path: ['confirmPassword'],
        });
      }
    }
  });

type FormData = z.infer<typeof formSchema>;

interface AccountFormProps {
  onSuccess?: () => void;
}

export function AccountForm({ onSuccess }: AccountFormProps) {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as Resolver<FormData>,
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      changePassword: false,
    },
  });

  const changePassword = form.watch('changePassword');

  useEffect(() => {
    if (session?.user) {
      form.reset({
        name: session.user.name || '',
        email: session.user.email || '',
        password: '',
        confirmPassword: '',
        changePassword: false,
      });
    }
  }, [session, form]);

  async function onSubmit(data: FormData) {
    if (!session?.user) return;

    const { changePassword, ...userData } = data;
    if (!changePassword) {
      delete userData.password;
    }

    const result = await updateUser(BigInt(session.user.id), {
      ...userData,
      password: userData.password || '',
      company_id: session.user.company_id,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success('Información actualizada correctamente');
    onSuccess?.();
  }

  if (isLoading) {
    return <div>Cargando...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
          name="changePassword"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Cambiar Contraseña</FormLabel>
              </div>
            </FormItem>
          )}
        />
        {changePassword && (
          <>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Contraseña</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        <Button
          type="submit"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-600"
        >
          Guardar Cambios
        </Button>
      </form>
    </Form>
  );
}
