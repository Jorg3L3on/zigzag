'use client';

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
import { Textarea } from '@/components/ui/textarea';
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
  summarizeCompanySettings,
  writeCompanyFormSections,
  type CompanyFormSectionKey,
  type CompanyFormSectionState,
} from '@/lib/company-form-sections';

const COMPANY_FORM_ID = 'company-form';

const defaultSettings = {
  rfc: '',
  invoice_footer_note: '',
  default_currency: 'MXN',
  experience_mode: 'auto' as 'auto' | 'campo' | 'office',
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
            rfc: company.settings?.rfc ?? '',
            invoice_footer_note:
              company.settings?.invoice_footer_note ?? '',
            default_currency:
              company.settings?.default_currency ?? 'MXN',
            experience_mode: company.settings?.experience_mode ?? 'auto',
          },
          owner: { name: '', email: '', password: '' },
        }
      : emptyDefaults,
  });

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
            <FormField
              control={form.control}
              name="settings.invoice_footer_note"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Notas al pie de recibo</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
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
