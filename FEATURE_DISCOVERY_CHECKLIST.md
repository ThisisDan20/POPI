# PO ↔ PI App Discovery Checklist

Use this tracker to gather everything needed before build.

## Legend
- 🟢 Done
- 🟡 Partial / TBD
- 🔴 Needed

## 1) Core Workflow
- 🟢 Compare PO to PI using **PO number as primary reference**.
- 🟢 Accept match within **quantity tolerance = 5%**.
- 🟢 If quantity is above tolerance, **flag for manual check**.
- 🟢 If user gives manual approval, **proceed as confirmed OK**.
- 🟢 Show **checks passed / failed** summary.
- 🟢 **Highlight errors** in UI.

## 2) File Intake & Input Methods
- 🟢 Drag-and-drop upload.
- 🟢 Click-to-upload fallback.
- 🟢 Upload multiple files in one batch.
- 🟢 Support PI input types: PDF, Excel, scanned/image PDF.
- 🟢 Support optional **paste PO data** from Epicor 9.
- 🟢 Set max file size to **5MB**.
- 🟢 Support **CSV** in addition to Excel.
- 🟡 Set max files per batch (recommended start: **20 files**) to protect performance; tune after pilot usage.

## 3) Matching & Validation Rules
- 🟢 Check **payment terms match**.
- 🟢 Compare required core fields:
  - PO number
  - item code
  - qty
  - price per item
  - cost per line (qty × cost = line total)
  - total PO/PI cost
  - payment terms match
- 🟢 Mandatory exact-match fields: PO number, item code, currency, incoterms, unit price, line total, total document cost, payment terms (**exclude tax**).
- 🟢 Fuzzy-match fields: supplier name (not always exact on PO) and item description text (set similarity threshold during testing).
- 🟢 Tolerance policy: **5% for quantity** checks; no tax/freight checks required.
- 🟡 Split/merged PI lines are not expected in normal operations; keep as edge-case handling item for testing only.
- 🟢 Add unit-of-measure handling for differences (e.g., PO in **per 1000 pcs** or **each**, PI in **carton qty**).
- 🟢 Conversion check method: validate line price total, then derive per-1000/each value from carton quantity using `1000pcs price × cartons` (or inverse divide) for cross-checking.

## 4) Signing & Post-Match Actions
- 🟢 When PO/PI match, generate **signed PI workflow**.
- 🟢 Provide downloadable **signed-PI PDF link**.
- 🟢 Signing can be typed confirmation data (digital compliance signature not required for this supplier-confirmation workflow).
- 🟢 Locate PI signature area by scanning for terms like **buyer**, **signer**, **signed**, **approval**.
- 🟢 If keyword anchor is found, place signature block near that location on page.
- 🟡 Decide fallback position if no signature keywords are detected.
- 🟢 Signing occurs in-app only (no external tool integration required).
- 🟢 Include signing metadata in signed PI:
  - user
  - company
  - date
  - confirmation of PI approval
- 🟢 Compliance requirement is lightweight: typed confirmation is acceptable; no advanced digital certificate requirement.

## 5) Organization & Approver Selection
- 🟢 Let user choose signer.
- 🟢 Let user choose company:
  - Huhtamaki Henderson Ltd
  - Huhtamaki Australia Pty Ltd.
  - Huhtamaki Foodservice Packaging, Oceania
- 🟢 Each company has its own signer list; templates and rules are shared across companies.
- 🟢 No permission model required beyond selecting the signer for the chosen company.

## 6) Results and Data Retention
- 🟢 Display detailed fail/pass check list.
- 🟢 No downloadable reports required.
- 🟢 No audit trail required.
- 🟢 Delete uploaded and signed files when webpage/session is closed.


## 6A) Compliance Confirmation (Human Verification)
- 🟢 Add a random **quick-check quiz** step for user confirmation before final approval.
- 🟢 Quiz prompts user to verify selected PO fields against PI fields (e.g., PO number, payment terms, key line values).
- 🟢 Quiz size: **2–3 random checks** per triggered compliance event.
- 🟢 Quiz is a periodic compliance control (not risk-based); trigger after a random upload count within **10–12 uploaded files**.

## 7) Epicor 9 Integration Details
- 🟢 Need ability to paste PO data from Epicor 9.
- 🟢 Parse E9-style pasted columns including: `Line`, `CalcDueDate`, `Part`, `Supplier Part`, `Description`, `Our Quantity`, `Unit Price`, `Supplier Quantity`, `Supplier Extended Price`.
- 🟢 Treat `Supplier Extended Price` as line total for PI cross-checking.
- 🟢 Handle UOM mapping from example patterns (e.g., supplier quantity in eaches, internal price per 1000 pcs, item pack size such as carton of 500 pcs).
- 🟢 Due-date proximity check: if PI includes a ready date, add typical shipping time (~30 days) and compare with PO due date for closeness.
- 🟢 No API integration required.

## 8) Open Decisions for You
- 🟢 Tolerance scope: **line-level only** (header-level tolerance not required).
- 🟢 Matching strictness: auto-pass when checks pass; manual review path required when qty exceeds tolerance.
- 🟢 Signature trigger: if checks pass, **auto-sign**.
- 🟢 Multi-batch behavior: pass items auto-sign; failed items go to manual checks individually.
- 🟢 No email/Teams notifications required.
- 🟢 Keep a local folder-based upload counter and randomly trigger compliance quiz when counter hits a randomized threshold in the 10–12 range; reset and repeat.

## 9) Sensitive Data & Local Testing
- 🟢 Run parsing/comparison locally so confidential values do not leave your environment.
- 🟢 Confirmed: no PO/PI data is transmitted outside the local machine in local-folder mode.
- 🟢 Use sanitized test fixtures (masked supplier, PO, and pricing values) for development and demos.
- 🟢 Add a local-only config mode (`.env.local`) for file paths, signer test accounts, and feature flags.
- 🟢 Keep signed outputs and uploads on local/internal storage (no external transfer by default).
- 🟢 Target locked-down enterprise environment compatibility; avoid browser features commonly blocked by policy (e.g., `worker.js`) unless optional fallback exists.
- 🟢 Delivery preference: run locally from a folder (files + HTML app), no Docker requirement.
- 🟢 Deployment model: fully local folder-based usage only; no cloud environment required.

---

## Suggested MVP Scope (first build)
- File upload (drag/drop + click), including batch upload.
- Parse PO + PI (PDF/Excel/scanned PDF).
- Match by PO number + key checks (qty tolerance, payment terms, basic totals).
- Visual pass/fail discrepancy panel.
- Company + signer selection.
- Signed-PI generation flow + signed PDF download link.
