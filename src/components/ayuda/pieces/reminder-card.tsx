import { AppButton } from '@/components/ayuda/pieces/app-field';
import { APP_MUTED, APP_PIECE_CARD } from '@/components/ayuda/pieces/app-look';
import { formatScheduleInterval } from '@/lib/schedule-interval-presets';

type ReminderCardPieceProps = {
  client: string;
  service: string;
  months: number;
  nextLabel: string;
};

/** A reminder card on the phone list (ServiceSchedulesList), WhatsApp ringed. */
export const ReminderCardPiece = ({ client, service, months, nextLabel }: ReminderCardPieceProps) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex flex-col gap-2 p-3.5`}>
    <span className="flex flex-col">
      <strong className="font-semibold">{client}</strong>
      <span className={APP_MUTED}>{service}</span>
    </span>
    <span className="self-start rounded-full bg-[#F1F5F9] px-2.5 py-0.5 font-medium">
      {formatScheduleInterval(months, 'month')}
    </span>
    <span className="flex justify-between gap-2">
      <span className={APP_MUTED}>Próximo</span>
      <span>{nextLabel}</span>
    </span>
    <span className="flex flex-wrap gap-2 pt-1">
      <AppButton ringed>WhatsApp</AppButton>
      <AppButton>Crear ticket</AppButton>
      <AppButton>Posponer</AppButton>
      <AppButton>Editar</AppButton>
    </span>
  </div>
);
