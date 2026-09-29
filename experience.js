(function () {
  const soundKey = 'yomi-entry-sound-v1';
  const mode = document.getElementById('entrySoundMode');
  const fileInput = document.getElementById('entrySoundFile');
  const status = document.getElementById('entrySoundStatus');
  const soundDialog = document.getElementById('entrySoundDialog');
  const intro = document.getElementById('entryScene');
  let savedAudio = null, savedUrl = null, playing = null, context = null, introTimer = null;
  const getMode = () => localStorage.getItem(soundKey) || 'off';
  const setStatus = message => { status.textContent = message; };

  function openAudioDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('yomi-local-audio-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function readAudio() {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readonly');
      const request = transaction.objectStore('files').get('entry');
      request.onsuccess = () => { resolve(request.result || null); db.close(); };
      request.onerror = () => { reject(request.error); db.close(); };
    });
  }
  async function storeAudio(file) {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      transaction.objectStore('files').put(file, 'entry');
      transaction.oncomplete = () => { resolve(); db.close(); };
      transaction.onerror = () => { reject(transaction.error); db.close(); };
    });
  }
  function prepareAudio(file) {
    if (savedUrl) URL.revokeObjectURL(savedUrl);
    savedUrl = URL.createObjectURL(file);
    savedAudio = new Audio(savedUrl);
    savedAudio.preload = 'auto';
    savedAudio.volume = .55;
  }
  function stopSound() {
    if (playing) { playing.pause(); playing.currentTime = 0; playing = null; }
    if (context) { context.close().catch(() => {}); context = null; }
  }
  function gentleMusic() {
    stopSound();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    context = new AudioContextClass();
    const activeContext = context, start = activeContext.currentTime + .03;
    activeContext.resume().catch(() => {});
    [523.25, 659.25, 783.99, 659.25, 587.33, 523.25].forEach((pitch, index) => {
      const oscillator = activeContext.createOscillator();
      const gain = activeContext.createGain();
      const at = start + index * .8;
      oscillator.type = 'sine'; oscillator.frequency.value = pitch;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.075, at + .09);
      gain.gain.exponentialRampToValueAtTime(.001, at + 1.35);
      oscillator.connect(gain).connect(activeContext.destination);
      oscillator.start(at); oscillator.stop(at + 1.38);
    });
    setTimeout(() => { if (context === activeContext) stopSound(); }, 6500);
  }
  function startSound() {
    const choice = getMode();
    if (choice === 'gentle') gentleMusic();
    if (choice === 'recording' && savedAudio) {
      stopSound();
      savedAudio.currentTime = 0;
      playing = savedAudio;
      savedAudio.play().catch(() => { playing = null; setStatus('اضغطي «جرّبي الصوت» لبدء التشغيل على هذا الجهاز.'); });
    }
  }
  function updateStatus() {
    setStatus(getMode() === 'recording' && !savedAudio
      ? 'اختاري تسجيلًا من جهازك أولًا. لن يشتغل صوت قبل إضافته.'
      : 'الصوت والتسجيل محفوظان على هذا الجهاز فقط، ويمكن كتمهما بأي وقت.');
  }
  mode.value = ['off', 'gentle', 'recording'].includes(getMode()) ? getMode() : 'off';
  mode.onchange = () => { localStorage.setItem(soundKey, mode.value); stopSound(); updateStatus(); };
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/') || file.size > 15 * 1024 * 1024) {
      setStatus('اختاري ملف صوت MP3 أو M4A أو WAV بحجم أقل من 15 ميغابايت.'); return;
    }
    try { await storeAudio(file); prepareAudio(file); mode.value = 'recording'; localStorage.setItem(soundKey, 'recording'); updateStatus(); }
    catch { setStatus('تعذّر حفظ التسجيل على هذا الجهاز. جرّبي ملفًا أصغر.'); }
  };
  readAudio().then(file => { if (file) prepareAudio(file); updateStatus(); }).catch(() => setStatus('تعذّر فتح تسجيل الجهاز؛ النغمات الهادئة ما زالت متاحة.'));
  document.getElementById('entrySoundBtn').onclick = () => { updateStatus(); soundDialog.showModal(); };
  document.getElementById('entrySoundClose').onclick = () => soundDialog.close();
  document.getElementById('entrySoundTest').onclick = startSound;
  document.getElementById('entrySoundStop').onclick = stopSound;
  window.yomiEntryStopSound = stopSound;
  window.addEventListener('yomi-signed-out', stopSound);
  window.addEventListener('yomi-pin-unlocked', () => {
    // The PIN submit is a user gesture, so begin audio before any async work.
    startSound();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    intro.hidden = false;
    intro.style.animation = 'none';
    void intro.offsetWidth;
    intro.style.animation = '';
    clearTimeout(introTimer);
    introTimer = setTimeout(() => { intro.hidden = true; }, 2050);
  });
})();
