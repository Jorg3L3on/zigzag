'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  Check,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

import { getClient, getClients, type Client } from '@/actions/clients';
import { getServices } from '@/actions/services';
import { createTicketWithLines } from '@/actions/tickets';
import type { Service } from '@/db/schema';
import { ClientForm } from '@/components/clients/client-form';
import { CompanyProductionNotice } from '@/components/companies/company-production-notice';
import { ActionSwap, BlurFade, NumberTicker } from '@/components/motion';
import {
  ComposerLineSheet,
  type ComposerLineInput,
} from '@/components/tickets/composer/composer-line-sheet';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledMobileStickyActionBar,
  TripledPageHeader,
} from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { useCompany } from '@/contexts/company-context';
import { multiplyMoney, sumLineTotals } from '@/lib/money';
import { buildToastErrorContent } from '@/lib/network-awareness';
import {
  buildTicketComposerDraftKey,
  clearTicketComposerDraft,
  readTicketComposerDraft,
  writeTicketComposerDraft,
  type TicketComposerDraftLine,
} from '@/lib/ticket-composer-draft';
import { cn } from '@/lib/utils';
import { vibrateSuccess } from '@/lib/vibrate-success';

const CLIENT_SEARCH_DEBOUNCE_MS = 250;
const CLIENT_SEARCH_PAGE_SIZE = 50;
const SECTION_CLASS =
  'rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6';

type ComposerClient = { id: number; label: string };
type SaveState = 'idle' | 'saving' | 'done';

const clientLabel = (item: Pick<Client, 'name' | 'phone'>) =>
  item.phone ? `${item.name} · ${item.phone}` : item.name;

let lineKeySeed = 0;
const nextLineKey = () => {
  lineKeySeed += 1;
  return `line-${Date.now().toString(36)}-${lineKeySeed}`;
};

type ComposerLineRowProps = {
  line: TicketComposerDraftLine;
  onEdit: () => void;
  onRemove: () => void;
};

