import { lineTotalWithMaterials } from '@/lib/money';
import {
  getMaterialLineName,
  getServiceLineDescription,
  getServiceLineName,
  isInlineMaterialLine,
  type ServiceLineDisplaySource,
} from '@/lib/service-line-display';

/** A material under a review/detail line (ZIG-I10). */
export type ReviewLineMaterial = {
  id: number;
  name: string;
  quantity: number;
  unit: string | null;
  price: number;
  /** Typed in the document, not linked to the catalog (Nuevo chip). */
  inline: boolean;
};

export type ReviewLine = {
  id: number;
  /** Null for an inline line (ZIG-I5). */
  serviceId: number | null;
  name: string;
  /** What the line says about itself; shown muted under the name. */
  description?: string;
  quantity: number;
  price: number;
  /** Present only when the line has materials. */
  materials?: ReviewLineMaterial[];
};

type StoredLine = ServiceLineDisplaySource & {
  id: number | bigint;
  quantity: number;
  price: number | string | null;
  materials?: ReadonlyArray<{
    id: number;
    material_id: number | null;
    name: string | null;
    unit: string | null;
    quantity: number | string;
    price: number | string;
  }> | null;
};

/** Server line row → the shape review, detail and summary components draw. */
export const buildReviewLine = (line: StoredLine): ReviewLine => {
  const materials = (line.materials ?? []).map((item) => ({
    id: Number(item.id),
    name: getMaterialLineName(item),
    quantity: Number(item.quantity),
    unit: item.unit,
    price: Number(item.price) || 0,
    inline: isInlineMaterialLine(item),
  }));
  return {
    id: Number(line.id),
    serviceId: line.service_id ?? null,
    name: getServiceLineName(line),
    ...(getServiceLineDescription(line)
      ? { description: getServiceLineDescription(line) }
      : {}),
    quantity: line.quantity,
    price: Number(line.price) || 0,
    ...(materials.length > 0 ? { materials } : {}),
  };
};

/** Line amount shown in lists: service + materials. */
export const reviewLineAmount = (line: ReviewLine): number =>
  lineTotalWithMaterials(line);
