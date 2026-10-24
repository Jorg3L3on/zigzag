'use client';

import {
  DEFAULT_FOLIO_PREFIX,
  FOLIO_PREFIX_MAX_LENGTH,
  formatFolio,
  normalizeFolioPrefix,
} from '@/lib/folio';
import React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  createCompany,
  updateCompany,
  updateOwnCompany,
} from '@/actions/companies';
import type { Company } from '@/db/schema';
import {
  COMPANY_TAGLINE_MAX,
  companyBootstrapSchema,
  companyFormSchema,
  type CompanyBootstrapFormValues,
  type CompanyFormValues,
} from '@/lib/company-schema';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';
import { normalizeCompanyLifecycleStatus } from '@/lib/company-lifecycle';
import {
  ACCOUNT_MAX_LENGTH,
  CARD_MAX_LENGTH,
  CARD_PAYMENT_WARNING,
  CLABE_LENGTH,
  PAYMENT_BANK_MAX,
  PAYMENT_HOLDER_MAX,
  PAYMENT_NOTE_MAX,
} from '@/lib/company-payment-info';
import { CompanyLogoUpload } from '@/components/companies/company-logo-upload';
import { CompanyFormSection } from '@/components/companies/company-form-section';
import { TripledMobileStickyActionBar } from '@/components/tripled';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DEFAULT_COMPANY_FORM_SECTIONS,
  firstInvalidCompanyField,
  readCompanyFormSections,
  summarizeCompanyAddress,
  summarizeCompanyGeneral,
  summarizeCompanyPayment,
  summarizeCompanySettings,
  writeCompanyFormSections,
  type CompanyFormSectionKey,
  type CompanyFormSectionState,
} from '@/lib/company-form-sections';

const COMPANY_FORM_ID = 'company-form';

const defaultSettings = {
  tagline: '',
  rfc: '',
  default_currency: 'MXN',
  folio_prefix_presupuesto: '',
  folio_prefix_ticket: '',
  experience_mode: 'auto' as 'auto' | 'campo' | 'office',
  payment_bank: '',
  payment_holder: '',
  payment_kind: '' as '' | 'clabe' | 'card' | 'account',
  payment_clabe: '',
  payment_card: '',
  payment_account: '',
  payment_note: '',
};

const emptyDefaults: CompanyBootstrapFormValues = {
  name: '',
  email: '',
  phone: '',
  street: '',
  interior_number: '',
  exterior_number: '',
  neighborhood: '',
  city: '',
  state: '',
  country: 'México',
  postal_code: '',
  status: 'SETUP',
  settings: { ...defaultSettings },
  owner: {
    name: '',
    email: '',
    password: '',
  },
};

interface CompanyFormProps {
  company?: Company;
  /**
   * 'system' (default): platform operator editing any company via `updateCompany`.
   * 'self': tenant admin editing their own company via `updateOwnCompany` and
   * returns to the company settings page.
   */
  mode?: 'system' | 'self';
  /**
   * Collapsible General / Dirección / Configuración below md with a sticky
   * Guardar (ZIG-I3-2). Defaults to true for `mode="self"`; the operator form
   * at /companies/[id] keeps the flat layout.
   */
  sectioned?: boolean;
}

