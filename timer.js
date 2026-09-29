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
  function draw() {
    const dock = document.getElementById('timerDock'); if (!dock) return;
    dock.hidden = !timer; if (!timer) return;
    dock.querySelector('[data-timer-title]').textContent = timer.title;
    dock.querySelector('[data-timer-clock]').textContent = clock(seconds());
    dock.querySelector('[data-timer-toggle]').textContent = timer.running ? 'إيقاف مؤقت' : 'متابعة';
    dock.querySelector('[data-timer-sound]').textContent = window.yomiTimerMusicIsPlaying?.() ? 'إيقاف الموسيقى' : 'موسيقى هادئة';
    const audioStatus = dock.querySelector('[data-timer-audio-status]');
    if (audioStatus) audioStatus.textContent = window.yomiAudioError?.() || '';
  }
  function pause() { if (!timer?.running) return; timer.elapsedMs += Math.max(0, Date.now() - timer.startedAt); timer.running = false; persist(); draw(); }
  function start(task) {
    if (timer && seconds() > 0 && !confirm('في مؤقّت شغّال. احفظي وقته أولًا أو ابدئي مهمة جديدة وتجاهلي وقته؟')) return;
    timer = { taskId: task.id, title: task.title, date: today(), elapsedMs: 0, startedAt: Date.now(), running: true };
    persist(); draw();
  }
  function finish() {
    if (!timer) return;
    pause(); const spent = seconds();
    if (spent > 0) { data.timerSessions ??= []; data.timerSessions.push({ id: id(), taskId: timer.taskId, title: timer.title, date: timer.date, seconds: spent }); save(); }
    timer = null; persist(); render();
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
    if (timer.running) pause(); else { timer.startedAt = Date.now(); timer.running = true; persist(); draw(); }
  };
  document.querySelector('[data-timer-sound]').onclick = () => { window.yomiTimerMusicToggle?.(); draw(); };
  document.querySelector('[data-timer-finish]').onclick = finish;
  window.addEventListener('yomi-sound-changed', draw);
  setInterval(draw, 1000);
  window.addEventListener('pagehide', () => pause());
  window.addEventListener('yomi-signed-out', () => { timer = null; persist(); draw(); });
  draw();
})();
