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

function normalizeItemCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, idx) => obj[h] = values[idx] ?? '');
    return {
      item_code: normalizeItemCode(obj.item_code),
      qty: Number(obj.qty),
      price_per_item: Number(obj.price_per_item),
    };
  }).filter(r => r.item_code && Number.isFinite(r.qty) && Number.isFinite(r.price_per_item));
}

function extractTextFromPdfBytes(arrayBuffer) {
  // Conservative text extraction: keep likely human-readable chunks and remove PDF internals.
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

  const rawChunks = binary.match(/\((?:\\.|[^\\)])*\)/g) || [];
  const internals = /^(TYPE|FONT|TOUNICODE|CONTENTS|CROPBOX|MEDIABOX|PARENT|RESOURCES|IMAGE\d*|REGISTRY|ORDERING|FONTBBOX|FONTFILE\d*|STEMV)$/i;

  const cleaned = rawChunks
    .map(chunk => chunk.slice(1, -1)
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .trim())
    .filter(Boolean)
    .filter(chunk => chunk.length >= 3)
    .filter(chunk => !internals.test(chunk))
    .filter(chunk => {
      // Keep chunks that look like business text, not random 3-char blobs.
      const hasLetters = /[A-Za-z]/.test(chunk);
      const hasWord = /\s/.test(chunk) || /\d/.test(chunk);
      const tooNoisy = /^[^A-Za-z0-9]+$/.test(chunk);
      return hasLetters && hasWord && !tooNoisy;
    });

  return cleaned.join('\n');
}

