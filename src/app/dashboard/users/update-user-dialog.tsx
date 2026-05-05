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
import { PasswordInput } from '@/components/ui/password-input';
import { updateUser } from '@/actions/users';
import { useRouter } from 'next/navigation';
import { User, Company, Role } from '@/generated/prisma';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCompanies } from '@/actions/companies';
import { getRoles } from '@/actions/roles';
import { Checkbox } from '@/components/ui/checkbox';
import { Resolver } from 'react-hook-form';

const formSchema = z
  .object({
    name: z.string().min(1, 'El nombre es requerido'),
    email: z.string().email('El correo electrónico no es válido'),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    company_id: z.number().min(1, 'La empresa es requerida'),
    role_id: z.number().optional(),
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

interface UpdateUserDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateUserDialog({
  user,
  open,
  onOpenChange,
}: UpdateUserDialogProps) {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as Resolver<FormData>,
    defaultValues: {
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      company_id: user.company_id ?? 0,
      role_id: user.role_id ?? undefined,
      changePassword: false,
    },
  });

  const changePassword = form.watch('changePassword');
  const companyId = form.watch('company_id');

  useEffect(() => {
    const fetchCompanies = async () => {
      const { companies } = await getCompanies();
      if (companies) {
        setCompanies(companies);
      }
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    const fetchRoles = async () => {
      if (companyId) {
        const { roles } = await getRoles();
        if (roles) {
          // Filter roles by company_id
          const companyRoles = roles.filter(
            (role) => role.company_id === companyId,
          );
          setRoles(companyRoles);
          // Keep only roles that belong to the new company
          const currentRoleId = form.getValues('role_id');
          if (
            currentRoleId &&
            !companyRoles.some((role) => role.id === currentRoleId)
          ) {
            form.setValue('role_id', undefined);
          }
        }
      } else {
        setRoles([]);
        form.setValue('role_id', undefined);
      }
    };
    fetchRoles();
  }, [companyId, form]);

  useEffect(() => {
    form.reset({
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      company_id: user.company_id ?? 0,
      role_id: user.role_id ?? undefined,
      changePassword: false,
    });
  }, [user, form]);

  async function onSubmit(data: FormData) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, changePassword, ...userData } = data;
    if (!changePassword) {
      delete userData.password;
    }
    const result = await updateUser(user.id, {
      ...userData,
      password: userData.password || '',
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onOpenChange(false);
    router.refresh();
    toast.success('Usuario actualizado correctamente');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actualizar Usuario</DialogTitle>
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
            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <Select
                    onValueChange={(value: string) => {
                      field.onChange(Number(value));
                      // Reset role when company changes
                      form.setValue('role_id', undefined);
                    }}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una empresa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem
                          key={company.id}
                          value={company.id.toString()}
                        >
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol</FormLabel>
                  <Select
                    onValueChange={(value: string) =>
                      field.onChange(Number(value))
                    }
                    defaultValue={field.value?.toString()}
                    disabled={!form.getValues('company_id')}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id.toString()}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-600"
              type="submit"
            >
              Actualizar Usuario
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
