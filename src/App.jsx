import { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, Trash2, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2,
  Receipt, Trash,
} from "lucide-react";

/* ---------------------------------------------------------------- */
/* Constants                                                         */
/* ---------------------------------------------------------------- */

const DEFAULT_CATEGORIES = [
  { id: "food-dining", name: "Food & Dining", color: "#2F6D5B" },
  { id: "shopping", name: "Shopping", color: "#C99A3B" },
  { id: "transportation", name: "Transportation", color: "#3B6EA5" },
  { id: "bills-utilities", name: "Bills & Utilities", color: "#7A5195" },
  { id: "entertainment", name: "Entertainment", color: "#B5432F" },
  { id: "health-fitness", name: "Health & Fitness", color: "#4E8C6E" },
  { id: "housing", name: "Housing", color: "#5C6B73" },
  { id: "personal-care", name: "Personal Care", color: "#A8763E" },
  { id: "other", name: "Other", color: "#8A8F87" },
];

const NEW_CATEGORY_PALETTE = ["#6B7A70", "#8C5E58", "#4C6B8A", "#7A6A45", "#5E7A5E", "#6A5A7A"];

function colorFor(categories, name) {
  const c = categories.find((c) => c.name === name);
  return c ? c.color : "#8A8F87";
}
function genId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

const BUDGET_CATEGORIES = ["Food & Dining", "Shopping"];
const DEFAULT_BUDGETS = {
  "Food & Dining": { monthly: 500, yearly: 6000 },
  "Shopping": { monthly: 300, yearly: 3600 },
};

// Older saved data stored a single flat number per category (monthly-only).
// Migrate that shape forward instead of silently dropping it.
function normalizeBudgets(raw) {
  const out = {};
  BUDGET_CATEGORIES.forEach((cat) => {
    const v = raw && raw[cat];
    if (typeof v === "number") out[cat] = { monthly: v, yearly: v * 12 };
    else if (v && typeof v === "object") out[cat] = { monthly: Number(v.monthly) || 0, yearly: Number(v.yearly) || 0 };
    else out[cat] = { ...DEFAULT_BUDGETS[cat] };
  });
  return out;
}

const PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
  { key: "custom", label: "Custom" },
];

/* ---------------------------------------------------------------- */
/* Date helpers (local time, date-only)                               */
/* ---------------------------------------------------------------- */

