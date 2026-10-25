import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import './hearings.css';
import './case-actions.css';

function DecisionForm({ onSubmit, busy }) {
  const [finding, setFinding] = useState('responsible');
  const [rationale, setRationale] = useState('');
  const [actions, setActions] = useState([{ type: 'warning', description: '', dueDate: '' }]);
  const includeActions = finding === 'responsible';

  function changeAction(index, changes) {
    setActions((current) => current.map((action, itemIndex) => itemIndex === index ? { ...action, ...changes } : action));
  }

  return <form className="case-decision-form" onSubmit={(event) => {
    event.preventDefault();
    onSubmit({ finding, rationale, actions: includeActions ? actions.map(({ dueDate, ...action }) => ({ ...action, ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}) })) : [] });
  }}>
    <p className="eyebrow">CASE DECISION</p>
    <label>Finding<select value={finding} onChange={(event) => setFinding(event.target.value)}><option value="responsible">Responsible</option><option value="not_responsible">Not responsible</option><option value="inconclusive">Inconclusive</option></select></label>
    <label>Decision rationale<textarea rows="3" maxLength="5000" value={rationale} onChange={(event) => setRationale(event.target.value)} required /></label>
    {includeActions && <div className="action-draft-list"><strong>Disciplinary action</strong>{actions.map((action, index) => <div className="action-draft" key={index}>
      <label>Type<select value={action.type} onChange={(event) => changeAction(index, { type: event.target.value })}><option value="warning">Warning</option><option value="suspension">Suspension</option><option value="other">Other</option></select></label>
      <label>Description<input value={action.description} maxLength="2000" onChange={(event) => changeAction(index, { description: event.target.value })} required /></label>
      <label>Due date (optional)<input type="date" value={action.dueDate} onChange={(event) => changeAction(index, { dueDate: event.target.value })} /></label>
      {actions.length > 1 && <button type="button" className="text-action" onClick={() => setActions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}
    </div>)}{actions.length < 8 && <button type="button" className="text-action" onClick={() => setActions((current) => [...current, { type: 'warning', description: '', dueDate: '' }])}>Add another action</button>}</div>}
    <button className="primary-action" disabled={busy || !rationale.trim()}>{busy ? 'Saving…' : 'Record decision and close case'}</button>
  </form>;
}

function localDateTime(date = new Date(Date.now() + 86400000)) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

function calendarMonthOffset(date, months) {
  const shifted = new Date(date);
  const day = shifted.getDate();
  shifted.setDate(1);
  shifted.setMonth(shifted.getMonth() + months);
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  shifted.setDate(Math.min(day, lastDay));
  return shifted;
}

