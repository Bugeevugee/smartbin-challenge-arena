/**
 * SmartBin Challenge Arena - Multiplayer & Database Sync Controller
 * Syncs score tracking and session control states with Firebase Firestore or local fallbacks.
 */

import { db, isFirebaseFallback } from './firebase-config.js';

// Retrieve unique local device ID to identify entries without accounts
let deviceId = localStorage.getItem('eco_device_id');
if (!deviceId) {
  deviceId = 'dev_' + Math.random().toString(36).substring(2, 11);
  localStorage.setItem('eco_device_id', deviceId);
}

// Session parameters
const DEFAULT_SESSION = 'default_challenge_round';

/**
 * Get active session ID.
 * If Firebase is active, checks the 'config/activeSession' doc. Otherwise, local mock value.
 */
async function getActiveSessionDetails() {
  if (isFirebaseFallback || !db) {
    const localSession = localStorage.getItem('local_session_id') || DEFAULT_SESSION;
    const localSessionName = localStorage.getItem('local_session_name') || 'EcoLoop Local Arena';
    return { sessionId: localSession, sessionName: localSessionName };
  }

  try {
    const docRef = db.collection('config').doc('activeSession');
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      return {
        sessionId: data.sessionId || DEFAULT_SESSION,
        sessionName: data.sessionName || 'EcoLoop Challenge Arena'
      };
    } else {
      // Create default if missing
      const defaultState = { sessionId: DEFAULT_SESSION, sessionName: 'EcoLoop Challenge Arena' };
      await docRef.set(defaultState);
      return defaultState;
    }
  } catch (err) {
    console.error('Error fetching active session details:', err);
    return { sessionId: DEFAULT_SESSION, sessionName: 'EcoLoop Challenge Arena' };
  }
}

/**
 * Submit score to Firebase Firestore or Local Storage Fallback.
 * Returns the player's rank position.
 */
export async function submitScore(nickname, score) {
  const session = await getActiveSessionDetails();
  const scoreData = {
    nickname: nickname || 'EcoWarrior',
    score: parseInt(score) || 0,
    timestamp: firebase.firestore.FieldValue.serverTimestamp ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
    sessionId: session.sessionId,
    deviceId: deviceId
  };

  if (isFirebaseFallback || !db) {
    // Fallback: LocalStorage simulation
    return saveScoreLocalStorage(scoreData);
  }

  try {
    // Write score doc (unique per player per session to prevent duplicates)
    const docId = `${session.sessionId}_${deviceId}`;
    
    // Check if player has already submitted in this session, only update if new score is higher
    const docRef = db.collection('scores').doc(docId);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      const existingData = docSnap.data();
      if (scoreData.score > existingData.score) {
        await docRef.set(scoreData, { merge: true });
        console.log("Updated score to new high record:", scoreData.score);
      } else {
        console.log("Existing score was higher. Score not updated.");
        // Return existing rank
        return calculateRankPosition(session.sessionId, existingData.score);
      }
    } else {
      await docRef.set(scoreData);
      console.log("New score submitted:", scoreData.score);
    }

    // Return current placement index
    return calculateRankPosition(session.sessionId, scoreData.score);
  } catch (err) {
    console.error("Firebase score submission error:", err);
    return saveScoreLocalStorage(scoreData); // Fallback to local storage computation
  }
}

/**
 * Calculate player's current rank position in active session.
 */
async function calculateRankPosition(sessionId, playerScore) {
  try {
    const scoresSnap = await db.collection('scores')
      .where('sessionId', '==', sessionId)
      .get();
      
    const uniqueScores = [];
    const seenDevices = new Set();

    scoresSnap.forEach(doc => {
      const data = doc.data();
      if (!seenDevices.has(data.deviceId)) {
        seenDevices.add(data.deviceId);
        uniqueScores.push(data.score);
      }
    });

    // Sort descending
    uniqueScores.sort((a, b) => b - a);

    // Find ranking index
    const rank = uniqueScores.indexOf(playerScore) + 1;
    return rank || 1;
  } catch (e) {
    console.error("Error calculating rank position:", e);
    return 1;
  }
}

/**
 * Retrieve active leaderboard standings.
 */
export async function getActiveLeaderboard(limitVal = 20) {
  const session = await getActiveSessionDetails();

  if (isFirebaseFallback || !db) {
    return getLeaderboardLocalStorage(session.sessionId, limitVal);
  }

  try {
    const querySnap = await db.collection('scores')
      .where('sessionId', '==', session.sessionId)
      .get();

    const results = [];
    querySnap.forEach(doc => {
      results.push(doc.data());
    });

    // Sort in-memory to avoid needing composite indexes in Firebase
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Fallback to timestamp sorting if scores match
      const timeA = a.timestamp?.seconds || new Date(a.timestamp).getTime() || 0;
      const timeB = b.timestamp?.seconds || new Date(b.timestamp).getTime() || 0;
      return timeA - timeB;
    });

    return results.slice(0, limitVal);
  } catch (err) {
    console.error("Firestore getActiveLeaderboard error:", err);
    // Fall back to local
    return getLeaderboardLocalStorage(session.sessionId, limitVal);
  }
}

// Local Storage Fallback Handlers
function saveScoreLocalStorage(scoreData) {
  console.log("Saving score in Local Storage Mock database...");
  let allScores = JSON.parse(localStorage.getItem('local_db_scores')) || [];
  
  // Clean ISO timestamps for mock sorting
  if (typeof scoreData.timestamp !== 'string') {
    scoreData.timestamp = new Date().toISOString();
  }

  // Remove duplicate device entries in this session, keep highest
  const matchIndex = allScores.findIndex(
    s => s.sessionId === scoreData.sessionId && s.deviceId === scoreData.deviceId
  );

  if (matchIndex > -1) {
    if (scoreData.score > allScores[matchIndex].score) {
      allScores[matchIndex] = scoreData;
    }
  } else {
    allScores.push(scoreData);
  }

  localStorage.setItem('local_db_scores', JSON.stringify(allScores));

  // Compute rank position locally
  const sessionScores = allScores
    .filter(s => s.sessionId === scoreData.sessionId)
    .map(s => s.score)
    .sort((a, b) => b - a);
  
  return sessionScores.indexOf(scoreData.score) + 1;
}

function getLeaderboardLocalStorage(sessionId, limitVal) {
  const allScores = JSON.parse(localStorage.getItem('local_db_scores')) || [];
  
  return allScores
    .filter(s => s.sessionId === sessionId)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(a.timestamp) - new Date(b.timestamp); // Older timestamp ranks higher
    })
    .slice(0, limitVal);
}

// Export session helpers
export { getActiveSessionDetails, DEFAULT_SESSION };