function toISO(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function zero(d) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }
function startOfWeek(d) {
  const c = zero(d); const day = c.getDay(); const diff = day === 0 ? -6 : 1 - day;
  c.setDate(c.getDate() + diff); return c;
}
function endOfWeek(d) { const s = startOfWeek(d); const c = new Date(s); c.setDate(c.getDate() + 6); return c; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfYear(d) { return new Date(d.getFullYear(), 0, 1); }
function endOfYear(d) { return new Date(d.getFullYear(), 11, 31); }

function getRange(periodType, refDate, customStart, customEnd) {
  switch (periodType) {
    case "daily": return { start: zero(refDate), end: zero(refDate) };
    case "weekly": return { start: startOfWeek(refDate), end: endOfWeek(refDate) };
    case "monthly": return { start: startOfMonth(refDate), end: endOfMonth(refDate) };
    case "yearly": return { start: startOfYear(refDate), end: endOfYear(refDate) };
    case "custom": {
      const s = customStart ? parseISO(customStart) : startOfMonth(refDate);
      const e = customEnd ? parseISO(customEnd) : refDate;
      return s <= e ? { start: zero(s), end: zero(e) } : { start: zero(e), end: zero(s) };
    }
    default: return { start: startOfMonth(refDate), end: endOfMonth(refDate) };
  }
}

function shiftRef(periodType, refDate, dir) {
  const c = new Date(refDate);
  if (periodType === "daily") c.setDate(c.getDate() + dir);
  else if (periodType === "weekly") c.setDate(c.getDate() + dir * 7);
  else if (periodType === "monthly") c.setMonth(c.getMonth() + dir);
  else if (periodType === "yearly") c.setFullYear(c.getFullYear() + dir);
  return c;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatRangeLabel(periodType, refDate, start, end) {
  if (periodType === "daily") return `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getDate()}, ${refDate.getFullYear()}`;
  if (periodType === "weekly") {
    const sameMonth = start.getMonth() === end.getMonth();
    return sameMonth
      ? `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}\u2013${end.getDate()}, ${end.getFullYear()}`
      : `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} \u2013 ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (periodType === "monthly") return `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}`;
  if (periodType === "yearly") return `${refDate.getFullYear()}`;
  return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} \u2013 ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

function formatCurrency(n) {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

/* ---------------------------------------------------------------- */
/* Time-series bucketing for the bar chart                            */
/* ---------------------------------------------------------------- */

function buildTimeSeries(filtered, start, end) {
  const rangeDays = Math.round((zero(end) - zero(start)) / 86400000) + 1;
  const byDay = rangeDays <= 62;
  const buckets = new Map();

  if (byDay) {
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = toISO(cursor);
      buckets.set(key, { label: `${cursor.getDate()}`, full: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getDate()}`, amount: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    filtered.forEach((e) => { const b = buckets.get(e.date); if (b) b.amount += e.amount; });
  } else {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, { label: MONTH_NAMES[cursor.getMonth()], full: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`, amount: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    filtered.forEach((e) => {
      const d = parseISO(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = buckets.get(key); if (b) b.amount += e.amount;
    });
  }
  return Array.from(buckets.values());
}

/* ---------------------------------------------------------------- */
/* Storage keys                                                       */
/* ---------------------------------------------------------------- */

const KEY_EXPENSES = "ft-expenses";
const KEY_BUDGETS = "ft-budgets";
const KEY_CATEGORIES = "ft-categories";

/* ---------------------------------------------------------------- */
/* Budget gauge — one monthly or yearly cap row                       */
/* ---------------------------------------------------------------- */

function BudgetGauge({ periodLabel, spent, max, onChange }) {
  const pct = max > 0 ? (spent / max) * 100 : 0;
  const status = pct > 100 ? "over" : pct >= 80 ? "near" : "good";
  const color = status === "over" ? "var(--clay)" : status === "near" ? "var(--gold)" : "var(--green)";
  return (
    <div className="ft-gauge-block">
      <div className="ft-budget-head">
        <span className="ft-budget-subhead">{periodLabel}</span>
        <span className={`ft-badge ${status}`}>
          {status === "good" ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
          {status === "over" ? "Over" : status === "near" ? "Near limit" : "On track"}
        </span>
      </div>
      <div className="ft-gauge-track">
        <div className="ft-gauge-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <div className="ft-budget-nums">
        <span><span className="ft-num">{formatCurrency(spent)}</span> spent</span>
        <span>of <span className="ft-num">{formatCurrency(max)}</span></span>
      </div>
      {status === "over" && (
        <div className="ft-over-note"><AlertTriangle size={11} /> Over by {formatCurrency(spent - max)}</div>
      )}
      <div className="ft-budget-edit">
        <label>Adjust cap</label>
        <input type="number" min="0" step="10" value={max} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Component                                                         */
/* ---------------------------------------------------------------- */

export default function FinanceTracker() {
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  const [form, setForm] = useState({ name: "", date: toISO(new Date()), amount: "", category: DEFAULT_CATEGORIES[0].name });
  const [formError, setFormError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(NEW_CATEGORY_PALETTE[0]);
  const [catError, setCatError] = useState("");

  const [periodType, setPeriodType] = useState("monthly");
  const [refDate, setRefDate] = useState(new Date());
  const [customStart, setCustomStart] = useState(toISO(startOfMonth(new Date())));
  const [customEnd, setCustomEnd] = useState(toISO(new Date()));
  const [categoryFilter, setCategoryFilter] = useState("All");

  /* -- load once -- */
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(KEY_EXPENSES, false);
        if (r && r.value) setExpenses(JSON.parse(r.value));
      } catch (e) { /* nothing saved yet */ }
      try {
        const r = await window.storage.get(KEY_BUDGETS, false);
        if (r && r.value) setBudgets(normalizeBudgets(JSON.parse(r.value)));
      } catch (e) { /* use defaults */ }
      try {
        const r = await window.storage.get(KEY_CATEGORIES, false);
        if (r && r.value) {
          const parsed = JSON.parse(r.value);
          if (Array.isArray(parsed) && parsed.length > 0) setCategories(parsed);
        }
      } catch (e) { /* use defaults */ }
      loadedRef.current = true;
      setLoaded(true);
    })();
  }, []);

  /* -- persist -- */
  useEffect(() => {
    if (!loadedRef.current) return;
    window.storage.set(KEY_EXPENSES, JSON.stringify(expenses), false).catch(() => {});
  }, [expenses]);
  useEffect(() => {
    if (!loadedRef.current) return;
    window.storage.set(KEY_BUDGETS, JSON.stringify(budgets), false).catch(() => {});
  }, [budgets]);
  useEffect(() => {
    if (!loadedRef.current) return;
    window.storage.set(KEY_CATEGORIES, JSON.stringify(categories), false).catch(() => {});
  }, [categories]);

  /* -- derived: active period range -- */
  const { start, end } = useMemo(
    () => getRange(periodType, refDate, customStart, customEnd),
    [periodType, refDate, customStart, customEnd]
  );

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const d = zero(parseISO(e.date));
      if (d < start || d > end) return false;
      if (categoryFilter !== "All" && e.category !== categoryFilter) return false;
      return true;
    }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [expenses, start, end, categoryFilter]);

  const totalSpent = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);
  const avgSpent = filtered.length ? totalSpent / filtered.length : 0;

  const timeSeries = useMemo(() => buildTimeSeries(filtered, start, end), [filtered, start, end]);

  const categoryData = useMemo(() => {
    const sums = {};
    filtered.forEach((e) => { sums[e.category] = (sums[e.category] || 0) + e.amount; });
    return Object.entries(sums)
      .map(([name, value]) => ({ name, value, color: colorFor(categories, name) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, categories]);

  /* -- budget caps always reflect the real current calendar month/year, not the filters above -- */
  const today = new Date();
  const monthStart = startOfMonth(today), monthEnd = endOfMonth(today);
  const yearStart = startOfYear(today), yearEnd = endOfYear(today);

  const monthSpendByCategory = useMemo(() => {
    const sums = {};
    expenses.forEach((e) => {
      const d = zero(parseISO(e.date));
      if (d >= monthStart && d <= monthEnd) sums[e.category] = (sums[e.category] || 0) + e.amount;
    });
    return sums;
  }, [expenses]);

  const yearSpendByCategory = useMemo(() => {
    const sums = {};
    expenses.forEach((e) => {
      const d = zero(parseISO(e.date));
      if (d >= yearStart && d <= yearEnd) sums[e.category] = (sums[e.category] || 0) + e.amount;
    });
    return sums;
  }, [expenses]);

  const monthTotal = Object.values(monthSpendByCategory).reduce((s, v) => s + v, 0);

  /* -- handlers -- */
  function addExpense(e) {
    e.preventDefault();
    const name = form.name.trim();
    const amount = parseFloat(form.amount);
    if (!name) return setFormError("Enter a name for this expense.");
    if (!form.date) return setFormError("Pick a date.");
    if (!Number.isFinite(amount) || amount <= 0) return setFormError("Enter an amount greater than 0.");
    setExpenses((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, date: form.date, amount: Math.round(amount * 100) / 100, category: form.category },
    ]);
    setForm({ name: "", date: form.date, amount: "", category: form.category });
    setFormError("");
  }
  function deleteExpense(id) { setExpenses((prev) => prev.filter((e) => e.id !== id)); }
  function updateBudget(cat, period, value) {
    const n = value === "" ? 0 : Math.max(0, Number(value));
    setBudgets((prev) => ({ ...prev, [cat]: { ...prev[cat], [period]: Number.isFinite(n) ? n : 0 } }));
  }
  function clearAll() {
    if (window.confirm("Delete all transactions? Budget caps will be kept.")) setExpenses([]);
  }

  function renameCategory(id, rawName) {
    const cat = categories.find((c) => c.id === id);
    if (!cat) { setEditingId(null); return; }
    const newName = rawName.trim();
    if (!newName || newName === cat.name) { setEditingId(null); return; }
    const collision = categories.some((c) => c.id !== id && c.name.toLowerCase() === newName.toLowerCase());
    if (collision) { setCatError(`"${newName}" is already in use.`); return; }
    const oldName = cat.name;
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name: newName } : c)));
    setExpenses((prev) => prev.map((e) => (e.category === oldName ? { ...e, category: newName } : e)));
    setBudgets((prev) => {
      if (!(oldName in prev)) return prev;
      const { [oldName]: val, ...rest } = prev;
      return { ...rest, [newName]: val };
    });
    setForm((f) => (f.category === oldName ? { ...f, category: newName } : f));
    setCategoryFilter((cf) => (cf === oldName ? newName : cf));
    setEditingId(null);
    setCatError("");
  }

  function updateCategoryColor(id, color) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)));
  }

  function addCategoryHandler() {
    const name = newCatName.trim();
    if (!name) return;
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setCatError(`"${name}" already exists.`); return;
    }
    setCategories((prev) => [...prev, { id: genId("cat"), name, color: newCatColor }]);
    setNewCatName("");
    setNewCatColor(NEW_CATEGORY_PALETTE[categories.length % NEW_CATEGORY_PALETTE.length]);
    setCatError("");
  }

  function deleteCategory(id) {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    if (categories.length <= 1) return;
    if (cat.name in budgets) return;
    if (expenses.some((e) => e.category === cat.name)) return;
    if (!window.confirm(`Delete "${cat.name}"?`)) return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    if (form.category === cat.name) {
      const fallback = categories.find((c) => c.id !== id);
      setForm((f) => ({ ...f, category: fallback ? fallback.name : "" }));
    }
    if (categoryFilter === cat.name) setCategoryFilter("All");
  }

  const rangeLabel = formatRangeLabel(periodType, refDate, start, end);

  return (
    <div className="ft-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');

        .ft-root {
          --paper: #F4F6F2;
          --card: #FEFFFE;
          --ink: #16241E;
          --ink-soft: #5B6B62;
          --green: #2F6D5B;
          --green-soft: rgba(47,109,91,0.10);
          --gold: #B8862E;
          --gold-soft: rgba(184,134,46,0.13);
          --clay: #B5432F;
          --clay-soft: rgba(181,67,47,0.11);
          --line: #DCE2D8;
          --shadow: 0 1px 2px rgba(22,36,30,0.05), 0 6px 20px rgba(22,36,30,0.05);
          font-family: 'Inter', system-ui, sans-serif;
          color: var(--ink);
          background: var(--paper);
          padding: 28px;
          border-radius: 12px;
          max-width: 1100px;
          margin: 0 auto;
        }
        .ft-root * { box-sizing: border-box; }
        .ft-num { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-feature-settings: "tnum"; }
        .ft-header { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:10px; margin-bottom:22px; border-bottom: 1px solid var(--line); padding-bottom:16px; }
        .ft-eyebrow { font-family:'IBM Plex Mono', monospace; font-size:11px; letter-spacing:0.14em; color: var(--green); font-weight:600; margin-bottom:4px; }
        .ft-title { font-family:'Space Grotesk', sans-serif; font-size:28px; font-weight:700; margin:0; letter-spacing:-0.01em; }
        .ft-header-right { text-align:right; }
        .ft-header-label { font-size:11px; color: var(--ink-soft); text-transform:uppercase; letter-spacing:0.08em; }
        .ft-header-value { font-family:'IBM Plex Mono', monospace; font-size:22px; font-weight:600; }

        .ft-grid-top { display:grid; grid-template-columns: 1.1fr 1fr; gap:16px; margin-bottom:16px; }
        @media (max-width: 760px) { .ft-grid-top { grid-template-columns: 1fr; } }

        .ft-card { background: var(--card); border:1px solid var(--line); border-radius:10px; padding:18px 20px; box-shadow: var(--shadow); }
        .ft-card h2 { font-family:'Space Grotesk', sans-serif; font-size:15px; font-weight:600; margin:0 0 14px 0; }
        .ft-card-sub { font-size:12px; color: var(--ink-soft); margin:-10px 0 14px 0; }

        .ft-form-grid { display:grid; grid-template-columns: 1fr 1fr; gap:10px 12px; }
        .ft-field { display:flex; flex-direction:column; gap:4px; }
        .ft-field label { font-size:11px; color: var(--ink-soft); text-transform:uppercase; letter-spacing:0.05em; }
        .ft-field input, .ft-field select {
          font-family:'Inter', sans-serif; font-size:14px; padding:8px 10px; border:1px solid var(--line);
          border-radius:6px; background:#fff; color:var(--ink); outline:none;
        }
        .ft-field input:focus, .ft-field select:focus { border-color: var(--green); box-shadow: 0 0 0 3px var(--green-soft); }
        .ft-error { color: var(--clay); font-size:12px; margin-top:6px; }
        .ft-submit {
          margin-top:12px; width:100%; display:flex; align-items:center; justify-content:center; gap:6px;
          background: var(--green); color:#fff; border:none; border-radius:7px; padding:10px 14px;
          font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:14px; cursor:pointer;
        }
        .ft-submit:hover { background:#255a4b; }

        .ft-budget-row { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
        @media (max-width:520px){ .ft-budget-row{ grid-template-columns:1fr; } }
        .ft-budget-item { border:1px solid var(--line); border-radius:8px; padding:12px; }
        .ft-budget-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
        .ft-budget-cat { font-weight:600; font-size:13px; }
        .ft-budget-subhead { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color: var(--ink-soft); }
        .ft-budget-divider { height:1px; background: var(--line); margin:12px 0; }
        .ft-gauge-block:first-of-type { margin-top:0; }
        .ft-badge { font-size:11px; padding:2px 7px; border-radius:12px; display:inline-flex; align-items:center; gap:4px; font-weight:600; }
        .ft-badge.good { background: var(--green-soft); color: var(--green); }
        .ft-badge.near { background: var(--gold-soft); color: var(--gold); }
        .ft-badge.over { background: var(--clay-soft); color: var(--clay); }
        .ft-gauge-track { position:relative; height:12px; border-radius:6px; background: repeating-linear-gradient(90deg, var(--line) 0 1px, transparent 1px 10%); border:1px solid var(--line); overflow:hidden; margin:8px 0 6px 0; }
        .ft-gauge-fill { position:absolute; left:0; top:0; bottom:0; border-radius:6px; transition: width 0.35s ease; }
        .ft-budget-nums { display:flex; justify-content:space-between; font-size:12px; color:var(--ink-soft); }
        .ft-budget-nums .ft-num { color: var(--ink); }
        .ft-budget-edit { display:flex; align-items:center; gap:6px; margin-top:8px; }
        .ft-budget-edit label { font-size:11px; color:var(--ink-soft); }
        .ft-budget-edit input { width:90px; font-family:'IBM Plex Mono', monospace; font-size:13px; padding:5px 7px; border:1px solid var(--line); border-radius:5px; }
        .ft-over-note { font-size:11.5px; color:var(--clay); margin-top:6px; display:flex; align-items:center; gap:4px; }

        .ft-cat-list { display:flex; flex-direction:column; }
        .ft-cat-row { display:flex; align-items:center; gap:8px; padding:7px 2px; border-bottom:1px solid var(--line); }
        .ft-cat-row:last-child { border-bottom:none; }
        .ft-cat-swatch { width:22px; height:22px; padding:0; border:1px solid var(--line); border-radius:5px; cursor:pointer; background:none; flex-shrink:0; }
        .ft-cat-name-btn { background:none; border:none; font-family:'Inter', sans-serif; font-size:13.5px; color:var(--ink); cursor:pointer; padding:3px 6px; border-radius:4px; text-align:left; }
        .ft-cat-name-btn:hover { background: var(--paper); }
        .ft-cat-name-input { font-family:'Inter', sans-serif; font-size:13.5px; padding:4px 7px; border:1px solid var(--green); border-radius:4px; outline:none; box-shadow: 0 0 0 3px var(--green-soft); }
        .ft-tag { font-size:10.5px; padding:2px 8px; border-radius:10px; background: var(--green-soft); color: var(--green); font-weight:600; white-space:nowrap; }
        .ft-cat-add { display:flex; align-items:center; gap:8px; margin-top:12px; }
        .ft-cat-add input[type="text"] { flex:1; font-family:'Inter', sans-serif; font-size:13px; padding:8px 10px; border:1px solid var(--line); border-radius:6px; }
        .ft-cat-add input[type="color"] { width:32px; height:32px; padding:0; border:1px solid var(--line); border-radius:6px; cursor:pointer; flex-shrink:0; }
        .ft-add-cat-btn { display:flex; align-items:center; gap:5px; background: var(--green); color:#fff; border:none; border-radius:6px; padding:8px 13px; font-family:'Space Grotesk', sans-serif; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; }
        .ft-add-cat-btn:hover { background:#255a4b; }

        .ft-filters { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:16px; }
        .ft-period-tabs { display:flex; border:1px solid var(--line); border-radius:7px; overflow:hidden; }
        .ft-period-tabs button { font-family:'Space Grotesk', sans-serif; font-size:12.5px; font-weight:600; padding:7px 12px; background:#fff; border:none; border-right:1px solid var(--line); cursor:pointer; color: var(--ink-soft); }
        .ft-period-tabs button:last-child { border-right:none; }
        .ft-period-tabs button.active { background: var(--green); color:#fff; }
        .ft-nav { display:flex; align-items:center; gap:6px; font-family:'IBM Plex Mono', monospace; font-size:13px; }
        .ft-nav button { background:#fff; border:1px solid var(--line); border-radius:6px; width:26px; height:26px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--ink); }
        .ft-nav button:hover { background: var(--paper); }
        .ft-nav button:disabled { opacity:0.35; cursor:default; }
        .ft-range-label { min-width:170px; text-align:center; font-weight:600; }
        .ft-cat-select { margin-left:auto; }
        .ft-custom-dates { display:flex; align-items:center; gap:6px; font-size:12px; }
        .ft-custom-dates input { padding:6px 8px; border:1px solid var(--line); border-radius:6px; font-family:'IBM Plex Mono', monospace; font-size:12.5px; }

        .ft-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:16px; }
        @media (max-width:640px){ .ft-stats{ grid-template-columns:1fr; } }
        .ft-stat-label { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:var(--ink-soft); margin-bottom:4px; }
        .ft-stat-value { font-family:'IBM Plex Mono', monospace; font-size:22px; font-weight:600; }

        .ft-charts { display:grid; grid-template-columns: 1.3fr 1fr; gap:16px; margin-bottom:16px; }
        @media (max-width:800px){ .ft-charts{ grid-template-columns:1fr; } }
        .ft-empty { color: var(--ink-soft); font-size:13px; padding:30px 0; text-align:center; }

        .ft-table-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
        .ft-clear-btn { display:flex; align-items:center; gap:5px; font-size:12px; color:var(--ink-soft); background:none; border:1px solid var(--line); border-radius:6px; padding:5px 9px; cursor:pointer; }
        .ft-clear-btn:hover { color: var(--clay); border-color: var(--clay); }
        table.ft-table { width:100%; border-collapse:collapse; font-size:13.5px; }
        table.ft-table th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:var(--ink-soft); border-bottom:1px solid var(--line); padding:6px 8px; }
        table.ft-table td { padding:8px 8px; border-bottom:1px solid var(--line); }
        table.ft-table td.amt { text-align:right; }
        .ft-cat-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }
        .ft-del-btn { background:none; border:none; cursor:pointer; color:var(--ink-soft); padding:4px; }
        .ft-del-btn:hover { color: var(--clay); }
        .ft-del-btn:disabled { opacity:0.3; cursor:not-allowed; color: var(--ink-soft); }
      `}</style>

      <header className="ft-header">
        <div>
          <div className="ft-eyebrow">PERSONAL FINANCE</div>
          <h1 className="ft-title">Ledger</h1>
        </div>
        <div className="ft-header-right">
          <div className="ft-header-label">Spent this calendar month</div>
          <div className="ft-header-value ft-num">{formatCurrency(monthTotal)}</div>
        </div>
      </header>

      {!loaded ? (
        <div className="ft-empty">Loading your data…</div>
      ) : (
        <>
          <div className="ft-grid-top">
            <div className="ft-card">
              <h2>Add expense</h2>
              <form onSubmit={addExpense}>
                <div className="ft-form-grid">
                  <div className="ft-field">
                    <label>Name</label>
                    <input type="text" placeholder="Coffee, rent, groceries…" value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="ft-field">
                    <label>Amount</label>
                    <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div className="ft-field">
                    <label>Date</label>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="ft-field">
                    <label>Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                {formError && <div className="ft-error">{formError}</div>}
                <button type="submit" className="ft-submit"><Plus size={15} /> Add expense</button>
              </form>
            </div>

            <div className="ft-card">
              <h2>Budgets</h2>
              <div className="ft-card-sub">Caps track the real current month/year, regardless of the filters below.</div>
              <div className="ft-budget-row">
                {categories.filter((c) => c.name in budgets).map((cat) => (
                  <div className="ft-budget-item" key={cat.id}>
                    <div className="ft-budget-cat" style={{ marginBottom: 8 }}>{cat.name}</div>
                    <BudgetGauge
                      periodLabel="This month" spent={monthSpendByCategory[cat.name] || 0}
                      max={budgets[cat.name]?.monthly || 0}
                      onChange={(v) => updateBudget(cat.name, "monthly", v)}
                    />
                    <div className="ft-budget-divider" />
                    <BudgetGauge
                      periodLabel="This year" spent={yearSpendByCategory[cat.name] || 0}
                      max={budgets[cat.name]?.yearly || 0}
                      onChange={(v) => updateBudget(cat.name, "yearly", v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ft-card" style={{ marginBottom: 16 }}>
            <h2>Categories</h2>
            <div className="ft-card-sub">Rename, recolor, add, or remove categories. Budgeted categories and any category currently in use can't be deleted.</div>
            <div className="ft-cat-list">
              {categories.map((cat) => {
                const isBudgeted = cat.name in budgets;
                const inUse = expenses.some((e) => e.category === cat.name);
                const canDelete = !isBudgeted && !inUse && categories.length > 1;
                const deleteTitle = isBudgeted
                  ? "Budgeted categories can't be deleted"
                  : inUse
                  ? "Used by existing transactions — reassign or delete those first"
                  : categories.length <= 1
                  ? "At least one category is required"
                  : "Delete category";
                return (
                  <div className="ft-cat-row" key={cat.id}>
                    <input type="color" className="ft-cat-swatch" value={cat.color}
                      onChange={(e) => updateCategoryColor(cat.id, e.target.value)} title="Change color" />
                    {editingId === cat.id ? (
                      <input
                        className="ft-cat-name-input" autoFocus value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameCategory(cat.id, draftName);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={() => renameCategory(cat.id, draftName)}
                      />
                    ) : (
                      <button className="ft-cat-name-btn"
                        onClick={() => { setEditingId(cat.id); setDraftName(cat.name); setCatError(""); }}>
                        {cat.name}
                      </button>
                    )}
                    {isBudgeted && <span className="ft-tag">Budgeted</span>}
                    <button className="ft-del-btn" style={{ marginLeft: isBudgeted ? 0 : "auto" }}
                      disabled={!canDelete} title={deleteTitle} onClick={() => deleteCategory(cat.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            {catError && <div className="ft-error">{catError}</div>}
            <div className="ft-cat-add">
              <input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)} title="Pick a color" />
              <input type="text" placeholder="New category name" value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCategoryHandler(); }} />
              <button className="ft-add-cat-btn" onClick={addCategoryHandler}><Plus size={14} /> Add</button>
            </div>
          </div>

          <div className="ft-card">
            <div className="ft-filters">
              <div className="ft-period-tabs">
                {PERIODS.map((p) => (
                  <button key={p.key} className={periodType === p.key ? "active" : ""} onClick={() => setPeriodType(p.key)}>
                    {p.label}
                  </button>
                ))}
              </div>

              {periodType !== "custom" ? (
                <div className="ft-nav">
                  <button onClick={() => setRefDate(shiftRef(periodType, refDate, -1))}><ChevronLeft size={15} /></button>
                  <span className="ft-range-label">{rangeLabel}</span>
                  <button onClick={() => setRefDate(shiftRef(periodType, refDate, 1))}><ChevronRight size={15} /></button>
                </div>
              ) : (
                <div className="ft-custom-dates">
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                  <span>to</span>
                  <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                </div>
              )}

              <select className="ft-field ft-cat-select" style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid var(--line)" }}
                value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="All">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div className="ft-stats">
              <div>
                <div className="ft-stat-label">Total spent</div>
                <div className="ft-stat-value ft-num">{formatCurrency(totalSpent)}</div>
              </div>
              <div>
                <div className="ft-stat-label">Transactions</div>
                <div className="ft-stat-value ft-num">{filtered.length}</div>
              </div>
              <div>
                <div className="ft-stat-label">Average per transaction</div>
                <div className="ft-stat-value ft-num">{formatCurrency(avgSpent)}</div>
              </div>
            </div>

            <div className="ft-charts">
              <div>
                <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: "0 0 8px 0" }}>Spending over time</h2>
                {filtered.length === 0 ? (
                  <div className="ft-empty">No transactions in this period.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={timeSeries} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#DCE2D8" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5B6B62" }} axisLine={{ stroke: "#DCE2D8" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#5B6B62" }} axisLine={false} tickLine={false} width={46} />
                      <Tooltip
                        formatter={(v) => formatCurrency(v)}
                        labelFormatter={(_, payload) => payload && payload[0] ? payload[0].payload.full : ""}
                        contentStyle={{ borderRadius: 8, border: "1px solid #DCE2D8", fontSize: 12 }}
                      />
                      <Bar dataKey="amount" fill="#2F6D5B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div>
                <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: "0 0 8px 0" }}>By category</h2>
                {categoryData.length === 0 ? (
                  <div className="ft-empty">No transactions in this period.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {categoryData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [formatCurrency(v), n]} contentStyle={{ borderRadius: 8, border: "1px solid #DCE2D8", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="ft-card" style={{ marginTop: 16 }}>
            <div className="ft-table-head">
              <h2 style={{ margin: 0 }}>Transactions ({filtered.length})</h2>
              <button className="ft-clear-btn" onClick={clearAll}><Trash size={12} /> Clear all</button>
            </div>
            {filtered.length === 0 ? (
              <div className="ft-empty"><Receipt size={20} style={{ opacity: 0.4, marginBottom: 6 }} /><br />Nothing here yet. Add an expense above.</div>
            ) : (
              <table className="ft-table">
                <thead>
                  <tr><th>Date</th><th>Name</th><th>Category</th><th style={{ textAlign: "right" }}>Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td className="ft-num">{e.date}</td>
                      <td>{e.name}</td>
                      <td><span className="ft-cat-dot" style={{ background: colorFor(categories, e.category) }} />{e.category}</td>
                      <td className="ft-num amt">{formatCurrency(e.amount)}</td>
                      <td><button className="ft-del-btn" onClick={() => deleteExpense(e.id)}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
