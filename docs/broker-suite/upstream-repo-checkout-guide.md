# How I check out upstream Git repositories

**Scope:** Knowledge log for checking out / reading the exact source of the upstream repositories we use.
**Applies to:** `frappe/erpnext`, `frappe/crm`, `frappe/frappe`, `frappe/hrms`, `resilient-tech/india-compliance`, `evolution-foundation/evolution-api`.
**Goal:** Reliable way to read exact database/schema source in this sandbox.

---

## 1. What worked and what did not

| Access path | Result |
|---|---|
| `curl https://api.github.com/repos/frappe/erpnext` | ✅ Works |
| `curl https://github.com/frappe/erpnext/blob/...` | ✅ Works (HTML only) |
| `git ls-remote https://github.com/frappe/erpnext.git` | ✅ Works |
| `git clone https://github.com/...` | ✅ Works |
| `github.com/{owner}/{repo}/archive/...tar.gz` | ⚠️ Sometimes 404 depending on branch/tag |
| `curl https://raw.githubusercontent.com/...` | ❌ Fails (TLS `SSL_ERROR_SYSCALL`) |

**Rule:** Do **not** rely on `raw.githubusercontent.com`. Use `git clone` over HTTPS.

---

## 2. Clone commands used (pinned tags)

```bash
mkdir -p /tmp/refclones
cd /tmp/refclones

# Exact upstream source
git clone --depth 1 --branch v16.34.1 --single-branch https://github.com/frappe/erpnext.git
git clone --depth 1 --branch v1.83.0  --single-branch https://github.com/frappe/crm.git
git clone --depth 1 --branch v16.33.0 --single-branch https://github.com/frappe/frappe.git
git clone --depth 1 --branch 2.3.7   --single-branch https://github.com/evolution-foundation/evolution-api.git

# Optional repos
git clone --depth 1 --branch v16.17.1 --single-branch https://github.com/frappe/hrms.git
git clone --depth 1 --branch v16.9.0  --single-branch https://github.com/resilient-tech/india-compliance.git
```

Verify exact source after cloning:

```bash
cd /tmp/refclones
for d in */; do
  repo="${d%/}"
  printf "%-28s " "$repo"
  git -C "$repo" rev-parse --short HEAD
done
```

Expected pinned heads:

| Repo | Tag | HEAD |
|---|---|---|
| `erpnext` | v16.34.1 | `0b50853` |
| `crm` | v1.83.0 | `52c500d` |
| `frappe` | v16.33.0 | `33bf510` |
| `hrms` | v16.17.1 | `e1481b5` |
| `india-compliance` | v16.9.0 | `071b544` |
| `evolution-api` | 2.3.7 | `cd800f2` |

---

## 3. Issues faced and solutions

### Issue 1: `raw.githubusercontent.com` TLS failure

**Error:**
```
curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to raw.githubusercontent.com:443
```

**Attempted:** `curl` raw files for ERPNext DocTypes and Evolution's `schema.prisma`.

**Solution:**
- Use a normal `git clone` over HTTPS instead.
- GitHub serves the full source locally through the clone.
- Read actual files from the local clone.

---

### Issue 2: External clones inside the workspace did not persist

**What happened:** Cloned upstream repos into `forex/external/` and gitignored them. On a later turn, the directory was gone.

**Why:** The sandbox persists **tracked Git files**; untracked/ignored scratch folders (like `external/`) are **not preserved** between turns.

**Solution:**
- Clone into `/tmp` (scratch) for the current turn.
- Re-clone at the start of each session when source access is needed.
- Keep **reference notes in Git** (tracked docs) rather than relying on the clone being present.

---

### Issue 3: `file` command not available (minor)

**Seen:**
```
file: command not found
```

**Solution:** Not needed once `git clone` works. Use `ls`, `python3`, `grep`, etc.

---

### Issue 4: Evolution API Prisma file name was different

**Attempted:** `evolution-api/prisma/schema.prisma`

**Actual files in 2.3.7:**
```
prisma/postgresql-schema.prisma
prisma/mysql-schema.prisma
prisma/psql_bouncer-schema.prisma
```

**Solution:** list `prisma/` first, then read `postgresql-schema.prisma` (the one matching PostgreSQL).

---

### Issue 5: Frappe CRM DocType path was under `fcrm`

**Expected:** `crm/doctype/...`
**Actual for v1.83.0:** under `crm/fcrm/doctype/...`
Examples:
```
crm/fcrm/doctype/crm_lead/crm_lead.json
crm/fcrm/doctype/crm_deal/crm_deal.json
crm/fcrm/doctype/crm_call_log/crm_call_log.json
```

**Solution:** `find` the real doctype directories before reading.

---

### Issue 6: GitHub HTML pages are not reliable for exact source

**What happened:** `github.com/.../blob/...` returns mostly HTML/React markup, not clean source.

**Solution:** Read source from the local clone, or use the GitHub REST contents API if a clone is not possible.

---

## 4. Reliable formula for reading source

```
1. git clone --depth 1 --branch <exact-tag> --single-branch <upstream-url> <scratch-dir>
2. find . -path "*doctype*" -name "*.json"    # locate actual files
3. git rev-parse --short HEAD                  # confirm exact source
4. read JSON / Prisma / Python files directly
```

---

## 5. Files inspected (for our DB design)

**ERPNext v16.34.1**
```
erpnext/accounts/doctype/sales_invoice/sales_invoice.json
erpnext/accounts/doctype/sales_invoice_item/sales_invoice_item.json
erpnext/accounts/doctype/gl_entry/gl_entry.json
erpnext/accounts/doctype/payment_entry/payment_entry.json
erpnext/accounts/doctype/journal_entry/journal_entry.json
erpnext/accounts/doctype/journal_entry_account/journal_entry_account.json
erpnext/selling/doctype/customer/customer.json
erpnext/selling/doctype/quotation/quotation.json
erpnext/selling/doctype/quotation_item/quotation_item.json
erpnext/selling/doctype/sales_order/sales_order.json
erpnext/selling/doctype/sales_order_item/sales_order_item.json
erpnext/stock/doctype/item/item.json
erpnext/stock/doctype/item_price/item_price.json
erpnext/stock/doctype/bin/bin.json
erpnext/stock/doctype/stock_ledger_entry/stock_ledger_entry.json
```

**Frappe CRM v1.83.0**
```
crm/fcrm/doctype/crm_lead/crm_lead.json
crm/fcrm/doctype/crm_deal/crm_deal.json
crm/fcrm/doctype/crm_organization/crm_organization.json
crm/fcrm/doctype/crm_call_log/crm_call_log.json
crm/fcrm/doctype/crm_task/crm_task.json
crm/fcrm/doctype/fcrm_note/fcrm_note.json
crm/fcrm/doctype/erpnext_crm_settings/erpnext_crm_settings.json
```

**Frappe v16.33.0**
```
frappe/model/document.py     # confirms standard Document columns
```

**Evolution API 2.3.7**
```
evolution-api/prisma/postgresql-schema.prisma
```

---

## 6. Recommended persistent layout

```text
/tmp/refclones/
├── erpnext/
├── crm/
├── frappe/
├── hrms/
├── india-compliance/
└── evolution-api/
```

And keep tracked reference docs in Git (e.g. `repositories-and-db-sharing-design.md`) — those persist and do not depend on scratch clones.

---

## 7. One-line summary

> Use `git clone --depth 1 --branch <tag> --single-branch <url>` into `/tmp`, locate real files with `find`, confirm with `git rev-parse --short HEAD`, and read the source directly. Don't rely on `raw.githubusercontent.com` or GitHub HTML.
