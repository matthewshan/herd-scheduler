/* ResultsScreen.jsx — host & voters see the breakdown; host finalizes */
const { useState: useStateResults } = React;

function scoreSlot(s) {
  // best-fit: most yes, zero hard-no preferred, maybe as tiebreak
  return s.yes.length * 3 + s.maybe.length - s.no.length * 4;
}

function ResultsScreen({ go, isHost, initialFinalized }) {
  const [finalized, setFinalized] = useStateResults(initialFinalized || null); // slotId

  const sorted = [...POLL.slots].sort((a, b) => scoreSlot(b) - scoreSlot(a));
  const topScore = scoreSlot(sorted[0]);
  const responded = 6;

  const finalSlot = finalized ? POLL.slots.find(s => s.id === finalized) : null;

  return (
    <>
      <div className="appbar">
        <div className="appbar-row">
          <button className="iconbtn" onClick={() => go('vote')} aria-label="Back"><Icon name="arrow-left" /></button>
          <div style={{ flex: 1 }}>
            <h1 className="ds-h1">{POLL.title}</h1>
          </div>
          {isHost && <button className="iconbtn" onClick={() => go('create')} aria-label="Settings"><Icon name="settings" size={19} /></button>}
          <ThemeToggle />
        </div>
        <div className="host-line">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="users" size={13} />{responded} responded</span>
          <span className="sep">·</span>
          <span>Hosted by {POLL.host}</span>
        </div>
        <div style={{ marginTop: 10 }}><TzChip label={POLL.tz} /></div>
      </div>

      <div className="scroll">
        <div className="pad">
          {finalSlot && (
            <div className="banner">
              <div className="bi"><Icon name="check" size={18} /></div>
              <div className="bt">
                Finalized
                <b className="tnum">{finalSlot.day} · {finalSlot.time.split('–')[0]} PM ET</b>
              </div>
            </div>
          )}

          <div className="section-h">{finalSlot ? 'Final pick & other options' : 'Sorted by best fit'}</div>

          {sorted.map(s => {
            const y = s.yes.length, m = s.maybe.length, n = s.no.length;
            const isBest = scoreSlot(s) === topScore && !finalSlot;
            const worksForAll = n === 0;
            const isFinal = finalized === s.id;
            const available = [...s.yes, ...s.maybe];
            return (
              <div className={'card' + (isBest ? ' card-best' : '') + (isFinal ? ' card-finalized' : '')} key={s.id}>
                <div className="slot-top">
                  <div>
                    <div className="slot-day">{s.day}</div>
                    <div className="slot-time tnum">{s.time}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    {isFinal && <span className="pill pill-finalized"><Icon name="check" size={14} />Finalized</span>}
                    {isBest && <span className="pill pill-best"><Icon name="check" size={13} style={{display:'none'}} />★ Best fit</span>}
                  </div>
                </div>

                <StackedBar y={y} m={m} n={n} />
                <Tally y={y} m={m} n={n} />

                <div className="who">
                  <AvatarStack names={available} size={28} max={5} />
                  <span className="who-label">{worksForAll ? '' : available.length + ' can make it'}</span>
                  {worksForAll && <span className="pill pill-all"><Icon name="check" size={13} />Works for everyone</span>}
                </div>

                {isHost && !finalSlot && (
                  <button className="btn btn-outline btn-sm btn-block" style={{ marginTop: 13 }} onClick={() => setFinalized(s.id)}>
                    Finalize this time
                  </button>
                )}
                {isHost && isFinal && (
                  <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 13 }} onClick={() => setFinalized(null)}>
                    Change pick
                  </button>
                )}
              </div>
            );
          })}
          <div style={{ height: 8 }} />
        </div>
      </div>
    </>
  );
}

Object.assign(window, { ResultsScreen });
