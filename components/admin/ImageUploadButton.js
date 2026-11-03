'use client';

import React, { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

// Optional in-browser image optimization to prevent uploading huge 10MB raw files
async function optimizeImageBeforeUpload(file, maxWidth = 1920, quality = 0.88) {
  // If SVG or GIF, don't re-encode (keeps animation or vector precision)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  // If small already (< 400KB), return as is
  if (file.size < 400 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
              resolve(new File([blob], cleanName, { type: 'image/webp' }));
            } else {
              resolve(file);
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export default function ImageUploadButton({
  onUploaded,
  onMultipleUploaded,
  multiple = false,
  label = 'Upload Image',
  className = '',
  buttonStyle = 'primary', // 'primary' | 'secondary' | 'compact'
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');
    setSuccess(false);

    try {
      const optimizedFiles = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type && !file.type.startsWith('image/')) {
          throw new Error(`"${file.name}" is not a valid image`);
        }
        const opt = await optimizeImageBeforeUpload(file);
        optimizedFiles.push(opt);
      }

      const formData = new FormData();
      optimizedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      if (multiple && onMultipleUploaded) {
        onMultipleUploaded(data.urls || [data.url]);
      } else if (onUploaded) {
        onUploaded(data.url || data.urls?.[0]);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
      setTimeout(() => setError(''), 4000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleChange = (e) => {
    handleFiles(e.target.files);
  };

  const styleClasses = {
    primary:
      'px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50',
    secondary:
      'px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 hover:border-amber-400/60 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50',
    compact:
      'px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50',
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleChange}
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
        multiple={multiple}
        className="hidden"
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className={styleClasses[buttonStyle] || styleClasses.primary}
        title="Upload image from your computer / phone"
      >
        {uploading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Uploading...</span>
          </>
        ) : success ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Uploaded!</span>
          </>
        ) : (
          <>
            <Upload className="w-3.5 h-3.5" />
            <span>{label}</span>
          </>
        )}
      </button>

      {error && (
        <span className="text-[11px] text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </span>
      )}
    </div>
  );
}
