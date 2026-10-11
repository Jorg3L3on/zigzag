'use client';

import { useState } from 'react';
import { Package, Plus } from 'lucide-react';

import {
  MaterialEntryFields,
  useMaterialEntry,
} from '@/components/materials/material-entry-fields';
import { MaterialRows } from '@/components/materials/material-rows';
import { BottomSheet } from '@/components/motion';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { Button } from '@/components/ui/button';
import { materialDraftsTotal, type MaterialDraft } from '@/lib/material-drafts';
import { MATERIALS_PER_LINE_MAX } from '@/lib/ticket-service-line-schema';

type ServiceMaterialsFieldProps = {
  value: MaterialDraft[];
  onChange: (next: MaterialDraft[]) => void;
  companyId?: number | null;
};

type SheetState = { open: false } | { open: true; editing: MaterialDraft | null };

const MaterialSheet = ({
  editing,
  companyId,
  onClose,
  onSubmit,
}: {
  editing: MaterialDraft | null;
  companyId?: number | null;
  onClose: () => void;
  onSubmit: (draft: MaterialDraft) => void;
}) => {
  const entry = useMaterialEntry('service', editing);
  return (
    <BottomSheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={editing ? 'Editar material' : 'Agregar material'}
      description="Se agrega con cantidad y precio a cada ticket o presupuesto con este servicio."
      data-testid="service-material-sheet"
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-11 flex-1"
            disabled={!entry.canSubmit}
            onClick={() => {
              onSubmit(entry.toDraft());
              onClose();
            }}
          >
            {editing ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </div>
      }
    >
      <MaterialEntryFields
        idPrefix="service-material"
        entry={entry}
        companyId={companyId}
        autoFocus={!editing}
      />
    </BottomSheet>
  );
};

/**
 * Materiales section of the Servicios form (ZIG-I10-2): default materials a
 * service brings into tickets and presupuestos, saved with the service.
 */
export const ServiceMaterialsField = ({
  value,
  onChange,
  companyId,
}: ServiceMaterialsFieldProps) => {
  const [sheet, setSheet] = useState<SheetState>({ open: false });
  const total = materialDraftsTotal(value);
  const atLimit = value.length >= MATERIALS_PER_LINE_MAX;

  const upsert = (draft: MaterialDraft) => {
    const exists = value.some((item) => item.key === draft.key);
    onChange(
      exists
        ? value.map((item) => (item.key === draft.key ? draft : item))
        : [...value, draft],
    );
  };

  return (
    <section aria-labelledby="service-materials-heading" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h3
            id="service-materials-heading"
            className="flex items-center gap-1.5 text-sm font-medium text-foreground"
          >
            <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
            Materiales
          </h3>
          <p className="text-xs text-muted-foreground">
            Se agregan al ticket o presupuesto con este servicio; puedes ajustarlos ahí.
          </p>
        </div>
        {value.length > 0 ? (
          <p className="shrink-0 text-sm font-semibold tabular-nums" aria-live="polite">
            {formatServiceCurrency(total)}
          </p>
        ) : null}
      </div>

      <MaterialRows
        materials={value}
        onEdit={(key) =>
          setSheet({ open: true, editing: value.find((item) => item.key === key) ?? null })
        }
        onRemove={(key) => onChange(value.filter((item) => item.key !== key))}
        data-testid="service-material-rows"
      />

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        disabled={atLimit}
        onClick={() => setSheet({ open: true, editing: null })}
      >
        <Plus className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
        Agregar material
      </Button>
      {atLimit ? (
        <p className="text-xs text-muted-foreground">
          Máximo {MATERIALS_PER_LINE_MAX} materiales por servicio.
        </p>
      ) : null}

      {sheet.open ? (
        <MaterialSheet
          editing={sheet.editing}
          companyId={companyId}
          onClose={() => setSheet({ open: false })}
          onSubmit={upsert}
        />
      ) : null}
    </section>
  );
};
