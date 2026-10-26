'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { addTeamMember, updateTeamMember } from '@/actions/team';
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
import type { ActionErrorType } from '@/lib/errors';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  teamRolePickerOptions,
  type TeamMember,
  type TeamRoleOption,
} from '@/lib/team-members';
import { TeamRolePicker } from './team-role-picker';
import { TeamSheet } from './team-sheet';
import {
  TeamTemporaryPasswordBox,
  TeamTemporaryPasswordNotice,
  type CreatedTeamMember,
} from './team-temporary-password-box';

const memberSchema = z
  .object({
    mode: z.enum(['add', 'edit']),
    name: z.string().trim().min(1, 'El nombre es requerido'),
    email: z.string().trim().email('El correo electrónico no es válido'),
    role_id: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    // Editing only touches name and email.
    if (data.mode === 'add' && !data.role_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Elige un rol', path: ['role_id'] });
    }
  });

type MemberValues = z.infer<typeof memberSchema>;

export const showTeamActionError = (
  result: { error?: string; errorType?: ActionErrorType },
  fallback: string,
) => {
  const type = classifyClientError(null, undefined, result.errorType);
  toast.error(getErrorMessageByType(type, result.error || fallback));
};

type TeamMemberSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: TeamRoleOption[];
  /** Edit mode when set; add mode otherwise. */
  member?: TeamMember | null;
  /** For the WhatsApp text of a new person. */
  companyName: string;
  onSaved: () => void;
};

/**
 * Phones (ZIG-I3-4): add or edit a person in a bottom sheet. Adding makes a
 * temporary password on the server, shown once (ZIG-I32), like the desktop
 * `TeamMemberPanel`.
 */

export const TeamMemberSheet = ({
  open,
  onOpenChange,
  roles,
  member,
  companyName,
  onSaved,
}: TeamMemberSheetProps) => {
  const isEdit = Boolean(member);
  const [created, setCreated] = useState<CreatedTeamMember | null>(null);
  const form = useForm<MemberValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      mode: 'add',
      name: '',
      email: '',
      role_id: undefined,
    },
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

  const onSubmit = async (values: MemberValues) => {
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

  return (
    <TeamSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Editar persona' : 'Agregar persona'}
      description={
        isEdit
          ? 'Actualiza el nombre o el correo de esta persona.'
          : 'Entra con su correo y una contraseña temporal que tú le pasas.'
      }
    >
      {created ? (
        <div className="space-y-4">
          <TeamTemporaryPasswordBox created={created} companyName={companyName} />
          <Button type="button" className="min-h-11 w-full" onClick={() => onOpenChange(false)}>
            Listo
          </Button>
        </div>
      ) : (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
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
                      name="team-member-role"
                      roles={teamRolePickerOptions(roles)}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <TeamTemporaryPasswordNotice />
              </>
            )}
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-h-11">
                {isSubmitting
                  ? 'Guardando…'
                  : isEdit
                    ? 'Guardar cambios'
                    : 'Agregar'}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </TeamSheet>
  );
};
