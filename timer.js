/* مؤقّت يومي 2.0: عداد مفتوح أو تنازلي، إلغاء بلا احتساب، وتعديل الوقت قبل الحفظ. */
(() => {
  const STORAGE='yomi-active-timer-v2';
  let timer=null,finishedAlerted=false;
  try{timer=JSON.parse(localStorage.getItem(STORAGE)||'null')}catch{timer=null}
  if(timer?.running){timer.elapsedMs=(timer.elapsedMs||0)+Math.max(0,Date.now()-timer.startedAt);timer.running=false}
  const persist=()=>timer?localStorage.setItem(STORAGE,JSON.stringify(timer)):localStorage.removeItem(STORAGE);
  persist();
  const seconds=()=>timer?Math.max(0,Math.floor(((timer.elapsedMs||0)+(timer.running?Math.max(0,Date.now()-timer.startedAt):0))/1000)):0;
  const shownSeconds=()=>timer?.targetSeconds?Math.max(0,timer.targetSeconds-seconds()):seconds();
  const clock=n=>[Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(x=>String(x).padStart(2,'0')).join(':');

  function ensureButtons(){
    const row=document.querySelector('#timerDock .row'); if(!row||row.querySelector('[data-timer-cancel]'))return;
    const duration=document.createElement('button');duration.className='soft';duration.dataset.timerDuration='1';duration.textContent='تحديد مدة';
    const adjust=document.createElement('button');adjust.className='soft';adjust.dataset.timerAdjust='1';adjust.textContent='تعديل الوقت';
    const cancel=document.createElement('button');cancel.className='danger';cancel.dataset.timerCancel='1';cancel.textContent='إلغاء الجلسة';
    row.append(duration,adjust,cancel);
    duration.onclick=()=>{
      if(!timer)return;
      const raw=prompt('مدة التركيز بالدقائق؟ مثال: 180 لثلاث ساعات. اتركيها 0 لعداد مفتوح.',String(timer.targetSeconds?Math.round(timer.targetSeconds/60):0));
      if(raw===null)return;const n=Number(raw);if(!Number.isFinite(n)||n<0){alert('اكتبي عدد دقائق صحيح');return}
      timer.targetSeconds=Math.round(n*60)||0;finishedAlerted=false;persist();draw();
    };
    adjust.onclick=()=>{
      if(!timer)return;
      pause();
      const raw=prompt('كم دقيقة اشتغلتِ فعليًا؟',String(Math.round(seconds()/60)));
      if(raw===null)return;const n=Number(raw);if(!Number.isFinite(n)||n<0){alert('اكتبي عددًا صحيحًا أو عشريًا');return}
      timer.elapsedMs=Math.round(n*60000);persist();draw();
    };
    cancel.onclick=()=>{
      if(!timer)return;
      if(!confirm('إلغاء هذه الجلسة بدون احتساب وقتها؟'))return;
      timer=null;persist();render();
    };
  }
  function draw(){
    const dock=document.getElementById('timerDock');if(!dock)return;ensureButtons();
    dock.hidden=!timer;if(!timer)return;
    dock.querySelector('[data-timer-title]').textContent=timer.title+(timer.targetSeconds?' · تركيز':'');
    dock.querySelector('[data-timer-clock]').textContent=clock(shownSeconds());
    dock.querySelector('[data-timer-toggle]').textContent=timer.running?'إيقاف مؤقت':'متابعة';
    dock.querySelector('[data-timer-sound]').textContent=window.yomiTimerMusicIsPlaying?.()?'إيقاف الموسيقى':'موسيقى هادئة';
    const audioStatus=dock.querySelector('[data-timer-audio-status]');
    if(audioStatus)audioStatus.textContent=window.yomiAudioError?.()||'';
    if(timer.targetSeconds&&seconds()>=timer.targetSeconds&&!finishedAlerted){
      pause();finishedAlerted=true;
      try{if(Notification.permission==='granted')new Notification('يومي',{body:'انتهت مدة '+timer.title})}catch{}
      alert('انتهت مدة التركيز: '+timer.title);
    }
  }
  function pause(){if(!timer?.running)return;timer.elapsedMs+=(Math.max(0,Date.now()-timer.startedAt));timer.running=false;persist();draw()}
  function start(task){
    if(timer&&seconds()>0&&!confirm('في مؤقّت شغّال. ابدئي مهمة جديدة وألغي الجلسة الحالية؟'))return;
    timer={taskId:task.id,title:task.title,date:today(),elapsedMs:0,startedAt:Date.now(),running:true,targetSeconds:0};finishedAlerted=false;persist();draw();
  }
  function finish(){
    if(!timer)return;pause();const spent=seconds();
    if(spent>0){data.timerSessions??=[];data.timerSessions.push({id:id(),taskId:timer.taskId,title:timer.title,date:timer.date,seconds:spent});save()}
    timer=null;persist();render();
  }
  window.yomiTimerRender=()=>{
    document.querySelectorAll('[data-timer-start]').forEach(button=>button.onclick=()=>{const task=data.tasks.find(x=>x.id===button.dataset.timerStart);if(task)start(task)});
    draw();
  };
  document.querySelector('[data-timer-toggle]').onclick=()=>{if(!timer)return;if(timer.running)pause();else{timer.startedAt=Date.now();timer.running=true;finishedAlerted=false;persist();draw()}};
  document.querySelector('[data-timer-sound]').onclick=()=>{window.yomiTimerMusicToggle?.();draw()};
  document.querySelector('[data-timer-finish]').onclick=finish;
  window.addEventListener('yomi-sound-changed',draw);
  setInterval(draw,1000);
  window.addEventListener('pagehide',()=>pause());
  window.addEventListener('yomi-signed-out',()=>{timer=null;persist();draw()});
  draw();
})();