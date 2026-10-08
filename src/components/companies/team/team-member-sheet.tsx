'use client';

import { useEffect } from 'react';
import { useForm, type Control } from 'react-hook-form';
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
import { PasswordInput } from '@/components/ui/password-input';
import type { ActionErrorType } from '@/lib/errors';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import type { TeamMember, TeamRoleOption } from '@/lib/team-members';
import { TeamRolePicker } from './team-role-picker';
import { TeamSheet } from './team-sheet';

const PASSWORD_MIN_LENGTH = 8;

const memberSchema = z
  .object({
    mode: z.enum(['add', 'edit']),
    name: z.string().trim().min(1, 'El nombre es requerido'),
    email: z.string().trim().email('El correo electrónico no es válido'),
    role_id: z.number().optional(),
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    // Editing only touches name and email.
    if (data.mode === 'edit') {
      return;
    }
    if (!data.role_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Elige un rol', path: ['role_id'] });
    }
    if (data.password.length < PASSWORD_MIN_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
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
  });

type MemberValues = z.infer<typeof memberSchema>;

/**
 * v1 onboarding (ZIG-I3-3, option C): the admin sets the first password and
 * shares it. Email invitations will replace this block.
 */
const TeamPasswordFields = ({ control }: { control: Control<MemberValues> }) => (
  <div className="space-y-4">
    <FormField
      control={control}
      name="password"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Contraseña inicial</FormLabel>
          <FormControl>
            <PasswordInput {...field} autoComplete="new-password" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={control}
      name="confirmPassword"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Confirmar contraseña</FormLabel>
          <FormControl>
            <PasswordInput {...field} autoComplete="new-password" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <p className="text-xs text-muted-foreground">
      Compártela con la persona por un medio seguro; podrá cambiarla en Mi cuenta.
    </p>
  </div>
);

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
  onSaved: () => void;
};

export const TeamMemberSheet = ({
  open,
  onOpenChange,
  roles,
  member,
  onSaved,
}: TeamMemberSheetProps) => {
  const isEdit = Boolean(member);
  const form = useForm<MemberValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      mode: 'add',
      name: '',
      email: '',
      role_id: undefined,
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    form.reset({
      mode: member ? 'edit' : 'add',
      name: member?.name ?? '',
      email: member?.email ?? '',
      role_id: undefined,
      password: '',
      confirmPassword: '',
    });
  }, [form, member, open]);

  const onSubmit = async (values: MemberValues) => {
    if (member) {
      const result = await updateTeamMember(member.id, {
        name: values.name.trim(),
        email: values.email.trim(),
      });
      if (!result.success) {
        showTeamActionError(result, 'No se pudo actualizar el usuario');
        return;
      }
      toast.success('Usuario actualizado');
    } else {
      const result = await addTeamMember({
        name: values.name.trim(),
        email: values.email.trim(),
        role_id: values.role_id ?? 0,
        password: values.password,
      });
      if (!result.success) {
        showTeamActionError(result, 'No se pudo agregar el usuario');
        return;
      }
      toast.success('Usuario agregado al equipo');
    }
    onOpenChange(false);
    onSaved();
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <TeamSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Editar usuario' : 'Agregar usuario'}
      description={
        isEdit
          ? 'Actualiza el nombre o el correo de esta persona.'
          : 'La persona entrará con este correo y la contraseña que definas.'
      }
    >
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
                    roles={roles}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <TeamPasswordFields control={form.control} />
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
                  : 'Agregar usuario'}
            </Button>
          </div>
        </form>
      </Form>
    </TeamSheet>
  );
};
