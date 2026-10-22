const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = s => encodeURIComponent(s).replace(/'/g, '%27');
function localDateStr(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { alert('⚠️ Salvataggio non riuscito (spazio pieno?). Fai un backup.'); } }
function splitCSVLine(l, d) {
  const o = []; let c = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (ch === '"') { if (q && l[i + 1] === '"') { c += '"'; i++; } else q = !q; }
    else if (ch === d && !q) { o.push(c.trim()); c = ''; }
    else c += ch;
  }
  o.push(c.trim()); return o;
}
let sessionDateOverride = null;
let freeCategory = 'calisthenics'; // lavagna libera: 'calisthenics' | 'pesi'
function freeKey() { return freeCategory === 'pesi' ? 'free_pesi' : 'calisthenics'; }
function freeLabel() { return freeCategory === 'pesi' ? 'Sala Pesi (Libero)' : 'Calisthenics'; }
function freeStorageKey() { return freeCategory === 'pesi' ? 'gym_free_pesi' : 'gym_cali_exercises'; }
function saveFreeBoard() { safeSet(freeStorageKey(), JSON.stringify(caliExercises)); }
function setFreeCategory(cat) {
  freeCategory = cat;
  try { caliExercises = JSON.parse(localStorage.getItem(freeStorageKey()) || '[]'); } catch (e) { caliExercises = []; }
  const inp = document.getElementById('newCaliExerciseInput');
  if (inp) inp.placeholder = cat === 'pesi' ? 'Es. Panca piana, Squat, Lat machine...' : 'Es. Trazioni zavorrate, Dip, L-Sit, Muscle-Up...';
  const b = document.querySelector('#sectionCalisthenics .actions-bar .btn-primary');
  if (b) b.textContent = cat === 'pesi' ? '🏁 Salva Seduta Sala Pesi' : '🏁 Salva Seduta Calisthenics';
}

// ==================== CONFIGURAZIONE E STATO ====================

// Schede di default (se l'utente non ne ha ancora create)
const INITIAL_WORKOUTS = {
  scheda_a: {
    id: 'scheda_a',
    name: 'Scheda A',
    exercises: [
      { id: 'a1', name: 'Affondi Bulgari', sets: 3, targetReps: '8 a lato', rest: 90 },
      { id: 'a2', name: 'Distenzioni Man 30°', sets: 3, targetReps: '6/8', rest: 90 },
      { id: 'a3', name: 'Squat Machine', sets: 3, targetReps: '8/10', rest: 90 },
      { id: 'a4', name: 'Pectoral Fly', sets: 3, targetReps: '10/12', rest: 90 },
      { id: 'a5', name: 'Leg extention', sets: 3, targetReps: '8', rest: 90 },
      { id: 'a6', name: 'Alzate laterali cavo basso', sets: 3, targetReps: '10/12 a lato', rest: 90 },
      { id: 'a7', name: 'French press vulkan cavo alto', sets: 3, targetReps: '10/12', rest: 90 },
      { id: 'a8', name: 'Bayesian curl cavo basso', sets: 3, targetReps: '10/12 a lato', rest: 90 }
    ]
  },
  scheda_b: {
    id: 'scheda_b',
    name: 'Scheda B',
    exercises: [
      { id: 'b1', name: 'Stacco hex bar', sets: 4, targetReps: '5', rest: 90 },
      { id: 'b2', name: 'Lento avanti panca 75 man', sets: 3, targetReps: '6/8', rest: 90 },
      { id: 'b3', name: 'Leg Curl', sets: 3, targetReps: '10/12', rest: 90 },
      { id: 'b4', name: 'Lat machine power grip 3', sets: 3, targetReps: '8', rest: 90 },
      { id: 'b5', name: 'Adductor machine', sets: 3, targetReps: '10/12', rest: 90 },
      { id: 'b6', name: 'Distensioni su panca 60', sets: 3, targetReps: '8', rest: 90 },
      { id: 'b7', name: 'French press man panca + curl hammer', sets: 3, targetReps: '10+10', rest: 90 }
    ]
  }
};

let userWorkouts = {}; // Situazione pulita di default (schermata welcome)
let activeWorkoutId = ''; // Assegnato dopo l'import o la creazione

// Dati della sessione attiva (input non ancora finalizzati)
let activeSessionInputs = {}; // { workoutId: { setKey: { kg, reps, diff } } }
let activeWarmupState = {}; // { workoutId: boolean }

// Esercizi Calisthenics (lavagna libera gestita dall'utente)
let caliExercises = [];

// Storico completo allenamenti
let workoutHistory = [];

// Profilo corporeo
let bodyProfile = {
  gender: 'male',
  age: null,
  height: null,
  weights: [] // { id, date, weight, fatPct, leanPct, fatKg, leanKg, note }
};

// Timer di recupero serie
let restTimerInterval = null;
let restTimerSecondsLeft = 0;
let audioCtx = null;

// Timer Calisthenics Versatile (Conto alla rovescia, Cronometro, Intervalli)
let caliTimerInterval = null;
let caliTimerMode = 'countdown'; // 'countdown', 'stopwatch', 'intervals'
let caliTimerDurationMinutes = 5; // minimo 5 minuti
let caliTimerSeconds = 300; // 5 min default
let caliTimerCurrentRound = 1;
let caliTimerIsRunning = false;

// Calendario
let calCurrentDate = new Date();
let calSelectedDateStr = localDateStr();
let calLogSelectedDiff = 'easy';

// Excel import staging
let importedRawData = [];
let importedHeaders = [];

// ==================== INIZIALIZZAZIONE ====================
document.addEventListener('DOMContentLoaded', () => {
  loadAllStoredData();
  
  const dateInput = document.getElementById('newWeightDate');
  if (dateInput) dateInput.value = localDateStr();

  checkWelcomeScreen();
  renderSubtabs();
  renderActiveWorkoutView();
  renderCalisthenics();
  renderCalendar();
  renderAnalytics();
  renderBodyStats();
  
  if (activeWorkoutId) selectWorkoutSubtab(activeWorkoutId);
  switchMainTab('home');
  initNetworkStatus();
  registerServiceWorker();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
});

function checkWelcomeScreen() {
  const welcomeSec = document.getElementById('welcomeScreenSection');
  const standardSec = document.getElementById('standardWorkoutInterface');
  const hasWorkouts = Object.keys(userWorkouts).length > 0;

  if (!hasWorkouts && activeWorkoutId !== 'calisthenics' && activeWorkoutId !== 'free_pesi') {
    if (welcomeSec) welcomeSec.style.display = 'flex';
    if (standardSec) standardSec.style.display = 'none';
  } else {
    if (welcomeSec) welcomeSec.style.display = 'none';
    if (standardSec) standardSec.style.display = 'block';
  }
}

function resetToWelcomeState() {
  userWorkouts = {};
  localStorage.removeItem('gym_user_workouts');
  activeWorkoutId = '';
  localStorage.removeItem('gym_active_workout_id');
  renderSubtabs();
  checkWelcomeScreen();
  showToast('Schermata Welcome attiva! Puoi testare il caricamento da Excel.');
}

function loadDemoWorkouts() {
  userWorkouts = { ...INITIAL_WORKOUTS };
  safeSet('gym_user_workouts', JSON.stringify(userWorkouts));
  activeWorkoutId = 'scheda_a';
  safeSet('gym_active_workout_id', activeWorkoutId);
  checkWelcomeScreen();
  renderSubtabs();
  selectWorkoutSubtab('scheda_a');
  showToast('Schede demo caricate!');
}

function startWithCalisthenics() {
  activeWorkoutId = 'calisthenics';
  checkWelcomeScreen();
  renderSubtabs();
  selectWorkoutSubtab('calisthenics');
}

function loadAllStoredData() {
  const savedWorkouts = localStorage.getItem('gym_user_workouts');
  if (savedWorkouts) {
    try { userWorkouts = JSON.parse(savedWorkouts); } catch (e) { console.error(e); }
  } else {
    userWorkouts = {}; // Pulito di default se prima visita
  }

  const savedActiveId = localStorage.getItem('gym_active_workout_id');
  if (savedActiveId && (userWorkouts[savedActiveId] || savedActiveId === 'calisthenics' || savedActiveId === 'free_pesi')) {
    activeWorkoutId = savedActiveId;
  } else {
    activeWorkoutId = Object.keys(userWorkouts)[0] || '';
  }

  const savedSession = localStorage.getItem('gym_active_session_inputs');
  if (savedSession) {
    try { activeSessionInputs = JSON.parse(savedSession); } catch (e) { console.error(e); }
  }

  const savedWarmup = localStorage.getItem('gym_active_warmup');
  if (savedWarmup) {
    try { activeWarmupState = JSON.parse(savedWarmup); } catch (e) { console.error(e); }
  }

  const savedCali = localStorage.getItem('gym_cali_exercises');
  if (savedCali) {
    try { caliExercises = JSON.parse(savedCali); } catch (e) { console.error(e); }
  }

  const savedHistory = localStorage.getItem('gym_workout_history');
  if (savedHistory) {
    try { workoutHistory = JSON.parse(savedHistory); } catch (e) { console.error(e); }
  }

  const savedBody = localStorage.getItem('gym_body_profile');
  if (savedBody) {
    try { bodyProfile = JSON.parse(savedBody); } catch (e) { console.error(e); }
  }
}

function saveActiveSession() {
  safeSet('gym_active_session_inputs', JSON.stringify(activeSessionInputs));
  safeSet('gym_active_warmup', JSON.stringify(activeWarmupState));
  safeSet('gym_active_workout_id', activeWorkoutId);
}

// ==================== RENDERING SUBTABS ====================
function renderSubtabs() {
  const nav = document.getElementById('workoutSubtabs');
  if (!nav) return;
  nav.innerHTML = '';

  // Schede Sala Pesi
  Object.values(userWorkouts).forEach(w => {
    const btn = document.createElement('button');
    btn.className = `subtab-btn ${activeWorkoutId === w.id ? 'active' : ''}`;
    btn.textContent = w.name;
    btn.onclick = () => selectWorkoutSubtab(w.id);
    nav.appendChild(btn);
  });

  // Sala Pesi Libera
  const freeBtn = document.createElement('button');
  freeBtn.className = `subtab-btn ${activeWorkoutId === 'free_pesi' ? 'active' : ''}`;
  freeBtn.textContent = '🆓 Sala Pesi Libera';
  freeBtn.onclick = () => selectWorkoutSubtab('free_pesi');
  nav.appendChild(freeBtn);

  // Calisthenics
  const caliBtn = document.createElement('button');
  caliBtn.className = `subtab-btn ${activeWorkoutId === 'calisthenics' ? 'active' : ''}`;
  caliBtn.textContent = '🤸 Calisthenics';
  caliBtn.onclick = () => selectWorkoutSubtab('calisthenics');
  nav.appendChild(caliBtn);

  // + Nuova Scheda
  const addBtn = document.createElement('button');
  addBtn.className = 'subtab-btn add-tab-btn';
  addBtn.textContent = '➕ Nuova Scheda';
  addBtn.onclick = () => openCreateWorkoutModal();
  nav.appendChild(addBtn);
}

function selectWorkoutSubtab(id) {
  activeWorkoutId = id;
  safeSet('gym_active_workout_id', activeWorkoutId);
  renderSubtabs();

  const routineSec = document.getElementById('activeWorkoutSection');
  const caliSec = document.getElementById('sectionCalisthenics');

  if (id === 'calisthenics' || id === 'free_pesi') {
    setFreeCategory(id === 'free_pesi' ? 'pesi' : 'calisthenics');
    routineSec.style.display = 'none';
    caliSec.style.display = 'block';
    renderCalisthenics();
  } else {
    routineSec.style.display = 'block';
    caliSec.style.display = 'none';
    renderActiveWorkoutView();
  }
}

