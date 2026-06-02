/* Shared.jsx — small reusable primitives + sample data */
const { useState } = React;

/* ---------------- Sample data ---------------- */
const PEOPLE = {
  Alex:   { initial: 'A', color: '#0077B6' },
  Priya:  { initial: 'P', color: '#7C3AED' },
  Marcus: { initial: 'M', color: '#0891B2' },
  Dana:   { initial: 'D', color: '#DB2777' },
  Sam:    { initial: 'S', color: '#059669' },
  Jordan: { initial: 'J', color: '#D97706' },
};

const POLL = {
  title: 'Game Night 🎲',
  host: 'Alex',
  location: "Alex's place",
  note: 'Bringing snacks, just need a night that works.',
  tz: 'Times shown in Eastern Time · ET',
  slots: [
    { id: 's1', day: 'Fri, Jun 6', time: '7:00–10:00 PM', yes: ['Priya','Marcus','Sam'],        maybe: ['Dana'],   no: ['Jordan','Alex'] },
    { id: 's2', day: 'Sat, Jun 7', time: '6:00–9:00 PM',  yes: ['Alex','Priya','Marcus','Dana','Sam'], maybe: ['Jordan'], no: [] },
    { id: 's3', day: 'Sat, Jun 7', time: '8:00–11:00 PM', yes: ['Alex','Marcus','Jordan'],     maybe: ['Sam','Priya'], no: ['Dana'] },
    { id: 's4', day: 'Sun, Jun 8', time: '5:00–8:00 PM',  yes: ['Dana','Sam'],                 maybe: ['Alex'],   no: ['Priya','Marcus','Jordan'] },
  ],
};

/* ---------------- Avatar ---------------- */
function Avatar({ name, size = 36 }) {
  const p = PEOPLE[name] || { initial: (name||'?')[0]?.toUpperCase() || '?', color: '#5B6472' };
  return (
    <div className="avatar" style={{ width: size, height: size, background: p.color, fontSize: size * 0.4 }}>
      {p.initial}
    </div>
  );
}

function AvatarStack({ names, size = 28, max = 4 }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="avatar-stack">
      {shown.map(n => <Avatar key={n} name={n} size={size} />)}
      {extra > 0 && (
        <div className="avatar-more" style={{ width: size, height: size }}>+{extra}</div>
      )}
    </div>
  );
}

/* ---------------- Timezone chip ---------------- */
function TzChip({ label }) {
  return (
    <span className="tzchip"><Icon name="globe" size={14} />{label}</span>
  );
}

/* ---------------- Segmented 3-way control ---------------- */
const SEG = [
  { key: 'yes',   label: 'Yes' },
  { key: 'maybe', label: 'If-need-be' },
  { key: 'no',    label: 'No' },
];
function Segmented({ value, onChange }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Your availability">
      {SEG.map(o => (
        <button
          key={o.key}
          role="radio"
          aria-checked={value === o.key}
          className={'seg-opt ' + o.key + (value === o.key ? ' on' : '')}
          onClick={() => onChange(value === o.key ? null : o.key)}
        >
          <Icon name="check" size={16} />{o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Tally + stacked bar ---------------- */
function StackedBar({ y, m, n }) {
  const total = Math.max(y + m + n, 1);
  return (
    <div className="bar">
      {y > 0 && <span style={{ width: (y/total*100)+'%', background: 'var(--yes)' }} />}
      {m > 0 && <span style={{ width: (m/total*100)+'%', background: 'var(--maybe)' }} />}
      {n > 0 && <span style={{ width: (n/total*100)+'%', background: 'var(--no)' }} />}
    </div>
  );
}
function Tally({ y, m, n }) {
  return (
    <div className="tally tnum">
      <span className="t" style={{ color: 'var(--yes)' }}><span className="dot" style={{ background: 'var(--yes)' }} />{y} Yes</span>
      <span className="t" style={{ color: 'var(--maybe-ink)' }}><span className="dot" style={{ background: 'var(--maybe)' }} />{m}</span>
      <span className="t" style={{ color: 'var(--no)' }}><span className="dot" style={{ background: 'var(--no)' }} />{n}</span>
    </div>
  );
}

/* ---------------- Phone shell + status bar ---------------- */
function StatusBar() {
  return (
    <div className="statusbar">
      <span className="sb-time">9:41</span>
      <div className="sb-right">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="6" width="3" height="5" rx="1"/><rect x="4.5" y="4" width="3" height="7" rx="1"/><rect x="9" y="2" width="3" height="9" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none"><rect x="0.5" y="0.5" width="18" height="10" rx="3" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="13" height="7" rx="1.5" fill="currentColor"/><rect x="20" y="3.5" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.5"/></svg>
      </div>
    </div>
  );
}

function Phone({ children }) {
  return (
    <div className="phone">
      <div className="notch" />
      <StatusBar />
      <div className="screen">{children}</div>
    </div>
  );
}

/* ---------------- Theme ---------------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('herd-theme', t); } catch (e) {}
}
function initTheme() {
  let t;
  try { t = localStorage.getItem('herd-theme'); } catch (e) {}
  if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  return t;
}
function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  function toggle() {
    const next = !dark;
    applyTheme(next ? 'dark' : 'light');
    setDark(next);
  }
  return (
    <button className="theme-toggle" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <Icon name={dark ? 'sun' : 'moon'} size={19} />
    </button>
  );
}

Object.assign(window, { PEOPLE, POLL, Avatar, AvatarStack, TzChip, Segmented, SEG, StackedBar, Tally, Phone, StatusBar, ThemeToggle, applyTheme, initTheme });
