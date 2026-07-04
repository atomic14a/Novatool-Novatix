// Configure PDF.js Worker path to resolve initialization and parsing errors
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const appState = {
  word: {
    files: [], // Array of: { id, file, name, size }
    convertedFiles: [], // Array of: { name, originalSize, docBlob, url }
    zipBlob: null,
    zipBlobUrl: null
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initPDFToWordTool();
});

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
      dropZone.style.display = 'flex';
      return;
    }
    workspace.style.display = 'flex';
    dropZone.style.display = 'none';
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
    setWordProgress(0, 'Initializing PDF parser engine...');
    await sleep(200);

    appState.word.convertedFiles = [];

    try {
      for (let i = 0; i < appState.word.files.length; i++) {
        const item = appState.word.files[i];
        setWordProgress(
          5 + Math.round((i / appState.word.files.length) * 80),
          `Converting PDF (${i + 1}/${appState.word.files.length}): ${escapeHtml(item.name)}`
        );

        // Convert page text layers
        const docHtml = await parsePdfToDoc(item.file, (perc, txt) => {
          const stepBase = 5 + Math.round((i / appState.word.files.length) * 80);
          const stepWeight = Math.round(80 / appState.word.files.length);
          const currentPerc = stepBase + Math.round((perc / 100) * stepWeight);
          setWordProgress(currentPerc, `File ${i + 1}/${appState.word.files.length}: ${txt}`);
        });
        
        // Wrap output HTML inside Microsoft Office XML binary standard for editable DOCs
        const outputBytes = new TextEncoder().encode(docHtml);
        const docBlob = new Blob([outputBytes], { type: 'application/msword' });
        const url = URL.createObjectURL(docBlob);

        let outputName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
        outputName += '.doc';

        appState.word.convertedFiles.push({
          name: outputName,
          originalSize: item.size,
          docBlob: docBlob,
          url: url
        });

        await sleep(150);
      }

      setWordProgress(90, 'Preparing final document packages...');
      await sleep(200);

      // Package multiple files into a single ZIP
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

      // Transition to success screen
      progressOverlay.style.display = 'none';
      successOverlay.style.display = 'flex';

      // Update success details card
      if (appState.word.convertedFiles.length > 1) {
        document.getElementById('word-download-name').textContent = 'converted-documents.zip';
        document.getElementById('word-download-size').textContent = formatBytes(appState.word.zipBlob.size);
        successDownloadBtn.innerHTML = '<i class="ti ti-file-zip"></i> Download Converted ZIP';
      } else {
        const targetFile = appState.word.convertedFiles[0];
        document.getElementById('word-download-name').textContent = targetFile.name;
        document.getElementById('word-download-size').textContent = formatBytes(targetFile.docBlob.size);
        successDownloadBtn.innerHTML = '<i class="ti ti-download"></i> Download Word File';
      }

      showToast('PDF(s) converted to Word successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Conversion failed: ' + err.message, 'danger');
      progressOverlay.style.display = 'none';
      workspace.style.display = 'flex';
    }
  }

  // Parse text runs using PDFJS and group them by coordinate boundaries
  async function parsePdfToDoc(file, progressCallback) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;

    let docBodyHtml = "";

    for (let pIdx = 1; pIdx <= totalPages; pIdx++) {
      if (progressCallback) {
        progressCallback(Math.round((pIdx / totalPages) * 90), `Parsing page ${pIdx} text runs...`);
      }

      const page = await pdf.getPage(pIdx);
      const textContent = await page.getTextContent();
      const items = textContent.items;

      if (items.length === 0) {
        docBodyHtml += `<p style="margin-bottom:12pt;page-break-after:always;"></p>`;
        continue;
      }

      // Group text items by their vertical position (Y coordinate in transform matrix)
      // transform matrix: transform[5] is Y-translation (vertical offset from page bottom)
      const rows = {};
      items.forEach(item => {
        const text = item.str;
        const matrix = item.transform;
        const y = Math.round(matrix[5] * 2) / 2; // Round Y offset to 0.5pt to capture same-line texts
        const x = matrix[4];

        if (!rows[y]) {
          rows[y] = [];
        }
        rows[y].push({ x: x, text: text, height: item.height });
      });

      // Sort rows vertically (descending order from page top)
      const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a);

      let pageParagraphs = [];
      let currentParagraph = [];
      let lastY = null;

      sortedY.forEach(y => {
        // Sort items inside this row horizontally (left to right)
        const rowItems = rows[y].sort((a, b) => a.x - b.x);
        
        // Assemble row text
        let rowText = "";
        let lastX = null;

        rowItems.forEach(item => {
          if (lastX !== null && item.x - lastX > 18) {
            // Add spacer gaps if distance between words is large
            rowText += "  ";
          }
          rowText += item.text;
          lastX = item.x + (item.text.length * 5); // Rough character width approximation
        });

        const cleanText = rowText.trim();
        if (cleanText === "") return;

        // Group rows into paragraphs if vertical gap is small
        if (lastY !== null && Math.abs(lastY - y) > 28) {
          if (currentParagraph.length > 0) {
            pageParagraphs.push(currentParagraph.join(" "));
            currentParagraph = [];
          }
        }

        currentParagraph.push(cleanText);
        lastY = y;
      });

      if (currentParagraph.length > 0) {
        pageParagraphs.push(currentParagraph.join(" "));
      }

      // Append page paragraphs to document body HTML
      pageParagraphs.forEach((p, idx) => {
        const isLast = idx === pageParagraphs.length - 1;
        const style = isLast ? 'margin-bottom:12pt;page-break-after:always;' : 'margin-bottom:12pt;';
        docBodyHtml += `<p style="${style}font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.25;color:#000000;text-align:justify;">${escapeHtml(p)}</p>`;
      });
    }

    // Build Microsoft Word HTML Structure
    const docHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>Word Export</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Normal</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: 8.5in 11.0in; /* US Letter standard size */
            margin: 1.0in 1.0in 1.0in 1.0in; /* Standard margins */
          }
          body {
            font-family: 'Calibri', 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.25;
          }
        </style>
      </head>
      <body>
        ${docBodyHtml}
      </body>
      </html>
    `;

    return docHtml;
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
