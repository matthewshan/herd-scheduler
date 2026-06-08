/* @ds-bundle: {"format":3,"namespace":"HerdScheduler_06cadd","components":[],"sourceHashes":{"ui_kits/herd-scheduler/Calendar.jsx":"7880a71ea2b5","ui_kits/herd-scheduler/CreateScreen.jsx":"64273f44e2a2","ui_kits/herd-scheduler/Icons.jsx":"d801af4c74d7","ui_kits/herd-scheduler/MyPollsScreen.jsx":"42419232b6b4","ui_kits/herd-scheduler/ResultsScreen.jsx":"8ed21ba004a4","ui_kits/herd-scheduler/SecondaryScreens.jsx":"61fcc76ad961","ui_kits/herd-scheduler/Shared.jsx":"aa9ba3bed3fb","ui_kits/herd-scheduler/VoteScreen.jsx":"f2502c4d94b6"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.HerdScheduler_06cadd = window.HerdScheduler_06cadd || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/herd-scheduler/Calendar.jsx
try { (() => {
/* Calendar.jsx — mini month calendar with multi-day select + time helpers.
   Self-consistent month model anchored so Jun 6 2026 = Friday (matches sample data). */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// offset 0 = June 2026 (1st falls on Sunday). firstDow: 0=Sun.
