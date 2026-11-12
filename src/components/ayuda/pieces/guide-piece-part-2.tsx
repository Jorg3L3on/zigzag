import { ClientFormPiece } from '@/components/ayuda/pieces/client-form';
import { CreateMenuPiece } from '@/components/ayuda/pieces/create-menu';
import { InstallCardPiece } from '@/components/ayuda/pieces/install-card';
import { InviteFormPiece, TemporaryPasswordPiece } from '@/components/ayuda/pieces/invite-form';
import { MoreSheetPiece } from '@/components/ayuda/pieces/more-sheet';
import { OfflineNoticePiece } from '@/components/ayuda/pieces/offline-notice';
import type { GuidePiecePart2 } from '@/components/ayuda/pieces/part-2-pieces';
import { PendingDocumentsPiece } from '@/components/ayuda/pieces/pending-documents';
import { ReminderCardPiece } from '@/components/ayuda/pieces/reminder-card';
import { ReminderFormPiece } from '@/components/ayuda/pieces/reminder-form';
import {
  RolePermissionsGridPiece,
  RoleTemplatePiece,
} from '@/components/ayuda/pieces/role-permissions-grid';
import { RolesListPiece } from '@/components/ayuda/pieces/roles-list';
import { ServiceFormPiece } from '@/components/ayuda/pieces/service-form';
import { ServicesCatalogPiece } from '@/components/ayuda/pieces/services-catalog';
import { TeamListPiece } from '@/components/ayuda/pieces/team-list';
import { TextSizeSwitchPiece } from '@/components/ayuda/pieces/text-size-switch';

/** Draws the pieces of the second batch of guides (ZIG-I40-4). */
export const GuidePiecePart2View = ({ piece }: { piece: GuidePiecePart2 }) => {
  switch (piece.kind) {
    case 'create-menu':
      return <CreateMenuPiece highlight={piece.highlight} />;
    case 'more-sheet':
      return <MoreSheetPiece items={piece.items} highlight={piece.highlight} />;
    case 'client-form':
      return <ClientFormPiece fields={piece.fields} ring={piece.ring} />;
    case 'services-catalog':
      return <ServicesCatalogPiece services={piece.services} />;
    case 'service-form':
      return <ServiceFormPiece {...piece} />;
    case 'reminder-form':
      return <ReminderFormPiece {...piece} />;
    case 'reminder-card':
      return <ReminderCardPiece {...piece} />;
    case 'install-card':
      return <InstallCardPiece variant={piece.variant} />;
    case 'offline-notice':
      return <OfflineNoticePiece variant={piece.variant} />;
    case 'pending-documents':
      return <PendingDocumentsPiece {...piece} />;
    case 'text-size-switch':
      return <TextSizeSwitchPiece initial={piece.initial} />;
    case 'team-list':
      return <TeamListPiece members={piece.members} ring={piece.ring} />;
    case 'invite-form':
      return <InviteFormPiece {...piece} />;
    case 'temporary-password':
      return <TemporaryPasswordPiece name={piece.name} password={piece.password} />;
    case 'roles-list':
      return <RolesListPiece roles={piece.roles} />;
    case 'role-template':
      return <RoleTemplatePiece name={piece.name} template={piece.template} />;
    case 'role-permissions-grid':
      return <RolePermissionsGridPiece template={piece.template} />;
  }
};
