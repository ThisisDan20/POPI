// PO ↔ PI Checker — app.js v3.0
// Parsing: Claude API (Haiku) reads PDFs — no regex fragility
// Comparison, signing, quiz: all local

// ─── pdf.js setup (text extraction only) ────────────────────────────────────
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ─── pdf-lib setup (signing only) ────────────────────────────────────────────
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

// ─── Embedded items reference (edit here or use Claude Code to update) ──────────
const ITEMS_REF = [
  { our_code: "1000TP011", supplier_code: null, pack_size_ea: 280 },
  { our_code: "1042Z", supplier_code: null, pack_size_ea: 400 },
  { our_code: "1043Z", supplier_code: null, pack_size_ea: 500 },
  { our_code: "15002*", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "172696", supplier_code: null, pack_size_ea: 300 },
  { our_code: "215T30PP", supplier_code: null, pack_size_ea: 150 },
  { our_code: "23002Z*", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "2350002*", supplier_code: null, pack_size_ea: 400 },
  { our_code: "280CP011", supplier_code: null, pack_size_ea: 600 },
  { our_code: "450CP911", supplier_code: null, pack_size_ea: 600 },
  { our_code: "500CP011", supplier_code: null, pack_size_ea: 600 },
  { our_code: "500CPFG011", supplier_code: null, pack_size_ea: 600 },
  { our_code: "500TP011", supplier_code: null, pack_size_ea: 280 },
  { our_code: "52888", supplier_code: null, pack_size_ea: 1500 },
  { our_code: "52891", supplier_code: null, pack_size_ea: 1848 },
  { our_code: "530CP911", supplier_code: null, pack_size_ea: 600 },
  { our_code: "651753522137", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "651753561032", supplier_code: null, pack_size_ea: 150 },
  { our_code: "750TP011", supplier_code: null, pack_size_ea: 280 },
  { our_code: "850CP011", supplier_code: null, pack_size_ea: 600 },
  { our_code: "850CP911", supplier_code: null, pack_size_ea: 600 },
  { our_code: "89474", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "ABBB", supplier_code: null, pack_size_ea: 250 },
  { our_code: "ABHD", supplier_code: null, pack_size_ea: 200 },
  { our_code: "ABSBL", supplier_code: null, pack_size_ea: 200 },
  { our_code: "ABSBR", supplier_code: null, pack_size_ea: 200 },
  { our_code: "ABT2", supplier_code: null, pack_size_ea: 240 },
  { our_code: "ABT3", supplier_code: null, pack_size_ea: 300 },
  { our_code: "ABT4", supplier_code: null, pack_size_ea: 250 },
  { our_code: "BB20P", supplier_code: null, pack_size_ea: 200 },
  { our_code: "BB24P", supplier_code: null, pack_size_ea: 200 },
  { our_code: "BB30P", supplier_code: null, pack_size_ea: 200 },
  { our_code: "BB32P", supplier_code: null, pack_size_ea: 200 },
  { our_code: "BB40P", supplier_code: null, pack_size_ea: 200 },
  { our_code: "BB553408CJ", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "BBLIDL", supplier_code: null, pack_size_ea: 200 },
  { our_code: "BBLIDM", supplier_code: null, pack_size_ea: 200 },
  { our_code: "BIOSWS225034", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "BIOSWS280034", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "BIOSWS300107", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "BIOSWS335034", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "BIOSWS355034", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "BIOSWS400104", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "BIOSWS400107", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "BIOUNI-LID80", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "BIOUNI-LID90", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "C119PP500-011", supplier_code: null, pack_size_ea: 600 },
  { our_code: "C119PP770-002", supplier_code: null, pack_size_ea: 600 },
  { our_code: "C119PP915-002", supplier_code: null, pack_size_ea: 600 },
  { our_code: "C73PP135-011", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "C73PP165-911", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "C89PP200-911", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "C98PET215-002", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "C98PET335-002", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "C98PET335-011", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "DISPENSER-EXTEND", supplier_code: null, pack_size_ea: 1 },
  { our_code: "DISPENSER-STD", supplier_code: null, pack_size_ea: 1 },
  { our_code: "DISP-SSTEEL", supplier_code: null, pack_size_ea: 1 },
  { our_code: "DPE24040", supplier_code: null, pack_size_ea: 500 },
  { our_code: "DW555314A", supplier_code: null, pack_size_ea: 500 },
  { our_code: "DW555387NZ", supplier_code: null, pack_size_ea: 600 },
  { our_code: "DW555505", supplier_code: null, pack_size_ea: 700 },
  { our_code: "DW556314AUS", supplier_code: null, pack_size_ea: 500 },
  { our_code: "DW556505", supplier_code: null, pack_size_ea: 480 },
  { our_code: "DW557505", supplier_code: null, pack_size_ea: 408 },
  { our_code: "DWS400099HC", supplier_code: null, pack_size_ea: 500 },
  { our_code: "DWS495004HC", supplier_code: null, pack_size_ea: 300 },
  { our_code: "FB405002", supplier_code: null, pack_size_ea: 300 },
  { our_code: "FC12P", supplier_code: null, pack_size_ea: 500 },
  { our_code: "FC16P", supplier_code: null, pack_size_ea: 500 },
  { our_code: "FC24P", supplier_code: null, pack_size_ea: 500 },
  { our_code: "FC6P", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "FC8P", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "FCPLALS", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "FCPLALXS", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "FCPLS", supplier_code: null, pack_size_ea: 500 },
  { our_code: "FCPLXS", supplier_code: null, pack_size_ea: 500 },
  { our_code: "FCT230034", supplier_code: null, pack_size_ea: 500 },
  { our_code: "FCT271034Z", supplier_code: null, pack_size_ea: 300 },
  { our_code: "FFCSIC03", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "FFCSIC05", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "FFCSIC08", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "FFNSLID-PF", supplier_code: null, pack_size_ea: 400 },
  { our_code: "FFNSTC1000", supplier_code: null, pack_size_ea: 400 },
  { our_code: "FFNSTC500-PF", supplier_code: null, pack_size_ea: 400 },
  { our_code: "FFNSTC650", supplier_code: null, pack_size_ea: 400 },
  { our_code: "FFNSTC750", supplier_code: null, pack_size_ea: 400 },
  { our_code: "FFPETLID", supplier_code: null, pack_size_ea: 400 },
  { our_code: "GB251035", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "GB251046J", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "GB405002", supplier_code: null, pack_size_ea: 300 },
  { our_code: "GB690011", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "H100000", supplier_code: null, pack_size_ea: 200 },
  { our_code: "H100001", supplier_code: null, pack_size_ea: 200 },
  { our_code: "H100002", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100003", supplier_code: null, pack_size_ea: 200 },
  { our_code: "H100004", supplier_code: null, pack_size_ea: 400 },
  { our_code: "H100005", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100006", supplier_code: null, pack_size_ea: 200 },
  { our_code: "H100007", supplier_code: null, pack_size_ea: 400 },
  { our_code: "H100008", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100009", supplier_code: null, pack_size_ea: 200 },
  { our_code: "H100010", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100012", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100068", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100073", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100077", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100093", supplier_code: null, pack_size_ea: 120 },
  { our_code: "H100095", supplier_code: null, pack_size_ea: 75 },
  { our_code: "H100096", supplier_code: null, pack_size_ea: 150 },
  { our_code: "H100099", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100124", supplier_code: null, pack_size_ea: 75 },
  { our_code: "H100125", supplier_code: null, pack_size_ea: 150 },
  { our_code: "H100126", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100128", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100130", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100131", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100132", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100139", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100148", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100150", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100164", supplier_code: null, pack_size_ea: 600 },
  { our_code: "H100165", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100176", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100181", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100182", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100183", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100189", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "H100191", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100192", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100193", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100200", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100201", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100202", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100203", supplier_code: null, pack_size_ea: 600 },
  { our_code: "H100204", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100205", supplier_code: null, pack_size_ea: 450 },
  { our_code: "H100206", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100207", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100208", supplier_code: null, pack_size_ea: 300 },
  { our_code: "H100209", supplier_code: null, pack_size_ea: 2500 },
  { our_code: "H100210", supplier_code: null, pack_size_ea: 2500 },
  { our_code: "H100211", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100216", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100217", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100218", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100219", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100220", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100221", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100222", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100223", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100226", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100230", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100237", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100238", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100239", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100246", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100247", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100248", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100250", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100251", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100258", supplier_code: null, pack_size_ea: 100 },
  { our_code: "H100259", supplier_code: null, pack_size_ea: 50 },
  { our_code: "H100261", supplier_code: null, pack_size_ea: 200 },
  { our_code: "H100262", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100263", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100264", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100266", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100267", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100268", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100269", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100270", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100271", supplier_code: null, pack_size_ea: 1200 },
  { our_code: "H100272", supplier_code: null, pack_size_ea: 960 },
  { our_code: "H100274", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100275", supplier_code: null, pack_size_ea: 200 },
  { our_code: "H100280", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100281", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100282", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100283", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100284", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100285", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100286", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100291", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100293", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100294", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100295", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100296", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100297", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100298", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100299", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100300", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100301", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100305", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100306", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100308", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100309", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100310", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100311", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100322", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100323", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100324", supplier_code: null, pack_size_ea: 375 },
  { our_code: "H100327", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100330", supplier_code: null, pack_size_ea: 450 },
  { our_code: "H100331", supplier_code: null, pack_size_ea: 150 },
  { our_code: "H100332", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100333", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100334", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100335", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100336", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100337", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100338", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100339", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100340", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100341", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100342", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100344", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100346", supplier_code: null, pack_size_ea: 400 },
  { our_code: "H100347", supplier_code: null, pack_size_ea: 400 },
  { our_code: "H100348", supplier_code: null, pack_size_ea: 400 },
  { our_code: "H100349", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100350", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100351", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100352", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100353", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100354", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100355", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100356", supplier_code: null, pack_size_ea: 400 },
  { our_code: "H100357", supplier_code: null, pack_size_ea: 400 },
  { our_code: "H100358", supplier_code: null, pack_size_ea: 400 },
  { our_code: "H100360", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100361", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100362", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100363", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100364", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100365", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100366", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100367", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100368", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100369", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100370", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100373", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100376", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100379", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100382", supplier_code: null, pack_size_ea: 1715 },
  { our_code: "H100384", supplier_code: null, pack_size_ea: 1715 },
  { our_code: "H100385", supplier_code: null, pack_size_ea: 1715 },
  { our_code: "H100386", supplier_code: null, pack_size_ea: 1715 },
  { our_code: "H100387", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100388", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100390", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100391", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100392", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100393", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100394", supplier_code: null, pack_size_ea: 1715 },
  { our_code: "H100395", supplier_code: null, pack_size_ea: 1715 },
  { our_code: "H100397", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100402", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100403", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100404", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100405", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100406", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100407", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100408", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100409", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100410", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100411", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100412", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100413", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100414", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100415", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100417", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100418", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100419", supplier_code: null, pack_size_ea: 840 },
  { our_code: "H100420", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100421", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100422", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100423", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100424", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100425", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100426", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100427", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100428", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100430", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100431", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100434", supplier_code: null, pack_size_ea: 1715 },
  { our_code: "H100436", supplier_code: null, pack_size_ea: 1715 },
  { our_code: "H100437", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100438", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100440", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100441", supplier_code: null, pack_size_ea: 200 },
  { our_code: "H100442", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100443", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100445", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100446", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100447", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100448", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100450", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100451", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100452", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100453", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100454", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100455", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100467", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100468", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100472", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100473", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100474", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100475", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100476", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100477", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100481", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100482", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100483", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100484", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100485", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100486", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100489", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100490", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100491", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100494", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100495", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100496", supplier_code: null, pack_size_ea: 400 },
  { our_code: "H100497", supplier_code: null, pack_size_ea: 100 },
  { our_code: "H100498", supplier_code: null, pack_size_ea: 100 },
  { our_code: "H100499", supplier_code: null, pack_size_ea: 50 },
  { our_code: "H100500", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100501", supplier_code: null, pack_size_ea: 200 },
  { our_code: "H100502", supplier_code: null, pack_size_ea: 200 },
  { our_code: "H100503", supplier_code: null, pack_size_ea: 200 },
  { our_code: "H100504", supplier_code: null, pack_size_ea: 100 },
  { our_code: "H100507", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100508", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100509", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "H100510", supplier_code: null, pack_size_ea: 500 },
  { our_code: "H100511", supplier_code: null, pack_size_ea: 500 },
  { our_code: "KCB-L", supplier_code: null, pack_size_ea: 50 },
  { our_code: "KCBLID-L", supplier_code: null, pack_size_ea: 50 },
  { our_code: "KCBLID-M", supplier_code: null, pack_size_ea: 100 },
  { our_code: "KCBLID-S", supplier_code: null, pack_size_ea: 100 },
  { our_code: "KCBLID-XL", supplier_code: null, pack_size_ea: 50 },
  { our_code: "KCBLID-XS", supplier_code: null, pack_size_ea: 100 },
  { our_code: "KCB-M", supplier_code: null, pack_size_ea: 100 },
  { our_code: "KCB-S", supplier_code: null, pack_size_ea: 100 },
  { our_code: "KCB-XL", supplier_code: null, pack_size_ea: 50 },
  { our_code: "KCB-XS", supplier_code: null, pack_size_ea: 100 },
  { our_code: "KPSW", supplier_code: null, pack_size_ea: 500 },
  { our_code: "KSCPLWL", supplier_code: null, pack_size_ea: 200 },
  { our_code: "KSCPLWM", supplier_code: null, pack_size_ea: 200 },
  { our_code: "KSCPLWS", supplier_code: null, pack_size_ea: 200 },
  { our_code: "LCP011", supplier_code: null, pack_size_ea: 600 },
  { our_code: "LDPET-290", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "LDPET-420-510", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "LDPET-420-510-ODL", supplier_code: null, pack_size_ea: 1500 },
  { our_code: "LF119PP-011", supplier_code: null, pack_size_ea: 1008 },
  { our_code: "LF24PET", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "LF75PET-011", supplier_code: null, pack_size_ea: 3000 },
  { our_code: "LF89PET-911", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "LF98PET-011", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "LFP44PET-011", supplier_code: null, pack_size_ea: 5000 },
  { our_code: "LFP65PET", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "LH4PP-011", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "LH5PP-011", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "LTP011", supplier_code: null, pack_size_ea: 210 },
  { our_code: "MF4CT", supplier_code: null, pack_size_ea: 300 },
  { our_code: "P1001011L", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "P150-002", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "P44PP20-011", supplier_code: null, pack_size_ea: 5000 },
  { our_code: "P44PP35-011", supplier_code: null, pack_size_ea: 5000 },
  { our_code: "P65PET60-011", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "PALLET-CHEP", supplier_code: null, pack_size_ea: 1 },
  { our_code: "PALLET-PLAIN", supplier_code: null, pack_size_ea: 1 },
  { our_code: "PCS002", supplier_code: null, pack_size_ea: 10000 },
  { our_code: "PCS004", supplier_code: null, pack_size_ea: 10000 },
  { our_code: "PET290", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "PET420-003", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "PET510", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "PET630", supplier_code: null, pack_size_ea: 600 },
  { our_code: "PFS002", supplier_code: null, pack_size_ea: 5000 },
  { our_code: "PFS004", supplier_code: null, pack_size_ea: 5000 },
  { our_code: "PS007", supplier_code: null, pack_size_ea: 5000 },
  { our_code: "PSS002", supplier_code: null, pack_size_ea: 5000 },
  { our_code: "PSS004", supplier_code: null, pack_size_ea: 5000 },
  { our_code: "SC02LB", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "SC02LB-PF", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "SC02LP", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "SC04LP", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "SC10CRND-PF", supplier_code: null, pack_size_ea: 500 },
  { our_code: "SC10SQR-PF", supplier_code: null, pack_size_ea: 500 },
  { our_code: "SC10X5SQR-PF", supplier_code: null, pack_size_ea: 500 },
  { our_code: "SC12.5OVL-PF", supplier_code: null, pack_size_ea: 500 },
  { our_code: "SC12DLID", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "SC12RBWL-PF", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "SC18DLID", supplier_code: null, pack_size_ea: 200 },
  { our_code: "SC18OLID", supplier_code: null, pack_size_ea: 300 },
  { our_code: "SC18RBWL-PF", supplier_code: null, pack_size_ea: 600 },
  { our_code: "SC24OBWL-PF", supplier_code: null, pack_size_ea: 300 },
  { our_code: "SC24OLID", supplier_code: null, pack_size_ea: 300 },
  { our_code: "SC32RBWL", supplier_code: null, pack_size_ea: 400 },
  { our_code: "SC6RND-PF", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "SC6SQR-PF", supplier_code: null, pack_size_ea: 500 },
  { our_code: "SC8SQR-PF", supplier_code: null, pack_size_ea: 500 },
  { our_code: "SC9CRND-PF", supplier_code: null, pack_size_ea: 500 },
  { our_code: "SC9RND-PF", supplier_code: null, pack_size_ea: 500 },
  { our_code: "SCC1", supplier_code: null, pack_size_ea: 500 },
  { our_code: "SCC17-PF", supplier_code: null, pack_size_ea: 200 },
  { our_code: "SCC2-PF", supplier_code: null, pack_size_ea: 300 },
  { our_code: "SCC4-PF", supplier_code: null, pack_size_ea: 200 },
  { our_code: "SCC5", supplier_code: null, pack_size_ea: 200 },
  { our_code: "SCC5L-PF", supplier_code: null, pack_size_ea: 200 },
  { our_code: "SCSC02-PF", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "SCSC04", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "SRL16/22", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "SW440019", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "SW8002", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "SWS495004HC", supplier_code: null, pack_size_ea: 450 },
  { our_code: "T72PP170-002", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "T72PP230-002", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "TCR1000", supplier_code: null, pack_size_ea: 500 },
  { our_code: "TCR500", supplier_code: null, pack_size_ea: 500 },
  { our_code: "TCR650", supplier_code: null, pack_size_ea: 500 },
  { our_code: "TCR750", supplier_code: null, pack_size_ea: 500 },
  { our_code: "TCRLID", supplier_code: null, pack_size_ea: 500 },
  { our_code: "TDP25", supplier_code: null, pack_size_ea: 300 },
  { our_code: "TDP25-2C", supplier_code: null, pack_size_ea: 300 },
  { our_code: "TFLID-MF", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "UNI-LID-002", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "UNI-LID-004", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "UNI-LID-BLACKMCD", supplier_code: null, pack_size_ea: 2000 },
  { our_code: "WCFRK", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "WCFRKC", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "WCFRKIW", supplier_code: null, pack_size_ea: 500 },
  { our_code: "WCKNF", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "WCKNFC", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "WCSPK", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "WCSPN", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "WCSPNIW", supplier_code: null, pack_size_ea: 500 },
  { our_code: "WCTSPN", supplier_code: null, pack_size_ea: 1000 },
  { our_code: "WCTSPNC", supplier_code: null, pack_size_ea: 1000 },
];

// ─── App state ────────────────────────────────────────────────────────────────
let poFiles = [];
let piFiles = [];
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

// ─── Utility ──────────────────────────────────────────────────────────────────
function pct(a, b) {
  if (!a && !b) return 0;
  if (!a) return 100;
  return ((b - a) / a) * 100;
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[\s\-\/]+/g, ' ').trim();
}

function normalizePoNo(s) {
  // Strip any prefix (PO, #, spaces) and return just the digits
  return String(s || '').replace(/[^0-9]/g, '');
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


function refLookup(code) {
  if (!code) return null;
  const c = code.toUpperCase();
  return ITEMS_REF.find(r => r.our_code === c || (r.supplier_code && r.supplier_code === c)) || null;
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

// ─── PDF text extraction (client-side, no data sent externally) ──────────────
async function extractTextFromPdf(file) {
  if (typeof pdfjsLib === 'undefined') return null;
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      pages.push(tc.items.map(it => it.str).join(' '));
    }
    return pages.join(' ').trim();
  } catch (e) {
    console.warn('[POPI] pdf.js text extraction failed:', e.message);
    return null;
  }
}

async function extractWithClaude(file) {
  const fname = file.name.toLowerCase();
  const isPdf = fname.endsWith('.pdf');
  const isImage = /\.(png|jpg|jpeg)$/.test(fname);

  if (!isPdf && !isImage) throw new Error(`Unsupported file type: ${file.name}`);

  let contentBlock;

  if (isPdf) {
    // Option A: extract text client-side first — raw PDF bytes never leave the browser
    const pdfText = await extractTextFromPdf(file);
    if (pdfText && pdfText.length > 100) {
      // Send extracted text only — no PDF binary data transmitted
      contentBlock = { type: 'text', text: 'DOCUMENT TEXT (extracted locally):\n\n' + pdfText };
    } else {
      // Fallback: send as base64 if text extraction fails (e.g. scanned PDF)
      const base64 = await readBase64(file);
      contentBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
      console.warn('[POPI] Text extraction failed, falling back to PDF base64 for:', file.name);
    }
  } else {
    // Images must be sent as base64 — no text to extract
    const base64 = await readBase64(file);
    const mediaType = fname.endsWith('.png') ? 'image/png' : 'image/jpeg';
    contentBlock = { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
  }

  const WORKER_URL = 'https://popi-proxy.dgroberts.workers.dev/v1/messages';
  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
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
      // Item codes never contain slashes — strip anything from first / onwards
      item_code: (it.our_code || it.supplier_code || '').toUpperCase().replace(/\s*\/.*$/, '').trim(),
      alt_codes: [it.our_code, it.supplier_code]
        .filter(Boolean)
        .map(c => c.toUpperCase().replace(/\s*\/.*$/, '').trim())
        .filter((c, i, a) => c && a.indexOf(c) === i),
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
    // Use digit-only comparison for PO Number to handle PO131043 vs 131043
    const match = label === 'PO Number'
      ? normalizePoNo(poVal) === normalizePoNo(piVal) && normalizePoNo(poVal).length > 0
      : normalize(poVal) === normalize(piVal);
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
    const poTotal = parseFloat(pf.totalCost);
    const piTotal = parseFloat(if_.totalCost);
    const totalVar = Math.abs(pct(poTotal, piTotal));
    const exact = Math.abs(poTotal - piTotal) < 1;
    const withinTol = totalVar <= 5;
    checks.push({
      check: 'Total Cost',
      status: exact ? 'PASS' : withinTol ? 'INFO' : 'FAIL',
      className: exact ? 'pass' : withinTol ? 'warn' : 'fail',
      note: `PO: ${pf.totalCost}  |  PI: ${if_.totalCost}` +
        (!exact ? `  (${totalVar.toFixed(1)}% variance${withinTol ? ' — within qty tolerance' : ''})` : ''),
    });
    if (!withinTol) { pass = false; needsManual = true; }
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
      console.log('[POPI] ref lookup for', po.item_code, '→', ref ? 'FOUND pack_size=' + ref.pack_size_ea : 'NOT FOUND (itemsRef.length=' + itemsRef.length + ')');

      // ── Normalise quantities to EA for comparison ──
      // PO: Claude extracts qty_ea directly (Epicor EA field)
      // PI: Claude extracts qty_ctn; multiply by pack_size to get EA
      let poQtyEa = po.qty_ea ?? po.qty_ctn ?? null;
      let piQtyEa = null;
      let bridgeNote = '';

      if (pi.qty_ea != null) {
        piQtyEa = pi.qty_ea;
      } else if (pi.qty_ctn != null) {
        // ref file takes top priority — overrides Claude's extraction from descriptions
        const ps = ref?.pack_size_ea || pi.pack_size || (poQtyEa && pi.qty_ctn ? Math.round(poQtyEa / pi.qty_ctn) : null);
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
        let priceBasisNote = '';

        if (po.price_basis === 'per_1000') {
          // Derive pack size: explicit > ref file > qty ratio > nearest standard size
          const poQty = po.qty_ea ?? po.qty_ctn ?? null;
          const piQty = pi.qty_ctn ?? null;
          const rawRatio = (poQty && piQty && poQty > piQty) ? poQty / piQty : null;
          // Snap to nearest standard pack size if within 10% (handles qty discrepancies)
          const STD_PACKS = [10, 20, 25, 50, 100, 200, 250, 500, 1000];
          const snapPs = rawRatio
            ? STD_PACKS.find(p => Math.abs(rawRatio - p) / p < 0.10) || Math.round(rawRatio)
            : null;
          // ref file pack_size takes top priority — overrides Claude's extraction from descriptions
          const ps = ref?.pack_size_ea || pi.pack_size || snapPs || po.pack_size;
          if (ps && ps > 1) {
            poPrice = po.unit_price * (ps / 1000);
            priceBasisNote = ' (' + po.unit_price + '/1000 x ' + ps + 'pcs = ' + poPrice.toFixed(4) + '/ctn)';
          }
        }

        const pVar = Math.abs(pct(poPrice, piPrice));
        if (pVar > 0.5) {
          mismatches.push({
            item: po.item_code,
            field: 'Unit Price',
            po: po.unit_price + (po.price_basis === 'per_1000' ? '/1000' : '') + priceBasisNote,
            pi: piPrice,
            variance: pVar.toFixed(2) + '%',
          });
          pass = false; needsManual = true;
        }
      }

      // ── Line total (strongest cross-format check) ──
      if (po.line_total != null && pi.line_total != null) {
        const tVar = Math.abs(pct(po.line_total, pi.line_total));
        if (tVar > 5) {
          // Hard fail — variance exceeds qty tolerance
          mismatches.push({
            item: po.item_code,
            field: 'Line Total',
            po: po.line_total,
            pi: pi.line_total,
            variance: `${tVar.toFixed(1)}%`,
          });
          pass = false; needsManual = true;
        } else if (tVar > 1) {
          // Soft info — within qty tolerance, likely a fill-container adjustment
          mismatches.push({
            item: po.item_code,
            field: 'Line Total',
            po: po.line_total,
            pi: pi.line_total,
            variance: `${tVar.toFixed(1)}% — within qty tolerance`,
          });
          // Does not block signing
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
    { text: 'APPROVED & CONFIRMED',     bold: true,  size: 11, color: rgb(0, 0.47, 0.78) },
    { text: `Company:  ${company}`,     bold: false, size: 9.5 },
    { text: `Authorised By:  ${signer}`, bold: false, size: 9.5 },
    { text: `Date:  ${dateStr}`,        bold: false, size: 9.5 },
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

// ─── Signer fields ────────────────────────────────────────────────────────────
function initSignerFields() {
  const nameEl = document.getElementById('signerName');
  const posEl  = document.getElementById('signerPosition');
  if (!nameEl || !posEl) return;

  // Restore saved values
  nameEl.value = localStorage.getItem('popi_signer_name') || '';
  posEl.value  = localStorage.getItem('popi_signer_pos')  || '';

  nameEl.addEventListener('input', () => localStorage.setItem('popi_signer_name', nameEl.value.trim()));
  posEl.addEventListener('input',  () => localStorage.setItem('popi_signer_pos',  posEl.value.trim()));
}

// ─── Event handlers ───────────────────────────────────────────────────────────
setupDropzone('po', poDropzone, poFileInput, document.getElementById('poBrowse'));
setupDropzone('pi', piDropzone, piFileInput, document.getElementById('piBrowse'));

// API key handled server-side via Cloudflare Worker

// Items reference embedded in app — no CSV loading needed

// Signer fields
initSignerFields();

// Run comparison — supports batch (multiple POs + PIs matched by PO number)
document.getElementById('runCompare').addEventListener('click', async () => {
  const allPoFiles = poFiles.length ? poFiles : Array.from(poFileInput?.files || []);
  const allPiFiles = piFiles.length ? piFiles : Array.from(piFileInput?.files || []);

  if (!allPoFiles.length || !allPiFiles.length) {
    finalStatus.textContent = 'Please select at least one PO and one PI file first.'; return;
  }

  const runBtn = document.getElementById('runCompare');
  runBtn.disabled = true;
  runBtn.textContent = '⏳ Checking…';
  summaryBody.innerHTML  = `<tr><td colspan="3" class="muted">⏳ Parsing ${allPoFiles.length} PO(s) and ${allPiFiles.length} PI(s)…</td></tr>`;
  mismatchBody.innerHTML = '<tr><td colspan="5" class="muted">⏳ Parsing…</td></tr>';
  finalStatus.textContent = `⏳ Extracting data from ${allPoFiles.length + allPiFiles.length} files…`;

  try {
    // Parse files sequentially to avoid rate limit (429)
    const delay = ms => new Promise(r => setTimeout(r, ms));
    const parseSequential = async (files) => {
      const results = [];
      for (let i = 0; i < files.length; i++) {
        if (i > 0) await delay(500); // 500ms between calls
        finalStatus.textContent = `⏳ Parsing file ${i + 1} of ${files.length}…`;
        const result = await extractWithClaude(files[i])
          .catch(e => ({ ok: false, filename: files[i].name, error: e.message }));
        results.push(result);
      }
      return results;
    };

    // Parse POs then PIs sequentially
    const poDocs = await parseSequential(allPoFiles);
    const piDocs = await parseSequential(allPiFiles);

    // If single pair, use original flow
    if (poDocs.length === 1 && piDocs.length === 1) {
      const poDoc = poDocs[0], piDoc = piDocs[0];
      compareState.poDoc = poDoc;
      compareState.piDoc = piDoc;
      compareState.piFilenameBase = allPiFiles[0].name.replace(/\.(pdf|png|jpg|jpeg)$/i, '');

      if (!poDoc.ok) {
        renderSummary([{ check: 'PO Parse', status: 'FAIL', className: 'fail', note: poDoc.error }]);
        renderMismatches([]); finalStatus.textContent = `PO error: ${poDoc.error}`; return;
      }
      if (!piDoc.ok) {
        renderSummary([{ check: 'PI Parse', status: 'FAIL', className: 'fail', note: piDoc.error }]);
        renderMismatches([]); finalStatus.textContent = `PI error: ${piDoc.error}`; return;
      }

      const result = compare(poDoc, piDoc);
      compareState.passed = result.pass;
      compareState.needsManual = result.needsManual;
      renderSummary(result.checks);
      renderMismatches(result.mismatches);
      finalStatus.textContent = result.pass
        ? '✓ All checks passed. Ready to sign and download.'
        : 'Review required — see table above, then use Manual Review if needed.';
      return;
    }

    // Batch flow — match by PO number
    // Build PI lookup keyed by normalised PO number
    const piByPoNo = {};
    for (let i = 0; i < piDocs.length; i++) {
      const pi = piDocs[i];
      if (pi.ok && pi.fields?.poNo) {
        piByPoNo[normalizePoNo(pi.fields.poNo)] = { doc: pi, file: allPiFiles[i] };
      }
    }

    const batchResults = [];
    let allPassed = true;

    for (let i = 0; i < poDocs.length; i++) {
      const poDoc = poDocs[i];
      const poFile = allPoFiles[i];

      if (!poDoc.ok) {
        batchResults.push({ poFile, poDoc, piDoc: null, result: null, error: poDoc.error });
        allPassed = false;
        continue;
      }

      const poNoKey = normalizePoNo(poDoc.fields?.poNo || '');
      const piMatch = piByPoNo[poNoKey];

      if (!piMatch) {
        batchResults.push({ poFile, poDoc, piDoc: null, result: null,
          error: `No matching PI found for PO ${poDoc.fields?.poNo || '(unknown)'}` });
        allPassed = false;
        continue;
      }

      const result = compare(poDoc, piMatch.doc);
      if (!result.pass) allPassed = false;
      batchResults.push({ poFile, piFile: piMatch.file, poDoc, piDoc: piMatch.doc, result });
    }

    // Store last result for signing
    const lastMatch = batchResults.filter(r => r.result).pop();
    if (lastMatch) {
      compareState.poDoc = lastMatch.poDoc;
      compareState.piDoc = lastMatch.piDoc;
      compareState.piFilenameBase = lastMatch.piFile?.name.replace(/\.(pdf|png|jpg|jpeg)$/i, '') || 'PI';
      compareState.passed = allPassed;
      compareState.needsManual = !allPassed;
    }

    // Render batch summary
    const summaryRows = [];
    const mismatchRows = [];

    for (const br of batchResults) {
      const poLabel = br.poDoc?.fields?.poNo || br.poFile.name;
      if (br.error) {
        summaryRows.push({ check: poLabel, status: 'FAIL', className: 'fail', note: br.error });
        continue;
      }
      const overall = br.result.checks.find(c => c.check === 'Overall');
      summaryRows.push({
        check: poLabel,
        status: overall?.status || '?',
        className: overall?.className || 'warn',
        note: br.result.checks.filter(c => c.status !== 'PASS' && c.check !== 'Overall')
          .map(c => c.check + ': ' + c.status).join(' · ') || '✓ All passed',
      });
      for (const m of br.result.mismatches) {
        mismatchRows.push({ ...m, item: `[${poLabel}] ${m.item}` });
      }
    }

    renderSummary(summaryRows);
    renderMismatches(mismatchRows);
    finalStatus.textContent = allPassed
      ? `✓ All ${batchResults.length} PO/PI pair(s) passed.`
      : `${batchResults.filter(r=>r.result&&!r.result.pass).length} of ${batchResults.length} pair(s) need review.`;

  } catch (err) {
    finalStatus.textContent = 'Error: ' + err.message;
    console.error('[POPI] Compare error:', err);
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = '▶ Run Comparison';
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
  const signerName = document.getElementById('signerName')?.value.trim() || 'Authorised Signatory';
  const signerPos  = document.getElementById('signerPosition')?.value.trim() || '';
  const signer = signerPos ? `${signerName}, ${signerPos}` : signerName;
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

// ─── Debug helper — type debugDocs() in browser console after running comparison ──
window.debugDocs = () => {
  const po = compareState.poDoc;
  const pi = compareState.piDoc;
  if (!po || !pi) { console.log('No comparison run yet.'); return; }

  console.group('=== PO fields ===');
  console.table(po.fields);
  console.groupEnd();

  console.group('=== PO line items ===');
  (po.items || []).forEach((it, i) => {
    console.log(`Line ${i+1}:`, JSON.stringify(it));
  });
  console.groupEnd();

  console.group('=== PI fields ===');
  console.table(pi.fields);
  console.groupEnd();

  console.group('=== PI line items ===');
  (pi.items || []).forEach((it, i) => {
    console.log(`Line ${i+1}:`, JSON.stringify(it));
  });
  console.groupEnd();

  console.group('=== Price normalisation walkthrough ===');
  const poItems = po.items || [];
  const piItems = pi.items || [];
  const piMap = {};
  for (const r of piItems) { for (const c of r.alt_codes) { if (c) piMap[c] = r; } }

  for (const poIt of poItems) {
    let piIt = null;
    for (const c of poIt.alt_codes) { if (piMap[c]) { piIt = piMap[c]; break; } }
    if (!piIt) { console.log(poIt.item_code, '— no PI match'); continue; }

    const poQty = poIt.qty_ea ?? poIt.qty_ctn;
    const piQty = piIt.qty_ctn ?? piIt.qty_ea;
    const rawRatio = (poQty && piQty && poQty > piQty) ? poQty / piQty : null;
    const STD_PACKS = [10,20,25,50,100,200,250,500,1000];
    const snapPs = rawRatio ? STD_PACKS.find(p => Math.abs(rawRatio-p)/p < 0.10) || Math.round(rawRatio) : null;
    const ps = poIt.pack_size || piIt.pack_size || snapPs;

    console.log(poIt.item_code, {
      po_price_basis: poIt.price_basis,
      po_qty_ea: poIt.qty_ea, po_qty_ctn: poIt.qty_ctn, po_pack_size: poIt.pack_size,
      pi_qty_ea: piIt.qty_ea, pi_qty_ctn: piIt.qty_ctn, pi_pack_size: piIt.pack_size,
      rawRatio, snapPs, ps_used: ps,
      po_price: poIt.unit_price,
      po_normalised: poIt.price_basis === 'per_1000' && ps ? poIt.unit_price * (ps/1000) : poIt.unit_price,
      pi_price: piIt.unit_price,
    });
  }
  console.groupEnd();
  return { po, pi };
};
