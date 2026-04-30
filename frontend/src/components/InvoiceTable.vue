<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  fetchInvoices,
  getInvoiceDownloadUrl,
  getInvoiceExcelUrl,
  scanInvoices,
  type InvoiceRow,
} from "../services/invoiceApi";

const rows = ref<InvoiceRow[]>([]);
const loading = ref(false);
const scanning = ref(false);
const error = ref<string | null>(null);
const selectedFiles = ref<File[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);

const hasRows = computed(() => rows.value.length > 0);
const MISSING_VALUE_LABEL = "not provided";

async function loadData() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await fetchInvoices();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unexpected error";
  } finally {
    loading.value = false;
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedFiles.value = Array.from(input.files ?? []);
}

async function scanSelectedFiles() {
  if (!selectedFiles.value.length) {
    error.value = "Seleziona almeno un PDF prima di fare scan.";
    return;
  }

  scanning.value = true;
  error.value = null;
  try {
    await scanInvoices(selectedFiles.value);
    await loadData();
    selectedFiles.value = [];
    if (fileInputRef.value) {
      fileInputRef.value.value = "";
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unexpected error";
  } finally {
    scanning.value = false;
  }
}

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return MISSING_VALUE_LABEL;
  return isoDate;
}

onMounted(loadData);
</script>

<template>
  <section class="invoice-table-wrap">
    <header class="header">
      <div>
        <h2>Invoices</h2>
        <p class="subtitle">Upload PDF invoices, scan, and export results.</p>
      </div>
      <div class="toolbar">
        <input
          ref="fileInputRef"
          class="file-input"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          :disabled="scanning"
          @change="onFileChange"
        />
        <button class="scan" :disabled="scanning || !selectedFiles.length" @click="scanSelectedFiles">
          {{ scanning ? "Scanning..." : "Scan" }}
        </button>
        <button class="refresh" :disabled="loading" @click="loadData">
          {{ loading ? "Loading..." : "Refresh" }}
        </button>
      </div>
    </header>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="loading" class="info">Loading invoices...</p>
    <p v-else-if="!hasRows" class="info">No invoices found.</p>

    <div v-else class="table-card">
      <table class="invoice-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Invoice Number</th>
            <th>Shipper</th>
            <th>Consignee</th>
            <th>Date</th>
            <th>HS Code</th>
            <th>Weight</th>
            <th>Packages</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.file_name }}</td>
            <td>{{ row.invoice_number || MISSING_VALUE_LABEL }}</td>
            <td>{{ row.shipper?.name || MISSING_VALUE_LABEL }}</td>
            <td>{{ row.consignee?.name || MISSING_VALUE_LABEL }}</td>
            <td>{{ formatDate(row.invoice_date) }}</td>
            <td>{{ row.hs_code || MISSING_VALUE_LABEL }}</td>
            <td>{{ row.gross_weight_kg ?? MISSING_VALUE_LABEL }}</td>
            <td>{{ row.package_count || MISSING_VALUE_LABEL }}</td>
            <td class="actions">
              <button @click="openInNewTab(getInvoiceDownloadUrl(row.id))">
                Download PDF
              </button>
              <button @click="openInNewTab(getInvoiceExcelUrl(row.id))">
                Export Excel
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.invoice-table-wrap {
  padding: 1.25rem;
  font-family: Inter, system-ui, sans-serif;
  background: linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%);
  border-radius: 14px;
}
h2 {
  margin: 0;
  color: #0f172a;
}
.subtitle {
  margin: 0.2rem 0 0;
  color: #64748b;
  font-size: 0.9rem;
}
.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.1rem;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.file-input {
  font-size: 0.82rem;
  color: #334155;
}
button {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  font-weight: 600;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.15s ease;
}
button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.refresh {
  padding: 0.46rem 0.8rem;
}
.scan {
  padding: 0.46rem 0.8rem;
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
.error {
  color: #b00020;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  margin-bottom: 0.9rem;
}
.info {
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
}
.table-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(2, 6, 23, 0.06);
}
.invoice-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.invoice-table th,
.invoice-table td {
  border-bottom: 1px solid #eef2f7;
  text-align: left;
  padding: 0.72rem 0.62rem;
  vertical-align: top;
  font-size: 0.92rem;
}
.invoice-table th {
  background: #f8fafc;
  color: #334155;
  font-weight: 700;
}
.invoice-table tbody tr:hover {
  background: #f8fbff;
}
.invoice-table tbody tr:last-child td {
  border-bottom: none;
}
.actions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.actions button {
  padding: 0.35rem 0.55rem;
  font-size: 0.78rem;
}
@media (max-width: 980px) {
  .header {
    flex-direction: column;
  }
  .table-card {
    overflow-x: auto;
  }
  .invoice-table {
    min-width: 900px;
  }
}
</style>