function extractCoreFields(text) {
  const t = text || '';
  const poNo = t.match(/\b(?:PO\s*(?:#|NO\.?|NUMBER)\s*[:\-]?\s*)([A-Z0-9\-\/]+)/i)?.[1] || null;
  const paymentTerms = t.match(/\b(?:PAYMENT\s*TERMS?|TERMS)\s*[:\-]?\s*([^\n]{2,50})/i)?.[1]?.trim() || null;
  const totalCost = t.match(/\b(?:TOTAL|GRAND\s*TOTAL|AMOUNT\s*DUE)\s*[:\-]?\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i)?.[1] || null;
  return { poNo, paymentTerms, totalCost };
}

function parseRowsFromPdfText(text) {
  // Strict parser: only accept lines that look like row data with item + qty + price.
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const hasTableHints = lines.some(l => /item|part/i.test(l)) && lines.some(l => /qty|quantity/i.test(l)) && lines.some(l => /price|rate/i.test(l));
  if (!hasTableHints) return [];

  const rows = [];
  const rowPattern = /^([A-Z0-9][A-Z0-9\-_]{3,})\s+.+?\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)/i;

  for (const line of lines) {
    const m = line.match(rowPattern);
    if (!m) continue;

    const item = normalizeItemCode(m[1]);
    const qty = Number(m[2]);
    const price = Number(m[3]);

    if (!item || item.length < 4) continue;
    if (!/[A-Z]/.test(item) || !/\d/.test(item)) continue; // avoid random text tokens
    if (!Number.isFinite(qty) || !Number.isFinite(price)) continue;

    rows.push({ item_code: item, qty, price_per_item: price });
  }

  return rows;
}

async function parseRowsFromFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv')) {
    const text = await readTextFile(file);
    const rows = parseCsv(text);
    const coreFields = extractCoreFields(text);
    return { rows, mode: 'csv', warning: null, coreFields };
  }

  if (name.endsWith('.pdf')) {
    const buffer = await readArrayBuffer(file);
    const text = extractTextFromPdfBytes(buffer);
    const rows = parseRowsFromPdfText(text);
    const coreFields = extractCoreFields(text);

    if (!rows.length) {
      return {
        rows: [],
        mode: 'pdf',
        warning: 'Could not reliably extract line rows from this PDF. Please use CSV export for comparison.',
        coreFields,
      };
    }

    return {
      rows,
      mode: 'pdf',
      warning: 'PDF parsed in strict mode (core-field + row pattern checks). Please review results.',
      coreFields,
    };
  }

  return { rows: [], mode: 'unsupported', warning: `Unsupported file type for parsing: ${file.name}`, coreFields: { poNo: null, paymentTerms: null, totalCost: null } };
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
  const piByItem = Object.fromEntries(piRows.map(r => [normalizeItemCode(r.item_code), r]));
  const mismatches = [];
  let needsManual = false;

  poRows.forEach(po => {
    const pi = piByItem[normalizeItemCode(po.item_code)];
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

    if (po.price_per_item !== pi.price_per_item) {
      const pVar = pctDiff(po.price_per_item, pi.price_per_item);
      mismatches.push({ item: po.item_code, field: 'Price per item', po: po.price_per_item, pi: pi.price_per_item, variance: `${pVar.toFixed(1)}%` });
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
  dropzoneEl.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') inputEl.click(); });
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
    if (files?.length) setSelectedFiles(kind, files);
  });
}

function clearLoadedFiles() {
  poFiles = [];
  piFiles = [];
  poFileInput.value = '';
  piFileInput.value = '';
  poFileList.textContent = 'No files selected.';
  piFileList.textContent = 'No files selected.';
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

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
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
    { check: 'PO required fields', status: 'PASS', className: 'pass', note: 'item_code, qty, price_per_item present (sample)' },
    { check: 'PI required fields', status: 'PASS', className: 'pass', note: 'item_code, qty, price_per_item present (sample)' },
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

  const [poParsed, piParsed] = await Promise.all([parseRowsFromFile(poFile), parseRowsFromFile(piFile)]);

  if (!poParsed.rows.length || !piParsed.rows.length) {
    renderMismatches([]);
    renderSummary([
      { check: 'PO required fields', status: poParsed.rows.length ? 'PASS' : 'FAIL', className: poParsed.rows.length ? 'pass' : 'fail', note: poParsed.rows.length ? 'Line rows extracted' : (poParsed.warning || 'Missing required fields') },
      { check: 'PI required fields', status: piParsed.rows.length ? 'PASS' : 'FAIL', className: piParsed.rows.length ? 'pass' : 'fail', note: piParsed.rows.length ? 'Line rows extracted' : (piParsed.warning || 'Missing required fields') },
      { check: 'Overall', status: 'BLOCKED', className: 'fail', note: 'Comparison blocked until required core fields can be extracted from both files.' },
    ]);
    finalStatus.textContent = [poParsed.warning, piParsed.warning].filter(Boolean).join(' | ') || 'Could not parse uploaded files.';
    return;
  }

  const result = compare(poParsed.rows, piParsed.rows);
  compareState = {
    ...result,
    piFilenameBase: (piFile.name || 'PI').replace(/\.(csv|pdf|xls|xlsx)$/i, ''),
  };

  const poCore = poParsed.coreFields || {};
  const piCore = piParsed.coreFields || {};
  const coreNotes = [];
  if (poCore.poNo && piCore.poNo) coreNotes.push(`PO#: ${poCore.poNo} vs ${piCore.poNo}`);
  if (poCore.paymentTerms || piCore.paymentTerms) coreNotes.push(`Terms: ${poCore.paymentTerms || 'n/a'} vs ${piCore.paymentTerms || 'n/a'}`);
  if (poCore.totalCost || piCore.totalCost) coreNotes.push(`Totals: ${poCore.totalCost || 'n/a'} vs ${piCore.totalCost || 'n/a'}`);

  renderSummary([
    { check: 'PO required fields', status: 'PASS', className: 'pass', note: `${poParsed.rows.length} line(s) from ${poFile.name} [${poParsed.mode}]` },
    { check: 'PI required fields', status: 'PASS', className: 'pass', note: `${piParsed.rows.length} line(s) from ${piFile.name} [${piParsed.mode}]` },
    { check: 'Core header checks', status: coreNotes.length ? 'INFO' : 'WARN', className: coreNotes.length ? 'pass' : 'warn', note: coreNotes.join(' | ') || 'PO#/terms/total not confidently extracted from one or both files.' },
    { check: 'Qty tolerance (5%)', status: result.needsManual ? 'MANUAL' : 'PASS', className: result.needsManual ? 'fail' : 'pass', note: result.needsManual ? 'Variance above tolerance found' : 'Within tolerance' },
    { check: 'Overall', status: result.passed ? 'PASS' : 'REVIEW', className: result.passed ? 'pass' : 'warn', note: result.passed ? 'Auto-sign ready' : 'Manual check required' },
    { check: 'Parser notes', status: (poParsed.warning || piParsed.warning) ? 'INFO' : 'PASS', className: (poParsed.warning || piParsed.warning) ? 'warn' : 'pass', note: [poParsed.warning, piParsed.warning].filter(Boolean).join(' | ') || 'No parser warnings.' },
  ]);

  renderMismatches(result.mismatches.slice(0, 200));
  if (result.mismatches.length > 200) {
    finalStatus.textContent = `Comparison complete. Showing first 200 mismatches out of ${result.mismatches.length}. Please verify source extraction.`;
  } else {
    finalStatus.textContent = `Comparison complete (using first files in each list). PO files: ${poFiles.length}, PI files: ${piFiles.length}.`;
  }
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
    'Status: Approved',
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
  finalStatus.textContent = `Signed PDF downloaded: ${a.download}. Uploaded PO/PI files were cleared from session.`;
  clearLoadedFiles();
});
