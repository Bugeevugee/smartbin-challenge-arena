/**
 * SmartBin Challenge Arena - Core Game Logic
 * Handled via modern vanilla ES6 Modules
 */

import { submitScore, getActiveLeaderboard } from './multiplayer.js';

// URL Param Parsing
const urlParams = new URLSearchParams(window.location.search);
const gameMode = urlParams.get('mode') || 'single'; // 'single' (local) or 'multi' (leaderboard submission)
const playerNickname = urlParams.get('nickname') || 'EcoPlayer';
const viewLeaderboardOnly = urlParams.get('viewLeaderboard') === 'true';

// DOM elements
const scoreDisplay = document.getElementById('scoreDisplay');
const timerBar = document.getElementById('timerBar');
const timerText = document.getElementById('timerText');
const streakDisplay = document.getElementById('streakDisplay');
const playArena = document.getElementById('playArena');
const modeIndicator = document.getElementById('modeIndicator');
const alertOverlay = document.getElementById('alertOverlay');
const alertText = document.getElementById('alertText');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const quitBtn = document.getElementById('quitBtn');

// End screen modal elements
const endGameModal = document.getElementById('endGameModal');
const endModalTitle = document.getElementById('endModalTitle');
const endScore = document.getElementById('endScore');
const endStreak = document.getElementById('endStreak');
const endCO2 = document.getElementById('endCO2');
const endRankBox = document.getElementById('endRankBox');
const endRank = document.getElementById('endRank');
const leaderboardList = document.getElementById('leaderboardList');
const btnPlayAgain = document.getElementById('btnPlayAgain');
const btnExitToMenu = document.getElementById('btnExitToMenu');
const sessionCodeBadge = document.getElementById('sessionCodeBadge');

// Audio Context (Web Audio API)
let audioCtx = null;
let soundEnabled = true;

// Core State Variables
let score = 0;
let timeRemaining = 60; // 60 seconds
let currentStreak = 0;
let maxStreak = 0;
let isPlaying = false;
let hasSubmittedScore = false;
let fallingItems = [];
let gameLoopInterval = null;
let spawnTimeout = null;

// Difficulty stages settings
let currentStage = 1;
let spawnRate = 2000;      // ms between spawns
let baseSpeedMultiplier = 1.0;
let frenzyModeActive = false;

