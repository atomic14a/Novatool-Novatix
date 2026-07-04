// Configure PDF.js Worker path to resolve initialization and parsing errors
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const appState = {
  pdf2img: {
    files: [], // Array of: { id, file, name, size }
    convertedImages: [], // Array of: { name, originalSize, imageBlob, url }
    zipBlob: null,
    zipBlobUrl: null
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initPDFToImageTool();
});

function initPDFToImageTool() {
  const dropZone = document.getElementById('pdf2img-drop-zone');
  const fileInput = document.getElementById('pdf2img-file-input');
  const workspace = document.getElementById('pdf2img-workspace');
  const fileListEl = document.getElementById('pdf2img-file-list');
  const clearBtn = document.getElementById('pdf2img-clear-btn');
  const executeBtn = document.getElementById('pdf2img-execute-btn');
  
  // Selection
  const formatSelect = document.getElementById('pdf2img-format');
  const dpiSelect = document.getElementById('pdf2img-dpi');
  const qualitySelect = document.getElementById('pdf2img-quality');
  const maxSizeSelect = document.getElementById('pdf2img-max-size');
  const customSizeContainer = document.getElementById('pdf2img-custom-size-container');
  
  // Progress
  const progressOverlay = document.getElementById('pdf2img-progress');
  const progressBar = document.getElementById('pdf2img-progress-bar');
  const progressText = document.getElementById('pdf2img-progress-text');
  const progressPercent = document.getElementById('pdf2img-progress-percent');
  
  // Success
  const successOverlay = document.getElementById('pdf2img-success');
  const galleryEl = document.getElementById('pdf2img-gallery');
  const successDownloadBtn = document.getElementById('pdf2img-download-btn');
  const successResetBtn = document.getElementById('pdf2img-reset-btn');

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
    handlePdf2ImgFiles(e.dataTransfer.files);
  });
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', (e) => {
    handlePdf2ImgFiles(e.target.files);
    fileInput.value = '';
  });

  maxSizeSelect.addEventListener('change', () => {
    customSizeContainer.style.display = maxSizeSelect.value === 'CUSTOM' ? 'flex' : 'none';
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('Clear uploaded PDFs?')) {
      clearPdf2ImgWorkspace();
    }
  });

  executeBtn.addEventListener('click', () => {
    runPDFToImageProcess();
  });

  successDownloadBtn.addEventListener('click', () => {
    if (appState.pdf2img.zipBlobUrl) {
      triggerDownload(appState.pdf2img.zipBlobUrl, 'pdf-extracted-images.zip');
    } else if (appState.pdf2img.convertedImages[0]?.url) {
      triggerDownload(appState.pdf2img.convertedImages[0].url, appState.pdf2img.convertedImages[0].name);
    }
  });

  successResetBtn.addEventListener('click', () => {
    successOverlay.style.display = 'none';
    workspace.style.display = 'flex';
    clearPdf2ImgBlob();
    renderPdf2ImgWorkspace();
  });

  function handlePdf2ImgFiles(files) {
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        if (file.size === 0) continue;
        appState.pdf2img.files.push({
          id: `pdf2img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file: file,
          name: file.name,
          size: file.size
        });
        added++;
      }
    }
    if (added > 0) {
      showToast(`Added ${added} PDF(s)`, 'success');
      renderPdf2ImgWorkspace();
    } else {
      showToast('Please select valid PDF documents.', 'warning');
    }
  }

  function renderPdf2ImgWorkspace() {
    if (appState.pdf2img.files.length === 0) {
      workspace.style.display = 'none';
      dropZone.style.display = 'flex';
      return;
    }
    workspace.style.display = 'flex';
    dropZone.style.display = 'none';
    fileListEl.innerHTML = '';

    appState.pdf2img.files.forEach(item => {
      const li = document.createElement('li');
      li.className = 'file-item list-no-hover';
      li.innerHTML = `
        <div class="pdf-icon-badge"><i class="ti ti-file-type-pdf"></i></div>
        <div class="file-info">
          <span class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="file-size">${formatBytes(item.size)}</span>
        </div>
        <div class="file-actions">
          <button type="button" class="btn-icon btn-icon-danger" onclick="window.removePdf2ImgItem('${item.id}')"><i class="ti ti-trash"></i></button>
        </div>
      `;
      fileListEl.appendChild(li);
    });

    executeBtn.disabled = appState.pdf2img.files.length === 0;
    updatePdf2ImgStats();
  }

  window.removePdf2ImgItem = function(id) {
    appState.pdf2img.files = appState.pdf2img.files.filter(f => f.id !== id);
    renderPdf2ImgWorkspace();
  };

  function updatePdf2ImgStats() {
    const count = appState.pdf2img.files.length;
    const size = appState.pdf2img.files.reduce((sum, f) => sum + f.size, 0);
    document.getElementById('pdf2img-stats-count').textContent = count;
    document.getElementById('pdf2img-stats-size').textContent = formatBytes(size);
  }

  async function runPDFToImageProcess() {
    workspace.style.display = 'none';
    progressOverlay.style.display = 'flex';
    setPdf2ImgProgress(0, 'Initializing PDF rasterizer...');
    await sleep(250);

    appState.pdf2img.convertedImages = [];
    galleryEl.innerHTML = '';

    try {
      const targetFormat = formatSelect.value;
      const dpiScale = parseInt(dpiSelect.value, 10) / 72; // scale factor
      const quality = parseFloat(qualitySelect.value);
      const sizeMode = maxSizeSelect.value;
      
      let customWidthVal = 0;
      if (sizeMode === 'CUSTOM') {
        customWidthVal = parseInt(document.getElementById('pdf2img-custom-w').value, 10) || 1280;
      }

      for (let fIdx = 0; fIdx < appState.pdf2img.files.length; fIdx++) {
        const item = appState.pdf2img.files[fIdx];
        setPdf2ImgProgress(
          5 + Math.round((fIdx / appState.pdf2img.files.length) * 80),
          `Loading document ${fIdx + 1} of ${appState.pdf2img.files.length}...`
        );

        const arrayBuffer = await readFileAsArrayBuffer(item.file);
        
        // Use PDFJS to load document
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        for (let pIdx = 1; pIdx <= totalPages; pIdx++) {
          const stepBase = 5 + Math.round((fIdx / appState.pdf2img.files.length) * 80);
          const stepWeight = Math.round(80 / appState.pdf2img.files.length);
          const pageProgress = stepBase + Math.round((pIdx / totalPages) * stepWeight);
          
          setPdf2ImgProgress(
            pageProgress,
            `File ${fIdx + 1}/${appState.pdf2img.files.length}: Rendering Page ${pIdx}/${totalPages}...`
          );

          const page = await pdf.getPage(pIdx);
          const viewport = page.getViewport({ scale: dpiScale });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          let scale = 1.0;
          if (sizeMode === '1080' && viewport.width > 1080) {
            scale = 1080 / viewport.width;
          } else if (sizeMode === '2160' && viewport.width > 2160) {
            scale = 2160 / viewport.width;
          } else if (sizeMode === 'CUSTOM') {
            scale = customWidthVal / viewport.width;
          }

          if (scale !== 1.0) {
            const scaledViewport = page.getViewport({ scale: dpiScale * scale });
            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;
            await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
          } else {
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
          }

          // Convert canvas to image blob
          let mimeType = 'image/png';
          let extension = '.png';
          if (targetFormat === 'JPEG') {
            mimeType = 'image/jpeg';
            extension = '.jpg';
          } else if (targetFormat === 'WEBP') {
            mimeType = 'image/webp';
            extension = '.webp';
          }

          const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, quality));
          const url = URL.createObjectURL(blob);

          // Name matching: original file name + page index + ext
          const origName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
          const imgName = `${origName}_page_${pIdx}${extension}`;

          appState.pdf2img.convertedImages.push({
            name: imgName,
            originalSize: item.size,
            imageBlob: blob,
            url: url
          });

          // Add to success gallery
          const thumb = document.createElement('div');
          thumb.className = 'gallery-preview-item';
          thumb.innerHTML = `
            <div class="preview-img-box">
              <img src="${url}" alt="${imgName}">
              <div class="img-badge">${appState.pdf2img.convertedImages.length}</div>
              <button class="btn-gallery-action btn-gallery-success" onclick="window.downloadSingleExtracted('${appState.pdf2img.convertedImages.length - 1}')"><i class="ti ti-download"></i></button>
            </div>
            <span class="preview-name" title="${imgName}">${imgName}</span>
            <span class="preview-size">${formatBytes(blob.size)}</span>
          `;
          galleryEl.appendChild(thumb);
          
          await sleep(50);
        }
      }

      setPdf2ImgProgress(90, 'Preparing downloadable package...');
      await sleep(200);

      // Create ZIP bundle
      const zip = new JSZip();
      appState.pdf2img.convertedImages.forEach(img => {
        zip.file(img.name, img.imageBlob);
      });

      appState.pdf2img.zipBlob = await zip.generateAsync({ type: 'blob' });
      appState.pdf2img.zipBlobUrl = URL.createObjectURL(appState.pdf2img.zipBlob);

      setPdf2ImgProgress(100, 'Rasterization complete!');
      await sleep(200);

      progressOverlay.style.display = 'none';
      successOverlay.style.display = 'flex';

      if (appState.pdf2img.convertedImages.length === 1) {
        successDownloadBtn.innerHTML = `<i class="ti ti-download"></i> Download Image`;
      } else {
        successDownloadBtn.innerHTML = `<i class="ti ti-file-zip"></i> Download All Images (${formatBytes(appState.pdf2img.zipBlob.size)})`;
      }

      showToast('PDF pages converted to images successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Rasterization failed: ' + err.message, 'danger');
      progressOverlay.style.display = 'none';
      workspace.style.display = 'flex';
    }
  }

  window.downloadSingleExtracted = function(idx) {
    const target = appState.pdf2img.convertedImages[parseInt(idx, 10)];
    if (target) {
      triggerDownload(target.url, target.name);
    }
  };

  function setPdf2ImgProgress(percentage, statusText) {
    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}%`;
    progressText.textContent = statusText;
  }

  function clearPdf2ImgBlob() {
    appState.pdf2img.convertedImages.forEach(img => {
      if (img.url) URL.revokeObjectURL(img.url);
    });
    appState.pdf2img.convertedImages = [];

    if (appState.pdf2img.zipBlobUrl) {
      URL.revokeObjectURL(appState.pdf2img.zipBlobUrl);
      appState.pdf2img.zipBlobUrl = null;
      appState.pdf2img.zipBlob = null;
    }
  }

  function clearPdf2ImgWorkspace() {
    appState.pdf2img.files = [];
    clearPdf2ImgBlob();
    renderPdf2ImgWorkspace();
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
