'use client';

import { useState } from 'react';

type GuideFeedbackProps = {
  /** wa.me link from SUPPORT_WHATSAPP_NUMBER; after "No" it offers to write. */
  whatsappHref: string | null;
};

const ANSWER_BUTTON =
  'min-h-12 cursor-pointer rounded-xl border-[1.5px] border-[var(--pt-ink)] bg-transparent px-[22px] font-semibold text-[var(--pt-ink)] hover:bg-[var(--pt-paper)]';

/**
 * "¿Te sirvió esta guía?" (ZIG-I40-2). Answering only changes the text: no
 * request, no storage.
 */
export const GuideFeedback = ({ whatsappHref }: GuideFeedbackProps) => {
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
      <strong role="status" className="text-lg font-semibold">
        {answer === 'yes'
          ? 'Gracias por avisar.'
          : answer === 'no'
            ? whatsappHref
              ? 'Gracias. Escríbenos por WhatsApp y te ayudamos.'
              : 'Gracias. Vamos a mejorar esta guía.'
            : '¿Te sirvió esta guía?'}
      </strong>
      {answer === null ? (
        <div className="flex gap-2">
          <button type="button" className={ANSWER_BUTTON} onClick={() => setAnswer('yes')}>
            Sí
          </button>
          <button type="button" className={ANSWER_BUTTON} onClick={() => setAnswer('no')}>
            No
          </button>
        </div>
      ) : null}
      {answer === 'no' && whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-semibold text-[var(--pt-accent)] underline underline-offset-4"
        >
          Escribir por WhatsApp
        </a>
      ) : null}
    </div>
  );
};