// Waste Items Configuration (Categories & highly detailed multi-colored SVGs)
const WASTE_ITEMS_POOL = [
  // Plastic Bin (Plastic packaging, caps, bottles)
  {
    name: 'Water Bottle',
    category: 'plastic',
    svg: `<svg viewBox="0 0 100 100">
      <path d="M42,20 L58,20 L58,28 L42,28 Z" fill="#0077b6" />
      <path d="M44,28 L56,28 L56,36 L44,36 Z" fill="#e0f7fa" opacity="0.8" />
      <path d="M36,36 L64,36 C67,36 68,39 68,42 L64,88 C64,91 61,92 58,92 L42,92 C39,92 36,91 36,88 L32,42 C32,39 33,36 36,36 Z" fill="url(#plasticGrad)" />
      <!-- Ribs on bottle -->
      <path d="M34,48 L66,48" stroke="#00b4d8" stroke-width="2.5" opacity="0.6" stroke-linecap="round" />
      <path d="M34,58 L66,58" stroke="#00b4d8" stroke-width="2.5" opacity="0.6" stroke-linecap="round" />
      <path d="M34,68 L66,68" stroke="#00b4d8" stroke-width="2.5" opacity="0.6" stroke-linecap="round" />
      <path d="M35,78 L65,78" stroke="#00b4d8" stroke-width="2.5" opacity="0.6" stroke-linecap="round" />
      <!-- Glare highlight -->
      <path d="M38,40 L35,84" stroke="#ffffff" stroke-width="3" opacity="0.5" stroke-linecap="round" />
      <defs>
        <linearGradient id="plasticGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#90e0ef" stop-opacity="0.9" />
          <stop offset="50%" stop-color="#caf0f8" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#00b4d8" stop-opacity="0.9" />
        </linearGradient>
      </defs>
    </svg>`
  },
  {
    name: 'Shopping Bag',
    category: 'plastic',
    svg: `<svg viewBox="0 0 100 100">
      <!-- Handles -->
      <path d="M36,36 C36,18 44,18 44,36" stroke="#00e5ff" stroke-width="5" fill="none" stroke-linecap="round" />
      <path d="M56,36 C56,18 64,18 64,36" stroke="#00e5ff" stroke-width="5" fill="none" stroke-linecap="round" />
      <!-- Bag Body -->
      <path d="M28,36 L72,36 C76,36 78,39 77,43 L70,88 C69,91 66,93 62,93 L38,93 C34,93 31,91 30,88 L23,43 C22,39 24,36 28,36 Z" fill="url(#bagGrad)" />
      <!-- Wrinkles/Creases -->
      <path d="M30,45 L42,55 M70,45 L58,55 M35,82 L45,72" stroke="#00b4d8" stroke-width="1.5" opacity="0.4" stroke-linecap="round" />
      <!-- Logo green recycle loop inside bag -->
      <path d="M46,65 L54,65 L50,57 Z" fill="#2ecc71" opacity="0.75" />
      <circle cx="50" cy="63" r="8" stroke="#2ecc71" stroke-width="2" fill="none" opacity="0.75" />
      <defs>
        <linearGradient id="bagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e0f7fa" />
          <stop offset="70%" stop-color="#b2ebf2" />
          <stop offset="100%" stop-color="#80deea" />
        </linearGradient>
      </defs>
    </svg>`
  },
  {
    name: 'Dispenser Bottle',
    category: 'plastic',
    svg: `<svg viewBox="0 0 100 100">
      <!-- Pump Head -->
      <path d="M42,20 L58,20 L58,26 L42,26 Z" fill="#eceff1" />
      <path d="M50,14 L50,20" stroke="#cfd8dc" stroke-width="6" stroke-linecap="round" />
      <path d="M50,14 L36,18 C33,19 33,14 36,13 L52,11 Z" fill="#cfd8dc" />
      <!-- Neck -->
      <path d="M46,26 L54,26 L54,34 L46,34 Z" fill="#b0bec5" />
      <!-- Body -->
      <path d="M30,34 L70,34 C74,34 76,38 76,42 L76,82 C76,88 72,92 66,92 L34,92 C28,92 24,88 24,82 L24,42 C24,38 26,34 30,34 Z" fill="url(#dispGrad)" />
      <!-- Label -->
      <rect x="34" y="48" width="32" height="28" rx="3" fill="#ffffff" opacity="0.85" />
      <rect x="38" y="54" width="24" height="4" fill="#00e5ff" />
      <rect x="38" y="62" width="16" height="3" fill="#37474f" />
      <rect x="38" y="68" width="20" height="3" fill="#37474f" />
      <defs>
        <linearGradient id="dispGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#00acc1" />
          <stop offset="50%" stop-color="#00e5ff" />
          <stop offset="100%" stop-color="#00838f" />
        </linearGradient>
      </defs>
    </svg>`
  },
  
  // Paper Bin (Cardboard, Newspaper, Cups)
  {
    name: 'Cardboard Box',
    category: 'paper',
    svg: `<svg viewBox="0 0 100 100">
      <!-- Main Box Cube base shadow -->
      <path d="M20,42 L50,56 L80,42 L80,78 L50,92 L20,78 Z" fill="#a78bfa" opacity="0.1" />
      <!-- Side A -->
      <path d="M20,42 L50,56 L50,90 L20,76 Z" fill="#b58463" />
      <!-- Side B -->
      <path d="M50,56 L80,42 L80,76 L50,90 Z" fill="#9c6644" />
      <!-- Flap Left Open -->
      <path d="M20,42 L50,56 L42,32 L12,18 Z" fill="#c69f82" />
      <!-- Flap Right Open -->
      <path d="M50,56 L80,42 L88,18 L58,32 Z" fill="#7f5539" />
      <!-- Opened Dark Interior cavity -->
      <path d="M20,42 L50,56 L80,42 L50,30 Z" fill="#4a3121" />
      <!-- Tape Detail -->
      <path d="M35,49 L43,26" stroke="#ffe082" stroke-width="4" opacity="0.8" />
      <!-- Fragile Label -->
      <rect x="56" y="58" width="16" height="12" rx="1" fill="#ffffff" opacity="0.8" transform="skewY(10)" />
      <rect x="60" y="62" width="8" height="2" fill="#c62828" transform="skewY(10)" />
      <rect x="60" y="66" width="6" height="1.5" fill="#37474f" transform="skewY(10)" />
    </svg>`
  },
  {
    name: 'Newspaper',
    category: 'paper',
    svg: `<svg viewBox="0 0 100 100">
      <!-- Folded Pages background shadow -->
      <path d="M26,26 L76,16 L84,80 L34,90 Z" fill="#e0e0e0" />
      <path d="M22,29 L72,19 L80,83 L30,93 Z" fill="#eceff1" stroke="#cfd8dc" stroke-width="1" />
      <!-- Main front page -->
      <path d="M18,32 L68,22 L76,86 L26,96 Z" fill="#ffffff" stroke="#b0bec5" stroke-width="1.5" />
      <!-- Headline banner -->
      <path d="M22,36 L64,28" stroke="#1b5e20" stroke-width="6" stroke-linecap="square" opacity="0.85" />
      <!-- Text columns lines -->
      <path d="M22,46 L44,42 M22,51 L44,47 M22,56 L44,52 M22,61 L44,57 M22,66 L44,62 M22,71 L44,67 M22,76 L44,72 M22,81 L44,77" stroke="#37474f" stroke-width="2" stroke-linecap="round" />
      <path d="M48,41 L68,37 M48,46 L68,42 M48,51 L68,47 M48,56 L68,52 M48,61 L68,57 M48,66 L68,62 M48,71 L68,67 M48,76 L68,73" stroke="#37474f" stroke-width="2" stroke-linecap="round" />
      <!-- Image box mockup -->
      <rect x="22" y="80" width="22" height="12" fill="#81c784" stroke="#b0bec5" stroke-width="1" />
    </svg>`
  },
  {
    name: 'Coffee Cup',
    category: 'paper',
    svg: `<svg viewBox="0 0 100 100">
      <!-- White Plastic Lid -->
      <path d="M28,26 L72,26 L74,18 C74,16 71,16 68,16 L32,16 C29,16 26,16 26,18 Z" fill="#eceff1" stroke="#b0bec5" stroke-width="1" />
      <rect x="46" y="12" width="8" height="4" fill="#cfd8dc" rx="1" />
      <!-- Cup Body -->
      <path d="M30,26 L70,26 L62,88 C62,91 60,92 57,92 L43,92 C40,92 38,91 38,88 Z" fill="url(#cupGrad)" />
      <!-- Kraft Paper Sleeve -->
      <path d="M32,44 L68,44 L65,68 L35,68 Z" fill="#b58463" stroke="#9c6644" stroke-width="1" />
      <!-- Eco green leaf emblem on sleeve -->
      <path d="M50,50 C44,50 44,58 50,62 C56,58 56,50 50,50 Z" fill="#4caf50" />
      <path d="M48,52 L52,58" stroke="#ffffff" stroke-width="1" stroke-linecap="round" />
      <defs>
        <linearGradient id="cupGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#efebe9" />
          <stop offset="50%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#d7ccc8" />
        </linearGradient>
      </defs>
    </svg>`
  },

  // Glass Bin (Colored/clear glass products)
  {
    name: 'Wine Bottle',
    category: 'glass',
    svg: `<svg viewBox="0 0 100 100">
      <!-- Foil Cap -->
      <path d="M45,12 L55,12 L54,26 L46,26 Z" fill="#c0c0c0" />
      <path d="M44,26 L56,26 L56,28 L44,28 Z" fill="#708090" />
      <!-- Long Neck -->
      <path d="M46,28 L54,28 L53,46 L47,46 Z" fill="url(#glassGrad)" />
      <!-- Body shoulders -->
      <path d="M47,46 C41,50 34,54 34,62 L34,88 C34,91 36,92 40,92 L60,92 C64,92 66,91 66,88 L66,62 C66,54 59,50 53,46 Z" fill="url(#glassGrad)" />
      <!-- Label -->
      <rect x="38" y="64" width="24" height="20" rx="1.5" fill="#fdfefe" opacity="0.9" />
      <path d="M44,70 L56,70 M44,74 L52,74" stroke="#8d6e63" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="50" cy="80" r="2.5" fill="#d32f2f" />
      <!-- White shine highlight reflection -->
      <path d="M37,64 L37,84" stroke="#ffffff" stroke-width="2.5" opacity="0.45" stroke-linecap="round" />
      <defs>
        <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#2e7d32" />
          <stop offset="40%" stop-color="#a1c181" stop-opacity="0.75" />
          <stop offset="100%" stop-color="#1b5e20" />
        </linearGradient>
      </defs>
    </svg>`
  },
  {
    name: 'Jam Jar',
    category: 'glass',
    svg: `<svg viewBox="0 0 100 100">
      <!-- Checked Pattern Metal Lid -->
      <path d="M32,16 L68,16 L66,26 L34,26 Z" fill="#d32f2f" />
      <path d="M32,16 L38,26 M42,16 L48,26 M52,16 L58,26 M62,16 L68,26" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
      <rect x="30" y="24" width="40" height="4" fill="#c2185b" rx="1" />
      <!-- Jar Body -->
      <path d="M26,30 L74,30 C77,30 78,33 78,36 L75,86 C75,90 71,92 66,92 L34,92 C29,92 25,90 25,86 L22,36 C22,33 23,30 26,30 Z" fill="url(#jarGrad)" />
      <!-- Jam Content Inside -->
      <path d="M28,38 L72,38 L70,86 L30,86 Z" fill="#ad1457" opacity="0.8" />
      <!-- Label -->
      <rect x="34" y="48" width="32" height="24" rx="2" fill="#fff9c4" opacity="0.9" stroke="#fbc02d" stroke-width="1" />
      <!-- Strawberry icon on label -->
      <path d="M50,56 C47,56 46,60 50,64 C54,60 53,56 50,56 Z" fill="#e53935" />
      <path d="M48,55 L52,55" stroke="#4caf50" stroke-width="1.5" stroke-linecap="round" />
      <!-- Glare highlight -->
      <path d="M28,34 L28,82" stroke="#ffffff" stroke-width="3.5" opacity="0.5" stroke-linecap="round" />
      <defs>
        <linearGradient id="jarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#b3e5fc" stop-opacity="0.85" />
          <stop offset="50%" stop-color="#e1f5fe" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#81d4fa" stop-opacity="0.85" />
        </linearGradient>
      </defs>
    </svg>`
  },
  {
    name: 'Broken Vase',
    category: 'glass',
    svg: `<svg viewBox="0 0 100 100">
      <!-- Glass Shards scattered group -->
      <!-- Shard 1 -->
      <polygon points="20,72 44,48 56,76 34,90" fill="#00b4d8" opacity="0.75" stroke="#90e0ef" stroke-width="1.5" />
      <!-- Shard 2 -->
      <polygon points="48,22 74,36 62,60 38,48" fill="#48cae4" opacity="0.7" stroke="#ade8f4" stroke-width="1.5" />
      <!-- Shard 3 -->
      <polygon points="54,68 84,54 78,84 60,78" fill="#0077b6" opacity="0.8" stroke="#0096c7" stroke-width="1.5" />
      <!-- Shard 4 (tiny) -->
      <polygon points="28,26 38,18 42,32 30,36" fill="#03045e" opacity="0.65" stroke="#023e8a" stroke-width="1" />
      <!-- Glare lines on shards -->
      <line x1="26" y1="68" x2="48" y2="82" stroke="#ffffff" stroke-width="2.5" opacity="0.5" stroke-linecap="round" />
      <line x1="52" y1="30" x2="68" y2="52" stroke="#ffffff" stroke-width="2.5" opacity="0.5" stroke-linecap="round" />
    </svg>`
  },

  // Organic Bin (Food scrap, bio compostable)
  {
    name: 'Banana Peel',
    category: 'organic',
    svg: `<svg viewBox="0 0 100 100">
      <!-- Banana stalk cap (brown) -->
      <path d="M48,16 C48,12 52,12 52,16 L53,24 L47,24 Z" fill="#5c4033" />
      <!-- Peel Segment 1 (Front Drooping) -->
      <path d="M50,24 C56,38 78,54 82,72 C74,70 60,56 50,42" fill="#ffb300" stroke="#f57f17" stroke-width="1" />
      <path d="M48,24 C48,24 50,42 50,42 C44,52 32,70 18,72 C22,54 44,38 48,24" fill="#ffca28" stroke="#f57f17" stroke-width="1" />
      <!-- Center Peel Segment (Drooping middle) -->
      <path d="M48,24 C50,38 50,56 52,88 C46,80 46,50 48,24" fill="#ffe082" stroke="#f57f17" stroke-width="1" />
      <!-- Soft interior white pulp details -->
      <path d="M47,28 C47,38 45,46 43,56" fill="none" stroke="#fff9c4" stroke-width="3" stroke-linecap="round" opacity="0.7" />
      <!-- Brown spots / bruises -->
      <circle cx="72" cy="62" r="2.5" fill="#5c4033" opacity="0.8" />
      <circle cx="32" cy="56" r="2" fill="#5c4033" opacity="0.8" />
      <circle cx="50" cy="74" r="3" fill="#5c4033" opacity="0.8" />
      <path d="M80,71 C81,72 82,73 82,72" stroke="#5c4033" stroke-width="2" stroke-linecap="round" />
    </svg>`
  },
  {
    name: 'Apple Core',
    category: 'organic',
    svg: `<svg viewBox="0 0 100 100">
      <!-- Stem -->
      <path d="M50,18 C51,12 56,10 58,11" stroke="#5d4037" stroke-width="3.5" fill="none" stroke-linecap="round" />
      <!-- Green Leaf on stem -->
      <path d="M54,14 C56,12 62,11 64,13 C64,15 60,19 56,18 Z" fill="#4caf50" stroke="#2e7d32" stroke-width="0.8" />
      <!-- Red Apple Top Peel -->
      <path d="M28,34 C30,22 42,22 50,26 C58,22 70,22 72,34 L72,39 L28,39 Z" fill="#ef5350" stroke="#c62828" stroke-width="1" />
      <path d="M35,30 C38,27 41,26 44,26" fill="none" stroke="#ff8a80" stroke-width="2" stroke-linecap="round" />
      <!-- Red Apple Bottom Peel -->
      <path d="M28,76 L72,76 L72,81 C70,92 58,92 50,88 C42,92 30,92 28,81 Z" fill="#ef5350" stroke="#c62828" stroke-width="1" />
      <!-- White Core Flesh center column -->
      <path d="M34,39 C38,46 38,68 34,76 L66,76 C62,68 62,46 66,39 Z" fill="#fffde7" stroke="#fff9c4" stroke-width="1" />
      <!-- Seeds in center -->
      <path d="M46,54 C45,52 43,54 44,57 C45,59 47,58 46,54 Z" fill="#3e2723" />
      <path d="M54,58 C55,56 57,58 56,61 C55,63 53,62 54,58 Z" fill="#3e2723" />
      <!-- Oxidation brown discoloration -->
      <path d="M38,44 L62,44 M37,71 L63,71" stroke="#d7ccc8" stroke-width="2.5" opacity="0.6" stroke-linecap="round" />
    </svg>`
  },
  {
    name: 'Eggshell',
    category: 'organic',
    svg: `<svg viewBox="0 0 100 100">
      <!-- Shard 1 (Top half cracked) -->
      <path d="M24,42 C24,24 38,18 50,18 C62,18 76,24 76,42 L66,54 L56,44 L44,54 L34,44 Z" fill="#f5ebe0" stroke="#e3d5ca" stroke-width="1.5" />
      <!-- Shard 1 inside shadow -->
      <path d="M66,54 L56,44 L44,54 L34,44 L26,45 C28,40 38,24 50,24 C62,24 72,40 74,45 Z" fill="#e3d5ca" opacity="0.6" />
      
      <!-- Shard 2 (Bottom half cracked) -->
      <path d="M26,56 L36,66 L46,56 L58,68 L68,56 L74,62 C74,78 62,88 50,88 C38,88 26,78 26,62 Z" fill="#f5ebe0" stroke="#e3d5ca" stroke-width="1.5" />
      <!-- Shard 2 inside shadow -->
      <path d="M36,66 L46,56 L58,68 L68,56 L72,58 C68,72 60,82 50,82 C40,82 32,72 28,58 Z" fill="#e3d5ca" opacity="0.6" />
    </svg>`
  }
];


