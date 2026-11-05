"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Entry = {
  id: string;
  type: "food" | "note" | "symptom";
  date: string;
  time: string;
  endDate?: string;
  endTime?: string;
  allDay?: boolean;
  ongoing?: boolean;
  mealCategory?: "breakfast" | "lunch" | "dinner" | "other";
  title: string;
  details: string;
};

const STORAGE_KEY = "little-days-entries-v1";
const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const pretty = (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("hu-HU", options).format(date);
const icon = { food: "◒", symptom: "✳", note: "⌁" };

function shiftDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [today, setToday] = useState(new Date(2000, 0, 1));
  const [cursor, setCursor] = useState(new Date(2000, 0, 1));
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selected, setSelected] = useState("2000-01-01");
  const [formType, setFormType] = useState<Entry["type"] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previousSearch, setPreviousSearch] = useState("");
  const [previousPickerOpen, setPreviousPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeForm, setCloseForm] = useState({ date: "2000-01-01", time: "12:00" });
  const importInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: "", details: "", time: "09:00", endDate: "", endTime: "10:00", allDay: false, ongoing: false, mealCategory: "other" as NonNullable<Entry["mealCategory"]> });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = new Date();
      setToday(now);
      setCursor(now);
      setSelected(dateKey(now));
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setEntries(JSON.parse(saved) as Entry[]);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries, hydrated]);

  const activeDate = useMemo(() => {
    const [year, month, day] = selected.split("-").map(Number);
    return new Date(year, month - 1, day);
  }, [selected]);
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = shiftDate(monthStart, -((monthStart.getDay() + 6) % 7));
  const monthDays = Array.from({ length: 42 }, (_, i) => shiftDate(gridStart, i));
  const weekStart = shiftDate(activeDate, -((activeDate.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));
  const visibleDays = view === "month" ? monthDays : view === "week" ? weekDays : [activeDate];
  const dayEntries = entries.filter((entry) => entry.date === selected || ((entry.type === "symptom" || entry.type === "note") && entry.date < selected && (entry.ongoing ? selected <= dateKey(today) : Boolean(entry.endDate && entry.endDate >= selected)))).sort((a, b) => a.time.localeCompare(b.time));
  const foodCount = entries.filter((entry) => entry.type === "food").length;
  const symptomCount = entries.filter((entry) => entry.type === "symptom").length;

  function move(direction: number) {
    const next = view === "day" ? shiftDate(activeDate, direction) : view === "week" ? shiftDate(activeDate, 7 * direction) : new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
    setCursor(next);
    if (view !== "month") setSelected(dateKey(next));
  }

  function openForm(type: Entry["type"]) {
    setFormType(type);
    setEditingId(null);
    setPreviousSearch("");
    setPreviousPickerOpen(false);
    setForm({ title: "", details: "", time: type === "food" ? "08:00" : "09:00", endDate: "", endTime: "10:00", allDay: false, ongoing: false, mealCategory: "other" });
  }

  const previousEntries = formType
    ? entries
        .filter((entry) => entry.type === formType && entry.title.toLocaleLowerCase("hu-HU").includes(previousSearch.trim().toLocaleLowerCase("hu-HU")))
        .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
    : [];

  function copyPreviousEntry(id: string) {
    const previous = entries.find((entry) => entry.id === id);
    if (!previous) return;
    setForm((current) => ({ ...current, title: previous.title, details: previous.details }));
  }

  function editEntry(entry: Entry) {
    setEditingId(entry.id);
    setFormType(entry.type);
    setSelected(entry.date);
    setForm({ title: entry.title, details: entry.details, time: entry.time || "09:00", endDate: entry.endDate || "", endTime: entry.endTime || "10:00", allDay: Boolean(entry.allDay), ongoing: Boolean(entry.ongoing), mealCategory: entry.mealCategory || "other" });
  }

  function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formType || !form.title.trim()) return;
    const supportsDuration = formType === "symptom" || formType === "note";
    const updated = { id: editingId || crypto.randomUUID(), type: formType, date: selected, time: supportsDuration && form.allDay ? "" : form.time, endDate: supportsDuration && !form.ongoing ? form.endDate : "", endTime: form.endTime, allDay: supportsDuration && form.allDay, ongoing: supportsDuration && form.ongoing, mealCategory: formType === "food" ? form.mealCategory : undefined, title: form.title.trim(), details: form.details.trim() } satisfies Entry;
    setEntries((items) => editingId ? items.map((entry) => entry.id === editingId ? updated : entry) : [...items, updated]);
    setEditingId(null);
    setFormType(null);
  }

  function removeEntry(id: string) {
    setEntries((items) => items.filter((entry) => entry.id !== id));
  }

  function closeObservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!closingId) return;
    setEntries((items) => items.map((entry) => entry.id === closingId ? { ...entry, ongoing: false, endDate: closeForm.date, endTime: entry.allDay ? "" : closeForm.time } : entry));
    setClosingId(null);
  }

  function restartEntry(entry: Entry) {
    setEntries((items) => [...items, {
      ...entry,
      id: crypto.randomUUID(),
      date: selected,
      time: entry.allDay ? "" : (entry.endTime || entry.time),
      endDate: "",
      endTime: "",
      ongoing: true,
    }]);
  }

  function exportBackup() {
    const backup = { format: "kisnapok-mentes", version: 1, exportedAt: new Date().toISOString(), entries };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `kis-napok-mentes-${dateKey(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupMessage("A biztonsági mentés letöltődött.");
    window.setTimeout(() => setBackupMessage(""), 4000);
  }

  function isEntry(value: unknown): value is Entry {
    if (!value || typeof value !== "object") return false;
    const item = value as Partial<Entry>;
      return typeof item.id === "string" && typeof item.title === "string" && typeof item.details === "string" &&
      typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      typeof item.time === "string" && (item.time === "" || /^\d{2}:\d{2}$/.test(item.time)) &&
      (item.type === "food" || item.type === "note" || item.type === "symptom") &&
      (item.endDate === undefined || typeof item.endDate === "string");
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const backup: unknown = JSON.parse(await file.text());
      if (!backup || typeof backup !== "object" || !("format" in backup) || backup.format !== "kisnapok-mentes" ||
        !("version" in backup) || backup.version !== 1 || !("entries" in backup) || !Array.isArray(backup.entries) ||
        !backup.entries.every(isEntry)) throw new Error("Ez nem érvényes Kis napok biztonsági mentés.");
      const incoming = backup.entries as Entry[];
      setEntries((current) => {
        const ids = new Set(current.map((entry) => entry.id));
        return [...current, ...incoming.filter((entry) => !ids.has(entry.id))];
      });
      setBackupMessage(`${incoming.length} bejegyzés importálva. Az azonosítók alapján egyező bejegyzéseket kihagytuk.`);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "A biztonsági mentés fájlja nem olvasható.");
    }
    window.setTimeout(() => setBackupMessage(""), 6000);
  }

  const heading = view === "month" ? pretty(cursor, { month: "long", year: "numeric" }) : view === "week" ? `${pretty(weekStart, { month: "short", day: "numeric" })} – ${pretty(shiftDate(weekStart, 6), { month: "short", day: "numeric", year: "numeric" })}` : pretty(activeDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a href="#home" className="brand"><span className="brand-mark">✿</span><span>Kis napok<small>családi naplónk</small></span></a>
        <div className="side-label">SAJÁT NAPLÓ</div>
        <button className="nav-item active"><span>▦</span> Naptár</button>
        <div className="side-label month-label">RÖVIDEN</div>
        <div className="stat-card"><span className="stat-icon food-icon">◒</span><span><strong>{foodCount}</strong><small>étel feljegyezve</small></span></div>
        <div className="stat-card"><span className="stat-icon symptom-icon">✳</span><span><strong>{symptomCount}</strong><small>megfigyelés</small></span></div>
        <div className="sidebar-note"><span>☼</span><p>A kis pillanatokból áll össze a teljes kép.</p></div>
        <div className="profile"><div className="avatar">b</div><span><strong>A mi kicsink</strong><small>Családi napló</small></span><span className="profile-dots">···</span></div>
      </aside>

      <section className="main-area" id="home">
        <header className="topbar"><div><span className="breadcrumb">CSALÁDI NAPLÓ</span><span className="crumb-divider">/</span><span className="crumb-current">Naptár</span></div><div className="top-right"><span className="privacy"><span>●</span> Csak a családodnak</span><button className="backup-button" onClick={exportBackup}>↓ <span>Mentés</span></button><button className="backup-button" onClick={() => importInput.current?.click()}>↑ <span>Visszaállítás</span></button><input ref={importInput} className="file-input" type="file" accept=".json,application/json" onChange={importBackup} /><div className="top-avatar">b</div></div></header>
        <div className="content">
          <div className="page-intro"><div><div className="eyebrow">FIGYELJÜNK EGYÜTT</div><h1>Családi naptár<span>.</span></h1><p>Jegyezd fel az étkezéseket és az apró, fontos megfigyeléseket.</p></div><button className="today-button" onClick={() => { setToday(new Date()); setCursor(new Date()); setSelected(dateKey(new Date())); }}>Ma <span>↗</span></button></div>

          <div className="calendar-card">
            <div className="calendar-toolbar"><div className="month-nav"><button aria-label="Előző" onClick={() => move(-1)}>‹</button><button aria-label="Következő" onClick={() => move(1)}>›</button><h2>{heading}</h2></div><div className="view-switch">{(["month", "week", "day"] as const).map((item) => <button key={item} className={view === item ? "selected" : ""} onClick={() => setView(item)}>{{month: "Hónap", week: "Hét", day: "Nap"}[item]}</button>)}</div></div>
            {view !== "day" && <div className="weekday-row">{["H", "K", "Sze", "Cs", "P", "Szo", "V"].map((day) => <div key={day}>{day}</div>)}</div>}
            <div className={`calendar-grid ${view === "week" ? "week-grid" : ""} ${view === "day" ? "day-grid" : ""}`}>
              {visibleDays.map((date) => {
                const key = dateKey(date);
                const items = entries.filter((entry) => entry.date === key || ((entry.type === "symptom" || entry.type === "note") && entry.date < key && (entry.ongoing ? key <= dateKey(today) : Boolean(entry.endDate && entry.endDate >= key))));
                const isToday = key === dateKey(today);
                return <button key={key} className={`calendar-day ${view === "month" && date.getMonth() !== cursor.getMonth() ? "outside" : ""} ${key === selected ? "chosen" : ""} ${view === "day" ? "large-day" : ""}`} onClick={() => setSelected(key)}>
                  <span className={`day-number ${isToday ? "is-today" : ""}`}>{date.getDate()}</span>
                  {view === "day" && <span className="day-long">{pretty(date, { weekday: "long", month: "long", day: "numeric" })}</span>}
                  <span className="event-list">{items.slice(0, view === "month" ? 3 : 8).map((entry) => <span className={`event-chip ${entry.type}`} key={entry.id}><span>{icon[entry.type]}</span>{entry.title}{entry.ongoing ? " · folyamatban" : ""}</span>)}{items.length > (view === "month" ? 3 : 8) && <span className="more-events">+{items.length - 3} további</span>}</span>
                  {items.length > 0 && view === "month" && <span className="event-dots">{items.slice(0, 4).map((entry) => <i key={entry.id} className={entry.type} />)}</span>}
                </button>;
              })}
            </div>
            <div className="calendar-legend"><span><i className="food" /> Étel</span><span><i className="symptom" /> Megfigyelés</span><span><i className="note" /> Jegyzet</span><span className="timezone">Mentés ezen az eszközön</span></div>
          </div>

          <section className="day-panel">
            <div className="day-panel-heading"><div><div className="eyebrow">A NAP RÖVIDEN</div><h2>{pretty(activeDate, { weekday: "long", month: "long", day: "numeric" })}{selected === dateKey(today) && <span className="today-tag">MA</span>}</h2></div><div className="quick-actions"><button onClick={() => openForm("food")}><span className="quick-food">＋</span> Étel hozzáadása</button><button onClick={() => openForm("symptom")}><span className="quick-symptom">＋</span> Megfigyelés</button><button className="note-button" onClick={() => openForm("note")}><span>＋</span> Jegyzet</button></div></div>
            {dayEntries.length === 0 ? <div className="empty-state"><span className="empty-flower">✿</span><span><strong>Tiszta lap a mai napra.</strong><small>Rögzíts egy étkezést vagy egy fontos megfigyelést.</small></span><button onClick={() => openForm("food")}>Első bejegyzés <span>→</span></button></div> : <div className="entries-list">{dayEntries.map((entry) => <article className={`entry-row ${entry.type}`} key={entry.id}><div className={`entry-icon ${entry.type}`}>{icon[entry.type]}</div><div className="entry-main"><div className="entry-title-line"><strong>{entry.title}</strong><span className={`entry-kind ${entry.type}`}>{entry.type === "symptom" ? "MEGFIGYELÉS" : entry.type === "food" ? "ÉTEL" : "JEGYZET"}</span>{entry.type === "food" && <span className="meal-category">{{breakfast: "Reggeli", lunch: "Ebéd", dinner: "Vacsora", other: "Egyéb"}[entry.mealCategory || "other"]}</span>}</div><div className="entry-meta">{entry.allDay ? "Egész nap" : entry.time}{entry.ongoing ? " · Folyamatban" : entry.endDate ? ` · ${entry.allDay ? "eddig" : `– ${entry.endTime || ""}`} ${pretty(new Date(`${entry.endDate}T12:00:00`), { month: "short", day: "numeric" })}` : ""}{entry.details && <button onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>{expanded === entry.id ? "Részletek elrejtése" : "Részletek megtekintése"} <span>{expanded === entry.id ? "⌃" : "⌄"}</span></button>}{(entry.type === "symptom" || entry.type === "note") && entry.ongoing && <button onClick={() => { setClosingId(entry.id); setCloseForm({ date: selected, time: "12:00" }); }}>Lezárás</button>}{(entry.type === "symptom" || entry.type === "note") && !entry.ongoing && entry.endDate === selected && <button onClick={() => restartEntry(entry)}>Újraindítás</button>}</div>{expanded === entry.id && entry.details && <p className="entry-details">{entry.details}</p>}</div><button className="edit-entry" onClick={() => editEntry(entry)} aria-label="Bejegyzés szerkesztése">Szerkesztés</button><button className="delete-entry" onClick={() => removeEntry(entry.id)} aria-label={`Bejegyzés törlése: ${entry.title}`}>×</button></article>)}</div>}
          </section>
          <footer className="footer-note"><span>✿</span> Egy apró feljegyzés is sokat segíthet.</footer>
          {backupMessage && <div role="status" className="backup-message">{backupMessage}</div>}
        </div>
      </section>

      {formType && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormType(null); }}><form className="entry-modal" onSubmit={saveEntry}><button type="button" className="modal-close" onClick={() => setFormType(null)}>×</button><div className="eyebrow">{formType === "food" ? "FINOM FALATOK" : formType === "symptom" ? "FONTOS MEGFIGYELÉS" : "EMLÉKEZTETŐ"}</div><h2>{formType === "food" ? "Étel hozzáadása" : formType === "symptom" ? "Megfigyelés hozzáadása" : "Jegyzet hozzáadása"}</h2><p className="modal-date">{pretty(activeDate, { weekday: "long", month: "long", day: "numeric" })}</p>{!editingId && entries.some((entry) => entry.type === formType) && <div className="previous-entry-picker"><button type="button" className="previous-picker-toggle" aria-expanded={previousPickerOpen} onClick={() => { setPreviousPickerOpen(!previousPickerOpen); setPreviousSearch(""); }}>Korábbi bejegyzés másolása <span>{previousPickerOpen ? "?" : "?"}</span></button>{previousPickerOpen && <div className="previous-picker-options"><input type="search" aria-label="Korábbi bejegyzés keresése" autoFocus value={previousSearch} onChange={(event) => setPreviousSearch(event.target.value)} placeholder="Keresés név alapján..." />{previousEntries.length ? <div className="previous-picker-list" role="listbox">{previousEntries.map((entry) => <button type="button" role="option" aria-selected="false" key={entry.id} onClick={() => { copyPreviousEntry(entry.id); setPreviousPickerOpen(false); setPreviousSearch(""); }}><span>{entry.title}</span><small>{entry.date}</small></button>)}</div> : <p className="previous-empty">Nincs ilyen nevű bejegyzés.</p>}</div>}</div>}<label>{formType === "food" ? "Mit evett?" : formType === "symptom" ? "Mit vettél észre?" : "Mire szeretnél emlékezni?"}<input autoFocus required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={formType === "food" ? "pl. spagetti" : formType === "symptom" ? "pl. fájt egy kicsit a hasa" : "pl. kipróbálni az új krémet"} /></label>{formType === "food" && <label>Étkezés típusa<select value={form.mealCategory} onChange={(event) => setForm({ ...form, mealCategory: event.target.value as NonNullable<Entry["mealCategory"]> })}><option value="breakfast">Reggeli</option><option value="lunch">Ebéd</option><option value="dinner">Vacsora</option><option value="other">Egyéb</option></select></label>}{(formType === "symptom" || formType === "note") && <div className="symptom-options"><label className="check-option"><input type="checkbox" checked={form.allDay} onChange={(event) => setForm({ ...form, allDay: event.target.checked })} /> Egész napos megfigyelés</label><label className="check-option"><input type="checkbox" checked={form.ongoing} onChange={(event) => setForm({ ...form, ongoing: event.target.checked, endDate: "" })} /> Folyamatban van</label></div>}{(!form.allDay || (formType !== "symptom" && formType !== "note")) && <label>{formType === "symptom" ? "Kezdés időpontja" : "Időpont"}<input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>}{(formType === "symptom" || formType === "note") && form.ongoing && <p className="ongoing-hint">A megfigyelés minden érintett napon megjelenik, amíg le nem zárod.</p>}{(formType === "symptom" || formType === "note") && !form.ongoing && <div className="range-fields"><label>Befejezés dátuma<input type="date" min={selected} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>{form.endDate && !form.allDay && <label>Befejezés időpontja<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label>}</div>}<label>{formType === "food" ? "Részletek és hozzávalók (nem kötelező)" : "Részletek (nem kötelező)"}<textarea rows={3} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder={formType === "food" ? "Sajt, marhahús, házi szósz..." : "Minden egyéb, amit feljegyeznél..."} /></label><button type="submit" className="save-button">Mentés a naptárba <span>→</span></button></form></div>}
      {closingId && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setClosingId(null); }}><form className="entry-modal" onSubmit={closeObservation}><button type="button" className="modal-close" onClick={() => setClosingId(null)}>×</button><div className="eyebrow">MEGFIGYELÉS LEZÁRÁSA</div><h2>Mikor ért véget?</h2><label>Befejezés dátuma<input required type="date" min={entries.find((entry) => entry.id === closingId)?.date} value={closeForm.date} onChange={(event) => setCloseForm({ ...closeForm, date: event.target.value })} /></label>{!entries.find((entry) => entry.id === closingId)?.allDay && <label>Befejezés időpontja<input required type="time" value={closeForm.time} onChange={(event) => setCloseForm({ ...closeForm, time: event.target.value })} /></label>}<button type="submit" className="save-button">Lezárás és mentés</button></form></div>}
    </main>
  );
}
