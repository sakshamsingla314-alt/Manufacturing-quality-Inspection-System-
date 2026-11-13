// Manufacturing Quality Inspection System — records are saved in this browser (localStorage).
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const KEY = "qualityInspections";
let data = JSON.parse(localStorage.getItem(KEY) || "[]");
data.forEach((d, i) => { d.id = d.id || Date.now() + i; });

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const titles = {
  dashboard: ["Dashboard", "Monitor production quality and inspection results"],
  inspection: ["New Inspection", "Record a quality check for a product"],
  reports: ["Reports", "Search, filter, update and export inspection records"]
};

// ---------- navigation ----------
function show(view) {
  if (!titles[view]) view = "dashboard";
  $$(".view").forEach(s => s.hidden = s.id !== "view-" + view);
  $$(".nav a").forEach(a => a.classList.toggle("active", a.dataset.view === view));
  $("#pageTitle").textContent = titles[view][0];
  $("#pageSub").textContent = titles[view][1];
  document.body.classList.remove("menu-open");
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", () => show(location.hash.slice(1)));
$("#menuBtn").addEventListener("click", () => document.body.classList.toggle("menu-open"));

function toast(msg, bad) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast show" + (bad ? " bad" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.className = "toast", 2800);
}

// ---------- rendering ----------
const badge = r => `<span class="badge ${esc(r.toLowerCase())}">${esc(r)}</span>`;
const row = (d, full) => `<tr>
  <td><b>${esc(d.productName)}</b><small>${esc(d.productId)}</small></td>
  <td>${esc(d.inspectorName)}</td><td>${esc(d.defect)}</td>
  <td>${full
    ? `<select data-id="${d.id}">${["Pass","Fail","Pending"].map(o => `<option${o === d.result ? " selected" : ""}>${o}</option>`).join("")}</select>`
    : badge(d.result)}</td>
  ${full ? `<td>${esc(d.comments) || "—"}</td>` : ""}
  <td>${esc(d.date)}</td>
  ${full ? `<td><button class="del" data-del="${d.id}">Delete</button></td>` : ""}</tr>`;
const emptyRow = (cols, msg) => `<tr><td class="empty" colspan="${cols}">${msg}</td></tr>`;

function renderDashboard() {
  const count = r => data.filter(d => d.result === r).length;
  const pass = count("Pass"), fail = count("Fail");
  $("#total").textContent = data.length;
  $("#passed").textContent = pass;
  $("#failed").textContent = fail;
  $("#pending").textContent = count("Pending");
  const rate = pass + fail ? Math.round(pass / (pass + fail) * 100) : 0;
  $("#rate").textContent = rate + "%";
  $("#rateBar").style.width = rate + "%";

  const defects = {};
  data.forEach(d => { if (d.defect && d.defect !== "None") defects[d.defect] = (defects[d.defect] || 0) + 1; });
  const max = Math.max(1, ...Object.values(defects));
  $("#defectList").innerHTML = Object.keys(defects).length
    ? Object.entries(defects).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
        `<li><span>${esc(k)}</span><div class="bar"><i style="width:${v / max * 100}%"></i></div><b>${v}</b></li>`).join("")
    : '<li class="muted">No defects recorded.</li>';

  $("#recentBody").innerHTML = data.length
    ? data.slice(0, 5).map(d => row(d, false)).join("")
    : emptyRow(5, "No inspection records available.");
}

function filtered() {
  const q = $("#search").value.trim().toLowerCase(), f = $("#filter").value;
  return data.filter(d => (f === "All" || d.result === f) &&
    [d.productId, d.productName, d.inspectorName, d.defect, d.comments].join(" ").toLowerCase().includes(q));
}
function renderReports() {
  const list = filtered();
  $("#reportBody").innerHTML = list.length
    ? list.map(d => row(d, true)).join("")
    : emptyRow(7, data.length ? "No records match your search." : "No inspection records available.");
}

function refresh() {
  localStorage.setItem(KEY, JSON.stringify(data));
  renderDashboard(); renderReports();
}

// ---------- new inspection ----------
$("#inspectionForm").addEventListener("submit", e => {
  e.preventDefault();
  const v = id => $("#" + id).value.trim();
  const result = $('input[name="result"]:checked').value;
  const defect = $("#defect").value;
  ["productId", "productName", "inspectorName"].forEach(id => $("#" + id).parentElement.classList.toggle("err", !v(id)));
  if (!v("productId") || !v("productName") || !v("inspectorName"))
    return toast("Please fill Product ID, Product Name and Inspector Name.", true);
  if (result === "Fail" && defect === "None")
    return toast("A failed inspection needs a defect type.", true);
  if (result === "Pass" && defect !== "None")
    return toast("A passed product cannot have a defect. Choose 'No Defect' or mark it Fail.", true);

  data.unshift({
    id: Date.now(), productId: v("productId"), productName: v("productName"),
    inspectorName: v("inspectorName"), defect, result, comments: v("comments"),
    date: new Date().toLocaleString()
  });
  refresh();
  e.target.reset();
  toast("Inspection submitted successfully.");
  location.hash = "#reports";
});
$("#resetBtn").addEventListener("click", () => $$(".field.err").forEach(f => f.classList.remove("err")));

// ---------- reports: update, delete, filter, export, clear ----------
$("#reportBody").addEventListener("change", e => {
  if (!e.target.dataset.id) return;
  const item = data.find(d => d.id == e.target.dataset.id);
  if (item) { item.result = e.target.value; refresh(); toast("Result updated."); }
});
$("#reportBody").addEventListener("click", e => {
  const id = e.target.dataset.del;
  if (!id || !confirm("Are you sure you want to delete this inspection record?")) return;
  data = data.filter(d => d.id != id);
  refresh(); toast("Record deleted.");
});
$("#search").addEventListener("input", renderReports);
$("#filter").addEventListener("change", renderReports);

$("#exportBtn").addEventListener("click", () => {
  const list = filtered();
  if (!list.length) return toast("Nothing to export.", true);
  const cols = ["productId", "productName", "inspectorName", "defect", "result", "comments", "date"];
  const q = s => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...list.map(d => cols.map(c => q(d[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "inspection-report.csv";
  a.click(); URL.revokeObjectURL(a.href);
});
$("#clearBtn").addEventListener("click", () => {
  if (!data.length) return toast("No records to clear.", true);
  if (!confirm("Delete ALL inspection records? This cannot be undone.")) return;
  data = []; refresh(); toast("All records cleared.");
});

// ---------- start ----------
refresh();
show(location.hash.slice(1));