// Web Audio API Sound Synthesizer
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  if (!soundEnabled) return;
  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'correct') {
    // Satisfying ascending chime
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'incorrect') {
    // Low buzzer
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.3);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'combo') {
    // Higher pitch fanfare chime
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880.00, now + 0.08); // A5
    osc.frequency.setValueAtTime(1174.66, now + 0.16); // D6
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (type === 'tick') {
    // Short sharp clock tick
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'warning') {
    // Alarm pulse sound
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(450, now + 0.1);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  }
}

// Set up UI values and check URL triggers
function initGame() {
  // Update game mode HUD elements
  if (gameMode === 'multi') {
    modeIndicator.innerText = `🏆 Competition Arena: ${playerNickname}`;
    modeIndicator.style.background = 'rgba(0, 229, 255, 0.12)';
    modeIndicator.style.borderColor = 'rgba(0, 229, 255, 0.4)';
    modeIndicator.style.color = '#00e5ff';
    sessionCodeBadge.innerText = 'Active competition';
  } else {
    modeIndicator.innerText = `🌱 local practice mode`;
    sessionCodeBadge.innerText = 'practice round';
  }

  // Pre-load audio hook on user interaction
  document.addEventListener('touchstart', initAudio, { once: true });
  document.addEventListener('click', initAudio, { once: true });

  // Handle immediate leaderboard trigger
  if (viewLeaderboardOnly) {
    showEndGameModal();
    return;
  }

  // Kick off gameplay
  startGame();
}

