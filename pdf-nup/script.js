/* ==========================================================================
   PDF N-Up Tool — Place 2, 4, 6, or 8 pages on a single sheet
   Uses: pdf.js for rendering, pdf-lib for output composition
   ========================================================================== */

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const appState = {
  file: null,       // { name, size, arrayBuffer }
  layout: null,     // 2 | 4 | 6 | 8
  resultBlob: null,
  resultUrl: null
};

document.addEventListener('DOMContentLoaded', () => {
  initNUpTool();
});

function initNUpTool() {
  const dropZone = document.getElementById('nup-drop-zone');
  const fileInput = document.getElementById('nup-file-input');
  const layoutPanel = document.getElementById('nup-layout-panel');
  const progressOverlay = document.getElementById('nup-progress');
  const progressBar = document.getElementById('nup-progress-bar');
  const progressText = document.getElementById('nup-progress-text');
  const progressPercent = document.getElementById('nup-progress-percent');
  const successOverlay = document.getElementById('nup-success');
  const downloadBtn = document.getElementById('nup-download-btn');
  const resetBtn = document.getElementById('nup-reset-btn');
  const fileName = document.getElementById('nup-file-name');
  const fileSize = document.getElementById('nup-file-size');
  const changeFileBtn = document.getElementById('nup-change-file');
  const layoutCards = document.querySelectorAll('.nup-layout-card');

  // Drag and Drop
  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });
  ['dragleave'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.remove('dragover');
    handleFile(e.dataTransfer.files);
  });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files);
    fileInput.value = '';
  });

  // Change file button
  changeFileBtn.addEventListener('click', () => {
    appState.file = null;
    appState.layout = null;
    cleanupResult();
    layoutPanel.style.display = 'none';
    successOverlay.style.display = 'none';
    progressOverlay.style.display = 'none';
    dropZone.style.display = 'flex';
    layoutCards.forEach(c => c.classList.remove('selected'));
  });

  // Layout card selections
  layoutCards.forEach(card => {
    card.addEventListener('click', async () => {
      const n = parseInt(card.dataset.nup, 10);
      if (!appState.file) return;
      
      // Visual selection
      layoutCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      appState.layout = n;
      
      // Start conversion
      await runConversion(n);
    });
  });

  // Download
  downloadBtn.addEventListener('click', () => {
    if (appState.resultUrl) {
      const baseName = appState.file.name.replace(/\.pdf$/i, '');
      triggerDownload(appState.resultUrl, `${baseName}_${appState.layout}-up.pdf`);
    }
  });

  // Reset
  resetBtn.addEventListener('click', () => {
    appState.file = null;
    appState.layout = null;
    cleanupResult();
    successOverlay.style.display = 'none';
    progressOverlay.style.display = 'none';
    layoutPanel.style.display = 'none';
    dropZone.style.display = 'flex';
    layoutCards.forEach(c => c.classList.remove('selected'));
  });

  function handleFile(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please select a PDF file.', 'warning');
      return;
    }
    if (file.size === 0) {
      showToast('File is empty.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      appState.file = { name: file.name, size: file.size, arrayBuffer: reader.result };
      fileName.textContent = file.name;
      fileSize.textContent = formatBytes(file.size);
      dropZone.style.display = 'none';
      successOverlay.style.display = 'none';
      layoutPanel.style.display = 'flex';
      layoutCards.forEach(c => c.classList.remove('selected'));
      showToast(`Loaded "${file.name}". Now select your layout.`, 'success');
    };
    reader.onerror = () => showToast('Failed to read file.', 'danger');
    reader.readAsArrayBuffer(file);
  }

  async function runConversion(pagesPerSheet) {
    layoutPanel.style.display = 'none';
    progressOverlay.style.display = 'flex';
    setProgress(0, 'Reading PDF...');
    cleanupResult();

    try {
      const srcPdf = await pdfjsLib.getDocument({ data: appState.file.arrayBuffer.slice(0) }).promise;
      const totalPages = srcPdf.numPages;
      setProgress(10, `Rendering ${totalPages} pages...`);

      // Render every page to a canvas, then collect image data
      const pageImages = [];
      for (let p = 1; p <= totalPages; p++) {
        setProgress(10 + Math.round((p / totalPages) * 60), `Rendering page ${p} of ${totalPages}...`);
        const page = await srcPdf.getPage(p);
        const vp = page.getViewport({ scale: 2 }); // High quality render
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        // Convert to JPEG for smaller PDF
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const res = await fetch(dataUrl);
        const imgBytes = new Uint8Array(await res.arrayBuffer());
        pageImages.push({
          bytes: imgBytes,
          width: vp.width,
          height: vp.height
        });
      }

      setProgress(75, 'Composing N-Up layout...');

      // Build the output PDF with pdf-lib
      const outPdf = await PDFLib.PDFDocument.create();

      // N-Up grid configuration
      const layout = getNUpLayout(pagesPerSheet);
      const outputWidth = 595.28;  // A4 portrait width (pt)
      const outputHeight = 841.89; // A4 portrait height (pt)

      const margin = 12;
      const gap = 8;
      const cols = layout.cols;
      const rows = layout.rows;

      const cellW = (outputWidth - margin * 2 - gap * (cols - 1)) / cols;
      const cellH = (outputHeight - margin * 2 - gap * (rows - 1)) / rows;

      const totalSheets = Math.ceil(totalPages / pagesPerSheet);

      for (let s = 0; s < totalSheets; s++) {
        setProgress(75 + Math.round((s / totalSheets) * 20), `Building sheet ${s + 1} of ${totalSheets}...`);
        const page = outPdf.addPage([outputWidth, outputHeight]);

        // Light gray sheet background
        page.drawRectangle({
          x: 0, y: 0,
          width: outputWidth, height: outputHeight,
          color: PDFLib.rgb(1, 1, 1)
        });

        for (let slot = 0; slot < pagesPerSheet; slot++) {
          const pageIdx = s * pagesPerSheet + slot;
          if (pageIdx >= totalPages) break;

          const col = slot % cols;
          const row = Math.floor(slot / cols);

          const cellX = margin + col * (cellW + gap);
          const cellY = outputHeight - margin - (row + 1) * cellH - row * gap;

          // Draw cell border
          page.drawRectangle({
            x: cellX, y: cellY,
            width: cellW, height: cellH,
            borderColor: PDFLib.rgb(0.85, 0.85, 0.85),
            borderWidth: 0.5,
            color: PDFLib.rgb(1, 1, 1)
          });

          try {
            const img = pageImages[pageIdx];
            const embeddedImg = await outPdf.embedJpg(img.bytes);

            // Fit image inside cell, maintaining aspect ratio
            const innerPad = 3;
            const availW = cellW - innerPad * 2;
            const availH = cellH - innerPad * 2;
            const scale = Math.min(availW / img.width, availH / img.height);
            const drawW = img.width * scale;
            const drawH = img.height * scale;
            const drawX = cellX + innerPad + (availW - drawW) / 2;
            const drawY = cellY + innerPad + (availH - drawH) / 2;

            page.drawImage(embeddedImg, {
              x: drawX, y: drawY,
              width: drawW, height: drawH
            });
          } catch (imgErr) {
            console.warn(`Failed to embed page ${pageIdx + 1}:`, imgErr);
          }
        }
      }

      setProgress(97, 'Saving PDF...');
      const pdfBytes = await outPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      appState.resultBlob = blob;
      appState.resultUrl = URL.createObjectURL(blob);

      setProgress(100, 'Done!');
      await sleep(300);

      // Show success
      progressOverlay.style.display = 'none';
      successOverlay.style.display = 'flex';

      document.getElementById('nup-download-name').textContent =
        appState.file.name.replace(/\.pdf$/i, '') + `_${pagesPerSheet}-up.pdf`;
      document.getElementById('nup-download-size').textContent = formatBytes(blob.size);
      document.getElementById('nup-result-pages').textContent = totalSheets;
      document.getElementById('nup-result-layout').textContent = `${pagesPerSheet} pages/sheet (${layout.cols}×${layout.rows})`;

      showToast(`PDF created with ${pagesPerSheet} pages per sheet!`, 'success');
    } catch (err) {
      console.error('N-Up conversion error:', err);
      showToast('Conversion failed: ' + err.message, 'danger');
      progressOverlay.style.display = 'none';
      layoutPanel.style.display = 'flex';
    }
  }

  function getNUpLayout(n) {
    switch (n) {
      case 2: return { cols: 1, rows: 2 };
      case 4: return { cols: 2, rows: 2 };
      case 6: return { cols: 2, rows: 3 };
      case 8: return { cols: 2, rows: 4 };
      default: return { cols: 2, rows: 2 };
    }
  }

  function setProgress(pct, text) {
    progressBar.style.width = `${pct}%`;
    progressPercent.textContent = `${pct}%`;
    progressText.textContent = text;
  }

  function cleanupResult() {
    if (appState.resultUrl) {
      URL.revokeObjectURL(appState.resultUrl);
      appState.resultUrl = null;
      appState.resultBlob = null;
    }
  }
}

// ==========================================================================
// CORE HELPERS
// ==========================================================================
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function triggerDownload(blobUrl, filename) {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
