'use client';

import React from 'react';
import {
  assignCompanyPlan,
  clearCompanyEntitlementOverride,
  getCompanyEntitlements,
  listCompanyPlanOptions,
  setCompanyEntitlementOverrides,
  type CompanyEntitlementSnapshot,
} from '@/actions/company-entitlements';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type EntitlementMetric,
} from '@/lib/company-entitlements';
import { toast } from 'sonner';

type PlanOption = { id: number; slug: string; name: string };

type OperatorPlanControlsProps = {
  companyId: number;
  onUpdated: () => void;
};

export const OperatorPlanControls = ({
  companyId,
  onUpdated,
}: OperatorPlanControlsProps) => {
  const [planOptions, setPlanOptions] = React.useState<PlanOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string>('');
  const [metrics, setMetrics] = React.useState<
    CompanyEntitlementSnapshot['metrics']
  >([]);
  const [draftOverrides, setDraftOverrides] = React.useState<
    Partial<Record<EntitlementMetric, string>>
  >({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [plansResult, entitlementsResult] = await Promise.all([
        listCompanyPlanOptions(),
        getCompanyEntitlements(companyId),
      ]);

      if (plansResult.success && plansResult.data) {
        setPlanOptions(plansResult.data);
      }

      if (entitlementsResult.success && entitlementsResult.data) {
        setSelectedPlanId(String(entitlementsResult.data.planId));
        setMetrics(entitlementsResult.data.metrics);
        const nextDraft: Partial<Record<EntitlementMetric, string>> = {};
        for (const metric of entitlementsResult.data.metrics) {
          if (metric.isOverridden) {
            nextDraft[metric.metric] =
              metric.limit == null ? '' : String(metric.limit);
          }
        }
        setDraftOverrides(nextDraft);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleAssignPlan = async () => {
    if (!selectedPlanId) {
      return;
    }
    setSaving(true);
    try {
      const result = await assignCompanyPlan(
        companyId,
        Number.parseInt(selectedPlanId, 10),
      );
      if (!result.success) {
        toast.error(result.error || 'No se pudo asignar el plan');
        return;
      }
      toast.success('Plan actualizado');
      onUpdated();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOverrides = async () => {
    setSaving(true);
    try {
      const overrides = Object.fromEntries(
        Object.entries(draftOverrides).map(([metric, value]) => {
          const trimmed = value?.trim() ?? '';
          if (!trimmed) {
            return [metric, undefined];
          }
          if (trimmed.toLowerCase() === 'null' || trimmed === '-') {
            return [metric, null];
          }
          return [metric, Number.parseInt(trimmed, 10)];
        }),
      );

      const result = await setCompanyEntitlementOverrides(companyId, overrides);
      if (!result.success) {
        toast.error(result.error || 'No se pudieron guardar los overrides');
        return;
      }
      toast.success('Overrides actualizados');
      onUpdated();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleClearOverride = async (metric: EntitlementMetric) => {
    setSaving(true);
    try {
      const result = await clearCompanyEntitlementOverride(companyId, metric);
      if (!result.success) {
        toast.error(result.error || 'No se pudo limpiar el override');
        return;
      }
      toast.success('Override eliminado');
      onUpdated();
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando plan…</p>;
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-4">
      <div className="space-y-2">
        <Label htmlFor="operator-plan-select">Plan comercial</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger id="operator-plan-select" aria-label="Plan comercial">
              <SelectValue placeholder="Selecciona un plan" />
            </SelectTrigger>
            <SelectContent>
              {planOptions.map((planOption) => (
                <SelectItem key={planOption.id} value={String(planOption.id)}>
                  {planOption.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            className="min-h-11"
            disabled={saving}
            onClick={handleAssignPlan}
          >
            Guardar plan
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Overrides por métrica</p>
        {metrics.map((metric) => (
          <div
            key={metric.metric}
            className="grid gap-2 rounded-md border border-border/50 p-3 sm:grid-cols-[1fr_auto_auto]"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium capitalize">{metric.label}</p>
              <p className="text-xs text-muted-foreground">
                Catálogo: {metric.catalogLimit ?? 'sin límite'} · Efectivo:{' '}
                {metric.limit ?? 'sin límite'} ({metric.usage} en uso)
              </p>
              {metric.isOverridden ? (
                <Badge variant="secondary">Override activo</Badge>
              ) : (
                <Badge variant="outline">Catálogo</Badge>
              )}
            </div>
            <Input
              aria-label={`Override ${metric.label}`}
              placeholder="Entero o vacío"
              value={draftOverrides[metric.metric] ?? ''}
              onChange={(event) =>
                setDraftOverrides((current) => ({
                  ...current,
                  [metric.metric]: event.target.value,
                }))
              }
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving || !metric.isOverridden}
              onClick={() => void handleClearOverride(metric.metric)}
            >
              Limpiar
            </Button>
          </div>
        ))}
        <Button
          type="button"
          className="min-h-11"
          disabled={saving}
          onClick={handleSaveOverrides}
        >
          Guardar overrides
        </Button>
      </div>
    </div>
  );
};
