'use client';

import * as React from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  confirmTwoFactorEnrollment,
  disableTwoFactor,
  getTwoFactorStatus,
  startTwoFactorEnrollment,
} from '@/actions/two-factor';

type Enrollment = { secret: string; otpauthUri: string; qrDataUrl: string };

export const TwoFactorSection = () => {
  const [enabled, setEnabled] = React.useState<boolean | null>(null);
  const [enrollment, setEnrollment] = React.useState<Enrollment | null>(null);
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const result = await getTwoFactorStatus();
    if (result.success && result.data) {
      setEnabled(result.data.enabled);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleStart = async () => {
    setBusy(true);
    try {
      const result = await startTwoFactorEnrollment();
      if (!result.success || !result.data) {
        toast.error(result.error || 'No se pudo iniciar la configuración');
        return;
      }
      setEnrollment(result.data);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const result = await confirmTwoFactorEnrollment(code);
      if (!result.success) {
        toast.error(result.error || 'Código inválido');
        return;
      }
      toast.success('Autenticación en dos pasos activada');
      setEnrollment(null);
      setCode('');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      const result = await disableTwoFactor(code);
      if (!result.success) {
        toast.error(result.error || 'Código inválido');
        return;
      }
      toast.success('Autenticación en dos pasos desactivada');
      setCode('');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (enabled === null) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-4">
      <div className="flex items-center gap-2">
        {enabled ? (
          <ShieldCheck className="size-5 text-green-600" aria-hidden />
        ) : (
          <ShieldOff className="size-5 text-muted-foreground" aria-hidden />
        )}
        <div>
          <h3 className="text-sm font-semibold">Autenticación en dos pasos (2FA)</h3>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? 'Activada. Se te pedirá un código al iniciar sesión.'
              : 'Protege tu cuenta con una app de autenticación (TOTP).'}
          </p>
        </div>
      </div>

      {!enabled && !enrollment ? (
        <Button type="button" onClick={handleStart} disabled={busy}>
          Activar 2FA
        </Button>
      ) : null}

      {!enabled && enrollment ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Escanea este código QR con tu app de autenticación y luego ingresa el
            código de 6 dígitos.
          </p>
          <Image
            src={enrollment.qrDataUrl}
            alt="Código QR para 2FA"
            width={180}
            height={180}
            unoptimized
            className="rounded-md border border-border/60"
          />
          <p className="break-all text-xs text-muted-foreground">
            Clave manual: <span className="font-mono">{enrollment.secret}</span>
          </p>
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="twofa-confirm">Código de verificación</Label>
            <Input
              id="twofa-confirm"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              placeholder="123456"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleConfirm} disabled={busy}>
              Confirmar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEnrollment(null);
                setCode('');
              }}
              disabled={busy}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {enabled ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="twofa-disable">
              Ingresa un código para desactivar
            </Label>
            <Input
              id="twofa-disable"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              placeholder="123456"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDisable}
            disabled={busy || code.trim().length === 0}
          >
            Desactivar 2FA
          </Button>
        </div>
      ) : null}
    </div>
  );
};
