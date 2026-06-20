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
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { createRole } from '@/actions/roles';
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
import type { Company, Permission } from '@/db/schema';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  company_id: z.number().min(1, 'La empresa es requerida'),
  permissions: z.array(z.number()),
});

type FormData = z.infer<typeof formSchema>;

type CreateRoleDialogProps = {
  onCreated?: () => void;
  defaultCompanyId?: number;
  defaultCompanyName?: string;
  lockCompany?: boolean;
};

export function CreateRoleDialog({
  onCreated,
  defaultCompanyId,
  defaultCompanyName,
  lockCompany = false,
}: CreateRoleDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(
    [],
  );
  const router = useRouter();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      company_id: 0,
      permissions: [],
    },
  });
  const companyId = form.watch('company_id');
  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    if (lockCompany && defaultCompanyId) {
      form.setValue('company_id', defaultCompanyId);
      return;
    }
    const fetchCompanies = async () => {
      const result = await getCompanies();
      if (result.success && result.data) {
        setCompanies(result.data);
      }
    };
    void fetchCompanies();
  }, [defaultCompanyId, form, lockCompany]);

  useEffect(() => {
    if (defaultCompanyId && open) {
      form.setValue('company_id', defaultCompanyId);
    }
  }, [defaultCompanyId, form, open]);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (companyId) {
        const result = await getPermissionsByCompany(companyId);
        if (result.success && result.data) {
          setPermissions(result.data);
          // Clear selected permissions when company changes
          setSelectedPermissions([]);
          form.setValue('permissions', []);
        }
      } else {
        setPermissions([]);
        setSelectedPermissions([]);
        form.setValue('permissions', []);
      }
    };
    fetchPermissions();
  }, [companyId, form]);

  async function onSubmit(data: FormData) {
    const result = await createRole(data);
    if (!result.success) {
      const errorType = classifyClientError(null, undefined, result.errorType);
      toast.error(
        getErrorMessageByType(
          errorType,
          result.error || 'Error al crear el rol',
        ),
      );
      return;
    }

    toast.success('Rol creado correctamente');
    setOpen(false);
    form.reset();
    onCreated?.();
    router.refresh();
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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          form.reset();
          setSelectedPermissions([]);
          setPermissions([]);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
          <Plus className="mr-2 h-4 w-4" />
          Crear rol
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear rol</DialogTitle>
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
                  {lockCompany && defaultCompanyId ? (
                    <FormControl>
                      <Input
                        readOnly
                        aria-readonly="true"
                        value={
                          defaultCompanyName ??
                          companies.find((row) => row.id === defaultCompanyId)
                            ?.name ??
                          `Empresa #${defaultCompanyId}`
                        }
                      />
                    </FormControl>
                  ) : (
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(Number(value))}
                        value={field.value ? field.value.toString() : undefined}
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
                  )}
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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creando...' : 'Crear rol'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
