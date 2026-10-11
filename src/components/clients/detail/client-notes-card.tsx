'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { updateClientNotes } from '@/actions/client-detail';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CLIENT_NOTES_MAX_LENGTH } from '@/lib/client-detail';

type ClientNotesCardProps = {
  clientId: number;
  initialNotes: string | null;
  canWrite: boolean;
};

/** Free-text notes about the client (ZIG-I17-3). Read-only without clients.write. */
export const ClientNotesCard = ({
  clientId,
  initialNotes,
  canWrite,
}: ClientNotesCardProps) => {
  const [saved, setSaved] = useState(initialNotes ?? '');
  const [value, setValue] = useState(initialNotes ?? '');
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== saved.trim();

  const save = () => {
    startTransition(async () => {
      const result = await updateClientNotes(clientId, value);
      if (!result.success) {
        toast.error(result.error ?? 'No se pudieron guardar las notas.');
        return;
      }
      const next = result.data?.notes ?? '';
      setSaved(next);
      setValue(next);
      toast.success('Notas guardadas');
    });
  };

  return (
    <section
      aria-labelledby="client-notes-title"
      data-testid="client-notes"
      className="space-y-2"
    >
      <h2 id="client-notes-title" className="text-lg font-semibold">
        Notas
      </h2>
      {canWrite ? (
        <>
          <label htmlFor="client-notes-input" className="sr-only">
            Notas del cliente
          </label>
          <Textarea
            id="client-notes-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={CLIENT_NOTES_MAX_LENGTH}
            rows={4}
            placeholder="Cómo llegar, horarios, preferencias, equipos que tiene…"
            className="min-h-28 rounded-xl text-base"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              {value.length}/{CLIENT_NOTES_MAX_LENGTH}
            </span>
            <Button
              type="button"
              className="h-11 rounded-xl px-5"
              disabled={!dirty || pending}
              onClick={save}
            >
              {pending ? 'Guardando…' : 'Guardar notas'}
            </Button>
          </div>
        </>
      ) : (
        <p className="whitespace-pre-wrap rounded-xl border border-border/60 bg-card p-4 text-base [overflow-wrap:anywhere]">
          {saved.trim() || 'Sin notas.'}
        </p>
      )}
    </section>
  );
};
