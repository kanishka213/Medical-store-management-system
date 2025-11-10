/* ==========
  Medical Store Management (LocalStorage)
  Features:
  - Medicines CRUD
  - Sales (cart/bill) with stock updates
  - Sales history + date/name filters + revenue
  - Export CSV/JSON (Medicines & Sales)
========== */

const LS = {
  MEDS: "ms_medicines_v1",
  SALES: "ms_sales_v1",
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmt = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

// storage helpers
const load = (k, fb) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v ?? fb;
  } catch {
    return fb;
  }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// seed data (first run)
function ensureSeed() {
  let meds = load(LS.MEDS, null);
  if (!meds || !Array.isArray(meds) || meds.length === 0) {
    meds = [
      {
        id: uid(),
        name: "Paracetamol 500mg",
        category: "Tablet",
        batch: "PARA-01",
        expiry: "2026-03-31",
        supplier: "ACME Pharma",
        price: 18.5,
        mrp: 25,
        stock: 120,
        createdAt: Date.now(),
      },
      {
        id: uid(),
        name: "Cough Syrup 100ml",
        category: "Syrup",
        batch: "CS-22A",
        expiry: "2026-11-30",
        supplier: "Wellness Labs",
        price: 55,
        mrp: 70,
        stock: 60,
        createdAt: Date.now(),
      },
      {
        id: uid(),
        name: "Vitamin C 1000mg",
        category: "Tablet",
        batch: "VC-1000",
        expiry: "2027-01-15",
        supplier: "NutriCare",
        price: 3.2,
        mrp: 5,
        stock: 500,
        createdAt: Date.now(),
      },
    ];
    save(LS.MEDS, meds);
  }
  let sales = load(LS.SALES, null);
  if (!sales) save(LS.SALES, []);
}

ensureSeed();

/* ==========
  Tabs
========== */
function initTabs() {
  $$(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach((b) => b.classList.remove("active"));
      $$(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $("#" + btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "sales") {
        populateSalesSelect();
        renderBill();
        renderQuickInfo();
      }
      if (btn.dataset.tab === "history") {
        renderSalesHistory();
      }
      if (btn.dataset.tab === "inventory") {
        renderMedTable();
      }
    });
  });
}

/* ==========
  Inventory: CRUD + Filters
========== */
function getMeds() {
  return load(LS.MEDS, []);
}
function setMeds(arr) {
  save(LS.MEDS, arr);
}
function addMed(m) {
  const meds = getMeds();
  meds.push(m);
  setMeds(meds);
}
function updateMed(m) {
  const meds = getMeds().map((x) => (x.id === m.id ? m : x));
  setMeds(meds);
}
function deleteMed(id) {
  setMeds(getMeds().filter((m) => m.id !== id));
}

function readForm() {
  return {
    id: $("#medId").value || uid(),
    name: $("#name").value.trim(),
    category: $("#category").value.trim(),
    batch: $("#batch").value.trim(),
    expiry: $("#expiry").value || "",
    supplier: $("#supplier").value.trim(),
    price: parseFloat($("#price").value || "0"),
    mrp: parseFloat($("#mrp").value || "0"),
    stock: parseInt($("#stock").value || "0", 10),
    createdAt: Date.now(),
  };
}

function fillForm(med) {
  $("#medId").value = med.id;
  $("#name").value = med.name;
  $("#category").value = med.category || "";
  $("#batch").value = med.batch || "";
  $("#expiry").value = med.expiry || "";
  $("#supplier").value = med.supplier || "";
  $("#price").value = med.price ?? "";
  $("#mrp").value = med.mrp ?? "";
  $("#stock").value = med.stock ?? "";
  $("#formTitle").textContent = "Edit Medicine";
}

function resetForm() {
  $("#medicineForm").reset();
  $("#medId").value = "";
  $("#formTitle").textContent = "Add Medicine";
}

function renderMedTable() {
  const tbody = $("#medTable tbody");
  const search = $("#search").value.trim().toLowerCase();
  const cat = $("#catFilter").value.trim().toLowerCase();
  const stockFilter = $("#stockFilter").value;

  const now = todayISO();
  let meds = getMeds();

  meds = meds.filter((m) => {
    const exp = (m.expiry || "9999-12-31") < now;
    const matchSearch =
      !search ||
      m.name.toLowerCase().includes(search) ||
      (m.batch || "").toLowerCase().includes(search) ||
      (m.supplier || "").toLowerCase().includes(search);
    const matchCat = !cat || (m.category || "").toLowerCase().includes(cat);
    const matchStock =
      !stockFilter ||
      (stockFilter === "in" && m.stock > 0) ||
      (stockFilter === "low" && m.stock > 0 && m.stock <= 5) ||
      (stockFilter === "out" && m.stock <= 0) ||
      (stockFilter === "expired" && exp);

    return matchSearch && matchCat && matchStock;
  });

  tbody.innerHTML = meds
    .map((m) => {
      const exp = (m.expiry || "9999-12-31") < now;
      return `
      <tr>
        <td>${m.name}</td>
        <td>${m.category || "-"}</td>
        <td>${m.batch || "-"}</td>
        <td${exp ? ' class="muted"' : ""}>${m.expiry || "-"}</td>
        <td>${fmt(m.price)}</td>
        <td>${m.stock}</td>
        <td>${m.supplier || "-"}</td>
        <td>
          <button class="btn small" data-edit="${m.id}">Edit</button>
          <button class="btn small danger" data-del="${m.id}">Delete</button>
        </td>
      </tr>`;
    })
    .join("");

  $("#medCount").textContent = `${meds.length} medicine(s)`;
}

