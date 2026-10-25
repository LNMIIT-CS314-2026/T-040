import { useEffect, useState } from 'react';
import { api } from './api/client.js';
import './admin.css';
import './nav.css';
import './workspace-navigation.css';
import './student-hearings.css';
import './student-outcomes.css';
import IncidentWorkspace from './features/incidents/IncidentWorkspace.jsx';
import HearingWorkspace from './features/hearings/HearingWorkspace.jsx';

const roles = {
  administrator: 'Administrator',
  student: 'Student',
  reporting_staff: 'Faculty / Reporting Staff',
  discipline_officer: 'Discipline Officer / Committee',
};

function StudentOutcomeCard({ caseNumber, caseStatus, decision, actions }) {
  const finding = decision?.finding.replaceAll('_', ' ');
  return <article className="student-outcome-card">
    <header className="student-outcome-heading">
      <div><span className="case-number-label">CASE</span><h3>{caseNumber}</h3></div>
      {caseStatus && <span className={`case-status-badge ${caseStatus}`}>{caseStatus}</span>}
    </header>
    <div className="student-outcome-content">
      {decision && <section className="student-outcome-decision">
        <div className="student-outcome-section-heading"><div><span className="outcome-section-label">DECISION</span><small>Recorded {new Date(decision.decidedAt).toLocaleDateString()}</small></div><span className={`finding-badge ${decision.finding}`}>{finding}</span></div>
        <p>{decision.rationale}</p>
      </section>}
      {actions.length > 0 && <section className="student-outcome-actions">
        <div className="student-outcome-section-heading"><div><span className="outcome-section-label">DISCIPLINARY ACTIONS</span><small>{actions.length} {actions.length === 1 ? 'action' : 'actions'}</small></div></div>
        <ul>{actions.map((action) => <li key={action.id}>
          <div className="outcome-action-copy"><strong>{action.type.replaceAll('_', ' ')}</strong><p>{action.description}</p>{action.dueDate && <small>Due {new Date(action.dueDate).toLocaleDateString()}</small>}</div>
          <span className={`action-status-badge ${action.status}`}>{action.status.replaceAll('_', ' ')}</span>
        </li>)}</ul>
      </section>}
    </div>
  </article>;
}

function studentIncidentStatus(incident) {
  if (incident.outcome === 'rejected_closed' || incident.status === 'Rejected/Closed' || incident.caseStatus === 'closed') return 'Closed';
  if (incident.status === 'Submitted') return 'Pending';
  if (incident.status === 'Under Initial Review' || incident.caseStatus === 'open' || incident.outcome === 'converted_to_case') return 'Under review';
  return 'Closed';
}

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('reporting_staff');
  const [studentId, setStudentId] = useState('');

  async function refresh() {
    const data = await api('/admin/users');
    setUsers(data.users);
  }
  useEffect(() => { refresh().catch((requestError) => setError(requestError.message)); }, []);

  async function createUser(event) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      await api('/admin/users', { method: 'POST', body: JSON.stringify({ name, email, password, role, ...(role === 'student' ? { studentId } : {}) }) });
      setName(''); setEmail(''); setPassword(''); setStudentId('');
      setNotice('Account created.'); await refresh();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function updateUser(user, changes) {
    setError(''); setNotice('');
    if (changes.role === 'student' && user.role !== 'student') {
      const studentId = window.prompt('Enter the existing student roll number to link to this account:');
      if (!studentId) return;
      changes.studentId = studentId;
    }
    try {
      const data = await api(`/admin/users/${user._id}`, { method: 'PATCH', body: JSON.stringify(changes) });
      setUsers((current) => current.map((item) => item._id === user._id ? { ...item, ...data.user } : item));
      setNotice('Account updated.');
    } catch (requestError) { setError(requestError.message); }
  }

  return <section id="admin-users" className="panel admin-users-panel">
    <div className="panel-heading"><div><p className="eyebrow">ACCESS CONTROL</p><h2>Users and role assignments</h2></div><span className="count-pill">{users.length} accounts</span></div>
    {error && <p className="alert admin-message" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
    <form onSubmit={createUser} className="create-user-form">
      <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} maxLength="120" required /></label>
      <label>Institutional email<input type="email" placeholder="name@lnmiit.ac.in" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Temporary password<input type="password" minLength="12" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <label>Role<select value={role} onChange={(event) => setRole(event.target.value)}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {role === 'student' && <label>Student roll number<input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="24ucs005" required /></label>}
      <button disabled={busy}>{busy ? 'Saving…' : 'Create account'}</button>
    </form>
    <div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Account</th></tr></thead><tbody>{users.map((item) => <tr key={item._id || item.id}><td><strong>{item.name}</strong><small>{item.email}</small></td><td><select aria-label={`Role for ${item.name}`} value={item.role} disabled={item._id === undefined && item.id === undefined} onChange={(event) => updateUser(item, { role: event.target.value })}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><button className={`account-toggle ${item.accountStatus}`} onClick={() => updateUser(item, { accountStatus: item.accountStatus === 'active' ? 'inactive' : 'active' })}>{item.accountStatus}</button></td></tr>)}</tbody></table></div>
    <p className="muted table-footnote">Changes are recorded in the read-only audit history. Student access remains scoped to their own profile.</p>
  </section>;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, role }) }); onLogin(result.user); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return <main className="login-shell">
    <section className="login-card">
      <h1 className="login-title">Student Discipline Management System</h1>
      <p className="muted">Use your institutional account to continue.</p>
      <form onSubmit={submit} className="form-stack">
        <label>Email address<input type="email" autoComplete="username" placeholder="name@lnmiit.ac.in" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <label>Your role<select value={role} onChange={(event) => setRole(event.target.value)} required><option value="">Choose your role</option>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {error && <p className="alert" role="alert">{error}</p>}
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">→</span></button>
      </form>
      <p className="privacy-note">Access is limited to authorized users. Activity may be recorded for institutional audit.</p>
    </section>
  </main>;
}