function startGame() {
  score = 0;
  timeRemaining = 60;
  currentStreak = 0;
  maxStreak = 0;
  isPlaying = true;
  hasSubmittedScore = false;
  currentStage = 1;
  spawnRate = 2000;
  baseSpeedMultiplier = 1.0;
  frenzyModeActive = false;

  scoreDisplay.innerText = score;
  streakDisplay.innerText = currentStreak;
  timerText.innerText = timeRemaining;
  timerBar.style.width = '100%';
  timerBar.className = 'timer-bar-fill';

  // Clean play space
  const items = playArena.querySelectorAll('.falling-item');
  items.forEach(el => el.remove());
  fallingItems = [];

  // Start tick counter loop
  gameLoopInterval = setInterval(gameTick, 1000);

  // Trigger first spawn
  triggerSpawnSchedule();

  // Highlight message
  displayAlert('GET READY...', 2000);
}

// 20-second interval difficulty adjustments
function adjustDifficulty() {
  const elapsed = 60 - timeRemaining;

  if (elapsed >= 50 && !frenzyModeActive) {
    // 50-60s: Frenzy Mode!
    frenzyModeActive = true;
    currentStage = 4;
    spawnRate = 600; // Super fast spawn
    baseSpeedMultiplier = 2.4; // Very fast fall
    timerBar.className = 'timer-bar-fill critical';
    playArena.classList.add('frenzy-glow');
    displayAlert('🚨 FRENZY MODE: 2x POINTS! 🚨', 3000, true);
  } else if (elapsed >= 40 && elapsed < 50 && currentStage < 3) {
    // 40-50s: Stage 3 (Intense)
    currentStage = 3;
    spawnRate = 900;
    baseSpeedMultiplier = 1.8;
    timerBar.className = 'timer-bar-fill warning';
    displayAlert('⚠️ SPEEDING UP! ⚠️', 2000);
    playSound('warning');
  } else if (elapsed >= 20 && elapsed < 40 && currentStage < 2) {
    // 20-40s: Stage 2 (Medium)
    currentStage = 2;
    spawnRate = 1400;
    baseSpeedMultiplier = 1.4;
    displayAlert('🌱 LEVEL UP! 🌱', 2000);
    playSound('warning');
  }
}

