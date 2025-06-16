'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus } from 'lucide-react';
import { createUser } from '@/actions/users';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Company, Role } from '@/generated/prisma';
import { getCompanies } from '@/actions/companies';
import { getRoles } from '@/actions/roles';

const formSchema = z
  .object({
    name: z.string().min(1, 'El nombre es requerido'),
    email: z.string().email('El correo electrónico no es válido'),
    password: z.string().min(1, 'La contraseña es requerida'),
    confirmPassword: z.string().min(1, 'La contraseña es requerida'),
    company_id: z.number().min(1, 'La empresa es requerida'),
    role_id: z.number().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof formSchema>;

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const router = useRouter();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      company_id: undefined,
      role_id: undefined,
    },
  });

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
      const companyId = form.getValues('company_id');
      if (companyId) {
        const { roles } = await getRoles();
        if (roles) {
          // Filter roles by company_id
          const companyRoles = roles.filter(
            (role) => role.company_id === companyId,
          );
          setRoles(companyRoles);
        }
      } else {
        setRoles([]);
      }
    };
    fetchRoles();
  }, [form.watch('company_id')]);

  async function onSubmit(data: FormData) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, ...userData } = data;
    const result = await createUser(userData);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    form.reset();
    router.refresh();
    toast.success('Usuario creado correctamente');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-600">
          <Plus className="mr-2 h-4 w-4" />
          Crear Usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Usuario</DialogTitle>
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
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
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              Crear Usuario
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
