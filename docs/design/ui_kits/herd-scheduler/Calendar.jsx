/* Calendar.jsx — mini month calendar with multi-day select + time helpers.
   Self-consistent month model anchored so Jun 6 2026 = Friday (matches sample data). */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// offset 0 = June 2026 (1st falls on Sunday). firstDow: 0=Sun.
const MONTHS_DATA = [
  { key: 'may26', label: 'May 2026',    mon: 4, firstDow: 4, days: 31 },
  { key: 'jun26', label: 'June 2026',   mon: 5, firstDow: 0, days: 30 },
  { key: 'jul26', label: 'July 2026',   mon: 6, firstDow: 2, days: 31 },
  { key: 'aug26', label: 'August 2026', mon: 7, firstDow: 5, days: 31 },
];
const MON_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// label for a given month-index + day, e.g. "Fri, Jun 6"
function dayLabel(mi, day) {
  const m = MONTHS_DATA[mi];
  const dow = (m.firstDow + day - 1) % 7;
  return `${WEEKDAYS[dow]}, ${MON_SHORT[m.mon]} ${day}`;
}
function dayId(mi, day) { return MONTHS_DATA[mi].key + '-' + day; }

// 30-min time options, 9:00 AM → 11:30 PM
const TIME_OPTS = (() => {
  const out = [];
  for (let h = 9; h <= 23; h++) {
    for (const m of [0, 30]) {
      const ap = h < 12 ? 'AM' : 'PM';
      const hr = h % 12 === 0 ? 12 : h % 12;
      out.push(`${hr}:${m === 0 ? '00' : '30'} ${ap}`);
    }
  }
  return out;
})();

function MiniCalendar({ monthIdx, setMonthIdx, selected, added, onToggle }) {
  const m = MONTHS_DATA[monthIdx];
  const cells = [];
  for (let i = 0; i < m.firstDow; i++) cells.push(null);
  for (let d = 1; d <= m.days; d++) cells.push(d);

  return (
    <div className="cal">
      <div className="cal-head">
        <span className="m">{m.label}</span>
        <div className="cal-nav">
          <button onClick={() => setMonthIdx(Math.max(0, monthIdx - 1))} disabled={monthIdx === 0} aria-label="Previous month"><Icon name="chevron-right" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
          <button onClick={() => setMonthIdx(Math.min(MONTHS_DATA.length - 1, monthIdx + 1))} disabled={monthIdx === MONTHS_DATA.length - 1} aria-label="Next month"><Icon name="chevron-right" size={18} /></button>
        </div>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map(w => <div key={w} className="cal-dow">{w[0]}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={'e' + i} className="cal-day empty" />;
          const id = dayId(monthIdx, d);
          const isSel = !!selected[id];
          const isAdded = added.has(id);
          return (
            <button
              key={id}
              className={'cal-day' + (isSel ? ' sel' : '') + (!isSel && isAdded ? ' added' : '')}
              onClick={() => onToggle(monthIdx, d)}
            >{d}</button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { WEEKDAYS, MONTHS_DATA, MON_SHORT, dayLabel, dayId, TIME_OPTS, MiniCalendar });
