import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import './incident-workspace.css';
import './queue.css';

const emptyForm = { studentId: '', incidentDateTime: '', location: '', subject: '', description: '', evidenceDescription: '' };

function statusLabel(incident) {
  if (incident.outcome === 'converted_to_case') return 'Converted to case';
  if (incident.outcome === 'rejected_closed') return 'Rejected / closed';
  return incident.status;
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

function localDateTime(date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

export default function IncidentWorkspace({ role }) {
  const isOfficer = role === 'discipline_officer';
  const [incidents, setIncidents] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const incidentMin = localDateTime(calendarMonthOffset(now, -1));
  const incidentMax = localDateTime(now);

  const refreshList = useCallback(async () => {
    const data = await api('/incidents');
    setIncidents(data.incidents);
  }, []);

  useEffect(() => {
    refreshList().catch((requestError) => setError(requestError.message));
  }, [refreshList]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    api(`/incidents/${selectedId}`).then((data) => setDetail(data.incident)).catch((requestError) => {
      setDetail(null); setError(requestError.message); setSelectedId('');
    });
  }, [selectedId]);

  async function submitReport(event) {
    event.preventDefault(); setError(''); setNotice(''); setFieldErrors({}); setBusy(true);
    try {
      const data = await api('/incidents', { method: 'POST', body: JSON.stringify({
        ...form,
        incidentDateTime: new Date(form.incidentDateTime).toISOString(),
      }) });
      setNotice(`${data.confirmation} Reference: ${data.incident.incidentId}.`);
      setForm(emptyForm);
      await refreshList();
      setSelectedId(data.incident.id);
    } catch (requestError) {
      setError(requestError.message); setFieldErrors(requestError.fields || {});
    } finally { setBusy(false); }
  }

  async function review(action) {
    setError(''); setNotice(''); setBusy(true);
    try {
      const payload = action === 'reject' ? { action, reason } : { action };
      const data = await api(`/incidents/${selectedId}/review`, { method: 'POST', body: JSON.stringify(payload) });
      if (action === 'begin') setNotice('Initial review started.');
      if (action === 'accept') setNotice(`Incident accepted and converted to case ${data.review.caseNumber}.`);
      if (action === 'reject') setNotice('Incident rejected and closed. The reason was recorded.');
      setReason('');
      if (action === 'accept' || action === 'reject') { setSelectedId(''); setDetail(null); }
      else setDetail((current) => current ? { ...current, status: data.review.status } : current);
      await refreshList();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return <section id="incident-workspace" className="incident-workspace">
    {(isOfficer || error || notice) && <div className="incident-feedback">{notice && <p className="success-message" role="status">{notice}</p>}{error && <p className="alert incident-alert" role="alert">{error}</p>}</div>}
    {!isOfficer && <article className="panel incident-form-panel">
      <div className="panel-heading"><div><p className="eyebrow">REPORT AN INCIDENT</p><h2>Incident details</h2></div><span className="lock-tag">▣ Restricted</span></div>
      <p className="incident-intro">Submit a report for an existing student. Required fields are marked with an asterisk.</p>
      <form className="incident-form" onSubmit={submitReport}>
        <label>Student roll number *<input value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} autoComplete="off" placeholder="24ucs005" required aria-invalid={Boolean(fieldErrors.studentId)} />{fieldErrors.studentId && <small className="field-error">{fieldErrors.studentId[0]}</small>}</label>
        <label>Incident date and time *<span className="optional-label">Must be within the past month</span><input type="datetime-local" min={incidentMin} max={incidentMax} value={form.incidentDateTime} onChange={(e) => setForm({ ...form, incidentDateTime: e.target.value })} required aria-invalid={Boolean(fieldErrors.incidentDateTime)} />{fieldErrors.incidentDateTime && <small className="field-error">{fieldErrors.incidentDateTime[0]}</small>}</label>
        <label>Location *<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength="200" required aria-invalid={Boolean(fieldErrors.location)} />{fieldErrors.location && <small className="field-error">{fieldErrors.location[0]}</small>}</label>
        <label>Subject *<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength="100" required aria-invalid={Boolean(fieldErrors.subject)} />{fieldErrors.subject && <small className="field-error">{fieldErrors.subject[0]}</small>}</label>
        <label className="full-field">Description *<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength="5000" rows="4" required aria-invalid={Boolean(fieldErrors.description)} />{fieldErrors.description && <small className="field-error">{fieldErrors.description[0]}</small>}</label>
        <label className="full-field">Evidence note <span className="optional-label">Optional · restricted metadata only</span><textarea value={form.evidenceDescription} onChange={(e) => setForm({ ...form, evidenceDescription: e.target.value })} maxLength="500" rows="2" placeholder="Describe an accompanying item. Do not paste a public file URL." /></label>
        <div className="full-field incident-form-footer"><p>Reports are visible to authorized discipline officers and to you.</p><button disabled={busy}>{busy ? 'Submitting…' : 'Submit incident report'} <span aria-hidden="true">→</span></button></div>
      </form>
    </article>}

    <div className="incident-list-layout">
      <article className="panel incident-list-panel">
        <div className="panel-heading"><div><p className="eyebrow">{isOfficer ? 'DISCIPLINE OFFICE' : 'YOUR REPORTS'}</p><h2>{isOfficer ? 'Initial review queue' : 'Submitted reports'}</h2></div><div className="incident-list-tools"><span className="count-pill">{incidents.length}</span>{isOfficer && <button className="refresh-queue" onClick={() => refreshList().catch((requestError) => setError(requestError.message))}>Refresh queue</button>}</div></div>
        {incidents.length ? <div className="incident-list">{incidents.map((incident) => <button className={`incident-row ${selectedId === incident.id ? 'current' : ''}`} key={incident.id} onClick={() => { setError(''); setNotice(''); setSelectedId(incident.id); }}>
          <span className="incident-row-icon">{isOfficer ? '▤' : '◷'}</span><span className="incident-row-main"><strong>{incident.incidentId}</strong><small>{isOfficer ? `${incident.studentId || 'Student'} · ${incident.subject}` : `${incident.subject} · ${new Date(incident.reportedDate).toLocaleDateString()}`}</small></span><span className={`incident-status ${incident.outcome || ''}`}>{statusLabel(incident)}</span><span className="row-chevron">›</span>
        </button>)}</div> : <div className="incident-empty"><span>{isOfficer ? '▤' : '◷'}</span><p>{isOfficer ? 'No incidents are waiting for initial review.' : 'Your submitted reports will appear here.'}</p></div>}
      </article>

      <article className="panel incident-detail-panel">
        {!detail ? <div className="incident-empty detail-empty"><span>⌕</span><h2>{isOfficer ? 'Review an incident' : 'Report details'}</h2><p>{isOfficer ? 'Select an incident from the queue to review its details.' : 'Select one of your reports to view its current status.'}</p></div> : <>
          <div className="panel-heading"><div><p className="eyebrow">INCIDENT RECORD</p><h2>{detail.incidentId}</h2></div><span className="incident-status">{statusLabel(detail)}</span></div>
          <div className="incident-facts"><div><span>Student roll number</span><strong>{detail.studentId}</strong></div><div><span>Incident date</span><strong>{new Date(detail.incidentDateTime).toLocaleString()}</strong></div><div><span>Location</span><strong>{detail.location}</strong></div><div><span>Subject</span><strong>{detail.subject}</strong></div><div><span>Reported</span><strong>{new Date(detail.reportedDate).toLocaleString()}</strong></div>{detail.caseNumber && <div><span>Case number</span><strong>{detail.caseNumber}</strong></div>}</div>
          <div className="incident-description"><h3>Description</h3><p>{detail.description}</p></div>
          {detail.evidence?.length > 0 && <div className="incident-description"><h3>Restricted evidence notes</h3>{detail.evidence.map((item) => <p key={item.evidenceId}>{item.description}</p>)}</div>}
          {detail.reviewReason && <div className="review-reason"><h3>Review reason</h3><p>{detail.reviewReason}</p></div>}
          {isOfficer && <div className="review-actions">
            {detail.status === 'Submitted' && <button className="primary-action" disabled={busy} onClick={() => review('begin')}>Begin initial review</button>}
            {detail.status === 'Under Initial Review' && <><button className="primary-action" disabled={busy} onClick={() => review('accept')}>Accept and create case</button><label>Reason for rejection *<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows="3" maxLength="2000" placeholder="Record why this incident is being rejected or closed." /></label><button className="reject-action" disabled={busy || !reason.trim()} onClick={() => review('reject')}>Reject / close incident</button></>}
          </div>}
        </>}
      </article>
    </div>
  </section>;
}
