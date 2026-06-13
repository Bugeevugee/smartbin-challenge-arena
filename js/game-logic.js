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

// Waste Items Configuration (Categories & SVG representations)
const WASTE_ITEMS_POOL = [
  // Plastic Bin (Plastic, Metal packaging)
  {
    name: 'Plastic Water Bottle',
    category: 'plastic',
    svg: `<svg viewBox="0 0 24 24" fill="#00E5FF"><path d="M12,2A1.5,1.5 0 0,1 13.5,3.5V5H10.5V3.5A1.5,1.5 0 0,1 12,2M10,6H14V8H10V6M9,9H15A2,2 0 0,1 17,11V20A2,2 0 0,1 15,22H9A2,2 0 0,1 7,20V11A2,2 0 0,1 9,9M9,11V20H15V11H9Z"/></svg>`
  },
  {
    name: 'Plastic Shopping Bag',
    category: 'plastic',
    svg: `<svg viewBox="0 0 24 24" fill="#00E5FF"><path d="M16,7H8V5H16V7M18,3H15V1H9V3H6A2,2 0 0,0 4,5V21A2,2 0 0,0 6,23H18A2,2 0 0,0 20,21V5A2,2 0 0,0 18,3M18,21H6V9H18V21M8,11H16V13H8V11M8,15H13V17H8V15Z"/></svg>`
  },
  {
    name: 'Shampoo Container',
    category: 'plastic',
    svg: `<svg viewBox="0 0 24 24" fill="#00E5FF"><path d="M12,3A1.5,1.5 0 0,1 13.5,4.5V6H10.5V4.5A1.5,1.5 0 0,1 12,3M10,7H14A2,2 0 0,1 16,9V21A2,2 0 0,1 14,23H10A2,2 0 0,1 8,21V9A2,2 0 0,1 10,7Z"/></svg>`
  },
  
  // Paper Bin (Cardboard, Newspaper, Bags)
  {
    name: 'Cardboard Box',
    category: 'paper',
    svg: `<svg viewBox="0 0 24 24" fill="#2ECC71"><path d="M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V4A2,2 0 0,1 4,2M4,4V20H20V4H4M6,6H18V10H6V6M8,12H16V14H8V12M8,16H13V18H8V16Z"/></svg>`
  },
  {
    name: 'Newspaper',
    category: 'paper',
    svg: `<svg viewBox="0 0 24 24" fill="#2ECC71"><path d="M20,11H4V13H20V11M20,15H4V17H20V15M4,7H20V9H4V7M20,3H4A2,2 0 0,0 2,5V19A2,2 0 0,0 4,21H20A2,2 0 0,0 22,19V5A2,2 0 0,0 20,3Z"/></svg>`
  },
  {
    name: 'Paper Cup',
    category: 'paper',
    svg: `<svg viewBox="0 0 24 24" fill="#2ECC71"><path d="M4,2H20L18.5,19A2,2 0 0,1 16.5,21H7.5A2,2 0 0,1 5.5,19L4,2M6.2,4L7.5,19H16.5L17.8,4H6.2Z"/></svg>`
  },

  // Glass Bin (Bottles, Jars)
  {
    name: 'Wine Glass Bottle',
    category: 'glass',
    svg: `<svg viewBox="0 0 24 24" fill="#3498DB"><path d="M12,2A2,2 0 0,0 10,4V10H9A1,1 0 0,0 8,11V21A2,2 0 0,0 10,23H14A2,2 0 0,0 16,21V11A1,1 0 0,0 15,10H14V4A2,2 0 0,0 12,2M10,12H14V21H10V12Z"/></svg>`
  },
  {
    name: 'Glass Jam Jar',
    category: 'glass',
    svg: `<svg viewBox="0 0 24 24" fill="#3498DB"><path d="M16,2H8V5H16V2M6,6V20A2,2 0 0,0 8,22H16A2,2 0 0,0 18,20V6H6M10,10H14V14H10V10Z"/></svg>`
  },
  {
    name: 'Broken Glass Vase',
    category: 'glass',
    svg: `<svg viewBox="0 0 24 24" fill="#3498DB"><path d="M12,3L8,7V9L9,11V15L7,17V21H17V17L15,15V11L16,9V7L12,3M10,8.8L12,6.8L14,8.8V10H10V8.8Z"/></svg>`
  },

  // Organic Bin (Food Waste, Bio material)
  {
    name: 'Banana Peel',
    category: 'organic',
    svg: `<svg viewBox="0 0 24 24" fill="#E67E22"><path d="M12,2C10.5,4.5 8.5,6.5 6,7.5C7.5,10.5 8,13.5 8,16.5C5.5,16 3,14.5 1,12C3,15 4,18 4,21C6.5,20 8.5,18 10,15.5C11.5,18.5 13.5,20.5 16,21.5C14.5,18.5 14,15.5 14,12.5C16.5,13 19,14.5 21,17C19,14 18,11 18,8C15.5,9 13.5,11 12,13.5C10.5,11.5 10,8.5 10,5.5C11.5,6 14,7.5 16,10C14.5,7.5 13.5,4.5 12,2Z"/></svg>`
  },
  {
    name: 'Apple Core',
    category: 'organic',
    svg: `<svg viewBox="0 0 24 24" fill="#E67E22"><path d="M12,2A3,3 0 0,0 9,5C9,5.5 9.1,6 9.3,6.5C8,8 7,10 7,12C7,14 8,16 9.3,17.5C9.1,18 9,18.5 9,19A3,3 0 0,0 12,22A3,3 0 0,0 15,19C15,18.5 14.9,18 14.7,17.5C16,16 17,14 17,12C17,10 16,8 14.7,6.5C14.9,6 15,5.5 15,5A3,3 0 0,0 12,2M12,4A1,1 0 0,1 13,5C13,5.5 12.8,6 12.5,6.3C12,6.7 12,7.3 12,8V16C12,16.7 12,17.3 12.5,17.7C12.8,18 13,18.5 13,19A1,1 0 0,1 12,20A1,1 0 0,1 11,19C11,18.5 11.2,18 11.5,17.7C12,17.3 12,16.7 12,16V8C12,7.3 12,6.7 11.5,6.3C11.2,6 11,5.5 11,5A1,1 0 0,1 12,4Z"/></svg>`
  },
  {
    name: 'Eggshell',
    category: 'organic',
    svg: `<svg viewBox="0 0 24 24" fill="#E67E22"><path d="M12,2A8,8 0 0,0 4,10C4,14.4 7.6,18 12,18A8,8 0 0,0 20,10A8,8 0 0,0 12,2M12,4C14.2,4 16.2,5.2 17.2,7L15,10L12,8L9,11L6.8,8C7.8,5.2 9.8,4 12,4M6,10L9,12.5L12,10L15,13L18,10.5C17.9,12.8 16.5,14.8 14.5,15.6L12,14L9.5,15.6C7.5,14.8 6.1,12.8 6,10Z"/></svg>`
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
  itemEl.innerHTML = itemData.svg;

  // Random horizontal positioning (staying inside boundary limits)
  const arenaWidth = playArena.clientWidth;
  const itemWidth = 65;
  const startX = Math.floor(Math.random() * (arenaWidth - itemWidth));
  const startY = -80; // Spawn completely off-screen top

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
    fallSpeed: (2.5 + Math.random() * 1.5) * baseSpeedMultiplier,
    rotation: 0,
    rotSpeed: (Math.random() - 0.5) * 4,
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
