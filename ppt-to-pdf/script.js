const appState = {
  ppt: {
    files: [],
    convertedFiles: [],
    zipBlob: null,
    zipBlobUrl: null
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initPPTToPDFTool();
});

// Namespace-safe XML tag finder — works in all browsers regardless of
// how DOMParser handles the "p:", "a:", "r:" namespace prefixes.
function xmlFind(parent, localName) {
  // Try namespace-aware first
  let nodes = parent.getElementsByTagNameNS('*', localName);
  if (nodes.length > 0) return Array.from(nodes);
  // Fallback: try with common OOXML prefixes
  const prefixes = ['p', 'a', 'r', 'c', 'mc', 'wp', 'dgm'];
  for (const pfx of prefixes) {
    nodes = parent.getElementsByTagName(`${pfx}:${localName}`);
    if (nodes.length > 0) return Array.from(nodes);
  }
  // Last resort: plain tag name
  nodes = parent.getElementsByTagName(localName);
  return Array.from(nodes);
}

function xmlFindFirst(parent, localName) {
  const arr = xmlFind(parent, localName);
  return arr.length > 0 ? arr[0] : null;
}

function xmlAttr(el, localName) {
  if (!el) return null;
  // Try plain attribute first
  let val = el.getAttribute(localName);
  if (val !== null) return val;
  // Try with namespace prefix variants
  const parts = localName.split(':');
  if (parts.length === 2) {
    val = el.getAttributeNS('*', parts[1]);
    if (val !== null) return val;
    // Try without prefix
    val = el.getAttribute(parts[1]);
  }
  return val;
}

