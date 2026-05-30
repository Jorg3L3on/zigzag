'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { removeCompanyLogo, uploadCompanyLogo } from '@/actions/companies';
import {
  COMPANY_LOGO_ALLOWED_CONTENT_TYPES,
  COMPANY_LOGO_MAX_BYTES,
  resolveCompanyLogoUrl,
} from '@/lib/company-logo-storage';
import {
  classifyClientError,
  getErrorMessageByType,
} from '@/lib/network-awareness';

type CompanyLogoUploadProps = {
  companyId: number;
  logoUrl: string | null;
};

const acceptTypes = COMPANY_LOGO_ALLOWED_CONTENT_TYPES.join(',');

export const CompanyLogoUpload = ({
  companyId,
  logoUrl: initialLogoUrl,
}: CompanyLogoUploadProps) => {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = React.useState(initialLogoUrl);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);

  const displayUrl = resolveCompanyLogoUrl(logoUrl);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (file.size > COMPANY_LOGO_MAX_BYTES) {
      toast.error('El archivo debe pesar 2 MB o menos.');
      return;
    }

    const formData = new FormData();
    formData.set('file', file);

    try {
      setIsUploading(true);
      const result = await uploadCompanyLogo(companyId, formData);
      if (!result.success || !result.data) {
        const errorType = classifyClientError(
          null,
          undefined,
          result.errorType,
        );
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudo subir el logo',
          ),
        );
        return;
      }

      setLogoUrl(result.data.logo);
      toast.success('Logo actualizado');
      router.refresh();
    } catch (error) {
      console.error(error);
      const errorType = classifyClientError(error);
      toast.error(
        getErrorMessageByType(errorType, 'No se pudo subir el logo'),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      setIsRemoving(true);
      const result = await removeCompanyLogo(companyId);
      if (!result.success) {
        const errorType = classifyClientError(
          null,
          undefined,
          result.errorType,
        );
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudo quitar el logo',
          ),
        );
        return;
      }

      setLogoUrl(null);
      toast.success('Logo eliminado');
      router.refresh();
    } catch (error) {
      console.error(error);
      const errorType = classifyClientError(error);
      toast.error(
        getErrorMessageByType(errorType, 'No se pudo quitar el logo'),
      );
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <section
      className="rounded-lg border border-border p-4"
      aria-labelledby="company-logo-heading"
    >
      <h3
        id="company-logo-heading"
        className="text-sm font-semibold text-foreground"
      >
        Logo de la empresa
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        PNG, JPEG o WebP. Máximo 2 MB y 1024×1024 px.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {displayUrl ? (
            <Image
              src={displayUrl}
              alt="Logo actual de la empresa"
              width={80}
              height={80}
              className="size-full object-contain"
              unoptimized={displayUrl.startsWith('/')}
            />
          ) : (
            <span className="px-2 text-center text-xs text-muted-foreground">
              Sin logo
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Input
            ref={inputRef}
            type="file"
            accept={acceptTypes}
            className="sr-only"
            onChange={handleUpload}
            aria-label="Seleccionar archivo de logo"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={isUploading || isRemoving}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="mr-2 size-4" aria-hidden />
            )}
            {displayUrl ? 'Reemplazar logo' : 'Subir logo'}
          </Button>
          {displayUrl ? (
            <Button
              type="button"
              variant="outline"
              disabled={isUploading || isRemoving}
              onClick={handleRemove}
            >
              {isRemoving ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="mr-2 size-4" aria-hidden />
              )}
              Quitar logo
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
};
