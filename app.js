// local-only prototype guard
window.fetch = () => Promise.reject(new Error('Network disabled in local-only mode'));
window.XMLHttpRequest = class { open() { throw new Error('Network disabled'); } send() { throw new Error('Network disabled'); } };
window.WebSocket = class { constructor() { throw new Error('Network disabled'); } };

const poFileInput = document.getElementById('poFile');
const piFileInput = document.getElementById('piFile');
const poDropzone = document.getElementById('poDropzone');
const piDropzone = document.getElementById('piDropzone');
const poBrowse = document.getElementById('poBrowse');
const piBrowse = document.getElementById('piBrowse');
const poFileList = document.getElementById('poFileList');
const piFileList = document.getElementById('piFileList');
const summaryBody = document.getElementById('summaryBody');
const mismatchBody = document.getElementById('mismatchBody');
const finalStatus = document.getElementById('finalStatus');

let poFiles = [];
let piFiles = [];
let compareState = { passed: false, needsManual: false, piFilenameBase: 'PI-result' };

const SAMPLE_PO = `item_code,qty,price_per_item\nWCFRKIW,100,1.24\nABC001,300,0.95`;
const SAMPLE_PI = `item_code,qty,price_per_item\nWCFRKIW,200,1.39\nABC001,300,0.95`;

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, idx) => obj[h] = values[idx] ?? '');
    return {
      item_code: obj.item_code,
      qty: Number(obj.qty),
      price_per_item: Number(obj.price_per_item),
    };
  }).filter(r => r.item_code);
}

function pctDiff(a, b) {
  if (!a && !b) return 0;
  if (!a) return 100;
  return ((b - a) / a) * 100;
}

function renderSummary(rows) {
  summaryBody.innerHTML = rows.map(r => `<tr><td>${r.check}</td><td class="${r.className}">${r.status}</td><td>${r.note}</td></tr>`).join('');
}

function renderMismatches(rows) {
  if (!rows.length) {
    mismatchBody.innerHTML = '<tr><td colspan="5" class="pass">No mismatches found.</td></tr>';
    return;
  }
  mismatchBody.innerHTML = rows.map(r => `<tr><td>${r.item}</td><td>${r.field}</td><td>${r.po}</td><td class="fail">${r.pi}</td><td class="fail">${r.variance}</td></tr>`).join('');
}

function compare(poRows, piRows) {
  const piByItem = Object.fromEntries(piRows.map(r => [r.item_code, r]));
  const mismatches = [];
  let needsManual = false;

  poRows.forEach(po => {
    const pi = piByItem[po.item_code];
    if (!pi) {
      mismatches.push({ item: po.item_code, field: 'Missing on PI', po: 'Exists', pi: 'Missing', variance: 'N/A' });
      needsManual = true;
      return;
    }

    const qtyVar = pctDiff(po.qty, pi.qty);
    if (Math.abs(qtyVar) > 5) {
      mismatches.push({ item: po.item_code, field: 'Qty', po: po.qty, pi: pi.qty, variance: `${qtyVar.toFixed(1)}%` });
      needsManual = true;
    }

    const poPrice = po.price_per_item;
    const piPrice = pi.price_per_item;
    if (poPrice !== piPrice) {
      const pVar = pctDiff(poPrice, piPrice);
      mismatches.push({ item: po.item_code, field: 'Price per item', po: poPrice, pi: piPrice, variance: `${pVar.toFixed(1)}%` });
    }
  });

  return { mismatches, needsManual, passed: mismatches.length === 0 };
}

function setSelectedFiles(kind, files) {
  const cleanFiles = Array.from(files || []);
  if (kind === 'po') {
    poFiles = cleanFiles;
    poFileList.textContent = poFiles.length ? poFiles.map(f => f.name).join(', ') : 'No files selected.';
  } else {
    piFiles = cleanFiles;
    piFileList.textContent = piFiles.length ? piFiles.map(f => f.name).join(', ') : 'No files selected.';
  }
}

function setupDropzone(kind, dropzoneEl, inputEl, browseEl) {
  browseEl.addEventListener('click', () => inputEl.click());
  dropzoneEl.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') inputEl.click();
  });
  dropzoneEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputEl.click();
    }
  });

  inputEl.addEventListener('change', () => setSelectedFiles(kind, inputEl.files));

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzoneEl.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropzoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzoneEl.classList.remove('dragging');
    });
  });

  dropzoneEl.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files?.length) {
      setSelectedFiles(kind, files);
    }
  });
}

