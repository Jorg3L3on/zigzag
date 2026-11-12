import { AppButton } from '@/components/ayuda/pieces/app-field';
import { APP_MUTED, APP_PIECE_CARD, formatPieceMoney } from '@/components/ayuda/pieces/app-look';

type ServicesCatalogPieceProps = { services: Array<{ name: string; price: number }> };

/** Servicios page on the phone: title, Nuevo servicio (ringed) and the list with prices. */
export const ServicesCatalogPiece = ({ services }: ServicesCatalogPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex flex-col gap-3 p-3.5`}>
    <span className="flex flex-col">
      <strong className="text-base font-semibold">Servicios</strong>
      <span className={APP_MUTED}>Administra el catálogo de servicios disponibles</span>
    </span>
    <AppButton primary ringed>
      + Nuevo servicio
    </AppButton>
    {services.map((service) => (
      <span
        key={service.name}
        className="flex justify-between gap-3 rounded-xl border border-[#E2E8F0] px-3 py-2.5"
      >
        <span className="min-w-0">{service.name}</span>
        <span className="whitespace-nowrap font-semibold tabular-nums">
          {formatPieceMoney(service.price)}
        </span>
      </span>
    ))}
  </div>
);