// ==================== SCHEDA ATTIVA (SALA PESI) ====================
function renderActiveWorkoutView() {
  const workout = userWorkouts[activeWorkoutId];
  if (!workout) return;

  const titleEl = document.getElementById('activeWorkoutTitle');
  if (titleEl) titleEl.textContent = workout.name;

  const warmupCheck = document.getElementById('warmupCheck');
  if (warmupCheck) warmupCheck.checked = !!activeWarmupState[activeWorkoutId];

  const container = document.getElementById('exercisesContainer');
  if (!container) return;
  container.innerHTML = '';

  const sessionData = activeSessionInputs[activeWorkoutId] || {};

  workout.exercises.forEach((ex, exIdx) => {
    const lastPerf = getLastPerformance(ex.name);
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.id = `card_${ex.id}`;

    let setsHtml = '';
    for (let s = 1; s <= ex.sets; s++) {
      const setKey = `${ex.id}_s${s}`;
      const savedSet = sessionData[setKey] || { kg: '', reps: '', diff: '' };

      let rowDiffClass = '';
      if (savedSet.diff === 'easy') rowDiffClass = 'is-easy';
      else if (savedSet.diff === 'med') rowDiffClass = 'is-med';
      else if (savedSet.diff === 'hard') rowDiffClass = 'is-hard';

      setsHtml += `
        <div class="set-row ${rowDiffClass}" id="row_${setKey}">
          <div class="set-num">${s}</div>
          
          <!-- Stepper Kg -->
          <div class="stepper-box">
            <button class="stepper-btn" onclick="stepValue('${setKey}', 'kg', -1)">-</button>
            <input type="number" step="0.5" class="stepper-input" id="kg_${setKey}" 
              placeholder="${phKg(ex.name, s, 'Kg')}" value="${savedSet.kg}" 
              oninput="handleSetInput('${setKey}', 'kg', this.value)">
            <button class="stepper-btn" onclick="stepValue('${setKey}', 'kg', 1)">+</button>
          </div>

          <!-- Stepper Reps -->
          <div class="stepper-box">
            <button class="stepper-btn" onclick="stepValue('${setKey}', 'reps', -1)">-</button>
            <input type="number" class="stepper-input" id="reps_${setKey}" 
              placeholder="${phReps(ex.name, s)}" value="${savedSet.reps}" 
              oninput="handleSetInput('${setKey}', 'reps', this.value)">
            <button class="stepper-btn" onclick="stepValue('${setKey}', 'reps', 1)">+</button>
          </div>

          <!-- Colori Sforzo: 🟢 🟡 🔴 -->
          <div class="diff-buttons">
            <button class="diff-btn btn-easy ${savedSet.diff === 'easy' ? 'active' : ''}" 
              onclick="setDifficulty('${setKey}', 'easy', '${enc(ex.name)}', ${ex.rest})" title="Facile">🟢</button>
            <button class="diff-btn btn-med ${savedSet.diff === 'med' ? 'active' : ''}" 
              onclick="setDifficulty('${setKey}', 'med', '${enc(ex.name)}', ${ex.rest})" title="Medio">🟡</button>
            <button class="diff-btn btn-hard ${savedSet.diff === 'hard' ? 'active' : ''}" 
              onclick="setDifficulty('${setKey}', 'hard', '${enc(ex.name)}', ${ex.rest})" title="Difficile">🔴</button>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="exercise-header">
        <div class="exercise-title-row">
          <div class="exercise-name">${exIdx + 1}. ${esc(ex.name)}</div>
        </div>
        <div class="exercise-meta">
          <span class="badge target-reps">🎯 ${ex.sets} × ${ex.targetReps}</span>
          <span class="badge rest-time">⏱️ ${ex.rest}s rec</span>
          ${lastBtn(ex)}
        </div>
        ${lastPerf ? `<div class="last-time-badge">${lastPerf}</div>` : ''}
      </div>
      <div class="sets-list">
        ${setsHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

function handleSetInput(setKey, field, val) {
  if (!activeSessionInputs[activeWorkoutId]) activeSessionInputs[activeWorkoutId] = {};
  if (!activeSessionInputs[activeWorkoutId][setKey]) activeSessionInputs[activeWorkoutId][setKey] = { kg: '', reps: '', diff: '' };
  activeSessionInputs[activeWorkoutId][setKey][field] = val;
  saveActiveSession();
}

function stepValue(setKey, field, delta) {
  const inputEl = document.getElementById(`${field}_${setKey}`);
  if (!inputEl) return;
  let val = parseFloat(inputEl.value) || parseFloat(inputEl.placeholder) || 0;
  if (field === 'kg') val = Math.max(0, val + delta * 2.5);
  else val += delta;
  if (val < 0) val = 0;
  inputEl.value = val;
  handleSetInput(setKey, field, val);
}

function setDifficulty(setKey, diff, exName, restSeconds) {
  if (!activeSessionInputs[activeWorkoutId]) activeSessionInputs[activeWorkoutId] = {};
  if (!activeSessionInputs[activeWorkoutId][setKey]) activeSessionInputs[activeWorkoutId][setKey] = { kg: '', reps: '', diff: '' };

  const currentDiff = activeSessionInputs[activeWorkoutId][setKey].diff;
  const newDiff = currentDiff === diff ? '' : diff;
  activeSessionInputs[activeWorkoutId][setKey].diff = newDiff;

  const row = document.getElementById(`row_${setKey}`);
  if (row) {
    row.classList.remove('is-easy', 'is-med', 'is-hard');
    if (newDiff === 'easy') row.classList.add('is-easy');
    else if (newDiff === 'med') row.classList.add('is-med');
    else if (newDiff === 'hard') row.classList.add('is-hard');

    const btns = row.querySelectorAll('.diff-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (newDiff) {
      const activeBtn = row.querySelector(`.btn-${newDiff}`);
      if (activeBtn) activeBtn.classList.add('active');
    }
  }

  saveActiveSession();

  if (newDiff) {
    startRestTimer(restSeconds || 90, decodeURIComponent(exName));
    showToast(`Serie registrata: ${newDiff === 'easy' ? '🟢 Facile' : newDiff === 'med' ? '🟡 Medio' : '🔴 Difficile'}`);
  }
}

function toggleWarmup() {
  const check = document.getElementById('warmupCheck');
  if (check) {
    check.checked = !check.checked;
    activeWarmupState[activeWorkoutId] = check.checked;
    saveActiveSession();
  }
}

function completeActiveWorkout() {
  const workout = userWorkouts[activeWorkoutId];
  if (!workout) return;

  const sessionData = activeSessionInputs[activeWorkoutId] || {};
  const exercisesResults = [];
  let totalSetsDone = 0;

  workout.exercises.forEach(ex => {
    const sets = [];
    for (let s = 1; s <= ex.sets; s++) {
      const setKey = `${ex.id}_s${s}`;
      const data = sessionData[setKey];
      if (data && (data.kg || data.reps || data.diff)) {
        sets.push({
          setNum: s,
          kg: data.kg || 0,
          reps: data.reps || 0,
          diff: data.diff || 'none'
        });
        totalSetsDone++;
      }
    }
    if (sets.length > 0) {
      exercisesResults.push({ name: ex.name, sets });
    }
  });

  if (totalSetsDone === 0) {
    alert('Nessuna serie registrata da salvare.');
    return;
  }

  const now = new Date();
  const dateStr = sessionDateOverride || localDateStr(now);
  const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const historyEntry = {
    id: Date.now(),
    date: dateStr,
    time: timeStr,
    workout: workout.name,
    category: 'pesi',
    warmupDone: !!activeWarmupState[activeWorkoutId],
    exercises: exercisesResults
  };

  workoutHistory.unshift(historyEntry);
  sessionDateOverride = null; hideSessionBanner();
  safeSet('gym_workout_history', JSON.stringify(workoutHistory));

  // Reset inputs
  activeSessionInputs[activeWorkoutId] = {};
  activeWarmupState[activeWorkoutId] = false;
  saveActiveSession();

  renderActiveWorkoutView();
  renderCalendar();
  renderAnalytics();

  showToast(`🎉 ${workout.name} completata e registrata nel calendario!`);
  switchMainTab('calendar');
}

function resetActiveWorkoutSession() {
  const workout = userWorkouts[activeWorkoutId];
  if (!confirm(`Vuoi azzerare i dati inseriti per ${workout.name}?`)) return;
  activeSessionInputs[activeWorkoutId] = {};
  activeWarmupState[activeWorkoutId] = false;
  saveActiveSession();
  renderActiveWorkoutView();
  showToast('Dati seduta azzerati.');
}

function copyActiveWorkoutToClipboard() {
  const workout = userWorkouts[activeWorkoutId];
  if (!workout) return;
  const sessionData = activeSessionInputs[activeWorkoutId] || {};

  let tsv = "Data\tScheda\tEsercizio\tSerie\tCarico_Kg\tRipetizioni\tDifficoltà\n";
  const today = localDateStr();

  let count = 0;
  workout.exercises.forEach(ex => {
    for (let s = 1; s <= ex.sets; s++) {
      const setKey = `${ex.id}_s${s}`;
      const data = sessionData[setKey];
      if (data && (data.kg || data.reps || data.diff)) {
        const diffText = data.diff === 'easy' ? '🟢 Facile' : data.diff === 'med' ? '🟡 Medio' : data.diff === 'hard' ? '🔴 Difficile' : '';
        tsv += `${today}\t${workout.name}\t${ex.name}\t${s}\t${data.kg || 0}\t${data.reps || 0}\t${diffText}\n`;
        count++;
      }
    }
  });

  if (count === 0) {
    alert('Nessun dato registrato nella seduta corrente.');
    return;
  }

  navigator.clipboard.writeText(tsv).then(() => {
    showToast('📋 Copiato negli appunti per Google Fogli!');
  });
}

function deleteCurrentWorkout() {
  const workout = userWorkouts[activeWorkoutId];
  if (!workout) return;
  if (!confirm(`Sei sicuro di voler eliminare definitivamente la scheda "${workout.name}"?`)) return;

  delete userWorkouts[activeWorkoutId];
  safeSet('gym_user_workouts', JSON.stringify(userWorkouts));

  activeWorkoutId = Object.keys(userWorkouts)[0] || 'calisthenics';
  safeSet('gym_active_workout_id', activeWorkoutId);

  renderSubtabs();
  checkWelcomeScreen();
  selectWorkoutSubtab(activeWorkoutId);
  showToast('Scheda eliminata.');
}

// ==================== CALISTHENICS (LAVAGNA LIBERA) ====================
function renderCalisthenics() {
  const container = document.getElementById('exercisesContainerCali');
  if (!container) return;
  container.innerHTML = '';

  const sessionData = activeSessionInputs[freeKey()] || {};

  if (caliExercises.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 24px 10px; background: var(--bg-card); border-radius: var(--radius); border: 1px dashed var(--border-color);">
        Nessun esercizio aggiunto per oggi.<br>
        Usa il campo in alto per aggiungere gli esercizi preparati dal tuo istruttore!
      </div>
    `;
    return;
  }

  caliExercises.forEach((ex, exIdx) => {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.id = `card_${ex.id}`;

    let setsHtml = '';
    for (let s = 1; s <= ex.sets; s++) {
      const setKey = `${ex.id}_s${s}`;
      const savedSet = sessionData[setKey] || { kg: '', reps: '', diff: '' };

      let rowDiffClass = '';
      if (savedSet.diff === 'easy') rowDiffClass = 'is-easy';
      else if (savedSet.diff === 'med') rowDiffClass = 'is-med';
      else if (savedSet.diff === 'hard') rowDiffClass = 'is-hard';

      setsHtml += `
        <div class="set-row ${rowDiffClass}" id="row_${setKey}">
          <div class="set-num">${s}</div>
          
          <!-- Stepper +Kg / Zavorra -->
          <div class="stepper-box">
            <button class="stepper-btn" onclick="stepCaliValue('${setKey}', 'kg', -1)">-</button>
            <input type="number" step="0.5" class="stepper-input" id="kg_${setKey}" 
              placeholder="${phKg(ex.name, s, '+Kg')}" value="${savedSet.kg}" 
              oninput="handleCaliSetInput('${setKey}', 'kg', this.value)">
            <button class="stepper-btn" onclick="stepCaliValue('${setKey}', 'kg', 1)">+</button>
          </div>

          <!-- Stepper Reps / Sec -->
          <div class="stepper-box">
            <button class="stepper-btn" onclick="stepCaliValue('${setKey}', 'reps', -1)">-</button>
            <input type="number" class="stepper-input" id="reps_${setKey}" 
              placeholder="${phReps(ex.name, s)}" value="${savedSet.reps}" 
              oninput="handleCaliSetInput('${setKey}', 'reps', this.value)">
            <button class="stepper-btn" onclick="stepCaliValue('${setKey}', 'reps', 1)">+</button>
          </div>

          <!-- Colori Sforzo -->
          <div class="diff-buttons">
            <button class="diff-btn btn-easy ${savedSet.diff === 'easy' ? 'active' : ''}" 
              onclick="setCaliDifficulty('${setKey}', 'easy', '${enc(ex.name)}', ${ex.rest || 60})">🟢</button>
            <button class="diff-btn btn-med ${savedSet.diff === 'med' ? 'active' : ''}" 
              onclick="setCaliDifficulty('${setKey}', 'med', '${enc(ex.name)}', ${ex.rest || 60})">🟡</button>
            <button class="diff-btn btn-hard ${savedSet.diff === 'hard' ? 'active' : ''}" 
              onclick="setCaliDifficulty('${setKey}', 'hard', '${enc(ex.name)}', ${ex.rest || 60})">🔴</button>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="exercise-header">
        <div class="exercise-title-row">
          <div class="exercise-name">${exIdx + 1}. ${esc(ex.name)}</div>
          <button style="background: transparent; border: none; color: var(--hard-border); font-size: 0.95rem; cursor: pointer; padding: 4px;" 
            onclick="removeCalisthenicsExercise('${ex.id}')">✕</button>
        </div>
        <div class="exercise-meta">
          <span class="badge target-reps">🎯 ${ex.sets} serie</span>
          <button style="background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-muted); border-radius: 6px; padding: 2px 8px; font-size: 0.72rem; cursor: pointer;" 
            onclick="addSetToCaliExercise('${ex.id}')">+ Aggiungi Serie</button>
          ${lastBtn(ex)}
        </div>
      </div>
      <div class="sets-list">
        ${setsHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

function addCalisthenicsExercise() {
  const input = document.getElementById('newCaliExerciseInput');
  const name = input ? input.value.trim() : '';
  if (!name) return;

  const newEx = {
    id: 'cali_' + Date.now(),
    name: name,
    sets: (getLastSets(name) || []).length || 3,
    targetReps: 'Libero',
    rest: 60
  };

  caliExercises.push(newEx);
  saveFreeBoard();
  input.value = '';
  renderCalisthenics();
  showToast(`Aggiunto: ${name}`);
}

function removeCalisthenicsExercise(id) {
  caliExercises = caliExercises.filter(e => e.id !== id);
  saveFreeBoard();
  renderCalisthenics();
}

function addSetToCaliExercise(id) {
  const ex = caliExercises.find(e => e.id === id);
  if (ex) {
    ex.sets++;
    saveFreeBoard();
    renderCalisthenics();
  }
}

function handleCaliSetInput(setKey, field, val) {
  if (!activeSessionInputs[freeKey()]) activeSessionInputs[freeKey()] = {};
  if (!activeSessionInputs[freeKey()][setKey]) activeSessionInputs[freeKey()][setKey] = { kg: '', reps: '', diff: '' };
  activeSessionInputs[freeKey()][setKey][field] = val;
  saveActiveSession();
}

function stepCaliValue(setKey, field, delta) {
  const inputEl = document.getElementById(`${field}_${setKey}`);
  if (!inputEl) return;
  let val = parseFloat(inputEl.value) || parseFloat(inputEl.placeholder) || 0;
  val += delta;
  if (val < 0) val = 0;
  inputEl.value = val;
  handleCaliSetInput(setKey, field, val);
}

function setCaliDifficulty(setKey, diff, exName, rest) {
  if (!activeSessionInputs[freeKey()]) activeSessionInputs[freeKey()] = {};
  if (!activeSessionInputs[freeKey()][setKey]) activeSessionInputs[freeKey()][setKey] = { kg: '', reps: '', diff: '' };

  const currentDiff = activeSessionInputs[freeKey()][setKey].diff;
  const newDiff = currentDiff === diff ? '' : diff;
  activeSessionInputs[freeKey()][setKey].diff = newDiff;

  const row = document.getElementById(`row_${setKey}`);
  if (row) {
    row.classList.remove('is-easy', 'is-med', 'is-hard');
    if (newDiff === 'easy') row.classList.add('is-easy');
    else if (newDiff === 'med') row.classList.add('is-med');
    else if (newDiff === 'hard') row.classList.add('is-hard');

    const btns = row.querySelectorAll('.diff-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (newDiff) {
      const activeBtn = row.querySelector(`.btn-${newDiff}`);
      if (activeBtn) activeBtn.classList.add('active');
    }
  }

  saveActiveSession();

  if (newDiff) {
    startRestTimer(rest || 60, decodeURIComponent(exName));
    showToast(`Serie registrata: ${newDiff === 'easy' ? '🟢 Facile' : newDiff === 'med' ? '🟡 Medio' : '🔴 Difficile'}`);
  }
}

function completeCalisthenicsWorkout() {
  const sessionData = activeSessionInputs[freeKey()] || {};
  const exercisesResults = [];
  let totalSetsDone = 0;

  caliExercises.forEach(ex => {
    const sets = [];
    for (let s = 1; s <= ex.sets; s++) {
      const setKey = `${ex.id}_s${s}`;
      const data = sessionData[setKey];
      if (data && (data.kg || data.reps || data.diff)) {
        sets.push({
          setNum: s,
          kg: data.kg || 0,
          reps: data.reps || 0,
          diff: data.diff || 'none'
        });
        totalSetsDone++;
      }
    }
    if (sets.length > 0) {
      exercisesResults.push({ name: ex.name, sets });
    }
  });

  if (totalSetsDone === 0) {
    alert('Nessuna serie registrata da salvare.');
    return;
  }

  const now = new Date();
  const dateStr = sessionDateOverride || localDateStr(now);
  const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const historyEntry = {
    id: Date.now(),
    date: dateStr,
    time: timeStr,
    workout: freeLabel(),
    category: freeCategory,
    warmupDone: true,
    exercises: exercisesResults
  };

  workoutHistory.unshift(historyEntry);
  sessionDateOverride = null; hideSessionBanner();
  safeSet('gym_workout_history', JSON.stringify(workoutHistory));

  activeSessionInputs[freeKey()] = {};
  saveActiveSession();

  renderCalisthenics();
  renderCalendar();
  renderAnalytics();

  showToast('🏆 Seduta ' + freeLabel() + ' salvata nel calendario!');
  switchMainTab('calendar');
}

function resetCalisthenicsSession() {
  if (!confirm('Vuoi azzerare i dati inseriti per questa seduta di Calisthenics?')) return;
  activeSessionInputs[freeKey()] = {};
  saveActiveSession();
  renderCalisthenics();
  showToast('Dati seduta azzerati.');
}

function copyCalisthenicsToClipboard() {
  const sessionData = activeSessionInputs[freeKey()] || {};
  let tsv = "Data\tAttività\tEsercizio\tSerie\tZavorra_Kg\tReps\tDifficoltà\n";
  const today = localDateStr();

  let count = 0;
  caliExercises.forEach(ex => {
    for (let s = 1; s <= ex.sets; s++) {
      const setKey = `${ex.id}_s${s}`;
      const data = sessionData[setKey];
      if (data && (data.kg || data.reps || data.diff)) {
        const diffText = data.diff === 'easy' ? '🟢 Facile' : data.diff === 'med' ? '🟡 Medio' : data.diff === 'hard' ? '🔴 Difficile' : '';
        tsv += `${today}\t${freeLabel()}\t${ex.name}\t${s}\t${data.kg || 0}\t${data.reps || 0}\t${diffText}\n`;
        count++;
      }
    }
  });

  if (count === 0) {
    alert('Nessun dato registrato nella seduta corrente.');
    return;
  }

  navigator.clipboard.writeText(tsv).then(() => {
    showToast('📋 Copiato negli appunti per Google Fogli!');
  });
}

// ==================== TIMER CALISTHENICS VERSATILE ====================
function changeCaliTimerMode() {
  const modeSel = document.getElementById('caliTimerModeSelect');
  if (!modeSel) return;
  caliTimerMode = modeSel.value;
  
  const durRow = document.getElementById('caliTimerDurationRow');
  const roundBadge = document.getElementById('caliTimerRoundBadge');
  
  if (caliTimerMode === 'stopwatch') {
    if (durRow) durRow.style.display = 'none';
    if (roundBadge) roundBadge.style.display = 'none';
  } else if (caliTimerMode === 'intervals') {
    if (durRow) durRow.style.display = 'flex';
    if (roundBadge) roundBadge.style.display = 'inline';
  } else {
    if (durRow) durRow.style.display = 'flex';
    if (roundBadge) roundBadge.style.display = 'none';
  }
  
  resetCaliTimer();
}

function stepCaliTimerMinutes(delta) {
  const input = document.getElementById('caliTimerCustomMinutes');
  let currentVal = parseInt(input ? input.value : 5, 10) || 5;
  currentVal += delta;
  if (currentVal < 1) currentVal = 1;
  if (input) input.value = currentVal;
  caliTimerDurationMinutes = currentVal;
  resetCaliTimer();
}

function handleCaliCustomMinutesInput(val) {
  let mins = parseInt(val, 10);
  if (isNaN(mins) || mins < 1) mins = 1;
  caliTimerDurationMinutes = mins;
  resetCaliTimer();
}

function initCaliTimer() {
  const input = document.getElementById('caliTimerCustomMinutes');
  if (input) {
    caliTimerDurationMinutes = parseInt(input.value, 10) || 5;
    if (caliTimerDurationMinutes < 1) caliTimerDurationMinutes = 1;
  }
  resetCaliTimer();
}

function toggleCaliTimer() {
  if (caliTimerIsRunning) {
    pauseCaliTimer();
  } else {
    startCaliTimer();
  }
}

function startCaliTimer() {
  caliTimerIsRunning = true;
  const startBtn = document.getElementById('caliTimerStartBtn');
  if (startBtn) {
    startBtn.textContent = '⏸️ Pausa';
    startBtn.classList.remove('btn-primary');
    startBtn.classList.add('btn-secondary');
  }

  playChimeTone(523.25, 0.2);

  caliTimerInterval = setInterval(() => {
    if (caliTimerMode === 'stopwatch') {
      caliTimerSeconds++;
      updateCaliTimerDisplay();
    } else if (caliTimerMode === 'intervals') {
      caliTimerSeconds--;
      if (caliTimerSeconds <= 3 && caliTimerSeconds > 0) {
        playChimeTone(440, 0.1);
      }
      if (caliTimerSeconds <= 0) {
        caliTimerCurrentRound++;
        if (caliTimerCurrentRound > caliTimerDurationMinutes) {
          resetCaliTimer();
          playDoubleChime();
          showToast('🏆 Tutti i round completati!');
          return;
        } else {
          caliTimerSeconds = 60;
          playDoubleChime();
          if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
          showToast(`🔔 Round ${caliTimerCurrentRound} di ${caliTimerDurationMinutes}!`);
        }
      }
      updateCaliTimerDisplay();
    } else {
      caliTimerSeconds--;
      if (caliTimerSeconds <= 3 && caliTimerSeconds > 0) {
        playChimeTone(440, 0.1);
      }
      if (caliTimerSeconds <= 0) {
        resetCaliTimer();
        playDoubleChime();
        showToast('🏆 Tempo Calisthenics terminato!');
      } else {
        updateCaliTimerDisplay();
      }
    }
  }, 1000);
}

function pauseCaliTimer() {
  caliTimerIsRunning = false;
  clearInterval(caliTimerInterval);
  const startBtn = document.getElementById('caliTimerStartBtn');
  if (startBtn) {
    startBtn.textContent = '▶️ Riprendi';
    startBtn.classList.remove('btn-secondary');
    startBtn.classList.add('btn-primary');
  }
}

function resetCaliTimer() {
  caliTimerIsRunning = false;
  clearInterval(caliTimerInterval);
  
  if (caliTimerMode === 'stopwatch') {
    caliTimerSeconds = 0;
  } else if (caliTimerMode === 'intervals') {
    caliTimerSeconds = 60;
    caliTimerCurrentRound = 1;
  } else {
    const input = document.getElementById('caliTimerCustomMinutes');
    const mins = input ? parseInt(input.value, 10) || 5 : 5;
    caliTimerDurationMinutes = Math.max(1, mins);
    caliTimerSeconds = caliTimerDurationMinutes * 60;
  }

  const startBtn = document.getElementById('caliTimerStartBtn');
  if (startBtn) {
    startBtn.textContent = '▶️ Avvia';
    startBtn.classList.remove('btn-secondary');
    startBtn.classList.add('btn-primary');
  }

  updateCaliTimerDisplay();
}

function updateCaliTimerDisplay() {
  const display = document.getElementById('caliTimerDisplay');
  const roundBadge = document.getElementById('caliTimerRoundBadge');
  if (!display) return;

  const m = Math.floor(caliTimerSeconds / 60);
  const s = caliTimerSeconds % 60;
  display.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  if (roundBadge && caliTimerMode === 'intervals') {
    roundBadge.textContent = `Round ${caliTimerCurrentRound} / ${caliTimerDurationMinutes}`;
  }
}

// ==================== REST TIMER ====================
let restEnd = 0;
function startRestTimer(seconds, exName) {
  clearInterval(restTimerInterval);
  try { getAudioContext(); } catch (e) {}
  restEnd = Date.now() + seconds * 1000;
  const timerExName = document.getElementById('timerExerciseName');
  if (timerExName) timerExName.textContent = exName ? `Recupero (${exName})` : 'Recupero serie';
  const bar = document.getElementById('restTimerBar');
  if (bar) bar.classList.add('active');
  restTimerTick();
  restTimerInterval = setInterval(restTimerTick, 500);
}
function restTimerTick() {
  restTimerSecondsLeft = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000));
  updateTimerDisplay();
  if (restTimerSecondsLeft <= 0) {
    clearInterval(restTimerInterval);
    restTimerInterval = null;
    playDoubleChime();
    showToast('Tempo scaduto! Vai con la serie! 🔥');
    setTimeout(() => { const b = document.getElementById('restTimerBar'); if (b && !restTimerInterval) b.classList.remove('active'); }, 3500);
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && restTimerInterval) restTimerTick(); });

function updateTimerDisplay() {
  const m = Math.floor(restTimerSecondsLeft / 60);
  const s = restTimerSecondsLeft % 60;
  const display = document.getElementById('timerDisplay');
  if (display) {
    display.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}

function adjustTimer(delta) {
  restEnd = Math.max(Date.now(), restEnd + delta * 1000);
  clearInterval(restTimerInterval);
  restTimerInterval = setInterval(restTimerTick, 500);
  restTimerTick();
}

function stopTimer() {
  clearInterval(restTimerInterval);
  const timerBar = document.getElementById('restTimerBar');
  if (timerBar) timerBar.classList.remove('active');
}

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playChimeTone(freq, dur) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch (e) { console.warn(e); }
}

function playDoubleChime() {
  playChimeTone(587.33, 0.2);
  setTimeout(() => playChimeTone(880, 0.35), 200);
  if ('vibrate' in navigator) navigator.vibrate([250, 100, 250]);
}

// ==================== CALENDARIO COMPATTO CON LOG SEDUTA ====================
function navigateMonth(delta) {
  calCurrentDate.setDate(1);
  calCurrentDate.setMonth(calCurrentDate.getMonth() + delta);
  renderCalendar();
}

function renderCalendar() {
  const titleEl = document.getElementById('calendarMonthTitle');
  const gridEl = document.getElementById('calendarDaysGrid');
  if (!titleEl || !gridEl) return;

  const year = calCurrentDate.getFullYear();
  const month = calCurrentDate.getMonth();
  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];
  titleEl.textContent = `${monthNames[month]} ${year}`;

  gridEl.innerHTML = '';

  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Lunedì = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = localDateStr();

  // Empty cells
  for (let i = 0; i < firstDayIndex; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-cell empty';
    gridEl.appendChild(empty);
  }

  // Days
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (dayStr === todayStr) cell.classList.add('today');
    if (dayStr === calSelectedDateStr) cell.classList.add('selected');

    // Dot indicators
    const dayWorkouts = workoutHistory.filter(w => w.date === dayStr);
    let dotsHtml = '';
    if (dayWorkouts.length > 0) {
      dotsHtml = '<div class="cal-dots">';
      dayWorkouts.forEach(w => {
        if (w.category === 'calisthenics' || w.workout === 'Calisthenics') {
          dotsHtml += '<span class="dot dot-c"></span>';
        } else if (w.category === 'altro') {
          dotsHtml += '<span class="dot dot-other"></span>';
        } else {
          dotsHtml += '<span class="dot dot-a"></span>';
        }
      });
      dotsHtml += '</div>';
    }

    cell.innerHTML = `<span>${day}</span>${dotsHtml}`;
    cell.onclick = () => selectCalendarDay(dayStr, dayWorkouts, cell);

    gridEl.appendChild(cell);
  }

  // Render details for selected day
  const selectedWorkouts = workoutHistory.filter(w => w.date === calSelectedDateStr);
  updateDayDetailsView(calSelectedDateStr, selectedWorkouts);
}

function selectCalendarDay(dateStr, workouts, cellEl) {
  calSelectedDateStr = dateStr;
  document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
  if (cellEl) cellEl.classList.add('selected');
  updateDayDetailsView(dateStr, workouts);
}

function updateDayDetailsView(dateStr, workouts) {
  const detailsEl = document.getElementById('calendarDayDetails');
  if (!detailsEl) return;

  const [y, m, d] = dateStr.split('-');
  const dateFormatted = `${d}/${m}/${y}`;

  let workoutsHtml = '';
  if (workouts && workouts.length > 0) {
    workouts.forEach(w => {
      let exercisesHtml = '';
      if (w.exercises && w.exercises.length > 0) {
        w.exercises.forEach(ex => {
          const setsStr = ex.sets.map(s => {
            const badge = s.diff === 'easy' ? '🟢' : s.diff === 'med' ? '🟡' : s.diff === 'hard' ? '🔴' : '';
            return `S${s.setNum}: ${s.kg}kg×${s.reps} ${badge}`;
          }).join(' | ');

          exercisesHtml += `
            <div style="font-size: 0.8rem; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <strong>${esc(ex.name)}</strong><br>
              <span style="color: var(--text-muted);">${setsStr}</span>
            </div>
          `;
        });
      } else if (w.notes) {
        exercisesHtml = `<div style="font-size: 0.8rem; color: var(--text-muted);">${esc(w.notes)}</div>`;
      }

      const diffBadge = w.diff === 'easy' ? '🟢' : w.diff === 'med' ? '🟡' : w.diff === 'hard' ? '🔴' : '';

      workoutsHtml += `
        <div style="background: var(--bg-input); border-radius: 8px; padding: 10px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--accent); margin-bottom: 6px;">
            <span>${esc(w.workout)} ${diffBadge}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">🕒 ${w.time || ''}</span> <button class="action-btn btn-secondary" style="padding:2px 8px;font-size:.7rem" onclick="deleteHistoryEntry(${w.id})">🗑️</button>
          </div>
          ${exercisesHtml}
        </div>
      `;
    });
  } else {
    workoutsHtml = `
      <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 10px;">
        Nessun allenamento registrato in questa data.
      </div>
    `;
  }

  detailsEl.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <strong style="color: #fff; font-size: 0.95rem;">📅 ${dateFormatted}</strong>
      <button class="action-btn btn-primary" style="padding: 6px 12px; font-size: 0.78rem;" onclick="openCalendarLogModal('${dateStr}')">
        + Registra Seduta
      </button>
    </div>
    ${workoutsHtml}
  `;
}

// Modal Registra da Calendario
function openCalendarLogModal(dateStr) {
  const [y, m, d] = dateStr.split('-');
  document.getElementById('calLogModalTitle').textContent = `Registra per il ${d}/${m}/${y}`;

  // Popola select routine
  const routineSelect = document.getElementById('calLogRoutineSelect');
  routineSelect.innerHTML = '';
  Object.values(userWorkouts).forEach(w => {
    const opt = document.createElement('option');
    opt.value = w.id;
    opt.textContent = w.name;
    routineSelect.appendChild(opt);
  });

  const optFree = document.createElement('option');
  optFree.value = 'libera';
  optFree.textContent = 'Inserimento Libero';
  routineSelect.appendChild(optFree);

  handleCalLogTypeChange();
  document.getElementById('calendarLogModal').classList.add('active');
}

function closeCalendarLogModal() {
  document.getElementById('calendarLogModal').classList.remove('active');
}

function handleCalLogTypeChange() {
  const type = document.getElementById('calLogTypeSelect').value;
  const routineBox = document.getElementById('calLogRoutineSelectBox');
  const customBox = document.getElementById('calLogCustomBox');

  if (type === 'pesi') {
    routineBox.style.display = 'block';
    customBox.style.display = 'none';
  } else if (type === 'calisthenics') {
    routineBox.style.display = 'none';
    customBox.style.display = 'none';
  } else {
    routineBox.style.display = 'none';
    customBox.style.display = 'block';
  }
}

function selectCalLogDiff(diff) {
  calLogSelectedDiff = diff;
  document.querySelectorAll('#calendarLogModal .diff-btn').forEach(b => b.classList.remove('active'));
  if (diff === 'easy') document.getElementById('calLogDiffEasy').classList.add('active');
  else if (diff === 'med') document.getElementById('calLogDiffMed').classList.add('active');
  else if (diff === 'hard') document.getElementById('calLogDiffHard').classList.add('active');
}

function confirmCalendarWorkoutLog() {
  const type = document.getElementById('calLogTypeSelect').value;
  let workoutTitle = 'Allenamento';
  let category = type;
  let notes = '';

  if (type === 'pesi') {
    const rId = document.getElementById('calLogRoutineSelect').value;
    if (rId === 'libera') {
      workoutTitle = 'Sala Pesi (Libero)';
    } else {
      workoutTitle = userWorkouts[rId] ? userWorkouts[rId].name : 'Sala Pesi';
    }
  } else if (type === 'calisthenics') {
    workoutTitle = 'Calisthenics';
  } else {
    workoutTitle = document.getElementById('calLogCustomDesc').value.trim() || 'Attività Extra';
    notes = workoutTitle;
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const historyEntry = {
    id: Date.now(),
    date: calSelectedDateStr,
    time: timeStr,
    workout: workoutTitle,
    category: category,
    diff: calLogSelectedDiff,
    notes: notes,
    exercises: []
  };

  workoutHistory.unshift(historyEntry);
  sessionDateOverride = null; hideSessionBanner();
  safeSet('gym_workout_history', JSON.stringify(workoutHistory));

  closeCalendarLogModal();
  renderCalendar();
  renderAnalytics();
  showToast(`Registrato: ${workoutTitle}`);
}

// ==================== DIARIO PROGRESSI INTELLIGENTE ====================
function getLastPerformance(exerciseName) {
  for (let i = 0; i < workoutHistory.length; i++) {
    const entry = workoutHistory[i];
    if (!entry.exercises) continue;
    const match = entry.exercises.find(e => e.name === exerciseName);
    if (match && match.sets && match.sets.length > 0) {
      const summary = match.sets
        .filter(s => s.reps || s.kg)
        .map(s => `${s.kg || 0}kg×${s.reps || 0}${s.diff === 'easy' ? ' 🟢' : s.diff === 'med' ? ' 🟡' : s.diff === 'hard' ? ' 🔴' : ''}`)
        .join(' | ');
      return summary ? `Ultima volta: ${summary}` : null;
    }
  }
  return null;
}

function renderAnalytics() {
  refreshExerciseSuggestions();
  const statWeeklyEl = document.getElementById('statWeeklyCount');
  const statTotalEl = document.getElementById('statTotalCount');
  if (statTotalEl) statTotalEl.textContent = workoutHistory.length;

  // Sedute questa settimana
  const now = new Date();
  const currentDay = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - currentDay);
  monday.setHours(0, 0, 0, 0);

  const thisWeekWorkouts = workoutHistory.filter(w => new Date(w.date) >= monday);
  if (statWeeklyEl) statWeeklyEl.textContent = thisWeekWorkouts.length;

  // Bilancio sforzo 🟢 🟡 🔴
  let easyCount = 0, medCount = 0, hardCount = 0;
  workoutHistory.forEach(w => {
    if (w.exercises) {
      w.exercises.forEach(ex => {
        ex.sets.forEach(s => {
          if (s.diff === 'easy') easyCount++;
          else if (s.diff === 'med') medCount++;
          else if (s.diff === 'hard') hardCount++;
        });
      });
    } else if (w.diff) {
      if (w.diff === 'easy') easyCount++;
      else if (w.diff === 'med') medCount++;
      else if (w.diff === 'hard') hardCount++;
    }
  });

  const totalSets = easyCount + medCount + hardCount;
  const pEasy = totalSets > 0 ? Math.round((easyCount / totalSets) * 100) : 0;
  const pMed = totalSets > 0 ? Math.round((medCount / totalSets) * 100) : 0;
  const pHard = totalSets > 0 ? 100 - pEasy - pMed : 0;

  const barE = document.getElementById('barEasy');
  const barM = document.getElementById('barMed');
  const barH = document.getElementById('barHard');
  if (barE) barE.style.width = `${pEasy}%`;
  if (barM) barM.style.width = `${pMed}%`;
  if (barH) barH.style.width = `${pHard}%`;

  if (document.getElementById('labelEasy')) document.getElementById('labelEasy').textContent = `🟢 Facile: ${pEasy}%`;
  if (document.getElementById('labelMed')) document.getElementById('labelMed').textContent = `🟡 Medio: ${pMed}%`;
  if (document.getElementById('labelHard')) document.getElementById('labelHard').textContent = `🔴 Difficile: ${pHard}%`;

  // Select esercizi per progressione
  const select = document.getElementById('progressionExerciseSelect');
  if (select) {
    const currentVal = select.value;
    const allExNames = new Set();
    Object.values(userWorkouts).forEach(w => w.exercises.forEach(e => allExNames.add(e.name)));
    caliExercises.forEach(e => allExNames.add(e.name));
    workoutHistory.forEach(w => {
      if (w.exercises) w.exercises.forEach(e => allExNames.add(e.name));
    });

    select.innerHTML = '<option value="">Seleziona un esercizio da analizzare...</option>';
    allExNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });

    if (currentVal && allExNames.has(currentVal)) {
      select.value = currentVal;
      renderExerciseProgression(currentVal);
    }
  }
}

function renderExerciseProgression(exerciseName) {
  const container = document.getElementById('exerciseProgressionList');
  if (!container) return;
  if (!exerciseName) {
    container.innerHTML = '';
    return;
  }

  const occurrences = [];
  workoutHistory.forEach(w => {
    if (!w.exercises) return;
    const match = w.exercises.find(e => e.name === exerciseName);
    if (match) {
      occurrences.push({ date: w.date, workout: w.workout, sets: match.sets });
    }
  });

  if (occurrences.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 12px;">Nessuna sessione registrata per questo esercizio.</div>`;
    return;
  }

  // Ordine cronologico dal più vecchio al più recente per calcolare i delta
  const chron = [...occurrences].reverse();
  const analyzed = [];

  for (let i = 0; i < chron.length; i++) {
    const curr = chron[i];
    const prev = i > 0 ? chron[i - 1] : null;

    // Calcolo medie carico e fatica
    const currMaxKg = Math.max(...curr.sets.map(s => parseFloat(s.kg) || 0));
    const currDiffScore = calcAvgDiffScore(curr.sets);

    let smartBadgeHtml = '';
    if (prev) {
      const prevMaxKg = Math.max(...prev.sets.map(s => parseFloat(s.kg) || 0));
      const prevDiffScore = calcAvgDiffScore(prev.sets);

      const kgDiff = currMaxKg - prevMaxKg;

      if (kgDiff > 0) {
        smartBadgeHtml = `<span class="smart-badge badge-gain">🔥 +${kgDiff}kg Progresso</span>`;
      } else if (kgDiff === 0 && currDiffScore < prevDiffScore) {
        smartBadgeHtml = `<span class="smart-badge badge-adapt">⚡ Adattamento (Meno fatica)</span>`;
      } else if (kgDiff === 0 && currDiffScore === prevDiffScore) {
        smartBadgeHtml = `<span class="smart-badge badge-stable">➡️ Mantenimento Stabile</span>`;
      } else if (kgDiff < 0 || currDiffScore > prevDiffScore + 0.5) {
        smartBadgeHtml = `<span class="smart-badge badge-fatigue">⚠️ Fatica / Possibile Stallo</span>`;
      } else {
        smartBadgeHtml = `<span class="smart-badge badge-stable">➡️ Stabile</span>`;
      }
    } else {
      smartBadgeHtml = `<span class="smart-badge badge-stable">📌 Prima Rilevazione</span>`;
    }

    analyzed.unshift({ ...curr, badge: smartBadgeHtml });
  }

  let html = '';
  analyzed.forEach(item => {
    const setsStr = item.sets.map(s => {
      const badge = s.diff === 'easy' ? '🟢' : s.diff === 'med' ? '🟡' : s.diff === 'hard' ? '🔴' : '';
      return `${s.kg}kg × ${s.reps} ${badge}`;
    }).join(' | ');

    html += `
      <div style="background: var(--bg-input); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; font-size: 0.85rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="color: var(--accent); font-weight: 700;">📅 ${item.date}</span>
          ${item.badge}
        </div>
        <div style="color: #fff; margin-top: 4px;">${setsStr}</div>
      </div>
    `;
  });

  container.innerHTML = html;
  renderTrendChart(occurrences, exerciseName);
}

function renderTrendChart(occurrences, exerciseName) {
  const chartBox = document.getElementById('trendChartBox');
  const svgContainer = document.getElementById('trendChartSvgContainer');
  const titleEl = document.getElementById('trendChartTitle');
  if (!chartBox || !svgContainer) return;

  if (!occurrences || occurrences.length < 1) {
    chartBox.style.display = 'none';
    return;
  }

  chartBox.style.display = 'block';
  if (titleEl) titleEl.textContent = `📈 Andamento Carico: ${exerciseName}`;

  const chron = [...occurrences].reverse();
  const dataPoints = chron.map(o => {
    const maxKg = Math.max(...o.sets.map(s => parseFloat(s.kg) || 0));
    const avgDiff = calcAvgDiffScore(o.sets);
    return {
      date: o.date.slice(5),
      fullDate: o.date,
      kg: maxKg,
      avgDiff: avgDiff
    };
  });

  const width = 340;
  const height = 150;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 24;
  const padBottom = 26;

  const kgs = dataPoints.map(d => d.kg);
  let minKg = Math.min(...kgs);
  let maxKg = Math.max(...kgs);

  if (minKg === maxKg) {
    minKg = Math.max(0, minKg - 5);
    maxKg = maxKg + 5;
  } else {
    minKg = Math.max(0, minKg - (maxKg - minKg) * 0.15);
    maxKg = maxKg + (maxKg - minKg) * 0.15;
  }

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const points = dataPoints.map((d, i) => {
    const x = padLeft + (dataPoints.length > 1 ? (i / (dataPoints.length - 1)) * chartW : chartW / 2);
    const y = padTop + chartH - ((d.kg - minKg) / (maxKg - minKg)) * chartH;
    return { ...d, x, y };
  });

  let pathD = '';
  points.forEach((p, i) => {
    pathD += (i === 0 ? 'M' : 'L') + ` ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  });

  const areaD = pathD + ` L ${points[points.length - 1].x.toFixed(1)} ${padTop + chartH} L ${points[0].x.toFixed(1)} ${padTop + chartH} Z`;

  let gridLines = '';
  for (let g = 0; g <= 2; g++) {
    const yVal = padTop + (chartH / 2) * g;
    const kgVal = (maxKg - ((maxKg - minKg) / 2) * g).toFixed(1);
    gridLines += `
      <line x1="${padLeft}" y1="${yVal}" x2="${width - padRight}" y2="${yVal}" class="chart-grid-line" />
      <text x="${padLeft - 6}" y="${yVal + 3}" fill="#8b949e" font-size="9" text-anchor="end">${kgVal}k</text>
    `;
  }

  let dotsHtml = '';
  points.forEach(p => {
    let dotColor = '#3fb950';
    if (p.avgDiff > 2.3) dotColor = '#f85149';
    else if (p.avgDiff > 1.7) dotColor = '#d29922';

    dotsHtml += `
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="${dotColor}" stroke="#161b22" stroke-width="2" class="chart-point">
        <title>${p.fullDate}: ${p.kg}kg</title>
      </circle>
      <text x="${p.x.toFixed(1)}" y="${p.y - 8}" fill="#f0f6fc" font-size="9" font-weight="700" text-anchor="middle">${p.kg}kg</text>
      <text x="${p.x.toFixed(1)}" y="${height - 8}" fill="#8b949e" font-size="8" text-anchor="middle">${p.date}</text>
    `;
  });

  svgContainer.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#58a6ff" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#58a6ff" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaD}" class="chart-area" />
      <path d="${pathD}" class="chart-line" />
      ${dotsHtml}
    </svg>
  `;
}

function printActiveWorkout() {
  window.print();
}

function printAnalyticsChart() {
  window.print();
}

function calcAvgDiffScore(sets) {
  if (!sets || sets.length === 0) return 1;
  let sum = 0;
  sets.forEach(s => {
    if (s.diff === 'easy') sum += 1;
    else if (s.diff === 'med') sum += 2;
    else if (s.diff === 'hard') sum += 3;
    else sum += 1.5;
  });
  return sum / sets.length;
}

// ==================== GESTIONE SCHEDE (MODAL CREA / MODIFICA) ====================
let editorExerciseCounter = 0;

const EXERCISE_LIBRARY = {
  'Petto': ['Panca Piana Bilanciere', 'Panca Piana Manubri', 'Panca Inclinata Manubri', 'Panca Inclinata Bilanciere', 'Panca Declinata', 'Distensioni Man. 30°', 'Chest Press', 'Pectoral Fly', 'Croci Manubri', 'Croci Cavi Alti', 'Croci Cavi Medi', 'Croci Cavi Bassi', 'Push-up'],
  'Dorso': ['Lat Machine', 'Lat Machine Presa Stretta', 'Trazioni Sbarra', 'Trazioni Presa Neutra', 'Pulley Basso', 'Rematore Bilanciere', 'Rematore Manubrio', 'Rematore T-Bar', 'Rematore Macchina', 'Pulldown Braccia Tese', 'Pull-over Cavo', 'Hyperextension', 'Stacco Hex Bar', 'Stacco da Terra', 'Shrug Manubri'],
  'Spalle': ['Lento Avanti', 'Lento Manubri', 'Shoulder Press Macchina', 'Arnold Press', 'Alzate Laterali Manubri', 'Alzate Laterali Cavi', 'Alzate Frontali', 'Alzate Posteriori', 'Reverse Fly Macchina', 'Face Pull', 'Landmine Press', 'Tirate al Mento'],
  'Gambe': ['Squat Bilanciere', 'Squat Safety Bar', 'Squat Machine', 'Front Squat', 'Hack Squat', 'Leg Press', 'Goblet Squat', 'Affondi Bulgari', 'Affondi Statici', 'Affondi Camminata', 'Step-up', 'Leg Extension', 'Leg Curl', 'Leg Curl Sdraiato', 'Stacco Rumeno', 'RDL Manubrio', 'Good Morning', 'Calf in Piedi', 'Calf Seduto', 'Calf Machine', 'Adductor Machine', 'Abductor Machine'],
  'Glutei': ['Hip Thrust', 'Hip Thrust Macchina', 'Glute Bridge', 'Glute Kickback Cavo', 'Abductor Machine', 'Affondi Bulgari'],
  'Braccia': ['Curl Bilanciere', 'Curl Manubri', 'Curl Manubri Panca 60', 'Curl Hammer', 'Curl Panca Scott', 'Bayesian Curl', 'Curl Cavo Basso', 'Curl Concentrato', 'Pushdown Corda', 'Pushdown Barra', 'French Press', 'French Press Cavo Alto', 'Estensioni Sopra Testa', 'Skull Crusher', 'Dip Panca', 'Kickback Manubrio'],
  'Core': ['Crunch', 'Crunch Cavo', 'Plank', 'Plank Laterale', 'Sollevamento Gambe', 'Hanging Knee Raise', 'Ab Wheel', 'Russian Twist', 'Pallof Press', 'Woodchopper Cavo', 'Hollow Hold'],
  'Calisthenics': ['Trazioni', 'Dip Parallele', 'Muscle-Up', 'L-Sit', 'Pistol Squat', 'Handstand Push-up', 'Pike Push-up', 'Front Lever', 'Australian Row', 'Burpees', 'Kettlebell Swing', 'Farmer Walk']
};
let quickGroup = 'Petto';

function renderQuickChips() {
  const container = document.getElementById('quickExerciseChips');
  if (!container) return;
  container.innerHTML = '';
  Object.keys(EXERCISE_LIBRARY).forEach(g => {
    const p = document.createElement('button');
    p.type = 'button';
    p.className = 'chip-btn' + (g === quickGroup ? ' active' : '');
    p.style.fontWeight = '700';
    if (g === quickGroup) p.style.borderColor = 'var(--accent)';
    p.textContent = g;
    p.onclick = () => { quickGroup = g; renderQuickChips(); };
    container.appendChild(p);
  });
  EXERCISE_LIBRARY[quickGroup].forEach(name => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-btn';
    btn.textContent = '+ ' + name;
    btn.onclick = () => addExerciseToEditor(name, 3, '8/10', 90);
    container.appendChild(btn);
  });
}

function openCreateWorkoutModal() {
  document.getElementById('workoutEditorTitle').textContent = 'Crea Nuova Scheda';
  document.getElementById('editorWorkoutName').value = '';
  document.getElementById('editorExercisesList').innerHTML = '';
  editorExerciseCounter = 0;

  renderQuickChips();

  // Aggiungi un primo esercizio per iniziare
  addExerciseToEditor('Affondi Bulgari', 3, '3x8', 90);

  document.getElementById('workoutEditorModal').dataset.mode = 'create';
  document.getElementById('workoutEditorModal').classList.add('active');
}

function openEditWorkoutModal() {
  const workout = userWorkouts[activeWorkoutId];
  if (!workout) return;

  document.getElementById('workoutEditorTitle').textContent = `Modifica "${workout.name}"`;
  document.getElementById('editorWorkoutName').value = workout.name;
  document.getElementById('editorExercisesList').innerHTML = '';
  editorExerciseCounter = 0;

  renderQuickChips();

  workout.exercises.forEach(ex => {
    addExerciseToEditor(ex.name, ex.sets, ex.targetReps, ex.rest);
  });

  document.getElementById('workoutEditorModal').dataset.mode = 'edit';
  document.getElementById('workoutEditorModal').dataset.targetId = activeWorkoutId;
  document.getElementById('workoutEditorModal').classList.add('active');
}

function closeWorkoutEditorModal() {
  document.getElementById('workoutEditorModal').classList.remove('active');
}

function addExerciseToEditor(name = '', sets = 3, reps = '8/10', rest = 90) {
  editorExerciseCounter++;
  const container = document.getElementById('editorExercisesList');
  const div = document.createElement('div');
  const rowId = `edit_ex_row_${editorExerciseCounter}`;
  div.id = rowId;
  div.style.cssText = 'background: var(--bg-input); padding: 10px; border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--border-color);';

  div.innerHTML = `
    <div style="display: flex; gap: 6px; margin-bottom: 6px;">
      <input type="text" class="app-input ex-name" list="exerciseSuggestions" style="padding: 6px 8px; font-size: 0.88rem; font-weight: 700;" placeholder="Nome Esercizio" value="${esc(name)}">
      <button type="button" style="background: transparent; border: none; color: var(--hard-border); font-size: 1.1rem; cursor: pointer; padding: 2px 6px;" 
        onclick="this.parentElement.parentElement.remove()">✕</button>
    </div>
    <div style="display: grid; grid-template-columns: 1.1fr 1fr 1.2fr; gap: 6px; font-size: 0.75rem;">
      <div>
        <label style="color: var(--text-muted); display: block; margin-bottom: 2px;">Serie:</label>
        <div class="stepper-box" style="height: 32px;">
          <button type="button" class="stepper-btn" onclick="adjustEditorField('${rowId}', '.ex-sets', -1)">-</button>
          <input type="number" class="stepper-input ex-sets" style="font-size: 0.85rem;" value="${sets}" min="1">
          <button type="button" class="stepper-btn" onclick="adjustEditorField('${rowId}', '.ex-sets', 1)">+</button>
        </div>
      </div>
      <div>
        <label style="color: var(--text-muted); display: block; margin-bottom: 2px;">Reps:</label>
        <input type="text" class="app-input ex-reps" style="padding: 4px 6px; font-size: 0.82rem; height: 32px; text-align: center;" value="${esc(reps)}" placeholder="es. 8 o 6/8">
      </div>
      <div>
        <label style="color: var(--text-muted); display: block; margin-bottom: 2px;">Recupero:</label>
        <div class="stepper-box" style="height: 32px;">
          <button type="button" class="stepper-btn" onclick="adjustEditorField('${rowId}', '.ex-rest', -15)">-</button>
          <input type="number" class="stepper-input ex-rest" style="font-size: 0.85rem;" value="${rest}" step="15" min="15">
          <button type="button" class="stepper-btn" onclick="adjustEditorField('${rowId}', '.ex-rest', 15)">+</button>
        </div>
      </div>
    </div>
  `;

  container.appendChild(div);
}

function adjustEditorField(rowId, selector, delta) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const input = row.querySelector(selector);
  if (!input) return;
  let val = parseInt(input.value, 10) || 0;
  val += delta;
  if (val < 1) val = 1;
  input.value = val;
}

function saveWorkoutFromEditor() {
  const name = document.getElementById('editorWorkoutName').value.trim();
  if (!name) {
    alert('Inserisci un nome per la scheda.');
    return;
  }

  const rows = document.querySelectorAll('#editorExercisesList > div');
  const exercises = [];
  rows.forEach((r, idx) => {
    const exName = r.querySelector('.ex-name').value.trim();
    const sets = parseInt(r.querySelector('.ex-sets').value, 10) || 3;
    const reps = r.querySelector('.ex-reps').value.trim() || '8/10';
    const rest = parseInt(r.querySelector('.ex-rest').value, 10) || 90;

    if (exName) {
      exercises.push({
        id: `ex_${Date.now()}_${idx}`,
        name: exName,
        sets: sets,
        targetReps: reps,
        rest: rest
      });
    }
  });

  if (exercises.length === 0) {
    alert('Aggiungi almeno un esercizio alla scheda.');
    return;
  }

  const mode = document.getElementById('workoutEditorModal').dataset.mode;
  let workoutId = '';

  if (mode === 'edit') {
    workoutId = document.getElementById('workoutEditorModal').dataset.targetId;
    userWorkouts[workoutId].name = name;
    userWorkouts[workoutId].exercises = exercises;
  } else {
    workoutId = 'routine_' + Date.now();
    userWorkouts[workoutId] = {
      id: workoutId,
      name: name,
      exercises: exercises
    };
    activeWorkoutId = workoutId;
  }

  safeSet('gym_user_workouts', JSON.stringify(userWorkouts));
  safeSet('gym_active_workout_id', activeWorkoutId);

  closeWorkoutEditorModal();
  checkWelcomeScreen();
  renderSubtabs();
  selectWorkoutSubtab(activeWorkoutId);
  showToast(`Scheda "${name}" salvata con successo!`);
}

// ==================== IMPORTAZIONE EXCEL / CSV CON MAPPING FLESSIBILE ====================
function switchImportTab(tab) {
  const fileSec = document.getElementById('importFileSection');
  const textSec = document.getElementById('importTextSection');
  const fileBtn = document.getElementById('importTabFileBtn');
  const textBtn = document.getElementById('importTabTextBtn');

  if (tab === 'file') {
    if (fileSec) fileSec.style.display = 'block';
    if (textSec) textSec.style.display = 'none';
    if (fileBtn) fileBtn.classList.add('active');
    if (textBtn) textBtn.classList.remove('active');
  } else {
    if (fileSec) fileSec.style.display = 'none';
    if (textSec) textSec.style.display = 'block';
    if (fileBtn) fileBtn.classList.remove('active');
    if (textBtn) textBtn.classList.add('active');
  }
}

function parsePastedWorkoutText() {
  const textarea = document.getElementById('importPastedText');
  const rawText = textarea ? textarea.value.trim() : '';
  if (!rawText) {
    alert('Incolla prima il testo della tabella o del foglio.');
    return;
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  let currentWorkoutName = 'Scheda A';
  const detectedWorkouts = {};

  lines.forEach(line => {
    // Rileva intestazioni di scheda (es. SCHEDA B, SCHEDA A, GIORNO 1...)
    const headerMatch = line.match(/^(SCHEDA\s+[A-Z0-9]|GIORNO\s+[A-Z0-9]|ALLENAMENTO\s+[A-Z0-9])/i);
    if (headerMatch) {
      currentWorkoutName = headerMatch[1].toUpperCase();
      if (!detectedWorkouts[currentWorkoutName]) detectedWorkouts[currentWorkoutName] = [];
      return;
    }

    if (!detectedWorkouts[currentWorkoutName]) detectedWorkouts[currentWorkoutName] = [];

    const lower = line.toLowerCase();
    if (lower.startsWith('eserciz') || lower.startsWith('f,') || lower.includes('mobilità') || lower.includes('riscaldamento')) {
      return;
    }

    const parts = line.includes('\t') ? line.split('\t') : line.split(',');
    const name = parts[0] ? parts[0].trim().replace(/^"|"$/g, '') : '';
    if (!name) return;

    const repsRaw = parts[1] ? parts[1].trim() : '3x8';
    const restRaw = parts[2] ? parseInt(parts[2], 10) : 90;

    // Rileva numero serie dalla stringa ripetizioni (es. 3X8 -> 3, 4x6 -> 4)
    let sets = 3;
    const setsMatch = repsRaw.match(/(\d+)\s*[xX]/);
    if (setsMatch) {
      sets = parseInt(setsMatch[1], 10) || 3;
    }

    detectedWorkouts[currentWorkoutName].push({
      id: `parsed_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name,
      sets: sets,
      targetReps: repsRaw,
      rest: isNaN(restRaw) ? 90 : restRaw
    });
  });

  const workoutKeys = Object.keys(detectedWorkouts).filter(k => detectedWorkouts[k].length > 0);
  if (workoutKeys.length === 0) {
    alert('Nessun esercizio valido rilevato dal testo incollato. Verifica il formato.');
    return;
  }

  workoutKeys.forEach((k, idx) => {
    const routineId = 'routine_' + k.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + (Date.now() + idx);
    userWorkouts[routineId] = {
      id: routineId,
      name: k,
      exercises: detectedWorkouts[k]
    };
    if (idx === 0) activeWorkoutId = routineId;
  });

  safeSet('gym_user_workouts', JSON.stringify(userWorkouts));
  safeSet('gym_active_workout_id', activeWorkoutId);

  closeImportModal();
  checkWelcomeScreen();
  renderSubtabs();
  selectWorkoutSubtab(activeWorkoutId);
  showToast(`🎉 Create ${workoutKeys.length} schede dal testo con successo!`);
}

function openImportModal() {
  document.getElementById('importPreviewBox').style.display = 'none';
  document.getElementById('excelFileInput').value = '';
  if (document.getElementById('importPastedText')) document.getElementById('importPastedText').value = '';
  switchImportTab('file');
  document.getElementById('importModal').classList.add('active');
}

function closeImportModal() {
  document.getElementById('importModal').classList.remove('active');
}

function handleFileDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) processSpreadsheetFile(files[0]);
}

function handleExcelFileUpload(e) {
  const files = e.target.files;
  if (files.length > 0) processSpreadsheetFile(files[0]);
}

function processSpreadsheetFile(file) {
  const fileName = file.name.replace(/\.[^/.]+$/, "");
  document.getElementById('importRoutineName').value = fileName;

  const reader = new FileReader();

  if (file.name.toLowerCase().endsWith('.csv')) {
    reader.onload = (e) => {
      parseCSVContent(e.target.result);
    };
    reader.readAsText(file);
  } else {
    reader.onload = (e) => {
      try {
        if (typeof XLSX === 'undefined') {
          alert('Libreria Excel non ancora caricata. Riprova tra qualche secondo.');
          return;
        }
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        processTableRows(json);
      } catch (err) {
        alert('Errore nella lettura del file Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function parseCSVContent(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const f0 = lines[0] || '';
  const delim = f0.includes('\t') ? '\t' : (f0.includes(';') && (f0.match(/;/g) || []).length >= (f0.match(/,/g) || []).length ? ';' : ',');
  const rows = lines.map(line => {
    return splitCSVLine(line, delim);
    // Gestione base separatore virgola o tab
    if (line.includes('\t')) return line.split('\t').map(c => c.trim());
    return line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  });
  processTableRows(rows);
}

function processTableRows(rows) {
  if (!rows || rows.length < 2) {
    alert('Il file non contiene abbastanza dati o righe.');
    return;
  }

  // Trova la prima riga valida come intestazione
  importedHeaders = rows[0].map((h, i) => (h ? String(h).trim() : `Colonna_${i + 1}`));
  importedRawData = rows.slice(1).filter(r => r.some(cell => cell && String(cell).trim().length > 0));

  // Popola i selettori di colonna
  const exSel = document.getElementById('mapColExercise');
  const setsSel = document.getElementById('mapColSets');
  const repsSel = document.getElementById('mapColReps');
  const restSel = document.getElementById('mapColRest');

  [exSel, setsSel, repsSel, restSel].forEach(sel => {
    sel.innerHTML = '';
    importedHeaders.forEach((h, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${h} (Col ${idx + 1})`;
      sel.appendChild(opt);
    });
  });

  // Auto-rilevamento intelligente delle colonne
  importedHeaders.forEach((h, idx) => {
    const lower = h.toLowerCase();
    if (lower.includes('eserciz') || lower.includes('exercise') || lower.includes('nome')) exSel.value = idx;
    else if (lower.includes('serie') || lower.includes('set')) setsSel.value = idx;
    else if (lower.includes('rep') || lower.includes('ripetiz')) repsSel.value = idx;
    else if (lower.includes('recuper') || lower.includes('rest') || lower.includes('pausa')) restSel.value = idx;
  });

  renderImportPreviewTable();
  document.getElementById('importPreviewBox').style.display = 'block';
}

function renderImportPreviewTable() {
  const table = document.getElementById('importPreviewTable');
  table.innerHTML = '';

  const thead = document.createElement('thead');
  let headHtml = '<tr>';
  importedHeaders.forEach(h => headHtml += `<th style="text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--border-color); color: var(--accent);">${esc(h)}</th>`);
  headHtml += '</tr>';
  thead.innerHTML = headHtml;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  importedRawData.slice(0, 5).forEach(row => {
    let rowHtml = '<tr>';
    importedHeaders.forEach((_, idx) => {
      rowHtml += `<td style="padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-muted);">${esc(row[idx])}</td>`;
    });
    rowHtml += '</tr>';
    tbody.innerHTML += rowHtml;
  });
  table.appendChild(tbody);
}

function confirmImportedWorkout() {
  const routineName = document.getElementById('importRoutineName').value.trim() || 'Nuova Scheda';
  const exIdx = parseInt(document.getElementById('mapColExercise').value, 10);
  const setsIdx = parseInt(document.getElementById('mapColSets').value, 10);
  const repsIdx = parseInt(document.getElementById('mapColReps').value, 10);
  const restIdx = parseInt(document.getElementById('mapColRest').value, 10);

  const exercises = [];

  importedRawData.forEach((row, i) => {
    const name = row[exIdx] ? String(row[exIdx]).trim() : '';
    if (!name || name.toLowerCase().includes('mobilità') || name.toLowerCase().includes('riscaldamento')) return;

    let sets = 3;
    if (row[setsIdx]) {
      const parsedSets = parseInt(row[setsIdx], 10);
      if (!isNaN(parsedSets) && parsedSets > 0) sets = parsedSets;
    }

    let reps = '8/10';
    if (row[repsIdx]) reps = String(row[repsIdx]).trim();

    let rest = 90;
    if (row[restIdx]) {
      const parsedRest = parseInt(row[restIdx], 10);
      if (!isNaN(parsedRest) && parsedRest > 0) rest = parsedRest;
    }

    exercises.push({
      id: `imp_${Date.now()}_${i}`,
      name: name,
      sets: sets,
      targetReps: reps,
      rest: rest
    });
  });

  if (exercises.length === 0) {
    alert('Nessun esercizio rilevato con le colonne selezionate.');
    return;
  }

  const newId = 'routine_' + Date.now();
  userWorkouts[newId] = {
    id: newId,
    name: routineName,
    exercises: exercises
  };

  safeSet('gym_user_workouts', JSON.stringify(userWorkouts));
  activeWorkoutId = newId;
  safeSet('gym_active_workout_id', activeWorkoutId);

  closeImportModal();
  checkWelcomeScreen();
  renderSubtabs();
  selectWorkoutSubtab(newId);
  showToast(`🎉 Scheda "${routineName}" importata con ${exercises.length} esercizi!`);
}

// ==================== CORPO & MISURE (COMPOSIZIONE CORPOREA & PLICOMETRIA) ====================
function saveBodyProfile() {
  const gInput = document.getElementById('userGenderInput');
  const aInput = document.getElementById('userAgeInput');
  const hInput = document.getElementById('userHeightInput');

  if (gInput) bodyProfile.gender = gInput.value || 'male';
  if (aInput) bodyProfile.age = parseInt(aInput.value, 10) || null;
  if (hInput) bodyProfile.height = parseFloat(hInput.value) || null;

  safeSet('gym_body_profile', JSON.stringify(bodyProfile));
  renderBodyStats();
  showToast('Profilo fisico aggiornato!');
}

function handleWeightOrFatInput() {
  const fatInput = document.getElementById('newFatPctInput');
  const leanInput = document.getElementById('newLeanPctInput');
  const fatVal = parseFloat(fatInput.value);

  if (!isNaN(fatVal) && fatVal > 0 && fatVal < 100) {
    leanInput.value = (100 - fatVal).toFixed(1);
  } else {
    leanInput.value = '';
  }
}

// Modal Plicometria (Jackson-Pollock 3 Pliche)
let currentCalculatedBf = null;

function openPlicoModal() {
  const gender = bodyProfile.gender || 'male';
  const hintEl = document.getElementById('plicoFormGenderHint');
  const l1 = document.getElementById('plicoLabel1');
  const l2 = document.getElementById('plicoLabel2');
  const l3 = document.getElementById('plicoLabel3');

  if (gender === 'male') {
    hintEl.textContent = 'Pliche per Uomo: Pettorale, Addome, Coscia';
    l1.textContent = 'Plica 1 - Pettorale (mm):';
    l2.textContent = 'Plica 2 - Addome (mm):';
    l3.textContent = 'Plica 3 - Coscia (mm):';
  } else {
    hintEl.textContent = 'Pliche per Donna: Tricipite, Sovrailiaca, Coscia';
    l1.textContent = 'Plica 1 - Tricipite (mm):';
    l2.textContent = 'Plica 2 - Sovrailiaca (mm):';
    l3.textContent = 'Plica 3 - Coscia (mm):';
  }

  // Reset inputs
  document.getElementById('plicoVal1').value = '';
  document.getElementById('plicoVal2').value = '';
  document.getElementById('plicoVal3').value = '';
  document.getElementById('plicoResultBf').textContent = '-- %';
  document.getElementById('plicoResultDetails').textContent = 'Inserisci le 3 pliche per calcolare';
  currentCalculatedBf = null;

  document.getElementById('plicoModal').classList.add('active');
}

function closePlicoModal() {
  document.getElementById('plicoModal').classList.remove('active');
}

function runPlicometryCalculation() {
  const p1 = parseFloat(document.getElementById('plicoVal1').value) || 0;
  const p2 = parseFloat(document.getElementById('plicoVal2').value) || 0;
  const p3 = parseFloat(document.getElementById('plicoVal3').value) || 0;

  if (p1 <= 0 || p2 <= 0 || p3 <= 0) {
    document.getElementById('plicoResultBf').textContent = '-- %';
    document.getElementById('plicoResultDetails').textContent = 'Inserisci tutti e 3 i valori in mm';
    currentCalculatedBf = null;
    return;
  }

  const sum = p1 + p2 + p3;
  const gender = bodyProfile.gender || 'male';
  const age = bodyProfile.age;
  if (!age) { document.getElementById('plicoResultBf').textContent = '-- %'; document.getElementById('plicoResultDetails').textContent = "Imposta prima l'età nel Profilo Fisico"; currentCalculatedBf = null; return; }

  let bodyDensity = 0;
  if (gender === 'male') {
    // Jackson-Pollock 3-site Men (Chest, Abdomen, Thigh)
    bodyDensity = 1.10938 - (0.0008267 * sum) + (0.0000016 * sum * sum) - (0.0002574 * age);
  } else {
    // Jackson-Pollock 3-site Women (Triceps, Suprailiac, Thigh)
    bodyDensity = 1.0994921 - (0.0009929 * sum) + (0.0000023 * sum * sum) - (0.0001392 * age);
  }

  // Formula di Siri per % Massa Grassa
  let bf = ((4.95 / bodyDensity) - 4.5) * 100;
  bf = Math.max(3.5, Math.min(55, bf));
  currentCalculatedBf = parseFloat(bf.toFixed(1));

  document.getElementById('plicoResultBf').textContent = `${currentCalculatedBf} %`;

  // Stima kg se il peso è inserito
  const wInput = document.getElementById('newWeightInput');
  const currentW = parseFloat(wInput ? wInput.value : 0);
  if (currentW > 0) {
    const fatKg = (currentW * (currentCalculatedBf / 100)).toFixed(1);
    const leanKg = (currentW - fatKg).toFixed(1);
    document.getElementById('plicoResultDetails').textContent = `Somma pliche: ${sum} mm | Massa grassa: ~${fatKg} kg | Massa magra: ~${leanKg} kg`;
  } else {
    document.getElementById('plicoResultDetails').textContent = `Somma pliche: ${sum} mm (Jackson-Pollock 3)`;
  }
}

function applyPlicometryResult() {
  if (currentCalculatedBf === null) {
    alert('Calcola prima il valore inserendo le 3 pliche.');
    return;
  }

  const fatInput = document.getElementById('newFatPctInput');
  if (fatInput) {
    fatInput.value = currentCalculatedBf;
    handleWeightOrFatInput();
  }

  closePlicoModal();
  showToast(`% Grasso (${currentCalculatedBf}%) applicata!`);
}

function logNewWeight() {
  const wInput = document.getElementById('newWeightInput');
  const dInput = document.getElementById('newWeightDate');
  const fatInput = document.getElementById('newFatPctInput');
  const nInput = document.getElementById('newWeightNote');

  const weight = parseFloat(wInput.value);
  if (!weight || weight <= 0) {
    alert('Inserisci un peso valido in kg.');
    return;
  }

  const date = dInput.value || localDateStr();
  const note = nInput ? nInput.value.trim() : '';

  const fatPct = parseFloat(fatInput.value) || null;
  let leanPct = null;
  let fatKg = null;
  let leanKg = null;

  if (fatPct && fatPct > 0) {
    leanPct = parseFloat((100 - fatPct).toFixed(1));
    fatKg = parseFloat(((weight * fatPct) / 100).toFixed(1));
    leanKg = parseFloat((weight - fatKg).toFixed(1));
  }

  const entry = {
    id: Date.now(),
    date: date,
    weight: weight,
    fatPct: fatPct,
    leanPct: leanPct,
    fatKg: fatKg,
    leanKg: leanKg,
    note: note
  };

  if (!bodyProfile.weights) bodyProfile.weights = [];
  bodyProfile.weights.unshift(entry);
  bodyProfile.weights.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  safeSet('gym_body_profile', JSON.stringify(bodyProfile));

  wInput.value = '';
  if (fatInput) fatInput.value = '';
  if (document.getElementById('newLeanPctInput')) document.getElementById('newLeanPctInput').value = '';
  if (nInput) nInput.value = '';

  renderBodyStats();
  showToast(`Rilevazione salvata: ${weight} kg!`);
}

function renderBodyStats() {
  // Profilo Anagrafico
  if (document.getElementById('userGenderInput')) {
    document.getElementById('userGenderInput').value = bodyProfile.gender || 'male';
  }
  if (document.getElementById('userAgeInput')) {
    document.getElementById('userAgeInput').value = bodyProfile.age || '';
  }
  if (document.getElementById('userHeightInput')) {
    document.getElementById('userHeightInput').value = bodyProfile.height || '';
  }

  const weights = bodyProfile.weights || [];
  const lastWeightEl = document.getElementById('lastWeightDisplay');
  const lastFatEl = document.getElementById('lastFatDisplay');
  const bmiEl = document.getElementById('userBmiDisplay');
  const listEl = document.getElementById('weightHistoryList');

  if (weights.length > 0) {
    const latest = weights[0];
    if (lastWeightEl) lastWeightEl.textContent = `${latest.weight} kg`;
    if (lastFatEl) lastFatEl.textContent = latest.fatPct ? `${latest.fatPct}%` : '-- %';

    // BMI
    if (bodyProfile.height && bodyProfile.height > 0) {
      const hM = bodyProfile.height / 100;
      const bmi = (latest.weight / (hM * hM)).toFixed(1);
      if (bmiEl) bmiEl.textContent = `${bmi} (${getBmiLabel(bmi)})`;
    }
  } else {
    if (lastWeightEl) lastWeightEl.textContent = '-- kg';
    if (lastFatEl) lastFatEl.textContent = '-- %';
    if (bmiEl) bmiEl.textContent = '--';
  }

  // Storico rilevazioni
  if (listEl) {
    if (weights.length === 0) {
      listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 14px;">Nessuna pesata registrata finora.</div>`;
      return;
    }

    let html = '';
    weights.forEach((w, idx) => {
      let deltaKgStr = '';
      let deltaFatStr = '';

      if (idx < weights.length - 1) {
        const prev = weights[idx + 1];
        const diffW = (w.weight - prev.weight).toFixed(1);
        if (diffW > 0) deltaKgStr = `<span style="color: var(--hard-border); font-size: 0.72rem;">+${diffW}kg 📈</span>`;
        else if (diffW < 0) deltaKgStr = `<span style="color: var(--easy-border); font-size: 0.72rem;">${diffW}kg 📉</span>`;
        else deltaKgStr = `<span style="color: var(--text-muted); font-size: 0.72rem;">=</span>`;

        if (w.fatPct && prev.fatPct) {
          const diffF = (w.fatPct - prev.fatPct).toFixed(1);
          if (diffF < 0) deltaFatStr = `<span style="color: var(--easy-border); font-size: 0.72rem;">(${diffF}% grasso 🔥)</span>`;
          else if (diffF > 0) deltaFatStr = `<span style="color: var(--hard-border); font-size: 0.72rem;">(+${diffF}% grasso)</span>`;
        }
      }

      const compDetails = w.fatPct 
        ? `<div style="font-size: 0.75rem; color: var(--orange); margin-top: 2px;">
             Grasso: <strong>${w.fatPct}%</strong> ${w.fatKg ? `(~${w.fatKg}kg)` : ''} | Magra: <strong>${w.leanPct}%</strong> ${w.leanKg ? `(~${w.leanKg}kg)` : ''} ${deltaFatStr}
           </div>`
        : '';

      html += `
        <div style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <div>
              <strong style="color: #fff; font-size: 0.95rem;">${w.weight} kg</strong> ${deltaKgStr}
            </div>
            <div style="color: var(--text-muted); font-size: 0.78rem;">
              📅 ${w.date} <button class="action-btn btn-secondary" style="padding:2px 6px;font-size:.7rem" onclick="deleteWeight(${w.id})">🗑️</button>
            </div>
          </div>
          ${compDetails}
          ${w.note ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px;">📝 ${esc(w.note)}</div>` : ''}
        </div>
      `;
    });
    listEl.innerHTML = html;
  }
}

function getBmiLabel(bmi) {
  if (bmi < 18.5) return 'Sottopeso';
  if (bmi < 25) return 'Normopeso';
  if (bmi < 30) return 'Sovrappeso';
  return 'Obeso';
}

// ==================== NAVIGAZIONE TABS PRINCIPALI ====================
function switchMainTab(tab) {
  document.querySelectorAll('.bottom-nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  ['home', 'workouts', 'calendar', 'analytics', 'body'].forEach(t => {
    const el = document.getElementById('view' + t[0].toUpperCase() + t.slice(1));
    if (el) el.classList.toggle('active', t === tab);
  });
  document.body.classList.toggle('on-home', tab === 'home');
  if (tab === 'workouts') keepAwake();
  else if (wakeLock) { wakeLock.release(); wakeLock = null; }
  if (tab === 'home') renderHome();
  if (tab === 'calendar') renderCalendar();
  if (tab === 'analytics') renderAnalytics();
  if (tab === 'body') renderBodyStats();
  window.scrollTo(0, 0);
}

function renderHome() {
  const el = document.getElementById('homeSummary');
  if (!el) return;
  const n = Object.keys(userWorkouts).length;
  const last = workoutHistory[0];
  el.textContent = (n ? `${n} ${n === 1 ? 'scheda caricata' : 'schede caricate'}` : 'Nessuna scheda ancora') +
    ` • ${workoutHistory.length} sedute` + (last ? ` • ultima: ${last.date.split('-').reverse().join('/')}` : '');
}

// ==================== ESPORTAZIONI & BACKUP ====================
function copyAllHistory() {
  if (workoutHistory.length === 0) {
    alert('Nessun dato nello storico da copiare.');
    return;
  }

  let tsv = "Data\tOra\tAttività\tEsercizio\tSerie\tCarico_Kg\tRipetizioni\tDifficoltà\n";
  workoutHistory.forEach(entry => {
    if (entry.exercises && entry.exercises.length > 0) {
      entry.exercises.forEach(ex => {
        ex.sets.forEach(s => {
          const diffText = s.diff === 'easy' ? '🟢 Facile' : s.diff === 'med' ? '🟡 Medio' : s.diff === 'hard' ? '🔴 Difficile' : '';
          tsv += `${entry.date}\t${entry.time || ''}\t${entry.workout}\t${ex.name}\t${s.setNum}\t${s.kg}\t${s.reps}\t${diffText}\n`;
        });
      });
    } else {
      const diffText = entry.diff === 'easy' ? '🟢 Facile' : entry.diff === 'med' ? '🟡 Medio' : entry.diff === 'hard' ? '🔴 Difficile' : '';
      tsv += `${entry.date}\t${entry.time || ''}\t${entry.workout}\t${entry.notes || ''}\t-\t-\t-\t${diffText}\n`;
    }
  });

  navigator.clipboard.writeText(tsv).then(() => {
    showToast('📋 Storico copiato per Google Fogli!');
  });
}

function exportCSV() {
  let csv = "Data,Ora,Attivita,Esercizio,Serie,Carico_Kg,Ripetizioni,Difficolta,Note\n";
  workoutHistory.forEach(entry => {
    if (entry.exercises && entry.exercises.length > 0) {
      entry.exercises.forEach(ex => {
        ex.sets.forEach(s => {
          const diffText = s.diff === 'easy' ? 'Facile' : s.diff === 'med' ? 'Medio' : s.diff === 'hard' ? 'Difficile' : '';
          csv += `"${entry.date}","${entry.time || ''}","${entry.workout}","${ex.name}",${s.setNum},${s.kg},${s.reps},"${diffText}",""\n`;
        });
      });
    } else {
      const diffText = entry.diff === 'easy' ? 'Facile' : entry.diff === 'med' ? 'Medio' : entry.diff === 'hard' ? 'Difficile' : '';
      csv += `"${entry.date}","${entry.time || ''}","${entry.workout}","-",0,0,0,"${diffText}","${entry.notes || ''}"\n`;
    }
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `allenamenti_export_${localDateStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('💾 File CSV scaricato!');
}

function clearAllHistory() {
  if (!confirm('Vuoi davvero cancellare TUTTO lo storico allenamenti?')) return;
  workoutHistory = [];
  localStorage.removeItem('gym_workout_history');
  renderCalendar();
  renderAnalytics();
  showToast('Storico cancellato.');
}

// ==================== HELPERS ====================
function initNetworkStatus() {
  const badge = document.getElementById('connectionStatus');
  function update() {
    if (navigator.onLine) {
      badge.textContent = '🟢 Pronto Offline';
      badge.classList.remove('offline');
    } else {
      badge.textContent = '⚡ Modalità Offline';
      badge.classList.add('offline');
    }
  }
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .catch(err => console.log('SW error:', err));
    });
  }
}

// ==================== AGGIUNTE v10 ====================
function deleteHistoryEntry(id) {
  if (!confirm('Eliminare questa seduta?')) return;
  workoutHistory = workoutHistory.filter(w => w.id !== id);
  safeSet('gym_workout_history', JSON.stringify(workoutHistory));
  renderCalendar(); renderAnalytics();
}
function deleteWeight(id) {
  if (!confirm('Eliminare questa rilevazione?')) return;
  bodyProfile.weights = (bodyProfile.weights || []).filter(w => w.id !== id);
  safeSet('gym_body_profile', JSON.stringify(bodyProfile));
  renderBodyStats();
}
function fillLoadsForDate() {
  const type = document.getElementById('calLogTypeSelect').value;
  let target;
  if (type === 'pesi') {
    const rId = document.getElementById('calLogRoutineSelect').value;
    target = userWorkouts[rId] ? rId : 'free_pesi';
  } else if (type === 'calisthenics') target = 'calisthenics';
  else { alert('Per "Altro" usa "Salva nel Calendario".'); return; }
  sessionDateOverride = calSelectedDateStr;
  closeCalendarLogModal();
  switchMainTab('workouts');
  checkWelcomeScreen();
  selectWorkoutSubtab(target);
  showSessionBanner();
}
function showSessionBanner() {
  const b = document.getElementById('sessionDateBanner');
  if (!b || !sessionDateOverride) return;
  b.style.display = 'flex';
  b.querySelector('span').textContent = '📅 Stai registrando la seduta del ' + sessionDateOverride.split('-').reverse().join('/');
}
function hideSessionBanner() {
  const b = document.getElementById('sessionDateBanner');
  if (b) b.style.display = 'none';
}
function cancelSessionDate() { sessionDateOverride = null; hideSessionBanner(); }

const BACKUP_KEYS = ['gym_user_workouts', 'gym_active_workout_id', 'gym_active_session_inputs', 'gym_active_warmup', 'gym_cali_exercises', 'gym_workout_history', 'gym_body_profile'];
function exportBackup() {
  const out = { app: 'gymtracker', version: 1, exportedAt: new Date().toISOString(), data: {} };
  BACKUP_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null) out.data[k] = v; });
  const url = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = `gymtracker_backup_${localDateStr()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  showToast('💾 Backup scaricato');
}
function importBackup(ev) {
  const f = ev.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const o = JSON.parse(r.result);
      if (o.app !== 'gymtracker' || !o.data) throw new Error('bad');
      if (!confirm('Il ripristino sostituisce TUTTI i dati attuali. Continuare?')) return;
      BACKUP_KEYS.forEach(k => localStorage.removeItem(k));
      Object.entries(o.data).forEach(([k, v]) => { if (BACKUP_KEYS.includes(k)) safeSet(k, v); });
      location.reload();
    } catch (e) { alert('File di backup non valido.'); }
  };
  r.readAsText(f);
}

// ==================== AGGIUNTE v11 (suggerimenti e velocità) ====================
function getLastSets(name) {
  for (const e of workoutHistory) {
    if (!e.exercises) continue;
    const m = e.exercises.find(x => x.name === name);
    if (m && m.sets && m.sets.length) {
      const l = m.sets.filter(x => x.kg || x.reps);
      if (l.length) return l;
    }
  }
  return null;
}
function phKg(n, s, d) { const l = getLastSets(n); if (!l) return d; const x = l[s - 1] || l[l.length - 1]; return x.kg ? x.kg : d; }
function phReps(n, s) { const l = getLastSets(n); if (!l) return 'Reps'; const x = l[s - 1] || l[l.length - 1]; return x.reps ? x.reps : 'Reps'; }
function copyLastSets(exId) {
  const isFree = activeWorkoutId === 'calisthenics' || activeWorkoutId === 'free_pesi';
  const w = userWorkouts[activeWorkoutId];
  const ex = (isFree ? caliExercises : (w ? w.exercises : [])).find(e => e.id === exId);
  if (!ex) return;
  const l = getLastSets(ex.name);
  if (!l) { showToast('Nessun dato della volta scorsa'); return; }
  const key = isFree ? freeKey() : activeWorkoutId;
  if (!activeSessionInputs[key]) activeSessionInputs[key] = {};
  for (let i = 1; i <= ex.sets; i++) {
    const src = l[i - 1] || l[l.length - 1];
    const k = `${ex.id}_s${i}`;
    const cur = activeSessionInputs[key][k] || { diff: '' };
    activeSessionInputs[key][k] = { kg: src.kg || '', reps: src.reps || '', diff: cur.diff || '' };
  }
  saveActiveSession();
  if (isFree) renderCalisthenics(); else renderActiveWorkoutView();
  showToast('↻ Valori della volta scorsa inseriti');
}
function lastBtn(ex) {
  return getLastSets(ex.name) ? `<button style="background: var(--bg-input); border: 1px solid var(--accent); color: var(--accent); border-radius: 6px; padding: 2px 8px; font-size: 0.72rem; cursor: pointer;" onclick="copyLastSets('${ex.id}')">↻ Come ultima volta</button>` : '';
}
function refreshExerciseSuggestions() {
  const dl = document.getElementById('exerciseSuggestions');
  if (!dl) return;
  const names = new Set();
  workoutHistory.forEach(w => (w.exercises || []).forEach(e => names.add(e.name)));
  Object.values(userWorkouts).forEach(w => w.exercises.forEach(e => names.add(e.name)));
  Object.values(EXERCISE_LIBRARY).forEach(a => a.forEach(n => names.add(n)));
  dl.innerHTML = [...names].sort((a, b) => a.localeCompare(b, 'it')).map(n => `<option value="${esc(n)}">`).join('');
}
function startWithFreePesi() {
  activeWorkoutId = 'free_pesi';
  checkWelcomeScreen(); renderSubtabs();
  selectWorkoutSubtab('free_pesi');
  switchMainTab('workouts');
}
let wakeLock = null;
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && document.getElementById('viewWorkouts').classList.contains('active')) keepAwake();
});

function saveFreeAsRoutine() {
  if (!caliExercises.length) { alert('Aggiungi prima qualche esercizio alla lavagna.'); return; }
  const name = (prompt('Nome della nuova scheda?', freeCategory === 'pesi' ? 'Scheda libera' : 'Scheda calisthenics') || '').trim();
  if (!name) return;
  const id = 'routine_' + Date.now();
  userWorkouts[id] = {
    id, name,
    exercises: caliExercises.map((e, i) => {
      const l = getLastSets(e.name);
      return { id: `ex_${Date.now()}_${i}`, name: e.name, sets: e.sets, targetReps: (l && l[0] && l[0].reps) ? String(l[0].reps) : '8/10', rest: e.rest || 90 };
    })
  };
  safeSet('gym_user_workouts', JSON.stringify(userWorkouts));
  activeWorkoutId = id;
  checkWelcomeScreen(); renderSubtabs(); selectWorkoutSubtab(id);
  showToast(`📌 Scheda "${name}" salvata!`);
}
