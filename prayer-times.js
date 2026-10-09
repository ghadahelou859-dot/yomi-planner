/* Prayer times panel for عبادتي — isolated from core planner data */
(() => {
  const KEY='yomi-prayer-times-settings-v1', CACHE='yomi-prayer-times-cache-v1';
  const defaults={city:'Ramallah',country:'Palestine',method:3};
  const labels={Fajr:'الفجر',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'};
  const order=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  let busy=false,lastSignature='';

  const settings=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}};
  const saveSettings=s=>localStorage.setItem(KEY,JSON.stringify(s));
  const cache=()=>{try{return JSON.parse(localStorage.getItem(CACHE)||'{}')}catch{return {}}};
  const saveCache=x=>{try{localStorage.setItem(CACHE,JSON.stringify(x))}catch{}};
  const selectedDay=()=>typeof selected==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(selected)?selected:new Date().toISOString().slice(0,10);
  const apiDate=d=>{const [y,m,day]=d.split('-');return day+'-'+m+'-'+y};
  const cleanTime=v=>String(v||'').match(/\d{1,2}:\d{2}/)?.[0]||'--:--';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function nextPrayer(timings,day){
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hebron',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if(day!==today)return null;
    const now=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hebron',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
    return order.find(k=>cleanTime(timings[k])>now)||null;
  }

  function renderBox(section){
    let box=section.querySelector('[data-prayer-times]');
    if(!box){
      box=document.createElement('div');box.className='prayer-times-panel';box.dataset.prayerTimes='1';
      const grid=section.querySelector('.prayer-grid');grid?.insertAdjacentElement('beforebegin',box);
    }
    return box;
  }

  function showLoading(box,s,day){
    box.innerHTML='<div class="prayer-times-head"><div><h3>🕰️ مواقيت الصلاة</h3><small>'+esc(s.city)+' · '+esc(day)+'</small></div><button type="button" class="soft" data-prayer-times-settings>⚙ المكان</button></div><div class="prayer-times-loading">جارٍ تحديث المواقيت…</div>';
    bindSettings(box,s);
  }

  function showTimes(box,s,day,timings,fromCache=false){
    const next=nextPrayer(timings,day);
    box.innerHTML='<div class="prayer-times-head"><div><h3>🕰️ مواقيت الصلاة</h3><small>'+esc(s.city)+' · '+esc(day)+(fromCache?' · آخر تحديث محفوظ':'')+'</small></div><button type="button" class="soft" data-prayer-times-settings>⚙ المكان</button></div>'+
      '<div class="prayer-times-grid">'+order.map(k=>'<div class="prayer-time '+(next===k?'next':'')+'"><span>'+labels[k]+'</span><b>'+cleanTime(timings[k])+'</b>'+(next===k?'<small>الصلاة القادمة</small>':'')+'</div>').join('')+'</div>'+
      '<div class="prayer-times-note">المواقيت حسب المدينة المختارة، وقد تختلف دقائق قليلة عن تقويم المسجد المحلي.</div>';
    bindSettings(box,s);
  }

  function showError(box,s,day,cached){
    if(cached?.timings){showTimes(box,s,day,cached.timings,true);return}
    box.innerHTML='<div class="prayer-times-head"><div><h3>🕰️ مواقيت الصلاة</h3><small>'+esc(s.city)+' · '+esc(day)+'</small></div><button type="button" class="soft" data-prayer-times-settings>⚙ المكان</button></div><div class="prayer-times-error">تعذّر جلب المواقيت الآن. تأكدي من الإنترنت أو غيّري المدينة.</div>';
    bindSettings(box,s);
  }

  function bindSettings(box,s){
    box.querySelector('[data-prayer-times-settings]')?.addEventListener('click',()=>{
      if(box.querySelector('.prayer-times-settings')){box.querySelector('.prayer-times-settings').remove();return}
      const form=document.createElement('form');form.className='prayer-times-settings row';
      form.innerHTML='<label class="field">المدينة<input name="city" value="'+esc(s.city)+'" required></label><label class="field">الدولة<input name="country" value="'+esc(s.country)+'" required></label><button class="primary">حفظ وتحديث</button>';
      box.append(form);
      form.onsubmit=e=>{e.preventDefault();const fd=new FormData(form),n={...s,city:String(fd.get('city')||'').trim(),country:String(fd.get('country')||'').trim()};saveSettings(n);lastSignature='';refresh(true)};
    });
  }

  async function refresh(force=false){
    const section=document.getElementById('worshipPrayerSection');if(!section||busy)return;
    const day=selectedDay(),s=settings(),sig=[day,s.city,s.country,s.method].join('|');
    if(!force&&sig===lastSignature&&section.querySelector('[data-prayer-times]'))return;
    lastSignature=sig;busy=true;
    const box=renderBox(section),all=cache(),cached=all[sig];
    showLoading(box,s,day);
    try{
      const url='https://api.aladhan.com/v1/timingsByCity/'+apiDate(day)+'?city='+encodeURIComponent(s.city)+'&country='+encodeURIComponent(s.country)+'&method='+encodeURIComponent(s.method);
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