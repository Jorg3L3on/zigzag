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
  CloudCheck,
  CloudOff,
  Loader2,
  Plus,
  Receipt,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

import { getClient, getClients, type Client } from '@/actions/clients';
import { getServices } from '@/actions/services';
import {
  createPresupuestoWithLines,
  updatePresupuesto,
} from '@/actions/presupuestos';
import { createTicketWithLines, finishTicket, updateTicketLines } from '@/actions/tickets';
import {
  listClientServiceSchedulesForClient,
  upsertClientServiceSchedule,
  type ClientServiceScheduleListItem,
} from '@/actions/client-service-schedules';
import { ClientForm } from '@/components/clients/client-form';
import { PdfCharsWarning } from '@/components/pdf/pdf-chars-warning';
import { CharCounter } from '@/components/ui/char-counter';
import { CompanyProductionNotice } from '@/components/companies/company-production-notice';
import { DocumentLineRow } from '@/components/documents/document-line-row';
import { MoneyFigure } from '@/components/documents/money-figure';
import { useUndoToast } from '@/components/documents/use-undo-toast';
import { ActionSwap, BlurFade, NumberTicker } from '@/components/motion';
import {
  ComposerLineSheet,
  type ComposerLineInput,
} from '@/components/tickets/composer/composer-line-sheet';
import { ExpiresAtField } from '@/components/tickets/composer/expires-at-field';
import { PaymentChoice, usePaymentChoice } from '@/components/tickets/review/payment-choice';
import { InlineSchedulePicker } from '@/components/service-schedules/inline-schedule-picker';
import {
  buildScheduleLineState,
  type TicketFinishScheduleLine,
} from '@/components/service-schedules/schedule-lines';
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
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { useCompany } from '@/contexts/company-context';
import { notifyFieldJobsChanged } from '@/lib/field-jobs/events';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { usePermissions } from '@/hooks/use-permissions';
import type { ValidationIssue } from '@/lib/action-result';
import { mapServerIssues } from '@/lib/composer-server-errors';
import { addMoney, lineTotalWithMaterials, roundMoney } from '@/lib/money';
import {
  materialDraftsFromServiceDefaults,
  materialDraftsTotal,
} from '@/lib/material-drafts';
import type { ServiceWithMaterials } from '@/actions/services';
import {
  buildToastErrorContent,
  type PublicErrorResponse,
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import { canFinishTicket } from '@/lib/tickets-rbac';
import {
  buildPresupuestoComposerDraftKey,
  buildTicketComposerDraftKey,
  clearTicketComposerDraft,
  draftLineToServiceLineInput,
  readTicketComposerDraft,
  writeTicketComposerDraft,
  type TicketComposerDraftLine,
} from '@/lib/ticket-composer-draft';
import {
  enqueueComposerDocument,
  fieldJobStore,
  type ComposerDocumentPayload,
  type ComposerFinishChoice,
} from '@/lib/field-jobs';
import {
  filterComposerClients,
  readComposerClients,
  readComposerServices,
  refreshComposerClients,
  rememberComposerClients,
  saveComposerServices,
  type ComposerClientOption,
} from '@/lib/offline-composer-catalog';
import { requestPersistentStorage } from '@/lib/persistent-storage';
import { cn } from '@/lib/utils';
import { GLASS_CARD_CLASS } from '@/components/toolbar-glass';
import { vibrateSuccess } from '@/lib/vibrate-success';

const CLIENT_SEARCH_DEBOUNCE_MS = 250;
const CLIENT_SEARCH_PAGE_SIZE = 50;
const NOTES_MAX_LENGTH = 2000;
const SECTION_CLASS = GLASS_CARD_CLASS;

type ComposerClient = { id: number; label: string; name?: string; phone?: string | null };
type SaveState = 'idle' | 'saving' | 'done';

/** useNetworkStatus says online until it mounts; loaders ask the browser directly. */
const isBrowserOffline = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

/** One per draft (ZIG-I35-1): every save of this draft replays to the same document. */
const newClientRequestId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
        Math.floor(Math.random() * 16).toString(16),
      );

const clientLabel = (item: Pick<Client, 'name' | 'phone'>) =>
  item.phone ? `${item.name} · ${item.phone}` : item.name;

const toComposerClient = (item: Pick<Client, 'id' | 'name' | 'phone'>): ComposerClient => ({
  id: item.id,
  label: clientLabel(item),
  name: item.name,
  phone: item.phone,
});

/** Name and phone for the summary card; a restored draft only kept the label. */
const clientParts = (client: ComposerClient): { name: string; phone: string | null } => {
  if (client.name) return { name: client.name, phone: client.phone ?? null };
  const index = client.label.lastIndexOf(' · ');
  const tail = index > 0 ? client.label.slice(index + 3) : '';
  return /^[\d\s()+-]{7,}$/.test(tail)
    ? { name: client.label.slice(0, index), phone: tail }
    : { name: client.label, phone: null };
};

let lineKeySeed = 0;
const nextLineKey = () => {
  lineKeySeed += 1;
  return `line-${Date.now().toString(36)}-${lineKeySeed}`;
};

export type ComposerKind = 'ticket' | 'presupuesto';

const COMPOSER_COPY: Record<
  ComposerKind,
  {
    title: string;
    subtitle: string;
    listHref: string;
    listLabel: string;
    backLabel: string;
    saveLabel: string;
    noun: string;
    linesLabel: string;
    documentLabel: string;
    saveError: string;
    notesPlaceholder: string;
  }
