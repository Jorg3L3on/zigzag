import { AppButton } from '@/components/ayuda/pieces/app-field';
import {
  APP_MUTED,
  APP_PIECE_CARD,
  TOUCH_RING_SM,
} from '@/components/ayuda/pieces/app-look';

type TeamListPieceProps = {
  members: Array<{ name: string; role: string; access: string }>;
  ring: 'add' | 'change-role' | 'none';
};

/** Mi empresa tabs, as CompanyHubTabs draws them on the phone. */
export const CompanyTabs = ({ active }: { active: 'Equipo' | 'Roles' }) => (
  <span className="flex gap-1 rounded-xl bg-[#F1F5F9] p-1">
    {['Datos', 'Equipo', 'Roles'].map((tab) => (
      <span
        key={tab}
        className={`flex-1 rounded-lg py-1.5 text-center ${
          tab === active ? 'bg-white font-semibold shadow-sm' : APP_MUTED
        }`}
      >
        {tab}
      </span>
    ))}
  </span>
);

/**
 * Mi empresa › Equipo on the phone (TeamList): people with role and access,
 * and either Agregar persona (sticky bar) or the ⋯ menu open on Cambiar rol.
 */
export const TeamListPiece = ({ members, ring }: TeamListPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex flex-col gap-3 p-3.5`}>
    <CompanyTabs active="Equipo" />
    {members.map((member, index) => (
      <span key={member.name} className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] p-3">
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] font-semibold text-[#1D4ED8]">
            {member.name.charAt(0)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <strong className="font-semibold">{member.name}</strong>
            <span className={APP_MUTED}>
              {member.role} · {member.access}
            </span>
          </span>
          <span className="px-1.5 text-lg font-semibold">⋯</span>
        </span>
        {ring === 'change-role' && index === 0 ? (
          <span className="ml-auto flex w-44 flex-col gap-0.5 rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-md">
            <span className="px-2.5 py-1.5">Editar</span>
            <span className={`rounded-lg bg-[#EFF6FF] px-2.5 py-1.5 font-semibold ${TOUCH_RING_SM}`}>
              Cambiar rol
            </span>
            <span className="px-2.5 py-1.5">Desactivar</span>
          </span>
        ) : null}
      </span>
    ))}
    {ring === 'add' ? <AppButton primary ringed>Agregar persona</AppButton> : null}
  </div>
);
