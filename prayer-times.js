/* Prayer times panel for عبادتي — isolated from core planner data */
(() => {
  const KEY='yomi-prayer-times-settings-v1', CACHE='yomi-prayer-times-cache-v1';
  const defaults={city:'Ramallah',country:'Palestine',method:3};
  const labels={Fajr:'الفجر',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'};
  const order=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  let busy=false,lastSignature='',countdownTimer=null;

  const settings=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}};
  const saveSettings=s=>localStorage.setItem(KEY,JSON.stringify(s));
  const cache=()=>{try{return JSON.parse(localStorage.getItem(CACHE)||'{}')}catch{return {}}};
  const saveCache=x=>{try{localStorage.setItem(CACHE,JSON.stringify(x))}catch{}};
  const selectedDay=()=>typeof selected==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(selected)?selected:new Date().toISOString().slice(0,10);
  const apiDate=d=>{const [y,m,day]=d.split('-');return day+'-'+m+'-'+y};
  const cleanTime=v=>String(v||'').match(/\d{1,2}:\d{2}/)?.[0]||'--:--';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function palestineNow(){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hebron',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date());
    const get=t=>parts.find(x=>x.type===t)?.value||'00';
    return {date:get('year')+'-'+get('month')+'-'+get('day'),h:Number(get('hour')),m:Number(get('minute')),s:Number(get('second'))};
  }
  function nextPrayerInfo(timings,day){
    const now=palestineNow();if(day!==now.date)return null;
    const nowSec=now.h*3600+now.m*60+now.s;
    for(const k of order){const [h,m]=cleanTime(timings[k]).split(':').map(Number),sec=h*3600+m*60;if(sec>nowSec)return {key:k,seconds:sec-nowSec,tomorrow:false}}
    const [fh,fm]=cleanTime(timings.Fajr).split(':').map(Number);
    return {key:'Fajr',seconds:(86400-nowSec)+(fh*3600+fm*60),tomorrow:true};
  }
  function fmtRemaining(sec){
    sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function startCountdown(box,timings,day){
    clearInterval(countdownTimer);
    const paint=()=>{
      const info=nextPrayerInfo(timings,day),el=box.querySelector('[data-prayer-countdown]');
      if(!el)return;
      if(!info){el.hidden=true;return}
      el.hidden=false;el.innerHTML='<span>الصلاة القادمة</span><b>'+labels[info.key]+(info.tomorrow?' غدًا':'')+'</b><strong>متبقي '+fmtRemaining(info.seconds)+'</strong>';
      box.querySelectorAll('.prayer-time').forEach(x=>x.classList.toggle('next',x.dataset.prayerKey===info.key&&!info.tomorrow));
    };
    paint();countdownTimer=setInterval(paint,1000);
  }

  function renderBox(section){
    let box=section.querySelector('[data-prayer-times]');
    if(!box){
      box=document.createElement('div');box.className='prayer-times-panel';box.dataset.prayerTimes='1';
      const grid=section.querySelector('.prayer-grid');const after=section.querySelector('.voluntary-prayer-area')||grid;after?.insertAdjacentElement('afterend',box);
    }
    return box;
  }

  function showLoading(box,s,day){
    box.innerHTML='<div class="prayer-times-head"><div><h3>🕰️ مواقيت الصلاة</h3><small>'+esc(s.latitude!=null?'موقع الآيفون':s.city)+' · '+esc(day)+'</small></div><button type="button" class="soft" data-prayer-times-location>📍 موقع الآيفون</button><button type="button" class="soft" data-prayer-times-settings>⚙ المكان</button></div><div class="prayer-times-loading">جارٍ تحديث المواقيت…</div>';
    bindSettings(box,s);
  }

  function showTimes(box,s,day,timings,fromCache=false){
    const info=nextPrayerInfo(timings,day);
    box.innerHTML='<div class="prayer-times-head"><div><h3>🕰️ مواقيت الصلاة</h3><small>'+esc(s.latitude!=null?'موقع الآيفون':s.city)+' · '+esc(day)+(fromCache?' · آخر تحديث محفوظ':'')+'</small></div><button type="button" class="soft" data-prayer-times-location>📍 موقع الآيفون</button><button type="button" class="soft" data-prayer-times-settings>⚙ المكان</button></div>'+
      '<div class="prayer-next-countdown" data-prayer-countdown '+(info?'':'hidden')+'></div>'+
      '<div class="prayer-times-grid">'+order.map(k=>'<div class="prayer-time '+(info?.key===k&&!info.tomorrow?'next':'')+'" data-prayer-key="'+k+'"><span>'+labels[k]+'</span><b>'+cleanTime(timings[k])+'</b>'+(info?.key===k&&!info.tomorrow?'<small>الصلاة القادمة</small>':'')+'</div>').join('')+'</div>'+
      '<div class="prayer-times-note">المواقيت حسب المدينة المختارة، وقد تختلف دقائق قليلة عن تقويم المسجد المحلي.</div>';
    bindSettings(box,s);startCountdown(box,timings,day);
  }

  function showError(box,s,day,cached){
    if(cached?.timings){showTimes(box,s,day,cached.timings,true);return}
    box.innerHTML='<div class="prayer-times-head"><div><h3>🕰️ مواقيت الصلاة</h3><small>'+esc(s.latitude!=null?'موقع الآيفون':s.city)+' · '+esc(day)+'</small></div><button type="button" class="soft" data-prayer-times-location>📍 موقع الآيفون</button><button type="button" class="soft" data-prayer-times-settings>⚙ المكان</button></div><div class="prayer-times-error">تعذّر جلب المواقيت الآن. تأكدي من الإنترنت أو غيّري المدينة.</div>';
    bindSettings(box,s);
  }

  function bindSettings(box,s){
    box.querySelector('[data-prayer-times-location]')?.addEventListener('click',()=>{
      if(!navigator.geolocation){alert('موقع الآيفون غير متاح في هذا المتصفح');return}
      navigator.geolocation.getCurrentPosition(position=>{
        const lat=Number(position.coords.latitude.toFixed(5)),lon=Number(position.coords.longitude.toFixed(5));
        saveSettings({...s,latitude:lat,longitude:lon});
        lastSignature='';refresh(true);
      },()=>alert('تعذّر تحديد الموقع. فعّلي إذن الموقع للتطبيق أو اختاري المدينة يدويًا.'),{enableHighAccuracy:false,timeout:12000,maximumAge:600000});
    });
    box.querySelector('[data-prayer-times-settings]')?.addEventListener('click',()=>{
      if(box.querySelector('.prayer-times-settings')){box.querySelector('.prayer-times-settings').remove();return}
      const form=document.createElement('form');form.className='prayer-times-settings row';
      form.innerHTML='<label class="field">المدينة<input name="city" value="'+esc(s.city)+'" required></label><label class="field">الدولة<input name="country" value="'+esc(s.country)+'" required></label><button class="primary">حفظ وتحديث</button>';
      box.append(form);
      form.onsubmit=e=>{e.preventDefault();const fd=new FormData(form),n={...s,city:String(fd.get('city')||'').trim(),country:String(fd.get('country')||'').trim()};delete n.latitude;delete n.longitude;saveSettings(n);lastSignature='';refresh(true)};
    });
  }

  async function refresh(force=false){
    const section=document.getElementById('worshipPrayerSection');if(!section||busy)return;
    const day=selectedDay(),s=settings(),sig=[day,s.city,s.country,s.method,s.latitude??'',s.longitude??''].join('|');
    if(!force&&sig===lastSignature&&section.querySelector('[data-prayer-times]'))return;
    lastSignature=sig;busy=true;
    const box=renderBox(section),all=cache(),cached=all[sig];
    showLoading(box,s,day);
    try{
      const url=s.latitude!=null&&s.longitude!=null?'https://api.aladhan.com/v1/timings/'+apiDate(day)+'?latitude='+encodeURIComponent(s.latitude)+'&longitude='+encodeURIComponent(s.longitude)+'&method='+encodeURIComponent(s.method):'https://api.aladhan.com/v1/timingsByCity/'+apiDate(day)+'?city='+encodeURIComponent(s.city)+'&country='+encodeURIComponent(s.country)+'&method='+encodeURIComponent(s.method);
      const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw Error('network');
      const json=await res.json(),timings=json?.data?.timings;if(!timings)throw Error('data');
      all[sig]={timings,at:Date.now()};saveCache(all);showTimes(box,s,day,timings,false);
    }catch(err){console.warn('Prayer times unavailable',err);showError(box,s,day,cached)}
    finally{busy=false}
  }

  const obs=new MutationObserver(()=>{if(document.getElementById('worshipPrayerSection'))refresh()});
  const start=()=>{const view=document.getElementById('view');if(view)obs.observe(view,{childList:true,subtree:true});refresh()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();