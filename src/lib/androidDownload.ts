const MAX_APK_BYTES = 100_000_000;
const TAG = /^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?$/;

/** Bound memory use and verify the APK before making it available to the browser. */
export async function downloadAndroidApk(token: string, signal: AbortSignal): Promise<{ blob: Blob; name: string }> {
  if (!token || /\s/.test(token)) throw new Error('Accedi di nuovo per scaricare Savely.');
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(180_000)]);
  const metadata = await fetch('/api/android-update?channel=preview', { signal: requestSignal, cache: 'no-store', redirect: 'error' });
  if (!metadata.ok) throw new Error('Download Android non disponibile. Riprova più tardi.');
  const release = await metadata.json();
  const asset = release.assets?.length === 1 ? release.assets[0] : null;
  if (release.schema !== 1 || release.draft !== false || typeof release.tag_name !== 'string' || !TAG.test(release.tag_name) ||
    !asset || typeof asset.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}\.apk$/.test(asset.name) ||
    !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > MAX_APK_BYTES ||
    typeof asset.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(asset.digest)) {
    throw new Error('Metadati del download Android non validi.');
  }
  const sha256 = asset.digest.slice(7);
  const path = `/api/android-download?tag=${release.tag_name}&sha256=${sha256}`;
  if (asset.browser_download_url !== `https://www.savely.cc${path}`) throw new Error('Indirizzo del download Android non valido.');
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, signal: requestSignal, cache: 'no-store', redirect: 'error' });
  if (response.status === 401) throw new Error('Accedi di nuovo per scaricare Savely.');
  if (!response.ok || !response.body) throw new Error('Download Android non disponibile. Riprova più tardi.');
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > asset.size) throw new Error('Dimensione del download Android non valida.');
      chunks.push(new Uint8Array(value));
    }
  } finally { await reader.cancel(); }
  if (size !== asset.size) throw new Error('Download Android incompleto. Riprova.');
  const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const actual = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  if (actual !== sha256) throw new Error('Verifica del download Android non riuscita. Riprova.');
  requestSignal.throwIfAborted();
  return { blob, name: asset.name };
}
