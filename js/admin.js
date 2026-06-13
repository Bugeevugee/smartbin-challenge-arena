/**
 * SmartBin Challenge Arena - Admin Dashboard controller
 */

import { db, isFirebaseFallback } from './firebase-config.js';
import { getActiveSessionDetails, DEFAULT_SESSION } from './multiplayer.js';

// Access Control
const ADMIN_PASSCODE = 'ecoloop2026';
const loginGate = document.getElementById('loginGate');
const passcodeField = document.getElementById('passcode');
const btnLogin = document.getElementById('btnLogin');
const loginError = document.getElementById('loginError');

// Form Actions
const dbStatusBadge = document.getElementById('dbStatusBadge');
const sessionNameInput = document.getElementById('sessionNameInput');
const btnNewSession = document.getElementById('btnNewSession');
const btnPurgeSession = document.getElementById('btnPurgeSession');

// Check login token
if (sessionStorage.getItem('arena_admin_logged_in') === 'true') {
  loginGate.classList.add('hidden');
  initAdminView();
} else {
  // Bind passcode submit actions
  btnLogin.addEventListener('click', checkPasscode);
  passcodeField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkPasscode();
  });
}

function checkPasscode() {
  const code = passcodeField.value.trim();
  if (code === ADMIN_PASSCODE) {
    sessionStorage.setItem('arena_admin_logged_in', 'true');
    loginGate.classList.add('hidden');
    initAdminView();
  } else {
    loginError.innerText = 'Incorrect passcode. Please try again.';
    passcodeField.value = '';
    passcodeField.focus();
  }
}

function initAdminView() {
  // Update Database status badge
  if (isFirebaseFallback || !db) {
    dbStatusBadge.innerText = 'Offline Demo Mode (LocalStorage)';
    dbStatusBadge.className = 'status-badge status-fallback';
  } else {
    dbStatusBadge.innerText = 'Online Live Mode (Firebase Firestore)';
    dbStatusBadge.className = 'status-badge status-active';
  }

  // Load current session parameters into input placeholder
  getActiveSessionDetails().then(session => {
    sessionNameInput.value = session.sessionName;
  });

  // Action listeners
  btnNewSession.addEventListener('click', launchNewSession);
  btnPurgeSession.addEventListener('click', purgeLeaderboard);
}

// Generates a new unique session ID
async function launchNewSession() {
  const newSessionName = sessionNameInput.value.trim() || 'EcoLoop Challenge Round';
  const newSessionId = 'session_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

  if (confirm(`Launch new session "${newSessionName}"?\n\nExisting player leaderboards will immediately clear as all scores will route to the new session ID. Old scores remain archived in the database.`)) {
    
    if (isFirebaseFallback || !db) {
      // Local storage mock
      localStorage.setItem('local_session_id', newSessionId);
      localStorage.setItem('local_session_name', newSessionName);
      alert(`Success! Launched local session:\nName: ${newSessionName}\nID: ${newSessionId}`);
      return;
    }

    try {
      btnNewSession.disabled = true;
      btnNewSession.innerText = 'Launching...';

      // Update Firestore config doc
      await db.collection('config').doc('activeSession').set({
        sessionId: newSessionId,
        sessionName: newSessionName,
        createdAt: new Date().toISOString()
      });

      alert(`Success! Pushed new session online:\nName: ${newSessionName}\nID: ${newSessionId}`);
    } catch (err) {
      console.error('Failed to create new Firebase session:', err);
      alert('Error: Could not push new session. Check console rules.');
    } finally {
      btnNewSession.disabled = false;
      btnNewSession.innerText = '⚡ Launch New Session';
    }
  }
}

// Deletes scores associated with the active session ID
async function purgeLeaderboard() {
  const session = await getActiveSessionDetails();

  if (confirm(`⚠️ DANGER: Are you sure you want to completely erase the leaderboard for the active session:\n"${session.sessionName}" (${session.sessionId})?\n\nThis will permanently delete all rankings in this round. This cannot be undone.`)) {
    
    if (isFirebaseFallback || !db) {
      // Local Storage mock purge
      let allScores = JSON.parse(localStorage.getItem('local_db_scores')) || [];
      const beforeCount = allScores.length;
      allScores = allScores.filter(s => s.sessionId !== session.sessionId);
      const deletedCount = beforeCount - allScores.length;
      localStorage.setItem('local_db_scores', JSON.stringify(allScores));
      alert(`Success! Mock database purged. Removed ${deletedCount} score records.`);
      return;
    }

    try {
      btnPurgeSession.disabled = true;
      btnPurgeSession.innerText = 'Purging Database...';

      // Query active session scores
      const querySnap = await db.collection('scores')
        .where('sessionId', '==', session.sessionId)
        .get();

      if (querySnap.empty) {
        alert('Leaderboard is already clean (0 records found).');
        return;
      }

      // Batch delete matching records
      const batch = db.batch();
      querySnap.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      alert(`Success! Erased ${querySnap.size} standings records from Firestore.`);
    } catch (err) {
      console.error('Failed to purge Firestore database:', err);
      alert('Error: Deletion failed. Check console rules & settings.');
    } finally {
      btnPurgeSession.disabled = false;
      btnPurgeSession.innerText = '🗑️ Purge Active Leaderboard';
    }
  }
}
