/**
 * NovaTool - Secure In-Browser PDF & Document Toolkit
 * 
 * Dependencies:
 * - PDF-Lib (CDN): PDF document creation, assembly, and metadata stripping.
 * - PDF.js (CDN): Render PDF document pages onto high-resolution canvas elements.
 * - JSZip (CDN): Bundle multi-page image sets and compress/unpack DOCX office containers.
 * - SortableJS (CDN): Drag-and-drop sorting lists.
 */

// Initialize PDF.js Global Worker
const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================
const appState = {
  activeView: 'home-view',
  theme: 'dark', // 'dark' or 'light'
  
  // Tool 1: PDF Merge
  merge: {
    files: [], // Array of: { id, file, order, name, size }
    sortable: null,
    mergedBlob: null,
    mergedBlobUrl: null
  },
  
  // Tool 2: Image to PDF
  img2pdf: {
    files: [], // Array of: { id, file, order, name, size, thumbUrl }
    sortable: null,
    compiledBlob: null,
    compiledBlobUrl: null
  },
  
  // Tool 3: PDF to Image
  pdf2img: {
    files: [], // Array of: { id, file, name, size }
    extractedImages: [], // Array of: { name, blob, url }
    zipBlob: null,
    zipBlobUrl: null
  },
  
  // Tool 4: File Compressor
  compress: {
    files: [], // Array of: { id, file, name, size, type }
    compressedFiles: [], // Array of: { name, originalSize, compressedSize, blob, url }
    zipBlob: null,
    zipBlobUrl: null,
    mode: 'SIZE' // 'SIZE' or 'PERCENT'
  },
  
  // Tool 5: PDF to Word
  word: {
    files: [], // Array of: { id, file, name, size }
    convertedFiles: [], // Array of: { name, originalSize, docBlob, url }
    zipBlob: null,
    zipBlobUrl: null
  },
  
  // Tool 6: PPT to PDF
  ppt: {
    files: [], // Array of: { id, file, name, size }
    convertedFiles: [], // Array of: { name, originalSize, pdfBlob, url }
    zipBlob: null,
    zipBlobUrl: null
  }
};

// ==========================================================================
// CORE APP ROUTING & INTERACTIVE NAVS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Prevent default drag and drop behavior globally so dropping files doesn't navigate away
  ['dragover', 'drop'].forEach(name => {
    window.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  initAppRouter();
  initThemeManager();
  
  // Initialize each individual tool handler
  initPDFMergeTool();
  initImageToPDFTool();
  initPDFToImageTool();
  initCompressTool();
  initPDFToWordTool();
  initPPTToPDFTool();
});

function initAppRouter() {
  const tabs = document.querySelectorAll('.nav-tab');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNavMenu = document.getElementById('mobile-nav-menu');
  const logoLink = document.getElementById('nav-logo-link');
  
  // Get Started Modal triggers
  const getStartedBtn = document.getElementById('hero-get-started-btn');
  const getStartedModal = document.getElementById('get-started-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  if (getStartedBtn && getStartedModal) {
    getStartedBtn.addEventListener('click', () => {
      getStartedModal.style.display = 'flex';
    });
  }

  if (modalCloseBtn && getStartedModal) {
    modalCloseBtn.addEventListener('click', () => {
      getStartedModal.style.display = 'none';
    });
    
    // Close modal on background overlay click
    getStartedModal.addEventListener('click', (e) => {
      if (e.target === getStartedModal) {
        getStartedModal.style.display = 'none';
      }
    });
  }

  // Global selector callback referenced in inline onclick attributes
  window.selectModalTool = function(viewId) {
    if (getStartedModal) {
      getStartedModal.style.display = 'none';
    }
    switchTab(viewId);
  };
  
  // Desktop Tabs navigation
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const target = tab.getAttribute('data-target');
      switchTab(target);
    });
  });

  // Mobile Links navigation
  mobileLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-target');
      switchTab(target);
      mobileNavMenu.style.display = 'none'; // Close mobile overlay
    });
  });

  // Logo link to Home
  logoLink.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('home-view');
  });

  // Mobile Hamburger menu toggle
  mobileMenuBtn.addEventListener('click', () => {
    const isVisible = mobileNavMenu.style.display === 'flex';
    mobileNavMenu.style.display = isVisible ? 'none' : 'flex';
  });
}

function switchTab(viewId) {
  appState.activeView = viewId;
  
  // Hide all sections, show active view
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => {
    sec.classList.remove('active-view');
    if (sec.id === viewId) {
      sec.classList.add('active-view');
    }
  });

  // Update navigation highlight states
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.classList.remove('active');
    if (tab.getAttribute('data-target') === viewId) {
      tab.classList.add('active');
    }
  });

  const mobileLinks = document.querySelectorAll('.mobile-nav-link');
  mobileLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-target') === viewId) {
      link.classList.add('active');
    }
  });

  // Scroll to top of window
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// THEME MANAGER
// ==========================================================================
function initThemeManager() {
  const themeToggle = document.getElementById('theme-toggle');
  
  // Check local storage for theme persistence
  const savedTheme = localStorage.getItem('pdf-toolkit-theme');
  if (savedTheme === 'light') {
    appState.theme = 'light';
    document.body.classList.add('light-mode');
    themeToggle.innerHTML = '<i class="ti ti-sun"></i>';
  } else {
    appState.theme = 'dark';
    document.body.classList.remove('light-mode');
    themeToggle.innerHTML = '<i class="ti ti-moon"></i>';
  }

  themeToggle.addEventListener('click', () => {
    if (appState.theme === 'dark') {
      appState.theme = 'light';
      document.body.classList.add('light-mode');
      themeToggle.innerHTML = '<i class="ti ti-sun"></i>';
      localStorage.setItem('pdf-toolkit-theme', 'light');
      showToast('Theme switched to Light Mode', 'success');
    } else {
      appState.theme = 'dark';
      document.body.classList.remove('light-mode');
      themeToggle.innerHTML = '<i class="ti ti-moon"></i>';
      localStorage.setItem('pdf-toolkit-theme', 'dark');
      showToast('Theme switched to Dark Mode', 'success');
    }
  });
}

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ti-info-circle';
  if (type === 'success') icon = 'ti-circle-check';
  if (type === 'danger') icon = 'ti-alert-circle';
  if (type === 'warning') icon = 'ti-alert-triangle';
  
  toast.innerHTML = `
    <i class="ti ${icon} toast-icon"></i>
    <span class="toast-msg">${message}</span>
    <span class="toast-close"><i class="ti ti-x"></i></span>
  `;
  
  container.appendChild(toast);
  
  toast.querySelector('.toast-close').addEventListener('click', () => {
    dismissToast(toast);
  });
  
  setTimeout(() => {
    dismissToast(toast);
  }, 4000);
}

function dismissToast(toast) {
  if (toast.parentNode) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 300);
  }
}

// ==========================================================================
// HELPER UTILITIES
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

