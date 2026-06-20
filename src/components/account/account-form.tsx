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
import { updateOwnAccount } from '@/actions/users';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect } from 'react';
import { Resolver } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import { getErrorMessageByType } from '@/lib/network-awareness';

const formSchema = z
  .object({
    name: z.string().min(1, 'El nombre es requerido'),
    email: z.string().email('El correo electrónico no es válido'),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
    changePassword: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.changePassword) {
      if (!data.currentPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La contraseña actual es requerida',
          path: ['currentPassword'],
        });
      }
      if (!data.newPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La nueva contraseña es requerida',
          path: ['newPassword'],
        });
      } else if (data.newPassword.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La contraseña debe tener al menos 8 caracteres',
          path: ['newPassword'],
        });
      }
      if (data.newPassword !== data.confirmPassword) {
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
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      changePassword: false,
    },
  });

  const changePassword = form.watch('changePassword');
  const email = form.watch('email');
  const needsCurrentPassword =
    changePassword ||
    Boolean(session?.user?.email && email !== session.user.email);

  useEffect(() => {
    if (session?.user) {
      form.reset({
        name: session.user.name || '',
        email: session.user.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        changePassword: false,
      });
    }
  }, [session, form]);

  async function onSubmit(data: FormData) {
    if (!session?.user) return;

    if (needsCurrentPassword && !data.currentPassword) {
      form.setError('currentPassword', {
        message: 'La contraseña actual es requerida',
      });
      return;
    }

    const result = await updateOwnAccount({
      name: data.name,
      email: data.email,
      currentPassword: needsCurrentPassword
        ? data.currentPassword || undefined
        : undefined,
      newPassword: changePassword ? data.newPassword || undefined : undefined,
      confirmPassword: changePassword
        ? data.confirmPassword || undefined
        : undefined,
    });

    if (result.error) {
      toast.error(
        getErrorMessageByType(result.errorType ?? 'server', result.error),
      );
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
        {needsCurrentPassword && (
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contraseña actual</FormLabel>
                <FormControl>
                  <PasswordInput {...field} autoComplete="current-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
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
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva contraseña</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} autoComplete="new-password" />
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
                    <PasswordInput {...field} autoComplete="new-password" />
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
