/**
 * SmartBin Challenge Arena - Multiplayer Lobby Controller
 * Synchronizes list tables and host start cues using Firebase Firestore or local simulations.
 */

import { db, isFirebaseFallback } from './firebase-config.js';
import { getActiveSessionDetails, DEFAULT_SESSION } from './multiplayer.js';

// URL Param checks
const urlParams = new URLSearchParams(window.location.search);
const playerNickname = urlParams.get('nickname') || 'EcoPlayer';
const deviceId = localStorage.getItem('eco_device_id') || 'dev_' + Math.random().toString(36).substring(2, 11);

// DOM Bindings
const lobbySessionName = document.getElementById('lobbySessionName');
const playersList = document.getElementById('playersList');
const playerCount = document.getElementById('playerCount');
const visitorStatus = document.getElementById('visitorStatus');
const btnStartGame = document.getElementById('btnStartGame');
const btnLeaveLobby = document.getElementById('btnLeaveLobby');

// Global Room Reference
const LOBBY_DOC_ID = 'active_lobby';
let lobbyDocRef = null;
let lobbyUnsubscribe = null;
let lobbySession = null;
let isHost = false;

// Offline Simulator Variables
let localLobbyInterval = null;
let mockPlayersList = [];

async function initLobby() {
  // Fetch active session info
  lobbySession = await getActiveSessionDetails();
  lobbySessionName.innerText = `Session: ${lobbySession.sessionName}`;

  if (isFirebaseFallback || !db) {
    // Offline simulation mode
    initLocalMockLobby();
    return;
  }

  // Setup Firebase Firestore reference
  lobbyDocRef = db.collection('lobbies').doc(LOBBY_DOC_ID);
  
  // Register player on join
  await joinOnlineLobby();

  // Setup real-time listener
  subscribeToLobbyUpdates();

  // Exit handlers
  btnLeaveLobby.addEventListener('click', exitLobbyFlow);
  window.addEventListener('beforeunload', cleanUpLobbyRegistration);
}

/**
 * Join Firestore Lobby list
 */
async function joinOnlineLobby() {
  try {
    const docSnap = await lobbyDocRef.get();
    let players = [];
    let status = 'waiting';
    let gameStartedAt = 0;

    if (docSnap.exists) {
      const data = docSnap.data();
      players = data.players || [];
      status = data.status || 'waiting';
      gameStartedAt = data.gameStartedAt || 0;

      // Self-healing check: if lobby is stuck in "playing" for > 75 seconds, reset it
      const elapsedSinceStart = Date.now() - gameStartedAt;
      if (status === 'playing' && elapsedSinceStart > 75000) {
        status = 'waiting';
        players = [];
        console.log("Self-healing: Stuck lobby reset to waiting state.");
      }
    }

    // Append current player, filtering out previous instances of this device
    players = players.filter(p => p.id !== deviceId);
    players.push({
      id: deviceId,
      nickname: playerNickname,
      joinedAt: Date.now()
    });

    // Write back to Firestore
    await lobbyDocRef.set({
      status: status,
      players: players,
      gameStartedAt: gameStartedAt,
      updatedAt: Date.now()
    }, { merge: true });

  } catch (err) {
    console.error("Error joining online lobby:", err);
  }
}

/**
 * Subscribe to lobby documents updates in real-time
 */
function subscribeToLobbyUpdates() {
  lobbyUnsubscribe = lobbyDocRef.onSnapshot(docSnap => {
    if (!docSnap.exists) return;

    const data = docSnap.data();
    const players = data.players || [];
    const status = data.status || 'waiting';

    renderLobbyPlayers(players);

    // Evaluate Host status (first player in the list becomes host)
    if (players.length > 0 && players[0].id === deviceId) {
      setHostState(true);
    } else {
      setHostState(false);
    }

    // Check if the game has been started by host
    if (status === 'playing') {
      launchSynchronizedGame();
    }
  }, err => {
    console.error("Lobby snapshot error:", err);
  });
}

/**
 * Render player row list bindings
 */
