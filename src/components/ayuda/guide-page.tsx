import Link from 'next/link';
import { GuideFeedback } from '@/components/ayuda/guide-feedback';
import {
  getNextGuide,
  guideHref,
  HELP_TOPICS,
  topicHref,
  type WrittenGuide,
} from '@/components/ayuda/guide-registry';
import { HelpShell } from '@/components/ayuda/help-shell';
import { GuidePiece } from '@/components/ayuda/pieces/guide-piece';
import { AYUDA_PATH } from '@/lib/marketing-routes';

type GuidePageProps = {
  guide: WrittenGuide;
  whatsappHref: string | null;
};

const MONO_ACCENT =
  'font-[family-name:var(--font-marketing-mono)] font-semibold text-[var(--pt-accent)]';

const ArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden
    className="shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const NOTE_ICON_PATHS = {
  /** Wi-Fi crossed out, for the "no signal" notes. */
  offline:
    'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.5M19 13a10 10 0 0 0-5-2.8M12 20h.01',
  /** Circled "i", for every other note. */
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
} as const;

const NoteIcon = ({ icon }: { icon: keyof typeof NOTE_ICON_PATHS }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden
    className="mt-0.5 shrink-0"
    fill="none"
    stroke="var(--pt-accent)"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={NOTE_ICON_PATHS[icon]} />
  </svg>
);

/**
 * Guide template (ZIG-I40-2): topic links, eyebrow, title, intro, numbered
 * step cards (text + rebuilt app piece; stacked on phones), optional note,
 * "¿Te sirvió esta guía?" and the next guide.
 */
export const GuidePage = ({ guide, whatsappHref }: GuidePageProps) => {
  const { content } = guide;
  const topic = HELP_TOPICS.find((item) => item.key === guide.topic);
  const next = getNextGuide(guide.slug);
  const stepCount = content.steps.length;

  return (
    <HelpShell>
      <div className="mx-auto box-border flex w-full max-w-[1180px] flex-wrap items-start gap-[clamp(24px,4vw,64px)] px-4 py-[clamp(24px,4vw,56px)] sm:px-[clamp(16px,4vw,40px)]">
        <nav aria-label="Temas" className="flex min-w-0 flex-[1_1_200px] flex-wrap gap-1.5">
          {HELP_TOPICS.map((item) => {
            const current = item.key === guide.topic;
            return (
              <Link
                key={item.key}
                href={topicHref(item.key)}
                aria-current={current ? 'true' : undefined}
                className={`box-border flex min-h-11 flex-[1_1_150px] items-center rounded-xl px-3.5 text-[15px] no-underline ${
                  current
                    ? 'bg-[var(--pt-ink)] font-semibold text-[var(--pt-ground)] hover:text-[var(--pt-ground)]'
                    : 'font-medium text-[var(--pt-ink)] hover:bg-[var(--pt-paper)] hover:text-[var(--pt-accent)]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <article className="flex min-w-0 flex-[999_1_560px] flex-col gap-[clamp(28px,3.4vw,44px)]">
          <header className="flex flex-col gap-3.5">
            <p className="m-0 font-[family-name:var(--font-marketing-mono)] text-sm font-medium uppercase tracking-[0.08em] text-[var(--pt-accent)]">
              {topic?.label} · {stepCount} {stepCount === 1 ? 'paso' : 'pasos'}
            </p>
            <h1 className="m-0 font-[family-name:var(--font-marketing-display)] text-[clamp(40px,5.6vw,76px)] leading-[0.96] font-extrabold tracking-[-0.04em]">
              {guide.title}
            </h1>
            <p className="m-0 max-w-[34em] text-[clamp(18px,1.5vw,21px)] text-[var(--pt-body)]">
              {content.intro}
            </p>
          </header>

          <ol className="m-0 flex list-none flex-col gap-4 p-0" aria-label="Pasos">
            {content.steps.map((step, index) => (
              <li
                key={step.title}
                data-testid="ayuda-step"
                className="flex flex-wrap items-center gap-x-[clamp(24px,4vw,56px)] gap-y-5 rounded-[28px] border border-[rgba(23,20,15,0.14)] bg-[var(--pt-paper)] p-[clamp(20px,2.6vw,32px)]"
              >
                <div className="min-w-0 flex-[1_1_280px]">
                  <span aria-hidden className={`${MONO_ACCENT} text-sm`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h2 className="mt-1.5 mb-2.5 font-[family-name:var(--font-marketing-display)] text-[clamp(24px,2.4vw,32px)] leading-[1.08] font-bold tracking-[-0.025em]">
                    <span className="sr-only">Paso {index + 1}: </span>
                    {step.title}
                  </h2>
                  <p className="m-0 text-[var(--pt-body)]">{step.body}</p>
                </div>
                <div className="flex min-w-0 flex-[1_1_260px] justify-center">
                  <GuidePiece piece={step.piece} />
                </div>
              </li>
            ))}
          </ol>

          {content.note ? (
            <aside className="flex items-start gap-3.5 rounded-[20px] border-[1.5px] border-dashed border-[var(--pt-ink)] px-[clamp(20px,2.6vw,28px)] py-5">
              <NoteIcon icon={content.note.icon ?? 'info'} />
              <p className="m-0">
                <strong className="font-semibold">{content.note.title}</strong> {content.note.body}
              </p>
            </aside>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t-[1.5px] border-dashed border-[rgba(23,20,15,0.35)] pt-6">
            <GuideFeedback whatsappHref={whatsappHref} />
            <Link
              href={next ? guideHref(next.slug) : AYUDA_PATH}
              className="zz-btn inline-flex min-h-14 items-center gap-2.5 rounded-[14px] bg-[var(--pt-ink)] px-6 font-semibold text-[var(--pt-ground)] no-underline hover:text-[var(--pt-ground)]"
            >
              {next ? `Sigue: ${next.title}` : 'Ver todas las guías'}
              <ArrowIcon />
            </Link>
          </div>
        </article>
      </div>
    </HelpShell>
  );
};
