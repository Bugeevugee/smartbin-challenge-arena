/**
 * SmartBin Challenge Arena - Fullscreen Projector Dashboard Controller
 */

import { db, isFirebaseFallback } from './firebase-config.js';
import { getActiveSessionDetails, DEFAULT_SESSION } from './multiplayer.js';

// DOM Bindings
const activeSessionName = document.getElementById('activeSessionName');
const rankingsContainer = document.getElementById('rankingsContainer');
const qrImage = document.getElementById('qrImage');
const qrLinkText = document.getElementById('qrLinkText');
const totalCo2Display = document.getElementById('totalCo2Display');

// State tracking
let currentSessionId = null;
let firestoreUnsubscribe = null;
let lastScoresHash = ''; // Check differences before re-drawing in local loop

function initProjector() {
  // Generate join URL pointing to index.html instead of projector.html
  const currentUrl = window.location.href;
  const joinUrl = currentUrl.replace('projector.html', 'index.html');
  
  // Set QR code image using free public API
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(joinUrl)}&color=0f172a&bgcolor=ffffff`;
  qrImage.src = qrApiUrl;
  
  // Display human-readable text link
  const urlDisplay = joinUrl.replace('http://', '').replace('https://', '').split('?')[0];
  qrLinkText.innerText = urlDisplay;

  // Start checking sessions
  syncSessionListener();
}

/**
 * Sync active session state.
 * If Firebase is active, sets up snapshot listener on 'config/activeSession'.
 * If Fallback mode, polls local storage.
 */
function syncSessionListener() {
  if (isFirebaseFallback || !db) {
    // Offline poll check: every 1.5s
    setInterval(pollLocalStorageData, 1500);
    pollLocalStorageData(); // Initial execution
    return;
  }

  // Live Firebase listener
  db.collection('config').doc('activeSession').onSnapshot(docSnap => {
    if (docSnap.exists) {
      const data = docSnap.data();
      const sessionId = data.sessionId || DEFAULT_SESSION;
      const sessionName = data.sessionName || 'EcoLoop Challenge Arena';

      activeSessionName.innerText = sessionName;

      // Reset score listener if session ID changes
      if (sessionId !== currentSessionId) {
        currentSessionId = sessionId;
        subscribeToLiveScores(sessionId);
      }
    } else {
      // Default initialization if missing
      activeSessionName.innerText = 'EcoLoop Arena';
      subscribeToLiveScores(DEFAULT_SESSION);
    }
  }, err => {
    console.error('Error listening to session changes:', err);
    // Fallback if permission rules block
    getActiveSessionDetails().then(s => {
      activeSessionName.innerText = s.sessionName;
      subscribeToLiveScores(s.sessionId);
    });
  });
}

/**
 * Subscribes to real-time score snapshots in Firestore for active session
 */
function subscribeToLiveScores(sessionId) {
  // Unsubscribe previous active listener
  if (firestoreUnsubscribe) {
    firestoreUnsubscribe();
  }

  firestoreUnsubscribe = db.collection('scores')
    .where('sessionId', '==', sessionId)
    .orderBy('score', 'desc')
    .orderBy('timestamp', 'asc')
    .limit(10)
    .onSnapshot(querySnap => {
      const scores = [];
      querySnap.forEach(doc => {
        scores.push(doc.data());
      });
      renderStandings(scores);
    }, err => {
      console.error('Firestore score listening failed:', err);
    });
}

/**
 * Renders list arrays onto layout
 */
function renderStandings(scoresList) {
  rankingsContainer.innerHTML = '';

  if (scoresList.length === 0) {
    rankingsContainer.innerHTML = `
      <div class="leaderboard-loading" style="padding-top: 50px;">
        No participants have completed the run yet.<br>
        <span style="font-size:0.9rem; color:#88f3b2; margin-top:10px; display:inline-block;">Scan the QR code to be the first!</span>
      </div>
    `;
    totalCo2Display.innerText = '0.000 kg';
    return;
  }

  // 1st place score determines progress bar calculations
  const topScore = scoresList[0].score || 1;
  let totalCo2 = 0;

  scoresList.forEach((scoreData, index) => {
    const scoreVal = scoreData.score;
    const progressPct = topScore > 0 ? (scoreVal / topScore) * 100 : 0;
    
    // Accumulate total CO2 savings (0.045kg per 10 points completed)
    totalCo2 += Math.floor(scoreVal / 10) * 0.045;

    const row = document.createElement('div');
    row.className = 'rankings-row';
    row.style.setProperty('--progress-pct', `${progressPct}%`);
    
    row.innerHTML = `
      <span class="proj-rank-num">${index + 1}</span>
      <span class="proj-player-name">${escapeHTML(scoreData.nickname)}</span>
      <span class="proj-score-val">${scoreVal} pts</span>
    `;

    rankingsContainer.appendChild(row);
  });

  totalCo2Display.innerText = `${totalCo2.toFixed(3)} kg`;
}

/**
 * LocalStorage polling handler for Offline Demo Mode
 */
function pollLocalStorageData() {
  const localSessionId = localStorage.getItem('local_session_id') || DEFAULT_SESSION;
  const localSessionName = localStorage.getItem('local_session_name') || 'EcoLoop Local Arena';
  
  activeSessionName.innerText = localSessionName;

  // Retrieve scores list
  const allScores = JSON.parse(localStorage.getItem('local_db_scores')) || [];
  const sessionScores = allScores
    .filter(s => s.sessionId === localSessionId)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(a.timestamp) - new Date(b.timestamp);
    })
    .slice(0, 10);

  // Quick comparison hash to avoid unnecessaryDOM updates
  const newHash = JSON.stringify(sessionScores) + '_' + localSessionId;
  if (newHash !== lastScoresHash) {
    lastScoresHash = newHash;
    renderStandings(sessionScores);
  }
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Kick off
initProjector();
