import { AppButton } from '@/components/ayuda/pieces/app-field';
import {
  APP_MUTED,
  APP_PIECE_CARD,
  TOUCH_RING,
  TOUCH_RING_SM,
} from '@/components/ayuda/pieces/app-look';

type InstallCardVariant = 'banner' | 'account' | 'ios' | 'home-icon';

const DownloadIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);

/**
 * Installing the app: the Android banner (PwaInstallBanner), the Mi cuenta
 * card on Android and on iPhone (PwaInstallCard), and the icon it leaves on the
 * home screen.
 */
export const InstallCardPiece = ({ variant }: { variant: InstallCardVariant }) => {
  if (variant === 'banner') {
    return (
      <div aria-hidden className={`${APP_PIECE_CARD} flex items-center gap-3 px-3.5 py-3`}>
        <span className="min-w-0 flex-1">
          Instala ZigZag para acceso rápido desde tu pantalla de inicio.
        </span>
        <AppButton primary ringed>
          Instalar
        </AppButton>
      </div>
    );
  }
  if (variant === 'home-icon') {
    return (
      <div aria-hidden className="grid w-full max-w-[260px] grid-cols-3 gap-4 rounded-[28px] bg-[#0B1220] p-5">
        {[0, 1, 2].map((slot) => (
          <span key={slot} className="flex flex-col items-center gap-1.5 text-white">
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-extrabold ${
                slot === 1 ? `bg-[#2563EB] ${TOUCH_RING}` : 'bg-[#334155]'
              }`}
            >
              {slot === 1 ? 'Z' : ''}
            </span>
            <span className="min-h-5 text-sm">{slot === 1 ? 'ZigZag' : ''}</span>
          </span>
        ))}
      </div>
    );
  }
  return (
    <div aria-hidden className={`${APP_PIECE_CARD} flex flex-col gap-2.5 p-3.5`}>
      <strong className={`flex items-center gap-2 font-medium ${APP_MUTED}`}>
        <DownloadIcon />
        Instalar ZigZag
      </strong>
      {variant === 'account' ? (
        <>
          <span className={APP_MUTED}>
            Abre ZigZag desde un ícono en tu pantalla de inicio, a pantalla completa y sin la
            barra del navegador, y recibe los avisos aunque la app esté cerrada.
          </span>
          <AppButton primary ringed>
            <DownloadIcon />
            Instalar ZigZag
          </AppButton>
        </>
      ) : (
        <>
          <span className={APP_MUTED}>
            En iPhone la app y sus avisos viven en la pantalla de inicio: en Safari toca
            Compartir y luego <strong className="text-[#0B1220]">Agregar a inicio</strong>, abre
            ZigZag desde ahí y vuelve aquí.
          </span>
          <span className="flex flex-col gap-1 rounded-xl bg-[#F1F5F9] p-2">
            <span className={`rounded-lg bg-white px-2.5 py-2 font-semibold ${TOUCH_RING_SM}`}>
              Agregar a inicio
            </span>
          </span>
        </>
      )}
    </div>
  );
};
