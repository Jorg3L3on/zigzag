'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Plug, ShieldOff, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledPageHeader,
  TripledResourceCard,
} from '@/components/tripled';

export type ApiKeySummary = {
  id: number;
  name: string;
  key_prefix: string;
  scopes: string[];
  allowed_company_ids: number[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type OAuthGrantSummary = {
  id: number;
  client_id: string;
  client_name: string;
  scopes: string[];
  allowed_company_ids: number[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type SelectableCompany = { id: number; name: string };

type CreatedKeyResponse = ApiKeySummary & { token: string };

const scopesLabel = (scopes: string[]) =>
  scopes.includes('write') ? 'Lectura y escritura' : 'Solo lectura';

const copyToClipboard = async (value: string, message: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  } catch {
    toast.error('No se pudo copiar. Copia el texto manualmente.');
  }
};

type ConnectionsPanelProps = {
  mcpUrl: string;
  companies: SelectableCompany[];
};

export function ConnectionsPanel({ mcpUrl, companies }: ConnectionsPanelProps) {
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [oauthGrants, setOAuthGrants] = useState<OAuthGrantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [allowWrite, setAllowWrite] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<number[]>(
    companies.length === 1 ? [companies[0]!.id] : [],
  );
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const activeKeys = useMemo(
    () => apiKeys.filter((key) => key.revoked_at == null),
    [apiKeys],
  );

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, grantsRes] = await Promise.all([
        fetch('/api/account/api-keys'),
        fetch('/api/account/oauth-grants'),
      ]);
      if (keysRes.ok) setApiKeys(await keysRes.json());
      if (grantsRes.ok) setOAuthGrants(await grantsRes.json());
    } catch {
      toast.error('No se pudieron cargar las conexiones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const handleToggleCompany = (companyId: number, checked: boolean) => {
    setSelectedCompanyIds((prev) => {
      if (checked) return [...new Set([...prev, companyId])];
      return prev.filter((id) => id !== companyId);
    });
  };

  const handleCreateKey = async () => {
    if (!newName.trim() || selectedCompanyIds.length === 0) {
      toast.error('Nombre y al menos una compañía son obligatorios');
      return;
    }
    setCreating(true);
    try {
      const response = await fetch('/api/account/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          scopes: allowWrite ? ['read', 'write'] : ['read'],
          allowed_company_ids: selectedCompanyIds,
        }),
      });
      const payload = (await response.json()) as CreatedKeyResponse | { error?: string };
      if (!response.ok) {
        toast.error('error' in payload ? payload.error : 'No se pudo crear la conexión');
        return;
      }
      setCreatedToken((payload as CreatedKeyResponse).token);
      setNewName('');
      await loadConnections();
      toast.success('Conexión creada');
    } catch {
      toast.error('No se pudo crear la conexión');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (id: number) => {
    const response = await fetch(`/api/account/api-keys/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('No se pudo revocar');
      return;
    }
    await loadConnections();
    toast.success('Conexión revocada');
  };

  const handleRevokeGrant = async (id: number) => {
    const response = await fetch(`/api/account/oauth-grants/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('No se pudo revocar');
      return;
    }
    await loadConnections();
    toast.success('Conexión OAuth revocada');
  };

  return (
    <TripledDashboardShell maxWidthClassName="max-w-3xl">
      <TripledPageHeader items={[{ label: 'Conexiones' }]} className="hidden md:flex" />
      <TripledMobileAppBar
        title="Conexiones"
        subtitle="Agentes MCP y OAuth"
        className="mb-3"
      />
      <TripledResourceCard
        title="Conector MCP"
        description="Conecta ChatGPT, Cursor u otros clientes MCP a tickets de ZigZag."
        icon={<Plug className="size-5" aria-hidden />}
      >
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">URL del servidor</CardTitle>
            <CardDescription className="break-all">{mcpUrl}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(mcpUrl, 'URL copiada')}
            >
              <Copy className="mr-2 size-4" aria-hidden />
              Copiar URL
            </Button>
          </CardContent>
        </Card>
      </TripledResourceCard>

      <TripledResourceCard
        title="Nueva llave de agente"
        description="Prefijo zigzag_… — se muestra una sola vez."
        icon={<KeyRound className="size-5" aria-hidden />}
        className="mt-4"
      >
        <div className="space-y-4">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Nombre (p. ej. Agente de soporte)"
            aria-label="Nombre de la conexión"
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id="new-allow-write"
              checked={allowWrite}
              onCheckedChange={(checked) => setAllowWrite(checked === true)}
            />
            <Label htmlFor="new-allow-write" className="text-sm font-normal">
              Permitir escritura (crear tickets y cambiar estados)
            </Label>
          </div>
          <div className="space-y-2 rounded-xl border border-border/60 p-3">
            <p className="text-sm font-medium">Compañías autorizadas</p>
            {companies.map((company) => (
              <div key={company.id} className="flex items-center gap-2">
                <Checkbox
                  id={`new-company-${company.id}`}
                  checked={selectedCompanyIds.includes(company.id)}
                  onCheckedChange={(checked) =>
                    handleToggleCompany(company.id, checked === true)
                  }
                />
                <Label htmlFor={`new-company-${company.id}`} className="text-sm font-normal">
                  #{company.id} — {company.name}
                </Label>
              </div>
            ))}
          </div>
          <Button
            type="button"
            onClick={handleCreateKey}
            disabled={creating || selectedCompanyIds.length === 0}
          >
            {creating ? 'Creando…' : 'Crear llave'}
          </Button>
          {createdToken ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="mb-2 font-medium">Copia este token ahora:</p>
              <code className="block break-all">{createdToken}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => copyToClipboard(createdToken, 'Token copiado')}
              >
                <Copy className="mr-2 size-4" aria-hidden />
                Copiar token
              </Button>
            </div>
          ) : null}
        </div>
      </TripledResourceCard>

      <TripledResourceCard
        title="Llaves activas"
        description={loading ? 'Cargando…' : `${activeKeys.length} conexión(es)`}
        icon={<Sparkles className="size-5" aria-hidden />}
        className="mt-4"
      >
        <div className="space-y-3">
          {activeKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay llaves activas.</p>
          ) : (
            activeKeys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground">{key.key_prefix}…</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="secondary">{scopesLabel(key.scopes)}</Badge>
                    <Badge variant="outline">
                      {key.allowed_company_ids.length} compañía(s)
                    </Badge>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevokeKey(key.id)}
                >
                  <ShieldOff className="mr-2 size-4" aria-hidden />
                  Revocar
                </Button>
              </div>
            ))
          )}
        </div>
      </TripledResourceCard>

      <TripledResourceCard
        title="Conexiones OAuth"
        description="Clientes como ChatGPT Developer Mode"
        icon={<Check className="size-5" aria-hidden />}
        className="mt-4"
      >
        <div className="space-y-3">
          {oauthGrants.filter((g) => g.revoked_at == null).length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay conexiones OAuth activas.</p>
          ) : (
            oauthGrants
              .filter((grant) => grant.revoked_at == null)
              .map((grant) => (
                <div
                  key={grant.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{grant.client_name}</p>
                    <p className="text-xs text-muted-foreground">{scopesLabel(grant.scopes)}</p>
                    <Badge variant="outline" className="mt-1">
                      {grant.allowed_company_ids.length} compañía(s)
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevokeGrant(grant.id)}
                  >
                    Revocar
                  </Button>
                </div>
              ))
          )}
        </div>
      </TripledResourceCard>
    </TripledDashboardShell>
  );
}
