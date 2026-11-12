import { AppButton, AppField } from '@/components/ayuda/pieces/app-field';
import { APP_MUTED, APP_PIECE_CARD, formatPieceMoney } from '@/components/ayuda/pieces/app-look';

type ServiceFormPieceProps = {
  name: string;
  description: string;
  price: number;
  materials: Array<{ name: string; amount: number }>;
  ring: 'fields' | 'materials' | 'submit';
};

/**
 * "Nuevo servicio" (ServiceForm): name, description and price; the Materiales
 * block with Agregar material; Crear servicio. One of the three is ringed.
 */
export const ServiceFormPiece = ({
  name,
  description,
  price,
  materials,
  ring,
}: ServiceFormPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex flex-col gap-3 p-3.5`}>
    <strong className="text-base font-semibold">Nuevo servicio</strong>
    {ring === 'materials' ? null : (
      <>
        <AppField label="Nombre del servicio" value={name} ringed={ring === 'fields'} />
        {ring === 'fields' ? <AppField label="Descripción" value={description} /> : null}
        <AppField label="Precio" value={`$ ${price.toFixed(2)}`} />
      </>
    )}
    {ring === 'fields' ? null : (
      <span className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] p-3">
        <span className="flex justify-between gap-2">
          <strong className="font-semibold">Materiales</strong>
          <span className="font-semibold tabular-nums">
            {formatPieceMoney(materials.reduce((sum, item) => sum + item.amount, 0))}
          </span>
        </span>
        {materials.map((item) => (
          <span key={item.name} className={`flex justify-between gap-3 ${APP_MUTED}`}>
            <span className="min-w-0">{item.name}</span>
            <span className="whitespace-nowrap tabular-nums">{formatPieceMoney(item.amount)}</span>
          </span>
        ))}
        <AppButton ringed={ring === 'materials'}>+ Agregar material</AppButton>
      </span>
    )}
    <AppButton primary ringed={ring === 'submit'}>
      Crear servicio
    </AppButton>
  </div>
);
