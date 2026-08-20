'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { FieldJobCard } from '@/components/field/field-job-card';
import { JobWhatsAppSendMenu } from '@/components/field/job-whatsapp-send-menu';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getDefaultFieldSendHighlight,
  type FieldJobSnapshot,
} from '@/lib/field-job-snapshot';

export type FieldSendSuccessPanelProps = {
  job: FieldJobSnapshot;
  canWrite?: boolean;
  title?: string;
  description?: string;
  onDoneHref?: string;
  onDoneLabel?: string;
};

/**
 * Post-save Enviar prompt for Anotar / field capture success.
 */
export const FieldSendSuccessPanel = ({
  job,
  canWrite = false,
  title = 'Trabajo guardado',
  description = 'Envía el recibo o el presupuesto mientras estás con el cliente.',
  onDoneHref = '/dashboard',
  onDoneLabel = 'Listo',
}: FieldSendSuccessPanelProps) => {
  const highlightId = getDefaultFieldSendHighlight(job);

  return (
    <Card
      className="border-border/60 shadow-none"
      data-testid="field-send-success-panel"
    >
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldJobCard job={job} canWrite={canWrite} asListItem={false} />
        <div className="flex flex-wrap gap-2">
          <JobWhatsAppSendMenu
            job={job}
            triggerLabel="Enviar por WhatsApp"
            variant="default"
            highlightId={highlightId}
          />
          <Button variant="outline" className="min-h-11 rounded-lg" asChild>
            <Link href={onDoneHref}>{onDoneLabel}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
