import { AppButton, AppField } from '@/components/ayuda/pieces/app-field';
import { APP_PIECE_CARD } from '@/components/ayuda/pieces/app-look';

type ClientFormPieceProps = {
  fields: Array<{ label: string; value: string }>;
  ring: 'field' | 'submit';
};

/** "Nuevo cliente" form (ClientForm): the fields the step is about, Cancelar and Crear. */
export const ClientFormPiece = ({ fields, ring }: ClientFormPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex flex-col gap-3 p-3.5`}>
    <strong className="text-base font-semibold">Nuevo cliente</strong>
    {fields.map((field, index) => (
      <AppField
        key={field.label}
        label={field.label}
        value={field.value}
        placeholder="Opcional"
        ringed={ring === 'field' && index === 0}
      />
    ))}
    <span className="flex gap-2.5 pt-1">
      <AppButton className="flex-1">Cancelar</AppButton>
      <AppButton primary ringed={ring === 'submit'} className="flex-1">
        Crear
      </AppButton>
    </span>
  </div>
);
