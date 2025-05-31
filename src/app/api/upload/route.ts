import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create the path to save the file
    const uploadDir = join(process.cwd(), 'public', 'pdfs');
    const filePath = join(uploadDir, file.name);

    // Write the file
    await writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      path: `/pdfs/${file.name}`,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Error uploading file' },
      { status: 500 },
    );
  }
}
