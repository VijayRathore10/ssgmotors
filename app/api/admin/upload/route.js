import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('nik_admin_auth');
  return token?.value === 'nik-authorized-session-token-v1';
}

export async function POST(request) {
  if (!(await checkAuth())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll('files');
    const singleFile = formData.get('file');

    const fileList = files.length > 0 ? files : (singleFile ? [singleFile] : []);

    if (fileList.length === 0) {
      return Response.json({ error: 'No files provided for upload' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uploadedUrls = [];

    for (const file of fileList) {
      if (!file || typeof file.arrayBuffer !== 'function') continue;

      const buffer = Buffer.from(await file.arrayBuffer());

      // Validate allowed mime type
      const mime = file.type || '';
      if (mime && !mime.startsWith('image/')) {
        return Response.json(
          { error: `File "${file.name}" is not an image (detected ${mime})` },
          { status: 400 }
        );
      }

      // Safe clean extension
      let ext = path.extname(file.name || '').toLowerCase();
      if (!ext) {
        if (mime === 'image/jpeg') ext = '.jpg';
        else if (mime === 'image/png') ext = '.png';
        else if (mime === 'image/webp') ext = '.webp';
        else if (mime === 'image/gif') ext = '.gif';
        else if (mime === 'image/svg+xml') ext = '.svg';
        else ext = '.jpg';
      }

      // Clean base name
      const originalBase = path
        .basename(file.name || 'image', ext)
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .toLowerCase()
        .slice(0, 32);

      const uniqueName = `${originalBase || 'img'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
      const filePath = path.join(uploadsDir, uniqueName);

      fs.writeFileSync(filePath, buffer);
      uploadedUrls.push(`/uploads/${uniqueName}`);
    }

    return Response.json({
      success: true,
      urls: uploadedUrls,
      url: uploadedUrls[0] || null,
      count: uploadedUrls.length,
    });
  } catch (err) {
    console.error('File upload failed:', err);
    return Response.json({ error: err.message || 'File upload failed' }, { status: 500 });
  }
}
