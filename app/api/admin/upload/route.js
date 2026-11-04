import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const AUTH_COOKIE = 'nik_admin_auth';
const TOKEN_VALUE = 'nik-authorized-session-token-v1';

async function checkAuth(request) {
  try {
    // 1. Check custom header (immune to iframe third-party cookie blocking)
    const headerToken =
      request.headers.get('x-admin-token') ||
      request.headers.get('authorization')?.replace('Bearer ', '');
    if (headerToken === TOKEN_VALUE) {
      return true;
    }

    // 2. Check standard cookie
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE);
    if (token?.value === TOKEN_VALUE) {
      return true;
    }
  } catch (err) {
    console.warn('Auth check warning:', err?.message || err);
  }
  return false;
}

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!(await checkAuth(request))) {
    return Response.json({ error: 'Unauthorized. Please log in to admin again.' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uploadedUrls = [];

    // Support both FormData (standard) and JSON (fallback for base64 uploads)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const rawList = Array.isArray(body.files) ? body.files : (body.file ? [body.file] : []);

      for (const item of rawList) {
        if (!item?.data) continue;
        const base64Data = item.data.replace(/^data:image\/[a-z0-9-+.]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const mime = item.type || 'image/jpeg';
        let ext = path.extname(item.name || '').toLowerCase() || '.webp';

        const originalBase = path
          .basename(item.name || 'image', ext)
          .replace(/[^a-zA-Z0-9-_]/g, '-')
          .toLowerCase()
          .slice(0, 32);

        const uniqueName = `${originalBase || 'img'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
        const filePath = path.join(uploadsDir, uniqueName);
        fs.writeFileSync(filePath, buffer);

        // Backup to Firestore if <= 900KB
        if (buffer.length <= 900 * 1024) {
          try {
            await setDoc(doc(db, 'uploadedImages', uniqueName), {
              filename: uniqueName,
              contentType: mime,
              base64: base64Data,
              createdAt: new Date().toISOString(),
            });
          } catch (dbErr) {
            console.warn('[Firestore upload backup warning]:', dbErr?.message || dbErr);
          }
        }

        uploadedUrls.push(`/uploads/${uniqueName}`);
      }
    } else {
      // Standard FormData processing
      const formData = await request.formData();
      const files = formData.getAll('files');
      const singleFile = formData.get('file');
      const fileList = files.length > 0 ? files : (singleFile ? [singleFile] : []);

      if (fileList.length === 0) {
        return Response.json({ error: 'No files provided for upload' }, { status: 400 });
      }

      for (const file of fileList) {
        if (!file || typeof file.arrayBuffer !== 'function') continue;

        const buffer = Buffer.from(await file.arrayBuffer());
        const mime = file.type || '';

        // Safe extension resolution
        let ext = path.extname(file.name || '').toLowerCase();
        if (!ext) {
          if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
          else if (mime.includes('png')) ext = '.png';
          else if (mime.includes('webp')) ext = '.webp';
          else if (mime.includes('gif')) ext = '.gif';
          else if (mime.includes('svg')) ext = '.svg';
          else ext = '.jpg';
        }

        const originalBase = path
          .basename(file.name || 'image', ext)
          .replace(/[^a-zA-Z0-9-_]/g, '-')
          .toLowerCase()
          .slice(0, 32);

        const uniqueName = `${originalBase || 'img'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
        const filePath = path.join(uploadsDir, uniqueName);

        // Write to local filesystem
        fs.writeFileSync(filePath, buffer);

        // Backup to Firestore if within document limit (<= 900KB)
        if (buffer.length <= 900 * 1024) {
          try {
            await setDoc(doc(db, 'uploadedImages', uniqueName), {
              filename: uniqueName,
              contentType: mime || 'image/jpeg',
              base64: buffer.toString('base64'),
              createdAt: new Date().toISOString(),
            });
          } catch (dbErr) {
            console.warn('[Firestore upload backup warning]:', dbErr?.message || dbErr);
          }
        }

        uploadedUrls.push(`/uploads/${uniqueName}`);
      }
    }

    if (uploadedUrls.length === 0) {
      return Response.json({ error: 'No valid image files could be processed' }, { status: 400 });
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
