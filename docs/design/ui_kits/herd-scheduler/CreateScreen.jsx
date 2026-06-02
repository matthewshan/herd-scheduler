/* CreateScreen.jsx — host builds the poll with an integrated calendar.
   Pick multiple days at once; new slots default to the last time range used. */
const { useState: useStateCreate, useMemo: useMemoCreate } = React;

const TZS = [
  'Eastern Time (ET)', 'Central Time (CT)', 'Mountain Time (MT)',
  'Pacific Time (PT)', 'Greenwich Mean Time (GMT)',
];

function TimeSelect({ value, onChange, ariaLabel }) {
  return (
    <div className="select-wrap">
      <select className="field" value={value} onChange={e => onChange(e.target.value)} aria-label={ariaLabel}>
        {TIME_OPTS.map(t => <option key={t}>{t}</option>)}
      </select>
      <Icon name="chevron-down" />
    </div>
  );
}

function CreateScreen({ go, initialCreated }) {
  const [title, setTitle] = useStateCreate('Game Night 🎲');
  const [desc, setDesc] = useStateCreate('Bringing snacks, just need a night that works.');
  const [loc, setLoc] = useStateCreate("Alex's place");
  const [tz, setTz] = useStateCreate(TZS[0]);

  // added slots — each carries the calendar day id so we can ring those days
  const [slots, setSlots] = useStateCreate([
    { id: 'a1', dayKey: dayId(1, 6), date: dayLabel(1, 6), start: '7:00 PM', end: '10:00 PM' },
    { id: 'a2', dayKey: dayId(1, 7), date: dayLabel(1, 7), start: '6:00 PM', end: '9:00 PM' },
  ]);

  // calendar + pending selection + the "last range"
  const [monthIdx, setMonthIdx] = useStateCreate(1);          // June 2026
  const [selected, setSelected] = useStateCreate({});         // dayId -> {mi, day, label}
  const [rangeStart, setRangeStart] = useStateCreate('7:00 PM');
  const [rangeEnd, setRangeEnd] = useStateCreate('10:00 PM');

  const [created, setCreated] = useStateCreate(initialCreated || false);
  const [copied, setCopied] = useStateCreate(false);

  const added = useMemoCreate(() => new Set(slots.map(s => s.dayKey)), [slots]);
  const selCount = Object.keys(selected).length;

  function toggleDay(mi, day) {
    const id = dayId(mi, day);
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { mi, day, label: dayLabel(mi, day) };
      return next;
    });
  }

  function addSelected() {
    if (selCount === 0) return;
    const newSlots = Object.entries(selected).map(([id, d]) => ({
      id: id + '-' + Date.now(),
      dayKey: id,
      date: d.label,
      start: rangeStart,
      end: rangeEnd,
    }));
    setSlots([...slots, ...newSlots]);   // last range persists in rangeStart/rangeEnd
    setSelected({});
  }

  function removeSlot(id) { setSlots(slots.filter(s => s.id !== id)); }

  function copyLink() {
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  // ---------- success / share state ----------
  if (created) {
    return (
      <>
        <div className="appbar">
          <div className="appbar-row">
            <button className="iconbtn" onClick={() => setCreated(false)} aria-label="Back"><Icon name="arrow-left" /></button>
            <h1 className="ds-h1" style={{ flex: 1 }}>Poll created</h1>
          </div>
        </div>
        <div className="scroll">
          <div className="pad">
            <div className="card" style={{ textAlign: 'center', padding: '24px 18px 20px' }}>
              <div className="banner" style={{ background: 'var(--yes-tint)', border: '1px solid rgba(22,163,74,.25)', justifyContent: 'center', margin: '0 0 16px' }}>
                <div className="bi" style={{ background: 'var(--yes)' }}><Icon name="check" size={18} /></div>
                <div className="bt"><b style={{ color: 'var(--fg1)' }}>{title}</b>{slots.length} times · ready to share</div>
              </div>
              <p className="ds-body" style={{ fontSize: 14, color: 'var(--fg2)', margin: '0 0 4px' }}>Share this with your friends</p>
              <div className="sharebox">
                <span className="url">herd.sched/p/game-night-x9f2</span>
                <button className="btn btn-primary btn-sm" onClick={copyLink} style={{ height: 38 }}>
                  <Icon name={copied ? 'check' : 'copy'} size={16} />{copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
            </div>
            <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={() => go('results')}>
              <Icon name="users" size={18} />View responses
            </button>
          </div>
        </div>
      </>
    );
  }

  // ---------- build form ----------
  return (
    <>
      <div className="appbar">
        <div className="appbar-row">
          <button className="iconbtn" onClick={() => go('vote')} aria-label="Back"><Icon name="arrow-left" /></button>
          <h1 className="ds-h1" style={{ flex: 1 }}>New poll</h1>
          <ThemeToggle />
        </div>
      </div>

      <div className="scroll">
        <div className="pad">
          <div className="field-group">
            <label className="label">Title</label>
            <input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Game Night" />
          </div>
          <div className="field-group">
            <label className="label">Description <span className="opt">· optional</span></label>
            <textarea className="field" rows="2" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="label">Location <span className="opt">· optional</span></label>
            <input className="field" value={loc} onChange={e => setLoc(e.target.value)} placeholder="Add a place" />
          </div>
          <div className="field-group">
            <label className="label">Timezone</label>
            <div className="select-wrap">
              <select className="field" value={tz} onChange={e => setTz(e.target.value)}>
                {TZS.map(t => <option key={t}>{t}</option>)}
              </select>
              <Icon name="chevron-down" />
            </div>
          </div>

          <div className="section-h" style={{ marginTop: 20 }}>Pick your dates</div>

          <MiniCalendar
            monthIdx={monthIdx}
            setMonthIdx={setMonthIdx}
            selected={selected}
            added={added}
            onToggle={toggleDay}
          />

          {/* time range applied to the selected days */}
          <div className="timerange">
            <span className="tlabel">Time</span>
            <TimeSelect value={rangeStart} onChange={setRangeStart} ariaLabel="Start time" />
            <span className="tlabel">to</span>
            <TimeSelect value={rangeEnd} onChange={setRangeEnd} ariaLabel="End time" />
          </div>

          <button className="btn btn-outline btn-block add-days-btn" onClick={addSelected} disabled={selCount === 0}>
            <Icon name="plus" size={18} />
            {selCount === 0 ? 'Add to your poll' : `Add ${selCount} ${selCount === 1 ? 'day' : 'days'} at ${rangeStart}`}
          </button>
          <div className="cal-hint">
            <Icon name="calendar" size={14} />
            {selCount === 0 ? 'Tap days above — pick several at once.' : `${selCount} selected · uses ${rangeStart}–${rangeEnd}`}
          </div>

          {slots.length > 0 && (
            <>
              <div className="section-h" style={{ marginTop: 22 }}>
                {slots.length} time {slots.length === 1 ? 'slot' : 'slots'} added
              </div>
              {slots.map(s => (
                <div className="slot-added" key={s.id}>
                  <span className="sa-date">{s.date}</span>
                  <span className="sa-time">{s.start}–{s.end}</span>
                  <button className="sa-rm" onClick={() => removeSlot(s.id)} aria-label="Remove"><Icon name="x" size={17} /></button>
                </div>
              ))}
            </>
          )}

          <div style={{ height: 12 }} />
        </div>
      </div>

      <div className="bottombar">
        <button className="btn btn-primary btn-block" onClick={() => setCreated(true)} disabled={!title.trim() || slots.length === 0}>
          Create poll
        </button>
      </div>
    </>
  );
}

Object.assign(window, { CreateScreen });
