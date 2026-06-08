/* SecondaryScreens.jsx — Sign-in & Admin/allowlist */
const { useState: useStateSec } = React;

function SignInScreen({ go }) {
  return (
    <>
      <div className="appbar" style={{ background: 'transparent', borderBottom: 0 }}>
        <div className="appbar-row">
          <button className="iconbtn" onClick={() => go('vote')} aria-label="Back"><Icon name="arrow-left" /></button>
        </div>
      </div>
      <div className="center-screen">
        <div className="app-icon" role="img" aria-label="Herd Scheduler">🐱</div>
        <h1 className="ds-display" style={{ fontSize: 26 }}>Herd Scheduler</h1>
        <p className="ds-body" style={{ color: 'var(--fg2)', fontSize: 15, margin: '4px 28px 0' }}>
          Find a night the whole herd can make — no group-chat chaos.
        </p>
        <div style={{ width: '100%', marginTop: 8 }}>
          <button className="google-btn" onClick={() => go('mypolls')}>
            <GoogleG size={20} />Continue with Google
          </button>
          <button className="link" onClick={() => go('vote')} style={{ marginTop: 18, justifyContent: 'center', width: '100%' }}>
            Just voting? Continue as guest
          </button>
        </div>
      </div>
    </>
  );
}

function AdminScreen({ go }) {
  const [emails, setEmails] = useStateSec([
    { e: 'alex@friends.io', owner: true },
    { e: 'priya@friends.io', owner: false },
    { e: 'marcus@friends.io', owner: false },
  ]);
  const [draft, setDraft] = useStateSec('');

  function add() {
    const v = draft.trim();
    if (!v || emails.some(x => x.e === v)) return;
    setEmails([...emails, { e: v, owner: false }]);
    setDraft('');
  }

  return (
    <>
      <div className="appbar">
        <div className="appbar-row">
          <button className="iconbtn" onClick={() => go('results')} aria-label="Back"><Icon name="arrow-left" /></button>
          <h1 className="ds-h1" style={{ flex: 1 }}>Approved creators</h1>
        </div>
        <div className="host-line">Only these people can create new polls</div>
      </div>
      <div className="scroll">
        <div className="pad">
          <div className="slotrow" style={{ marginBottom: 16 }}>
            <input className="field" value={draft} onChange={e => setDraft(e.target.value)} placeholder="name@email.com" style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && add()} />
            <button className="btn btn-primary btn-sm" onClick={add} style={{ flex: '0 0 auto' }}><Icon name="plus" size={16} />Add</button>
          </div>
          <div className="card" style={{ padding: '4px 14px' }}>
            {emails.map((x, i) => (
              <div className="email-row" key={x.e}>
                <Avatar name={x.e[0].toUpperCase()} size={32} />
                <span className="em">{x.e}</span>
                {x.owner
                  ? <span className="owner-tag">Owner</span>
                  : <button className="x" onClick={() => setEmails(emails.filter(y => y.e !== x.e))} aria-label="Remove"><Icon name="trash" size={16} /></button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { SignInScreen, AdminScreen });