function displayAlert(message, duration, isFrenzy = false) {
  alertText.innerText = message;
  alertOverlay.className = 'alert-overlay show' + (isFrenzy ? ' frenzy' : '');
  
  setTimeout(() => {
    alertOverlay.classList.remove('show');
  }, duration);
}

// Spawn triggers using setTimeout dynamically updated to match difficulty rates
function triggerSpawnSchedule() {
  if (!isPlaying) return;

  spawnWasteItem();
  
  // Re-schedule next spawn
  spawnTimeout = setTimeout(triggerSpawnSchedule, spawnRate);
}

function gameTick() {
  if (!isPlaying) return;

  timeRemaining--;
  timerText.innerText = timeRemaining;
  timerBar.style.width = `${(timeRemaining / 60) * 100}%`;

  adjustDifficulty();

  // Tick feedback for last 5 seconds
  if (timeRemaining <= 5 && timeRemaining > 0) {
    playSound('tick');
  }

  if (timeRemaining <= 0) {
    endGame();
  }
}

// Spawns a physical waste item element into the play area
function spawnWasteItem() {
  if (!isPlaying) return;

  // Retrieve random waste item structure
  const itemData = WASTE_ITEMS_POOL[Math.floor(Math.random() * WASTE_ITEMS_POOL.length)];
  
  // Create element wrapper
  const itemEl = document.createElement('div');
  itemEl.className = `falling-item ${itemData.category}-hint`;
  
  // Design: Add an inner icon container and a clear text label
  itemEl.innerHTML = `
    <div class="item-icon-wrapper">${itemData.svg}</div>
    <span class="item-name-tag">${itemData.name}</span>
  `;

  // Random horizontal positioning (staying inside boundary limits)
  const arenaWidth = playArena.clientWidth;
  const itemWidth = 80; // Increased from 65 for better touch target size
  const startX = Math.floor(Math.random() * (arenaWidth - itemWidth));
  const startY = -90; // Spawn completely off-screen top

  itemEl.style.left = `${startX}px`;
  itemEl.style.top = `${startY}px`;

  playArena.appendChild(itemEl);

  // Define physics components
  const itemState = {
    el: itemEl,
    category: itemData.category,
    name: itemData.name,
    x: startX,
    y: startY,
    width: itemWidth,
    height: itemWidth,
    fallSpeed: (2.0 + Math.random() * 1.2) * baseSpeedMultiplier, // Slightly slower base speed to compensate for read-time
    rotation: 0,
    rotSpeed: (Math.random() - 0.5) * 3, // Slightly less spin for readability
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    origLeft: 0,
    origTop: 0
  };

  fallingItems.push(itemState);

  // Hook touch & mouse listeners to item
  setupItemInteractions(itemState);
}

