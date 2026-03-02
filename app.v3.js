/*
  3D-Druck Preiskalkulator
  - Statisches Tool (kein Backend)
  - Persistenz via localStorage
  - Formeln bewusst simpel/transparent gehalten

  Annahmen/Formeln:
  - Print time (h): hours + minutes/60 OR totalMinutes/60 (falls angegeben)
  - Materialkosten: (gewicht_g/1000) * (€/kg) * (1 + materialLossPct/100)
  - Maschinenkosten: print_h * maschinenrate_€/h
  - Stromkosten: (power_W/1000) * print_h * €/kWh
  - Setup/Rüstkosten: Fixbetrag pro Job / Stückzahl
  - Designkosten pro Stück: (design_h * 70€/h) / stückzahl
  - Overhead (%): erhöht die Kostenbasis (1 + overheadPct/100)
  - Gewinnmarge (%): danach aufschlagen (1 + margin/100)
  - Rundung: finaler Preis auf roundingStep runden (optional)
*/

const DESIGN_RATE_EUR_PER_HOUR = 70;

const DEFAULTS = {
  projectName: "",
  materialPreset: "ASA",
  materialEurPerKg: 30.0,
  weightG: 120.0,
  materialLossPct: 8.0,
  printHours: 3,
  printMinutes: 30,
  printTotalMinutes: 0,
  machineEurPerHour: 1.0,
  electricityEurPerKwh: 0.30,
  printerPowerW: 120,
  setupCostEur: 10.0,
  overheadPct: 10.0,
  profitMarginPct: 25.0,
  vatPct: 20.0,
  roundingStep: 0.05,
  designHours: 1.0,
  quantity: 1
};

const MATERIAL_PRESETS = {
  PLA:  { label: "PLA",  eurPerKg: 22.0 },
  PETG: { label: "PETG", eurPerKg: 26.0 },
  ABS:  { label: "ABS",  eurPerKg: 28.0 },
  TPU:  { label: "TPU",  eurPerKg: 35.0 },
  ASA:  { label: "ASA",  eurPerKg: 30.0 },
  RESIN:{ label: "Resin",eurPerKg: 55.0 }
};

const $ = (id) => document.getElementById(id);