function bindInventory() {
  $("#medicineForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = readForm();
    if (!data.name) return alert("Name is required");
    if (data.price < 0 || data.stock < 0) return alert("Invalid numbers");

    const editing = !!$("#medId").value;
    if (editing) {
      // preserve createdAt
      const old = getMeds().find((x) => x.id === data.id);
      data.createdAt = old?.createdAt || Date.now();
      updateMed(data);
    } else {
      addMed(data);
    }
    resetForm();
    renderMedTable();
    populateSalesSelect();
  });

  $("#resetFormBtn").addEventListener("click", (e) => {
    e.preventDefault();
    resetForm();
  });

  $("#medTable").addEventListener("click", (e) => {
    const editId = e.target.getAttribute("data-edit");
    const delId = e.target.getAttribute("data-del");
    if (editId) {
      const m = getMeds().find((x) => x.id === editId);
      if (m) fillForm(m);
    }
    if (delId) {
      if (confirm("Delete this medicine?")) {
        deleteMed(delId);
        renderMedTable();
        populateSalesSelect();
      }
    }
  });

  ["search", "catFilter", "stockFilter"].forEach((id) =>
    $("#" + id).addEventListener("input", renderMedTable)
  );
}

/* ==========
  Sales (Bill) & Quick Info
========== */
let billItems = []; // [{medId, name, price, qty}]

function populateSalesSelect() {
  const sel = $("#saleMedSelect");
  const meds = getMeds().sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML =
    `<option value="">Select medicine...</option>` +
    meds
      .map(
        (m) =>
          `<option value="${m.id}">${m.name} (₹${m.price} | stock ${m.stock})</option>`
      )
      .join("");
  updateSaleInfo();
}

function updateSaleInfo() {
  const id = $("#saleMedSelect").value;
  const info = $("#saleMedInfo");
  if (!id) {
    info.textContent = "Select a medicine to view price and stock.";
    return;
  }
  const m = getMeds().find((x) => x.id === id);
  if (!m) return;
  info.textContent = `Price: ${fmt(m.price)} · Stock: ${m.stock} · Exp: ${
    m.expiry || "-"
  }`;
}

function addItemToBill() {
  const id = $("#saleMedSelect").value;
  const qty = parseInt($("#saleQty").value || "1", 10);
  if (!id) return alert("Select a medicine");
  if (qty <= 0) return alert("Quantity must be at least 1");

  const meds = getMeds();
  const m = meds.find((x) => x.id === id);
  if (!m) return alert("Medicine not found");
  if (m.stock < qty) return alert("Not enough stock");

  const existing = billItems.find((x) => x.medId === id);
  if (existing) existing.qty += qty;
  else billItems.push({ medId: id, name: m.name, price: m.price, qty });

  renderBill();
}

function removeBillItem(id) {
  billItems = billItems.filter((x) => x.medId !== id);
  renderBill();
}

function billTotal() {
  return billItems.reduce((s, x) => s + x.price * x.qty, 0);
}

function renderBill() {
  const tbody = $("#billTable tbody");
  tbody.innerHTML = billItems
    .map(
      (x) => `
    <tr>
      <td>${x.name}</td>
      <td>${fmt(x.price)}</td>
      <td>${x.qty}</td>
      <td>${fmt(x.price * x.qty)}</td>
      <td><button class="btn small danger" data-rm="${x.medId}">Remove</button></td>
    </tr>`
    )
    .join("");
  $("#billTotal").innerHTML = `<strong>${fmt(billTotal())}</strong>`;
}

function processSale() {
  if (billItems.length === 0) return alert("Bill is empty");
  const meds = getMeds();
  // verify stock again
  for (const item of billItems) {
    const m = meds.find((x) => x.id === item.medId);
    if (!m || m.stock < item.qty) {
      return alert(`Insufficient stock for ${item?.name || "item"}`);
    }
  }
  // deduct stock
  for (const item of billItems) {
    const idx = meds.findIndex((x) => x.id === item.medId);
    meds[idx].stock -= item.qty;
  }
  setMeds(meds);

  // save sale
  const sale = {
    id: uid(),
    ts: Date.now(),
    items: billItems.map((x) => ({
      medId: x.medId,
      name: x.name,
      qty: x.qty,
      price: x.price,
      total: x.qty * x.price,
    })),
    total: billTotal(),
  };
  const sales = load(LS.SALES, []);
  sales.push(sale);
  save(LS.SALES, sales);

  // reset bill
  billItems = [];
  renderBill();
  renderMedTable();
  populateSalesSelect();
  renderQuickInfo();

  alert("Sale processed!");
}

