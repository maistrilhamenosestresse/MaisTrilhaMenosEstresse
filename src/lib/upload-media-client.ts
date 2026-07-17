export async function uploadMediaToAws(file: File | Blob, originalName: string) {
  const contentType = file.type || inferContentType(originalName);
  const response = await fetch('/api/admin/upload-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: originalName, contentType, size: file.size }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Falha ao preparar upload para AWS');
  const upload = await fetch(result.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!upload.ok) throw new Error('Falha ao enviar mídia para AWS');
  return result as { url: string; key: string; type: 'image' | 'video'; size: number };
}

function inferContentType(filename: string) {
  const extension = filename.split('.').pop()?.toLowerCase();
  return ({
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
    mp4: 'video/mp4', mov: 'video/quicktime',
  } as Record<string, string>)[extension || ''] || 'application/octet-stream';
}