function initPPTToPDFTool() {
  const dropZone = document.getElementById('ppt-drop-zone');
  const fileInput = document.getElementById('ppt-file-input');
  const workspace = document.getElementById('ppt-workspace');
  const fileListEl = document.getElementById('ppt-file-list');
  const clearBtn = document.getElementById('ppt-clear-btn');
  const executeBtn = document.getElementById('ppt-execute-btn');
  
  const progressOverlay = document.getElementById('ppt-progress');
  const progressBar = document.getElementById('ppt-progress-bar');
  const progressText = document.getElementById('ppt-progress-text');
  const progressPercent = document.getElementById('ppt-progress-percent');
  
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
      dropZone.style.display = 'flex';
      return;
    }
    workspace.style.display = 'flex';
    dropZone.style.display = 'none';
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

      progressOverlay.style.display = 'none';
      successOverlay.style.display = 'flex';

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

  // Parse slides using namespace-safe XML queries and draw pages in PDF-Lib
  async function convertPptxToPdf(file, progressCallback) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    const slidePaths = Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/i.test(path));
    
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
    let slideHeight = 405;
    
    try {
      const presXmlStr = await zip.file("ppt/presentation.xml").async("string");
      const presDoc = new DOMParser().parseFromString(presXmlStr, "text/xml");
      const sldSzNode = xmlFindFirst(presDoc, "sldSz");
      if (sldSzNode) {
        const cx = parseInt(sldSzNode.getAttribute("cx"), 10);
        const cy = parseInt(sldSzNode.getAttribute("cy"), 10);
        if (cx && cy) {
          slideWidth = Math.round(cx / 12700);
          slideHeight = Math.round(cy / 12700);
        }
      }
    } catch (e) {
      console.warn("Could not read slide size, defaulting to 16:9.", e);
    }

    for (let i = 0; i < slidePaths.length; i++) {
      const slidePath = slidePaths[i];
      const slideNum = parseInt(slidePath.match(/\d+/)[0], 10);
      
      if (progressCallback) {
        progressCallback(Math.round((i / slidePaths.length) * 90), `Rendering Slide ${i + 1} of ${slidePaths.length}...`);
      }
      
      const xmlStr = await zip.file(slidePath).async("string");
      const xmlDoc = new DOMParser().parseFromString(xmlStr, "text/xml");
      
      // Extract all text paragraphs from shape text bodies
      const paragraphs = [];
      const spNodes = xmlFind(xmlDoc, "sp");
      for (const sp of spNodes) {
        const txBody = xmlFindFirst(sp, "txBody");
        if (txBody) {
          const pNodes = xmlFind(txBody, "p");
          for (const p of pNodes) {
            const tNodes = xmlFind(p, "t");
            let text = "";
            for (const t of tNodes) {
              text += t.textContent;
            }
            if (text.trim() !== "") {
              paragraphs.push(text.trim());
            }
          }
        }
      }
      
      // Extract embedded images
      const images = [];
      const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
      if (zip.file(relsPath)) {
        try {
          const relsXmlStr = await zip.file(relsPath).async("string");
          const relsDoc = new DOMParser().parseFromString(relsXmlStr, "text/xml");
          const relNodes = xmlFind(relsDoc, "Relationship");
          
          const picNodes = xmlFind(xmlDoc, "pic");
          for (const pic of picNodes) {
            const blip = xmlFindFirst(pic, "blip");
            if (blip) {
              const embedId = blip.getAttribute("r:embed") || blip.getAttribute("embed");
              if (embedId) {
                const relNode = relNodes.find(r => r.getAttribute("Id") === embedId);
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
        } catch (relErr) {
          console.warn("Failed to parse slide rels:", relErr);
        }
      }
      
      const page = pdfDoc.addPage([slideWidth, slideHeight]);
      
      // Draw background
      page.drawRectangle({
        x: 0, y: 0,
        width: slideWidth, height: slideHeight,
        color: PDFLib.rgb(15 / 255, 23 / 255, 42 / 255)
      });
      
      // Draw orange accent bar
      page.drawRectangle({
        x: 0, y: 0,
        width: slideWidth, height: 6,
        color: PDFLib.rgb(210 / 255, 71 / 255, 38 / 255)
      });
      
      const titleText = paragraphs[0] || `Slide ${i + 1}`;
      const bulletTexts = paragraphs.slice(1);
      
      const titleFontSize = Math.min(26, Math.max(16, Math.round(slideWidth * 0.035)));
      page.drawText(titleText, {
        x: 40, y: slideHeight - 50,
        size: titleFontSize,
        font: fontHelveticaBold,
        color: PDFLib.rgb(1, 1, 1),
        maxWidth: slideWidth - 80,
        lineHeight: titleFontSize * 1.2
      });
      
      if (images.length > 0) {
        const leftColWidth = (slideWidth - 100) * 0.5;
        const rightColWidth = (slideWidth - 100) * 0.5;
        
        let currentY = slideHeight - 100;
        const bulletFontSize = Math.min(14, Math.max(10, Math.round(slideWidth * 0.02)));
        
        bulletTexts.slice(0, 5).forEach(b => {
          const textToDraw = b.startsWith("•") || b.startsWith("-") ? b : `• ${b}`;
          page.drawText(textToDraw, {
            x: 40, y: currentY,
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
            const maxImgWidth = rightColWidth;
            const maxImgHeight = slideHeight - 120;
            const scale = Math.min(maxImgWidth / embeddedImg.width, maxImgHeight / embeddedImg.height);
            const drawW = embeddedImg.width * scale;
            const drawH = embeddedImg.height * scale;
            const drawX = slideWidth - 40 - rightColWidth + (rightColWidth - drawW) * 0.5;
            const drawY = 30 + (maxImgHeight - drawH) * 0.5;
            
            page.drawImage(embeddedImg, { x: drawX, y: drawY, width: drawW, height: drawH });
          }
        } catch (err) {
          console.warn("Failed to embed slide image:", err);
        }
      } else {
        let currentY = slideHeight - 100;
        const bulletFontSize = Math.min(15, Math.max(11, Math.round(slideWidth * 0.022)));
        
        bulletTexts.slice(0, 7).forEach(b => {
          const textToDraw = b.startsWith("•") || b.startsWith("-") ? b : `• ${b}`;
          page.drawText(textToDraw, {
            x: 50, y: currentY,
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
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
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