const MONTHS_DATA = [{
  key: 'may26',
  label: 'May 2026',
  mon: 4,
  firstDow: 4,
  days: 31
}, {
  key: 'jun26',
  label: 'June 2026',
  mon: 5,
  firstDow: 0,
  days: 30
}, {
  key: 'jul26',
  label: 'July 2026',
  mon: 6,
  firstDow: 2,
  days: 31
}, {
  key: 'aug26',
  label: 'August 2026',
  mon: 7,
  firstDow: 5,
  days: 31
}];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// label for a given month-index + day, e.g. "Fri, Jun 6"
function dayLabel(mi, day) {
  const m = MONTHS_DATA[mi];
  const dow = (m.firstDow + day - 1) % 7;
  return `${WEEKDAYS[dow]}, ${MON_SHORT[m.mon]} ${day}`;
}
function dayId(mi, day) {
  return MONTHS_DATA[mi].key + '-' + day;
}

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
function MiniCalendar({
  monthIdx,
  setMonthIdx,
  selected,
  added,
  onToggle
}) {
  const m = MONTHS_DATA[monthIdx];
  const cells = [];
  for (let i = 0; i < m.firstDow; i++) cells.push(null);
  for (let d = 1; d <= m.days; d++) cells.push(d);
  return /*#__PURE__*/React.createElement("div", {
    className: "cal"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cal-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "m"
  }, m.label), /*#__PURE__*/React.createElement("div", {
    className: "cal-nav"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setMonthIdx(Math.max(0, monthIdx - 1)),
    disabled: monthIdx === 0,
    "aria-label": "Previous month"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18,
    style: {
      transform: 'rotate(180deg)'
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setMonthIdx(Math.min(MONTHS_DATA.length - 1, monthIdx + 1)),
    disabled: monthIdx === MONTHS_DATA.length - 1,
    "aria-label": "Next month"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18
  })))), /*#__PURE__*/React.createElement("div", {
    className: "cal-grid"
  }, WEEKDAYS.map(w => /*#__PURE__*/React.createElement("div", {
    key: w,
    className: "cal-dow"
  }, w[0])), cells.map((d, i) => {
    if (d === null) return /*#__PURE__*/React.createElement("div", {
      key: 'e' + i,
      className: "cal-day empty"
    });
    const id = dayId(monthIdx, d);
    const isSel = !!selected[id];
    const isAdded = added.has(id);
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      className: 'cal-day' + (isSel ? ' sel' : '') + (!isSel && isAdded ? ' added' : ''),
      onClick: () => onToggle(monthIdx, d)
    }, d);
  })));
}
Object.assign(window, {
  WEEKDAYS,
  MONTHS_DATA,
  MON_SHORT,
  dayLabel,
  dayId,
  TIME_OPTS,
  MiniCalendar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/herd-scheduler/Calendar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/herd-scheduler/CreateScreen.jsx
try { (() => {
/* CreateScreen.jsx — host builds the poll with an integrated calendar.
   Pick multiple days at once; new slots default to the last time range used. */
const {
  useState: useStateCreate,
  useMemo: useMemoCreate
} = React;
const TZS = ['Eastern Time (ET)', 'Central Time (CT)', 'Mountain Time (MT)', 'Pacific Time (PT)', 'Greenwich Mean Time (GMT)'];
function TimeSelect({
  value,
  onChange,
  ariaLabel
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "select-wrap"
  }, /*#__PURE__*/React.createElement("select", {
    className: "field",
    value: value,
    onChange: e => onChange(e.target.value),
    "aria-label": ariaLabel
  }, TIME_OPTS.map(t => /*#__PURE__*/React.createElement("option", {
    key: t
  }, t))), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down"
  }));
}
function CreateScreen({
  go,
  initialCreated
}) {
  const [title, setTitle] = useStateCreate('Game Night 🎲');
  const [desc, setDesc] = useStateCreate('Bringing snacks, just need a night that works.');
  const [loc, setLoc] = useStateCreate("Alex's place");
  const [tz, setTz] = useStateCreate(TZS[0]);

  // added slots — each carries the calendar day id so we can ring those days
  const [slots, setSlots] = useStateCreate([{
    id: 'a1',
    dayKey: dayId(1, 6),
    date: dayLabel(1, 6),
    start: '7:00 PM',
    end: '10:00 PM'
  }, {
    id: 'a2',
    dayKey: dayId(1, 7),
    date: dayLabel(1, 7),
    start: '6:00 PM',
    end: '9:00 PM'
  }]);

  // calendar + pending selection + the "last range"
  const [monthIdx, setMonthIdx] = useStateCreate(1); // June 2026
  const [selected, setSelected] = useStateCreate({}); // dayId -> {mi, day, label}
  const [rangeStart, setRangeStart] = useStateCreate('7:00 PM');
  const [rangeEnd, setRangeEnd] = useStateCreate('10:00 PM');
  const [created, setCreated] = useStateCreate(initialCreated || false);
  const [copied, setCopied] = useStateCreate(false);
  const added = useMemoCreate(() => new Set(slots.map(s => s.dayKey)), [slots]);
  const selCount = Object.keys(selected).length;
  function toggleDay(mi, day) {
    const id = dayId(mi, day);
    setSelected(prev => {
      const next = {
        ...prev
      };
      if (next[id]) delete next[id];else next[id] = {
        mi,
        day,
        label: dayLabel(mi, day)
      };
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
      end: rangeEnd
    }));
    setSlots([...slots, ...newSlots]); // last range persists in rangeStart/rangeEnd
    setSelected({});
  }
  function removeSlot(id) {
    setSlots(slots.filter(s => s.id !== id));
  }
  function copyLink() {
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  // ---------- success / share state ----------
  if (created) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "appbar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "appbar-row"
    }, /*#__PURE__*/React.createElement("button", {
      className: "iconbtn",
      onClick: () => setCreated(false),
      "aria-label": "Back"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-left"
    })), /*#__PURE__*/React.createElement("h1", {
      className: "ds-h1",
      style: {
        flex: 1
      }
    }, "Poll created"))), /*#__PURE__*/React.createElement("div", {
      className: "scroll"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        textAlign: 'center',
        padding: '24px 18px 20px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "banner",
      style: {
        background: 'var(--yes-tint)',
        border: '1px solid rgba(22,163,74,.25)',
        justifyContent: 'center',
        margin: '0 0 16px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "bi",
      style: {
        background: 'var(--yes)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 18
    })), /*#__PURE__*/React.createElement("div", {
      className: "bt"
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--fg1)'
      }
    }, title), slots.length, " times \xB7 ready to share")), /*#__PURE__*/React.createElement("p", {
      className: "ds-body",
      style: {
        fontSize: 14,
        color: 'var(--fg2)',
        margin: '0 0 4px'
      }
    }, "Share this with your friends"), /*#__PURE__*/React.createElement("div", {
      className: "sharebox"
    }, /*#__PURE__*/React.createElement("span", {
      className: "url"
    }, "herd.sched/p/game-night-x9f2"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary btn-sm",
      onClick: copyLink,
      style: {
        height: 38
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: copied ? 'check' : 'copy',
      size: 16
    }), copied ? 'Copied' : 'Copy link'))), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-ghost btn-block",
      style: {
        marginTop: 14
      },
      onClick: () => go('results')
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "users",
      size: 18
    }), "View responses"))));
  }

  // ---------- build form ----------
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "appbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "appbar-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => go('vote'),
    "aria-label": "Back"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left"
  })), /*#__PURE__*/React.createElement("h1", {
    className: "ds-h1",
    style: {
      flex: 1
    }
  }, "New poll"), /*#__PURE__*/React.createElement(ThemeToggle, null))), /*#__PURE__*/React.createElement("div", {
    className: "scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pad"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "label"
  }, "Title"), /*#__PURE__*/React.createElement("input", {
    className: "field",
    value: title,
    onChange: e => setTitle(e.target.value),
    placeholder: "e.g. Game Night"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "label"
  }, "Description ", /*#__PURE__*/React.createElement("span", {
    className: "opt"
  }, "\xB7 optional")), /*#__PURE__*/React.createElement("textarea", {
    className: "field",
    rows: "2",
    value: desc,
    onChange: e => setDesc(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "label"
  }, "Location ", /*#__PURE__*/React.createElement("span", {
    className: "opt"
  }, "\xB7 optional")), /*#__PURE__*/React.createElement("input", {
    className: "field",
    value: loc,
    onChange: e => setLoc(e.target.value),
    placeholder: "Add a place"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "label"
  }, "Timezone"), /*#__PURE__*/React.createElement("div", {
    className: "select-wrap"
  }, /*#__PURE__*/React.createElement("select", {
    className: "field",
    value: tz,
    onChange: e => setTz(e.target.value)
  }, TZS.map(t => /*#__PURE__*/React.createElement("option", {
    key: t
  }, t))), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "section-h",
    style: {
      marginTop: 20
    }
  }, "Pick your dates"), /*#__PURE__*/React.createElement(MiniCalendar, {
    monthIdx: monthIdx,
    setMonthIdx: setMonthIdx,
    selected: selected,
    added: added,
    onToggle: toggleDay
  }), /*#__PURE__*/React.createElement("div", {
    className: "timerange"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tlabel"
  }, "Time"), /*#__PURE__*/React.createElement(TimeSelect, {
    value: rangeStart,
    onChange: setRangeStart,
    ariaLabel: "Start time"
  }), /*#__PURE__*/React.createElement("span", {
    className: "tlabel"
  }, "to"), /*#__PURE__*/React.createElement(TimeSelect, {
    value: rangeEnd,
    onChange: setRangeEnd,
    ariaLabel: "End time"
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-block add-days-btn",
    onClick: addSelected,
    disabled: selCount === 0
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 18
  }), selCount === 0 ? 'Add to your poll' : `Add ${selCount} ${selCount === 1 ? 'day' : 'days'} at ${rangeStart}`), /*#__PURE__*/React.createElement("div", {
    className: "cal-hint"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar",
    size: 14
  }), selCount === 0 ? 'Tap days above — pick several at once.' : `${selCount} selected · uses ${rangeStart}–${rangeEnd}`), slots.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "section-h",
    style: {
      marginTop: 22
    }
  }, slots.length, " time ", slots.length === 1 ? 'slot' : 'slots', " added"), slots.map(s => /*#__PURE__*/React.createElement("div", {
    className: "slot-added",
    key: s.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "sa-date"
  }, s.date), /*#__PURE__*/React.createElement("span", {
    className: "sa-time"
  }, s.start, "\u2013", s.end), /*#__PURE__*/React.createElement("button", {
    className: "sa-rm",
    onClick: () => removeSlot(s.id),
    "aria-label": "Remove"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 17
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "bottombar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary btn-block",
    onClick: () => setCreated(true),
    disabled: !title.trim() || slots.length === 0
  }, "Create poll")));
}
Object.assign(window, {
  CreateScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/herd-scheduler/CreateScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/herd-scheduler/Icons.jsx
try { (() => {
/* Icons.jsx — Lucide icon path data (MIT), rendered as a small React component.
   Stroke style: 24x24, fill none, currentColor, 2px stroke, round caps/joins. */
const {
  createElement: h
} = React;
const LUCIDE = {
  'arrow-left': ['m12 19-7-7 7-7', 'M19 12H5'],
  'map-pin': ['M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0', {
    circle: [12, 10, 3]
  }],
  'clock': [{
    circle: [12, 12, 10]
  }, 'M12 6v6l4 2'],
  'globe': [{
    circle: [12, 12, 10]
  }, 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20', 'M2 12h20'],
  'copy': [{
    rect: [8, 8, 14, 14, 2]
  }, 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  'plus': ['M5 12h14', 'M12 5v14'],
  'x': ['M18 6 6 18', 'm6 6 12 12'],
  'trash': ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2', 'M10 11v6', 'M14 11v6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  'users': ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', {
    circle: [9, 7, 4]
  }, 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  'user': [{
    circle: [12, 8, 5]
  }, 'M20 21a8 8 0 0 0-16 0'],
  'share': [{
    circle: [18, 5, 3]
  }, {
    circle: [6, 12, 3]
  }, {
    circle: [18, 19, 3]
  }, 'm8.59 13.51 6.83 3.98', 'm15.41 6.51-6.82 3.98'],
  'check': ['M20 6 9 17l-5-5'],
  'check-check': ['M18 6 7 17l-5-5', 'm22 10-7.5 7.5L13 16'],
  'settings': ['M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z', {
    circle: [12, 12, 3]
  }],
  'calendar': [{
    rect: [3, 4, 18, 18, 2]
  }, 'M8 2v4', 'M16 2v4', 'M3 10h18'],
  'link': ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  'moon': ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  'sun': [{
    circle: [12, 12, 4]
  }, 'M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41']
};
function Icon({
  name,
  size = 20,
  color,
  style,
  strokeWidth = 2
}) {
  const parts = LUCIDE[name] || [];
  const children = parts.map((p, i) => {
    if (typeof p === 'string') return h('path', {
      key: i,
      d: p
    });
    if (p.circle) {
      const [cx, cy, r] = p.circle;
      return h('circle', {
        key: i,
        cx,
        cy,
        r
      });
    }
    if (p.rect) {
      const [x, y, w, ht, rx] = p.rect;
      return h('rect', {
        key: i,
        x,
        y,
        width: w,
        height: ht,
        rx
      });
    }
    return null;
  });
  return h('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color || 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style
  }, children);
}
function GoogleG({
  size = 20
}) {
  return h('svg', {
    width: size,
    height: size,
    viewBox: '0 0 48 48',
    className: 'google-g'
  }, [h('path', {
    key: 1,
    fill: '#FFC107',
    d: 'M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z'
  }), h('path', {
    key: 2,
    fill: '#FF3D00',
    d: 'm6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z'
  }), h('path', {
    key: 3,
    fill: '#4CAF50',
    d: 'M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z'
  }), h('path', {
    key: 4,
    fill: '#1976D2',
    d: 'M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z'
  })]);
}
Object.assign(window, {
  Icon,
  GoogleG
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/herd-scheduler/Icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/herd-scheduler/MyPollsScreen.jsx
try { (() => {
/* MyPollsScreen.jsx — the signed-in creator's home.
   Lists the polls you've created (newest first), with status, response
   count, and the leading/finalized time. Plus an empty state and the
   state for a signed-in person who isn't an approved creator. */
const {
  useState: useStateMine
} = React;

/* Polls you've created — newest first. Times are Eastern (ET). */
const MY_POLLS = [{
  id: 'p1',
  title: "Marcus's birthday dinner 🎂",
  status: 'open',
  span: 'Jun 20–21',
  responded: 0,
  lead: null
}, {
  id: 'p2',
  title: 'Game Night 🎲',
  status: 'open',
  span: 'Jun 6–8',
  responded: 6,
  lead: {
    kind: 'leading',
    day: 'Sat, Jun 7',
    time: '6 PM',
    tz: 'ET'
  }
}, {
  id: 'p3',
  title: 'Book club: chapter 4',
  status: 'closed',
  span: 'Jun 10–12',
  responded: 4,
  lead: {
    kind: 'leading',
    day: 'Wed, Jun 11',
    time: '7 PM',
    tz: 'ET'
  }
}, {
  id: 'p4',
  title: 'Sunday hike ⛰️',
  status: 'finalized',
  span: 'Jun 14',
  responded: 8,
  lead: {
    kind: 'finalized',
    day: 'Sun, Jun 14',
    time: '9 AM',
    tz: 'ET'
  }
}];
const STATUS = {
  open: {
    cls: 'spill-open',
    label: 'Open'
  },
  closed: {
    cls: 'spill-closed',
    label: 'Closed'
  },
  finalized: {
    cls: 'spill-final',
    label: 'Finalized'
  }
};
function StatusPill({
  status
}) {
  const s = STATUS[status];
  return /*#__PURE__*/React.createElement("span", {
    className: 'spill ' + s.cls
  }, status === 'finalized' ? /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }) : /*#__PURE__*/React.createElement("span", {
    className: "sdot"
  }), s.label);
}
function PollCard({
  poll,
  copied,
  onCopy,
  go
}) {
  const {
    lead,
    responded
  } = poll;
  const hasResp = responded > 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "poll-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "poll-top"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "poll-title"
  }, poll.title), /*#__PURE__*/React.createElement(StatusPill, {
    status: poll.status
  })), /*#__PURE__*/React.createElement("div", {
    className: "poll-meta"
  }, "For ", /*#__PURE__*/React.createElement("span", {
    className: "tnum"
  }, poll.span), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "\xB7"), hasResp ? `${responded} responded` : 'no responses yet'), /*#__PURE__*/React.createElement("div", {
    className: 'poll-lead' + (lead ? '' : ' waiting')
  }, lead ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: lead.kind === 'finalized' ? 'check' : 'clock',
    size: 15
  }), /*#__PURE__*/React.createElement("span", null, lead.kind === 'finalized' ? 'Finalized: ' : 'Leading: ', /*#__PURE__*/React.createElement("span", {
    className: "tnum"
  }, lead.day, " \xB7 ", lead.time, " ", lead.tz))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "share",
    size: 15
  }), /*#__PURE__*/React.createElement("span", null, "Share the link to get the first reply"))), /*#__PURE__*/React.createElement("div", {
    className: "poll-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm",
    onClick: () => go('results')
  }, hasResp ? 'Open results' : 'Open poll', /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    className: "copy-link",
    onClick: () => onCopy(poll.id)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: copied ? 'check' : 'copy',
    size: 15
  }), copied ? 'Copied' : 'Copy link')));
}
function MyPollsScreen({
  go,
  variant = 'has'
}) {
  const [copiedId, setCopiedId] = useStateMine(null);
  function copy(id) {
    setCopiedId(id);
    clearTimeout(copy._t);
    copy._t = setTimeout(() => setCopiedId(null), 1600);
  }

  // ---- empty state: approved creator, no polls yet ----
  if (variant === 'empty') {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Header, {
      go: go,
      count: 0
    }), /*#__PURE__*/React.createElement("div", {
      className: "center-screen"
    }, /*#__PURE__*/React.createElement("div", {
      className: "app-icon",
      role: "img",
      "aria-label": "Herd Scheduler"
    }, "\uD83D\uDC31"), /*#__PURE__*/React.createElement("h1", {
      className: "ds-display",
      style: {
        fontSize: 24
      }
    }, "No polls yet"), /*#__PURE__*/React.createElement("p", {
      className: "ds-body",
      style: {
        color: 'var(--fg2)',
        fontSize: 15,
        margin: '4px 18px 0'
      }
    }, "Start your first one and drop the link in the group chat \u2014 your friends pick what works."), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-primary btn-block",
      style: {
        marginTop: 22
      },
      onClick: () => go('create')
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 18
    }), "New poll")));
  }

  // ---- non-creator: signed in, but not on the host allowlist ----
  if (variant === 'guest') {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Header, {
      go: go,
      count: null
    }), /*#__PURE__*/React.createElement("div", {
      className: "center-screen"
    }, /*#__PURE__*/React.createElement("div", {
      className: "soft-badge"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "users",
      size: 26
    })), /*#__PURE__*/React.createElement("h1", {
      className: "ds-display",
      style: {
        fontSize: 24
      }
    }, "You're all set to vote"), /*#__PURE__*/React.createElement("p", {
      className: "ds-body",
      style: {
        color: 'var(--fg2)',
        fontSize: 15,
        margin: '4px 14px 0'
      }
    }, "Only approved hosts can start polls. Ask Alex to add you \u2014 then you can make your own. Got a poll link? Open it to mark your availability."), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-ghost btn-block",
      style: {
        marginTop: 22
      },
      onClick: () => go('vote')
    }, "Open a poll to vote")));
  }

  // ---- default: list of your polls ----
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Header, {
    go: go,
    count: MY_POLLS.length
  }), /*#__PURE__*/React.createElement("div", {
    className: "scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pad"
  }, MY_POLLS.map(p => /*#__PURE__*/React.createElement(PollCard, {
    key: p.id,
    poll: p,
    copied: copiedId === p.id,
    onCopy: copy,
    go: go
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "bottombar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary btn-block",
    onClick: () => go('create')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 18
  }), "New poll")));
}
function Header({
  go,
  count
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "appbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "appbar-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "app-icon sm",
    role: "img",
    "aria-label": "Herd Scheduler"
  }, "\uD83D\uDC31"), /*#__PURE__*/React.createElement("h1", {
    className: "ds-h1",
    style: {
      flex: 1
    }
  }, "Your polls"), /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => go('admin'),
    "aria-label": "Approved creators"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 19
  })), /*#__PURE__*/React.createElement(ThemeToggle, null)), /*#__PURE__*/React.createElement("div", {
    className: "host-line"
  }, count == null ? 'Signed in as Alex' : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, "Signed in as Alex"), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, count === 0 ? 'no polls yet' : `${count} ${count === 1 ? 'poll' : 'polls'} · newest first`))));
}
Object.assign(window, {
  MyPollsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/herd-scheduler/MyPollsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/herd-scheduler/ResultsScreen.jsx
try { (() => {
/* ResultsScreen.jsx — host & voters see the breakdown; host finalizes */
const {
  useState: useStateResults
} = React;
function scoreSlot(s) {
  // best-fit: most yes, zero hard-no preferred, maybe as tiebreak
  return s.yes.length * 3 + s.maybe.length - s.no.length * 4;
}
function ResultsScreen({
  go,
  isHost,
  initialFinalized
}) {
  const [finalized, setFinalized] = useStateResults(initialFinalized || null); // slotId

  const sorted = [...POLL.slots].sort((a, b) => scoreSlot(b) - scoreSlot(a));
  const topScore = scoreSlot(sorted[0]);
  const responded = 6;
  const finalSlot = finalized ? POLL.slots.find(s => s.id === finalized) : null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "appbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "appbar-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => go('vote'),
    "aria-label": "Back"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h1", {
    className: "ds-h1"
  }, POLL.title)), isHost && /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => go('create'),
    "aria-label": "Settings"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 19
  })), /*#__PURE__*/React.createElement(ThemeToggle, null)), /*#__PURE__*/React.createElement("div", {
    className: "host-line"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "users",
    size: 13
  }), responded, " responded"), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, "Hosted by ", POLL.host)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(TzChip, {
    label: POLL.tz
  }))), /*#__PURE__*/React.createElement("div", {
    className: "scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pad"
  }, finalSlot && /*#__PURE__*/React.createElement("div", {
    className: "banner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bi"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "bt"
  }, "Finalized", /*#__PURE__*/React.createElement("b", {
    className: "tnum"
  }, finalSlot.day, " \xB7 ", finalSlot.time.split('–')[0], " PM ET"))), /*#__PURE__*/React.createElement("div", {
    className: "section-h"
  }, finalSlot ? 'Final pick & other options' : 'Sorted by best fit'), sorted.map(s => {
    const y = s.yes.length,
      m = s.maybe.length,
      n = s.no.length;
    const isBest = scoreSlot(s) === topScore && !finalSlot;
    const worksForAll = n === 0;
    const isFinal = finalized === s.id;
    const available = [...s.yes, ...s.maybe];
    return /*#__PURE__*/React.createElement("div", {
      className: 'card' + (isBest ? ' card-best' : '') + (isFinal ? ' card-finalized' : ''),
      key: s.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "slot-top"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "slot-day"
    }, s.day), /*#__PURE__*/React.createElement("div", {
      className: "slot-time tnum"
    }, s.time)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6
      }
    }, isFinal && /*#__PURE__*/React.createElement("span", {
      className: "pill pill-finalized"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 14
    }), "Finalized"), isBest && /*#__PURE__*/React.createElement("span", {
      className: "pill pill-best"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 13,
      style: {
        display: 'none'
      }
    }), "\u2605 Best fit"))), /*#__PURE__*/React.createElement(StackedBar, {
      y: y,
      m: m,
      n: n
    }), /*#__PURE__*/React.createElement(Tally, {
      y: y,
      m: m,
      n: n
    }), /*#__PURE__*/React.createElement("div", {
      className: "who"
    }, /*#__PURE__*/React.createElement(AvatarStack, {
      names: available,
      size: 28,
      max: 5
    }), /*#__PURE__*/React.createElement("span", {
      className: "who-label"
    }, worksForAll ? '' : available.length + ' can make it'), worksForAll && /*#__PURE__*/React.createElement("span", {
      className: "pill pill-all"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 13
    }), "Works for everyone")), isHost && !finalSlot && /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline btn-sm btn-block",
      style: {
        marginTop: 13
      },
      onClick: () => setFinalized(s.id)
    }, "Finalize this time"), isHost && isFinal && /*#__PURE__*/React.createElement("button", {
      className: "btn btn-ghost btn-sm btn-block",
      style: {
        marginTop: 13
      },
      onClick: () => setFinalized(null)
    }, "Change pick"));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))));
}
Object.assign(window, {
  ResultsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/herd-scheduler/ResultsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/herd-scheduler/SecondaryScreens.jsx
try { (() => {
/* SecondaryScreens.jsx — Sign-in & Admin/allowlist */
const {
  useState: useStateSec
} = React;
function SignInScreen({
  go
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "appbar",
    style: {
      background: 'transparent',
      borderBottom: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "appbar-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => go('vote'),
    "aria-label": "Back"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "center-screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "app-icon",
    role: "img",
    "aria-label": "Herd Scheduler"
  }, "\uD83D\uDC31"), /*#__PURE__*/React.createElement("h1", {
    className: "ds-display",
    style: {
      fontSize: 26
    }
  }, "Herd Scheduler"), /*#__PURE__*/React.createElement("p", {
    className: "ds-body",
    style: {
      color: 'var(--fg2)',
      fontSize: 15,
      margin: '4px 28px 0'
    }
  }, "Find a night the whole herd can make \u2014 no group-chat chaos."), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "google-btn",
    onClick: () => go('mypolls')
  }, /*#__PURE__*/React.createElement(GoogleG, {
    size: 20
  }), "Continue with Google"), /*#__PURE__*/React.createElement("button", {
    className: "link",
    onClick: () => go('vote'),
    style: {
      marginTop: 18,
      justifyContent: 'center',
      width: '100%'
    }
  }, "Just voting? Continue as guest"))));
}
function AdminScreen({
  go
}) {
  const [emails, setEmails] = useStateSec([{
    e: 'alex@friends.io',
    owner: true
  }, {
    e: 'priya@friends.io',
    owner: false
  }, {
    e: 'marcus@friends.io',
    owner: false
  }]);
  const [draft, setDraft] = useStateSec('');
  function add() {
    const v = draft.trim();
    if (!v || emails.some(x => x.e === v)) return;
    setEmails([...emails, {
      e: v,
      owner: false
    }]);
    setDraft('');
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "appbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "appbar-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => go('results'),
    "aria-label": "Back"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left"
  })), /*#__PURE__*/React.createElement("h1", {
    className: "ds-h1",
    style: {
      flex: 1
    }
  }, "Approved creators")), /*#__PURE__*/React.createElement("div", {
    className: "host-line"
  }, "Only these people can create new polls")), /*#__PURE__*/React.createElement("div", {
    className: "scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pad"
  }, /*#__PURE__*/React.createElement("div", {
    className: "slotrow",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "field",
    value: draft,
    onChange: e => setDraft(e.target.value),
    placeholder: "name@email.com",
    style: {
      flex: 1
    },
    onKeyDown: e => e.key === 'Enter' && add()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary btn-sm",
    onClick: add,
    style: {
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 16
  }), "Add")), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: '4px 14px'
    }
  }, emails.map((x, i) => /*#__PURE__*/React.createElement("div", {
    className: "email-row",
    key: x.e
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: x.e[0].toUpperCase(),
    size: 32
  }), /*#__PURE__*/React.createElement("span", {
    className: "em"
  }, x.e), x.owner ? /*#__PURE__*/React.createElement("span", {
    className: "owner-tag"
  }, "Owner") : /*#__PURE__*/React.createElement("button", {
    className: "x",
    onClick: () => setEmails(emails.filter(y => y.e !== x.e)),
    "aria-label": "Remove"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 16
  }))))))));
}
Object.assign(window, {
  SignInScreen,
  AdminScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/herd-scheduler/SecondaryScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/herd-scheduler/Shared.jsx
try { (() => {
/* Shared.jsx — small reusable primitives + sample data */
const {
  useState
} = React;

/* ---------------- Sample data ---------------- */
const PEOPLE = {
  Alex: {
    initial: 'A',
    color: '#0077B6'
  },
  Priya: {
    initial: 'P',
    color: '#7C3AED'
  },
  Marcus: {
    initial: 'M',
    color: '#0891B2'
  },
  Dana: {
    initial: 'D',
    color: '#DB2777'
  },
  Sam: {
    initial: 'S',
    color: '#059669'
  },
  Jordan: {
    initial: 'J',
    color: '#D97706'
  }
};
const POLL = {
  title: 'Game Night 🎲',
  host: 'Alex',
  location: "Alex's place",
  note: 'Bringing snacks, just need a night that works.',
  tz: 'Times shown in Eastern Time · ET',
  slots: [{
    id: 's1',
    day: 'Fri, Jun 6',
    time: '7:00–10:00 PM',
    yes: ['Priya', 'Marcus', 'Sam'],
    maybe: ['Dana'],
    no: ['Jordan', 'Alex']
  }, {
    id: 's2',
    day: 'Sat, Jun 7',
    time: '6:00–9:00 PM',
    yes: ['Alex', 'Priya', 'Marcus', 'Dana', 'Sam'],
    maybe: ['Jordan'],
    no: []
  }, {
    id: 's3',
    day: 'Sat, Jun 7',
    time: '8:00–11:00 PM',
    yes: ['Alex', 'Marcus', 'Jordan'],
    maybe: ['Sam', 'Priya'],
    no: ['Dana']
  }, {
    id: 's4',
    day: 'Sun, Jun 8',
    time: '5:00–8:00 PM',
    yes: ['Dana', 'Sam'],
    maybe: ['Alex'],
    no: ['Priya', 'Marcus', 'Jordan']
  }]
};

/* ---------------- Avatar ---------------- */
function Avatar({
  name,
  size = 36
}) {
  const p = PEOPLE[name] || {
    initial: (name || '?')[0]?.toUpperCase() || '?',
    color: '#5B6472'
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "avatar",
    style: {
      width: size,
      height: size,
      background: p.color,
      fontSize: size * 0.4
    }
  }, p.initial);
}
function AvatarStack({
  names,
  size = 28,
  max = 4
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return /*#__PURE__*/React.createElement("div", {
    className: "avatar-stack"
  }, shown.map(n => /*#__PURE__*/React.createElement(Avatar, {
    key: n,
    name: n,
    size: size
  })), extra > 0 && /*#__PURE__*/React.createElement("div", {
    className: "avatar-more",
    style: {
      width: size,
      height: size
    }
  }, "+", extra));
}

/* ---------------- Timezone chip ---------------- */
function TzChip({
  label
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "tzchip"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "globe",
    size: 14
  }), label);
}

/* ---------------- Segmented 3-way control ---------------- */
const SEG = [{
  key: 'yes',
  label: 'Yes'
}, {
  key: 'maybe',
  label: 'If-need-be'
}, {
  key: 'no',
  label: 'No'
}];
function Segmented({
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "seg",
    role: "radiogroup",
    "aria-label": "Your availability"
  }, SEG.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.key,
    role: "radio",
    "aria-checked": value === o.key,
    className: 'seg-opt ' + o.key + (value === o.key ? ' on' : ''),
    onClick: () => onChange(value === o.key ? null : o.key)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16
  }), o.label)));
}

