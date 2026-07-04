// Configure PDF.js Worker path to resolve initialization and parsing errors
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const appState = {
  compress: {
    files: [], // Array of: { id, file, name, size, type }
    convertedFiles: [], // Array of: { name, originalSize, compressedSize, compressedBlob, url }
    zipBlob: null,
    zipBlobUrl: null,
    mode: 'PERCENT' // 'SIZE' or 'PERCENT'
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initCompressTool();
});

function initCompressTool() {
  const dropZone = document.getElementById('compress-drop-zone');
  const fileInput = document.getElementById('compress-file-input');
  const workspace = document.getElementById('compress-workspace');
  const fileListEl = document.getElementById('compress-file-list');
  const clearBtn = document.getElementById('compress-clear-btn');
  const executeBtn = document.getElementById('compress-execute-btn');
  
  // Selection
  const modeSelect = document.getElementById('compress-mode');
  const sliderContainer = document.getElementById('compress-slider-container');
  const sizeContainer = document.getElementById('compress-size-container');
  const customSizeContainer = document.getElementById('compress-custom-size-container');
  const percentSlider = document.getElementById('compress-percent-slider');
  const sliderLabel = document.getElementById('compress-slider-val');
  const pdfModeSelect = document.getElementById('compress-pdf-mode');
  
  // Progress elements
  const progressOverlay = document.getElementById('compress-progress');
  const progressBar = document.getElementById('compress-progress-bar');
  const progressText = document.getElementById('compress-progress-text');
  const progressPercent = document.getElementById('compress-progress-percent');
  
  // Success elements
  const successOverlay = document.getElementById('compress-success');
  const successResultList = document.getElementById('compress-result-list');
  const successDownloadBtn = document.getElementById('compress-download-btn');
  const successResetBtn = document.getElementById('compress-reset-btn');

  // Drag and Drop
  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });
  ['dragleave'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
    handleCompressFiles(e.dataTransfer.files);
  });
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', (e) => {
    handleCompressFiles(e.target.files);
    fileInput.value = '';
  });

  // Event Listeners
  modeSelect.addEventListener('change', () => {
    const isSize = modeSelect.value === 'SIZE';
    appState.compress.mode = modeSelect.value;
    sliderContainer.style.display = isSize ? 'none' : 'flex';
    sizeContainer.style.display = isSize ? 'flex' : 'none';
    
    // Toggle custom target size uploader
    const limitSelect = document.getElementById('compress-size-limit');
    customSizeContainer.style.display = (isSize && limitSelect.value === 'CUSTOM') ? 'flex' : 'none';
  });

  document.getElementById('compress-size-limit').addEventListener('change', (e) => {
    customSizeContainer.style.display = e.target.value === 'CUSTOM' ? 'flex' : 'none';
  });

  percentSlider.addEventListener('input', () => {
    sliderLabel.textContent = `${percentSlider.value}%`;
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('Clear uploaded files?')) {
      clearCompressWorkspace();
    }
  });

  executeBtn.addEventListener('click', () => {
    runCompressProcess();
  });

  successDownloadBtn.addEventListener('click', () => {
    if (appState.compress.zipBlobUrl) {
      triggerDownload(appState.compress.zipBlobUrl, 'compressed-files.zip');
    } else if (appState.compress.convertedFiles[0]?.url) {
      triggerDownload(appState.compress.convertedFiles[0].url, appState.compress.convertedFiles[0].name);
    }
  });

  successResetBtn.addEventListener('click', () => {
    successOverlay.style.display = 'none';
    workspace.style.display = 'flex';
    clearCompressBlob();
    renderCompressWorkspace();
  });

  function handleCompressFiles(files) {
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name.toLowerCase();
      let type = '';

      if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp)$/.test(name)) {
        type = 'IMAGE';
      } else if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
        type = 'PDF';
      } else if (name.endsWith('.docx')) {
        type = 'DOCX';
      }

      if (type !== '') {
        if (file.size === 0) continue;
        appState.compress.files.push({
          id: `compress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file: file,
          name: file.name,
          size: file.size,
          type: type
        });
        added++;
      }
    }
    if (added > 0) {
      showToast(`Added ${added} file(s) for compression`, 'success');
      renderCompressWorkspace();
    } else {
      showToast('Please select valid images, PDFs, or DOCX documents.', 'warning');
    }
  }

  function renderCompressWorkspace() {
    if (appState.compress.files.length === 0) {
      workspace.style.display = 'none';
      dropZone.style.display = 'flex';
      return;
    }
    workspace.style.display = 'flex';
    dropZone.style.display = 'none';
    fileListEl.innerHTML = '';

    appState.compress.files.forEach(item => {
      let icon = 'ti-file';
      let colorClass = '';
      if (item.type === 'IMAGE') { icon = 'ti-photo'; colorClass = 'img-to-pdf-color'; }
      if (item.type === 'PDF') { icon = 'ti-file-type-pdf'; colorClass = 'pdf-color'; }
      if (item.type === 'DOCX') { icon = 'ti-file-type-docx'; colorClass = 'word-color'; }

      const li = document.createElement('li');
      li.className = 'file-item list-no-hover';
      li.innerHTML = `
        <div class="pdf-icon-badge ${colorClass}"><i class="ti ${icon}"></i></div>
        <div class="file-info">
          <span class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="file-size">${formatBytes(item.size)}</span>
        </div>
        <div class="file-actions">
          <button type="button" class="btn-icon btn-icon-danger" onclick="window.removeCompressItem('${item.id}')"><i class="ti ti-trash"></i></button>
        </div>
      `;
      fileListEl.appendChild(li);
    });

    executeBtn.disabled = appState.compress.files.length === 0;
    updateCompressStats();
  }

  window.removeCompressItem = function(id) {
    appState.compress.files = appState.compress.files.filter(f => f.id !== id);
    renderCompressWorkspace();
  };

  function updateCompressStats() {
    const count = appState.compress.files.length;
    const size = appState.compress.files.reduce((sum, f) => sum + f.size, 0);
    document.getElementById('compress-stats-count').textContent = count;
    document.getElementById('compress-stats-size').textContent = formatBytes(size);
  }

  async function runCompressProcess() {
    workspace.style.display = 'none';
    progressOverlay.style.display = 'flex';
    setCompressProgress(0, 'Initializing compressor pipeline...');
    await sleep(200);

    appState.compress.convertedFiles = [];
    successResultList.innerHTML = '';

    try {
      const mode = appState.compress.mode;
      const pct = parseInt(percentSlider.value, 10);
      let targetRatio = (100 - pct) / 100; // e.g. 70% comp ratio means 30% file size quality target
      
      let targetSizeLimit = null;
      if (mode === 'SIZE') {
        const selVal = document.getElementById('compress-size-limit').value;
        if (selVal === 'CUSTOM') {
          targetSizeLimit = (parseInt(document.getElementById('compress-custom-size').value, 10) || 250) * 1024;
        } else {
          targetSizeLimit = parseInt(selVal, 10);
        }
      }

      for (let i = 0; i < appState.compress.files.length; i++) {
        const item = appState.compress.files[i];
        setCompressProgress(
          5 + Math.round((i / appState.compress.files.length) * 85),
          `Compressing file ${i + 1}/${appState.compress.files.length}: ${escapeHtml(item.name)}`
        );

        let outputBlob = null;
        let suffix = '_compressed';

        // Calculate specific targets for this file
        let fileRatio = targetRatio;
        let fileLimitSize = targetSizeLimit;

        if (mode === 'SIZE') {
          // If size limit is larger than current size, compression is minimal (ratio 0.9)
          if (item.size < fileLimitSize) {
            fileRatio = 0.9;
          } else {
            // Target ratio relative to file size
            fileRatio = Math.max(0.15, fileLimitSize / item.size);
          }
        }

        if (item.type === 'IMAGE') {
          outputBlob = await compressImageFile(item.file, fileRatio, fileLimitSize);
        } else if (item.type === 'PDF') {
          const pdfStrategy = pdfModeSelect.value;
          if (pdfStrategy === 'LOSSY') {
            outputBlob = await compressPdfLossy(item.file, fileRatio, (subPerc, msg) => {
              const stepBase = 5 + Math.round((i / appState.compress.files.length) * 85);
              const stepWeight = Math.round(85 / appState.compress.files.length);
              const totalSubPerc = stepBase + Math.round((subPerc / 100) * stepWeight);
              setCompressProgress(totalSubPerc, `File ${i + 1}/${appState.compress.files.length}: ${msg}`);
            });
          } else {
            outputBlob = await compressPdfLossless(item.file);
          }
        } else if (item.type === 'DOCX') {
          outputBlob = await compressDocxImages(item.file, fileRatio, (subPerc, msg) => {
            const stepBase = 5 + Math.round((i / appState.compress.files.length) * 85);
            const stepWeight = Math.round(85 / appState.compress.files.length);
            const totalSubPerc = stepBase + Math.round((subPerc / 100) * stepWeight);
            setCompressProgress(totalSubPerc, `File ${i + 1}/${appState.compress.files.length}: ${msg}`);
          });
        }

        if (outputBlob) {
          const url = URL.createObjectURL(outputBlob);
          const origName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
          const ext = item.name.substring(item.name.lastIndexOf('.')) || '';
          
          let outputName = `${origName}${suffix}${ext}`;
          
          appState.compress.convertedFiles.push({
            name: outputName,
            originalSize: item.size,
            compressedSize: outputBlob.size,
            compressedBlob: outputBlob,
            url: url
          });

          // Append success entry
          const savingBytes = item.size - outputBlob.size;
          const savingPct = savingBytes > 0 ? Math.round((savingBytes / item.size) * 100) : 0;
          
          const li = document.createElement('li');
          li.className = 'compress-result-item glass-panel';
          li.innerHTML = `
            <div class="result-filename" title="${escapeHtml(outputName)}">${escapeHtml(outputName)}</div>
            <div class="result-stats">
              <span class="old-sz">${formatBytes(item.size)}</span>
              <i class="ti ti-arrow-narrow-right"></i>
              <span class="new-sz">${formatBytes(outputBlob.size)}</span>
              <span class="saving-badge">${savingPct}% smaller</span>
            </div>
          `;
          successResultList.appendChild(li);
        }
        await sleep(150);
      }

      setCompressProgress(90, 'Packaging downloads...');
      await sleep(200);

      // Create ZIP bundle if multiple files
      if (appState.compress.convertedFiles.length > 1) {
        const zip = new JSZip();
        appState.compress.convertedFiles.forEach(f => {
          zip.file(f.name, f.compressedBlob);
        });
        setCompressProgress(95, 'Compiling ZIP package...');
        appState.compress.zipBlob = await zip.generateAsync({ type: 'blob' });
        appState.compress.zipBlobUrl = URL.createObjectURL(appState.compress.zipBlob);
      } else {
        appState.compress.zipBlob = null;
        appState.compress.zipBlobUrl = null;
      }

      setCompressProgress(100, 'Optimization complete!');
      await sleep(250);

      progressOverlay.style.display = 'none';
      successOverlay.style.display = 'flex';

      if (appState.compress.convertedFiles.length > 1) {
        successDownloadBtn.innerHTML = `<i class="ti ti-file-zip"></i> Download All (ZIP)`;
      } else {
        successDownloadBtn.innerHTML = `<i class="ti ti-download"></i> Download Optimized File`;
      }

      showToast('Optimization complete!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Compression failed: ' + err.message, 'danger');
      progressOverlay.style.display = 'none';
      workspace.style.display = 'flex';
    }
  }

  // IMAGE optimization helper
  async function compressImageFile(file, ratio, targetSize) {
    const originalBlob = file;
    let currentQuality = Math.max(0.15, Math.min(0.95, ratio));
    let scale = 1.0;
    let blob = await compressImageBlobWithScale(originalBlob, currentQuality, scale);
    
    if (targetSize) {
      let iterations = 0;
      while (blob.size > targetSize && iterations < 3) {
        scale *= 0.8;
        currentQuality = Math.max(0.3, currentQuality - 0.1);
        blob = await compressImageBlobWithScale(originalBlob, currentQuality, scale);
        iterations++;
      }
    }
    return blob;
  }

  function compressImageBlobWithScale(blob, quality, scale) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(50, Math.round(img.width * scale));
        canvas.height = Math.max(50, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((resultBlob) => {
          resolve(resultBlob || blob);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(blob);
      };
      img.src = url;
    });
  }

  // Lossless PDF Optimizer (strips attachments / metadata)
  async function compressPdfLossless(pdfFile) {
    const arrayBuffer = await readFileAsArrayBuffer(pdfFile);
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    
    // Losslessly strip document titles, metadata headers and fields
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setCreator('');
    pdfDoc.setProducer('');
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());

    const savedBytes = await pdfDoc.save({ useObjectStreams: false });
    return new Blob([savedBytes], { type: 'application/pdf' });
  }

  // Lossy PDF Optimizer (re-renders pages on canvas to JPG)
  async function compressPdfLossy(pdfFile, targetRatio, progressCallback) {
    const arrayBuffer = await readFileAsArrayBuffer(pdfFile);
    
    if (progressCallback) progressCallback(10, 'Parsing source PDF structure...');
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;

    const compiledPdf = await PDFLib.PDFDocument.create();
    // DPI settings scale down proportionally based on compression targets
    const dpi = Math.round(72 + (targetRatio * 150)); // 72 to 220 DPI range
    const scaleFactor = dpi / 72;
    const quality = Math.max(0.4, Math.min(0.9, targetRatio));

    for (let pIdx = 1; pIdx <= totalPages; pIdx++) {
      if (progressCallback) {
        progressCallback(10 + Math.round((pIdx / totalPages) * 75), `Optimizing page canvas ${pIdx}/${totalPages}...`);
      }

      const page = await pdf.getPage(pIdx);
      const viewport = page.getViewport({ scale: scaleFactor });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport: viewport }).promise;

      // Extract JPEG
      const pageJpgBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      const pageJpgBytes = await readFileAsArrayBuffer(pageJpgBlob);

      const embeddedImg = await compiledPdf.embedJpg(pageJpgBytes);
      const pdfPage = compiledPdf.addPage([viewport.width, viewport.height]);
      pdfPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height
      });
      await sleep(50);
    }

    if (progressCallback) progressCallback(95, 'Saving compressed PDF...');
    const savedBytes = await compiledPdf.save();
    return new Blob([savedBytes], { type: 'application/pdf' });
  }

  // Word DOCX compressed images within the ZIP archive
  async function compressDocxImages(docxFile, targetRatio, progressCallback) {
    const arrayBuffer = await readFileAsArrayBuffer(docxFile);
    
    if (progressCallback) progressCallback(15, 'Extracting DOCX package archive...');
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Find all files inside word/media/
    const imagePaths = Object.keys(zip.files).filter(path => /^word\/media\/.*\.(png|jpeg|jpg)$/i.test(path));

    if (imagePaths.length === 0) {
      if (progressCallback) progressCallback(90, 'No image attachments found. Cleaning metadata...');
      await sleep(200);
      const generatedBlob = await zip.generateAsync({ type: 'blob' });
      return generatedBlob;
    }

    const quality = Math.max(0.4, Math.min(0.85, targetRatio));

    for (let i = 0; i < imagePaths.length; i++) {
      const path = imagePaths[i];
      if (progressCallback) {
        progressCallback(15 + Math.round((i / imagePaths.length) * 70), `Scaling docx attachment ${i + 1}/${imagePaths.length}...`);
      }

      const imgBytes = await zip.file(path).async('blob');
      
      // Compress using canvas JPEG converter
      const compressedBlob = await compressImageFile(imgBytes, quality, null);
      const compressedArrayBuffer = await readFileAsArrayBuffer(compressedBlob);

      // Overwrite the file inside the zip with the compressed one
      zip.file(path, compressedArrayBuffer);
      await sleep(100);
    }

    if (progressCallback) progressCallback(95, 'Compiling DOCX package archive...');
    const docxBlob = await zip.generateAsync({ type: 'blob' });
    return docxBlob;
  }

  function setCompressProgress(percentage, statusText) {
    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}%`;
    progressText.textContent = statusText;
  }

  function clearCompressBlob() {
    appState.compress.convertedFiles.forEach(f => {
      if (f.url) URL.revokeObjectURL(f.url);
    });
    appState.compress.convertedFiles = [];

    if (appState.compress.zipBlobUrl) {
      URL.revokeObjectURL(appState.compress.zipBlobUrl);
      appState.compress.zipBlobUrl = null;
      appState.compress.zipBlob = null;
    }
  }

  function clearCompressWorkspace() {
    appState.compress.files = [];
    clearCompressBlob();
    renderCompressWorkspace();
  }
}

// ==========================================================================
// CORE HELPERS
// ==========================================================================
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = 2;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Escapes special HTML tags to prevent cross-site scripting/breakages
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function triggerDownload(blobUrl, filename) {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
