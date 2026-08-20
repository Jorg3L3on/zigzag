'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CheckCircle2, Circle, CircleCheck, Loader2, Plus, User } from 'lucide-react';
import { toast } from 'sonner';
import { anotarCapture } from '@/actions/anotar';
import { getClient, getClients, type Client } from '@/actions/clients';
import { ClientForm } from '@/components/clients/client-form';
import { ClientPhoneLink } from '@/components/client-phone-link';
import { FormattedCurrency } from '@/components/formatted-currency';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledMobileStickyActionBar,
  TripledPageHeader,
} from '@/components/tripled';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { FieldSendSuccessPanel } from '@/components/field/field-send-success-panel';
import { useCompany } from '@/contexts/company-context';
import {
  buildAnotarDraftStorageKey,
  clearAnotarFormDraft,
  readAnotarFormDraft,
  writeAnotarFormDraft,
} from '@/lib/anotar-form-drafts';
import {
  toFieldJobSnapshotFromAnotarSuccess,
  type FieldJobSnapshot,
} from '@/lib/field-job-snapshot';
import { enqueueFieldJobCreate, fieldJobStore } from '@/lib/field-jobs';
import {
  buildToastErrorContent,
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import { roundMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { vibrateSuccess } from '@/lib/vibrate-success';

const ANOTAR_FORM_ID = 'anotar-capture-form';
const ANOTAR_RETRY_GUIDANCE =
  'Conservamos los datos del formulario. Revisa tu conexión y vuelve a intentar guardar.';
const CLIENT_SEARCH_DEBOUNCE_MS = 300;
const CLIENT_SEARCH_PAGE_SIZE = 25;

type PaymentMode = 'paid' | 'partial' | 'pending';

const formSchema = z.object({
  client_id: z.number().optional(),
  client_name: z.string().min(1, 'El nombre es obligatorio').max(100),
  client_tel: z.string().min(1, 'El teléfono es obligatorio').max(20),
  work_notes: z.string().max(2000).optional(),
  total: z.number().min(0, 'El total debe ser mayor o igual a 0'),
  company_id: z.number(),
});

type FormValues = z.infer<typeof formSchema>;

const parseMoneyInput = (value: string): number => {
  if (!value.trim()) return 0;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

const AnotarPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillClientId = searchParams.get('clientId');
  const { selectedCompany } = useCompany();
  const [clients, setClients] = React.useState<Client[]>([]);
  const [clientQuery, setClientQuery] = React.useState('');
  const [debouncedClientQuery, setDebouncedClientQuery] = React.useState('');
  const [isClientsLoading, setIsClientsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] =
    React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(
    null,
  );
  const [paymentMode, setPaymentMode] = React.useState<PaymentMode>('paid');
  const [totalInput, setTotalInput] = React.useState('');
  const [paidInput, setPaidInput] = React.useState('');
  const [savedJob, setSavedJob] = React.useState<FieldJobSnapshot | null>(null);
  const prefillAppliedRef = React.useRef<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: undefined,
      client_name: '',
      client_tel: '',
      work_notes: '',
      total: 0,
      company_id: selectedCompany?.id ?? 0,
    },
  });

  const draftKey =
    selectedCompany?.id != null
      ? buildAnotarDraftStorageKey(selectedCompany.id)
      : null;
  const restoredDraftKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (selectedCompany?.id && selectedCompany?.name !== 'System') {
      form.setValue('company_id', selectedCompany.id);
    }
  }, [selectedCompany?.id, selectedCompany?.name, form]);

  React.useEffect(() => {
    if (!draftKey || restoredDraftKeyRef.current === draftKey) {
      return;
    }
    restoredDraftKeyRef.current = draftKey;
    const draft = readAnotarFormDraft(draftKey);
    if (!draft) {
      return;
    }
    if (draft.client_id != null) {
      form.setValue('client_id', draft.client_id);
    }
    if (draft.client_name) {
      form.setValue('client_name', draft.client_name);
    }
    if (draft.client_tel) {
      form.setValue('client_tel', draft.client_tel);
    }
    if (draft.work_notes != null) {
      form.setValue('work_notes', draft.work_notes);
    }
    if (draft.company_id != null) {
      form.setValue('company_id', draft.company_id);
    }
    if (draft.totalInput != null) {
      setTotalInput(draft.totalInput);
    }
    if (draft.paidInput != null) {
      setPaidInput(draft.paidInput);
    }
    if (draft.paymentMode) {
      setPaymentMode(draft.paymentMode);
    }
  }, [draftKey, form]);

  React.useEffect(() => {
    if (!draftKey) {
      return;
    }
    const draft = readAnotarFormDraft(draftKey);
    if (!draft?.client_id) {
      return;
    }
    const match = clients.find((item) => item.id === draft.client_id);
    if (match) {
      setSelectedClient(match);
      return;
    }
    let cancelled = false;
    void getClient(draft.client_id).then((result) => {
      if (cancelled || !result.success || !result.data) {
        return;
      }
      setSelectedClient(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [clients, draftKey]);

  React.useEffect(() => {
    if (!draftKey) {
      return;
    }
    const subscription = form.watch((values) => {
      writeAnotarFormDraft(draftKey, {
        client_id: values.client_id,
        client_name: values.client_name,
        client_tel: values.client_tel,
        work_notes: values.work_notes,
        company_id: values.company_id,
        totalInput,
        paidInput,
        paymentMode,
      });
    });
    return () => subscription.unsubscribe();
  }, [draftKey, form, totalInput, paidInput, paymentMode]);

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedClientQuery(clientQuery.trim());
    }, CLIENT_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [clientQuery]);

  React.useEffect(() => {
    let cancelled = false;

    const fetchClients = async () => {
      if (!selectedCompany?.id) {
        if (!cancelled) {
          setIsClientsLoading(false);
        }
        return;
      }

      setIsClientsLoading(true);
      const result = await getClients({
        companyId: selectedCompany.id,
        page: 1,
        pageSize: CLIENT_SEARCH_PAGE_SIZE,
        search: debouncedClientQuery || undefined,
      });

      if (!cancelled) {
        if (result.success && result.data) {
          setClients(result.data.items);
        }
        setIsClientsLoading(false);
      }
    };

    void fetchClients();
    return () => {
      cancelled = true;
    };
  }, [selectedCompany?.id, debouncedClientQuery]);

  React.useEffect(() => {
    if (!prefillClientId || prefillAppliedRef.current === prefillClientId) {
      return;
    }
    const id = Number.parseInt(prefillClientId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }
    prefillAppliedRef.current = prefillClientId;
    let cancelled = false;
    void getClient(id).then((result) => {
      if (cancelled || !result.success || !result.data) {
        return;
      }
      const match = result.data;
      setSelectedClient(match);
      setClients((prev) =>
        prev.some((item) => item.id === match.id) ? prev : [match, ...prev],
      );
      form.setValue('client_id', match.id);
      form.setValue('client_name', match.name);
      form.setValue('client_tel', match.phone || '');
    });
    return () => {
      cancelled = true;
    };
  }, [prefillClientId, form]);

  const handleClientSelect = (clientId: string) => {
    if (!clientId) {
      setSelectedClient(null);
      form.setValue('client_id', undefined);
      form.setValue('client_name', '');
      form.setValue('client_tel', '');
      return;
    }
    const match = clients.find((item) => item.id === Number.parseInt(clientId, 10));
    if (!match) {
      return;
    }

    setSelectedClient(match);
    form.setValue('client_id', match.id);
    form.setValue('client_name', match.name);
    form.setValue('client_tel', match.phone || '');
  };

  const clientOptions = React.useMemo(() => {
    const options = clients.map((clientItem) => ({
      value: String(clientItem.id),
      label: clientItem.phone
        ? `${clientItem.name} · ${clientItem.phone}`
        : clientItem.name,
    }));
    if (
      selectedClient &&
      !options.some((option) => option.value === String(selectedClient.id))
    ) {
      options.unshift({
        value: String(selectedClient.id),
        label: selectedClient.phone
          ? `${selectedClient.name} · ${selectedClient.phone}`
          : selectedClient.name,
      });
    }
    return options;
  }, [clients, selectedClient]);

  const totalAmount = roundMoney(parseMoneyInput(totalInput));

  React.useEffect(() => {
    form.setValue('total', totalAmount);
    if (paymentMode === 'paid') {
      setPaidInput(totalAmount > 0 ? totalAmount.toFixed(2) : '');
    }
    if (paymentMode === 'pending') {
      setPaidInput('');
    }
  }, [totalAmount, paymentMode, form]);

  const getPaidAmount = (): number => {
    if (paymentMode === 'paid') {
      return totalAmount;
    }
    if (paymentMode === 'pending') {
      return 0;
    }
    return roundMoney(parseMoneyInput(paidInput));
  };

  const paidAmount = getPaidAmount();
  const paidExceedsTotal =
    paymentMode === 'partial' && paidAmount > totalAmount + 0.001;

  const onSubmit = async (values: FormValues) => {
    if (paidExceedsTotal) {
      toast.error('El monto pagado no puede ser mayor al total. Código: TC009');
      return;
    }

    const companyId = selectedCompany?.id ?? values.company_id;
    const paid = getPaidAmount();
    const total = roundMoney(values.total);
    const workNotes = values.work_notes ?? '';

    const saveOffline = async () => {
      if (!companyId) {
        toast.error('Selecciona una empresa para guardar en el teléfono');
        return;
      }
      await enqueueFieldJobCreate(fieldJobStore, {
        companyId,
        payload: {
          client_id: values.client_id,
          client_name: values.client_name,
          client_tel: values.client_tel,
          work_notes: workNotes,
          notes: workNotes,
          ticket_date: new Date().toISOString(),
          total,
          paid,
          finished: true,
        },
      });
      toast.success('Guardado en el teléfono');
      vibrateSuccess();
      if (draftKey) {
        clearAnotarFormDraft(draftKey);
      }
      // Soft-nav needs network for RSC; stay put while offline so the toast remains.
      if (typeof navigator === 'undefined' || navigator.onLine) {
        router.push('/dashboard');
      }
    };

    try {
      setIsSubmitting(true);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await saveOffline();
        return;
      }

      const result = await anotarCapture({
        client_id: values.client_id,
        client_name: values.client_name,
        client_tel: values.client_tel,
        work_notes: workNotes,
        total,
        paid,
        company_id: companyId,
        ticket_date: new Date(),
      });

      if (result.success && result.data) {
        if (draftKey) {
          clearAnotarFormDraft(draftKey);
        }
        toast.success('Trabajo guardado correctamente');
        vibrateSuccess();
        setSavedJob(
          toFieldJobSnapshotFromAnotarSuccess({
            ticketId: result.data.id,
            clientName: values.client_name,
            clientTel: values.client_tel,
            workNotes: workNotes,
            total,
            paid,
            finished: true,
            companyId,
            companyName: selectedCompany?.name,
          }),
        );
        return;
      }

      const errorContent = buildToastErrorContent(
        result,
        'No se pudo guardar el trabajo',
      );
      if (errorContent.errorType === 'network') {
        await saveOffline();
        return;
      }
      toast.error(errorContent.title, {
        description: errorContent.description,
      });
    } catch (error) {
      console.error('Error saving anotar capture:', error);
      const errorType = classifyClientError(error);
      if (errorType === 'network') {
        try {
          await saveOffline();
          return;
        } catch {
          // fall through
        }
      }
      const description = getErrorMessageByType(
        errorType,
        'Ocurrió un error al guardar el trabajo',
      );
      toast.error(errorType === 'network' ? 'Sin conexión' : description, {
        description:
          errorType === 'network'
            ? `${description} ${ANOTAR_RETRY_GUIDANCE}`
            : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isClientListEmpty =
    !isClientsLoading && clients.length === 0 && !debouncedClientQuery;

  if (savedJob) {
    return (
      <>
        <TripledPageHeader
          className="hidden md:flex"
          items={[
            { label: 'Hoy', href: '/dashboard' },
            { label: 'Anotar' },
            { label: 'Enviar' },
          ]}
        />
        <TripledDashboardShell
          maxWidthClassName="max-w-2xl"
          contentClassName="space-y-4"
        >
          <TripledMobileAppBar
            title="Listo"
            subtitle="Envía el comprobante"
            backHref="/dashboard"
            backLabel="Volver a Hoy"
          />
          <FieldSendSuccessPanel
            job={savedJob}
            canWrite
            onDoneHref="/dashboard"
            onDoneLabel="Listo"
          />
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setSavedJob(null);
              form.reset({
                client_id: undefined,
                client_name: '',
                client_tel: '',
                work_notes: '',
                total: 0,
                company_id: selectedCompany?.id ?? 0,
              });
              setSelectedClient(null);
              setTotalInput('');
              setPaidInput('');
              setPaymentMode('paid');
            }}
          >
            Anotar otro trabajo
          </Button>
        </TripledDashboardShell>
      </>
    );
  }

  return (
    <>
      <TripledPageHeader
        className="hidden md:flex"
        items={[
          { label: 'Tickets', href: '/tickets' },
          { label: 'Anotar trabajo' },
        ]}
      />

      <TripledDashboardShell
        maxWidthClassName="max-w-2xl"
        contentClassName="space-y-4"
        hasMobileStickyAction
      >
        <TripledMobileAppBar
          title="Anotar trabajo"
          subtitle="Captura rápida en campo"
          backHref="/tickets"
          backLabel="Volver a tickets"
        />

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight">
              Trabajo del día
            </CardTitle>
            <CardDescription>
              Registra cliente, qué hiciste y cuánto cobraste en un solo paso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                id={ANOTAR_FORM_ID}
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="min-w-0 flex-1">
                          <FormControl>
                            <SearchableSelect
                              aria-label="Buscar cliente"
                              options={clientOptions}
                              value={
                                field.value != null && field.value > 0
                                  ? String(field.value)
                                  : ''
                              }
                              onValueChange={handleClientSelect}
                              onSearchChange={setClientQuery}
                              isLoading={isClientsLoading}
                              placeholder="Selecciona un cliente"
                              searchPlaceholder="Buscar por nombre o teléfono…"
                              emptyText="Sin clientes que coincidan"
                              className="h-12 w-full rounded-xl border border-input bg-background text-base shadow-sm md:h-10 md:text-sm"
                            />
                          </FormControl>
                        </div>

                        <Dialog
                          open={isNewClientDialogOpen}
                          onOpenChange={setIsNewClientDialogOpen}
                        >
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-12 w-full shrink-0 gap-2 rounded-xl sm:w-auto md:h-10"
                            >
                              <Plus className="h-4 w-4 shrink-0" aria-hidden />
                              Nuevo cliente
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="flex max-h-[min(90vh,100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg flex-col overflow-hidden rounded-2xl p-0 sm:w-full">
                            <DialogHeader className="shrink-0 border-b border-border/60 px-6 pb-4 pr-12 pt-6">
                              <DialogTitle>Crear nuevo cliente</DialogTitle>
                              <DialogDescription>
                                Nombre y teléfono bastan para anotar el trabajo
                              </DialogDescription>
                            </DialogHeader>
                            <ClientForm
                              compact
                              onCancel={() => setIsNewClientDialogOpen(false)}
                              onSuccess={(savedClient) => {
                                setIsNewClientDialogOpen(false);
                                if (!savedClient) {
                                  return;
                                }
                                setClients((prev) =>
                                  prev.some((item) => item.id === savedClient.id)
                                    ? prev
                                    : [savedClient, ...prev],
                                );
                                setSelectedClient(savedClient);
                                form.setValue('client_id', savedClient.id);
                                form.setValue('client_name', savedClient.name);
                                form.setValue(
                                  'client_tel',
                                  savedClient.phone || '',
                                );
                              }}
                            />
                          </DialogContent>
                        </Dialog>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isClientListEmpty && (
                  <p
                    className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
                    role="status"
                  >
                    No hay clientes registrados. Usa{' '}
                    <span className="font-medium text-foreground">
                      Nuevo cliente
                    </span>{' '}
                    para crear el primero.
                  </p>
                )}

                {selectedClient && (
                  <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Cliente seleccionado
                    </p>
                    <div className="flex items-start gap-2 text-sm">
                      <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">{selectedClient.name}</p>
                        {selectedClient.phone ? (
                          <ClientPhoneLink phone={selectedClient.phone} />
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="work_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qué hice</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={4}
                          placeholder="Describe brevemente el trabajo realizado"
                          className="min-h-[120px] resize-y rounded-xl text-base md:text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label htmlFor="anotar-total">Total</Label>
                  <Input
                    id="anotar-total"
                    inputMode="decimal"
                    type="text"
                    value={totalInput}
                    onChange={(event) => setTotalInput(event.target.value)}
                    placeholder="0.00"
                    className="h-12 rounded-xl text-base tabular-nums md:h-10 md:text-sm"
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-sm font-medium text-foreground">Pagó</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                        paymentMode === 'paid'
                          ? 'border-primary/40 bg-primary/10 text-foreground'
                          : 'border-border bg-background hover:bg-muted/50',
                      )}
                      onClick={() => setPaymentMode('paid')}
                    >
                      {paymentMode === 'paid' ? (
                        <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      Pagado
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                        paymentMode === 'partial'
                          ? 'border-primary/40 bg-primary/10 text-foreground'
                          : 'border-border bg-background hover:bg-muted/50',
                      )}
                      onClick={() => setPaymentMode('partial')}
                    >
                      {paymentMode === 'partial' ? (
                        <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      Parcial
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                        paymentMode === 'pending'
                          ? 'border-primary/40 bg-primary/10 text-foreground'
                          : 'border-border bg-background hover:bg-muted/50',
                      )}
                      onClick={() => setPaymentMode('pending')}
                    >
                      {paymentMode === 'pending' ? (
                        <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      Pendiente
                    </button>
                  </div>

                  {paymentMode === 'paid' && totalAmount > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Cobro completo:{' '}
                      <FormattedCurrency amount={totalAmount} />
                    </p>
                  ) : null}

                  {paymentMode === 'partial' ? (
                    <div className="space-y-2">
                      <label
                        htmlFor="anotar-paid"
                        className="text-xs text-muted-foreground"
                      >
                        Cuánto pagó el cliente
                      </label>
                      <Input
                        id="anotar-paid"
                        inputMode="decimal"
                        type="text"
                        value={paidInput}
                        onChange={(event) => setPaidInput(event.target.value)}
                        placeholder="0.00"
                        className="h-12 rounded-xl text-base tabular-nums md:h-10 md:text-sm"
                      />
                      {paidExceedsTotal ? (
                        <p className="text-xs text-destructive">
                          El monto pagado no puede ser mayor al total.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {paymentMode === 'pending' ? (
                    <p className="text-sm text-muted-foreground">
                      Se registrará sin pago inicial.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Más opciones
                  </p>
                  <Link
                    href="/tickets/create"
                    className="mt-1 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Creación completa (oficina)
                  </Link>
                </div>

                <div className="hidden md:block">
                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl font-semibold"
                    disabled={isSubmitting || paidExceedsTotal}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden
                        />
                        Guardando…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                        Guardar trabajo
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </TripledDashboardShell>

      <TripledMobileStickyActionBar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {selectedClient?.name ?? 'Selecciona un cliente'}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            Total: <FormattedCurrency amount={totalAmount} />
            {' · '}
            Pagó: <FormattedCurrency amount={paidAmount} />
          </p>
        </div>
        <Button
          type="submit"
          form={ANOTAR_FORM_ID}
          className="h-12 shrink-0 rounded-xl px-5 font-semibold"
          disabled={isSubmitting || paidExceedsTotal}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            'Guardar'
          )}
        </Button>
      </TripledMobileStickyActionBar>
    </>
  );
};

const AnotarPageFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
    <span className="sr-only">Cargando captura rápida</span>
  </div>
);

export default function AnotarPage() {
  return (
    <React.Suspense fallback={<AnotarPageFallback />}>
      <AnotarPageContent />
    </React.Suspense>
  );
}