// Drag & Drop event bindings
function setupItemInteractions(item) {
  const el = item.el;

  // Mouse Down / Touch Start
  const dragStart = (e) => {
    if (!isPlaying) return;
    item.isDragging = true;
    el.style.zIndex = 1000;

    const pageX = e.type === 'touchstart' ? e.touches[0].pageX : e.pageX;
    const pageY = e.type === 'touchstart' ? e.touches[0].pageY : e.pageY;

    item.dragStartX = pageX;
    item.dragStartY = pageY;
    item.origLeft = parseFloat(el.style.left);
    item.origTop = parseFloat(el.style.top);

    el.style.transform = `scale(1.1) rotate(${item.rotation}deg)`;
    e.preventDefault();
  };

  // Mouse Move / Touch Move
  const dragMove = (e) => {
    if (!item.isDragging || !isPlaying) return;

    const pageX = e.type === 'touchmove' ? e.touches[0].pageX : e.pageX;
    const pageY = e.type === 'touchmove' ? e.touches[0].pageY : e.pageY;

    const deltaX = pageX - item.dragStartX;
    const deltaY = pageY - item.dragStartY;

    const newX = item.origLeft + deltaX;
    const newY = item.origTop + deltaY;

    // Boundary containment (prevent dragging out of screen sides)
    const maxLeft = playArena.clientWidth - item.width;
    item.x = Math.max(0, Math.min(maxLeft, newX));
    item.y = newY;

    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;

    // Visual hover state check on bins
    checkBinHighlights(item);
  };

  // Mouse Up / Touch End
  const dragEnd = (e) => {
    if (!item.isDragging) return;
    item.isDragging = false;
    el.style.zIndex = 100;
    el.style.transform = `scale(1.0) rotate(${item.rotation}deg)`;

    // Evaluate sorting result
    evaluateDrop(item);
  };

  el.addEventListener('mousedown', dragStart);
  el.addEventListener('touchstart', dragStart, { passive: false });

  window.addEventListener('mousemove', dragMove);
  window.addEventListener('touchmove', dragMove, { passive: false });

  window.addEventListener('mouseup', dragEnd);
  window.addEventListener('touchend', dragEnd);
}

