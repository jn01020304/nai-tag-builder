export function dispatchPasteEvent(blob: Blob): void {
  const file = new File([blob], 'novelai_image.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);

  const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dt,
  });

  const target = document.querySelector('.ProseMirror') || document.body;
  target.dispatchEvent(pasteEvent);
}