function clearBill() {
  billItems = [];
  renderBill();
}

function renderQuickInfo() {
  const meds = getMeds();
  const low = meds.filter((m) => m.stock > 0 && m.stock <= 5).length;
  const out = meds.filter((m) => m.stock <= 0).length;
  const exp = meds.filter((m) => (m.expiry || "9999-12-31") < todayISO()).length;
  $("#quickInfo").innerHTML = `
    <div class="row"><div>Total items: <strong>${meds.length}</strong></div></div>
    <div class="row"><div>Low stock (≤5): <strong>${low}</strong></div></div>
    <div class="row"><div>Out of stock: <strong>${out}</strong></div></div>
    <div class="row"><div>Expired: <strong>${exp}</strong></div></div>
  `;
}

function bindSales() {
  $("#saleMedSelect").addEventListener("change", updateSaleInfo);
  $("#saleQty").addEventListener("input", () => {
    const v = parseInt($("#saleQty").value || "1", 10);
    if (v < 1) $("#saleQty").value = 1;
  });
  $("#addToBill").addEventListener("click", addItemToBill);
  $("#billTable").addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-rm");
    if (id) removeBillItem(id);
  });
  $("#processSale").addEventListener("click", processSale);
  $("#clearBill").addEventListener("click", clearBill);
}

/* ==========
  Sales History + Revenue
========== */
function getSales() {
  return load(LS.SALES, []);
}

function renderSalesHistory() {
  const tbody = $("#salesTable tbody");
  const from = $("#fromDate").value ? new Date($("#fromDate").value) : null;
  const to = $("#toDate").value ? new Date($("#toDate").value + "T23:59:59") : null;
  const q = $("#historySearch").value.trim().toLowerCase();

  let sales = getSales().slice().sort((a, b) => b.ts - a.ts);

  if (from) sales = sales.filter((s) => s.ts >= from.getTime());
  if (to) sales = sales.filter((s) => s.ts <= to.getTime());
  if (q) {
    sales = sales.filter((s) =>
      s.items.some((it) => it.name.toLowerCase().includes(q))
    );
  }

  let totalQty = 0;
  let revenue = 0;

  tbody.innerHTML = sales
    .map((s) => {
      const qty = s.items.reduce((a, it) => a + it.qty, 0);
      totalQty += qty;
      revenue += s.total;
      const items = s.items
        .map((it) => `${it.name} × ${it.qty}`)
        .join(", ");
      return `
        <tr>
          <td>${new Date(s.ts).toLocaleString()}</td>
          <td>${items}</td>
          <td>${qty}</td>
          <td>${fmt(s.total)}</td>
        </tr>`;
    })
    .join("");

  $("#revenueCell").innerHTML = `<strong>${fmt(revenue)}</strong>`;
}

function bindHistory() {
  ["fromDate", "toDate", "historySearch"].forEach((id) =>
    $("#" + id).addEventListener("input", renderSalesHistory)
  );
}

/* ==========
  Export CSV/JSON
========== */
function asCSV(rows) {
  // rows: array of plain objects
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) =>
    String(v ?? "")
      .replace(/"/g, '""')
      .replace(/\n/g, " ");
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => `"${esc(r[h])}"`).join(","));
  }
  return lines.join("\n");
}

function download(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMedicinesCSV() {
  const meds = getMeds();
  const rows = meds.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    batch: m.batch,
    expiry: m.expiry,
    supplier: m.supplier,
    price: m.price,
    mrp: m.mrp,
    stock: m.stock,
    createdAt: new Date(m.createdAt).toISOString(),
  }));
  download("medicines.csv", asCSV(rows), "text/csv");
}

function exportMedicinesJSON() {
  download("medicines.json", JSON.stringify(getMeds(), null, 2), "application/json");
}

function exportSalesCSV() {
  const sales = getSales();
  // flatten items
  const rows = [];
  for (const s of sales) {
    for (const it of s.items) {
      rows.push({
        saleId: s.id,
        ts: new Date(s.ts).toISOString(),
        item: it.name,
        qty: it.qty,
        price: it.price,
        total: it.total,
        billTotal: s.total,
      });
    }
  }
  download("sales.csv", asCSV(rows), "text/csv");
}

function exportSalesJSON() {
  download("sales.json", JSON.stringify(getSales(), null, 2), "application/json");
}

function bindExport() {
  $("#exportMedCSV").addEventListener("click", exportMedicinesCSV);
  $("#exportMedJSON").addEventListener("click", exportMedicinesJSON);
  $("#exportSalesCSV").addEventListener("click", exportSalesCSV);
  $("#exportSalesJSON").addEventListener("click", exportSalesJSON);
}

/* ==========
  Boot
========== */
function boot() {
  $("#year").textContent = new Date().getFullYear();
  initTabs();

  // Inventory
  bindInventory();
  renderMedTable();

  // Sales
  bindSales();
  populateSalesSelect();
  renderBill();
  renderQuickInfo();

  // History
  bindHistory();
  renderSalesHistory();

  // Export
  bindExport();
}

document.addEventListener("DOMContentLoaded", boot);
