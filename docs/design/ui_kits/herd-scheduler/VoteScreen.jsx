/* VoteScreen.jsx — the core screen: a friend marks availability */
const { useState: useStateVote } = React;

function VoteScreen({ go, initialVotes, initialName, initialSubmitted }) {
  const [votes, setVotes] = useStateVote(initialVotes || {});   // slotId -> 'yes'|'maybe'|'no'
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

  return (
    <>
      <div className="appbar">
        <div className="appbar-row">
          <button className="iconbtn" onClick={() => go('results')} aria-label="Back"><Icon name="arrow-left" /></button>
          <div style={{ flex: 1 }}>
            <h1 className="ds-h1">{POLL.title}</h1>
          </div>
          <ThemeToggle />
        </div>
        <div className="host-line">
          <span>Hosted by {POLL.host}</span>
          <span className="sep">·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="map-pin" size={13} />{POLL.location}</span>
        </div>
        <div style={{ marginTop: 10 }}><TzChip label={POLL.tz} /></div>
      </div>

      <div className="scroll">
        <div className="pad">
          <p className="ds-body" style={{ margin: '0 0 16px', color: 'var(--fg2)', fontSize: 14.5 }}>{POLL.note}</p>

          {/* identity row */}
          <div className="identity" style={{ marginBottom: 18 }}>
            {nameMissing ? (
              <>
                <div style={{ flex: 1 }}>
                  <input
                    className={'field' + (showNameErr ? ' err' : '')}
                    placeholder="Your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ height: 44, border: showNameErr ? undefined : 'none', background: showNameErr ? '#fff' : 'transparent', paddingLeft: 0 }}
                  />
                </div>
                <button className="link" onClick={() => setName('Priya')}><GoogleG size={16} />Sign in</button>
              </>
            ) : (
              <>
                <Avatar name={PEOPLE[name.trim()] ? name.trim() : 'Priya'} size={38} />
                <span className="name" style={{ flex: 1 }}>{name.trim()}</span>
                <span className="ds-meta" style={{ fontSize: 12 }}>Voting</span>
              </>
            )}
          </div>
          {showNameErr && (
            <div className="errmsg" style={{ marginTop: -10, marginBottom: 14 }}><Icon name="x" size={14} />Add your name so friends know who voted.</div>
          )}

          <div className="section-h">Which nights work for you?</div>

          {POLL.slots.map(s => (
            <div className="card" key={s.id}>
              <div className="slot-top">
                <div>
                  <div className="slot-day">{s.day}</div>
                  <div className="slot-time tnum">{s.time}</div>
                </div>
              </div>
              <Segmented value={votes[s.id] || null} onChange={v => setVotes({ ...votes, [s.id]: v })} />
            </div>
          ))}

          <div style={{ height: 8 }} />
        </div>
      </div>

      {/* sticky bottom bar */}
      <div className="bottombar">
        {submitted ? (
          <div className="toast"><Icon name="check-check" size={18} />Saved — you can update anytime</div>
        ) : (
          <>
            <div className="bottombar-hint">
              <span className="tnum">{marked} of {total} marked</span>
              <span className="progress"><span style={{ width: (marked/total*100)+'%' }} /></span>
            </div>
            <button className="btn btn-primary btn-block" onClick={submit} disabled={marked === 0}>
              Submit availability
            </button>
          </>
        )}
      </div>
    </>
  );
}

Object.assign(window, { VoteScreen });
