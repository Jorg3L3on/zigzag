import { AppButton, AppField } from '@/components/ayuda/pieces/app-field';
import { APP_MUTED, APP_PIECE_CARD } from '@/components/ayuda/pieces/app-look';

type InviteFormPieceProps = { name: string; email: string; roles: string[]; role: string };

/** "Agregar persona" sheet (TeamMemberSheet): name, email, the role list and Agregar (ringed). */
export const InviteFormPiece = ({ name, email, roles, role }: InviteFormPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex flex-col gap-3 p-3.5`}>
    <span className="flex flex-col">
      <strong className="text-base font-semibold">Agregar persona</strong>
      <span className={APP_MUTED}>Entra con su correo y una contraseña temporal que tú le pasas.</span>
    </span>
    <AppField label="Nombre" value={name} />
    <AppField label="Correo electrónico" value={email} />
    <span className="font-medium">Rol</span>
    {roles.map((item) => (
      <span
        key={item}
        className={`flex min-h-11 items-center gap-3 rounded-xl border px-3.5 ${
          item === role ? 'border-[#2563EB] bg-[#DBEAFE]/60 font-semibold' : 'border-[#E2E8F0]'
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full border-2 ${
            item === role ? 'border-[#2563EB] bg-[#2563EB]' : 'border-[#94A3B8]'
          }`}
        />
        {item}
      </span>
    ))}
    <AppButton primary ringed>
      Agregar
    </AppButton>
  </div>
);

type TemporaryPasswordPieceProps = { name: string; password: string };

/** The box under the form once the person is added (TeamTemporaryPasswordBox), WhatsApp ringed. */
export const TemporaryPasswordPiece = ({ name, password }: TemporaryPasswordPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex flex-col gap-2 p-3.5`}>
    <span className="font-medium">Contraseña temporal</span>
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-xl font-semibold tracking-wider">{password}</span>
      <span className="ml-auto flex gap-2">
        <AppButton>Copiar</AppButton>
        <AppButton ringed>WhatsApp</AppButton>
      </span>
    </span>
    <span className={APP_MUTED}>
      {name} ya está en tu equipo. Se muestra una sola vez. Deberá cambiarla al entrar. No hay
      correo de invitación.
    </span>
  </div>
);
