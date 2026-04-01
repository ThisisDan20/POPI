// PO ↔ PI Checker — app.js v3.0
// Parsing: Claude API (Haiku) reads PDFs — no regex fragility
// Comparison, signing, quiz: all local

// ─── pdf-lib setup (signing only — no pdf.js needed) ─────────────────────────
// PDFLib loaded via <script> tag in index.html

// ─── Company / signer data ────────────────────────────────────────────────────
const COMPANIES = {
  'Huhtamaki Henderson Ltd': [
    'Supply Chain Manager',
    'Procurement Manager',
    'Finance Manager',
    'General Manager',
  ],
  'Huhtamaki Australia Pty Ltd': [
    'Purchasing Manager',
    'Supply Chain Director',
    'Finance Director',
    'General Manager',
  ],
  'Huhtamaki Foodservice Packaging, Oceania': [
    'Commercial Manager',
    'Procurement Lead',
    'Supply Chain Manager',
    'Finance Manager',
  ],
};

// ─── App state ────────────────────────────────────────────────────────────────
let poFiles = [];
let piFiles = [];
let itemsRef = [];
let apiKey = '';
let compareState = {
  passed: false,
  needsManual: false,
  piFilenameBase: '',
  poDoc: null,
  piDoc: null,
};

// Compliance quiz state
let _uploadCounter = 0;
let _quizThreshold = Math.floor(Math.random() * 3) + 10;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const poDropzone  = document.getElementById('poDropzone');
const piDropzone  = document.getElementById('piDropzone');
const poFileInput = document.getElementById('poFile');
const piFileInput = document.getElementById('piFile');
const poFileList  = document.getElementById('poFileList');
const piFileList  = document.getElementById('piFileList');
const summaryBody = document.getElementById('summaryBody');
const mismatchBody = document.getElementById('mismatchBody');
const finalStatus = document.getElementById('finalStatus');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiKeyStatus = document.getElementById('apiKeyStatus');

// ─── Utility ──────────────────────────────────────────────────────────────────
function pct(a, b) {
  if (!a && !b) return 0;
  if (!a) return 100;
  return ((b - a) / a) * 100;
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[\s\-\/]+/g, ' ').trim();
}

async function readBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('File read failed'));
    r.readAsDataURL(file);
  });
}

async function readBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('File read failed'));
    r.readAsArrayBuffer(file);
  });
}

// ─── Items reference file ─────────────────────────────────────────────────────
function parseItemsCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const col = name => headers.indexOf(name);
  const get = (row, name) => { const i = col(name); return i >= 0 ? (row[i] || '').trim() : ''; };

  return lines.slice(1).map(line => {
    const row = line.split(',').map(c => c.trim());
    const our = get(row, 'our_code').toUpperCase();
    const sup = get(row, 'supplier_code').toUpperCase();
    if (!our && !sup) return null;
    return {
      our_code: our,
      supplier_code: sup,
      description: get(row, 'description'),
      pack_size_ea: parseFloat(get(row, 'pack_size_ea')) || null,
      std_price: parseFloat(get(row, 'std_price')) || null,
      currency: get(row, 'currency').toUpperCase() || 'USD',
    };
  }).filter(Boolean);
}

function refLookup(code) {
  if (!itemsRef.length || !code) return null;
  const c = code.toUpperCase();
  return itemsRef.find(r => r.our_code === c || r.supplier_code === c) || null;
}

// ─── Claude API — PDF extraction ──────────────────────────────────────────────
const EXTRACT_PROMPT = `You are a procurement document parser. Extract structured data from this document and return ONLY valid JSON — no explanation, no markdown, no code blocks.

Return this exact structure:
{
  "doc_type": "PO" or "PI",
  "po_number": "string or null",
  "payment_terms": "string or null",
  "currency": "USD/AUD/EUR/etc or null",
  "incoterms": "FOB/CIF/etc (normalised, no dots) or null",
  "total_cost": "number as string (no commas or $) or null",
  "line_items": [
    {
      "our_code": "buyer item code e.g. H100219 or null",
      "supplier_code": "supplier item code e.g. HL-B02 or null",
      "description": "item description",
      "qty_ea": number or null,
      "qty_ctn": number or null,
      "pack_size_ea_per_ctn": number or null,
      "unit_price": number or null,
      "price_basis": "per_ea / per_1000 / per_ctn — which unit is the price per?",
      "line_total": number or null
    }
  ]
}

Notes:
- For Epicor POs: qty is typically in EA (each), price may be per 1000 (look for "Carton" UOM hint in description)
- For supplier PIs: qty is typically in CTN (cartons), price is per CTN
- If a row has both a buyer code AND a supplier code, populate both fields
- total_cost should be the document grand total
- payment_terms: extract the full payment condition (T/T terms, L/C terms, etc.)
- Return null for any field you cannot find — do not guess`;

