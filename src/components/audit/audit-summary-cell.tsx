'use client';

import Link from 'next/link';
import type { AuditEventListItem } from '@/lib/audit-query';
import { formatAuditEventSummary } from '@/lib/audit-event-summary';
import { resolveAuditSummaryResourcePresentation } from '@/lib/audit-display';

type AuditSummaryCellProps = {
  event: AuditEventListItem;
  className?: string;
};

/**
 * Resumen title + optional resource subtitle.
 * Hides the blue secondary line when it only repeats the ticket/resource id
 * already present in the title; links the title instead when a destination exists.
 */
export const AuditSummaryCell = ({
  event,
  className = 'max-w-md space-y-1',
}: AuditSummaryCellProps) => {
  const summary = formatAuditEventSummary(event);
  const presentation = resolveAuditSummaryResourcePresentation({
    title: summary.title,
    resourceType: event.resource_type,
    resourceId: event.resource_id,
    payload: event.payload,
    actorName: event.actor_name,
  });

  const titleNode =
    presentation.linkTitle && presentation.href ? (
      <Link
        href={presentation.href}
        className="font-medium leading-snug text-primary underline-offset-4 hover:underline"
        onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        {summary.title}
      </Link>
    ) : (
      <p className="font-medium leading-snug">{summary.title}</p>
    );

  return (
    <div className={className}>
      {titleNode}
      {presentation.subtitle ? (
        presentation.href && !presentation.linkTitle ? (
          <Link
            href={presentation.href}
            className="block text-xs text-primary underline-offset-4 hover:underline"
            onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            {presentation.subtitle}
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">{presentation.subtitle}</p>
        )
      ) : null}
    </div>
  );
};
