import './styles.css';
// Voxa Web — controller converted from Chrome Extension APIs to browser Web APIs.

const DEFAULT_SETTINGS = {
  voiceName: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  repeatCount: 1,
  theme: 'light' // light | dark | auto
};

const STORAGE_KEY = 'voxa-settings';
const REPEAT_GAP_MS = 250;

// Elements
const app = document.querySelector('.app');
const textInput = document.getElementById('textInput');
const charCount = document.getElementById('charCount');
const voiceSelect = document.getElementById('voiceSelect');
const voiceCount = document.getElementById('voiceCount');
const rateSlider = document.getElementById('rateSlider');
const rateValue = document.getElementById('rateValue');
const pitchSlider = document.getElementById('pitchSlider');
const pitchValue = document.getElementById('pitchValue');
const repeatSelect = document.getElementById('repeatSelect');
const repeatValue = document.getElementById('repeatValue');
const speakBtn = document.getElementById('speakBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const statusPill = document.getElementById('statusPill');
const statusText = statusPill.querySelector('.status-text');
const practiceCards = document.querySelectorAll('.practice-card');
const themeToggle = document.getElementById('themeToggle');

const THEME_ORDER = ['light', 'dark', 'auto'];
const THEME_LABELS = { dark: 'Dark mode', light: 'Light mode', auto: 'Auto (system)' };

let currentState = 'idle';
let currentUtterance = null;
let availableVoices = [];
let playbackSessionId = 0;
let activeText = '';
let activeRepeatCount = 1;
let activeRepeatIndex = 0;

const speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

// ============ STORAGE ============

function getSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

function setSettings(partial) {
  const next = { ...getSettings(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

// ============ STATE MANAGEMENT ============

function setState(state) {
  currentState = state;
  app.dataset.state = state;

  switch (state) {
    case 'idle':
      statusText.textContent = getStatusText(state);
      speakBtn.disabled = !speechSupported;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      textInput.disabled = false;
      voiceSelect.disabled = !speechSupported || availableVoices.length === 0;
      rateSlider.disabled = !speechSupported;
      pitchSlider.disabled = !speechSupported;
      repeatSelect.disabled = !speechSupported;
      practiceCards.forEach((card) => { card.disabled = !speechSupported; });
      updatePauseButton(false);
      break;

    case 'loading':
      statusText.textContent = getStatusText(state);
      speakBtn.disabled = true;
      pauseBtn.disabled = true;
      stopBtn.disabled = false;
      textInput.disabled = true;
      voiceSelect.disabled = true;
      rateSlider.disabled = true;
      pitchSlider.disabled = true;
      repeatSelect.disabled = true;
      practiceCards.forEach((card) => { card.disabled = true; });
      break;

    case 'speaking':
      statusText.textContent = getStatusText(state);
      speakBtn.disabled = true;
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
      textInput.disabled = true;
      voiceSelect.disabled = true;
      rateSlider.disabled = true;
      pitchSlider.disabled = true;
      repeatSelect.disabled = true;
      practiceCards.forEach((card) => { card.disabled = true; });
      updatePauseButton(false);
      break;

    case 'paused':
      statusText.textContent = getStatusText(state);
      speakBtn.disabled = true;
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
      textInput.disabled = true;
      voiceSelect.disabled = true;
      rateSlider.disabled = true;
      pitchSlider.disabled = true;
      repeatSelect.disabled = true;
      practiceCards.forEach((card) => { card.disabled = true; });
      updatePauseButton(true);
      break;

    default:
      setState('idle');
  }

  updateMediaSession();
}

function updatePauseButton(isPaused) {
  pauseBtn.innerHTML = isPaused
    ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2.5l8 4.5-8 4.5v-9z" fill="currentColor"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="2" width="3" height="10" fill="currentColor"/><rect x="8" y="2" width="3" height="10" fill="currentColor"/></svg>';
}

function getPlaybackProgressLabel() {
  if (activeRepeatCount === 0 && activeRepeatIndex > 0) return ` ${activeRepeatIndex}`;
  if (activeRepeatCount > 1) return ` ${activeRepeatIndex}/${activeRepeatCount}`;
  return '';
}

function getStatusText(state) {
  const progress = getPlaybackProgressLabel();

  switch (state) {
    case 'idle':
      return speechSupported ? 'Ready' : 'Unsupported';
    case 'loading':
      return `Loading${progress}`;
    case 'speaking':
      return `Speaking${progress}`;
    case 'paused':
      return `Paused${progress}`;
    default:
      return 'Ready';
  }
}

// ============ VOICES ============

function voiceScore(voice) {
  const name = (voice.name || '').toLowerCase();
  const lang = (voice.lang || '').toLowerCase();

  if (name.includes('google') && lang === 'en-us') return 0;
  if (name.includes('google')) return 1;
  if (name.includes('natural') || name.includes('neural')) return 2;
  if (name.includes('microsoft')) return 3;
  if (lang.startsWith('en')) return 4;
  return 5;
}

function loadVoices() {
  if (!speechSupported) {
    voiceSelect.innerHTML = '<option>Speech synthesis is not supported in this browser</option>';
    voiceCount.textContent = 'Unsupported';
    setState('idle');
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices
    .filter((voice) => voice.lang && voice.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => voiceScore(a) - voiceScore(b) || a.name.localeCompare(b.name));

  availableVoices = englishVoices;
  voiceSelect.innerHTML = '';

  if (englishVoices.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'Loading English voices…';
    voiceSelect.appendChild(option);
    voiceCount.textContent = 'Loading';
    voiceSelect.disabled = true;
    return;
  }

  englishVoices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.name;
    const name = voice.name.toLowerCase();
    let prefix = '';
    if (name.includes('google')) prefix = '◆ ';
    else if (/natural|neural/i.test(voice.name)) prefix = '◇ ';
    option.textContent = `${prefix}${voice.name}  ·  ${voice.lang}`;
    voiceSelect.appendChild(option);
  });

  voiceCount.textContent = `${englishVoices.length} available`;

  const settings = getSettings();
  const savedVoice = englishVoices.find((voice) => voice.name === settings.voiceName);
  const googleUS = englishVoices.find((voice) => voice.name.toLowerCase().includes('google') && voice.lang.toLowerCase() === 'en-us');

  voiceSelect.value = (savedVoice || googleUS || englishVoices[0]).name;
  saveSettings();
  setState(currentState === 'idle' ? 'idle' : currentState);
}

function getSelectedVoice() {
  return availableVoices.find((voice) => voice.name === voiceSelect.value) || availableVoices[0] || null;
}

// ============ SETTINGS ============

function loadSettings() {
  const settings = getSettings();
  rateSlider.value = settings.rate;
  rateValue.textContent = `${Number(settings.rate).toFixed(2)}×`;
  pitchSlider.value = settings.pitch;
  pitchValue.textContent = Number(settings.pitch).toFixed(1);
  repeatSelect.value = String(normalizeRepeatCount(settings.repeatCount));
  updateRepeatValue();
  applyTheme(settings.theme || 'light');
}

function normalizeRepeatCount(value) {
  const count = Number.parseInt(value, 10);
  return [0, 1, 2, 3, 5, 10].includes(count) ? count : 1;
}

function formatRepeatCount(count) {
  if (count === 0) return 'Loop';
  if (count === 1) return 'Off';
  return `${count}x`;
}

function updateRepeatValue() {
  repeatValue.textContent = formatRepeatCount(normalizeRepeatCount(repeatSelect.value));
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.title = THEME_LABELS[theme];
}

function cycleTheme() {
  const current = document.documentElement.dataset.theme || 'light';
  const idx = THEME_ORDER.indexOf(current);
  const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  applyTheme(next);
  setSettings({ theme: next });
}

function saveSettings() {
  setSettings({
    voiceName: voiceSelect.value,
    rate: Number.parseFloat(rateSlider.value),
    pitch: Number.parseFloat(pitchSlider.value),
    volume: 1.0,
    repeatCount: normalizeRepeatCount(repeatSelect.value)
  });
}

// ============ MEDIA SESSION ============

function setMediaSessionAction(action, handler) {
  if (!('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch (_) {
    // Browsers expose different Media Session action sets.
  }
}

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.playbackState =
      currentState === 'speaking' || (currentState === 'loading' && activeText) ? 'playing' :
      currentState === 'paused' ? 'paused' :
      'none';

    if ('MediaMetadata' in window) {
      const title = activeText
        ? `${activeText.slice(0, 64)}${activeText.length > 64 ? '...' : ''}`
        : 'Voxa';

      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: 'Native Voice Studio',
        album: activeRepeatCount === 1 ? 'Text to speech' : `Repeat ${formatRepeatCount(activeRepeatCount)}`,
        artwork: [
          { src: '/icons/icon128.png', sizes: '128x128', type: 'image/png' }
        ]
      });
    }
  } catch (_) {
    // Media Session is best-effort and should never block speech playback.
  }
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;

  setMediaSessionAction('play', () => {
    if (currentState === 'paused') {
      pauseOrResume();
      return;
    }

    if (currentState === 'idle') {
      speak(textInput.value);
    }
  });
  setMediaSessionAction('pause', () => {
    if (currentState === 'speaking') pauseOrResume();
  });
  setMediaSessionAction('stop', () => {
    if (currentState !== 'idle') stopSpeaking();
  });
}

