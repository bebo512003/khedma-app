/**
 * Turns a PDF into page images in the browser, so books need no file storage:
 * each page becomes a ~100 KB WebP that fits in one Firestore document.
 */
export async function pdfToImages(file: File, onPage: (n: number, total: number, img: string) => Promise<void>) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const canvas = document.createElement('canvas');
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1100 / base.width });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    let q = 0.62;
    let img = canvas.toDataURL('image/webp', q);
    // Keep each page comfortably under the 1 MB document limit.
    while (img.length > 700_000 && q > 0.3) { q -= 0.1; img = canvas.toDataURL('image/webp', q); }
    await onPage(n, pdf.numPages, img);
    page.cleanup();
  }
  return pdf.numPages;
}