function buildSimplePdfBytes(lines) {
  const safeLines = lines.map(line => String(line).replace(/[()\\]/g, '\\$&'));
  let stream = 'BT\n/F1 12 Tf\n50 790 Td\n';
  safeLines.forEach((line, idx) => {
    if (idx > 0) stream += '0 -18 Td\n';
    stream += `(${line}) Tj\n`;
  });
  stream += 'ET';

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

async function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

setupDropzone('po', poDropzone, poFileInput, poBrowse);
setupDropzone('pi', piDropzone, piFileInput, piBrowse);

document.getElementById('loadSample').addEventListener('click', () => {
  const poRows = parseCsv(SAMPLE_PO);
  const piRows = parseCsv(SAMPLE_PI);
  const result = compare(poRows, piRows);
  compareState = { ...result, piFilenameBase: 'PI-sample' };

  renderSummary([
    { check: 'PO file parsed', status: 'PASS', className: 'pass', note: `${poRows.length} line(s)` },
    { check: 'PI file parsed', status: 'PASS', className: 'pass', note: `${piRows.length} line(s)` },
    { check: 'Qty tolerance (5%)', status: result.needsManual ? 'MANUAL' : 'PASS', className: result.needsManual ? 'fail' : 'pass', note: result.needsManual ? 'Variance above tolerance found' : 'Within tolerance' },
    { check: 'Overall', status: result.passed ? 'PASS' : 'REVIEW', className: result.passed ? 'pass' : 'warn', note: result.passed ? 'Auto-sign ready' : 'Manual check required' },
  ]);
  renderMismatches(result.mismatches);
  finalStatus.textContent = 'Comparison loaded from sample data.';
});

document.getElementById('runCompare').addEventListener('click', async () => {
  const poFile = poFiles[0];
  const piFile = piFiles[0];
  if (!poFile || !piFile) {
    finalStatus.textContent = 'Please upload at least one PO and one PI file.';
    return;
  }
  if (!poFile.name.toLowerCase().endsWith('.csv') || !piFile.name.toLowerCase().endsWith('.csv')) {
    finalStatus.textContent = 'Current compare engine supports CSV parsing for now. Please choose CSV for both files.';
    return;
  }

  const [poText, piText] = await Promise.all([readFile(poFile), readFile(piFile)]);
  const poRows = parseCsv(poText);
  const piRows = parseCsv(piText);
  const result = compare(poRows, piRows);

  compareState = {
    ...result,
    piFilenameBase: (piFile.name || 'PI').replace(/\.csv$/i, '').replace(/\.pdf$/i, ''),
  };

  renderSummary([
    { check: 'PO file parsed', status: 'PASS', className: 'pass', note: `${poRows.length} line(s) from ${poFile.name}` },
    { check: 'PI file parsed', status: 'PASS', className: 'pass', note: `${piRows.length} line(s) from ${piFile.name}` },
    { check: 'Qty tolerance (5%)', status: result.needsManual ? 'MANUAL' : 'PASS', className: result.needsManual ? 'fail' : 'pass', note: result.needsManual ? 'Variance above tolerance found' : 'Within tolerance' },
    { check: 'Overall', status: result.passed ? 'PASS' : 'REVIEW', className: result.passed ? 'pass' : 'warn', note: result.passed ? 'Auto-sign ready' : 'Manual check required' },
  ]);

  renderMismatches(result.mismatches);
  finalStatus.textContent = `Comparison complete (using first files in each list). PO files: ${poFiles.length}, PI files: ${piFiles.length}.`;
});

document.getElementById('finalize').addEventListener('click', () => {
  if (compareState.passed) {
    finalStatus.textContent = 'Passed checks. Auto-sign is ready.';
    return;
  }
  const manualOverride = document.getElementById('manualOverride').checked;
  const confirmReview = document.getElementById('confirmReview').checked;
  if (manualOverride && confirmReview) {
    finalStatus.textContent = 'Manual override accepted. Confirmed OK for signing.';
    compareState.passed = true;
  } else {
    finalStatus.textContent = 'Manual checks incomplete. Please confirm both checkboxes.';
  }
});

document.getElementById('downloadSignedPi').addEventListener('click', () => {
  if (!compareState.passed) {
    finalStatus.textContent = 'Cannot download signed PI until checks pass or manual override is approved.';
    return;
  }

  const lines = [
    'Signed Proforma Invoice',
    `File: ${compareState.piFilenameBase}`,
    `Status: Approved`,
    `Signed On: ${new Date().toISOString()}`,
    'Signature Type: Typed confirmation',
  ];
  const pdfBytes = buildSimplePdfBytes(lines);
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${compareState.piFilenameBase}-signed.pdf`;
  a.click();
  URL.revokeObjectURL(url);
  finalStatus.textContent = `Signed PDF downloaded: ${a.download}`;
});