async function extractWithClaude(file) {
  if (!apiKey) throw new Error('No API key set — enter your Anthropic API key above.');

  const fname = file.name.toLowerCase();
  const isPdf = fname.endsWith('.pdf');
  const isImage = /\.(png|jpg|jpeg)$/.test(fname);

  if (!isPdf && !isImage) throw new Error(`Unsupported file type: ${file.name}`);

  const base64 = await readBase64(file);
  const mediaType = isPdf ? 'application/pdf'
    : fname.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mediaType, data: base64 } };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: EXTRACT_PROMPT,
      messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: 'Extract the procurement data from this document.' }] }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`API error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const raw = data.content?.find(b => b.type === 'text')?.text || '';

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch (e) { throw new Error(`Claude returned invalid JSON: ${cleaned.slice(0, 200)}`); }

  return {
    ok: true,
    filename: file.name,
    fields: {
      poNo:      parsed.po_number || null,
      payTerms:  parsed.payment_terms || null,
      currency:  parsed.currency || null,
      incoterms: parsed.incoterms || null,
      totalCost: parsed.total_cost ? String(parsed.total_cost).replace(/,/g, '') : null,
    },
    items: (parsed.line_items || []).map(it => ({
      our_code:     (it.our_code || '').toUpperCase() || null,
      supplier_code: (it.supplier_code || '').toUpperCase() || null,
      description:  it.description || '',
      qty_ea:       it.qty_ea ?? null,
      qty_ctn:      it.qty_ctn ?? null,
      pack_size:    it.pack_size_ea_per_ctn ?? null,
      unit_price:   it.unit_price ?? null,
      price_basis:  it.price_basis || null,
      line_total:   it.line_total ?? null,
      // Convenience: item_code = first non-null code for lookup
      item_code: (it.our_code || it.supplier_code || '').toUpperCase(),
      alt_codes: [it.our_code, it.supplier_code].filter(Boolean).map(c => c.toUpperCase()),
    })),
    raw: parsed,
  };
}

// ─── Comparison engine ────────────────────────────────────────────────────────
function compare(poDoc, piDoc) {
  const checks = [];
  const mismatches = [];
  let pass = true;
  let needsManual = false;

  const pf = poDoc.fields || {};
  const if_ = piDoc.fields || {};

  function headerCheck(label, poVal, piVal) {
    if (!poVal && !piVal) return;
    if (!poVal || !piVal) {
      checks.push({ check: label, status: 'WARN', className: 'warn',
        note: `Could not extract from ${!poVal ? 'PO' : 'PI'} — verify manually.` });
      needsManual = true;
      return;
    }
    const match = normalize(poVal) === normalize(piVal);
    checks.push({
      check: label,
      status: match ? 'PASS' : 'FAIL',
      className: match ? 'pass' : 'fail',
      note: `PO: ${poVal}  |  PI: ${piVal}`,
    });
    if (!match) { pass = false; needsManual = true; }
  }

  headerCheck('PO Number',     pf.poNo,      if_.poNo);
  headerCheck('Payment Terms', pf.payTerms,  if_.payTerms);
  headerCheck('Currency',      pf.currency,  if_.currency);
  headerCheck('Incoterms',     pf.incoterms, if_.incoterms);

  if (pf.totalCost && if_.totalCost) {
    const diff = Math.abs(parseFloat(pf.totalCost) - parseFloat(if_.totalCost));
    const match = diff < 1;
    checks.push({
      check: 'Total Cost',
      status: match ? 'PASS' : 'FAIL',
      className: match ? 'pass' : 'fail',
      note: `PO: ${pf.totalCost}  |  PI: ${if_.totalCost}`,
    });
    if (!match) { pass = false; needsManual = true; }
  }

  // ── Line item checks ──
  const poItems = poDoc.items || [];
  const piItems = piDoc.items || [];

  if (poItems.length === 0 && piItems.length === 0) {
    checks.push({ check: 'Line Items', status: 'WARN', className: 'warn',
      note: 'No line items extracted — header checks only.' });
    needsManual = true;
  } else {
    // Build PI lookup by all known codes
    const piMap = {};
    for (const r of piItems) {
      for (const c of r.alt_codes) { if (c) piMap[c] = r; }
    }

    let qtyIssues = 0;

    for (const po of poItems) {
      // Find PI match: try direct codes, then reference file aliases
      let pi = null;
      for (const c of po.alt_codes) { if (piMap[c]) { pi = piMap[c]; break; } }
      if (!pi) {
        const ref = refLookup(po.item_code);
        if (ref) {
          pi = piMap[ref.supplier_code] || piMap[ref.our_code];
        }
      }

      if (!pi) {
        mismatches.push({ item: po.item_code, field: 'Missing on PI', po: 'Exists', pi: 'Not found', variance: '—' });
        pass = false; needsManual = true;
        continue;
      }

      const ref = refLookup(po.item_code) || refLookup(pi.item_code);

      // ── Normalise quantities to EA for comparison ──
      // PO: Claude extracts qty_ea directly (Epicor EA field)
      // PI: Claude extracts qty_ctn; multiply by pack_size to get EA
      let poQtyEa = po.qty_ea ?? po.qty_ctn ?? null;
      let piQtyEa = null;
      let bridgeNote = '';

      if (pi.qty_ea != null) {
        piQtyEa = pi.qty_ea;
      } else if (pi.qty_ctn != null) {
        // Determine pack size: Claude's value > ref file > heuristic
        const ps = pi.pack_size || ref?.pack_size_ea || (poQtyEa && pi.qty_ctn ? Math.round(poQtyEa / pi.qty_ctn) : null);
        if (ps && ps > 1) {
          piQtyEa = pi.qty_ctn * ps;
          bridgeNote = ` (${pi.qty_ctn} CTN × ${ps} ea/ctn = ${piQtyEa} ea)`;
        } else {
          piQtyEa = pi.qty_ctn;
        }
      }

      if (poQtyEa != null && piQtyEa != null) {
        const qVar = Math.abs(pct(poQtyEa, piQtyEa));
        if (qVar > 5) {
          mismatches.push({
            item: po.item_code,
            field: 'Qty',
            po: `${poQtyEa} EA`,
            pi: `${pi.qty_ctn ?? piQtyEa}${bridgeNote}`,
            variance: `${qVar.toFixed(1)}%`,
          });
          pass = false; needsManual = true; qtyIssues++;
        }
      }

      // ── Unit price — normalise both to same basis ──
      if (po.unit_price != null && pi.unit_price != null) {
        let poPrice = po.unit_price;
        let piPrice = pi.unit_price;

        // If PO price is per_1000, convert to per_ctn using pack_size
        if (po.price_basis === 'per_1000') {
          const ps = po.pack_size || pi.pack_size || ref?.pack_size_ea;
          if (ps) poPrice = po.unit_price * (ps / 1000);
        }

        const pVar = Math.abs(pct(poPrice, piPrice));
        if (pVar > 0.5) {
          mismatches.push({
            item: po.item_code,
            field: 'Unit Price',
            po: `${po.unit_price}${po.price_basis === 'per_1000' ? '/1000' : ''}`,
            pi: pi.unit_price,
            variance: `${pVar.toFixed(2)}%`,
          });
          pass = false; needsManual = true;
        }
      }

      // ── Line total (strongest cross-format check) ──
      if (po.line_total != null && pi.line_total != null) {
        const tVar = Math.abs(pct(po.line_total, pi.line_total));
        if (tVar > 1) {
          mismatches.push({
            item: po.item_code,
            field: 'Line Total',
            po: po.line_total,
            pi: pi.line_total,
            variance: `${tVar.toFixed(1)}%`,
          });
          pass = false; needsManual = true;
        }
      }

      // ── Std price sanity (if ref file loaded) ──
      if (ref?.std_price && pi.unit_price) {
        const sVar = Math.abs(pct(ref.std_price, pi.unit_price));
        if (sVar > 5) {
          mismatches.push({
            item: po.item_code,
            field: 'Price vs Reference',
            po: `Std: ${ref.std_price}`,
            pi: pi.unit_price,
            variance: `${sVar.toFixed(1)}% from std`,
          });
          needsManual = true;
        }
      }
    }

    checks.push({
      check: 'Line Items',
      status: mismatches.length === 0 ? 'PASS' : 'REVIEW',
      className: mismatches.length === 0 ? 'pass' : 'fail',
      note: `PO: ${poItems.length} lines | PI: ${piItems.length} lines | Issues: ${mismatches.length}`,
    });

    if (qtyIssues > 0) {
      checks.push({
        check: 'Qty Tolerance (5%)',
        status: 'MANUAL',
        className: 'fail',
        note: `${qtyIssues} line(s) outside 5% tolerance — manual approval required`,
      });
    }
  }

  checks.push({
    check: 'Overall',
    status: pass ? 'PASS' : (needsManual ? 'REVIEW' : 'FAIL'),
    className: pass ? 'pass' : (needsManual ? 'warn' : 'fail'),
    note: pass ? '✓ All checks passed. Ready to sign.' : 'Manual review required.',
  });

  return { checks, mismatches, pass, needsManual };
}

// ─── Render helpers ───────────────────────────────────────────────────────────
function renderSummary(rows) {
  summaryBody.innerHTML = rows
    .map(r => `<tr><td>${r.check}</td><td class="${r.className}">${r.status}</td><td>${r.note}</td></tr>`)
    .join('');
}

function renderMismatches(rows) {
  if (!rows.length) {
    mismatchBody.innerHTML = '<tr><td colspan="5" class="pass">✓ No mismatches found.</td></tr>';
    return;
  }
  mismatchBody.innerHTML = rows
    .map(r => `<tr><td>${r.item}</td><td>${r.field}</td><td>${r.po}</td><td class="fail">${r.pi}</td><td class="fail">${r.variance}</td></tr>`)
    .join('');
}

// ─── File selection & dropzones ───────────────────────────────────────────────
function setFiles(kind, files) {
  const list = Array.from(files || []);
  if (kind === 'po') {
    poFiles = list;
    poFileList.textContent = list.length ? list.map(f => f.name).join(', ') : 'No files selected.';
  } else {
    piFiles = list;
    piFileList.textContent = list.length ? list.map(f => f.name).join(', ') : 'No files selected.';
  }
  if (list.length > 0) {
    _uploadCounter += list.length;
    if (_uploadCounter >= _quizThreshold) {
      _uploadCounter = 0;
      _quizThreshold = Math.floor(Math.random() * 3) + 10;
      setTimeout(runComplianceQuiz, 600);
    }
  }
}

function clearFiles() {
  poFiles = []; piFiles = [];
  if (poFileInput) poFileInput.value = '';
  if (piFileInput) piFileInput.value = '';
  poFileList.textContent = 'No files selected.';
  piFileList.textContent = 'No files selected.';
}

function setupDropzone(kind, dropEl, inputEl, browseEl) {
  browseEl.addEventListener('click', () => inputEl.click());
  dropEl.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') inputEl.click(); });
  dropEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputEl.click(); }
  });
  inputEl.addEventListener('change', () => setFiles(kind, inputEl.files));
  ['dragenter', 'dragover'].forEach(ev =>
    dropEl.addEventListener(ev, e => { e.preventDefault(); dropEl.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(ev =>
    dropEl.addEventListener(ev, e => { e.preventDefault(); dropEl.classList.remove('dragging'); }));
  dropEl.addEventListener('drop', e => {
    const f = e.dataTransfer?.files;
    if (f?.length) setFiles(kind, f);
  });
}

// ─── Compliance quiz ──────────────────────────────────────────────────────────
function runComplianceQuiz() {
  const doc = compareState.poDoc || compareState.piDoc;
  if (!doc) return;
  const pf  = compareState.poDoc?.fields || {};
  const pif = compareState.piDoc?.fields || {};

  const questions = [
    pf.poNo      && `Confirm the PO Number on the PI matches: ${pf.poNo}`,
    pf.payTerms  && `Confirm payment terms are: ${pf.payTerms}`,
    pf.currency  && `Confirm currency is: ${pf.currency}`,
    pf.incoterms && `Confirm incoterms are: ${pf.incoterms}`,
    pif.totalCost && `Confirm PI total amount is: ${pif.totalCost}`,
  ].filter(Boolean);

  if (!questions.length) return;
  const selected = questions.sort(() => Math.random() - 0.5).slice(0, 2);
  const msg = [
    'Periodic Compliance Check\n',
    'Please verify the following against the physical documents:\n',
    ...selected.map((q, i) => `${i + 1}. ${q}`),
    '\nClick OK to confirm you have checked these items.',
  ].join('\n');

  if (!confirm(msg)) {
    alert('Compliance check not confirmed. Please verify documents before approving.');
    compareState.passed = false;
    finalStatus.textContent = '⚠ Compliance check not confirmed. Re-run comparison or re-verify.';
  }
}

// ─── PDF signing with pdf-lib ─────────────────────────────────────────────────
async function buildSignedPdf(piFile, company, signer) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const buf = await readBuffer(piFile);
  const pdfDoc  = await PDFDocument.load(new Uint8Array(buf));
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages    = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();

  const dateStr = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
  const poNo    = compareState.poDoc?.fields?.poNo    || compareState.piDoc?.fields?.poNo    || 'N/A';
  const piTotal = compareState.piDoc?.fields?.totalCost || 'N/A';
  const payTerms = compareState.piDoc?.fields?.payTerms || 'N/A';

  const sigLines = [
    { text: 'APPROVED & CONFIRMED',          bold: true,  size: 11, color: rgb(0, 0.47, 0.78) },
    { text: `Company:  ${company}`,           bold: false, size: 9.5 },
    { text: `Authorised By:  ${signer}`,      bold: false, size: 9.5 },
    { text: `Date:  ${dateStr}`,              bold: false, size: 9.5 },
    { text: `PO Reference:  ${poNo}`,         bold: false, size: 9.5 },
    { text: `PI Total:  ${piTotal}`,          bold: false, size: 9.5 },
    { text: `Payment Terms:  ${payTerms}`,    bold: false, size: 9.5 },
    { text: 'PI reviewed and approved.',      bold: false, size: 9,  color: rgb(0.2, 0.2, 0.2) },
  ];

  const BOX_W = 270; const LINE_H = 15; const PADDING = 10; const MARGIN = 36;
  const BOX_H = sigLines.length * LINE_H + PADDING * 2 + 4;
  const boxX  = width - BOX_W - MARGIN;
  const boxY  = MARGIN;

  lastPage.drawRectangle({ x: boxX - 2, y: boxY - 2, width: BOX_W + 4, height: BOX_H + 4,
    color: rgb(1, 1, 1), borderColor: rgb(0, 0.47, 0.78), borderWidth: 1.5, opacity: 0.97 });

  let y = boxY + BOX_H - PADDING - 2;
  for (const line of sigLines) {
    lastPage.drawText(line.text, { x: boxX + PADDING, y, size: line.size,
      font: line.bold ? boldFont : font, color: line.color || rgb(0.1, 0.1, 0.1) });
    y -= LINE_H;
  }
  return await pdfDoc.save();
}

function buildFallbackPdf(lines) {
  const safe = s => String(s).replace(/[()\\]/g, '\\$&');
  let stream = 'BT\n/F1 11 Tf\n50 790 Td\n';
  lines.forEach((l, i) => { if (i) stream += '0 -18 Td\n'; stream += `(${safe(l)}) Tj\n`; });
  stream += 'ET';
  const objs = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let offset = 9; const offsets = [];
  const body = objs.map(o => { offsets.push(offset); offset += o.length; return o; }).join('');
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
    + offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  return new TextEncoder().encode(`%PDF-1.4\n${body}${xref}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`);
}

// ─── Signer dropdown ──────────────────────────────────────────────────────────
function populateSigners(company) {
  const sel = document.getElementById('signerSelect');
  if (!sel) return;
  sel.innerHTML = (COMPANIES[company] || []).map(s => `<option value="${s}">${s}</option>`).join('');
}

// ─── Event handlers ───────────────────────────────────────────────────────────
setupDropzone('po', poDropzone, poFileInput, document.getElementById('poBrowse'));
setupDropzone('pi', piDropzone, piFileInput, document.getElementById('piBrowse'));

// API key
if (apiKeyInput) {
  apiKeyInput.addEventListener('input', () => {
    apiKey = apiKeyInput.value.trim();
    if (apiKeyStatus) {
      apiKeyStatus.textContent = apiKey.startsWith('sk-ant-') ? '✓ Key looks valid' : apiKey ? '⚠ Key format unexpected' : '';
      apiKeyStatus.className   = apiKey.startsWith('sk-ant-') ? 'ref-ok' : 'ref-none';
    }
  });
}

// Reference file
const refBrowse    = document.getElementById('refBrowse');
const refFileInput = document.getElementById('refFile');
const refStatus    = document.getElementById('refStatus');

if (refBrowse) refBrowse.addEventListener('click', () => refFileInput.click());
if (refFileInput) {
  refFileInput.addEventListener('change', async () => {
    const f = refFileInput.files[0];
    if (!f) return;
    try {
      itemsRef = parseItemsCsv(await f.text());
      refStatus.textContent = `✓ Reference loaded: ${itemsRef.length} item(s) from ${f.name}`;
      refStatus.className = 'ref-ok';
    } catch (e) {
      refStatus.textContent = `✗ Failed to load ${f.name}: ${e.message}`;
      refStatus.className = 'ref-none';
    }
  });
}

// Company dropdown
const compSel = document.getElementById('companySelect');
if (compSel) {
  populateSigners(compSel.value);
  compSel.addEventListener('change', () => populateSigners(compSel.value));
}

// Run comparison
document.getElementById('runCompare').addEventListener('click', async () => {
  const poFile = poFiles[0] || poFileInput?.files?.[0];
  const piFile = piFiles[0] || piFileInput?.files?.[0];

  if (!poFile || !piFile) { finalStatus.textContent = 'Please select a PO and PI file first.'; return; }
  if (!apiKey) { finalStatus.textContent = 'Please enter your Anthropic API key above first.'; return; }

  summaryBody.innerHTML  = '<tr><td colspan="3" class="muted">Sending to Claude API…</td></tr>';
  mismatchBody.innerHTML = '<tr><td colspan="5" class="muted">Parsing…</td></tr>';
  finalStatus.textContent = 'Extracting data from documents…';

  try {
    const [poDoc, piDoc] = await Promise.all([
      extractWithClaude(poFile).catch(e => ({ ok: false, filename: poFile.name, error: e.message })),
      extractWithClaude(piFile).catch(e => ({ ok: false, filename: piFile.name, error: e.message })),
    ]);

    compareState.poDoc = poDoc;
    compareState.piDoc = piDoc;
    compareState.piFilenameBase = (piFile.name || 'PI').replace(/\.(pdf|png|jpg|jpeg)$/i, '');

    if (!poDoc.ok) {
      finalStatus.textContent = `PO error: ${poDoc.error}`;
      renderSummary([{ check: 'PO Parse', status: 'FAIL', className: 'fail', note: poDoc.error }]);
      renderMismatches([]); return;
    }
    if (!piDoc.ok) {
      finalStatus.textContent = `PI error: ${piDoc.error}`;
      renderSummary([{ check: 'PI Parse', status: 'FAIL', className: 'fail', note: piDoc.error }]);
      renderMismatches([]); return;
    }

    const result = compare(poDoc, piDoc);
    compareState.passed = result.pass;
    compareState.needsManual = result.needsManual;

    renderSummary(result.checks);
    renderMismatches(result.mismatches);
    finalStatus.textContent = result.pass
      ? '✓ All checks passed. Ready to sign and download.'
      : 'Review required — see table above, then use Manual Review if needed.';

  } catch (err) {
    finalStatus.textContent = `Unexpected error: ${err.message}`;
    console.error('[POPI] Compare error:', err);
  }
});

// Load sample
document.getElementById('loadSample').addEventListener('click', () => {
  compareState = {
    passed: false, needsManual: true, piFilenameBase: 'PI-sample',
    poDoc: { fields: { poNo: '130964', payTerms: 'T/T 30 days after BL', currency: 'USD', incoterms: 'FOB', totalCost: '11250.00' }, items: [] },
    piDoc: { fields: { poNo: '130964', payTerms: 'T/T 30 days after BL', currency: 'USD', incoterms: 'FOB', totalCost: '11250.00' }, items: [] },
  };
  renderSummary([
    { check: 'PO Number',     status: 'PASS',   className: 'pass', note: 'PO: 130964  |  PI: 130964' },
    { check: 'Payment Terms', status: 'PASS',   className: 'pass', note: 'T/T 30 days after BL' },
    { check: 'Currency',      status: 'PASS',   className: 'pass', note: 'USD | USD' },
    { check: 'Incoterms',     status: 'PASS',   className: 'pass', note: 'FOB | FOB' },
    { check: 'Total Cost',    status: 'PASS',   className: 'pass', note: '11,250.00 | 11,250.00' },
    { check: 'Line Items',    status: 'REVIEW', className: 'fail', note: 'PO: 3 lines | PI: 3 lines | Issues: 1' },
    { check: 'Qty Tolerance', status: 'MANUAL', className: 'fail', note: '1 line outside 5% tolerance' },
    { check: 'Overall',       status: 'REVIEW', className: 'warn', note: 'Manual review required.' },
  ]);
  renderMismatches([{ item: 'HL-B02', field: 'Qty', po: '532,000 EA', pi: '532 CTN → 532,000 ea', variance: '0.0%' }]);
  finalStatus.textContent = 'Sample data loaded. Use Manual Review to approve.';
});

// Finalize
document.getElementById('finalize').addEventListener('click', () => {
  if (compareState.passed) { finalStatus.textContent = '✓ Already passed. Ready to sign.'; return; }
  const override = document.getElementById('manualOverride').checked;
  const confirm_ = document.getElementById('confirmReview').checked;
  if (override && confirm_) {
    compareState.passed = true;
    finalStatus.textContent = '✓ Manual override accepted. Ready to sign and download.';
  } else {
    finalStatus.textContent = 'Please tick both boxes to confirm manual review is complete.';
  }
});

// Download signed PI
document.getElementById('downloadSignedPi').addEventListener('click', async () => {
  if (!compareState.passed) {
    finalStatus.textContent = 'Cannot sign: all checks must pass (or manual override approved) first.'; return;
  }
  const piFile  = piFiles[0] || piFileInput?.files?.[0];
  const company = document.getElementById('companySelect')?.value || 'Huhtamaki Henderson Ltd';
  const signer  = document.getElementById('signerSelect')?.value  || 'Authorised Signatory';
  const base    = compareState.piFilenameBase || 'PI';

  finalStatus.textContent = 'Generating signed PDF…';
  try {
    let bytes;
    if (piFile && piFile.name.toLowerCase().endsWith('.pdf') && typeof PDFLib !== 'undefined') {
      bytes = await buildSignedPdf(piFile, company, signer);
    } else {
      const dateStr = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
      bytes = buildFallbackPdf([
        'PI APPROVAL CONFIRMATION', '',
        `Company: ${company}`, `Authorised By: ${signer}`, `Date: ${dateStr}`,
        `PO Reference: ${compareState.poDoc?.fields?.poNo || 'N/A'}`,
        `PI File: ${base}`, `PI Total: ${compareState.piDoc?.fields?.totalCost || 'N/A'}`,
        '', 'Status: APPROVED', 'PI reviewed and approved against Purchase Order.',
      ]);
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${base}-signed.pdf`; a.click();
    URL.revokeObjectURL(url);
    finalStatus.textContent = `✓ Signed PI downloaded: ${base}-signed.pdf`;
    clearFiles();
  } catch (err) {
    finalStatus.textContent = `Signing error: ${err.message}`;
    console.error('[POPI] Sign error:', err);
  }
});
