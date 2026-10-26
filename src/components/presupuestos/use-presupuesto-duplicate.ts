'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { duplicatePresupuesto } from '@/actions/presupuestos';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import {
  buildPresupuestoComposerDraftKey,
  writeTicketComposerDraft,
} from '@/lib/ticket-composer-draft';

/**
 * Duplicar (ZIG-I13-5): a draft in the presupuesto composer, saved only on
 * Guardar. Shared by the detail and the desktop list (ZIG-I29-3).
 */
export const usePresupuestoDuplicate = (companyId: number | null) => {
  const router = useRouter();
  const [duplicating, setDuplicating] = React.useState(false);

  const duplicate = React.useCallback(
    async (presupuestoId: string) => {
      if (duplicating) return;
      setDuplicating(true);
      try {
        const result = await duplicatePresupuesto(Number(presupuestoId), companyId);
        if (!result.success) {
          toast.error(getErrorDisplayMessage(result, 'No se pudo duplicar el presupuesto'));
          return;
        }
        const draft = result.data;
        if (companyId) {
          writeTicketComposerDraft(buildPresupuestoComposerDraftKey(companyId), {
            client_id: draft.client.id > 0 ? draft.client.id : undefined,
            client_label: draft.client.label,
            ticket_date: draft.ticketDate,
            ...(draft.expiresAt ? { expires_at: draft.expiresAt } : {}),
            work_notes: draft.notes,
            lines: draft.lines,
          });
        }
        toast.success('Borrador listo: revísalo y guarda');
        router.push('/presupuestos/create');
      } catch {
        toast.error('No se pudo duplicar el presupuesto');
      } finally {
        setDuplicating(false);
      }
    },
    [companyId, duplicating, router],
  );

  return { duplicating, duplicate };
};