// ============ ACTIONS ============

function createUtterance(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  const selectedVoice = getSelectedVoice();
  const settings = getSettings();

  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang || 'en-US';
  } else {
    utterance.lang = 'en-US';
  }

  utterance.rate = Number(settings.rate) || 1;
  utterance.pitch = Number(settings.pitch) || 1;
  utterance.volume = Number(settings.volume) || 1;

  return utterance;
}

function resetActivePlayback() {
  currentUtterance = null;
  activeText = '';
  activeRepeatCount = 1;
  activeRepeatIndex = 0;
}

function finishPlayback(sessionId) {
  if (sessionId !== playbackSessionId) return;

  resetActivePlayback();
  setState('idle');
}

function playCurrentRepeat(sessionId) {
  if (sessionId !== playbackSessionId || !activeText) return;

  activeRepeatIndex += 1;
  setState('loading');

  const utterance = createUtterance(activeText);

  utterance.onstart = () => {
    if (sessionId === playbackSessionId) setState('speaking');
  };
  utterance.onend = () => {
    if (sessionId !== playbackSessionId) return;

    currentUtterance = null;
    const shouldContinue = activeRepeatCount === 0 || activeRepeatIndex < activeRepeatCount;

    if (shouldContinue) {
      setState('loading');
      window.setTimeout(() => playCurrentRepeat(sessionId), REPEAT_GAP_MS);
      return;
    }

    finishPlayback(sessionId);
  };
  utterance.onerror = (event) => {
    if (sessionId !== playbackSessionId) return;

    console.error('Speech synthesis error:', event.error);
    finishPlayback(sessionId);
  };
  utterance.onpause = () => {
    if (sessionId === playbackSessionId) setState('paused');
  };
  utterance.onresume = () => {
    if (sessionId === playbackSessionId) setState('speaking');
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);

  // Some browsers delay or skip `onstart` for local voices. Keep UI from being stuck in loading.
  window.setTimeout(() => {
    if (sessionId === playbackSessionId && currentState === 'loading' && window.speechSynthesis.speaking) {
      setState('speaking');
    }
  }, 300);
}

