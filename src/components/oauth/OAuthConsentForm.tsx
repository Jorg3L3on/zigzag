'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

type ConsentParams = {
  client_id: string;
  redirect_uri: string;
  state?: string;
  scope?: string;
  code_challenge: string;
  code_challenge_method: 'S256';
  resource?: string;
};

type SelectableCompany = {
  id: number;
  name: string;
};

type OAuthConsentFormProps = {
  clientName: string;
  clientUri: string | null;
  requestedScope: string;
  consentParams: ConsentParams;
  companies: SelectableCompany[];
};

export default function OAuthConsentForm({
  clientName,
  clientUri,
  requestedScope,
  consentParams,
  companies,
}: OAuthConsentFormProps) {
  const [allowWrite, setAllowWrite] = useState(requestedScope.includes('write'));
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<number[]>(
    companies.length === 1 ? [companies[0]!.id] : [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleToggleCompany = (companyId: number, checked: boolean) => {
    setSelectedCompanyIds((prev) => {
      if (checked) return [...new Set([...prev, companyId])];
      return prev.filter((id) => id !== companyId);
    });
  };

  const handleDeny = () => {
    const redirect = new URL(consentParams.redirect_uri);
    redirect.searchParams.set('error', 'access_denied');
    redirect.searchParams.set('error_description', 'El usuario rechazó la autorización');
    if (consentParams.state) redirect.searchParams.set('state', consentParams.state);
    window.location.href = redirect.toString();
  };

  const canSubmit = selectedCompanyIds.length > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/oauth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: consentParams.client_id,
          redirect_uri: consentParams.redirect_uri,
          state: consentParams.state,
          scope: consentParams.scope,
          code_challenge: consentParams.code_challenge,
          code_challenge_method: consentParams.code_challenge_method,
          resource: consentParams.resource,
          allow_write: allowWrite ? 'true' : 'false',
          allowed_company_ids: selectedCompanyIds.map(String),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setSubmitError(payload?.error ?? 'No se pudo autorizar la conexión.');
        setIsSubmitting(false);
        return;
      }

      const { redirect_to } = (await response.json()) as { redirect_to: string };
      window.location.assign(redirect_to);
    } catch {
      setSubmitError('No se pudo autorizar la conexión.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <Card>
        <CardHeader className="space-y-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-base">Autorizar conexión MCP</CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">{clientName}</span>
              {clientUri ? (
                <>
                  {' '}
                  (
                  <a href={clientUri} className="underline" target="_blank" rel="noreferrer">
                    sitio del cliente
                  </a>
                  )
                </>
              ) : null}{' '}
              solicita acceso a ZigZag.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Elige qué compañías puede ver este agente. Debes seleccionar al menos una.
          </p>
          <div className="space-y-2 rounded-xl border border-border/60 p-3">
            {companies.map((company) => (
              <div key={company.id} className="flex items-center gap-2">
                <Checkbox
                  id={`company-${company.id}`}
                  checked={selectedCompanyIds.includes(company.id)}
                  onCheckedChange={(checked) =>
                    handleToggleCompany(company.id, checked === true)
                  }
                />
                <Label htmlFor={`company-${company.id}`} className="text-sm font-normal">
                  Compañía #{company.id} — {company.name}
                </Label>
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="allow-write"
                checked={allowWrite}
                onCheckedChange={(checked) => setAllowWrite(checked === true)}
              />
              <Label htmlFor="allow-write" className="text-sm font-normal">
                Permitir escritura (crear tickets y cambiar estados)
              </Label>
            </div>
            {submitError ? (
              <p className="text-sm text-destructive" role="alert">
                {submitError}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                onClick={handleDeny}
                disabled={isSubmitting}
              >
                Rechazar
              </Button>
              <Button
                type="submit"
                className="h-11 flex-1 rounded-xl"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? 'Autorizando…' : 'Autorizar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
