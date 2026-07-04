const appState = {
  merge: {
    files: [], // Array of: { id, file, order, name, size }
    sortable: null,
    mergedBlob: null,
    mergedBlobUrl: null
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initPDFMergeTool();
});

function initPDFMergeTool() {
  const dropZone = document.getElementById('merge-drop-zone');
  const fileInput = document.getElementById('merge-file-input');
  const workspace = document.getElementById('merge-workspace');
  const fileListEl = document.getElementById('merge-file-list');
  const clearBtn = document.getElementById('merge-clear-btn');
  const executeBtn = document.getElementById('merge-execute-btn');
  const outputFilenameInput = document.getElementById('merge-output-filename');
  const validationAlert = document.getElementById('merge-validation-alert');
  
  const progressOverlay = document.getElementById('merge-progress');
  const progressBar = document.getElementById('merge-progress-bar');
  const progressText = document.getElementById('merge-progress-text');
  const progressPercent = document.getElementById('merge-progress-percent');
  
  const successOverlay = document.getElementById('merge-success');
  const successDownloadBtn = document.getElementById('merge-download-btn');
  const successResetBtn = document.getElementById('merge-reset-btn');

  // Drag and Drop listeners
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
    handleMergeFiles(e.dataTransfer.files);
  });
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', (e) => {
    handleMergeFiles(e.target.files);
    fileInput.value = '';
  });

  // Actions
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all uploaded files from the Merge list?')) {
      clearMergeWorkspace();
    }
  });

  executeBtn.addEventListener('click', () => {
    runPDFMergeProcess();
  });

  successDownloadBtn.addEventListener('click', () => {
    let fn = outputFilenameInput.value.trim() || 'merged-document';
    if (!fn.toLowerCase().endsWith('.pdf')) fn += '.pdf';
    triggerDownload(appState.merge.mergedBlobUrl, fn);
  });

  successResetBtn.addEventListener('click', () => {
    successOverlay.style.display = 'none';
    workspace.style.display = 'flex';
    clearMergeBlob();
    renderMergeWorkspace();
  });

  outputFilenameInput.addEventListener('input', () => {
    validateMergeState();
  });

  function handleMergeFiles(files) {
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        if (file.size === 0) continue;
        appState.merge.files.push({
          id: `merge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file: file,
          order: appState.merge.files.length + 1,
          name: file.name,
          size: file.size
        });
        added++;
      }
    }
    if (added > 0) {
      showToast(`Added ${added} PDF file(s) to the merge list`, 'success');
      renderMergeWorkspace();
    }
  }

  function renderMergeWorkspace() {
    if (appState.merge.files.length === 0) {
      workspace.style.display = 'none';
      dropZone.style.display = 'flex';
      return;
    }
    workspace.style.display = 'flex';
    dropZone.style.display = 'none';
    
    fileListEl.innerHTML = '';
    
    // Sort files by their order attribute
    appState.merge.files.sort((a, b) => a.order - b.order);

    appState.merge.files.forEach((item, index) => {
      // Re-assign order numbers sequentially
      item.order = index + 1;
      
      const li = document.createElement('li');
      li.className = 'file-item';
      li.setAttribute('data-id', item.id);
      li.innerHTML = `
        <div class="drag-handle"><i class="ti ti-grid-dots"></i></div>
        <div class="pdf-icon-badge"><i class="ti ti-file-type-pdf"></i></div>
        <div class="file-info">
          <span class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="file-size">${formatBytes(item.size)}</span>
        </div>
        <div class="file-order">
          <input type="number" class="order-input" value="${item.order}" min="1" max="${appState.merge.files.length}" onchange="window.updateMergeItemOrder('${item.id}', this.value)">
        </div>
        <div class="file-actions">
          <button type="button" class="btn-icon" title="Move Up" onclick="window.moveMergeItem('${item.id}', -1)"><i class="ti ti-chevron-up"></i></button>
          <button type="button" class="btn-icon" title="Move Down" onclick="window.moveMergeItem('${item.id}', 1)"><i class="ti ti-chevron-down"></i></button>
          <button type="button" class="btn-icon btn-icon-danger" title="Remove" onclick="window.removeMergeItem('${item.id}')"><i class="ti ti-trash"></i></button>
        </div>
      `;
      fileListEl.appendChild(li);
    });

    initSortable();
    validateMergeState();
    updateMergeStats();
  }

  function initSortable() {
    if (appState.merge.sortable) {
      appState.merge.sortable.destroy();
    }
    appState.merge.sortable = Sortable.create(fileListEl, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: () => {
        const items = fileListEl.querySelectorAll('.file-item');
        items.forEach((li, idx) => {
          const id = li.getAttribute('data-id');
          const fileObj = appState.merge.files.find(f => f.id === id);
          if (fileObj) {
            fileObj.order = idx + 1;
          }
        });
        renderMergeWorkspace();
      }
    });
  }

  window.updateMergeItemOrder = function(id, newOrderVal) {
    const val = parseInt(newOrderVal, 10);
    if (isNaN(val) || val < 1 || val > appState.merge.files.length) {
      renderMergeWorkspace();
      return;
    }
    const item = appState.merge.files.find(f => f.id === id);
    if (item) {
      const oldOrder = item.order;
      if (oldOrder === val) return;
      appState.merge.files.forEach(f => {
        if (f.id !== id) {
          if (oldOrder < val && f.order > oldOrder && f.order <= val) {
            f.order--;
          } else if (oldOrder > val && f.order >= val && f.order < oldOrder) {
            f.order++;
          }
        }
      });
      item.order = val;
      renderMergeWorkspace();
    }
  };

  window.moveMergeItem = function(id, direction) {
    const idx = appState.merge.files.findIndex(f => f.id === id);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= appState.merge.files.length) return;

    const current = appState.merge.files[idx];
    const target = appState.merge.files[targetIdx];
    const temp = current.order;
    current.order = target.order;
    target.order = temp;

    renderMergeWorkspace();
  };

  window.removeMergeItem = function(id) {
    appState.merge.files = appState.merge.files.filter(f => f.id !== id);
    renderMergeWorkspace();
  };

  function updateMergeStats() {
    const count = appState.merge.files.length;
    const size = appState.merge.files.reduce((sum, f) => sum + f.size, 0);
    document.getElementById('merge-stats-count').textContent = count;
    document.getElementById('merge-stats-size').textContent = formatBytes(size);
  }

  function validateMergeState() {
    let valid = true;
    let msg = "";
    if (appState.merge.files.length < 2) {
      valid = false;
      msg = "At least 2 PDF files are required to merge.";
    }
    const outputName = outputFilenameInput.value.trim();
    if (!outputName) {
      valid = false;
      msg = "Output filename cannot be empty.";
    }
    
    if (msg) {
      validationAlert.style.display = 'flex';
      validationAlert.querySelector('.alert-text').textContent = msg;
    } else {
      validationAlert.style.display = 'none';
    }
    executeBtn.disabled = !valid;
  }

  async function runPDFMergeProcess() {
    workspace.style.display = 'none';
    progressOverlay.style.display = 'flex';
    setMergeProgress(5, 'Preparing PDFs...');
    
    try {
      await sleep(300);
      const buffers = [];
      for (let i = 0; i < appState.merge.files.length; i++) {
        const item = appState.merge.files[i];
        setMergeProgress(5 + Math.round((i / appState.merge.files.length) * 35), `Reading PDF (${i + 1}/${appState.merge.files.length}): ${escapeHtml(item.name)}`);
        const buffer = await readFileAsArrayBuffer(item.file);
        buffers.push(buffer);
        await sleep(100);
      }

      setMergeProgress(45, 'Creating combined document...');
      await sleep(200);

      const mergedPdf = await PDFLib.PDFDocument.create();
      let totalPages = 0;

      for (let i = 0; i < buffers.length; i++) {
        setMergeProgress(45 + Math.round((i / buffers.length) * 40), `Merging pages from file ${i + 1}...`);
        const pdfDoc = await PDFLib.PDFDocument.load(buffers[i]);
        const pageIndices = pdfDoc.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach(p => mergedPdf.addPage(p));
        totalPages += pageIndices.length;
        await sleep(100);
      }

      setMergeProgress(90, 'Saving compiled document...');
      await sleep(300);
      const savedBytes = await mergedPdf.save();
      
      setMergeProgress(98, 'Finalizing download link...');
      await sleep(200);

      appState.merge.mergedBlob = new Blob([savedBytes], { type: 'application/pdf' });
      appState.merge.mergedBlobUrl = URL.createObjectURL(appState.merge.mergedBlob);

      setMergeProgress(100, 'Merge Complete!');
      await sleep(300);

      progressOverlay.style.display = 'none';
      successOverlay.style.display = 'flex';
      
      let fn = outputFilenameInput.value.trim() || 'merged-document';
      if (!fn.toLowerCase().endsWith('.pdf')) fn += '.pdf';
      document.getElementById('merge-download-name').textContent = fn;
      document.getElementById('merge-download-size').textContent = formatBytes(appState.merge.mergedBlob.size);
      
      showToast('PDF Merge successful!', 'success');
    } catch (error) {
      console.error(error);
      showToast('Merging failed: ' + error.message, 'danger');
      progressOverlay.style.display = 'none';
      workspace.style.display = 'flex';
    }
  }

  function setMergeProgress(percentage, statusText) {
    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}%`;
    progressText.textContent = statusText;
  }

  function clearMergeBlob() {
    if (appState.merge.mergedBlobUrl) {
      URL.revokeObjectURL(appState.merge.mergedBlobUrl);
      appState.merge.mergedBlobUrl = null;
      appState.merge.mergedBlob = null;
    }
  }

  function clearMergeWorkspace() {
    appState.merge.files = [];
    clearMergeBlob();
    renderMergeWorkspace();
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