/* ---------------- Tally + stacked bar ---------------- */
function StackedBar({
  y,
  m,
  n
}) {
  const total = Math.max(y + m + n, 1);
  return /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, y > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      width: y / total * 100 + '%',
      background: 'var(--yes)'
    }
  }), m > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      width: m / total * 100 + '%',
      background: 'var(--maybe)'
    }
  }), n > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      width: n / total * 100 + '%',
      background: 'var(--no)'
    }
  }));
}
function Tally({
  y,
  m,
  n
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "tally tnum"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t",
    style: {
      color: 'var(--yes)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: 'var(--yes)'
    }
  }), y, " Yes"), /*#__PURE__*/React.createElement("span", {
    className: "t",
    style: {
      color: 'var(--maybe-ink)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: 'var(--maybe)'
    }
  }), m), /*#__PURE__*/React.createElement("span", {
    className: "t",
    style: {
      color: 'var(--no)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: 'var(--no)'
    }
  }), n));
}

/* ---------------- Phone shell + status bar ---------------- */
function StatusBar() {
  return /*#__PURE__*/React.createElement("div", {
    className: "statusbar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sb-time"
  }, "9:41"), /*#__PURE__*/React.createElement("div", {
    className: "sb-right"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "11",
    viewBox: "0 0 17 11",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "6",
    width: "3",
    height: "5",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4.5",
    y: "4",
    width: "3",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9",
    y: "2",
    width: "3",
    height: "9",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "13.5",
    y: "0",
    width: "3",
    height: "11",
    rx: "1"
  })), /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "11",
    viewBox: "0 0 22 11",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "18",
    height: "10",
    rx: "3",
    stroke: "currentColor",
    opacity: "0.4"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "13",
    height: "7",
    rx: "1.5",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "20",
    y: "3.5",
    width: "1.5",
    height: "4",
    rx: "0.75",
    fill: "currentColor",
    opacity: "0.5"
  }))));
}
function Phone({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "phone"
  }, /*#__PURE__*/React.createElement("div", {
    className: "notch"
  }), /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, children));
}

