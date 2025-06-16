'use client';

import { useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { updateRole } from '@/actions/roles';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCompanies } from '@/actions/companies';
import { getPermissionsByCompany } from '@/actions/permissions';
import { Company, Permission } from '@/generated/prisma';
import { Role } from './columns';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  company_id: z.number().min(1, 'La empresa es requerida'),
  permissions: z.array(z.number()),
});

type FormData = z.infer<typeof formSchema>;

interface UpdateRoleDialogProps {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateRoleDialog({
  role,
  open,
  onOpenChange,
}: UpdateRoleDialogProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(
    [],
  );
  const router = useRouter();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: role.name,
      description: role.description || '',
      company_id: role.company?.id || 0,
      permissions: role.permissions.map((p) => p.permission.id),
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
    const fetchPermissions = async () => {
      const companyId = form.getValues('company_id');
      if (companyId) {
        const { permissions } = await getPermissionsByCompany(companyId);
        if (permissions) {
          setPermissions(permissions);
          // Keep only permissions that belong to the new company
          const validPermissions = role.permissions
            .map((p) => p.permission)
            .filter((p) => permissions.some((np) => np.id === p.id));
          setSelectedPermissions(validPermissions);
          form.setValue(
            'permissions',
            validPermissions.map((p) => p.id),
          );
        }
      } else {
        setPermissions([]);
        setSelectedPermissions([]);
        form.setValue('permissions', []);
      }
    };
    fetchPermissions();
  }, [form.watch('company_id'), role.permissions]);

  useEffect(() => {
    form.reset({
      name: role.name,
      description: role.description || '',
      company_id: role.company?.id || 0,
      permissions: role.permissions.map((p) => p.permission.id),
    });
  }, [role, form]);

  async function onSubmit(data: FormData) {
    try {
      await updateRole(role.id, data);
      toast.success('Rol actualizado correctamente');
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error('Error al actualizar el rol');
      console.error('Error al actualizar el rol:', error);
    }
  }

  const handlePermissionSelect = (permissionId: string) => {
    const permission = permissions.find(
      (p) => p.id.toString() === permissionId,
    );
    if (
      permission &&
      !selectedPermissions.find((p) => p.id === permission.id)
    ) {
      setSelectedPermissions([...selectedPermissions, permission]);
      form.setValue('permissions', [
        ...form.getValues('permissions'),
        permission.id,
      ]);
    }
  };

  const removePermission = (permissionId: number) => {
    setSelectedPermissions(
      selectedPermissions.filter((p) => p.id !== permissionId),
    );
    form.setValue(
      'permissions',
      form.getValues('permissions').filter((id) => id !== permissionId),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Rol</DialogTitle>
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
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      defaultValue={field.value?.toString()}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una empresa" />
                      </SelectTrigger>
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="permissions"
              render={() => (
                <FormItem>
                  <FormLabel>Permisos</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      <Select onValueChange={handlePermissionSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona permisos" />
                        </SelectTrigger>
                        <SelectContent>
                          {permissions
                            .filter(
                              (p) =>
                                !selectedPermissions.find(
                                  (sp) => sp.id === p.id,
                                ),
                            )
                            .map((permission) => (
                              <SelectItem
                                key={permission.id}
                                value={permission.id.toString()}
                              >
                                {permission.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-2">
                        {selectedPermissions.map((permission) => (
                          <Badge
                            key={permission.id}
                            variant="secondary"
                            className="flex items-center gap-1"
                          >
                            {permission.name}
                            <button
                              type="button"
                              onClick={() => removePermission(permission.id)}
                              className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                              <X className="h-3 w-3" />
                              <span className="sr-only">
                                Remover {permission.name}
                              </span>
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              type="submit"
            >
              Actualizar Rol
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
