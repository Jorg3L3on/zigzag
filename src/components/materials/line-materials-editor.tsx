'use client';

import { useState } from 'react';
import { Package, Plus } from 'lucide-react';

import {
  MaterialEntryFields,
  useMaterialEntry,
} from '@/components/materials/material-entry-fields';
import { MaterialRows } from '@/components/materials/material-rows';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { Button } from '@/components/ui/button';
import { materialDraftsTotal, type MaterialDraft } from '@/lib/material-drafts';
import { MATERIALS_PER_LINE_MAX } from '@/lib/ticket-service-line-schema';

type LineMaterialsEditorProps = {
  idPrefix: string;
  value: MaterialDraft[];
  onChange: (next: MaterialDraft[]) => void;
  companyId?: number | null;
  documentLabel?: string;
  /** Tells the container an add/edit step is open (to hide its own buttons). */
  onEntryOpenChange?: (open: boolean) => void;
};

/**
 * Materials of one document line with an in-place add/edit step (ZIG-I10-4):
 * works inside a dialog or a sheet without opening another overlay. Rows are
 * tap-to-edit with Quitar; Agregar material swaps the list for the entry
 * fields (Del catálogo or Nuevo) until Agregar / Cancelar.
 */
export const LineMaterialsEditor = ({
  idPrefix,
  value,
  onChange,
  companyId,
  documentLabel = 'ticket',
  onEntryOpenChange,
}: LineMaterialsEditorProps) => {
  const entry = useMaterialEntry('line', null);
  const [editing, setEditing] = useState<{ draft: MaterialDraft | null } | null>(null);
  const total = materialDraftsTotal(value);

  const openEntry = (draft: MaterialDraft | null) => {
    entry.reset(draft);
    setEditing({ draft });
    onEntryOpenChange?.(true);
  };

  const closeEntry = () => {
    setEditing(null);
    onEntryOpenChange?.(false);
  };

  const submit = () => {
    if (!entry.canSubmit) return;
    const draft = entry.toDraft();
    const exists = value.some((item) => item.key === draft.key);
    onChange(
      exists
        ? value.map((item) => (item.key === draft.key ? draft : item))
        : [...value, draft],
    );
    closeEntry();
  };

  return (
    <section aria-labelledby={`${idPrefix}-heading`} className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3
          id={`${idPrefix}-heading`}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground"
        >
          <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
          {editing
            ? editing.draft
              ? 'Editar material'
              : 'Agregar material'
            : 'Materiales'}
        </h3>
        {!editing && value.length > 0 ? (
          <span className="text-sm font-semibold tabular-nums">
            {formatServiceCurrency(total)}
          </span>
        ) : null}
      </div>

      {editing ? (
        <div className="space-y-3 rounded-xl border border-border/70 p-3">
          <MaterialEntryFields
            idPrefix={`${idPrefix}-entry`}
            entry={entry}
            companyId={companyId}
            documentLabel={documentLabel}
            autoFocus={!editing.draft}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={closeEntry}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-11 flex-1"
              disabled={!entry.canSubmit}
              onClick={submit}
            >
              {editing.draft ? 'Guardar material' : 'Agregar material'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {value.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sin materiales. Se suman al precio del servicio.
            </p>
          ) : null}
          <MaterialRows
            materials={value}
            showInlineChips
            onEdit={(key) => openEntry(value.find((item) => item.key === key) ?? null)}
            onRemove={(key) => onChange(value.filter((item) => item.key !== key))}
            data-testid={`${idPrefix}-rows`}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={value.length >= MATERIALS_PER_LINE_MAX}
            onClick={() => openEntry(null)}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden data-icon="inline-start" />
            Agregar material
          </Button>
        </>
      )}
    </section>
  );
};
