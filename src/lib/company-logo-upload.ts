import sharp from 'sharp';
import {
  type CompanyLogoContentType,
  validateCompanyLogoUpload,
} from '@/lib/company-logo-storage';
import { ValidationError } from '@/lib/errors';

export type ParsedCompanyLogoFile = {
  buffer: Buffer;
  contentType: CompanyLogoContentType;
  width: number;
  height: number;
};

export const parseCompanyLogoFile = async (
  file: File,
): Promise<ParsedCompanyLogoFile> => {
  if (!(file instanceof File) || file.size === 0) {
    throw new ValidationError('Selecciona un archivo de imagen.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const validation = validateCompanyLogoUpload({
    contentType: file.type,
    size: file.size,
    width,
    height,
  });

  if (!validation.ok) {
    throw new ValidationError(validation.reason);
  }

  return {
    buffer,
    contentType: file.type as CompanyLogoContentType,
    width,
    height,
  };
};
