const appState = {
  img2pdf: {
    files: [], // Array of: { id, file, order, name, size, thumbUrl }
    sortable: null,
    compiledBlob: null,
    compiledBlobUrl: null
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initImageToPDFTool();
});

function initImageToPDFTool() {
  const dropZone = document.getElementById('img2pdf-drop-zone');
  const fileInput = document.getElementById('img2pdf-file-input');
  const workspace = document.getElementById('img2pdf-workspace');
  const galleryEl = document.getElementById('img2pdf-gallery');
  const clearBtn = document.getElementById('img2pdf-clear-btn');
  const executeBtn = document.getElementById('img2pdf-execute-btn');
  
  const pageSizeSelect = document.getElementById('img2pdf-page-size');
  const orientationSelect = document.getElementById('img2pdf-orientation');
  const orientationGroup = document.getElementById('img2pdf-orientation-group');
  const marginSelect = document.getElementById('img2pdf-margin');
  const qualitySelect = document.getElementById('img2pdf-quality');
  const outputFilenameInput = document.getElementById('img2pdf-output-filename');
  
  // Progress overlay
  const progressOverlay = document.getElementById('img2pdf-progress');
  const progressBar = document.getElementById('img2pdf-progress-bar');
  const progressText = document.getElementById('img2pdf-progress-text');
  const progressPercent = document.getElementById('img2pdf-progress-percent');
  
  // Success overlay
  const successOverlay = document.getElementById('img2pdf-success');
  const successDownloadBtn = document.getElementById('img2pdf-download-btn');
  const successResetBtn = document.getElementById('img2pdf-reset-btn');

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
    handleImgFiles(e.dataTransfer.files);
  });
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', (e) => {
    handleImgFiles(e.target.files);
    fileInput.value = '';
  });

  // Action listeners
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear uploaded images?')) {
      clearImgWorkspace();
    }
  });

  executeBtn.addEventListener('click', () => {
    runImageToPDFProcess();
  });

  successDownloadBtn.addEventListener('click', () => {
    let fn = outputFilenameInput.value.trim() || 'compiled-images';
    if (!fn.toLowerCase().endsWith('.pdf')) fn += '.pdf';
    triggerDownload(appState.img2pdf.compiledBlobUrl, fn);
  });

  successResetBtn.addEventListener('click', () => {
    successOverlay.style.display = 'none';
    workspace.style.display = 'flex';
    clearImgBlob();
    renderImgWorkspace();
  });

  pageSizeSelect.addEventListener('change', () => {
    if (pageSizeSelect.value === 'FIT') {
      orientationGroup.style.display = 'none';
    } else {
      orientationGroup.style.display = 'flex';
    }
  });

  async function handleImgFiles(files) {
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        if (file.size === 0) continue;
        
        // Local preview thumbnail Url
        const thumbUrl = URL.createObjectURL(file);
        
        appState.img2pdf.files.push({
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file: file,
          order: appState.img2pdf.files.length + 1,
          name: file.name,
          size: file.size,
          thumbUrl: thumbUrl
        });
        added++;
      }
    }
    if (added > 0) {
      showToast(`Added ${added} image(s)`, 'success');
      renderImgWorkspace();
    } else {
      showToast('Please select valid image files.', 'warning');
    }
  }

  function renderImgWorkspace() {
    if (appState.img2pdf.files.length === 0) {
      workspace.style.display = 'none';
      dropZone.style.display = 'flex';
      return;
    }
    workspace.style.display = 'flex';
    dropZone.style.display = 'none';
    
    galleryEl.innerHTML = '';
    appState.img2pdf.files.sort((a, b) => a.order - b.order);

    appState.img2pdf.files.forEach((item, index) => {
      item.order = index + 1;
      
      const li = document.createElement('li');
      li.className = 'gallery-item';
      li.setAttribute('data-id', item.id);
      li.innerHTML = `
        <div class="gallery-thumb-container">
          <img src="${item.thumbUrl}" alt="Thumbnail">
          <div class="gallery-badge">${item.order}</div>
          <div class="gallery-item-actions">
            <button type="button" class="btn-gallery-action btn-gallery-danger" title="Remove" onclick="window.removeImgItem('${item.id}')"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        <span class="gallery-filename" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        <span class="gallery-size">${formatBytes(item.size)}</span>
      `;
      galleryEl.appendChild(li);
    });

    initSortableGallery();
    updateImgStats();
  }

  function initSortableGallery() {
    if (appState.img2pdf.sortable) {
      appState.img2pdf.sortable.destroy();
    }
    appState.img2pdf.sortable = Sortable.create(galleryEl, {
      animation: 150,
      ghostClass: 'gallery-ghost',
      onEnd: () => {
        const items = galleryEl.querySelectorAll('.gallery-item');
        items.forEach((li, idx) => {
          const id = li.getAttribute('data-id');
          const fileObj = appState.img2pdf.files.find(f => f.id === id);
          if (fileObj) fileObj.order = idx + 1;
        });
        renderImgWorkspace();
      }
    });
  }

  window.removeImgItem = function(id) {
    const item = appState.img2pdf.files.find(f => f.id === id);
    if (item && item.thumbUrl) {
      URL.revokeObjectURL(item.thumbUrl);
    }
    appState.img2pdf.files = appState.img2pdf.files.filter(f => f.id !== id);
    renderImgWorkspace();
  };

  function updateImgStats() {
    const count = appState.img2pdf.files.length;
    const size = appState.img2pdf.files.reduce((sum, f) => sum + f.size, 0);
    document.getElementById('img2pdf-stats-count').textContent = count;
    document.getElementById('img2pdf-stats-size').textContent = formatBytes(size);
    executeBtn.disabled = count === 0;
  }

  async function runImageToPDFProcess() {
    workspace.style.display = 'none';
    progressOverlay.style.display = 'flex';
    setImgProgress(0, 'Initializing PDF compiler...');
    await sleep(250);

    const pdfDoc = await PDFLib.PDFDocument.create();
    const compressionRatio = parseFloat(qualitySelect.value);

    try {
      for (let i = 0; i < appState.img2pdf.files.length; i++) {
        const item = appState.img2pdf.files[i];
        setImgProgress(
          Math.round((i / appState.img2pdf.files.length) * 90),
          `Encoding image ${i + 1} of ${appState.img2pdf.files.length}: ${escapeHtml(item.name)}`
        );

        // Convert file to scaled image blob
        let targetBlob = item.file;
        if (compressionRatio < 1.0) {
          targetBlob = await compressImgToBlob(item.file, compressionRatio);
        }

        const imgArrayBuffer = await readFileAsArrayBuffer(targetBlob);
        let pdfImage;
        const fileType = item.file.type.toLowerCase();
        
        if (fileType === 'image/png') {
          pdfImage = await pdfDoc.embedPng(imgArrayBuffer);
        } else if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
          pdfImage = await pdfDoc.embedJpg(imgArrayBuffer);
        } else {
          // Fallback convert to canvas jpeg
          const fallbackJpgBlob = await convertToJpgFallback(item.file);
          const fallbackBytes = await readFileAsArrayBuffer(fallbackJpgBlob);
          pdfImage = await pdfDoc.embedJpg(fallbackBytes);
        }

        const imgWidth = pdfImage.width;
        const imgHeight = pdfImage.height;

        let pageWidth, pageHeight;
        const pageSizeMode = pageSizeSelect.value;
        const isLandscape = orientationSelect.value === 'LANDSCAPE';

        if (pageSizeMode === 'FIT') {
          pageWidth = imgWidth;
          pageHeight = imgHeight;
        } else if (pageSizeMode === 'LETTER') {
          pageWidth = isLandscape ? 792 : 612;
          pageHeight = isLandscape ? 612 : 792;
        } else if (pageSizeMode === 'LEGAL') {
          pageWidth = isLandscape ? 1008 : 612;
          pageHeight = isLandscape ? 612 : 1008;
        } else { // A4
          pageWidth = isLandscape ? 842 : 595;
          pageHeight = isLandscape ? 595 : 842;
        }

        let marginValue = 0;
        const marginSelection = marginSelect.value;
        if (marginSelection === 'SMALL') marginValue = 15;
        if (marginSelection === 'LARGE') marginValue = 35;

        const printableWidth = pageWidth - (marginValue * 2);
        const printableHeight = pageHeight - (marginValue * 2);

        // Scale image proportionally to fit inside margins
        const widthRatio = printableWidth / imgWidth;
        const heightRatio = printableHeight / imgHeight;
        const scale = Math.min(widthRatio, heightRatio, 1.0); // Don't scale up smaller images

        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;

        // Centering
        const xOffset = marginValue + (printableWidth - drawWidth) / 2;
        const yOffset = marginValue + (printableHeight - drawHeight) / 2;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(pdfImage, {
          x: xOffset,
          y: yOffset,
          width: drawWidth,
          height: drawHeight
        });

        await sleep(100);
      }
      
      const pdfBytes = await pdfDoc.save();
      appState.img2pdf.compiledBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      appState.img2pdf.compiledBlobUrl = URL.createObjectURL(appState.img2pdf.compiledBlob);

      setImgProgress(100, 'Finished!');
      await sleep(200);

      // Transition to success screen
      progressOverlay.style.display = 'none';
      successOverlay.style.display = 'flex';

      let fn = outputFilenameInput.value.trim() || 'compiled-images';
      if (!fn.toLowerCase().endsWith('.pdf')) fn += '.pdf';
      document.getElementById('img2pdf-download-name').textContent = fn;
      document.getElementById('img2pdf-download-pages').textContent = appState.img2pdf.files.length;
      document.getElementById('img2pdf-download-size').textContent = formatBytes(appState.img2pdf.compiledBlob.size);
      
      showToast('Image to PDF compilation complete!', 'success');
    } catch (error) {
      console.error(error);
      showToast('Error converting images: ' + error.message, 'danger');
      progressOverlay.style.display = 'none';
      workspace.style.display = 'flex';
    }
  }

  function setImgProgress(percentage, statusText) {
    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}%`;
    progressText.textContent = statusText;
  }

  function clearImgBlob() {
    if (appState.img2pdf.compiledBlobUrl) {
      URL.revokeObjectURL(appState.img2pdf.compiledBlobUrl);
      appState.img2pdf.compiledBlobUrl = null;
      appState.img2pdf.compiledBlob = null;
    }
  }

  function clearImgWorkspace() {
    appState.img2pdf.files.forEach(f => {
      if (f.thumbUrl) URL.revokeObjectURL(f.thumbUrl);
    });
    appState.img2pdf.files = [];
    clearImgBlob();
    renderImgWorkspace();
  }

  // Quality scaling canvas compression helper
  function compressImgToBlob(imageFile, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(imageFile);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          resolve(blob || imageFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(imageFile);
      };
      img.src = url;
    });
  }

  function convertToJpgFallback(imageFile) {
    return compressImgToBlob(imageFile, 0.9);
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
