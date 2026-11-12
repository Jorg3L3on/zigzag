'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { addTeamMember, updateTeamMember } from '@/actions/team';
import { SidePanel } from '@/components/motion';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  teamRolePickerOptions,
  type TeamMember,
  type TeamRoleOption,
} from '@/lib/team-members';
import { showTeamActionError } from './team-member-sheet';
import { TeamRolePicker } from './team-role-picker';
import {
  TeamTemporaryPasswordBox,
  type CreatedTeamMember,
} from './team-temporary-password-box';

const panelSchema = z
  .object({
    mode: z.enum(['add', 'edit']),
    name: z.string().trim().min(1, 'El nombre es requerido'),
    email: z.string().trim().email('El correo electrónico no es válido'),
    role_id: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'add' && !data.role_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Elige un rol', path: ['role_id'] });
    }
  });

type PanelValues = z.infer<typeof panelSchema>;

const PANEL_FORM_ID = 'team-member-panel-form';

type TeamMemberPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: TeamRoleOption[];
  /** Edit mode when set (no password box); add mode otherwise. */
  member?: TeamMember | null;
  /** For the WhatsApp text of a new person. */
  companyName: string;
  onSaved: () => void;
};

/**
 * Agregar persona / Editar on md+ (ZIG-I32-2, canvas EmpEquipo): a side panel
 * with Nombre, Correo and Rol. Adding makes a temporary password on the server
 * that is shown here once, with Copiar and WhatsApp; the person replaces it at
 * their first login. Phones keep `TeamMemberSheet`.
 */
export const TeamMemberPanel = ({
  open,
  onOpenChange,
  roles,
  member,
  companyName,
  onSaved,
}: TeamMemberPanelProps) => {
  const isEdit = Boolean(member);
  const [created, setCreated] = useState<CreatedTeamMember | null>(null);
  const form = useForm<PanelValues>({
    resolver: zodResolver(panelSchema),
    defaultValues: { mode: 'add', name: '', email: '', role_id: undefined },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    setCreated(null);
    form.reset({
      mode: member ? 'edit' : 'add',
      name: member?.name ?? '',
      email: member?.email ?? '',
      role_id: undefined,
    });
  }, [form, member, open]);

  const onSubmit = async (values: PanelValues) => {
    if (member) {
      const result = await updateTeamMember(member.id, {
        name: values.name.trim(),
        email: values.email.trim(),
      });
      if (!result.success) {
        showTeamActionError(result, 'No se pudo actualizar a la persona');
        return;
      }
      toast.success('Persona actualizada');
      onOpenChange(false);
      onSaved();
      return;
    }

    const result = await addTeamMember({
      name: values.name.trim(),
      email: values.email.trim(),
      role_id: values.role_id ?? 0,
    });
    if (!result.success || !result.data) {
      showTeamActionError(result, 'No se pudo agregar a la persona');
      return;
    }
    setCreated({
      name: values.name.trim(),
      email: values.email.trim(),
      password: result.data.temporaryPassword,
    });
    onSaved();
  };

  const isSubmitting = form.formState.isSubmitting;
  const roleOptions = teamRolePickerOptions(roles);

  const footer = created ? (
    <div className="flex justify-end">
      <Button type="button" onClick={() => onOpenChange(false)}>
        Listo
      </Button>
    </div>
  ) : (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSubmitting}
      >
        Cancelar
      </Button>
      <Button type="submit" form={PANEL_FORM_ID} disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agregar'}
      </Button>
    </div>
  );

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Editar persona' : 'Agregar persona'}
      description={isEdit ? 'Cambia el nombre o el correo con el que entra.' : undefined}
      footer={footer}
      className="max-w-[380px]"
      data-testid="team-member-panel"
    >
      <Form {...form}>
        <form
          id={PANEL_FORM_ID}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <fieldset disabled={Boolean(created)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="name" placeholder="Nombre y apellido" />
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
                  <FormLabel>Correo electrónico</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="persona@empresa.com"
                    />
                  </FormControl>
                  <FormDescription>Con este correo entra a ZigZag.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isEdit ? null : (
              <>
                <FormField
                  control={form.control}
                  name="role_id"
                  render={({ field, fieldState }) => (
                    <TeamRolePicker
                      name="team-member-panel-role"
                      roles={roleOptions}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </>
            )}
          </fieldset>
          {isEdit ? null : (
            <TeamTemporaryPasswordBox created={created} companyName={companyName} />
          )}
        </form>
      </Form>
    </SidePanel>
  );
};