const fields = {
  projectName: $("projectName"),
  materialPreset: $("materialPreset"),
  materialEurPerKg: $("materialEurPerKg"),
  weightG: $("weightG"),
  materialLossPct: $("materialLossPct"),
  printHours: $("printHours"),
  printMinutes: $("printMinutes"),
  printTotalMinutes: $("printTotalMinutes"),
  machineEurPerHour: $("machineEurPerHour"),
  electricityEurPerKwh: $("electricityEurPerKwh"),
  printerPowerW: $("printerPowerW"),
  setupCostEur: $("setupCostEur"),
  overheadPct: $("overheadPct"),
  profitMarginPct: $("profitMarginPct"),
  vatPct: $("vatPct"),
  roundingStep: $("roundingStep"),
  designHours: $("designHours"),
  quantity: $("quantity"),
  profileName: $("profileName"),
  profileSelect: $("profileSelect"),
  saveProfileBtn: $("saveProfileBtn"),
  deleteProfileBtn: $("deleteProfileBtn"),
  resetBtn: $("resetBtn"),
  themeToggle: $("themeToggle"),
  offerPresetBtn: $("offerPresetBtn"),
  exportCsvBtn: $("exportCsvBtn"),
  exportPdfBtn: $("exportPdfBtn"),
  finalPrice: $("finalPrice"),
  projectNameDisplay: $("projectNameDisplay"),
  breakdown: $("breakdown")
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function eur(n) {
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(n);
}

function roundToStep(value, step) {
  const s = Math.max(0, step);
  if (!s) return value;
  return Math.round(value / s) * s;
}

function hoursFromInputs(h, m, totalMin) {
  const total = toNumber(totalMin, 0);
  if (total > 0) return total / 60;
  const hh = Math.max(0, toNumber(h, 0));
  const mm = clamp(toNumber(m, 0), 0, 59);
  return hh + mm / 60;
}

function readState() {
  return {
    projectName: fields.projectName.value,
    materialPreset: fields.materialPreset.value,
    materialEurPerKg: toNumber(fields.materialEurPerKg.value, 0),
    weightG: toNumber(fields.weightG.value, 0),
    materialLossPct: toNumber(fields.materialLossPct.value, 0),
    printHours: toNumber(fields.printHours.value, 0),
    printMinutes: toNumber(fields.printMinutes.value, 0),
    printTotalMinutes: toNumber(fields.printTotalMinutes.value, 0),
    machineEurPerHour: toNumber(fields.machineEurPerHour.value, 0),
      electricityEurPerKwh: toNumber(fields.electricityEurPerKwh.value, 0),
    printerPowerW: toNumber(fields.printerPowerW.value, 0),
    setupCostEur: toNumber(fields.setupCostEur.value, 0),
    overheadPct: toNumber(fields.overheadPct.value, 0),
    profitMarginPct: toNumber(fields.profitMarginPct.value, 0),
    vatPct: toNumber(fields.vatPct.value, 0),
    roundingStep: toNumber(fields.roundingStep.value, 0),
    designHours: toNumber(fields.designHours.value, 0),
    quantity: Math.max(1, Math.floor(toNumber(fields.quantity.value, 1)))
  };
}

function saveState(state) {
  localStorage.setItem("tars_3d_calc_v3", JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem("tars_3d_calc_v3");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

// Theme
const THEME_KEY = "tars_3d_theme";

function setTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem(THEME_KEY, mode);
  if (fields.themeToggle) {
    fields.themeToggle.textContent = mode === "light" ? "Dark" : "Light";
  }
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY) || "dark";
  setTheme(stored);
  if (fields.themeToggle) {
    fields.themeToggle.addEventListener("click", () => {
      const next = (document.documentElement.getAttribute("data-theme") === "light") ? "dark" : "light";
      setTheme(next);
    });
  }
}

function applyState(state) {
  fields.projectName.value = state.projectName ?? DEFAULTS.projectName;
  fields.materialPreset.value = state.materialPreset ?? DEFAULTS.materialPreset;
  fields.materialEurPerKg.value = state.materialEurPerKg ?? DEFAULTS.materialEurPerKg;
  fields.weightG.value = state.weightG ?? DEFAULTS.weightG;
  fields.materialLossPct.value = state.materialLossPct ?? DEFAULTS.materialLossPct;
  fields.printHours.value = state.printHours ?? DEFAULTS.printHours;
  fields.printMinutes.value = state.printMinutes ?? DEFAULTS.printMinutes;
  fields.printTotalMinutes.value = state.printTotalMinutes ?? DEFAULTS.printTotalMinutes;
  fields.machineEurPerHour.value = state.machineEurPerHour ?? DEFAULTS.machineEurPerHour;
  fields.electricityEurPerKwh.value = state.electricityEurPerKwh ?? DEFAULTS.electricityEurPerKwh;
  fields.printerPowerW.value = state.printerPowerW ?? DEFAULTS.printerPowerW;
  fields.setupCostEur.value = state.setupCostEur ?? DEFAULTS.setupCostEur;
  fields.overheadPct.value = state.overheadPct ?? DEFAULTS.overheadPct;
  fields.profitMarginPct.value = state.profitMarginPct ?? DEFAULTS.profitMarginPct;
  fields.vatPct.value = state.vatPct ?? DEFAULTS.vatPct;
  fields.roundingStep.value = state.roundingStep ?? DEFAULTS.roundingStep;
  fields.designHours.value = state.designHours ?? DEFAULTS.designHours;
  fields.quantity.value = state.quantity ?? DEFAULTS.quantity;
}

function calc(state) {
  const printH = hoursFromInputs(state.printHours, state.printMinutes, state.printTotalMinutes);
  const weightKg = Math.max(0, state.weightG) / 1000;

  const materialLossFactor = 1 + Math.max(0, state.materialLossPct) / 100;
  const materialCost = weightKg * Math.max(0, state.materialEurPerKg) * materialLossFactor;
  const machineCost = printH * Math.max(0, state.machineEurPerHour);
  const powerKw = Math.max(0, state.printerPowerW) / 1000;
  const electricityCost = powerKw * printH * Math.max(0, state.electricityEurPerKwh);

  const setupCostPerUnit = Math.max(0, state.setupCostEur) / Math.max(1, state.quantity);

  const designTotal = Math.max(0, state.designHours) * DESIGN_RATE_EUR_PER_HOUR;
  const designPerUnit = designTotal / Math.max(1, state.quantity);

  const base = materialCost + machineCost + electricityCost + setupCostPerUnit + designPerUnit;

  const overheadFactor = 1 + Math.max(0, state.overheadPct) / 100;
  const withOverhead = base * overheadFactor;

  const marginFactor = 1 + Math.max(0, state.profitMarginPct) / 100;
  const finalRaw = withOverhead * marginFactor; // Netto vor Rundung
  const finalNet = roundToStep(finalRaw, state.roundingStep);

  const vatFactor = 1 + Math.max(0, state.vatPct) / 100;
  const finalGross = roundToStep(finalNet * vatFactor, state.roundingStep);

  return {
    printH,
    materialCost,
    machineCost,
    electricityCost,
    setupCostPerUnit,
    designPerUnit,
    base,
    overheadFactor,
    withOverhead,
    marginFactor,
    finalRaw,
    finalNet,
    finalGross
  };
}

function render(state) {
  const r = calc(state);

  fields.finalPrice.textContent = eur(r.finalNet);
  if (fields.projectNameDisplay) {
    fields.projectNameDisplay.textContent = `Projekt: ${state.projectName?.trim() ? state.projectName : "–"}`;
  }

  const lines = [
    ["Material (+Verlust)", eur(r.materialCost)],
    ["Maschinenzeit", `${eur(r.machineCost)}  ·  ${r.printH.toFixed(2)} h`],
      ["Strom", eur(r.electricityCost)],
    ["Rüstkosten (pro Stück)", eur(r.setupCostPerUnit)],
    ["Design (pro Stück)", `${eur(r.designPerUnit)}  ·  ${state.quantity} Stk`],
    ["Zwischensumme", eur(r.base), "total"],
    ["Overhead", `${eur(r.withOverhead - r.base)}  ·  ${(Math.max(0,state.overheadPct)).toFixed(1)} %`],
    ["Basis nach Overhead", eur(r.withOverhead), "total"],
    ["Gewinnmarge", `${eur(r.finalRaw - r.withOverhead)}  ·  ${(Math.max(0,state.profitMarginPct)).toFixed(1)} %`],
    ["Stückpreis Netto (gerundet)", eur(r.finalNet), "total"],
    ["USt", `${eur(r.finalGross - r.finalNet)}  ·  ${(Math.max(0,state.vatPct)).toFixed(1)} %`],
    ["Stückpreis Brutto", eur(r.finalGross), "total"]
  ];

  fields.breakdown.innerHTML = lines
    .map(([k,v,cls]) => `<div class="line ${cls ?? ""}"><div class="k">${k}</div><div class="v">${v}</div></div>`)
    .join("");
}

function hookInputs() {
  const ids = [
    "projectName",
    "materialPreset",
    "materialEurPerKg",
    "weightG",
    "materialLossPct",
    "printHours",
    "printMinutes",
    "printTotalMinutes",
    "machineEurPerHour",
      "electricityEurPerKwh",
    "printerPowerW",
    "setupCostEur",
    "overheadPct",
    "profitMarginPct",
    "vatPct",
    "roundingStep",
    "designHours",
    "quantity"
  ];

  for (const id of ids) {
    $(id).addEventListener("input", () => {
      const state = readState();
      saveState(state);
      render(state);
    });
  }

  // Preset-Preis setzen (nur wenn Feld leer oder auf Preset-Wert)
  fields.materialPreset.addEventListener("change", () => {
    const preset = MATERIAL_PRESETS[fields.materialPreset.value];
    if (preset) {
      const current = toNumber(fields.materialEurPerKg.value, NaN);
      const presetValues = Object.values(MATERIAL_PRESETS).map(p => p.eurPerKg);
      const isPresetValue = presetValues.some(v => Math.abs(v - current) < 0.0001);
      if (!Number.isFinite(current) || isPresetValue) {
        fields.materialEurPerKg.value = preset.eurPerKg;
      }
    }
    const state = readState();
    saveState(state);
    render(state);
  });

  // Total-Minuten Eingabe: wenn gesetzt, h/min leeren
  fields.printTotalMinutes.addEventListener("input", () => {
    const total = toNumber(fields.printTotalMinutes.value, 0);
    if (total > 0) {
      fields.printHours.value = "";
      fields.printMinutes.value = "";
    }
  });

  fields.resetBtn.addEventListener("click", () => {
    localStorage.removeItem("tars_3d_calc_v3");
    applyState(DEFAULTS);
    saveState(readState());
    render(readState());
  });

  if (fields.offerPresetBtn) {
    fields.offerPresetBtn.addEventListener("click", () => {
      fields.profitMarginPct.value = 25;
      const state = readState();
      saveState(state);
      render(state);
    });
  }

  if (fields.exportCsvBtn) {
    fields.exportCsvBtn.addEventListener("click", () => exportCsv());
  }

  if (fields.exportPdfBtn) {
    fields.exportPdfBtn.addEventListener("click", () => exportPdf());
  }
}

function exportPdf() {
  // iOS/Safari robust: direkt aktuelles Dokument drucken (kein Popup-Window)
  const root = document.documentElement;
  root.classList.add("pdf-exporting");

  const cleanup = () => {
    root.classList.remove("pdf-exporting");
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);

  // Fallback cleanup, falls afterprint auf manchen Browsern nicht feuert
  setTimeout(cleanup, 2000);
  window.print();
}

function setFooterDate() {
  const el = document.getElementById("footerDate");
  if (!el) return;
  const d = new Date();
  el.textContent = d.toLocaleDateString("de-AT", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("sw.js");
    } catch {
      // silent – offline ist nice-to-have
    }
  });
}