/* ---------------- Theme ---------------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem('herd-theme', t);
  } catch (e) {}
}
function initTheme() {
  let t;
  try {
    t = localStorage.getItem('herd-theme');
  } catch (e) {}
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
  return /*#__PURE__*/React.createElement("button", {
    className: "theme-toggle",
    onClick: toggle,
    "aria-label": dark ? 'Switch to light mode' : 'Switch to dark mode'
  }, /*#__PURE__*/React.createElement(Icon, {
    name: dark ? 'sun' : 'moon',
    size: 19
  }));
}
Object.assign(window, {
  PEOPLE,
  POLL,
  Avatar,
  AvatarStack,
  TzChip,
  Segmented,
  SEG,
  StackedBar,
  Tally,
  Phone,
  StatusBar,
  ThemeToggle,
  applyTheme,
  initTheme
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/herd-scheduler/Shared.jsx", error: String((e && e.message) || e) }); }

// ui_kits/herd-scheduler/VoteScreen.jsx
try { (() => {
/* VoteScreen.jsx — the core screen: a friend marks availability */
const {
  useState: useStateVote
} = React;
function VoteScreen({
  go,
  initialVotes,
  initialName,
  initialSubmitted
}) {
  const [votes, setVotes] = useStateVote(initialVotes || {}); // slotId -> 'yes'|'maybe'|'no'
  const [name, setName] = useStateVote(initialName || '');
  const [touchedSubmit, setTouchedSubmit] = useStateVote(false);
  const [submitted, setSubmitted] = useStateVote(initialSubmitted || false);
  const marked = Object.values(votes).filter(Boolean).length;
  const total = POLL.slots.length;
  const nameMissing = name.trim() === '';
  const showNameErr = touchedSubmit && nameMissing;
  function submit() {
    setTouchedSubmit(true);
    if (nameMissing) return;
    setSubmitted(true);
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "appbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "appbar-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "iconbtn",
    onClick: () => go('results'),
    "aria-label": "Back"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h1", {
    className: "ds-h1"
  }, POLL.title)), /*#__PURE__*/React.createElement(ThemeToggle, null)), /*#__PURE__*/React.createElement("div", {
    className: "host-line"
  }, /*#__PURE__*/React.createElement("span", null, "Hosted by ", POLL.host), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin",
    size: 13
  }), POLL.location)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(TzChip, {
    label: POLL.tz
  }))), /*#__PURE__*/React.createElement("div", {
    className: "scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pad"
  }, /*#__PURE__*/React.createElement("p", {
    className: "ds-body",
    style: {
      margin: '0 0 16px',
      color: 'var(--fg2)',
      fontSize: 14.5
    }
  }, POLL.note), /*#__PURE__*/React.createElement("div", {
    className: "identity",
    style: {
      marginBottom: 18
    }
  }, nameMissing ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: 'field' + (showNameErr ? ' err' : ''),
    placeholder: "Your name",
    value: name,
    onChange: e => setName(e.target.value),
    style: {
      height: 44,
      border: showNameErr ? undefined : 'none',
      background: showNameErr ? '#fff' : 'transparent',
      paddingLeft: 0
    }
  })), /*#__PURE__*/React.createElement("button", {
    className: "link",
    onClick: () => setName('Priya')
  }, /*#__PURE__*/React.createElement(GoogleG, {
    size: 16
  }), "Sign in")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Avatar, {
    name: PEOPLE[name.trim()] ? name.trim() : 'Priya',
    size: 38
  }), /*#__PURE__*/React.createElement("span", {
    className: "name",
    style: {
      flex: 1
    }
  }, name.trim()), /*#__PURE__*/React.createElement("span", {
    className: "ds-meta",
    style: {
      fontSize: 12
    }
  }, "Voting"))), showNameErr && /*#__PURE__*/React.createElement("div", {
    className: "errmsg",
    style: {
      marginTop: -10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 14
  }), "Add your name so friends know who voted."), /*#__PURE__*/React.createElement("div", {
    className: "section-h"
  }, "Which nights work for you?"), POLL.slots.map(s => /*#__PURE__*/React.createElement("div", {
    className: "card",
    key: s.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "slot-top"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "slot-day"
  }, s.day), /*#__PURE__*/React.createElement("div", {
    className: "slot-time tnum"
  }, s.time))), /*#__PURE__*/React.createElement(Segmented, {
    value: votes[s.id] || null,
    onChange: v => setVotes({
      ...votes,
      [s.id]: v
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "bottombar"
  }, submitted ? /*#__PURE__*/React.createElement("div", {
    className: "toast"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check-check",
    size: 18
  }), "Saved \u2014 you can update anytime") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "bottombar-hint"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tnum"
  }, marked, " of ", total, " marked"), /*#__PURE__*/React.createElement("span", {
    className: "progress"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: marked / total * 100 + '%'
    }
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary btn-block",
    onClick: submit,
    disabled: marked === 0
  }, "Submit availability"))));
}
Object.assign(window, {
  VoteScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/herd-scheduler/VoteScreen.jsx", error: String((e && e.message) || e) }); }

})();