> = {
  ticket: {
    title: 'Nuevo ticket',
    subtitle: 'Cliente, servicios y total',
    listHref: '/tickets',
    listLabel: 'Tickets',
    backLabel: 'Volver a tickets',
    saveLabel: 'Guardar ticket',
    noun: 'Ticket',
    linesLabel: 'Servicios del ticket',
    documentLabel: 'ticket',
    saveError: 'No se pudo guardar el ticket',
    notesPlaceholder: 'Lo que hiciste o lo que falta',
  },
  presupuesto: {
    title: 'Nuevo presupuesto',
    subtitle: 'Cliente, servicios y vigencia',
    listHref: '/presupuestos',
    listLabel: 'Presupuestos',
    backLabel: 'Volver a presupuestos',
    saveLabel: 'Guardar presupuesto',
    noun: 'Presupuesto',
    linesLabel: 'Servicios del presupuesto',
    documentLabel: 'presupuesto',
    saveError: 'No se pudo guardar el presupuesto',
    notesPlaceholder: 'Condiciones, exclusiones o tiempo de entrega',
  },
};

/**
 * Nuevo ticket (ZIG-I2-4): one screen for client, date, service lines with a
 * running total and notes. Nothing is persisted until Guardar ticket, which
 * creates the ticket and its lines in one transaction.
 *
 * Desktop (ZIG-I24-2): from 1024px the form is the left column and a 300px
 * rail on the right keeps the total, Guardar and the draft state in view; the
 * line editor becomes a side panel. No keyboard shortcuts (Jorge, 2026-10-24).
 * Phones keep the single column and the sticky bar.
 *
 * Finishing (ZIG-I24-4): a new ticket can be finished right here. ¿Cómo pagó
 * el cliente? is optional: nothing chosen saves it En proceso; a choice turns
 * Guardar into Guardar y terminar, which saves, finishes with that payment and
 * saves the reminders picked below it. Either way the user lands on the
 * ticket detail (there is no listo screen anymore).
 */
type DocumentComposerProps = {
  /** Work ticket (ZIG-I2) or presupuesto (ZIG-I5-3); they share everything but copy, Vence and the save action. */
  kind?: ComposerKind;
  /**
   * Reopen a saved document. Presupuesto (ZIG-I5-5): the client is locked and
   * Guardar cambios goes through updatePresupuesto. Ticket (ZIG-I13-6): the one
   * line editor, through updateTicketLines; client and date change only while
   * the ticket is En proceso. No local draft is kept either way.
   */
  edit?: ComposerEditState;
};

/** Offline saves land on the list; the pending strip there shows them (ZIG-I35-3). */
const pendingListHref = (kind: ComposerKind) =>
  kind === 'presupuesto' ? '/presupuestos?pendientes=1' : '/tickets?pendientes=1';

export type ComposerEditState = {
  id: string;
  /** Company folio for titles and toasts; falls back to `#id`. */
  folio?: string;
  client: { id: number; label: string; name?: string; phone?: string | null };
  ticketDate: string;
  expiresAt: string | null;
  notes: string;
  lines: TicketComposerDraftLine[];
  /** Tickets only (ZIG-I13-6). */
  ticket?: {
    originalTotal: number;
    paid: number;
    finished: boolean;
    /** When the recibo last went out, from the audit log; null if it never did. */
    receiptSharedAt: string | null;
  };
};

