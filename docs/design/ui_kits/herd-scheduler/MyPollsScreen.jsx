/* MyPollsScreen.jsx — the signed-in creator's home.
   Lists the polls you've created (newest first), with status, response
   count, and the leading/finalized time. Plus an empty state and the
   state for a signed-in person who isn't an approved creator. */
const { useState: useStateMine } = React;

/* Polls you've created — newest first. Times are Eastern (ET). */
const MY_POLLS = [
  { id: 'p1', title: "Marcus's birthday dinner 🎂", status: 'open',
    span: 'Jun 20–21', responded: 0,
    lead: null },
  { id: 'p2', title: 'Game Night 🎲', status: 'open',
    span: 'Jun 6–8', responded: 6,
    lead: { kind: 'leading', day: 'Sat, Jun 7', time: '6 PM', tz: 'ET' } },
  { id: 'p3', title: 'Book club: chapter 4', status: 'closed',
    span: 'Jun 10–12', responded: 4,
    lead: { kind: 'leading', day: 'Wed, Jun 11', time: '7 PM', tz: 'ET' } },
  { id: 'p4', title: 'Sunday hike ⛰️', status: 'finalized',
    span: 'Jun 14', responded: 8,
    lead: { kind: 'finalized', day: 'Sun, Jun 14', time: '9 AM', tz: 'ET' } },
];

const STATUS = {
  open:      { cls: 'spill-open',   label: 'Open' },
  closed:    { cls: 'spill-closed', label: 'Closed' },
  finalized: { cls: 'spill-final',  label: 'Finalized' },
};

function StatusPill({ status }) {
  const s = STATUS[status];
  return (
    <span className={'spill ' + s.cls}>
      {status === 'finalized'
        ? <Icon name="check" size={13} />
        : <span className="sdot" />}
      {s.label}
    </span>
  );
}

function PollCard({ poll, copied, onCopy, go }) {
  const { lead, responded } = poll;
  const hasResp = responded > 0;
  return (
    <div className="poll-card">
      <div className="poll-top">
        <h2 className="poll-title">{poll.title}</h2>
        <StatusPill status={poll.status} />
      </div>

      <div className="poll-meta">
        For <span className="tnum">{poll.span}</span>
        <span className="sep">·</span>
        {hasResp ? `${responded} responded` : 'no responses yet'}
      </div>

      <div className={'poll-lead' + (lead ? '' : ' waiting')}>
        {lead
          ? <>
              <Icon name={lead.kind === 'finalized' ? 'check' : 'clock'} size={15} />
              <span>
                {lead.kind === 'finalized' ? 'Finalized: ' : 'Leading: '}
                <span className="tnum">{lead.day} · {lead.time} {lead.tz}</span>
              </span>
            </>
          : <>
              <Icon name="share" size={15} />
              <span>Share the link to get the first reply</span>
            </>}
      </div>

      <div className="poll-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => go('results')}>
          {hasResp ? 'Open results' : 'Open poll'}
          <Icon name="chevron-right" size={16} />
        </button>
        <button className="copy-link" onClick={() => onCopy(poll.id)}>
          <Icon name={copied ? 'check' : 'copy'} size={15} />
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}

function MyPollsScreen({ go, variant = 'has' }) {
  const [copiedId, setCopiedId] = useStateMine(null);

  function copy(id) {
    setCopiedId(id);
    clearTimeout(copy._t);
    copy._t = setTimeout(() => setCopiedId(null), 1600);
  }

  // ---- empty state: approved creator, no polls yet ----
  if (variant === 'empty') {
    return (
      <>
        <Header go={go} count={0} />
        <div className="center-screen">
          <div className="app-icon" role="img" aria-label="Herd Scheduler">🐱</div>
          <h1 className="ds-display" style={{ fontSize: 24 }}>No polls yet</h1>
          <p className="ds-body" style={{ color: 'var(--fg2)', fontSize: 15, margin: '4px 18px 0' }}>
            Start your first one and drop the link in the group chat — your friends pick what works.
          </p>
          <button className="btn btn-primary btn-block" style={{ marginTop: 22 }} onClick={() => go('create')}>
            <Icon name="plus" size={18} />New poll
          </button>
        </div>
      </>
    );
  }

  // ---- non-creator: signed in, but not on the host allowlist ----
  if (variant === 'guest') {
    return (
      <>
        <Header go={go} count={null} />
        <div className="center-screen">
          <div className="soft-badge"><Icon name="users" size={26} /></div>
          <h1 className="ds-display" style={{ fontSize: 24 }}>You're all set to vote</h1>
          <p className="ds-body" style={{ color: 'var(--fg2)', fontSize: 15, margin: '4px 14px 0' }}>
            Only approved hosts can start polls. Ask Alex to add you — then you can make your own. Got a poll link? Open it to mark your availability.
          </p>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 22 }} onClick={() => go('vote')}>
            Open a poll to vote
          </button>
        </div>
      </>
    );
  }

  // ---- default: list of your polls ----
  return (
    <>
      <Header go={go} count={MY_POLLS.length} />
      <div className="scroll">
        <div className="pad">
          {MY_POLLS.map(p => (
            <PollCard key={p.id} poll={p} copied={copiedId === p.id} onCopy={copy} go={go} />
          ))}
          <div style={{ height: 8 }} />
        </div>
      </div>
      <div className="bottombar">
        <button className="btn btn-primary btn-block" onClick={() => go('create')}>
          <Icon name="plus" size={18} />New poll
        </button>
      </div>
    </>
  );
}

function Header({ go, count }) {
  return (
    <div className="appbar">
      <div className="appbar-row">
        <div className="app-icon sm" role="img" aria-label="Herd Scheduler">🐱</div>
        <h1 className="ds-h1" style={{ flex: 1 }}>Your polls</h1>
        <button className="iconbtn" onClick={() => go('admin')} aria-label="Approved creators"><Icon name="settings" size={19} /></button>
        <ThemeToggle />
      </div>
      <div className="host-line">
        {count == null
          ? 'Signed in as Alex'
          : <><span>Signed in as Alex</span><span className="sep">·</span><span>{count === 0 ? 'no polls yet' : `${count} ${count === 1 ? 'poll' : 'polls'} · newest first`}</span></>}
      </div>
    </div>
  );
}

Object.assign(window, { MyPollsScreen });