export const CompanyForm = ({
  company,
  mode = 'system',
  sectioned,
}: CompanyFormProps) => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = Boolean(company);
  const isSelfService = mode === 'self';
  const isSectioned = sectioned ?? isSelfService;
  const isMobile = useIsMobile();
  const collapsible = isSectioned && isMobile;
  // Read synchronously on the client: the saved state only shows once the
  // form switches to mobile after hydration, so it cannot mismatch the server
  // markup, and no later effect flips a section the user already toggled.
  const [openSections, setOpenSections] = React.useState<CompanyFormSectionState>(
    () =>
      isSectioned && typeof window !== 'undefined'
        ? readCompanyFormSections()
        : DEFAULT_COMPANY_FORM_SECTIONS,
  );

  const setSectionOpen = (key: CompanyFormSectionKey, open: boolean) => {
    setOpenSections((current) => {
      const next = { ...current, [key]: open };
      writeCompanyFormSections(next);
      return next;
    });
  };

  const form = useForm<CompanyBootstrapFormValues>({
    resolver: (isEdit
      ? zodResolver(companyFormSchema)
      : zodResolver(companyBootstrapSchema)) as Resolver<CompanyBootstrapFormValues>,
    defaultValues: company
      ? {
          name: company.name,
          email: company.email,
          phone: company.phone,
          street: company.street,
          interior_number: company.interior_number ?? '',
          exterior_number: company.exterior_number,
          neighborhood: company.neighborhood,
          city: company.city,
          state: company.state,
          country: company.country,
          postal_code: company.postal_code,
          status: normalizeCompanyLifecycleStatus(company.status),
          settings: {
            tagline: company.settings?.tagline ?? '',
            rfc: company.settings?.rfc ?? '',
            default_currency:
              company.settings?.default_currency ?? 'MXN',
            folio_prefix_presupuesto: company.settings?.folio_prefix_presupuesto ?? '',
            folio_prefix_ticket: company.settings?.folio_prefix_ticket ?? '',
            experience_mode: company.settings?.experience_mode ?? 'auto',
            payment_bank: company.settings?.payment_bank ?? '',
            payment_holder: company.settings?.payment_holder ?? '',
            payment_kind: company.settings?.payment_kind ?? '',
            payment_clabe: company.settings?.payment_clabe ?? '',
            payment_card: company.settings?.payment_card ?? '',
            payment_account: company.settings?.payment_account ?? '',
            payment_note: company.settings?.payment_note ?? '',
          },
          owner: { name: '', email: '', password: '' },
        }
      : emptyDefaults,
  });

  const paymentKindValue = form.watch('settings.payment_kind');
  const paymentKind =
    paymentKindValue === 'card' || paymentKindValue === 'account' || paymentKindValue === 'clabe'
      ? paymentKindValue
      : 'clabe';

  const handleSubmit = async (data: CompanyBootstrapFormValues) => {
    try {
      setIsSubmitting(true);
      if (company) {
        const { owner: _owner, ...companyData } = data;
        const result = isSelfService
          ? await updateOwnCompany(companyData)
          : await updateCompany(company.id, companyData);
        if (!result.success) {
          const errorType = classifyClientError(
            null,
            undefined,
            result.errorType,
          );
          toast.error(
            getErrorMessageByType(
              errorType,
              result.error || 'No se pudo actualizar la empresa',
            ),
          );
          return;
        }
        toast.success('Empresa actualizada correctamente');
      } else {
        const result = await createCompany(data);
        if (!result.success) {
          const errorType = classifyClientError(
            null,
            undefined,
            result.errorType,
          );
          toast.error(
            getErrorMessageByType(
              errorType,
              result.error || 'No se pudo crear la empresa',
            ),
          );
          return;
        }
        toast.success('Empresa creada correctamente');
      }
      router.push(isSelfService ? '/company' : '/companies');
      router.refresh();
    } catch (error) {
      console.error(error);
      const errorType = classifyClientError(error);
      toast.error(
        getErrorMessageByType(errorType, 'Error al procesar la solicitud'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // A field hidden in a closed section: open it, then focus and scroll to it.
  const handleInvalid = (errors: FieldErrors<CompanyBootstrapFormValues>) => {
    if (!collapsible) {
      return;
    }
    const hit = firstInvalidCompanyField(errors as Record<string, unknown>);
    if (!hit) {
      return;
    }
    setSectionOpen(hit.section, true);
    window.requestAnimationFrame(() => {
      form.setFocus(hit.field as keyof CompanyBootstrapFormValues);
      document
        .querySelector(`[name="${hit.field}"]`)
        ?.scrollIntoView({ block: 'center' });
    });
  };

  const values = form.watch();
  // Separators only on md+ for sectioned forms (cards replace them on mobile);
  // CSS rather than isMobile so hydration does not change the DOM.
  const sectionSeparatorClass = isSectioned ? 'hidden md:block' : undefined;
  const submitLabel = isSubmitting
    ? 'Guardando…'
    : isEdit
      ? 'Guardar cambios'
      : 'Crear empresa';
  const logoUpload = company ? (
    <CompanyLogoUpload companyId={company.id} logoUrl={company.logo} />
  ) : null;

  return (
    <Form {...form}>
      <form
        id={COMPANY_FORM_ID}
        onSubmit={form.handleSubmit(handleSubmit, handleInvalid)}
        className={isSectioned ? 'space-y-4 md:space-y-8' : 'space-y-8'}
        noValidate={isSectioned}
      >
        <CompanyFormSection
          title="General"
          summary={summarizeCompanyGeneral(values)}
          sectioned={isSectioned}
          collapsible={collapsible}
          open={openSections.general}
          onOpenChange={(open) => setSectionOpen('general', open)}
          testId="company-form-section-general"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="organization" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado de la empresa</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Estado de la empresa">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SETUP">En configuración</SelectItem>
                      <SelectItem value="ACTIVE">Activa</SelectItem>
                      <SelectItem value="SUSPENDED">Suspendida</SelectItem>
                      <SelectItem value="ARCHIVED">Archivada</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo electrónico</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" autoComplete="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input {...field} type="tel" autoComplete="tel" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {/* Sectioned forms keep the logo inside General. */}
          {isSectioned && logoUpload ? <div className="pt-6">{logoUpload}</div> : null}
        </CompanyFormSection>

        {!isSectioned && logoUpload ? (
          <>
            <Separator />
            {logoUpload}
          </>
        ) : null}

        <Separator className={sectionSeparatorClass} />

        <CompanyFormSection
          title="Dirección"
          summary={summarizeCompanyAddress(values)}
          sectioned={isSectioned}
          collapsible={collapsible}
          open={openSections.direccion}
          onOpenChange={(open) => setSectionOpen('direccion', open)}
          testId="company-form-section-direccion"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Calle</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="street-address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="interior_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número interior</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Opcional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="exterior_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número exterior</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="neighborhood"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Colonia</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ciudad</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="address-level2" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="address-level1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>País</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="country-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="postal_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código postal</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="postal-code" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CompanyFormSection>

        {!isEdit ? (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Propietario de la empresa
              </h3>
              <p className="text-sm text-muted-foreground">
                Se crea el usuario administrador, el rol por defecto y la
                empresa en una sola operación.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="owner.name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del propietario</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="owner.email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo del propietario</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          autoComplete="email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="owner.password"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Contraseña inicial</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </>
        ) : null}

        <Separator className={sectionSeparatorClass} />

        <CompanyFormSection
          title="Configuración"
          summary={summarizeCompanySettings(values.settings)}
          sectioned={isSectioned}
          collapsible={collapsible}
          open={openSections.configuracion}
          onOpenChange={(open) => setSectionOpen('configuracion', open)}
          testId="company-form-section-configuracion"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="settings.tagline"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Lema o giro</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder="Climatización · Servicio técnico"
                    />
                  </FormControl>
                  <FormDescription className="flex justify-between gap-3">
                    <span>Aparece bajo el nombre en tus presupuestos y recibos</span>
                    <span
                      className="shrink-0 tabular-nums"
                      data-testid="company-tagline-counter"
                    >
                      {(field.value ?? '').length}/{COMPANY_TAGLINE_MAX}
                    </span>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="settings.rfc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RFC</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="settings.default_currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda por defecto</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="MXN" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="settings.folio_prefix_presupuesto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prefijo de presupuestos</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      maxLength={FOLIO_PREFIX_MAX_LENGTH}
                      placeholder="P"
                      autoCapitalize="characters"
                      data-testid="company-folio-prefix-presupuesto"
                    />
                  </FormControl>
                  <FormDescription>
                    Se usa en los presupuestos nuevos: {formatFolio(normalizeFolioPrefix(field.value) || DEFAULT_FOLIO_PREFIX.presupuesto, 1)}. Los anteriores no cambian.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="settings.folio_prefix_ticket"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prefijo de recibos</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      maxLength={FOLIO_PREFIX_MAX_LENGTH}
                      placeholder="R"
                      autoCapitalize="characters"
                      data-testid="company-folio-prefix-ticket"
                    />
                  </FormControl>
                  <FormDescription>
                    Se usa en los tickets nuevos: {formatFolio(normalizeFolioPrefix(field.value) || DEFAULT_FOLIO_PREFIX.ticket, 1)}. Los anteriores no cambian.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="settings.experience_mode"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Experiencia de inicio</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || 'auto'}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Experiencia de inicio">
                        <SelectValue placeholder="Automático (1 usuario = Campo)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="auto">
                        Automático (1 usuario = Campo)
                      </SelectItem>
                      <SelectItem value="campo">Campo</SelectItem>
                      <SelectItem value="office">Oficina</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Campo oculta gráficos y prioriza el trabajo del día en el
                    inicio. Déjalo en automático para que empresas de un solo
                    usuario usen Campo.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CompanyFormSection>

        <Separator className={sectionSeparatorClass} />

        <CompanyFormSection
          title="Para pagar por transferencia"
          summary={summarizeCompanyPayment(values.settings)}
          sectioned={isSectioned}
          collapsible={collapsible}
          open={openSections.pago}
          onOpenChange={(open) => setSectionOpen('pago', open)}
          testId="company-form-section-pago"
        >
          <p className="mb-4 text-sm text-muted-foreground">
            Opcional. Se imprime en tus recibos y se agrega a los mensajes de
            WhatsApp para que tu cliente sepa a dónde transferir. Aquí no se
            cobra nada.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="settings.payment_bank"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Banco</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      maxLength={PAYMENT_BANK_MAX}
                      placeholder="BBVA"
                      data-testid="company-payment-bank"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="settings.payment_holder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>A nombre de</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      maxLength={PAYMENT_HOLDER_MAX}
                      placeholder="Nombre del titular de la cuenta"
                      data-testid="company-payment-holder"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="settings.payment_kind"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Tipo</FormLabel>
                  <Select
                    value={field.value || 'clabe'}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="h-11" data-testid="company-payment-kind">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="clabe">CLABE</SelectItem>
                      <SelectItem value="card">Tarjeta</SelectItem>
                      <SelectItem value="account">Cuenta</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Un solo método por empresa. El recibo del ticket imprime el
                    que elijas.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {paymentKind === 'card' ? (
              <p
                role="note"
                data-testid="card-payment-warning"
                className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 md:col-span-2 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              >
                {CARD_PAYMENT_WARNING}
              </p>
            ) : null}
            {paymentKind === 'clabe' ? (
              <FormField
                control={form.control}
                name="settings.payment_clabe"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>CLABE</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={CLABE_LENGTH + 5}
                        placeholder="18 dígitos"
                        className="font-mono tracking-wide"
                        data-testid="company-payment-clabe"
                      />
                    </FormControl>
                    <FormDescription>
                      Los 18 dígitos de tu cuenta. Revisamos que el último dígito
                      coincida para evitar errores al copiarla.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {paymentKind === 'card' ? (
              <FormField
                control={form.control}
                name="settings.payment_card"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Número de tarjeta</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={CARD_MAX_LENGTH + 5}
                        placeholder="15 a 19 dígitos"
                        className="font-mono tracking-wide"
                        data-testid="company-payment-card"
                      />
                    </FormControl>
                    <FormDescription>
                      Sólo el número para el depósito. No pedimos vencimiento ni CVV.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {paymentKind === 'account' ? (
              <FormField
                control={form.control}
                name="settings.payment_account"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Número de cuenta</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={ACCOUNT_MAX_LENGTH + 5}
                        placeholder="10 u 11 dígitos"
                        className="font-mono tracking-wide"
                        data-testid="company-payment-account"
                      />
                    </FormControl>
                    <FormDescription>De 10 a 11 dígitos.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="settings.payment_note"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Indicación para tu cliente</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      maxLength={PAYMENT_NOTE_MAX}
                      placeholder="Manda tu comprobante por WhatsApp"
                      data-testid="company-payment-note"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CompanyFormSection>

        <Button
          className={
            isSectioned
              ? 'hidden min-h-11 md:inline-flex'
              : 'min-h-11 w-full sm:w-auto'
          }
          type="submit"
          disabled={isSubmitting}
        >
          {submitLabel}
        </Button>
      </form>
      {isSectioned ? (
        <TripledMobileStickyActionBar>
          <Button
            type="submit"
            form={COMPANY_FORM_ID}
            className="h-12 w-full text-base"
            disabled={isSubmitting}
          >
            {submitLabel}
          </Button>
        </TripledMobileStickyActionBar>
      ) : null}
    </Form>
  );
};