export const DocumentComposer = ({ kind = 'ticket', edit }: DocumentComposerProps) => {
  const isQuote = kind === 'presupuesto';
  const isEdit = edit != null;
  const ticketEdit = !isQuote && edit?.ticket ? edit.ticket : null;
  // A finalized ticket keeps its client and date; a presupuesto always keeps its client.
  const clientLocked = isEdit && (isQuote || ticketEdit?.finished === true);
  const dateLocked = ticketEdit?.finished === true;
  const baseCopy = COMPOSER_COPY[kind];
  const copy = isEdit
    ? isQuote
      ? {
          ...baseCopy,
          title: `Editar presupuesto ${edit.folio ?? `#${edit.id}`}`,
          subtitle: 'Servicios, vigencia y notas',
          listHref: `/presupuestos/${edit.id}`,
          backLabel: 'Volver al presupuesto',
          saveLabel: 'Guardar cambios',
          saveError: 'No se pudieron guardar los cambios',
        }
      : {
          ...baseCopy,
          title: `Editar ticket ${edit.folio ?? `#${edit.id}`}`,
          subtitle: 'Servicios y total',
          listHref: `/tickets/${edit.id}`,
          backLabel: 'Volver al ticket',
          saveLabel: 'Guardar cambios',
          saveError: 'No se pudieron guardar los cambios',
        }
    : baseCopy;
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
  // Revisar (ZIG-I35-3): reopen a document saved offline that has not synced yet.
  const pendingJobId = isEdit ? null : searchParams.get('pendiente');
  const { isOnline } = useNetworkStatus();
  const [requestId, setRequestId] = React.useState<string>(() => pendingJobId ?? newClientRequestId());
  const [pendingLoaded, setPendingLoaded] = React.useState(false);
  // Documents saved here with no signal in this visit, for the notice's link.
  const [savedOfflineCount, setSavedOfflineCount] = React.useState(0);

  // Guardar stays tappable when something is missing; the hint turns into the error (ZIG-I18-13).
  const [attemptedSave, setAttemptedSave] = React.useState(false);
  const [client, setClient] = React.useState<ComposerClient | null>(
    isEdit ? edit.client : null,
  );
  const [clients, setClients] = React.useState<ComposerClientOption[]>([]);
  // The catalog came from the copy on this phone, not the server (ZIG-I35-2).
  const [catalogOffline, setCatalogOffline] = React.useState(false);
  const [clientQuery, setClientQuery] = React.useState('');
  const [debouncedClientQuery, setDebouncedClientQuery] = React.useState('');
  const [isClientsLoading, setIsClientsLoading] = React.useState(true);
  const [isNewClientOpen, setIsNewClientOpen] = React.useState(false);
  // Once a client is chosen, client + date fold into one card; Cambiar reopens them.
  const [partyOpen, setPartyOpen] = React.useState(false);
  const undoToast = useUndoToast();
  const [ticketDate, setTicketDate] = React.useState<Date>(() =>
    isEdit ? new Date(edit.ticketDate) : new Date(),
  );
  const [isDateOpen, setIsDateOpen] = React.useState(false);
  const [expiresAt, setExpiresAt] = React.useState<Date | null>(() =>
    isEdit && edit.expiresAt ? new Date(edit.expiresAt) : null,
  );
  const [notes, setNotes] = React.useState(isEdit ? edit.notes : '');
  const [lines, setLines] = React.useState<TicketComposerDraftLine[]>(
    isEdit ? edit.lines : [],
  );
  const [services, setServices] = React.useState<ServiceWithMaterials[]>([]);
  const [isServicesLoading, setIsServicesLoading] = React.useState(true);
  const [lineSheet, setLineSheet] = React.useState<{
    open: boolean;
    session: number;
    editingKey: string | null;
  }>({ open: false, session: 0, editingKey: null });
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  // What the server rejected, per line and for the notes (ZIG-I12); cleared as the user edits.
  const [lineErrors, setLineErrors] = React.useState<Record<string, string>>({});
  const [notesError, setNotesError] = React.useState<string | null>(null);
  const [draftReady, setDraftReady] = React.useState(false);
  // Last time the local draft was written, for the rail's Borrador guardado (ZIG-I24-2).
  const [draftSavedAt, setDraftSavedAt] = React.useState<Date | null>(null);
  const servicePrefillAppliedRef = React.useRef(false);
  const { can } = usePermissions();
  // Only a new work ticket can be finished from here; edits and presupuestos cannot.
  const finishable = !isQuote && !isEdit && canFinishTicket(can);
  const clientPrefillAppliedRef = React.useRef<string | null>(null);

  // Editing an existing quote keeps no local draft: the server row is the source.
  const draftKey = companyId && !isEdit && !pendingJobId
    ? isQuote
      ? buildPresupuestoComposerDraftKey(companyId)
      : buildTicketComposerDraftKey(companyId)
    : null;
  // Lines plus their materials (ZIG-I10).
  const total = addMoney(...lines.map(lineTotalWithMaterials));
  const totalDelta = ticketEdit ? roundMoney(total - ticketEdit.originalTotal) : 0;
  const belowPaid = ticketEdit ? total < ticketEdit.paid - 0.01 : false;
  const canSave = Boolean(companyId && client && lines.length > 0 && !belowPaid);
  // No default: nothing is recorded as paid unless the user picks it (ZIG-I12 Q2).
  const paymentChoice = usePaymentChoice(total);
  const { payMode, chosenPaid, partialTooHigh, hasPayChoice, setPayMode, setPartialInput } =
    paymentChoice;
  const finishing = finishable && payMode !== null;
  const paymentInvalid = finishing && (!hasPayChoice || partialTooHigh);
  const [scheduleLines, setScheduleLines] = React.useState<TicketFinishScheduleLine[]>([]);
  const editingLine = lines.find((line) => line.key === lineSheet.editingKey) ?? null;
  // No signal (ZIG-I35): a new document saves on this phone and syncs later.
  const savesOffline = !isEdit && !isOnline;
  const offlineFinish: ComposerFinishChoice | undefined = !finishing
    ? undefined
    : payMode === 'full'
      ? 'pagado'
      : payMode === 'partial'
        ? { parcial: roundMoney(chosenPaid) }
        : 'pendiente';

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
      if (isQuote && draft.expires_at) setExpiresAt(new Date(draft.expires_at));
      if (draft.work_notes) setNotes(draft.work_notes);
      if (draft.lines.length > 0) setLines(draft.lines);
      if (draft.client_request_id) setRequestId(draft.client_request_id);
    }
    setDraftReady(true);
  }, [draftKey, isQuote]);

  // Load the pending document into the composer once.
  React.useEffect(() => {
    if (!pendingJobId || pendingLoaded) return;
    let cancelled = false;
    void fieldJobStore
      .getLocalJob(pendingJobId)
      .catch(() => null)
      .then((job) => {
        if (cancelled) return;
        setPendingLoaded(true);
        const document = job?.payload.composer;
        if (!job || !document || document.kind !== kind) {
          toast.error('No encontramos ese documento en este teléfono');
          router.replace(copy.listHref);
          return;
        }
        if (job.remoteTicketId) {
          // It synced meanwhile: go to the real document.
          router.replace(`${copy.listHref}/${job.remoteTicketId}`);
          return;
        }
        setClient({
          id: document.client_id,
          label: document.client_label,
          name: job.payload.client_name,
          phone: job.payload.client_tel ?? null,
        });
        setTicketDate(new Date(document.ticket_date));
        if (document.expires_at) setExpiresAt(new Date(document.expires_at));
        setNotes(document.work_notes);
        setLines(document.lines);
        if (document.finish === 'pagado') setPayMode('full');
        else if (document.finish === 'pendiente') setPayMode('pending');
        else if (document.finish) {
          setPayMode('partial');
          setPartialInput(String(document.finish.parcial));
        }
        setDraftReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pendingJobId, pendingLoaded, kind, router, copy.listHref, setPayMode, setPartialInput]);

  // Persist every change after the restore so a reload keeps the work.
  React.useEffect(() => {
    if (!draftKey || !draftReady || saveState === 'done') return;
    writeTicketComposerDraft(draftKey, {
      client_id: client?.id,
      client_label: client?.label,
      ticket_date: ticketDate.toISOString(),
      ...(isQuote && expiresAt ? { expires_at: expiresAt.toISOString() } : {}),
      work_notes: notes,
      lines,
      client_request_id: requestId,
    });
    setDraftSavedAt(client || lines.length > 0 || notes.trim() ? new Date() : null);
  }, [
    draftKey,
    draftReady,
    client,
    ticketDate,
    expiresAt,
    isQuote,
    notes,
    lines,
    requestId,
    saveState,
  ]);

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
    // No signal: search the copy of the clients kept on this phone (ZIG-I35-2).
    const fromSnapshot = async () => {
      const snapshot = await readComposerClients(companyId);
      if (cancelled) return;
      setClients(filterComposerClients(snapshot?.clients ?? [], debouncedClientQuery));
      setIsClientsLoading(false);
    };
    if (!isOnline || isBrowserOffline()) {
      void fromSnapshot();
      return () => {
        cancelled = true;
      };
    }
    void getClients({
      companyId,
      page: 1,
      pageSize: CLIENT_SEARCH_PAGE_SIZE,
      search: debouncedClientQuery || undefined,
    })
      .catch(() => null)
      .then((result) => {
        if (cancelled) return;
        if (result?.success && result.data) {
          setClients(result.data.items);
          setIsClientsLoading(false);
          void rememberComposerClients(companyId, result.data.items);
          return;
        }
        void fromSnapshot();
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, debouncedClientQuery, isOnline]);

  // Keep the offline copy of the clients fresh while there is signal.
  React.useEffect(() => {
    if (!companyId || !isOnline || isEdit) return;
    void refreshComposerClients(companyId, (page) =>
      getClients({ companyId, page, pageSize: 100 }),
    ).catch(() => undefined);
  }, [companyId, isOnline, isEdit]);

  // Services: from the server with signal (and kept on the phone), else from that copy.
  // Losing signal keeps what is already loaded; getting it back refreshes once.
  const servicesLoadedRef = React.useRef(false);
  React.useEffect(() => {
    let cancelled = false;
    if (!companyId) {
      setIsServicesLoading(false);
      return;
    }
    if ((!isOnline || isBrowserOffline()) && servicesLoadedRef.current) return;
    setIsServicesLoading(true);
    const fromSnapshot = async (failure: PublicErrorResponse & { success?: boolean }) => {
      const cached = await readComposerServices(companyId);
      if (cancelled) return;
      if (cached) {
        setServices(cached);
        setCatalogOffline(true);
        servicesLoadedRef.current = true;
      } else {
        const content = buildToastErrorContent(failure, 'No se pudieron cargar los servicios');
        toast.error(content.title, { description: content.description });
      }
      setIsServicesLoading(false);
    };
    if (!isOnline || isBrowserOffline()) {
      void fromSnapshot({ success: false, errorType: 'network' });
      return () => {
        cancelled = true;
      };
    }
    void getServices(companyId)
      .catch(() => ({ success: false as const, errorType: 'network' as const }))
      .then((result) => {
        if (cancelled) return;
        if (result.success && 'data' in result && result.data) {
          setServices(result.data);
          setCatalogOffline(false);
          servicesLoadedRef.current = true;
          saveComposerServices(companyId, result.data);
          setIsServicesLoading(false);
          return;
        }
        void fromSnapshot(result);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, isOnline]);

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
      setClient(toComposerClient(match));
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
              ...(match.materials.length > 0
                ? { materials: materialDraftsFromServiceDefaults(match.materials) }
                : {}),
            },
          ],
    );
  }, [prefillServiceId, draftReady, services]);

  // Reminders to offer when finishing: catalog services only, with what the client
  // already has; a line the user already set keeps its choice (ZIG-I24-4).
  const catalogServiceKey = lines
    .filter((line) => line.service_id != null)
    .map((line) => `${line.service_id}:${line.service_name}`)
    .join('|');
  React.useEffect(() => {
    if (!finishing || !client || !catalogServiceKey) {
      setScheduleLines([]);
      return;
    }
    const services = Array.from(
      new Map(
        catalogServiceKey.split('|').map((entry) => {
          const [id, ...name] = entry.split(':');
          return [Number(id), name.join(':')] as const;
        }),
      ).entries(),
    ).map(([serviceId, serviceName]) => ({ serviceId, serviceName }));
    let cancelled = false;
    void listClientServiceSchedulesForClient(client.id, companyId).then((result) => {
      if (cancelled) return;
      const existing: ClientServiceScheduleListItem[] = result.data ?? [];
      setScheduleLines((previous) =>
        services.map(
          (line) =>
            previous.find((item) => item.serviceId === line.serviceId) ??
            buildScheduleLineState(line, ticketDate, existing),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [finishing, client, companyId, catalogServiceKey, ticketDate]);

  const saveSchedules = async (clientId: number) => {
    for (const line of scheduleLines.filter((item) => item.checked)) {
      const upsert = await upsertClientServiceSchedule({
        clientId,
        serviceId: line.serviceId,
        intervalValue: line.intervalValue,
        intervalUnit: line.intervalUnit,
        lastServiceAt: line.lastServiceAt,
        companyId,
      });
      if (!upsert.success) {
        toast.error(upsert.error || 'No se pudo guardar un recordatorio');
      }
    }
  };

  const clientOptions = React.useMemo(() => {
    const options: SearchableSelectOption[] = clients.map((item) => ({
      value: String(item.id),
      label: clientLabel(item),
      title: item.name,
      detail: item.phone ?? undefined,
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
      setClient(toComposerClient(match));
      setPartyOpen(false);
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
    if (lineSheet.editingKey) {
      const editedKey = lineSheet.editingKey;
      setLineErrors((current) => {
        const { [editedKey]: _removed, ...rest } = current;
        return rest;
      });
    }
    setLines((current) => {
      if (lineSheet.editingKey) {
        return current.map((line) =>
          line.key === lineSheet.editingKey ? { key: line.key, ...input } : line,
        );
      }
      return [...current, { key: nextLineKey(), ...input }];
    });
  };

  /** Quitar: gone at once, Deshacer puts the line back where it was (ZIG-I13-2). */
  const handleRemoveLine = (key: string) => {
    const index = lines.findIndex((line) => line.key === key);
    if (index < 0) return;
    const removed = lines[index];
    setLineErrors((current) => {
      const { [key]: _removed, ...rest } = current;
      return rest;
    });
    setLines((current) => current.filter((line) => line.key !== key));
    undoToast(`Quitaste ${removed.service_name}`, () => {
      setLines((current) =>
        current.some((line) => line.key === removed.key)
          ? current
          : [...current.slice(0, index), removed, ...current.slice(index)],
      );
    });
  };

  /** Marks the rejected lines and notes; returns the sentence for the toast, if any. */
  const applyServerIssues = (issues: ValidationIssue[] | undefined): string | null => {
    const mapped = mapServerIssues(issues, lines);
    setLineErrors(mapped.rowErrors);
    setNotesError(mapped.notesError);
    return mapped.summary;
  };

  /** Saved online from Revisar: the outbox entry is done, keep the folio for a day. */
  const forgetPendingJob = async (
    localJobId: string,
    saved: { id: string; folio?: string },
  ) => {
    try {
      const job = await fieldJobStore.getLocalJob(localJobId);
      const entry = await fieldJobStore.findOutboxEntryForLocalJob(localJobId);
      if (entry) await fieldJobStore.deleteOutboxEntry(entry.outboxId);
      if (job) {
        await fieldJobStore.putLocalJob({
          ...job,
          syncStatus: 'synced',
          syncError: null,
          remoteTicketId: saved.id,
          remoteFolio: saved.folio ?? null,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      // The key makes a later sync of the same entry a harmless replay.
    }
  };

  /** Guardar sin conexión (ZIG-I35-3): the document waits on this phone for signal. */
  const saveOffline = async () => {
    if (!client || !companyId) return;
    setSaveState('saving');
    const document: ComposerDocumentPayload = {
      kind,
      client_request_id: requestId,
      client_id: client.id,
      client_label: client.label,
      ticket_date: ticketDate.toISOString(),
      ...(isQuote ? { expires_at: expiresAt ? expiresAt.toISOString() : null } : {}),
      work_notes: notes,
      lines,
      ...(offlineFinish !== undefined ? { finish: offlineFinish } : {}),
    };
    const parts = clientParts(client);
    try {
      await enqueueComposerDocument(fieldJobStore, {
        companyId,
        document,
        clientName: parts.name,
        clientTel: parts.phone,
      });
    } catch {
      toast.error('No se pudo guardar en este teléfono', {
        description: 'Tu borrador sigue aquí. Libera espacio o inténtalo con señal.',
      });
      setSaveState('idle');
      return;
    }
    void requestPersistentStorage();
    notifyFieldJobsChanged();
    if (draftKey) clearTicketComposerDraft(draftKey);
    vibrateSuccess();
    toast.success(`${copy.noun} guardado sin conexión`, {
      description: 'Se sube solo y toma su folio cuando haya señal.',
      action: { label: 'Ver pendientes', onClick: () => router.push(pendingListHref(kind)) },
    });
    setSavedOfflineCount((count) => count + 1);
    if (pendingJobId) {
      // Revisar with no signal: the corrected copy waits in the same entry.
      setSaveState('done');
      return;
    }
    // Stay here, empty, for the next job: the list may not open with no signal.
    setClient(null);
    setLines([]);
    setNotes('');
    setTicketDate(new Date());
    setExpiresAt(null);
    setPayMode(null);
    setPartialInput('');
    setAttemptedSave(false);
    setRequestId(newClientRequestId());
    setSaveState('idle');
    window.scrollTo({ top: 0 });
  };

  const handleSave = async () => {
    if (saveState !== 'idle') {
      return;
    }
    if (!client || lines.length === 0 || paymentInvalid) {
      setAttemptedSave(true);
      return;
    }
    if (!companyId) {
      return;
    }
    if (!isEdit && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await saveOffline();
      return;
    }
    if (isEdit && typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.error('Sin conexión', {
        description: 'Los cambios siguen en pantalla. Guarda cuando tengas señal.',
      });
      return;
    }

    setSaveState('saving');
    setLineErrors({});
    setNotesError(null);
    let created = false;
    try {
      const payload = {
        company_id: companyId,
        client_id: client.id,
        ticket_date: ticketDate,
        work_notes: notes,
        lines: lines.map(draftLineToServiceLineInput),
        client_total: total,
        client_request_id: requestId,
      };
      if (isEdit && ticketEdit) {
        const updated = await updateTicketLines(Number(edit.id), {
          company_id: companyId,
          client_id: client.id,
          ticket_date: ticketDate,
          work_notes: notes,
          lines: payload.lines,
        });
        if (updated.success && updated.data) {
          setSaveState('done');
          vibrateSuccess();
          toast.success(`Ticket ${edit.folio ?? `#${edit.id}`} actualizado`);
          const changed = Math.abs(updated.data.total - ticketEdit.originalTotal) > 0.005;
          // A finalized ticket whose total moved: offer to send the new recibo.
          router.push(
            ticketEdit.finished && changed ? `/tickets/${edit.id}?reenviar=1` : `/tickets/${edit.id}`,
          );
          router.refresh();
          return;
        }
        const content = buildToastErrorContent(updated, copy.saveError);
        const mapped = applyServerIssues(updated.issues);
        toast.error(content.title, { description: mapped ?? updated.error ?? content.description });
        setSaveState('idle');
        return;
      }

      if (isEdit) {
        const updated = await updatePresupuesto(Number(edit.id), {
          company_id: companyId,
          ticket_date: ticketDate,
          expires_at: expiresAt,
          work_notes: notes,
          services: payload.lines,
        });
        if (updated.success) {
          setSaveState('done');
          vibrateSuccess();
          toast.success(`Presupuesto ${edit.folio ?? `#${edit.id}`} actualizado`);
          router.push(`/presupuestos/${edit.id}`);
          router.refresh();
          return;
        }
        const content = buildToastErrorContent(updated, copy.saveError);
        const mapped = applyServerIssues(updated.issues);
        toast.error(content.title, { description: mapped ?? content.description });
        setSaveState('idle');
        return;
      }

      const result = isQuote
        ? await createPresupuestoWithLines({ ...payload, expires_at: expiresAt })
        : await createTicketWithLines(payload);

      if (result.success && result.data) {
        created = true;
        setSaveState('done');
        if (draftKey) clearTicketComposerDraft(draftKey);
        if (pendingJobId) await forgetPendingJob(pendingJobId, result.data);
        const savedLabel = `${copy.noun} ${result.data.folio ?? `#${result.data.id}`}`;
        if (isQuote) {
          vibrateSuccess();
          toast.success(`${savedLabel} guardado`);
          router.push(`/presupuestos/${result.data.id}`);
          return;
        }
        if (!finishing) {
          vibrateSuccess();
          toast.success(`${savedLabel} guardado`);
          router.push(`/tickets/${result.data.id}`);
          return;
        }
        // Guardar y terminar (ZIG-I24-4): the ticket exists now; finish it with the
        // chosen payment, save the reminders, then offer the recibo on the detail.
        const finished = await finishTicket(
          Number(result.data.id),
          result.data.total,
          roundMoney(chosenPaid),
          companyId,
        ).catch(() => null);
        if (!finished?.success) {
          const errorType = classifyClientError(null, undefined, finished?.errorType);
          toast.error(`${savedLabel} guardado, pero no se pudo terminar`, {
            description: getErrorMessageByType(
              errorType,
              finished?.error || 'Termínalo desde el ticket.',
            ),
          });
          router.push(`/tickets/${result.data.id}`);
          return;
        }
        await saveSchedules(client.id);
        vibrateSuccess();
        toast.success(`${savedLabel} terminado`);
        router.push(`/tickets/${result.data.id}?enviar=1`);
        return;
      }

      const content = buildToastErrorContent(result, copy.saveError);
      if (content.errorType === 'network') {
        // Says online but the request never made it: keep it on the phone with the same key.
        await saveOffline();
        return;
      }
      const mappedSummary = applyServerIssues(result.issues);
      toast.error(content.title, {
        description: mappedSummary ?? content.description,
      });
      setSaveState('idle');
    } catch {
      if (!isEdit && !created) {
        // The request died on the way (weak signal): same as no signal, same key.
        await saveOffline();
        return;
      }
      toast.error(copy.saveError, {
        description: 'Tu borrador sigue en este teléfono. Vuelve a intentarlo.',
      });
      setSaveState('idle');
    }
  };

  const renderSaveLabel = (idleLabel: string) => (
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
        idleLabel
      )}
    </ActionSwap>
  );
  const saveLabel = renderSaveLabel(
    savesOffline
      ? finishing
        ? 'Terminar sin conexión'
        : 'Guardar sin conexión'
      : finishing
        ? 'Guardar y terminar'
        : copy.saveLabel,
  );
  // The sticky bar is tight at 333px next to a seven-figure total: the screen's
  // title already says what is being saved.
  const mobileSaveLabel = renderSaveLabel(
    isEdit ? copy.saveLabel : finishing ? 'Terminar' : 'Guardar',
  );
  const offlineNotice = savesOffline ? (
    <div
      role="status"
      data-testid="composer-offline-notice"
      className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-3 text-sm"
    >
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p>
          <span className="font-semibold">Sin conexión.</span> Guárdalo aquí: se sube solo cuando
          haya señal y ahí toma su folio. Mientras, es provisional (no es factura).
          {catalogOffline ? ' Servicios y clientes de la última copia en este teléfono.' : ''}
        </p>
        {savedOfflineCount > 0 ? (
          <Link
            href={pendingListHref(kind)}
            className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
            data-testid="composer-offline-saved"
          >
            {savedOfflineCount === 1
              ? '1 guardado en este teléfono · Ver pendientes'
              : `${savedOfflineCount} guardados en este teléfono · Ver pendientes`}
          </Link>
        ) : null}
      </div>
    </div>
  ) : null;

  const materialCount = lines.reduce((sum, line) => sum + (line.materials?.length ?? 0), 0);
  const countsLabel = [
    `${lines.length} ${lines.length === 1 ? 'servicio' : 'servicios'}`,
    materialCount > 0
      ? `${materialCount} ${materialCount === 1 ? 'material' : 'materiales'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  // Editing a finalized ticket: what it was, and by how much it moves (ZIG-I13-6).
  const editHint = ticketEdit?.finished
    ? `Antes ${formatServiceCurrency(ticketEdit.originalTotal)} · ${totalDelta < 0 ? '−' : '+'}${formatServiceCurrency(Math.abs(totalDelta))}`
    : null;
  // What Guardar y terminar records, or what the payment still needs (ZIG-I24-4).
  const finishHint = !finishing
    ? null
    : partialTooHigh
      ? 'Lo pagado no puede ser mayor que el total'
      : !hasPayChoice
        ? 'Escribe cuánto pagó'
        : payMode === 'full'
          ? 'Se termina pagado completo'
          : payMode === 'pending'
            ? 'Se termina sin pago'
            : `Se termina con ${formatServiceCurrency(chosenPaid)} pagado`;
  const ctaHint = !client
    ? 'Elige un cliente'
    : lines.length === 0
      ? 'Agrega al menos un servicio'
      : belowPaid && ticketEdit
        ? `Abajo de lo ya pagado (${formatServiceCurrency(ticketEdit.paid)})`
        : (finishHint ?? editHint ?? countsLabel);

  const missingRequired = !client || lines.length === 0 || paymentInvalid;
  const hintIsError = attemptedSave && missingRequired;
  const hintClass = hintIsError ? 'font-medium text-destructive' : 'text-muted-foreground';

  const dateLabel = isToday(ticketDate)
    ? `Hoy · ${format(ticketDate, "d 'de' MMMM", { locale: es })}`
    : format(ticketDate, 'PPP', { locale: es });
  const shortDateLabel = isToday(ticketDate)
    ? `Hoy, ${format(ticketDate, 'd MMM', { locale: es })}`
    : format(ticketDate, 'd MMM yyyy', { locale: es });
  const showPartyForm = !client || partyOpen;
  const clientCard = client ? clientParts(client) : null;

  return (
    <>
      <TripledPageHeader
        className="hidden md:flex"
        items={[
          { label: copy.listLabel, href: copy.listHref },
          { label: copy.title },
        ]}
      />

      <TripledDashboardShell
        maxWidthClassName="max-w-2xl lg:max-w-6xl"
        contentClassName="space-y-4"
      >
        <TripledMobileAppBar
          title={copy.title}
          subtitle={copy.subtitle}
          backHref={copy.listHref}
          backLabel={copy.backLabel}
        />

        <div className="hidden md:block">
          <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? isQuote
                ? 'Ajusta servicios, vigencia o notas. Nada cambia hasta Guardar cambios.'
                : 'Ajusta servicios, materiales o notas. Nada cambia hasta Guardar cambios.'
              : 'Elige el cliente, agrega los servicios y guarda. Nada se guarda antes.'}
          </p>
        </div>

        <CompanyProductionNotice />

        {offlineNotice}

        {ticketEdit?.finished ? (
          <div
            role="status"
            data-testid="composer-finalized-banner"
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-950 dark:text-amber-100"
          >
            Este ticket ya se finalizó
            {ticketEdit.receiptSharedAt
              ? ` y el recibo se compartió el ${format(new Date(ticketEdit.receiptSharedAt), "d 'de' MMMM", { locale: es })}`
              : ''}
            . Si cambias el total, al guardar te ofrecemos reenviar el recibo nuevo.
          </div>
        ) : null}

        <div
          className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6"
          data-testid="composer-columns"
        >
          <div className="min-w-0 space-y-4">
            <BlurFade>
              {showPartyForm ? (
                <section aria-labelledby="composer-client-heading" className={SECTION_CLASS}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 id="composer-client-heading" className="text-base font-semibold">
                      Cliente
                    </h2>
                    {client ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="-mr-2 h-9 px-2 text-sm font-semibold text-primary"
                        onClick={() => setPartyOpen(false)}
                      >
                        Listo
                      </Button>
                    ) : null}
                  </div>
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
                        disabled={clientLocked}
                        placeholder="Busca o elige un cliente"
                        searchPlaceholder="Buscar por nombre o teléfono…"
                        emptyText={
                          savesOffline
                            ? 'Sin coincidencias en este teléfono. Un cliente nuevo se agrega con señal.'
                            : 'Sin clientes que coincidan'
                        }
                        className="h-12 w-full rounded-xl border border-input bg-background text-base shadow-sm md:h-10 md:text-sm"
                      />
                    </div>
                    {clientLocked || savesOffline ? null : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 gap-2 rounded-xl md:h-10"
                        onClick={() => setIsNewClientOpen(true)}
                      >
                        <UserPlus className="h-4 w-4" aria-hidden />
                        Nuevo cliente
                      </Button>
                    )}
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
                          disabled={dateLocked}
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
              ) : (
                <section
                  aria-label="Cliente y fecha"
                  data-testid="composer-party-card"
                  className={cn(SECTION_CLASS, 'flex items-start gap-3')}
                >
                  <div
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary"
                  >
                    {(clientCard?.name.trim().charAt(0) || '?').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-semibold leading-snug [overflow-wrap:anywhere]"
                      data-testid="composer-party-name"
                    >
                      {clientCard?.name}
                    </p>
                    <p className="flex flex-wrap gap-x-1.5 text-sm tabular-nums text-muted-foreground">
                      {clientCard?.phone ? (
                        <span className="[overflow-wrap:anywhere]">{clientCard.phone} ·</span>
                      ) : null}
                      <span className="whitespace-nowrap">{shortDateLabel}</span>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0 rounded-lg px-3 text-sm"
                    onClick={() => setPartyOpen(true)}
                  >
                    Cambiar
                  </Button>
                </section>
              )}
            </BlurFade>

            {isQuote ? (
              <BlurFade delay={0.03}>
                <section className={SECTION_CLASS}>
                  <ExpiresAtField value={expiresAt} onChange={setExpiresAt} minDate={ticketDate} />
                </section>
              </BlurFade>
            ) : null}

            <BlurFade delay={0.05}>
              <section
                aria-labelledby="composer-services-heading"
                className={SECTION_CLASS}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 id="composer-services-heading" className="text-base font-semibold">
                    Servicios
                    {lines.length > 0 ? (
                      <span className="font-normal text-muted-foreground"> · {lines.length}</span>
                    ) : null}
                  </h2>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-1.5 rounded-xl"
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
                    aria-label={copy.linesLabel}
                    className="mt-2 divide-y divide-border/60"
                  >
                    <AnimatePresence initial={false}>
                      {lines.map((line) => (
                        <motion.li
                          key={line.key}
                          layout={!reduceMotion}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
                          transition={{ duration: reduceMotion ? 0 : 0.2 }}
                        >
                          <DocumentLineRow
                            name={line.service_name}
                            quantity={line.quantity}
                            price={line.price}
                            amount={lineTotalWithMaterials(line)}
                            materials={(line.materials ?? []).map((item) => ({
                              id: item.key,
                              name: item.name,
                              quantity: item.quantity,
                              unit: item.unit,
                              price: item.price,
                            }))}
                            error={lineErrors[line.key]}
                            onClick={() => openEditLine(line.key)}
                            onRemove={() => handleRemoveLine(line.key)}
                            data-testid="composer-line-row"
                          />
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-3 lg:hidden">
                  <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                    Total
                  </span>
                  <NumberTicker
                    value={total}
                    format={formatServiceCurrency}
                    className="min-w-0 text-right text-xl font-semibold text-foreground [overflow-wrap:anywhere] min-[400px]:text-2xl"
                    data-testid="composer-total"
                  />
                </div>
              </section>
            </BlurFade>

            <BlurFade delay={0.1}>
              <section aria-labelledby="composer-notes-heading" className={SECTION_CLASS}>
                <div className="flex items-baseline justify-between gap-2">
                  <Label
                    id="composer-notes-heading"
                    htmlFor="composer-notes"
                    className="text-base font-semibold"
                  >
                    Notas <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <CharCounter value={notes} max={NOTES_MAX_LENGTH} />
                </div>
                <Textarea
                  id="composer-notes"
                  value={notes}
                  maxLength={NOTES_MAX_LENGTH}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setNotesError(null);
                  }}
                  aria-invalid={notesError ? true : undefined}
                  aria-describedby={notesError ? 'composer-notes-error' : undefined}
                  placeholder={copy.notesPlaceholder}
                  className="mt-3 min-h-[88px] rounded-xl"
                />
                <PdfCharsWarning text={notes} />
                {notesError ? (
                  <p id="composer-notes-error" role="alert" className="mt-1 text-caption text-destructive">
                    {notesError}
                  </p>
                ) : null}
              </section>
            </BlurFade>

            {finishable ? (
              <BlurFade delay={0.12}>
                <PaymentChoice choice={paymentChoice} idPrefix="composer" optional />
              </BlurFade>
            ) : null}

            {finishing && !savesOffline && scheduleLines.length > 0 ? (
              <BlurFade delay={0.14}>
                <InlineSchedulePicker
                  className={SECTION_CLASS}
                  lines={scheduleLines}
                  onChange={setScheduleLines}
                  disabled={saveState !== 'idle'}
                />
              </BlurFade>
            ) : null}

            <div className="hidden items-center justify-between gap-4 md:flex lg:hidden">
              <p className={cn('text-sm', hintClass)} role={hintIsError ? 'alert' : undefined}>
                {ctaHint}
              </p>
              <Button
                type="button"
                className="h-11 min-w-44 rounded-xl text-base font-semibold"
                disabled={belowPaid || saveState !== 'idle'}
                onClick={handleSave}
              >
                {saveLabel}
              </Button>
            </div>

            {isQuote || isEdit ? null : (
              <p className="text-center text-caption text-muted-foreground md:hidden">
                ¿Con prisa?{' '}
                <Link href="/anotar" className="font-medium text-primary underline-offset-4 hover:underline">
                  Anotar trabajo
                </Link>
              </p>
            )}
          </div>

          <aside
            aria-label="Total y acciones"
            data-testid="composer-rail"
            className="hidden lg:sticky lg:top-20 lg:block"
          >
            <div className={cn(SECTION_CLASS, 'space-y-4 sm:p-5')}>
              <div className="space-y-1">
                <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                  Total
                </p>
                <NumberTicker
                  value={total}
                  format={formatServiceCurrency}
                  className="block text-3xl font-semibold tabular-nums text-foreground [overflow-wrap:anywhere]"
                  data-testid="composer-rail-total"
                />
                <p
                  className={cn('text-sm', hintClass)}
                  data-testid="composer-rail-hint"
                  role={hintIsError ? 'alert' : undefined}
                >
                  {ctaHint}
                </p>
              </div>
              <Button
                type="button"
                className="h-11 w-full gap-2 rounded-xl text-base font-semibold"
                disabled={belowPaid || saveState !== 'idle'}
                onClick={handleSave}
              >
                {saveLabel}
              </Button>
              <p
                className="flex items-center gap-1.5 text-caption text-muted-foreground"
                data-testid="composer-draft-state"
              >
                {isEdit ? (
                  'Nada cambia hasta Guardar cambios.'
                ) : savesOffline ? (
                  <>
                    <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Se guarda en este teléfono hasta que haya señal
                  </>
                ) : draftSavedAt ? (
                  <>
                    <CloudCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Borrador guardado en este equipo
                  </>
                ) : (
                  'Se guarda un borrador mientras escribes.'
                )}
              </p>
            </div>
          </aside>
        </div>
      </TripledDashboardShell>

      <TripledMobileStickyActionBar>
        <div className="min-w-0 flex-1">
          <p
            className={cn('text-caption', hintClass)}
            data-testid="composer-sticky-hint"
            role={hintIsError ? 'alert' : undefined}
          >
            {ctaHint}
          </p>
          <MoneyFigure
            amount={total}
            size="lg"
            className="block leading-tight"
            data-testid="composer-sticky-total"
          />
        </div>
        <Button
          type="button"
          className={cn('h-12 shrink-0 rounded-xl px-5 text-base font-semibold')}
          disabled={belowPaid || saveState !== 'idle'}
          onClick={handleSave}
        >
          {mobileSaveLabel}
        </Button>
      </TripledMobileStickyActionBar>

      <ComposerLineSheet
        key={lineSheet.session}
        open={lineSheet.open}
        onOpenChange={(open) => setLineSheet((current) => ({ ...current, open }))}
        services={services}
        companyId={companyId}
        servicesLoading={isServicesLoading}
        initialLine={editingLine}
        onSubmit={handleLineSubmit}
        onRemove={
          lineSheet.editingKey ? () => handleRemoveLine(lineSheet.editingKey as string) : undefined
        }
        documentLabel={copy.documentLabel}
        documentKind={kind}
        otherLinesTotal={addMoney(
          ...lines
            .filter((line) => line.key !== lineSheet.editingKey)
            .map(lineTotalWithMaterials),
        )}
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
                setClient(toComposerClient(saved));
                setPartyOpen(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

/** Nuevo ticket composer (ZIG-I2-4). */
export const TicketComposer = () => <DocumentComposer kind="ticket" />;

/** Editar ticket (ZIG-I13-6): the one line editor, loaded with a saved ticket. */
export const TicketEditComposer = ({ edit }: { edit: ComposerEditState }) => (
  <DocumentComposer kind="ticket" edit={edit} />
);