const ComposerLineRow = ({ line, onEdit, onRemove }: ComposerLineRowProps) => (
  <div className="flex items-start gap-3 py-3">
    <div className="min-w-0 flex-1">
      <p className="font-medium leading-snug text-foreground">{line.service_name}</p>
      <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
        {line.quantity} × {formatServiceCurrency(line.price)}
      </p>
    </div>
    <span className="shrink-0 pt-0.5 text-base font-semibold tabular-nums text-foreground">
      {formatServiceCurrency(multiplyMoney(line.price, line.quantity))}
    </span>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-my-2 h-11 w-11 shrink-0 text-muted-foreground"
          aria-label={`Opciones de ${line.service_name}`}
        >
          <MoreVertical className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="h-4 w-4" aria-hidden />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={onRemove}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Quitar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

/**
 * Nuevo ticket (ZIG-I2-4): one screen for client, date, service lines with a
 * running total and notes. Nothing is persisted until Guardar ticket, which
 * creates the ticket and its lines in one transaction.
 */
export const TicketComposer = () => {
  const { selectedCompany } = useCompany();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const companyId =
    selectedCompany?.id && selectedCompany.name !== 'System'
      ? selectedCompany.id
      : null;
  const prefillClientId = searchParams.get('clientId');
  const prefillServiceId = searchParams.get('serviceId');

  const [client, setClient] = React.useState<ComposerClient | null>(null);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [clientQuery, setClientQuery] = React.useState('');
  const [debouncedClientQuery, setDebouncedClientQuery] = React.useState('');
  const [isClientsLoading, setIsClientsLoading] = React.useState(true);
  const [isNewClientOpen, setIsNewClientOpen] = React.useState(false);
  const [ticketDate, setTicketDate] = React.useState<Date>(() => new Date());
  const [isDateOpen, setIsDateOpen] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [lines, setLines] = React.useState<TicketComposerDraftLine[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [isServicesLoading, setIsServicesLoading] = React.useState(true);
  const [lineSheet, setLineSheet] = React.useState<{
    open: boolean;
    session: number;
    editingKey: string | null;
  }>({ open: false, session: 0, editingKey: null });
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [draftReady, setDraftReady] = React.useState(false);
  const servicePrefillAppliedRef = React.useRef(false);
  const clientPrefillAppliedRef = React.useRef<string | null>(null);

  const draftKey = companyId ? buildTicketComposerDraftKey(companyId) : null;
  const total = sumLineTotals(lines);
  const canSave = Boolean(companyId && client && lines.length > 0);
  const editingLine = lines.find((line) => line.key === lineSheet.editingKey) ?? null;

  // Restore the local draft once per company.
  React.useEffect(() => {
    if (!draftKey) return;
    const draft = readTicketComposerDraft(draftKey);
    if (draft) {
      if (draft.client_id) {
        setClient({
          id: draft.client_id,
          label: draft.client_label ?? `Cliente #${draft.client_id}`,
        });
      }
      if (draft.ticket_date) setTicketDate(new Date(draft.ticket_date));
      if (draft.work_notes) setNotes(draft.work_notes);
      if (draft.lines.length > 0) setLines(draft.lines);
    }
    setDraftReady(true);
  }, [draftKey]);

  // Persist every change after the restore so a reload keeps the work.
  React.useEffect(() => {
    if (!draftKey || !draftReady || saveState === 'done') return;
    writeTicketComposerDraft(draftKey, {
      client_id: client?.id,
      client_label: client?.label,
      ticket_date: ticketDate.toISOString(),
      work_notes: notes,
      lines,
    });
  }, [draftKey, draftReady, client, ticketDate, notes, lines, saveState]);

  React.useEffect(() => {
    const handle = window.setTimeout(
      () => setDebouncedClientQuery(clientQuery.trim()),
      CLIENT_SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(handle);
  }, [clientQuery]);

  React.useEffect(() => {
    let cancelled = false;
    if (!companyId) {
      setIsClientsLoading(false);
      return;
    }
    setIsClientsLoading(true);
    void getClients({
      companyId,
      page: 1,
      pageSize: CLIENT_SEARCH_PAGE_SIZE,
      search: debouncedClientQuery || undefined,
    }).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setClients(result.data.items);
      }
      setIsClientsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, debouncedClientQuery]);

  React.useEffect(() => {
    let cancelled = false;
    if (!companyId) {
      setIsServicesLoading(false);
      return;
    }
    setIsServicesLoading(true);
    void getServices(companyId).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setServices(result.data);
      } else if (!result.success) {
        const content = buildToastErrorContent(
          result,
          'No se pudieron cargar los servicios',
        );
        toast.error(content.title, { description: content.description });
      }
      setIsServicesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // ?clientId= deep link (e.g. from a client page).
  React.useEffect(() => {
    if (!prefillClientId || clientPrefillAppliedRef.current === prefillClientId) {
      return;
    }
    const id = Number.parseInt(prefillClientId, 10);
    if (!Number.isFinite(id) || id <= 0) return;
    clientPrefillAppliedRef.current = prefillClientId;
    let cancelled = false;
    void getClient(id).then((result) => {
      if (cancelled || !result.success || !result.data) return;
      const match = result.data;
      setClients((prev) =>
        prev.some((item) => item.id === match.id) ? prev : [match, ...prev],
      );
      setClient({ id: match.id, label: clientLabel(match) });
    });
    return () => {
      cancelled = true;
    };
  }, [prefillClientId]);

  // ?serviceId= deep link adds that service as the first line.
  React.useEffect(() => {
    if (
      !prefillServiceId ||
      servicePrefillAppliedRef.current ||
      !draftReady ||
      services.length === 0
    ) {
      return;
    }
    servicePrefillAppliedRef.current = true;
    const match = services.find((item) => String(item.id) === prefillServiceId);
    if (!match) return;
    setLines((current) =>
      current.some((line) => line.service_id === match.id)
        ? current
        : [
            ...current,
            {
              key: nextLineKey(),
              service_id: match.id,
              service_name: match.name,
              quantity: 1,
              price: Number(match.price) || 0,
            },
          ],
    );
  }, [prefillServiceId, draftReady, services]);

  const clientOptions = React.useMemo(() => {
    const options = clients.map((item) => ({
      value: String(item.id),
      label: clientLabel(item),
    }));
    if (client && !options.some((option) => option.value === String(client.id))) {
      options.unshift({ value: String(client.id), label: client.label });
    }
    return options;
  }, [clients, client]);

  const handleClientChange = (value: string) => {
    if (!value) {
      setClient(null);
      return;
    }
    const match = clients.find((item) => String(item.id) === value);
    if (match) {
      setClient({ id: match.id, label: clientLabel(match) });
    }
  };

  const openAddLine = () =>
    setLineSheet((current) => ({
      open: true,
      session: current.session + 1,
      editingKey: null,
    }));

  const openEditLine = (key: string) =>
    setLineSheet((current) => ({
      open: true,
      session: current.session + 1,
      editingKey: key,
    }));

  const handleLineSubmit = (input: ComposerLineInput) => {
    setLines((current) => {
      if (lineSheet.editingKey) {
        return current.map((line) =>
          line.key === lineSheet.editingKey ? { ...line, ...input } : line,
        );
      }
      return [...current, { key: nextLineKey(), ...input }];
    });
  };

  const handleRemoveLine = (key: string) =>
    setLines((current) => current.filter((line) => line.key !== key));

  const handleSave = async () => {
    if (!companyId || !client || lines.length === 0 || saveState !== 'idle') {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.error('Sin conexión', {
        description:
          'Tu borrador sigue en este teléfono. Guarda cuando tengas señal o usa Captura rápida.',
      });
      return;
    }

    setSaveState('saving');
    try {
      const result = await createTicketWithLines({
        company_id: companyId,
        client_id: client.id,
        ticket_date: ticketDate,
        work_notes: notes,
        lines: lines.map(({ service_id, quantity, price }) => ({
          service_id,
          quantity,
          price,
        })),
        client_total: total,
      });

      if (result.success && result.data) {
        setSaveState('done');
        if (draftKey) clearTicketComposerDraft(draftKey);
        vibrateSuccess();
        toast.success(`Ticket #${result.data.id} guardado`);
        router.push(`/tickets/${result.data.id}/listo`);
        return;
      }

      const content = buildToastErrorContent(result, 'No se pudo guardar el ticket');
      toast.error(content.title, {
        description:
          content.errorType === 'network'
            ? 'Tu borrador sigue en este teléfono. Vuelve a intentarlo cuando tengas señal.'
            : content.description,
      });
      setSaveState('idle');
    } catch {
      toast.error('No se pudo guardar el ticket', {
        description: 'Tu borrador sigue en este teléfono. Vuelve a intentarlo.',
      });
      setSaveState('idle');
    }
  };

  const saveLabel = (
    <ActionSwap swapKey={saveState}>
      {saveState === 'saving' ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Guardando…
        </>
      ) : saveState === 'done' ? (
        <>
          <Check className="h-4 w-4" aria-hidden />
          Guardado
        </>
      ) : (
        'Guardar ticket'
      )}
    </ActionSwap>
  );

  const ctaHint = !client
    ? 'Elige un cliente'
    : lines.length === 0
      ? 'Agrega al menos un servicio'
      : `${lines.length} ${lines.length === 1 ? 'servicio' : 'servicios'}`;

  const dateLabel = isToday(ticketDate)
    ? `Hoy · ${format(ticketDate, "d 'de' MMMM", { locale: es })}`
    : format(ticketDate, 'PPP', { locale: es });

  return (
    <>
      <TripledPageHeader
        className="hidden md:flex"
        items={[
          { label: 'Tickets', href: '/tickets' },
          { label: 'Nuevo ticket' },
        ]}
      />

      <TripledDashboardShell
        maxWidthClassName="max-w-2xl"
        contentClassName="space-y-4"
        hasMobileStickyAction
      >
        <TripledMobileAppBar
          title="Nuevo ticket"
          subtitle="Cliente, servicios y total"
          backHref="/tickets"
          backLabel="Volver a tickets"
        />

        <div className="hidden md:block">
          <h1 className="text-2xl font-semibold tracking-tight">Nuevo ticket</h1>
          <p className="text-sm text-muted-foreground">
            Elige el cliente, agrega los servicios y guarda. Nada se guarda antes.
          </p>
        </div>

        <CompanyProductionNotice />

        <BlurFade>
          <section aria-labelledby="composer-client-heading" className={SECTION_CLASS}>
            <h2 id="composer-client-heading" className="text-base font-semibold">
              Cliente
            </h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <SearchableSelect
                  id="composer-client"
                  aria-label="Cliente"
                  options={clientOptions}
                  value={client ? String(client.id) : ''}
                  onValueChange={handleClientChange}
                  onSearchChange={setClientQuery}
                  isLoading={isClientsLoading}
                  placeholder="Busca o elige un cliente"
                  searchPlaceholder="Buscar por nombre o teléfono…"
                  emptyText="Sin clientes que coincidan"
                  className="h-12 w-full rounded-xl border border-input bg-background text-base shadow-sm md:h-10 md:text-sm"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 gap-2 rounded-xl md:h-10"
                onClick={() => setIsNewClientOpen(true)}
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                Nuevo cliente
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="composer-date" className="text-sm font-medium">
                Fecha
              </Label>
              <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="composer-date"
                    type="button"
                    variant="outline"
                    className="h-12 w-full justify-start gap-2 rounded-xl text-left text-base font-normal md:h-10 md:text-sm"
                  >
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {dateLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={ticketDate}
                    onSelect={(value) => {
                      if (value) {
                        setTicketDate(value);
                        setIsDateOpen(false);
                      }
                    }}
                    disabled={(date) =>
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </section>
        </BlurFade>

        <BlurFade delay={0.05}>
          <section
            aria-labelledby="composer-services-heading"
            className={SECTION_CLASS}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="composer-services-heading" className="text-base font-semibold">
                Servicios
              </h2>
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-1.5 rounded-xl"
                onClick={openAddLine}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Agregar servicio
              </Button>
            </div>

            {lines.length === 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground">
                <Receipt className="h-5 w-5" aria-hidden />
                <p>Agrega el primer servicio para ver el total.</p>
              </div>
            ) : (
              <ul
                aria-label="Servicios del ticket"
                className="mt-2 divide-y divide-border/60"
              >
                <AnimatePresence initial={false}>
                  {lines.map((line) => (
                    <motion.li
                      key={line.key}
                      layout={!reduceMotion}
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
                      transition={{ duration: reduceMotion ? 0 : 0.2 }}
                    >
                      <ComposerLineRow
                        line={line}
                        onEdit={() => openEditLine(line.key)}
                        onRemove={() => handleRemoveLine(line.key)}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}

            <div className="mt-3 flex items-baseline justify-between border-t border-border/60 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total
              </span>
              <NumberTicker
                value={total}
                format={formatServiceCurrency}
                className="text-2xl font-semibold text-foreground"
                data-testid="composer-total"
              />
            </div>
          </section>
        </BlurFade>

        <BlurFade delay={0.1}>
          <section aria-labelledby="composer-notes-heading" className={SECTION_CLASS}>
            <Label
              id="composer-notes-heading"
              htmlFor="composer-notes"
              className="text-base font-semibold"
            >
              Notas <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="composer-notes"
              value={notes}
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Lo que hiciste o lo que falta"
              className="mt-3 min-h-[88px] rounded-xl"
            />
          </section>
        </BlurFade>

        <div className="hidden items-center justify-between gap-4 md:flex">
          <p className="text-sm text-muted-foreground">{ctaHint}</p>
          <Button
            type="button"
            className="h-11 min-w-44 rounded-xl text-base font-semibold"
            disabled={!canSave || saveState !== 'idle'}
            onClick={handleSave}
          >
            {saveLabel}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground md:hidden">
          ¿Sin señal o con prisa?{' '}
          <Link href="/anotar" className="font-medium text-primary underline-offset-4 hover:underline">
            Captura rápida
          </Link>
        </p>
      </TripledDashboardShell>

      <TripledMobileStickyActionBar>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{ctaHint}</p>
          <p className="truncate text-base font-semibold tabular-nums">
            {formatServiceCurrency(total)}
          </p>
        </div>
        <Button
          type="button"
          className={cn('h-12 shrink-0 rounded-xl px-5 text-base font-semibold')}
          disabled={!canSave || saveState !== 'idle'}
          onClick={handleSave}
        >
          {saveLabel}
        </Button>
      </TripledMobileStickyActionBar>

      <ComposerLineSheet
        key={lineSheet.session}
        open={lineSheet.open}
        onOpenChange={(open) => setLineSheet((current) => ({ ...current, open }))}
        services={services}
        servicesLoading={isServicesLoading}
        initialLine={editingLine}
        onSubmit={handleLineSubmit}
        onServiceCreated={(saved) =>
          setServices((current) =>
            current.some((item) => item.id === saved.id) ? current : [saved, ...current],
          )
        }
      />

      <Dialog open={isNewClientOpen} onOpenChange={setIsNewClientOpen}>
        <DialogContent className="flex max-h-[min(90vh,100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg flex-col overflow-hidden rounded-2xl p-0 sm:w-full">
          <DialogHeader className="shrink-0 border-b border-border/60 px-6 pb-4 pr-12 pt-6">
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>Se guarda en tu lista de clientes.</DialogDescription>
          </DialogHeader>
          <ClientForm
            compact
            onCancel={() => setIsNewClientOpen(false)}
            onSuccess={(saved) => {
              setIsNewClientOpen(false);
              if (saved) {
                setClients((prev) =>
                  prev.some((item) => item.id === saved.id) ? prev : [saved, ...prev],
                );
                setClient({ id: saved.id, label: clientLabel(saved) });
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