export default function HearingWorkspace() {
  const [cases, setCases] = useState([]);
  const [caseId, setCaseId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(localDateTime());
  const [location, setLocation] = useState('');
  const [proceedings, setProceedings] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const data = await api('/cases');
    setCases(data.cases);
    const selectedOpenCase = data.cases.find((item) => String(item._id) === caseId && item.currentStatus === 'open');
    if (!selectedOpenCase) setCaseId(String(data.cases.find((item) => item.currentStatus === 'open')?._id || ''));
  }, [caseId]);

  useEffect(() => { refresh().catch((requestError) => setError(requestError.message)); }, [refresh]);

  async function schedule(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api(`/cases/${caseId}/hearings`, { method: 'POST', body: JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString(), location }) });
      setLocation(''); setNotice('Hearing scheduled.'); await refresh();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function complete(hearingId) {
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/cases/hearings/${hearingId}/complete`, { method: 'PATCH', body: JSON.stringify({ proceedings: proceedings[hearingId] || '' }) });
      setNotice('Proceedings saved to the case history.');
      setProceedings((current) => ({ ...current, [hearingId]: '' }));
      await refresh();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function recordDecision(id, decision) {
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/cases/${id}/decision`, { method: 'POST', body: JSON.stringify(decision) });
      setNotice('Decision recorded, actions completed, and case closed.'); await refresh();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  const openCases = cases.filter((item) => item.currentStatus === 'open');
  const hearingMax = localDateTime(calendarMonthOffset(new Date(), 1));

  return <section id="hearing-workspace" className="incident-workspace hearing-workspace">
    <article className="panel">
      <div className="panel-heading"><div><p className="eyebrow">CASE PROCEEDINGS</p><h2>Schedule a case hearing</h2></div><span className="count-pill">{cases.filter((item) => item.currentStatus === 'open').length} open cases</span></div>
      {notice && <p className="success-message" role="status">{notice}</p>}{error && <p className="alert" role="alert">{error}</p>}
      {openCases.length ? <form className="hearing-schedule-form" onSubmit={schedule}>
        <label>Case<select value={caseId} onChange={(event) => setCaseId(event.target.value)} required>{openCases.map((item) => <option key={item._id} value={item._id}>{item.caseNumber} · Roll number {item.studentId?.studentId || '—'}</option>)}</select></label>
        <label>Date and time<input type="datetime-local" min={localDateTime(new Date())} max={hearingMax} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /><small className="optional-label">Schedule within the next month</small></label>
        <label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} maxLength="200" required /></label>
        <button className="primary-action" disabled={busy}>{busy ? 'Saving…' : 'Schedule hearing'}</button>
      </form> : <p className="muted">There are no open cases to schedule.</p>}
    </article>
    {cases.map((item) => <article className="panel" key={item._id}>
      <div className="panel-heading"><div><p className="eyebrow">ROLL NUMBER {item.studentId?.studentId || '—'}</p><h2>{item.caseNumber}</h2></div><span className="incident-status">{item.currentStatus}</span></div>
      {item.hearings.length ? <div className="hearing-list">{item.hearings.map((hearing) => <div className="hearing-entry" key={hearing._id}>
        <div className="hearing-entry-heading"><strong>{new Date(hearing.scheduledAt).toLocaleString()}</strong><span className="incident-status">{hearing.status}</span></div>
        <p className="muted">{hearing.location}</p>
        {hearing.status === 'scheduled' ? <><label>Proceedings<textarea rows="3" maxLength="5000" placeholder="Record the hearing outcome and proceedings after it takes place." value={proceedings[hearing._id] || ''} onChange={(event) => setProceedings((current) => ({ ...current, [hearing._id]: event.target.value }))} /></label><button className="primary-action" disabled={busy || !(proceedings[hearing._id] || '').trim()} onClick={() => complete(hearing._id)}>Complete hearing and save proceedings</button></> : <div className="hearing-minutes"><strong>Proceedings</strong><p>{hearing.proceedings}</p></div>}
      </div>)}</div> : <p className="muted">No hearings scheduled for this case.</p>}
      {item.decision ? <div className="decision-summary"><p className="eyebrow">DECISION · {item.decision.finding.replace('_', ' ')}</p><p>{item.decision.rationale}</p></div> : item.currentStatus === 'open' && item.hearings.some((hearing) => hearing.status === 'completed')
        ? <DecisionForm busy={busy} onSubmit={(payload) => recordDecision(item._id, payload)} />
        : item.currentStatus === 'open' && <p className="muted">Complete at least one hearing before recording a decision.</p>}
      {item.actions?.length > 0 && <div className="disciplinary-actions"><div className="panel-heading"><div><p className="eyebrow">DISCIPLINARY ACTIONS</p><h2>Actions</h2></div></div>{item.actions.map((action) => <div className="action-entry" key={action._id}>
        <div className="hearing-entry-heading"><strong>{action.type.replace('_', ' ')} · {action.status.replace('_', ' ')}</strong>{action.dueDate && <span className="muted">Due {new Date(action.dueDate).toLocaleDateString()}</span>}</div>
        <p>{action.description}</p>
      </div>)}</div>}
    </article>)}
  </section>;
}
