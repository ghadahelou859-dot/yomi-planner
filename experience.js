(function () {
  const soundKey='yomi-entry-sound-v1';
  const mode=document.getElementById('entrySoundMode');
  const fileInput=document.getElementById('entrySoundFile');
  const status=document.getElementById('entrySoundStatus');
  const soundDialog=document.getElementById('entrySoundDialog');
  const intro=document.getElementById('entryScene');
  const nowButton=document.getElementById('entrySoundNow');
  const gentleAudio=new Audio('./assets/gentle-loop.wav');
  gentleAudio.loop=true;gentleAudio.preload='auto';gentleAudio.volume=.5;
  let savedAudio=null,savedUrl=null,playing=null,introTimer=null,lastStart=0;
  const getMode=()=>localStorage.getItem(soundKey)||'off';
  const setStatus=message=>{status.textContent=message};
  const active=()=>!!playing;
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
    savedUrl=URL.createObjectURL(file);savedAudio=new Audio(savedUrl);
    savedAudio.preload='auto';savedAudio.loop=true;savedAudio.volume=.55;
  }
  function stopSound(){
    if(playing){playing.pause();playing.currentTime=0;playing=null}
    updateControl();
  }
  function startSound(){
    const choice=getMode();if(choice==='off')return;
    if(active()&&Date.now()-lastStart<1000)return;
    lastStart=Date.now();
    const audio=choice==='gentle'?gentleAudio:savedAudio;
    if(!audio){setStatus('التسجيل لسه قيد التحميل؛ جرّبي تشغيل الصوت بعد لحظة.');updateControl();return}
    stopSound();audio.currentTime=0;playing=audio;updateControl();
    audio.play().catch(error=>{
      if(playing===audio){playing=null;updateControl();setStatus('اضغطي «تشغيل الصوت» أعلى الصفحة؛ بعض الهواتف تحتاج ضغطة مباشرة.')}
      console.warn('Audio playback did not start',error);
    });
  }
  function updateStatus(){
    setStatus(getMode()==='recording'&&!savedAudio?'اختاري تسجيلًا من جهازك أولًا.':'الصوت يظل شغّالًا حتى تضغطي «إيقاف الصوت». قد يعلّقه الهاتف إذا أغلقتِ المتصفح.');
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
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&playing?.paused){
      const audio=playing;audio.play().catch(()=>{
        if(playing===audio){playing=null;updateControl();setStatus('الهاتف أوقف الصوت بالخلفية؛ اضغطي «تشغيل الصوت» لمتابعته.')}
      });
    }
  });
  updateControl();
})();
