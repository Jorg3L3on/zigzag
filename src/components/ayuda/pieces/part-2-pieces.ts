import type { RoleTemplateKey } from '@/lib/role-matrix';

/**
 * Pieces for the second batch of guides (ZIG-I40-4). Kept apart from the
 * registry union so the two guide batches merge without touching each other's
 * lines; `GuidePiece` in the registry includes this union.
 */
export type GuidePiecePart2 =
  /** Dock + menu, with one entry of the create menu ringed. */
  | { kind: 'create-menu'; highlight: string }
  /** Más sheet with one entry ringed, over the dock with Más ringed. */
  | { kind: 'more-sheet'; items: string[]; highlight: string }
  | {
      kind: 'client-form';
      fields: Array<{ label: string; value: string }>;
      /** The first field or the Crear button. */
      ring: 'field' | 'submit';
    }
  | { kind: 'services-catalog'; services: Array<{ name: string; price: number }> }
  | {
      kind: 'service-form';
      name: string;
      description: string;
      price: number;
      materials: Array<{ name: string; amount: number }>;
      ring: 'fields' | 'materials' | 'submit';
    }
  | {
      kind: 'reminder-form';
      client: string;
      service: string;
      /** YYYY-MM-DD */
      lastService: string;
      /** Chip selected when the page loads (1, 2, 3, 6 or 12). */
      months: number;
      ring: 'pick' | 'every' | 'save';
    }
  | {
      kind: 'reminder-card';
      client: string;
      service: string;
      months: number;
      nextLabel: string;
    }
  | { kind: 'install-card'; variant: 'banner' | 'account' | 'ios' | 'home-icon' }
  | { kind: 'offline-notice'; variant: 'ready' | 'composer' }
  | { kind: 'pending-documents'; client: string; notes: string; total: number }
  | { kind: 'text-size-switch'; initial: boolean }
  | {
      kind: 'team-list';
      members: Array<{ name: string; role: string; access: string }>;
      ring: 'add' | 'change-role' | 'none';
    }
  | {
      kind: 'invite-form';
      name: string;
      email: string;
      roles: string[];
      role: string;
    }
  | { kind: 'temporary-password'; name: string; password: string }
  | { kind: 'roles-list'; roles: Array<{ name: string; people: number; hint: string }> }
  | { kind: 'role-template'; name: string; template: RoleTemplateKey }
  | { kind: 'role-permissions-grid'; template: RoleTemplateKey };