function Dashboard({ user, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [studentCases, setStudentCases] = useState([]);
  const [studentIncidents, setStudentIncidents] = useState([]);
  const [studentHearings, setStudentHearings] = useState([]);
  const [studentDecisions, setStudentDecisions] = useState([]);
  const [studentActions, setStudentActions] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [auditEntries, setAuditEntries] = useState([]);
  const defaultViews = { administrator: 'users', reporting_staff: 'report', discipline_officer: 'incident-queue', student: 'student-profile' };
  const [activeView, setActiveView] = useState(defaultViews[user.role]);

  useEffect(() => {
    if (user.role === 'student') api('/students/me/profile').then((data) => {
      setProfile(data.profile);
      setStudentCases(data.cases || []);
      setStudentIncidents(data.incidents || []);
      setStudentHearings(data.hearings || []);
      setStudentDecisions(data.decisions || []);
      setStudentActions(data.actions || []);
    }).catch((error) => setLoadError(error.message));
    if (user.role === 'administrator') {
      api('/admin/audit').then((data) => setAuditEntries(data.entries)).catch((error) => setLoadError(error.message));
    }
  }, [user]);

  const navigation = [
    ...(user.role === 'administrator' ? [
      { id: 'users', label: 'User management', icon: '♙' },
      { id: 'audit', label: 'Audit activity', icon: '◷' },
    ] : []),
    ...(user.role === 'reporting_staff' ? [{ id: 'report', label: 'Report incident', icon: '＋' }] : []),
    ...(user.role === 'discipline_officer' ? [
      { id: 'incident-queue', label: 'Incident queue', icon: '▤' },
      { id: 'hearings', label: 'Hearings and decisions', icon: '◷' },
    ] : []),
    ...(user.role === 'student' ? [
      { id: 'student-profile', label: 'My information', icon: '▧' },
      { id: 'student-incidents', label: 'My incident reports', icon: '▤' },
      { id: 'student-hearings', label: 'My hearings', icon: '◷' },
      { id: 'student-decisions', label: 'Decisions and actions', icon: '✓' },
    ] : []),
  ];
  const activeLabel = navigation.find((item) => item.id === activeView)?.label || navigation[0].label;
  const outcomeCaseNumbers = [...new Set([...studentDecisions, ...studentActions].map((item) => item.caseNumber))];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="side-brand"><div className="brand-mark small">T</div><span>T040 <small>Student Services</small></span></div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Workspace sections">{navigation.map((item) => <button type="button" key={item.id} className={`nav-item ${activeView === item.id ? 'selected' : ''}`} aria-current={activeView === item.id ? 'page' : undefined} onClick={() => { setActiveView(item.id); setLoadError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="avatar">{user.name.slice(0, 1)}</div><div className="user-mini"><strong>{user.name}</strong><span>{roles[user.role]}</span></div><button className="icon-button" aria-label="Sign out" onClick={onLogout}>↪</button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><span className="breadcrumb">Workspace</span><span className="slash">/</span> {activeLabel}</div><div className="top-right"><span className="status-dot" /> Secure session</div></header>
      <section className="page-heading"><div><p className="eyebrow">{roles[user.role].toUpperCase()} WORKSPACE</p><h1>{activeLabel}</h1><p className="muted">Manage your {activeLabel.toLowerCase()} here.</p></div><span className="role-pill">{roles[user.role]}</span></section>
      {loadError && <p className="alert wide" role="alert">{loadError}</p>}
      {user.role === 'student' && activeView === 'student-profile' && <section className="section-content"><article className="panel profile-panel"><div className="panel-heading"><div><p className="eyebrow">MY PROFILE</p><h2>Student information</h2></div><span className="lock-tag">Private</span></div>{profile ? <dl className="profile-list"><div><dt>Name</dt><dd>{profile.name}</dd></div><div><dt>Roll number</dt><dd>{profile.studentId}</dd></div></dl> : <p className="muted">Loading your profile…</p>}</article></section>}
      {user.role === 'student' && activeView === 'student-hearings' && <section className="section-content"><article className="panel student-incidents-panel"><div className="panel-heading"><div><p className="eyebrow">CASE PROCEEDINGS</p><h2>My cases</h2></div><span className="count-pill">{studentCases.length} {studentCases.length === 1 ? 'case' : 'cases'}</span></div>{studentCases.length ? <div className="student-cases-list">{studentCases.map((caseItem) => { const caseHearings = studentHearings.filter((hearing) => hearing.caseNumber === caseItem.caseNumber); return <section className="student-case-card" key={caseItem.caseNumber}><div className="student-case-heading"><div className="student-case-title"><span className="case-number-label">CASE</span><strong>{caseItem.caseNumber}</strong></div><div className="case-status-block"><span className="case-status-label">Case status</span><span className={`case-status-badge ${caseItem.status}`}>{caseItem.status === 'open' ? 'Open' : 'Closed'}</span></div></div>{caseHearings.length ? <ul className="case-hearing-list">{caseHearings.map((hearing) => <li key={hearing.id}><div className="case-hearing-details"><strong>{new Date(hearing.scheduledAt).toLocaleString()}</strong><small>{hearing.location}</small>{hearing.proceedings && <small className="hearing-proceedings">{hearing.proceedings}</small>}</div><span className={`hearing-badge ${hearing.status}`}><span className="hearing-status-label">Hearing</span>{hearing.status === 'completed' ? 'Completed' : hearing.status === 'scheduled' ? 'Scheduled' : 'Cancelled'}</span></li>)}</ul> : <p className="muted case-hearing-empty">No hearings have been scheduled for this case.</p>}</section>; })}</div> : <p className="muted student-incident-empty">No cases are linked to your student profile yet.</p>}</article></section>}
      {user.role === 'student' && activeView === 'student-incidents' && <section className="section-content"><article className="panel student-incidents-panel"><div className="panel-heading"><div><p className="eyebrow">STUDENT SERVICES</p><h2>My incident reports</h2></div><span className="count-pill">{studentIncidents.length}</span></div>{studentIncidents.length ? <ul className="student-incident-list">{studentIncidents.map((incident) => { const status = studentIncidentStatus(incident); return <li key={incident.id}><div><strong>{incident.incidentId} · {incident.subject}</strong><small>Reported {new Date(incident.reportedDate).toLocaleDateString()}</small>{incident.caseNumber && <small>Case {incident.caseNumber}{incident.caseStatus ? ` · ${incident.caseStatus}` : ''}</small>}</div><span className="incident-status">{status}</span></li>; })}</ul> : <p className="muted student-incident-empty">No incident reports are linked to your student profile yet.</p>}</article></section>}
      {user.role === 'student' && activeView === 'student-decisions' && <section className="section-content"><article className="panel student-incidents-panel student-outcomes-panel"><div className="panel-heading"><div><p className="eyebrow">CASE OUTCOMES</p><h2>Decisions and actions</h2></div><span className="count-pill">{outcomeCaseNumbers.length} {outcomeCaseNumbers.length === 1 ? 'case' : 'cases'}</span></div>{outcomeCaseNumbers.length ? <div className="student-outcome-list">{outcomeCaseNumbers.map((caseNumber) => <StudentOutcomeCard key={caseNumber} caseNumber={caseNumber} caseStatus={studentCases.find((item) => item.caseNumber === caseNumber)?.status} decision={studentDecisions.find((item) => item.caseNumber === caseNumber)} actions={studentActions.filter((item) => item.caseNumber === caseNumber)} />)}</div> : <p className="muted student-incident-empty">No decisions or disciplinary actions have been recorded for your cases.</p>}</article></section>}
      {user.role === 'administrator' && activeView === 'users' && <section className="section-content"><AdminUsers /></section>}
      {user.role === 'administrator' && activeView === 'audit' && <section className="section-content"><article className="panel"><div className="panel-heading"><div><p className="eyebrow">ACCOUNTABILITY</p><h2>Recent audit activity</h2></div></div>{auditEntries.length ? <ul className="audit-list">{auditEntries.map((entry) => <li key={entry._id}><span className="audit-dot"/><div><strong>{entry.action}</strong><small>{entry.actorId?.name || 'System'} · {new Date(entry.createdAt).toLocaleString()}</small></div></li>)}</ul> : <div className="empty-audit"><span>◷</span><p>No recent administrative activity</p></div>}<p className="privacy-note">Audit entries are read-only.</p></article></section>}
      {user.role === 'reporting_staff' && activeView === 'report' && <IncidentWorkspace role={user.role} />}
      {user.role === 'discipline_officer' && activeView === 'incident-queue' && <IncidentWorkspace role={user.role} />}
      {user.role === 'discipline_officer' && activeView === 'hearings' && <HearingWorkspace />}
    </main>
  </div>;
}
export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => { api('/auth/me').then((data) => setUser(data.user)).catch(() => {}).finally(() => setChecking(false)); }, []);
  async function logout() { try { await api('/auth/logout', { method: 'POST' }); } finally { setUser(null); } }
  if (checking) return <div className="checking">Loading secure workspace…</div>;
  return user ? <Dashboard user={user} onLogout={logout} /> : <Login onLogin={setUser} />;
}
