/* مؤقّت واحد يعمل عبر صفحات يومي ويعتمد على الساعة الفعلية للجهاز. */
(() => {
  const STORAGE = 'yomi-active-timer-v1';
  let timer = null;
  try { timer = JSON.parse(localStorage.getItem(STORAGE) || 'null'); } catch { timer = null; }
  if (timer?.running) { timer.elapsedMs = (timer.elapsedMs || 0) + Math.max(0, Date.now() - timer.startedAt); timer.running = false; }
  const persist = () => timer ? localStorage.setItem(STORAGE, JSON.stringify(timer)) : localStorage.removeItem(STORAGE);
  persist();
  const seconds = () => timer ? Math.floor(((timer.elapsedMs || 0) + (timer.running ? Math.max(0, Date.now() - timer.startedAt) : 0)) / 1000) : 0;
  const clock = n => [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60].map(x => String(x).padStart(2, '0')).join(':');
  let audio = null, melody = null, note = 0, soundWanted = false;
  const tones = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
  function stopMusic() { clearInterval(melody); melody = null; if (audio) { audio.close().catch(() => {}); audio = null; } }
  function startMusic() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || !timer?.running) return;
    stopMusic(); audio = new Ctx(); audio.resume().catch(() => {});
    function play() {
      if (!audio || audio.state !== 'running') return;
      const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime;
      osc.type = 'sine'; osc.frequency.setValueAtTime(tones[note++ % tones.length], t);
      gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.035, t + .04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + .72);
      osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .75);
    }
    play(); melody = setInterval(play, 900);
  }
  function draw() {
    const dock = document.getElementById('timerDock'); if (!dock) return;
    dock.hidden = !timer; if (!timer) return;
    dock.querySelector('[data-timer-title]').textContent = timer.title;
    dock.querySelector('[data-timer-clock]').textContent = clock(seconds());
    dock.querySelector('[data-timer-toggle]').textContent = timer.running ? 'إيقاف مؤقت' : 'متابعة';
    dock.querySelector('[data-timer-sound]').textContent = soundWanted ? 'إيقاف الموسيقى' : 'موسيقى هادئة';
  }
  function pause() { if (!timer?.running) return; timer.elapsedMs += Math.max(0, Date.now() - timer.startedAt); timer.running = false; stopMusic(); persist(); draw(); }
  function start(task) {
    if (timer && seconds() > 0 && !confirm('في مؤقّت شغّال. احفظي وقته أولًا أو ابدئي مهمة جديدة وتجاهلي وقته؟')) return;
    stopMusic(); soundWanted = false;
    timer = { taskId: task.id, title: task.title, date: today(), elapsedMs: 0, startedAt: Date.now(), running: true };
    persist(); draw();
  }
  function finish() {
    if (!timer) return;
    pause(); const spent = seconds();
    if (spent > 0) { data.timerSessions ??= []; data.timerSessions.push({ id: id(), taskId: timer.taskId, title: timer.title, date: timer.date, seconds: spent }); save(); }
    timer = null; soundWanted = false; stopMusic(); persist(); render();
  }
  window.yomiTimerRender = () => {
    document.querySelectorAll('[data-timer-start]').forEach(button => button.onclick = () => {
      const task = data.tasks.find(x => x.id === button.dataset.timerStart);
      if (task) start(task);
    });
    draw();
  };
  document.querySelector('[data-timer-toggle]').onclick = () => {
    if (!timer) return;
    if (timer.running) pause(); else { timer.startedAt = Date.now(); timer.running = true; persist(); if (soundWanted) startMusic(); draw(); }
  };
  document.querySelector('[data-timer-sound]').onclick = () => { soundWanted = !soundWanted; if (soundWanted) startMusic(); else stopMusic(); draw(); };
  document.querySelector('[data-timer-finish]').onclick = finish;
  setInterval(draw, 1000);
  window.addEventListener('pagehide', () => pause());
  window.addEventListener('yomi-signed-out', () => { timer = null; soundWanted = false; stopMusic(); persist(); draw(); });
  draw();
})();
