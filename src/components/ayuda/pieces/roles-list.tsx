import { AppButton } from '@/components/ayuda/pieces/app-field';
import { APP_MUTED, APP_PIECE_CARD } from '@/components/ayuda/pieces/app-look';
import { CompanyTabs } from '@/components/ayuda/pieces/team-list';

type RolesListPieceProps = { roles: Array<{ name: string; people: number; hint: string }> };

/** Mi empresa › Roles on the phone (RolesWorkspace): Nuevo rol (ringed) and the roles. */
export const RolesListPiece = ({ roles }: RolesListPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex flex-col gap-3 p-3.5`}>
    <CompanyTabs active="Roles" />
    <AppButton primary ringed>
      + Nuevo rol
    </AppButton>
    {roles.map((role) => (
      <span key={role.name} className="flex flex-col gap-1 rounded-xl border border-[#E2E8F0] px-3.5 py-3">
        <span className="flex items-center justify-between gap-2">
          <strong className="font-semibold">{role.name}</strong>
          <span className={`rounded-full bg-[#F1F5F9] px-2 py-0.5 font-semibold ${APP_MUTED}`}>
            {role.people === 1 ? '1 usuario' : `${role.people} usuarios`}
          </span>
        </span>
        <span className={APP_MUTED}>{role.hint}</span>
      </span>
    ))}
  </div>
);
