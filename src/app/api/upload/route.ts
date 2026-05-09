import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { fail, ok } from '@/lib/api-helpers';

const ALLOWED_MIME_TYPES = new Set(['application/pdf']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail('Unauthorized', 401, 'auth');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return fail('No file uploaded', 400, 'validation');
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return fail('Only PDF files are allowed', 400, 'validation');
    }

    if (file.size > MAX_FILE_SIZE) {
      return fail('File too large', 400, 'validation');
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeFileName = `${randomUUID()}.pdf`;
    const uploadDir = join(process.cwd(), 'public', 'pdfs');
    const filePath = join(uploadDir, safeFileName);
    await mkdir(uploadDir, { recursive: true });

    await writeFile(filePath, buffer);

    return ok({
      path: `/pdfs/${safeFileName}`,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return fail('Error uploading file', 500, 'server');
  }
}
