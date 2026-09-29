(function () {
  const soundKey='yomi-entry-sound-v1';
  const mode=document.getElementById('entrySoundMode');
  const fileInput=document.getElementById('entrySoundFile');
  const status=document.getElementById('entrySoundStatus');
  const soundDialog=document.getElementById('entrySoundDialog');
  const intro=document.getElementById('entryScene');
  const nowButton=document.getElementById('entrySoundNow');
  let savedAudio=null,savedUrl=null,playing=null,context=null,loopTimer=null,introTimer=null,lastStart=0;
  const getMode=()=>localStorage.getItem(soundKey)||'off';
  const setStatus=message=>{status.textContent=message};
  const active=()=>!!playing||!!context;
  function updateControl(){nowButton.hidden=getMode()==='off';nowButton.textContent=active()?'■ إيقاف الصوت':'▶ تشغيل الصوت'}
  function openAudioDB(){return new Promise((resolve,reject)=>{
    const request=indexedDB.open('yomi-local-audio-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('files');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  })}
  async function readAudio(){const db=await openAudioDB();return new Promise((resolve,reject)=>{
    const transaction=db.transaction('files','readonly');const request=transaction.objectStore('files').get('entry');
    request.onsuccess=()=>{resolve(request.result||null);db.close()};request.onerror=()=>{reject(request.error);db.close()};
  })}
  async function storeAudio(file){const db=await openAudioDB();return new Promise((resolve,reject)=>{
    const transaction=db.transaction('files','readwrite');transaction.objectStore('files').put(file,'entry');
    transaction.oncomplete=()=>{resolve();db.close()};transaction.onerror=()=>{reject(transaction.error);db.close()};
  })}
  function prepareAudio(file){
    if(savedUrl)URL.revokeObjectURL(savedUrl);
    savedUrl=URL.createObjectURL(file);savedAudio=new Audio(savedUrl);savedAudio.preload='auto';savedAudio.volume=.55;
    savedAudio.onended=()=>{playing=null;updateControl()};
  }
  function stopSound(){
    clearInterval(loopTimer);loopTimer=null;
    if(playing){playing.pause();playing.currentTime=0;playing=null}
    if(context){const old=context;context=null;old.close().catch(()=>{})}
    updateControl();
  }
  function gentleMusic(){
    stopSound();const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx){setStatus('الصوت غير مدعوم في هذا المتصفح.');return}
    context=new Ctx();const current=context;
    function phrase(){
      if(context!==current||current.state==='closed')return;
      const start=current.currentTime+.03;
      [523.25,659.25,783.99,659.25,587.33,523.25].forEach((pitch,index)=>{
        const oscillator=current.createOscillator(),gain=current.createGain(),at=start+index*.8;
        oscillator.type='sine';oscillator.frequency.value=pitch;
        gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(.055,at+.09);
        gain.gain.exponentialRampToValueAtTime(.0001,at+1.15);
        oscillator.connect(gain).connect(current.destination);oscillator.start(at);oscillator.stop(at+1.18);
      });
    }
    phrase();loopTimer=setInterval(phrase,4800);
    current.resume().then(()=>{if(context===current)updateControl()}).catch(()=>{
      if(context===current){stopSound();setStatus('اضغطي «تشغيل الصوت» أعلى الصفحة؛ بعض الهواتف تحتاج ضغطة مباشرة.')}});
    updateControl();
  }
  function startSound(){
    const choice=getMode();if(choice==='off')return;
    if(active()&&Date.now()-lastStart<1000)return;
    lastStart=Date.now();
    if(choice==='gentle'){gentleMusic();return}
    if(choice==='recording'){
      if(!savedAudio){setStatus('التسجيل لسه قيد التحميل، جرّبي زر تشغيل الصوت بعد لحظة.');updateControl();return}
      stopSound();savedAudio.currentTime=0;playing=savedAudio;updateControl();
      savedAudio.play().catch(()=>{playing=null;updateControl();setStatus('اضغطي «تشغيل الصوت» أعلى الصفحة؛ المتصفح يحتاج ضغطة مباشرة.')});
    }
  }
  function updateStatus(){
    setStatus(getMode()==='recording'&&!savedAudio?'اختاري تسجيلًا من جهازك أولًا.':'الصوت محفوظ على هذا الجهاز؛ تقدري تشغليه أو توقفيه من أعلى الصفحة.');
    updateControl();
  }
  mode.value=['off','gentle','recording'].includes(getMode())?getMode():'off';
  mode.onchange=()=>{localStorage.setItem(soundKey,mode.value);stopSound();updateStatus();if(mode.value!=='off')startSound()};
  fileInput.onchange=async()=>{
    const file=fileInput.files?.[0];if(!file)return;
    if(!file.type.startsWith('audio/')||file.size>15*1024*1024){setStatus('اختاري MP3 أو M4A أو WAV أقل من 15 ميغابايت.');return}
    try{await storeAudio(file);prepareAudio(file);mode.value='recording';localStorage.setItem(soundKey,'recording');updateStatus();startSound()}
    catch{setStatus('تعذّر حفظ التسجيل. جرّبي ملفًا أصغر.')}
  };
  readAudio().then(file=>{if(file)prepareAudio(file);updateStatus();if(file&&getMode()==='recording'&&document.getElementById('lock').classList.contains('hidden'))startSound()}).catch(()=>setStatus('تعذّر فتح التسجيل؛ النغمات الهادئة ما زالت متاحة.'));
  document.getElementById('entrySoundBtn').onclick=()=>{updateStatus();soundDialog.showModal()};
  document.getElementById('entrySoundClose').onclick=()=>soundDialog.close();
  document.getElementById('entrySoundTest').onclick=startSound;
  document.getElementById('entrySoundStop').onclick=stopSound;
  nowButton.onclick=()=>{if(active())stopSound();else startSound()};
  window.yomiEntryStopSound=stopSound;
  window.addEventListener('yomi-signed-out',stopSound);
  // The form submit and unlock happen inside the user's direct tap, which helps mobile audio policies.
  document.getElementById('pinForm').addEventListener('submit',()=>{
    const entered=document.getElementById('pinInput').value,saved=localStorage.getItem(PIN_KEY);
    if(/^[0-9]{2}$/.test(entered)&&(!saved||saved===entered))startSound();
  },true);
  window.addEventListener('yomi-pin-unlocked',()=>{
    startSound();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    intro.hidden=false;intro.style.animation='none';void intro.offsetWidth;intro.style.animation='';
    clearTimeout(introTimer);introTimer=setTimeout(()=>{intro.hidden=true},2050);
  });
  window.addEventListener('pagehide',stopSound);
  updateControl();
})();