function speak(text) {
  const cleanText = text.trim();
  if (!cleanText) {
    textInput.focus();
    return;
  }

  if (!speechSupported) {
    statusText.textContent = 'Unsupported';
    return;
  }

  saveSettings();
  playbackSessionId += 1;
  activeText = cleanText;
  activeRepeatCount = normalizeRepeatCount(repeatSelect.value);
  activeRepeatIndex = 0;
  window.speechSynthesis.cancel();
  playCurrentRepeat(playbackSessionId);
}

function pauseOrResume() {
  if (!speechSupported) return;

  if (currentState === 'paused') {
    window.speechSynthesis.resume();
    setState('speaking');
  } else if (currentState === 'speaking') {
    window.speechSynthesis.pause();
    setState('paused');
  }
}

function stopSpeaking() {
  if (!speechSupported) return;
  playbackSessionId += 1;
  window.speechSynthesis.cancel();
  resetActivePlayback();
  setState('idle');
}

// ============ EVENT HANDLERS ============

textInput.addEventListener('input', () => {
  const len = textInput.value.length;
  charCount.textContent = `${len} character${len === 1 ? '' : 's'}`;
});

rateSlider.addEventListener('input', () => {
  rateValue.textContent = `${Number.parseFloat(rateSlider.value).toFixed(2)}×`;
  saveSettings();
});

pitchSlider.addEventListener('input', () => {
  pitchValue.textContent = Number.parseFloat(pitchSlider.value).toFixed(1);
  saveSettings();
});

repeatSelect.addEventListener('change', () => {
  updateRepeatValue();
  saveSettings();
});

voiceSelect.addEventListener('change', saveSettings);
themeToggle.addEventListener('click', cycleTheme);
speakBtn.addEventListener('click', () => speak(textInput.value));
pauseBtn.addEventListener('click', pauseOrResume);
stopBtn.addEventListener('click', stopSpeaking);

practiceCards.forEach((card) => {
  card.addEventListener('click', () => {
    if (currentState !== 'idle') return;
    const text = card.dataset.text || '';
    textInput.value = text;
    charCount.textContent = `${text.length} characters`;
    speak(text);
  });
});

textInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    if (currentState === 'idle') speak(textInput.value);
  }
});

window.addEventListener('beforeunload', () => {
  if (speechSupported) window.speechSynthesis.cancel();
});

if (speechSupported) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// ============ INIT ============

loadSettings();
setupMediaSession();
loadVoices();
setTimeout(loadVoices, 200);
setTimeout(loadVoices, 1000);
setState('idle');
