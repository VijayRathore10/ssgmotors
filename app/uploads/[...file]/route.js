import fs from 'fs';
import path from 'path';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  try {
    const params = await context.params;
    const fileSegments = Array.isArray(params?.file) ? params.file : [params?.file];
    const filename = fileSegments.filter(Boolean).join('/');

    if (!filename) {
      return new Response('Not Found', { status: 404 });
    }

    const safeFilename = path.basename(filename);
    const localPath = path.join(process.cwd(), 'public', 'uploads', safeFilename);

    // 1. Check if file is already present on local disk
    if (fs.existsSync(localPath)) {
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(safeFilename).toLowerCase();
      let contentType = 'image/jpeg';
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.svg') contentType = 'image/svg+xml';

      return new Response(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // 2. Fallback: Restore from Firestore database if container was redeployed
    try {
      const docSnap = await getDoc(doc(db, 'uploadedImages', safeFilename));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data?.base64) {
          const buffer = Buffer.from(data.base64, 'base64');
          // Cache to local disk for subsequent requests
          const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          fs.writeFileSync(localPath, buffer);

          return new Response(buffer, {
            headers: {
              'Content-Type': data.contentType || 'image/jpeg',
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      }
    } catch (restoreErr) {
      console.warn('Could not restore image from Firestore backup:', restoreErr?.message);
    }

    return new Response('Image Not Found', { status: 404 });
  } catch (err) {
    console.error('Error serving upload:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
