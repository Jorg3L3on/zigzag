'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildSupportWhatsAppHref } from '@/lib/support-whatsapp';

type LoginForgotPasswordProps = {
  /** `SUPPORT_WHATSAPP_NUMBER` from the server; the button is hidden without it. */
  supportWhatsapp?: string | null;
  /** What the person already typed as their user, to prefill the message. */
  getLogin?: () => string;
};

/**
 * `¿Olvidaste tu contraseña?` (ZIG-I18-11). There is no email in Zigzag, so this
 * says who to ask instead of leaving a dead end.
 */
export const LoginForgotPassword = ({
  supportWhatsapp,
  getLogin,
}: LoginForgotPasswordProps) => {
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState('');
  const whatsappHref = buildSupportWhatsAppHref(supportWhatsapp, login);

  const handleOpen = () => {
    setLogin(getLogin?.() ?? '');
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex min-h-11 w-full items-center justify-center rounded-lg text-base font-medium text-[color:var(--login-ink-muted)] underline underline-offset-4 transition-colors hover:text-[color:var(--login-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--login-accent-blue)]"
      >
        ¿Olvidaste tu contraseña?
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Olvidaste tu contraseña?</DialogTitle>
            <DialogDescription className="text-base">
              Pídele a quien administra tu empresa que te dé una contraseña temporal.
              Con esa entras y eliges una nueva.
            </DialogDescription>
          </DialogHeader>
          <p className="text-base">
            Si tú eres quien administra la empresa, escríbenos y te ayudamos.
          </p>
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageCircle className="size-5" aria-hidden />
              Escribir por WhatsApp
            </a>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};
