import { multiplyMoney, roundMoney, sumMaterialTotals } from '@/lib/money';
import type { ServiceMaterialInput, ServiceMaterialView } from '@/lib/service-materials';
import type {
  MaterialLineInput,
  StoredLineMaterial,
} from '@/lib/ticket-service-line-schema';

/**
 * One material while it is being edited (Servicios form, composer line sheet,
 * post-creation editing). `material_id` set = linked to the company catalog;
 * null = typed inline (shows the Nuevo chip). ZIG-I10.
 */
export type MaterialDraft = {
  key: string;
  material_id: number | null;
  name: string;
  unit: string | null;
  quantity: number;
  price: number;
  /** Inline only: also create it in the company catalog on save. */
  save_to_catalog: boolean;
};

let keyCounter = 0;
export const newMaterialKey = (): string => {
  keyCounter += 1;
  return `mat-${Date.now().toString(36)}-${keyCounter}`;
};

export const materialDraftAmount = (
  draft: Pick<MaterialDraft, 'quantity' | 'price'>,
): number => multiplyMoney(draft.price, draft.quantity);

export const materialDraftsTotal = (
  drafts: ReadonlyArray<Pick<MaterialDraft, 'quantity' | 'price'>> | null | undefined,
): number => sumMaterialTotals(drafts);

/** "1.5 kg", "2 pza", "3" — trims trailing zeros of the quantity. */
export const formatMaterialQuantity = (
  quantity: number | string,
  unit?: string | null,
): string => {
  const text = String(roundMoney(Number(quantity)));
  return unit?.trim() ? `${text} ${unit.trim()}` : text;
};

/** Composer / ticket-services payload for one material. */
export const materialDraftToLineInput = (draft: MaterialDraft): MaterialLineInput =>
  draft.material_id != null
    ? {
        kind: 'catalog',
        material_id: draft.material_id,
        quantity: roundMoney(draft.quantity),
        price: roundMoney(draft.price),
      }
    : {
        kind: 'custom',
        name: draft.name.trim(),
        unit: draft.unit?.trim() || null,
        save_to_catalog: draft.save_to_catalog,
        quantity: roundMoney(draft.quantity),
        price: roundMoney(draft.price),
      };

/** Servicios form payload for one default material. */
export const materialDraftToServiceInput = (
  draft: MaterialDraft,
): ServiceMaterialInput => ({
  material_id: draft.material_id,
  name: draft.name.trim(),
  unit: draft.unit?.trim() || null,
  quantity: roundMoney(draft.quantity),
  price: roundMoney(draft.price),
});

/** Prefill from a catalog service's defaults (price = override ?? catalog). */
export const materialDraftsFromServiceDefaults = (
  defaults: ReadonlyArray<ServiceMaterialView> | null | undefined,
): MaterialDraft[] =>
  (defaults ?? []).map((item) => ({
    key: newMaterialKey(),
    material_id: item.material_id,
    name: item.name,
    unit: item.unit,
    quantity: Number(item.quantity),
    price: Number(item.price),
    save_to_catalog: false,
  }));

/** Saved TicketLineMaterial rows back into drafts (edit flows). */
export const materialDraftsFromStoredRows = (
  rows: ReadonlyArray<StoredLineMaterial> | null | undefined,
): MaterialDraft[] =>
  (rows ?? []).map((row) => ({
    key: newMaterialKey(),
    material_id: row.material_id,
    name: row.name?.trim() || 'Material',
    unit: row.unit,
    quantity: Number(row.quantity),
    price: Number(row.price),
    save_to_catalog: false,
  }));