// ==========================================================================
// TOOL 1: PDF MERGE TOOL LOGIC
// ==========================================================================
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
      showToast(`Added ${added} PDF(s) to Merge list`, 'success');
      renderMergeWorkspace();
    }
  }

  function initMergeSortable() {
    appState.merge.sortable = new Sortable(fileListEl, {
      handle: '.drag-handle',
      animation: 200,
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        if (evt.oldIndex !== evt.newIndex) {
          const item = appState.merge.files.splice(evt.oldIndex, 1)[0];
          appState.merge.files.splice(evt.newIndex, 0, item);
          reorderMergeFiles();
          renderMergeWorkspace();
        }
      }
    });
  }

  function reorderMergeFiles() {
    appState.merge.files.forEach((file, index) => {
      file.order = index + 1;
    });
  }

  function renderMergeWorkspace() {
    if (appState.merge.files.length === 0) {
      workspace.style.display = 'none';
      return;
    }
    workspace.style.display = 'flex';
    fileListEl.innerHTML = '';

    appState.merge.files.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.innerHTML = `
        <div class="drag-handle"><i class="ti ti-grip-vertical"></i></div>
        <div class="pdf-icon-badge"><i class="ti ti-file-type-pdf"></i></div>
        <div class="file-info">
          <span class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="file-size">${formatBytes(item.size)}</span>
        </div>
        <div class="file-order-control">
          <input type="number" class="order-input" value="${item.order}" min="1" max="${appState.merge.files.length}" data-id="${item.id}">
        </div>
        <div class="file-actions">
          <button type="button" class="btn-icon" onclick="window.shiftMergeItem(${index}, -1)" ${index === 0 ? 'disabled' : ''}><i class="ti ti-arrow-narrow-up"></i></button>
          <button type="button" class="btn-icon" onclick="window.shiftMergeItem(${index}, 1)" ${index === appState.merge.files.length - 1 ? 'disabled' : ''}><i class="ti ti-arrow-narrow-down"></i></button>
          <button type="button" class="btn-icon btn-icon-danger" onclick="window.removeMergeItem('${item.id}')"><i class="ti ti-trash"></i></button>
        </div>
      `;
      fileListEl.appendChild(li);
    });

    // Inputs behavior
    const inputs = fileListEl.querySelectorAll('.order-input');
    inputs.forEach(input => {
      input.addEventListener('change', (e) => {
        applyMergeOrderInput(e.target);
      });
    });

    if (!appState.merge.sortable) {
      initMergeSortable();
    }

    updateMergeStats();
    validateMergeState();
  }

  function applyMergeOrderInput(inputEl) {
    const id = inputEl.getAttribute('data-id');
    const val = parseInt(inputEl.value, 10);
    const item = appState.merge.files.find(f => f.id === id);
    if (!item) return;

    if (isNaN(val) || val < 1 || val > appState.merge.files.length) {
      inputEl.value = item.order;
      showToast('Please enter a valid order number', 'warning');
      return;
    }

    const oldIndex = appState.merge.files.indexOf(item);
    const newIndex = val - 1;
    if (oldIndex !== newIndex) {
      appState.merge.files.splice(oldIndex, 1);
      appState.merge.files.splice(newIndex, 0, item);
      reorderMergeFiles();
      renderMergeWorkspace();
    }
  }

  window.shiftMergeItem = function(index, dir) {
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= appState.merge.files.length) return;
    const temp = appState.merge.files[index];
    appState.merge.files[index] = appState.merge.files[swapIdx];
    appState.merge.files[swapIdx] = temp;
    reorderMergeFiles();
    renderMergeWorkspace();
  };

  window.removeMergeItem = function(id) {
    appState.merge.files = appState.merge.files.filter(f => f.id !== id);
    reorderMergeFiles();
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

      // Show Success overlay
      progressOverlay.style.display = 'none';
      successOverlay.style.display = 'flex';
      
      let fn = outputFilenameInput.value.trim() || 'merged-document';
      if (!fn.toLowerCase().endsWith('.pdf')) fn += '.pdf';
      document.getElementById('merge-download-name').textContent = fn;
      document.getElementById('merge-download-pages').textContent = totalPages;
      document.getElementById('merge-download-size').textContent = formatBytes(appState.merge.mergedBlob.size);
      
      showToast('PDF Merge complete!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'An error occurred during merging.', 'danger');
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
// TOOL 2: IMAGE TO PDF LOGIC
// ==========================================================================
function initImageToPDFTool() {
  const dropZone = document.getElementById('img2pdf-drop-zone');
  const fileInput = document.getElementById('img2pdf-file-input');
  const workspace = document.getElementById('img2pdf-workspace');
  const fileListEl = document.getElementById('img2pdf-file-list');
  const clearBtn = document.getElementById('img2pdf-clear-btn');
  const executeBtn = document.getElementById('img2pdf-execute-btn');
  const outputFilenameInput = document.getElementById('img2pdf-output-filename');
  
  // Selection Inputs
  const pageSizeSelect = document.getElementById('img2pdf-page-size');
  const orientationSelect = document.getElementById('img2pdf-orientation');
  const marginsSelect = document.getElementById('img2pdf-margins');
  const qualitySelect = document.getElementById('img2pdf-quality');
  const maxSizeSelect = document.getElementById('img2pdf-max-size');
  const customSizeContainer = document.getElementById('img2pdf-custom-size-container');
  
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

  maxSizeSelect.addEventListener('change', () => {
    customSizeContainer.style.display = maxSizeSelect.value === 'CUSTOM' ? 'flex' : 'none';
    updateImg2PdfEst();
  });

  pageSizeSelect.addEventListener('change', () => {
    // Disable orientation if Fit Image selected
    orientationSelect.disabled = pageSizeSelect.value === 'FIT';
  });

  [pageSizeSelect, orientationSelect, marginsSelect, qualitySelect].forEach(sel => {
    sel.addEventListener('change', () => updateImg2PdfEst());
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('Remove all uploaded images?')) {
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

  function handleImgFiles(files) {
    let added = 0;
    const acceptedMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp', 'image/gif'];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop().toLowerCase();
      const isValidExt = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext);
      
      if (acceptedMime.includes(file.type) || isValidExt) {
        if (file.size === 0) continue;
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
      showToast(`Added ${added} image(s) successfully`, 'success');
      renderImgWorkspace();
    }
  }

  function initImgSortable() {
    appState.img2pdf.sortable = new Sortable(fileListEl, {
      handle: '.drag-handle',
      animation: 200,
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        if (evt.oldIndex !== evt.newIndex) {
          const item = appState.img2pdf.files.splice(evt.oldIndex, 1)[0];
          appState.img2pdf.files.splice(evt.newIndex, 0, item);
          reorderImgFiles();
          renderImgWorkspace();
        }
      }
    });
  }

  function reorderImgFiles() {
    appState.img2pdf.files.forEach((file, idx) => {
      file.order = idx + 1;
    });
  }

  function renderImgWorkspace() {
    if (appState.img2pdf.files.length === 0) {
      workspace.style.display = 'none';
      return;
    }
    workspace.style.display = 'flex';
    fileListEl.innerHTML = '';

    appState.img2pdf.files.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.innerHTML = `
        <div class="drag-handle"><i class="ti ti-grip-vertical"></i></div>
        <img src="${item.thumbUrl}" alt="thumbnail" class="thumbnail-preview">
        <div class="file-info">
          <span class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="file-size">${formatBytes(item.size)}</span>
        </div>
        <div class="file-order-control">
          <input type="number" class="order-input" value="${item.order}" min="1" max="${appState.img2pdf.files.length}" data-id="${item.id}">
        </div>
        <div class="file-actions">
          <button type="button" class="btn-icon" onclick="window.shiftImgItem(${index}, -1)" ${index === 0 ? 'disabled' : ''}><i class="ti ti-arrow-narrow-up"></i></button>
          <button type="button" class="btn-icon" onclick="window.shiftImgItem(${index}, 1)" ${index === appState.img2pdf.files.length - 1 ? 'disabled' : ''}><i class="ti ti-arrow-narrow-down"></i></button>
          <button type="button" class="btn-icon btn-icon-danger" onclick="window.removeImgItem('${item.id}')"><i class="ti ti-trash"></i></button>
        </div>
      `;
      fileListEl.appendChild(li);
    });

    const inputs = fileListEl.querySelectorAll('.order-input');
    inputs.forEach(input => {
      input.addEventListener('change', (e) => {
        applyImgOrderInput(e.target);
      });
    });

    if (!appState.img2pdf.sortable) {
      initImgSortable();
    }

    updateImgStats();
  }

  function applyImgOrderInput(inputEl) {
    const id = inputEl.getAttribute('data-id');
    const val = parseInt(inputEl.value, 10);
    const item = appState.img2pdf.files.find(f => f.id === id);
    if (!item) return;

    if (isNaN(val) || val < 1 || val > appState.img2pdf.files.length) {
      inputEl.value = item.order;
      showToast('Invalid page index', 'warning');
      return;
    }
    const oldIdx = appState.img2pdf.files.indexOf(item);
    const newIdx = val - 1;
    if (oldIdx !== newIdx) {
      appState.img2pdf.files.splice(oldIdx, 1);
      appState.img2pdf.files.splice(newIdx, 0, item);
      reorderImgFiles();
      renderImgWorkspace();
    }
  }

  window.shiftImgItem = function(index, dir) {
    const swp = index + dir;
    if (swp < 0 || swp >= appState.img2pdf.files.length) return;
    const temp = appState.img2pdf.files[index];
    appState.img2pdf.files[index] = appState.img2pdf.files[swp];
    appState.img2pdf.files[swp] = temp;
    reorderImgFiles();
    renderImgWorkspace();
  };

  window.removeImgItem = function(id) {
    const item = appState.img2pdf.files.find(f => f.id === id);
    if (item && item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
    appState.img2pdf.files = appState.img2pdf.files.filter(f => f.id !== id);
    reorderImgFiles();
    renderImgWorkspace();
  };

  function updateImgStats() {
    const count = appState.img2pdf.files.length;
    const totalSize = appState.img2pdf.files.reduce((sum, f) => sum + f.size, 0);
    document.getElementById('img2pdf-stats-count').textContent = count;
    document.getElementById('img2pdf-stats-size').textContent = formatBytes(totalSize);
    updateImg2PdfEst();
  }

  function updateImg2PdfEst() {
    const count = appState.img2pdf.files.length;
    if (count === 0) {
      document.getElementById('img2pdf-stats-est').textContent = '0 KB';
      return;
    }
    const originalBytes = appState.img2pdf.files.reduce((sum, f) => sum + f.size, 0);
    const q = parseFloat(qualitySelect.value);
    
    // Estimate compressed size based on quality
    let estBytes = originalBytes * q * 0.7; // conversion factor
    
    // If output limit size specified
    const maxVal = getImg2PdfMaxSizeVal();
    if (maxVal && estBytes > maxVal) {
      estBytes = maxVal;
    }
    
    document.getElementById('img2pdf-stats-est').textContent = formatBytes(estBytes);
  }

  function getImg2PdfMaxSizeVal() {
    const val = maxSizeSelect.value;
    if (val === 'NONE') return null;
    if (val === 'CUSTOM') {
      const customVal = parseFloat(document.getElementById('img2pdf-custom-size-val').value) || 0;
      const unit = document.getElementById('img2pdf-custom-size-unit').value;
      const mult = unit === 'MB' ? 1024 * 1024 : 1024;
      return customVal * mult;
    }
    return parseInt(val, 10);
  }

  async function runImageToPDFProcess() {
    workspace.style.display = 'none';
    progressOverlay.style.display = 'flex';
    setImgProgress(0, 'Preparing images...');
    await sleep(200);

    const pdfDoc = await PDFLib.PDFDocument.create();
    
    const pageSize = pageSizeSelect.value;
    const orientation = orientationSelect.value;
    const margin = marginsSelect.value;
    const quality = parseFloat(qualitySelect.value);
    const maxPdfSize = getImg2PdfMaxSizeVal();

    let marginPoints = 0;
    if (margin === 'SMALL') marginPoints = 10;
    if (margin === 'MEDIUM') marginPoints = 25;
    if (margin === 'LARGE') marginPoints = 50;

    let targetSizePerImage = null;
    if (maxPdfSize) {
      // Allocate proportional budget for each image file
      targetSizePerImage = Math.floor((maxPdfSize * 0.95) / appState.img2pdf.files.length);
    }

    try {
      for (let i = 0; i < appState.img2pdf.files.length; i++) {
        const item = appState.img2pdf.files[i];
        setImgProgress(
          5 + Math.round((i / appState.img2pdf.files.length) * 50), 
          `Optimizing image (${i + 1}/${appState.img2pdf.files.length}): ${escapeHtml(item.name)}`
        );
        
        // 1. Compress Image using canvas
        const compResult = await compressImageFile(item.file, quality, targetSizePerImage);
        const compBuffer = await compResult.arrayBuffer();

        // 2. Embed into PDF-Lib
        let embeddedImage;
        try {
          embeddedImage = await pdfDoc.embedJpg(compBuffer);
        } catch (err) {
          // If JPEG embed fails, fallback to loading raw image as PNG/JPEG
          const origBuffer = await readFileAsArrayBuffer(item.file);
          if (item.file.type === 'image/png') {
            embeddedImage = await pdfDoc.embedPng(origBuffer);
          } else {
            embeddedImage = await pdfDoc.embedJpg(origBuffer);
          }
        }

        setImgProgress(
          55 + Math.round((i / appState.img2pdf.files.length) * 35), 
          `Adding page to PDF (${i + 1}/${appState.img2pdf.files.length})...`
        );

        // 3. Layout math
        let pageWidth, pageHeight;
        if (pageSize === 'FIT') {
          pageWidth = embeddedImage.width + (marginPoints * 2);
          pageHeight = embeddedImage.height + (marginPoints * 2);
        } else {
          // A4 dimensions
          let w = 595.28;
          let h = 841.89;
          if (pageSize === 'LETTER') { w = 612; h = 792; }
          if (pageSize === 'LEGAL') { w = 612; h = 1008; }
          
          if (orientation === 'LANDSCAPE') {
            pageWidth = h;
            pageHeight = w;
          } else {
            pageWidth = w;
            pageHeight = h;
          }
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Draw image proportional scaling
        const printableWidth = pageWidth - (marginPoints * 2);
        const printableHeight = pageHeight - (marginPoints * 2);

        const imgScale = Math.min(
          printableWidth / embeddedImage.width,
          printableHeight / embeddedImage.height
        );

        const drawWidth = embeddedImage.width * imgScale;
        const drawHeight = embeddedImage.height * imgScale;
        
        // Center drawing coordinates
        const drawX = marginPoints + ((printableWidth - drawWidth) / 2);
        const drawY = marginPoints + ((printableHeight - drawHeight) / 2);

        page.drawImage(embeddedImage, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight
        });

        await sleep(150);
      }

      setImgProgress(90, 'Finalizing PDF output document...');
      await sleep(250);
      
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
}

// ==========================================================================
// IMAGE COMPRESSION UTILITIES (Used by uploader compression targets)
// ==========================================================================
async function compressImageFile(file, quality, targetSize) {
  const originalBlob = file;
  let currentQuality = quality;
  let scale = 1.0;
  let blob = await compressImageBlobWithScale(originalBlob, currentQuality, scale);
  
  if (targetSize && targetSize !== "NONE") {
    let iterations = 0;
    while (blob.size > targetSize && iterations < 3) {
      scale *= 0.8;
      currentQuality = Math.max(0.4, currentQuality - 0.1);
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

// ==========================================================================
// TOOL 3: PDF TO IMAGE LOGIC
// ==========================================================================
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
      let baseName = appState.pdf2img.files[0]?.name.split('.').pop() || 'extracted';
      triggerDownload(appState.pdf2img.zipBlobUrl, `${baseName}-images.zip`);
    } else if (appState.pdf2img.extractedImages[0]?.url) {
      // Single Page download
      triggerDownload(appState.pdf2img.extractedImages[0].url, appState.pdf2img.extractedImages[0].name);
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
      showToast(`Added ${added} PDF(s) successfully`, 'success');
      renderPdf2ImgWorkspace();
    }
  }

  function renderPdf2ImgWorkspace() {
    if (appState.pdf2img.files.length === 0) {
      workspace.style.display = 'none';
      return;
    }
    workspace.style.display = 'flex';
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
  }

  window.removePdf2ImgItem = function(id) {
    appState.pdf2img.files = appState.pdf2img.files.filter(f => f.id !== id);
    renderPdf2ImgWorkspace();
  };

  function getPdf2ImgMaxSizeVal() {
    const val = maxSizeSelect.value;
    if (val === 'NONE') return null;
    if (val === 'CUSTOM') {
      const customVal = parseFloat(document.getElementById('pdf2img-custom-size-val').value) || 0;
      const unit = document.getElementById('pdf2img-custom-size-unit').value;
      const mult = unit === 'MB' ? 1024 * 1024 : 1024;
      return customVal * mult;
    }
    return parseInt(val, 10);
  }

  async function runPDFToImageProcess() {
    workspace.style.display = 'none';
    progressOverlay.style.display = 'flex';
    setPdf2ImgProgress(0, 'Reading PDF documents...');
    await sleep(200);

    const format = formatSelect.value;
    const dpi = parseInt(dpiSelect.value, 10);
    const quality = parseFloat(qualitySelect.value);
    const maxImgSize = getPdf2ImgMaxSizeVal();

    appState.pdf2img.extractedImages = [];

    // Scale calculation
    const scale = dpi / 72; // PDF.js defaults standard DPI = 72

    try {
      let totalPagesAcrossPdfs = 0;
      const pdfjsDocs = [];

      for (let i = 0; i < appState.pdf2img.files.length; i++) {
        setPdf2ImgProgress(5 + Math.round((i / appState.pdf2img.files.length) * 15), `Loading file: ${escapeHtml(appState.pdf2img.files[i].name)}`);
        const buffer = await readFileAsArrayBuffer(appState.pdf2img.files[i].file);
        const pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
        pdfjsDocs.push({ pdfDoc, name: appState.pdf2img.files[i].name });
        totalPagesAcrossPdfs += pdfDoc.numPages;
        await sleep(100);
      }

      let pagesRendered = 0;

      for (let docIdx = 0; docIdx < pdfjsDocs.length; docIdx++) {
        const { pdfDoc, name } = pdfjsDocs[docIdx];
        const baseName = name.substring(0, name.lastIndexOf('.')) || name;
        
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          setPdf2ImgProgress(
            20 + Math.round((pagesRendered / totalPagesAcrossPdfs) * 60),
            `Rendering document page ${pageNum}/${pdfDoc.numPages} from: ${escapeHtml(name)}`
          );

          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');

          await page.render({ canvasContext: ctx, viewport }).promise;

          // Convert page to blob
          let mimeType = 'image/png';
          if (format === 'JPEG') mimeType = 'image/jpeg';
          if (format === 'WEBP') mimeType = 'image/webp';

          let blob = await canvasToBlobAsync(canvas, mimeType, quality);

          // Apply Size constraints if requested
          if (maxImgSize && blob.size > maxImgSize) {
            let imgScale = 0.8;
            let imgQuality = Math.max(0.4, quality - 0.1);
            let iterations = 0;
            
            while (blob.size > maxImgSize && iterations < 3) {
              const miniCanvas = document.createElement('canvas');
              miniCanvas.width = Math.max(100, Math.round(canvas.width * imgScale));
              miniCanvas.height = Math.max(100, Math.round(canvas.height * imgScale));
              const mCtx = miniCanvas.getContext('2d');
              mCtx.drawImage(canvas, 0, 0, miniCanvas.width, miniCanvas.height);
              
              blob = await canvasToBlobAsync(miniCanvas, mimeType, imgQuality);
              imgScale *= 0.8;
              imgQuality = Math.max(0.3, imgQuality - 0.1);
              iterations++;
            }
          }

          const imgUrl = URL.createObjectURL(blob);
          const imgName = `${baseName}_page_${pageNum}.${format.toLowerCase()}`;

          appState.pdf2img.extractedImages.push({
            name: imgName,
            blob: blob,
            url: imgUrl,
            pageNum: pageNum,
            docName: name
          });

          pagesRendered++;
          await sleep(150);
        }
      }

      setPdf2ImgProgress(90, 'Packaging rendered output images...');
      await sleep(200);

      // If multiple pages, bundle into zip
      if (appState.pdf2img.extractedImages.length > 1) {
        const zip = new JSZip();
        appState.pdf2img.extractedImages.forEach(img => {
          zip.file(img.name, img.blob);
        });
        
        setPdf2ImgProgress(95, 'Compiling ZIP file...');
        appState.pdf2img.zipBlob = await zip.generateAsync({ type: 'blob' });
        appState.pdf2img.zipBlobUrl = URL.createObjectURL(appState.pdf2img.zipBlob);
      } else {
        appState.pdf2img.zipBlob = null;
        appState.pdf2img.zipBlobUrl = null;
      }

      setPdf2ImgProgress(100, 'Rendering complete!');
      await sleep(300);

      // Render results view
      progressOverlay.style.display = 'none';
      successOverlay.style.display = 'flex';

      // Build Previews
      galleryEl.innerHTML = '';
      appState.pdf2img.extractedImages.forEach(img => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `
          <img src="${img.url}" alt="${escapeHtml(img.name)}" title="${escapeHtml(img.name)}">
          <span class="gallery-page-badge">Page ${img.pageNum}</span>
        `;
        galleryEl.appendChild(item);
      });

      // Update success details stats
      document.getElementById('pdf2img-success-pages').textContent = appState.pdf2img.extractedImages.length;
      document.getElementById('pdf2img-success-format').textContent = format;
      
      const totalSize = appState.pdf2img.extractedImages.reduce((sum, img) => sum + img.blob.size, 0);
      document.getElementById('pdf2img-success-size').textContent = formatBytes(totalSize);

      // Toggle download buttons representation
      if (appState.pdf2img.extractedImages.length > 1) {
        successDownloadBtn.innerHTML = '<i class="ti ti-file-zip"></i> Download Images ZIP';
      } else {
        successDownloadBtn.innerHTML = '<i class="ti ti-download"></i> Download Image';
      }

      showToast('Rendered pages successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Extraction failed: ' + err.message, 'danger');
      progressOverlay.style.display = 'none';
      workspace.style.display = 'flex';
    }
  }

  function canvasToBlobAsync(canvas, mimeType, quality) {
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        resolve(blob);
      }, mimeType, quality);
    });
  }

  function setPdf2ImgProgress(percentage, statusText) {
    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}%`;
    progressText.textContent = statusText;
  }

  function clearPdf2ImgBlob() {
    appState.pdf2img.extractedImages.forEach(img => {
      if (img.url) URL.revokeObjectURL(img.url);
    });
    appState.pdf2img.extractedImages = [];
    
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
// TOOL 4: FILE COMPRESSOR LOGIC
// ==========================================================================
function initCompressTool() {
  const dropZone = document.getElementById('compress-drop-zone');
  const fileInput = document.getElementById('compress-file-input');
  const workspace = document.getElementById('compress-workspace');
  const fileListEl = document.getElementById('compress-file-list');
  const clearBtn = document.getElementById('compress-clear-btn');
  const executeBtn = document.getElementById('compress-execute-btn');
  
  // Custom switch actions
  const sizeToggle = document.getElementById('compress-toggle-size-btn');
  const percentToggle = document.getElementById('compress-toggle-percent-btn');
  const sizeSettings = document.getElementById('compress-size-settings');
  const percentSettings = document.getElementById('compress-percent-settings');
  const sizeSelect = document.getElementById('compress-target-size');
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

  // Toggles targets
  sizeToggle.addEventListener('click', () => {
    appState.compress.mode = 'SIZE';
    sizeToggle.classList.add('active');
    percentToggle.classList.remove('active');
    sizeSettings.style.display = 'flex';
    percentSettings.style.display = 'none';
  });

  percentToggle.addEventListener('click', () => {
    appState.compress.mode = 'PERCENT';
    percentToggle.classList.add('active');
    sizeToggle.classList.remove('active');
    percentSettings.style.display = 'flex';
    sizeSettings.style.display = 'none';
  });

  sizeSelect.addEventListener('change', () => {
    customSizeContainer.style.display = sizeSelect.value === 'CUSTOM' ? 'flex' : 'none';
  });

  percentSlider.addEventListener('input', () => {
    sliderLabel.textContent = `${percentSlider.value}%`;
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('Clear uploaded files from compression list?')) {
      clearCompressWorkspace();
    }
  });

  executeBtn.addEventListener('click', () => {
    runFileCompression();
  });

  successDownloadBtn.addEventListener('click', () => {
    if (appState.compress.zipBlobUrl) {
      triggerDownload(appState.compress.zipBlobUrl, 'optimized-documents.zip');
    } else if (appState.compress.compressedFiles[0]?.url) {
      triggerDownload(appState.compress.compressedFiles[0].url, appState.compress.compressedFiles[0].name);
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
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx'];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop().toLowerCase();
      
      if (allowedExtensions.includes(ext) || file.type === 'application/pdf') {
        if (file.size === 0) continue;
        appState.compress.files.push({
          id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file: file,
          name: file.name,
          size: file.size,
          ext: ext
        });
        added++;
      }
    }
    if (added > 0) {
      showToast(`Added ${added} document(s) to Compression list`, 'success');
      renderCompressWorkspace();
    }
  }

  function renderCompressWorkspace() {
    if (appState.compress.files.length === 0) {
      workspace.style.display = 'none';
      return;
    }
    workspace.style.display = 'flex';
    fileListEl.innerHTML = '';

    appState.compress.files.forEach(item => {
      let icon = 'ti-file-description';
      if (item.ext === 'pdf') icon = 'ti-file-type-pdf';
      if (['jpg', 'jpeg', 'png', 'webp'].includes(item.ext)) icon = 'ti-file-type-jpg';
      if (['doc', 'docx'].includes(item.ext)) icon = 'ti-file-type-docx';
      
      const li = document.createElement('li');
      li.className = 'file-item list-no-hover';
      li.innerHTML = `
        <div class="pdf-icon-badge"><i class="ti ${icon}"></i></div>
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
  }

  window.removeCompressItem = function(id) {
    appState.compress.files = appState.compress.files.filter(f => f.id !== id);
    renderCompressWorkspace();
  };

  function getTargetSizeVal() {
    if (appState.compress.mode === 'PERCENT') return null;
    const val = sizeSelect.value;
    if (val === 'CUSTOM') {
      const customVal = parseFloat(document.getElementById('compress-custom-size-val').value) || 0;
      const unit = document.getElementById('compress-custom-size-unit').value;
      const mult = unit === 'MB' ? 1024 * 1024 : 1024;
      return customVal * mult;
    }
    return parseInt(val, 10);
  }

  async function runFileCompression() {
    workspace.style.display = 'none';
    progressOverlay.style.display = 'flex';
    setCompressProgress(0, 'Scanning files...');
    await sleep(200);

    const mode = appState.compress.mode;
    const percent = parseInt(percentSlider.value, 10);
    const targetSize = getTargetSizeVal();
    const pdfMode = pdfModeSelect.value;

    appState.compress.compressedFiles = [];

    try {
      for (let i = 0; i < appState.compress.files.length; i++) {
        const item = appState.compress.files[i];
        setCompressProgress(
          5 + Math.round((i / appState.compress.files.length) * 80), 
          `Compressing document (${i + 1}/${appState.compress.files.length}): ${escapeHtml(item.name)}`
        );

        let finalBlob = item.file;
        let fileBudget = targetSize;
        if (mode === 'PERCENT') {
          fileBudget = Math.round(item.size * (1 - (percent / 100)));
        }

        // Apply file type specific compression logic
        if (['jpg', 'jpeg', 'png', 'webp'].includes(item.ext)) {
          // Standard image canvas compression
          const quality = mode === 'PERCENT' ? (1 - (percent / 100)) : 0.8;
          finalBlob = await compressImageFile(item.file, quality, fileBudget);
        }
        else if (item.ext === 'pdf') {
          // PDF recompression
          if (pdfMode === 'LOSSLESS') {
            // Strip metadata and object stream saving via PDF-Lib
            const arrayBuffer = await readFileAsArrayBuffer(item.file);
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            pdfDoc.setTitle('');
            pdfDoc.setAuthor('');
            pdfDoc.setSubject('');
            pdfDoc.setCreator('');
            pdfDoc.setProducer('');
            
            const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
            finalBlob = new Blob([compressedBytes], { type: 'application/pdf' });
          } else {
            // Visual lossy compression (PDF.js canvas rendering to PDF-Lib compiler)
            finalBlob = await compressPdfLossy(item.file, fileBudget, mode === 'PERCENT' ? percent : 50);
          }
        }
        else if (item.ext === 'docx') {
          // DOCX media folder image compression
          const quality = mode === 'PERCENT' ? (1 - (percent / 100)) : 0.75;
          finalBlob = await compressDocxImages(item.file, quality);
        }

        const url = URL.createObjectURL(finalBlob);
        appState.compress.compressedFiles.push({
          name: item.name,
          originalSize: item.size,
          compressedSize: finalBlob.size,
          blob: finalBlob,
          url: url,
          ext: item.ext
        });
        
        await sleep(150);
      }

      setCompressProgress(90, 'Packaging compressed documents...');
      await sleep(200);

      // Zip if bulk uploader
      if (appState.compress.compressedFiles.length > 1) {
        const zip = new JSZip();
        appState.compress.compressedFiles.forEach(f => {
          zip.file(f.name, f.blob);
        });
        setCompressProgress(95, 'Generating package ZIP archive...');
        appState.compress.zipBlob = await zip.generateAsync({ type: 'blob' });
        appState.compress.zipBlobUrl = URL.createObjectURL(appState.compress.zipBlob);
      } else {
        appState.compress.zipBlob = null;
        appState.compress.zipBlobUrl = null;
      }

      setCompressProgress(100, 'Optimization completed!');
      await sleep(250);

      // Render results view
      progressOverlay.style.display = 'none';
      successOverlay.style.display = 'flex';

      // Statistics calculations
      const totalOrig = appState.compress.compressedFiles.reduce((sum, f) => sum + f.originalSize, 0);
      const totalComp = appState.compress.compressedFiles.reduce((sum, f) => sum + f.compressedSize, 0);
      const totalSaved = Math.max(0, totalOrig - totalComp);
      const percentSaved = totalOrig > 0 ? Math.round((totalSaved / totalOrig) * 100) : 0;

      document.getElementById('compress-success-orig').textContent = formatBytes(totalOrig);
      document.getElementById('compress-success-comp').textContent = formatBytes(totalComp);
      document.getElementById('compress-success-saved').textContent = `${formatBytes(totalSaved)} (${percentSaved}% Saved)`;

      // Populate file results list
      successResultList.innerHTML = '';
      appState.compress.compressedFiles.forEach(f => {
        let icon = 'ti-file-description';
        if (f.ext === 'pdf') icon = 'ti-file-type-pdf';
        if (['jpg', 'jpeg', 'png', 'webp'].includes(f.ext)) icon = 'ti-file-type-jpg';
        if (['doc', 'docx'].includes(f.ext)) icon = 'ti-file-type-docx';
        
        const individualSaved = Math.max(0, f.originalSize - f.compressedSize);
        const indPercent = Math.round((individualSaved / f.originalSize) * 100);

        const li = document.createElement('li');
        li.className = 'file-item list-no-hover';
        li.innerHTML = `
          <div class="pdf-icon-badge"><i class="ti ${icon}"></i></div>
          <div class="file-info">
            <span class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
            <span class="file-size">Original: ${formatBytes(f.originalSize)} &bull; Optimized: ${formatBytes(f.compressedSize)}</span>
          </div>
          <div style="text-align: right; font-weight: 700; color: #10b981; font-size: 0.95rem;">
            -${indPercent}%
          </div>
        `;
        successResultList.appendChild(li);
      });

      // Toggle action buttons labels
      if (appState.compress.compressedFiles.length > 1) {
        successDownloadBtn.innerHTML = '<i class="ti ti-file-zip"></i> Download Optimized ZIP';
      } else {
        successDownloadBtn.innerHTML = '<i class="ti ti-download"></i> Download Optimized File';
      }

      showToast('Compression completed successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Compression failed: ' + err.message, 'danger');
      progressOverlay.style.display = 'none';
      workspace.style.display = 'flex';
    }
  }

  // Dual-mode Visual Lossy compression for PDFs
  async function compressPdfLossy(file, targetSize, compressionPercentage) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdfjsDoc.numPages;
    
    // Choose rendering DPI based on compression targets
    let dpi = 150;
    let quality = 0.75;
    
    if (compressionPercentage > 60) {
      dpi = 90;
      quality = 0.55;
    } else if (compressionPercentage > 30) {
      dpi = 120;
      quality = 0.7;
    }

    const scale = dpi / 72;
    const outputPdf = await PDFLib.PDFDocument.create();

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfjsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Extract as compressed JPEG
      const pageJpgBlob = await new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
      });
      const pageBuffer = await pageJpgBlob.arrayBuffer();

      const embeddedImg = await outputPdf.embedJpg(pageBuffer);
      const outputPage = outputPdf.addPage([embeddedImg.width, embeddedImg.height]);
      outputPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: embeddedImg.width,
        height: embeddedImg.height
      });
    }

    const compiledBytes = await outputPdf.save();
    return new Blob([compiledBytes], { type: 'application/pdf' });
  }

  // DOCX Zip image assets compression unzipper
  async function compressDocxImages(file, quality) {
    try {
      const zip = await JSZip.loadAsync(file);
      const mediaFolder = zip.folder("word/media");
      
      if (mediaFolder) {
        const imageFiles = [];
        mediaFolder.forEach((relativePath, fileEntry) => {
          if (/\.(png|jpe?g|webp|gif)$/i.test(fileEntry.name)) {
            imageFiles.push(fileEntry);
          }
        });

        for (const entry of imageFiles) {
          const originalData = await entry.async("blob");
          // Re-encode image asset at reduced quality inside the word media folder
          const compressedBlob = await compressImageBlob(originalData, quality);
          const compressedBuffer = await compressedBlob.arrayBuffer();
          // Write back into Docx archive
          zip.file(entry.name, compressedBuffer);
        }
      }

      // Re-compile docx archive
      return await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });
    } catch (err) {
      console.warn("Docx Zip decompression failed, saving original fallback.", err);
      return file;
    }
  }

  function compressImageBlob(blob, quality) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
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

  function setCompressProgress(percentage, statusText) {
    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}%`;
    progressText.textContent = statusText;
  }

  function clearCompressBlob() {
    appState.compress.compressedFiles.forEach(f => {
      if (f.url) URL.revokeObjectURL(f.url);
    });
    appState.compress.compressedFiles = [];

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
// TOOL 5: PDF TO WORD (DOC) LOGIC
// ==========================================================================
function initPDFToWordTool() {
  const dropZone = document.getElementById('word-drop-zone');
  const fileInput = document.getElementById('word-file-input');
  const workspace = document.getElementById('word-workspace');
  const fileListEl = document.getElementById('word-file-list');
  const clearBtn = document.getElementById('word-clear-btn');
  const executeBtn = document.getElementById('word-execute-btn');
  const outputFilenameInput = document.getElementById('word-output-filename');
  
  // Progress overlay
  const progressOverlay = document.getElementById('word-progress');
  const progressBar = document.getElementById('word-progress-bar');
  const progressText = document.getElementById('word-progress-text');
  const progressPercent = document.getElementById('word-progress-percent');
  
  // Success overlay
  const successOverlay = document.getElementById('word-success');
  const successDownloadBtn = document.getElementById('word-download-btn');
  const successResetBtn = document.getElementById('word-reset-btn');

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
    handleWordFiles(e.dataTransfer.files);
  });
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', (e) => {
    handleWordFiles(e.target.files);
    fileInput.value = '';
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('Clear uploaded PDFs?')) {
      clearWordWorkspace();
    }
  });

  executeBtn.addEventListener('click', () => {
    runPDFToWordProcess();
  });

  successDownloadBtn.addEventListener('click', () => {
    if (appState.word.zipBlobUrl) {
      triggerDownload(appState.word.zipBlobUrl, 'converted-documents.zip');
    } else if (appState.word.convertedFiles[0]?.url) {
      triggerDownload(appState.word.convertedFiles[0].url, appState.word.convertedFiles[0].name);
    }
  });

  successResetBtn.addEventListener('click', () => {
    successOverlay.style.display = 'none';
    workspace.style.display = 'flex';
    clearWordBlob();
    renderWordWorkspace();
  });

  function handleWordFiles(files) {
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        if (file.size === 0) continue;
        appState.word.files.push({
          id: `word-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file: file,
          name: file.name,
          size: file.size
        });
        added++;
      }
    }
    if (added > 0) {
      showToast(`Added ${added} PDF(s) to convert`, 'success');
      renderWordWorkspace();
    }
  }

  function renderWordWorkspace() {
    if (appState.word.files.length === 0) {
      workspace.style.display = 'none';
      return;
    }
    workspace.style.display = 'flex';
    fileListEl.innerHTML = '';

    appState.word.files.forEach(item => {
      const li = document.createElement('li');
      li.className = 'file-item list-no-hover';
      li.innerHTML = `
        <div class="pdf-icon-badge"><i class="ti ti-file-type-pdf"></i></div>
        <div class="file-info">
          <span class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="file-size">${formatBytes(item.size)}</span>
        </div>
        <div class="file-actions">
          <button type="button" class="btn-icon btn-icon-danger" onclick="window.removeWordItem('${item.id}')"><i class="ti ti-trash"></i></button>
        </div>
      `;
      fileListEl.appendChild(li);
    });

    executeBtn.disabled = appState.word.files.length === 0;
    updateWordStats();
  }

  window.removeWordItem = function(id) {
    appState.word.files = appState.word.files.filter(f => f.id !== id);
    renderWordWorkspace();
  };

  function updateWordStats() {
    const count = appState.word.files.length;
    const size = appState.word.files.reduce((sum, f) => sum + f.size, 0);
    document.getElementById('word-stats-count').textContent = count;
    document.getElementById('word-stats-size').textContent = formatBytes(size);
  }

  async function runPDFToWordProcess() {
    workspace.style.display = 'none';
    progressOverlay.style.display = 'flex';
    setWordProgress(0, 'Preparing documents...');
    await sleep(200);

    appState.word.convertedFiles = [];

    try {
      for (let i = 0; i < appState.word.files.length; i++) {
        const item = appState.word.files[i];
        setWordProgress(
          5 + Math.round((i / appState.word.files.length) * 80),
          `Converting file (${i + 1}/${appState.word.files.length}): ${escapeHtml(item.name)}`
        );

        // Extract Text and paragraphs
        const docHtml = await parsePdfToWordHtml(item.file);
        
        const docBlob = new Blob([docHtml], { type: 'application/msword' });
        const url = URL.createObjectURL(docBlob);
        
        let outputName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
        if (appState.word.files.length === 1) {
          outputName = outputFilenameInput.value.trim() || 'converted-document';
        }
        
        if (!outputName.toLowerCase().endsWith('.doc')) {
          outputName += '.doc';
        }

        appState.word.convertedFiles.push({
          name: outputName,
          originalSize: item.size,
          docBlob: docBlob,
          url: url
        });

        await sleep(150);
      }

      setWordProgress(90, 'Packaging output documents...');
      await sleep(200);

      // ZIP if bulk uploader
      if (appState.word.convertedFiles.length > 1) {
        const zip = new JSZip();
        appState.word.convertedFiles.forEach(f => {
          zip.file(f.name, f.docBlob);
        });
        setWordProgress(95, 'Compiling ZIP package...');
        appState.word.zipBlob = await zip.generateAsync({ type: 'blob' });
        appState.word.zipBlobUrl = URL.createObjectURL(appState.word.zipBlob);
      } else {
        appState.word.zipBlob = null;
        appState.word.zipBlobUrl = null;
      }

      setWordProgress(100, 'Conversion complete!');
      await sleep(250);

      // success screen
      progressOverlay.style.display = 'none';
      successOverlay.style.display = 'flex';

      // update details card
      if (appState.word.convertedFiles.length > 1) {
        document.getElementById('word-download-name').textContent = 'converted-documents.zip';
        document.getElementById('word-download-size').textContent = formatBytes(appState.word.zipBlob.size);
        successDownloadBtn.innerHTML = '<i class="ti ti-file-zip"></i> Download Word ZIP';
      } else {
        const targetFile = appState.word.convertedFiles[0];
        document.getElementById('word-download-name').textContent = targetFile.name;
        document.getElementById('word-download-size').textContent = formatBytes(targetFile.docBlob.size);
        successDownloadBtn.innerHTML = '<i class="ti ti-download"></i> Download Word File';
      }

      showToast('Converted PDF to Word successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Conversion failed: ' + err.message, 'danger');
      progressOverlay.style.display = 'none';
      workspace.style.display = 'flex';
    }
  }

  // Extract text and rebuild lines/paragraphs using Y-coordinate groupings
  async function parsePdfToWordHtml(file) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">`;
    fullHtml += `<head><title>Converted Document</title>`;
    fullHtml += `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->`;
    fullHtml += `<style>body { font-family: 'Arial', sans-serif; line-height: 1.6; padding: 1in; } p { margin-bottom: 10pt; text-align: justify; }</style>`;
    fullHtml += `</head><body>`;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items;
      const validItems = items.filter(item => item.str.trim() !== '');
      
      if (validItems.length === 0) {
        fullHtml += `<p style="color: #888;">[Scanned page containing no selectable text]</p>`;
        if (pageNum < pdf.numPages) {
          fullHtml += `<br clear="all" style="page-break-before: always;" />`;
        }
        continue;
      }

      // Group by Y coordinates within a small tolerance (e.g. 5 units)
      const linesMap = {};
      validItems.forEach(item => {
        const y = Math.round(item.transform[5]);
        let key = Object.keys(linesMap).find(k => Math.abs(parseInt(k, 10) - y) <= 5);
        if (!key) {
          key = String(y);
          linesMap[key] = [];
        }
        linesMap[key].push(item);
      });

      // Sort lines top to bottom (Y descending)
      const sortedKeys = Object.keys(linesMap).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

      let pageParagraphs = [];
      let currentParagraph = [];
      let lastY = null;

      sortedKeys.forEach(key => {
        const currentY = parseInt(key, 10);
        const lineItems = linesMap[key].sort((a, b) => a.transform[4] - b.transform[4]);
        const lineText = lineItems.map(item => item.str).join(" ");

        if (lastY !== null) {
          const gap = lastY - currentY;
          if (gap > 22 && currentParagraph.length > 0) {
            pageParagraphs.push(currentParagraph.join(" "));
            currentParagraph = [];
          }
        }

        currentParagraph.push(lineText);
        lastY = currentY;
      });

      if (currentParagraph.length > 0) {
        pageParagraphs.push(currentParagraph.join(" "));
      }

      pageParagraphs.forEach(p => {
        const safeText = escapeHtml(p).replace(/\s+/g, ' ');
        if (safeText.trim().length > 0) {
          fullHtml += `<p>${safeText}</p>`;
        }
      });

      if (pageNum < pdf.numPages) {
        fullHtml += `<br clear="all" style="page-break-before: always;" />`;
      }
    }

    fullHtml += `</body></html>`;
    return fullHtml;
  }

  function setWordProgress(percentage, statusText) {
    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}%`;
    progressText.textContent = statusText;
  }

  function clearWordBlob() {
    appState.word.convertedFiles.forEach(f => {
      if (f.url) URL.revokeObjectURL(f.url);
    });
    appState.word.convertedFiles = [];

    if (appState.word.zipBlobUrl) {
      URL.revokeObjectURL(appState.word.zipBlobUrl);
      appState.word.zipBlobUrl = null;
      appState.word.zipBlob = null;
    }
  }

  function clearWordWorkspace() {
    appState.word.files = [];
    clearWordBlob();
    renderWordWorkspace();
  }
}

// ==========================================================================
// TOOL 6: PPT TO PDF LOGIC
// ==========================================================================
function initPPTToPDFTool() {
  const dropZone = document.getElementById('ppt-drop-zone');
  const fileInput = document.getElementById('ppt-file-input');
  const workspace = document.getElementById('ppt-workspace');
  const fileListEl = document.getElementById('ppt-file-list');
  const clearBtn = document.getElementById('ppt-clear-btn');
  const executeBtn = document.getElementById('ppt-execute-btn');
  
  // Progress overlay
  const progressOverlay = document.getElementById('ppt-progress');
  const progressBar = document.getElementById('ppt-progress-bar');
  const progressText = document.getElementById('ppt-progress-text');
  const progressPercent = document.getElementById('ppt-progress-percent');
  
  // Success overlay
  const successOverlay = document.getElementById('ppt-success');
  const successDownloadBtn = document.getElementById('ppt-download-btn');
  const successResetBtn = document.getElementById('ppt-reset-btn');

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
    handlePptFiles(e.dataTransfer.files);
  });
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', (e) => {
    handlePptFiles(e.target.files);
    fileInput.value = '';
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('Clear uploaded PowerPoint files?')) {
      clearPptWorkspace();
    }
  });

  executeBtn.addEventListener('click', () => {
    runPPTToPDFProcess();
  });

  successDownloadBtn.addEventListener('click', () => {
    if (appState.ppt.zipBlobUrl) {
      triggerDownload(appState.ppt.zipBlobUrl, 'ppt-to-pdf-converted.zip');
    } else if (appState.ppt.convertedFiles[0]?.url) {
      triggerDownload(appState.ppt.convertedFiles[0].url, appState.ppt.convertedFiles[0].name);
    }
  });

  successResetBtn.addEventListener('click', () => {
    successOverlay.style.display = 'none';
    workspace.style.display = 'flex';
    clearPptBlob();
    renderPptWorkspace();
  });

  function handlePptFiles(files) {
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.toLowerCase().endsWith('.pptx')) {
        if (file.size === 0) continue;
        appState.ppt.files.push({
          id: `ppt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file: file,
          name: file.name,
          size: file.size
        });
        added++;
      }
    }
    if (added > 0) {
      showToast(`Added ${added} PowerPoint(s) to convert`, 'success');
      renderPptWorkspace();
    } else {
      showToast('Please select valid PowerPoint (.pptx) files.', 'warning');
    }
  }

  function renderPptWorkspace() {
    if (appState.ppt.files.length === 0) {
      workspace.style.display = 'none';
      return;
    }
    workspace.style.display = 'flex';
    fileListEl.innerHTML = '';

    appState.ppt.files.forEach(item => {
      const li = document.createElement('li');
      li.className = 'file-item list-no-hover';
      li.innerHTML = `
        <div class="pdf-icon-badge ppt-color-bg"><i class="ti ti-presentation"></i></div>
        <div class="file-info">
          <span class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="file-size">${formatBytes(item.size)}</span>
        </div>
        <div class="file-actions">
          <button type="button" class="btn-icon btn-icon-danger" onclick="window.removePptItem('${item.id}')"><i class="ti ti-trash"></i></button>
        </div>
      `;
      fileListEl.appendChild(li);
    });

    executeBtn.disabled = appState.ppt.files.length === 0;
    updatePptStats();
  }

  window.removePptItem = function(id) {
    appState.ppt.files = appState.ppt.files.filter(f => f.id !== id);
    renderPptWorkspace();
  };

  function updatePptStats() {
    const count = appState.ppt.files.length;
    const size = appState.ppt.files.reduce((sum, f) => sum + f.size, 0);
    document.getElementById('ppt-stats-count').textContent = count;
    document.getElementById('ppt-stats-size').textContent = formatBytes(size);
  }

  async function runPPTToPDFProcess() {
    workspace.style.display = 'none';
    progressOverlay.style.display = 'flex';
    setPptProgress(0, 'Preparing presentation package...');
    await sleep(200);

    appState.ppt.convertedFiles = [];

    try {
      for (let i = 0; i < appState.ppt.files.length; i++) {
        const item = appState.ppt.files[i];
        setPptProgress(
          5 + Math.round((i / appState.ppt.files.length) * 80),
          `Converting presentation (${i + 1}/${appState.ppt.files.length}): ${escapeHtml(item.name)}`
        );

        const pdfBytes = await convertPptxToPdf(item.file, (perc, txt) => {
          const stepBase = 5 + Math.round((i / appState.ppt.files.length) * 80);
          const stepWeight = Math.round(80 / appState.ppt.files.length);
          const currentPerc = stepBase + Math.round((perc / 100) * stepWeight);
          setPptProgress(currentPerc, `File ${i + 1}/${appState.ppt.files.length}: ${txt}`);
        });
        
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        
        let outputName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
        outputName += '.pdf';

        appState.ppt.convertedFiles.push({
          name: outputName,
          originalSize: item.size,
          pdfBlob: pdfBlob,
          url: url
        });

        await sleep(150);
      }

      setPptProgress(90, 'Preparing final PDF documents...');
      await sleep(200);

      // ZIP if bulk uploader
      if (appState.ppt.convertedFiles.length > 1) {
        const zip = new JSZip();
        appState.ppt.convertedFiles.forEach(f => {
          zip.file(f.name, f.pdfBlob);
        });
        setPptProgress(95, 'Compiling ZIP package...');
        appState.ppt.zipBlob = await zip.generateAsync({ type: 'blob' });
        appState.ppt.zipBlobUrl = URL.createObjectURL(appState.ppt.zipBlob);
      } else {
        appState.ppt.zipBlob = null;
        appState.ppt.zipBlobUrl = null;
      }

      setPptProgress(100, 'Conversion complete!');
      await sleep(250);

      // success screen
      progressOverlay.style.display = 'none';
      successOverlay.style.display = 'flex';

      // update details card
      if (appState.ppt.convertedFiles.length > 1) {
        document.getElementById('ppt-download-name').textContent = 'ppt-to-pdf-converted.zip';
        document.getElementById('ppt-download-size').textContent = formatBytes(appState.ppt.zipBlob.size);
        successDownloadBtn.innerHTML = '<i class="ti ti-file-zip"></i> Download Converted ZIP';
      } else {
        const targetFile = appState.ppt.convertedFiles[0];
        document.getElementById('ppt-download-name').textContent = targetFile.name;
        document.getElementById('ppt-download-size').textContent = formatBytes(targetFile.pdfBlob.size);
        successDownloadBtn.innerHTML = '<i class="ti ti-download"></i> Download PDF File';
      }

      showToast('PowerPoint(s) converted to PDF successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Conversion failed: ' + err.message, 'danger');
      progressOverlay.style.display = 'none';
      workspace.style.display = 'flex';
    }
  }

  // Parse slides in the PPTX package and draw pages in PDF-Lib
  async function convertPptxToPdf(file, progressCallback) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Find all slide files in ppt/slides/slideX.xml
    const slidePaths = Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path));
    
    // Sort slides numerically
    slidePaths.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0], 10);
      const numB = parseInt(b.match(/\d+/)[0], 10);
      return numA - numB;
    });
    
    if (slidePaths.length === 0) {
      throw new Error("No slides found inside this presentation.");
    }
    
    const pdfDoc = await PDFLib.PDFDocument.create();
    
    const fontHelvetica = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontHelveticaBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    
    let slideWidth = 720;
    let slideHeight = 405; // 16:9 widescreen defaults
    
    try {
      const presXmlStr = await zip.file("ppt/presentation.xml").async("string");
      const presDoc = new DOMParser().parseFromString(presXmlStr, "text/xml");
      const sldSzNode = presDoc.getElementsByTagName("p:sldSz")[0];
      if (sldSzNode) {
        const cx = parseInt(sldSzNode.getAttribute("cx"), 10);
        const cy = parseInt(sldSzNode.getAttribute("cy"), 10);
        if (cx && cy) {
          slideWidth = Math.round(cx / 12700);
          slideHeight = Math.round(cy / 12700);
        }
      }
    } catch (e) {
      console.warn("Could not read slide size dimensions, defaulting to 16:9.", e);
    }

    for (let i = 0; i < slidePaths.length; i++) {
      const slidePath = slidePaths[i];
      const slideNum = parseInt(slidePath.match(/\d+/)[0], 10);
      
      if (progressCallback) {
        progressCallback(Math.round((i / slidePaths.length) * 90), `Rendering Slide ${i + 1} of ${slidePaths.length}...`);
      }
      
      const xmlStr = await zip.file(slidePath).async("string");
      const xmlDoc = new DOMParser().parseFromString(xmlStr, "text/xml");
      
      const paragraphs = [];
      const spNodes = xmlDoc.getElementsByTagName("p:sp");
      for (let sp of spNodes) {
        const txBody = sp.getElementsByTagName("p:txBody")[0];
        if (txBody) {
          const pNodes = txBody.getElementsByTagName("a:p");
          for (let p of pNodes) {
            const tNodes = p.getElementsByTagName("a:t");
            let text = "";
            for (let t of tNodes) {
              text += t.textContent;
            }
            if (text.trim() !== "") {
              paragraphs.push(text.trim());
            }
          }
        }
      }
      
      const images = [];
      const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
      if (zip.file(relsPath)) {
        const relsXmlStr = await zip.file(relsPath).async("string");
        const relsDoc = new DOMParser().parseFromString(relsXmlStr, "text/xml");
        const relNodes = relsDoc.getElementsByTagName("Relationship");
        
        const picNodes = xmlDoc.getElementsByTagName("p:pic");
        for (let pic of picNodes) {
          const blip = pic.getElementsByTagName("a:blip")[0];
          if (blip) {
            const embedId = blip.getAttribute("r:embed");
            const relNode = Array.from(relNodes).find(r => r.getAttribute("Id") === embedId);
            if (relNode) {
              const target = relNode.getAttribute("Target");
              const mediaPath = target.replace(/^\.\.\//, "ppt/");
              if (zip.file(mediaPath)) {
                const imgBytes = await zip.file(mediaPath).async("uint8array");
                const ext = mediaPath.split(".").pop().toLowerCase();
                images.push({ bytes: imgBytes, ext: ext });
              }
            }
          }
        }
      }
      
      const page = pdfDoc.addPage([slideWidth, slideHeight]);
      
      // Draw background
      page.drawRectangle({
        x: 0,
        y: 0,
        width: slideWidth,
        height: slideHeight,
        color: PDFLib.rgb(15 / 255, 23 / 255, 42 / 255)
      });
      
      // Draw PPT Orange base line
      page.drawRectangle({
        x: 0,
        y: 0,
        width: slideWidth,
        height: 6,
        color: PDFLib.rgb(210 / 255, 71 / 255, 38 / 255)
      });
      
      const titleText = paragraphs[0] || `Slide ${i + 1}`;
      const bulletTexts = paragraphs.slice(1);
      
      // Title
      const titleFontSize = Math.min(26, Math.max(16, Math.round(slideWidth * 0.035)));
      page.drawText(titleText, {
        x: 40,
        y: slideHeight - 50,
        size: titleFontSize,
        font: fontHelveticaBold,
        color: PDFLib.rgb(1, 1, 1),
        maxWidth: slideWidth - 80,
        lineHeight: titleFontSize * 1.2
      });
      
      // Layout
      if (images.length > 0) {
        // Split layout: Text left, Image right
        const leftColWidth = (slideWidth - 100) * 0.5;
        const rightColWidth = (slideWidth - 100) * 0.5;
        
        let currentY = slideHeight - 100;
        const bulletFontSize = Math.min(14, Math.max(10, Math.round(slideWidth * 0.02)));
        
        bulletTexts.slice(0, 5).forEach(b => {
          const textToDraw = b.startsWith("•") || b.startsWith("-") ? b : `• ${b}`;
          page.drawText(textToDraw, {
            x: 40,
            y: currentY,
            size: bulletFontSize,
            font: fontHelvetica,
            color: PDFLib.rgb(203 / 255, 213 / 255, 225 / 255),
            maxWidth: leftColWidth,
            lineHeight: bulletFontSize * 1.3
          });
          currentY -= Math.max(bulletFontSize * 2.8, 30);
        });
        
        try {
          const imgObj = images[0];
          let embeddedImg;
          if (imgObj.ext === "png") {
            embeddedImg = await pdfDoc.embedPng(imgObj.bytes);
          } else if (imgObj.ext === "jpg" || imgObj.ext === "jpeg") {
            embeddedImg = await pdfDoc.embedJpg(imgObj.bytes);
          }
          
          if (embeddedImg) {
            const imgWidth = embeddedImg.width;
            const imgHeight = embeddedImg.height;
            const maxImgWidth = rightColWidth;
            const maxImgHeight = slideHeight - 120;
            
            const scale = Math.min(maxImgWidth / imgWidth, maxImgHeight / imgHeight);
            const drawW = imgWidth * scale;
            const drawH = imgHeight * scale;
            
            const drawX = slideWidth - 40 - rightColWidth + (rightColWidth - drawW) * 0.5;
            const drawY = 30 + (maxImgHeight - drawH) * 0.5;
            
            page.drawImage(embeddedImg, {
              x: drawX,
              y: drawY,
              width: drawW,
              height: drawH
            });
          }
        } catch (err) {
          console.warn("Failed to embed slide image:", err);
        }
      } else {
        // Full width text layout
        let currentY = slideHeight - 100;
        const bulletFontSize = Math.min(15, Math.max(11, Math.round(slideWidth * 0.022)));
        
        bulletTexts.slice(0, 7).forEach(b => {
          const textToDraw = b.startsWith("•") || b.startsWith("-") ? b : `• ${b}`;
          page.drawText(textToDraw, {
            x: 50,
            y: currentY,
            size: bulletFontSize,
            font: fontHelvetica,
            color: PDFLib.rgb(203 / 255, 213 / 255, 225 / 255),
            maxWidth: slideWidth - 100,
            lineHeight: bulletFontSize * 1.4
          });
          currentY -= Math.max(bulletFontSize * 2.2, 25);
        });
      }
    }
    
    if (progressCallback) {
      progressCallback(95, "Compiling PDF document...");
    }
    
    return await pdfDoc.save();
  }

  function setPptProgress(percentage, statusText) {
    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}%`;
    progressText.textContent = statusText;
  }

  function clearPptBlob() {
    appState.ppt.convertedFiles.forEach(f => {
      if (f.url) URL.revokeObjectURL(f.url);
    });
    appState.ppt.convertedFiles = [];

    if (appState.ppt.zipBlobUrl) {
      URL.revokeObjectURL(appState.ppt.zipBlobUrl);
      appState.ppt.zipBlobUrl = null;
      appState.ppt.zipBlob = null;
    }
  }

  function clearPptWorkspace() {
    appState.ppt.files = [];
    clearPptBlob();
    renderPptWorkspace();
  }
}