// Highlight bin visual states if item matches categories during drag operations
function checkBinHighlights(item) {
  const bins = document.querySelectorAll('.bin');
  const itemRect = item.el.getBoundingClientRect();

  bins.forEach(binEl => {
    const binRect = binEl.getBoundingClientRect();
    const isIntersecting = !(
      itemRect.right < binRect.left ||
      itemRect.left > binRect.right ||
      itemRect.bottom < binRect.top ||
      itemRect.top > binRect.bottom
    );

    if (isIntersecting) {
      binEl.classList.add('drag-over');
    } else {
      binEl.classList.remove('drag-over');
    }
  });
}

// Process item sorting placements
function evaluateDrop(item) {
  const itemRect = item.el.getBoundingClientRect();
  const bins = document.querySelectorAll('.bin');
  let placedInBin = null;

  bins.forEach(binEl => {
    const binRect = binEl.getBoundingClientRect();
    const isIntersecting = !(
      itemRect.right < binRect.left ||
      itemRect.left > binRect.right ||
      itemRect.bottom < binRect.top ||
      itemRect.top > binRect.bottom
    );

    if (isIntersecting) {
      placedInBin = binEl.getAttribute('data-bin');
    }
    // Always clear classes
    binEl.classList.remove('drag-over');
  });

  if (placedInBin) {
    // Correct sort match check
    if (placedInBin === item.category) {
      handleCorrectSort(item);
    } else {
      handleIncorrectSort(item);
    }
    removeItem(item);
  } else {
    // If dropped in empty space, let it resume falling from current position
    // (Ensure drag offsets match relative elements)
    const arenaRect = playArena.getBoundingClientRect();
    item.y = itemRect.top - arenaRect.top;
  }
}

function handleCorrectSort(item) {
  // Base point values (double point values for final 10s Frenzy Stage)
  const basePoints = frenzyModeActive ? 20 : 10;
  score += basePoints;
  currentStreak++;

  if (currentStreak > maxStreak) {
    maxStreak = currentStreak;
  }

  scoreDisplay.innerText = score;
  streakDisplay.innerText = currentStreak;

  // Spawn visual score feedback tag
  spawnScoreFeedback(item.x, item.y, `+${basePoints}`, true);
  playSound('correct');

  // Trigger combo streak visual enhancements
  if (currentStreak > 0 && currentStreak % 5 === 0) {
    const bonus = currentStreak * 2;
    score += bonus;
    scoreDisplay.innerText = score;
    spawnScoreFeedback(item.x, item.y - 30, `STREAK COMBO +${bonus}!`, true);
    playSound('combo');
    triggerConfettiOnItem(item);
  }
}

function handleIncorrectSort(item) {
  // Deduct points
  const lossPoints = frenzyModeActive ? 10 : 5;
  score = Math.max(0, score - lossPoints); // Keep score non-negative
  currentStreak = 0;

  scoreDisplay.innerText = score;
  streakDisplay.innerText = currentStreak;

  // Shake play arena visually
  playArena.classList.add('shake');
  setTimeout(() => playArena.classList.remove('shake'), 350);

  // Dynamic wrong indicator tag
  spawnScoreFeedback(item.x, item.y, `-${lossPoints}`, false);
  playSound('incorrect');
}