function renderLobbyPlayers(players) {
  playersList.innerHTML = '';
  playerCount.innerText = players.length;

  players.forEach((player, index) => {
    const isMe = player.id === deviceId;
    const isRoomHost = index === 0;

    const item = document.createElement('div');
    item.className = `player-item ${isMe ? 'is-me' : ''}`;
    
    item.innerHTML = `
      <div class="player-name-wrapper">
        <span class="lobby-avatar">${isMe ? '🦊' : '🦝'}</span>
        <span class="lobby-nickname">${escapeHTML(player.nickname)}</span>
      </div>
      ${isRoomHost ? '<span class="host-badge">Host</span>' : ''}
    `;

    playersList.appendChild(item);
  });

  // Action binding for Start Game button
  btnStartGame.onclick = triggerStartGameOnline;
}

function setHostState(active) {
  isHost = active;
  if (active) {
    btnStartGame.classList.remove('hidden');
    visitorStatus.classList.add('hidden');
  } else {
    btnStartGame.classList.add('hidden');
    visitorStatus.classList.remove('hidden');
  }
}

async function triggerStartGameOnline() {
  if (!isHost) return;

  try {
    btnStartGame.disabled = true;
    btnStartGame.innerText = 'Launching arena...';

    // Set lobby doc status to playing
    await lobbyDocRef.update({
      status: 'playing',
      gameStartedAt: Date.now()
    });
  } catch (err) {
    console.error("Failed to start lobby game:", err);
    btnStartGame.disabled = false;
    btnStartGame.innerHTML = '<span>🚀 Start Game for Everyone</span>';
  }
}

function launchSynchronizedGame() {
  // Turn off listeners before routing
  cleanUpLobbyRegistration();
  
  // Navigate to play field
  window.location.href = `game.html?mode=multi&nickname=${encodeURIComponent(playerNickname)}`;
}

async function cleanUpLobbyRegistration() {
  if (lobbyUnsubscribe) lobbyUnsubscribe();
  
  if (!isFirebaseFallback && db && lobbyDocRef) {
    try {
      // Remove self from the players array before page closes
      const docSnap = await lobbyDocRef.get();
      if (docSnap.exists) {
        let players = docSnap.data().players || [];
        players = players.filter(p => p.id !== deviceId);
        
        const nextStatus = players.length === 0 ? 'waiting' : docSnap.data().status;

        await lobbyDocRef.set({
          players: players,
          status: nextStatus
        }, { merge: true });
      }
    } catch (e) {
      console.warn("Could not clean up lobby registration:", e);
    }
  }
}

function exitLobbyFlow() {
  cleanUpLobbyRegistration().then(() => {
    window.location.href = 'index.html';
  });
}

// ----------------------------------------------------
// LOCAL STORAGE MOCK LOBBY SIMULATOR
// ----------------------------------------------------
function initLocalMockLobby() {
  console.log("Initializing local mock lobby for test runs...");
  mockPlayersList = [{
    id: deviceId,
    nickname: playerNickname,
    joinedAt: Date.now()
  }];

  renderLobbyPlayers(mockPlayersList);
  setHostState(true); // Always host in local mock mode

  // Simulated bot joins to show multiplayer feel
  setTimeout(() => {
    mockPlayersList.push({ id: 'bot_1', nickname: 'GreenStudent_23', joinedAt: Date.now() });
    renderLobbyPlayers(mockPlayersList);
  }, 2000);

  setTimeout(() => {
    mockPlayersList.push({ id: 'bot_2', nickname: 'EcoPeel_78', joinedAt: Date.now() });
    renderLobbyPlayers(mockPlayersList);
  }, 4500);

  // Overwrite start button behavior for mock mode
  btnStartGame.onclick = () => {
    btnStartGame.disabled = true;
    btnStartGame.innerText = 'Starting...';
    setTimeout(() => {
      window.location.href = `game.html?mode=multi&nickname=${encodeURIComponent(playerNickname)}`;
    }, 1000);
  };

  btnLeaveLobby.onclick = () => {
    window.location.href = 'index.html';
  };
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

// Start Lobby process
initLobby();