function exportCsv() {
  const state = readState();
  const r = calc(state);

  const rows = [
    ["Parameter", "Wert"],
    ["Projektname", state.projectName || "-"],
    ["Material", state.materialPreset],
    ["Material €/kg", state.materialEurPerKg],
    ["Gewicht g", state.weightG],
    ["Materialverlust %", state.materialLossPct],
    ["Druckzeit h", r.printH.toFixed(2)],
    ["Maschinenrate €/h", state.machineEurPerHour],
      ["Strom €/kWh", state.electricityEurPerKwh],
    ["Leistung W", state.printerPowerW],
    ["Rüstkosten €/Job", state.setupCostEur],
    ["Stückzahl", state.quantity],
    ["Designzeit h", state.designHours],
    ["Overhead %", state.overheadPct],
    ["Marge %", state.profitMarginPct],
    ["USt %", state.vatPct],
    ["Rundung", state.roundingStep],
    ["---", "---"],
    ["Materialkosten", r.materialCost.toFixed(2)],
    ["Maschinenzeit", r.machineCost.toFixed(2)],
      ["Strom", r.electricityCost.toFixed(2)],
    ["Rüstkosten pro Stück", r.setupCostPerUnit.toFixed(2)],
    ["Design pro Stück", r.designPerUnit.toFixed(2)],
    ["Zwischensumme", r.base.toFixed(2)],
    ["Basis+Overhead", r.withOverhead.toFixed(2)],
    ["Final Netto (gerundet)", r.finalNet.toFixed(2)],
    ["Final Brutto", r.finalGross.toFixed(2)]
  ];

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `3d-print-kalkulator_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Profile Speicher
const PROFILE_KEY = "tars_3d_profiles_v1";

function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveProfiles(profiles) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
}

function refreshProfileSelect() {
  const profiles = loadProfiles();
  fields.profileSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "– Profil wählen –";
  fields.profileSelect.appendChild(placeholder);
  Object.keys(profiles).sort().forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    fields.profileSelect.appendChild(opt);
  });
}

function initProfiles() {
  refreshProfileSelect();

  fields.saveProfileBtn.addEventListener("click", () => {
    const name = fields.profileName.value.trim();
    if (!name) return;
    const profiles = loadProfiles();
    profiles[name] = readState();
    saveProfiles(profiles);
    refreshProfileSelect();
    fields.profileSelect.value = name;
  });

  fields.deleteProfileBtn.addEventListener("click", () => {
    const name = fields.profileSelect.value;
    if (!name) return;
    const profiles = loadProfiles();
    delete profiles[name];
    saveProfiles(profiles);
    refreshProfileSelect();
  });

  fields.profileSelect.addEventListener("change", () => {
    const name = fields.profileSelect.value;
    if (!name) return;
    const profiles = loadProfiles();
    const state = profiles[name];
    if (!state) return;
    applyState(state);
    saveState(readState());
    render(readState());
  });
}

(function init(){
  const stored = loadState();
  applyState(stored ?? DEFAULTS);
  initTheme();
  hookInputs();
  initProfiles();
  setFooterDate();
  saveState(readState());
  render(readState());
  registerSW();
})();