function spawnScoreFeedback(x, y, text, isCorrect) {
  const pop = document.createElement('div');
  pop.className = `popup-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
  pop.innerText = text;
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;

  playArena.appendChild(pop);
  setTimeout(() => pop.remove(), 800);
}

function triggerConfettiOnItem(item) {
  // Create beautiful temporary glowing rings
  for (let i = 0; i < 8; i++) {
    const particle = document.createElement('div');
    particle.className = 'streak-particle';
    particle.style.cssText = `
      position: absolute;
      left: ${item.x + 30}px;
      top: ${item.y + 30}px;
      width: 8px;
      height: 8px;
      background: hsl(${Math.random() * 360}, 100%, 60%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 120;
      transition: transform 0.6s ease-out, opacity 0.6s;
    `;
    playArena.appendChild(particle);

    // Spread radial path
    const angle = (i / 8) * Math.PI * 2;
    const distance = 60 + Math.random() * 40;
    const destX = Math.cos(angle) * distance;
    const destY = Math.sin(angle) * distance;

    setTimeout(() => {
      particle.style.transform = `translate(${destX}px, ${destY}px) scale(0)`;
      particle.style.opacity = '0';
    }, 20);

    setTimeout(() => particle.remove(), 700);
  }
}

function removeItem(item) {
  if (item.el) {
    item.el.remove();
  }
  fallingItems = fallingItems.filter(i => i !== item);
}

// Primary Physics Animation Frame loop
function updatePhysics() {
  if (!isPlaying) return;

  const arenaHeight = playArena.clientHeight;

  for (let i = fallingItems.length - 1; i >= 0; i--) {
    const item = fallingItems[i];

    if (!item.isDragging) {
      // Apply gravity physics
      item.y += item.fallSpeed;
      item.rotation += item.rotSpeed;

      item.el.style.top = `${item.y}px`;
      item.el.style.transform = `rotate(${item.rotation}deg)`;

      // Boundary check: fell past bins un-sorted
      if (item.y > arenaHeight + 10) {
        // Break streak and delete
        if (currentStreak > 0) {
          currentStreak = 0;
          streakDisplay.innerText = currentStreak;
          playSound('incorrect');
        }
        removeItem(item);
      }
    }
  }

  requestAnimationFrame(updatePhysics);
}

// Kick off frame calculations
requestAnimationFrame(updatePhysics);

function endGame() {
  isPlaying = false;
  clearInterval(gameLoopInterval);
  clearTimeout(spawnTimeout);
  playArena.classList.remove('frenzy-glow');

  // Trigger ending calculation and leaderboard submissions
  processEndStates();
}

async function processEndStates() {
  showEndGameModal();

  endScore.innerText = score;
  endStreak.innerText = maxStreak;

  // CO2 Equivalence conversion formula (e.g. 0.05kg saved per item sorted, assuming 10pts per item)
  const sortedCount = Math.floor(score / 10);
  const co2Saved = (sortedCount * 0.045).toFixed(3);
  endCO2.innerText = `${co2Saved} kg`;

  // Handle Score submissions for Multiplayer Competition
  if (gameMode === 'multi') {
    endRankBox.style.display = 'flex';
    endRank.innerText = 'Submitting...';
    
    try {
      hasSubmittedScore = true;
      // Write score to Firestore
      const rankPosition = await submitScore(playerNickname, score);
      endRank.innerText = rankPosition ? `#${rankPosition}` : '#--';
    } catch (err) {
      console.error('Error submitting score to leaderboard:', err);
      endRank.innerText = 'Error';
    }
  } else {
    // Single player doesn't write to database
    endRankBox.style.display = 'none';
  }

  // Load standings preview
  loadLeaderboardPreview();
}

function showEndGameModal() {
  endGameModal.classList.remove('hidden');
}

function hideEndGameModal() {
  endGameModal.classList.add('hidden');
}

// Reads records from Firestore and builds list bindings
async function loadLeaderboardPreview() {
  leaderboardList.innerHTML = '<div class="leaderboard-loading">Loading standings...</div>';

  try {
    const list = await getActiveLeaderboard(20);
    leaderboardList.innerHTML = '';

    if (list.length === 0) {
      leaderboardList.innerHTML = '<div class="leaderboard-loading">No scores recorded yet.</div>';
      return;
    }

    list.forEach((entry, idx) => {
      const isMe = gameMode === 'multi' && entry.nickname === playerNickname && Math.abs(entry.score - score) < 5;
      
      const row = document.createElement('div');
      row.className = `leaderboard-row ${isMe ? 'current-player' : ''}`;
      
      row.innerHTML = `
        <span class="rank-num">${idx + 1}</span>
        <span class="player-name">${escapeHTML(entry.nickname)}</span>
        <span class="score-num">${entry.score} pts</span>
      `;
      leaderboardList.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading leaderboard standings preview:', err);
    leaderboardList.innerHTML = '<div class="leaderboard-loading">Failed to fetch standings.</div>';
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

// Sound Button triggers
soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggleBtn.innerText = soundEnabled ? '🔊 Sound On' : '🔇 Mute';
});

quitBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to quit this run? Current progress will be lost.')) {
    window.location.href = 'index.html';
  }
});

btnPlayAgain.addEventListener('click', () => {
  hideEndGameModal();
  // Clear parameters if viewer
  if (viewLeaderboardOnly) {
    window.location.href = `game.html?mode=${gameMode}&nickname=${encodeURIComponent(playerNickname)}`;
  } else {
    startGame();
  }
});

btnExitToMenu.addEventListener('click', () => {
  window.location.href = 'index.html';
});

// Run
initGame();
