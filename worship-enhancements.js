/* عبادتي UX + أعمالي enhancements */
(() => {
  let busy=false;

  const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const day=()=>typeof selected==='string'?selected:new Date().toISOString().slice(0,10);
  const weekday=d=>new Date(d+'T12:00:00Z').getUTCDay();

  function ensure(){
    data.worshipWorks??=[];
    for(const w of data.worshipWorks){
      w.counts??={};w.completed??={};w.weekdays??=[];
      w.repeat??='once';w.type??='أخرى';w.unit??='مرة';w.target=Math.max(1,Number(w.target)||1);
      w.start??=day();w.end??='';w.paused??=false;
    }
  }

  function due(w,d){
    if(w.paused||!w.start||d<w.start||(w.end&&d>w.end))return false;
    if(w.repeat==='daily')return true;
    if(w.repeat==='days')return (w.weekdays||[]).includes(weekday(d));
    if(w.repeat==='weekly')return weekday(d)===weekday(w.start);
    if(w.repeat==='monthly')return d.slice(8,10)===w.start.slice(8,10);
    return d===w.start;
  }

  function count(w,d=day()){return Math.max(0,Number(w.counts?.[d])||(w.completed?.[d]?Number(w.target)||1:0))}
  function done(w,d=day()){return !!w.completed?.[d]||count(w,d)>=Math.max(1,Number(w.target)||1)}
  function workStep(w){return w.type==='صلاة نافلة'||w.unit==='ركعة'?2:1}

  function renderWorksPanel(section){
    ensure();
    let panel=section.querySelector('[data-worship-works-manager]');
    if(!panel){panel=document.createElement('div');panel.dataset.worshipWorksManager='1';section.prepend(panel)}
    const d=day(),dueToday=data.worshipWorks.filter(w=>due(w,d));
    const pending=dueToday.filter(w=>!done(w,d)),completed=dueToday.filter(w=>done(w,d));
    const types=['صلاة نافلة','قرآن','ذكر','صدقة','صيام','عمل خير','أخرى'];
    const repeats=[['once','مرة واحدة'],['daily','يومي'],['days','أيام محددة'],['weekly','أسبوعي'],['monthly','شهري']];
    const units=['مرة','ركعة','صفحة','دقيقة','شيكل'];
    const prayers=['','الفجر','الظهر','العصر','المغرب','العشاء'];

    const card=w=>{
      const n=count(w,d),goal=Math.max(1,Number(w.target)||1),step=workStep(w),isDone=done(w,d);
      return '<article class="worship-work-card '+(isDone?'done':'')+'" data-worship-work-card="'+safe(w.id)+'">'+
        '<div class="worship-work-main"><div><span class="badge">'+safe(w.type)+'</span><h4>'+safe(w.title)+'</h4><small>'+safe(w.repeat==='daily'?'يومي':w.repeat==='days'?'أيام محددة':w.repeat==='weekly'?'أسبوعي':w.repeat==='monthly'?'شهري':'مرة واحدة')+(w.linkedPrayer?' · بعد '+safe(w.linkedPrayer):'')+(w.time?' · '+safe(w.time):'')+'</small></div>'+
        '<strong>'+n+' / '+goal+' '+safe(w.unit||'مرة')+'</strong></div>'+
        '<div class="bar"><i style="width:'+Math.min(100,Math.round(n/goal*100))+'%"></i></div>'+
        '<div class="row worship-work-controls">'+
          '<button type="button" class="soft" data-work-minus="'+safe(w.id)+'" '+(n===0?'disabled':'')+'>−'+step+'</button>'+
          '<button type="button" class="primary" data-work-plus="'+safe(w.id)+'">'+(goal===1?'✓ تم':'+'+step)+'</button>'+
          '<button type="button" class="soft" data-work-edit="'+safe(w.id)+'">تعديل</button>'+
          '<button type="button" class="soft" data-work-pause="'+safe(w.id)+'">'+(w.paused?'استئناف':'إيقاف مؤقت')+'</button>'+
          '<button type="button" class="danger" data-work-delete="'+safe(w.id)+'">حذف</button>'+
        '</div></article>';
    };

    panel.innerHTML='<div class="panel worship-works-panel">'+
      '<div class="row between"><div><h3>✨ أعمالي</h3><p class="sub">أضيفي أي عبادة أو عمل، وحددي التكرار والعدد بالطريقة التي تناسبك.</p></div><button type="button" class="primary" data-work-add-toggle>+ إضافة عمل</button></div>'+
      '<form id="worshipWorkForm" class="worship-work-form" hidden><input type="hidden" name="workId">'+
        '<div class="row"><label class="field grow">اسم العمل<input name="title" required placeholder="مثلاً: قيام الليل أو سورة يس"></label>'+
        '<label class="field">النوع<select name="type">'+types.map(x=>'<option>'+x+'</option>').join('')+'</select></label>'+
        '<label class="field">الهدف<input name="target" type="number" inputmode="numeric" min="1" step="1" value="1" required></label>'+
        '<label class="field">الوحدة<select name="unit">'+units.map(x=>'<option>'+x+'</option>').join('')+'</select></label></div>'+
        '<div class="row"><label class="field">التكرار<select name="repeat">'+repeats.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select></label>'+
        '<label class="field">يبدأ<input name="start" type="date" value="'+d+'" required></label>'+
        '<label class="field">ينتهي (اختياري)<input name="end" type="date"></label>'+
        '<label class="field">وقت (اختياري)<input name="time" type="time"></label>'+
        '<label class="field">مرتبط بصلاة<select name="linkedPrayer">'+prayers.map(x=>'<option value="'+x+'">'+(x||'بدون')+'</option>').join('')+'</select></label></div>'+
        '<div class="worship-weekdays" data-work-weekdays hidden>'+[['0','الأحد'],['1','الإثنين'],['2','الثلاثاء'],['3','الأربعاء'],['4','الخميس'],['5','الجمعة'],['6','السبت']].map(x=>'<label><input type="checkbox" name="weekday" value="'+x[0]+'"> '+x[1]+'</label>').join('')+'</div>'+
        '<div class="row"><button class="primary" type="submit" data-work-save>حفظ العمل</button><button type="button" class="soft" data-work-cancel>إلغاء</button></div>'+
      '</form>'+
      '<div class="worship-work-summary"><span>اليوم: '+dueToday.length+'</span><span>✓ تم: '+completed.length+'</span><span>○ متبقي: '+pending.length+'</span></div>'+
      (pending.length?'<h4>المطلوب اليوم</h4>'+pending.map(card).join(''):'<div class="notice mini">لا يوجد عمل متبقٍ لليوم 🎉</div>')+
      (completed.length?'<details class="worship-completed-works"><summary>تم اليوم · '+completed.length+'</summary>'+completed.map(card).join('')+'</details>':'')+
      '<details class="worship-manage-all"><summary>إدارة كل أعمالي</summary>'+data.worshipWorks.map(w=>'<div class="item"><div class="grow"><b>'+safe(w.title)+'</b><small>'+safe(w.type)+' · '+(w.paused?'متوقف مؤقتًا':'نشط')+'</small></div><button type="button" class="soft" data-work-edit="'+safe(w.id)+'">تعديل</button><button type="button" class="soft" data-work-pause="'+safe(w.id)+'">'+(w.paused?'استئناف':'إيقاف مؤقت')+'</button><button type="button" class="danger" data-work-delete="'+safe(w.id)+'">حذف</button></div>').join('')+'</details>'+
    '</div>';

    bindWorks(panel);
  }

  function bindWorks(panel){
    const form=panel.querySelector('#worshipWorkForm'),weekdays=form?.querySelector('[data-work-weekdays]');
    const repeat=form?.elements.repeat;
    const toggleWeekdays=()=>{if(weekdays)weekdays.hidden=repeat?.value!=='days'};
    repeat?.addEventListener('change',toggleWeekdays);toggleWeekdays();

    const openForm=(w=null)=>{
      if(!form)return;form.hidden=false;
      form.elements.workId.value=w?.id||'';
      form.elements.title.value=w?.title||'';
      form.elements.type.value=w?.type||'أخرى';
      form.elements.target.value=w?.target||1;
      form.elements.unit.value=w?.unit||'مرة';
      form.elements.repeat.value=w?.repeat||'once';
      form.elements.start.value=w?.start||day();
      form.elements.end.value=w?.end||'';
      form.elements.time.value=w?.time||'';
      form.elements.linkedPrayer.value=w?.linkedPrayer||'';
      [...form.querySelectorAll('input[name="weekday"]')].forEach(x=>x.checked=(w?.weekdays||[]).includes(Number(x.value)));
      toggleWeekdays();form.scrollIntoView({behavior:'smooth',block:'nearest'});
    };
    panel.querySelector('[data-work-add-toggle]')?.addEventListener('click',()=>openForm());
    panel.querySelector('[data-work-cancel]')?.addEventListener('click',()=>{form.hidden=true;form.reset();form.elements.start.value=day()});

    form?.addEventListener('submit',e=>{
      e.preventDefault();const fd=new FormData(form),idv=String(fd.get('workId')||''),start=String(fd.get('start')||''),end=String(fd.get('end')||''),target=Number(fd.get('target'));
      if(end&&end<start){alert('تاريخ النهاية لازم يكون بعد البداية');return}
      if(!Number.isSafeInteger(target)||target<1){alert('اكتبي هدفًا صحيحًا');return}
      const patch={title:String(fd.get('title')||'').trim(),type:String(fd.get('type')||'أخرى'),target,unit:String(fd.get('unit')||'مرة'),repeat:String(fd.get('repeat')||'once'),start,end,time:String(fd.get('time')||''),linkedPrayer:String(fd.get('linkedPrayer')||''),weekdays:[...form.querySelectorAll('input[name="weekday"]:checked')].map(x=>Number(x.value))};
      if(!patch.title)return;
      if(patch.repeat==='days'&&!patch.weekdays.length){alert('اختاري يومًا واحدًا على الأقل');return}
      const existing=data.worshipWorks.find(x=>String(x.id)===idv);
      if(existing)Object.assign(existing,patch);
      else data.worshipWorks.push({id:'ww-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),...patch,counts:{},completed:{},paused:false});
      save();render();
    });

    const adjust=(idv,dir)=>{
      const w=data.worshipWorks.find(x=>String(x.id)===String(idv));if(!w)return;
      const d=day(),goal=Math.max(1,Number(w.target)||1),step=workStep(w);
      w.counts??={};w.completed??={};
      const before=count(w,d);
      let n=dir>0?(goal===1?1:Math.min(goal,before+step)):Math.max(0,before-step);
      w.counts[d]=n;if(n>=goal)w.completed[d]=true;else delete w.completed[d];
      save();render();
    };
    panel.querySelectorAll('[data-work-plus]').forEach(b=>b.onclick=()=>adjust(b.dataset.workPlus,1));
    panel.querySelectorAll('[data-work-minus]').forEach(b=>b.onclick=()=>adjust(b.dataset.workMinus,-1));
    panel.querySelectorAll('[data-work-edit]').forEach(b=>b.onclick=()=>{const w=data.worshipWorks.find(x=>String(x.id)===String(b.dataset.workEdit));if(w)openForm(w)});
    panel.querySelectorAll('[data-work-pause]').forEach(b=>b.onclick=()=>{const w=data.worshipWorks.find(x=>String(x.id)===String(b.dataset.workPause));if(!w)return;w.paused=!w.paused;save();render()});
    panel.querySelectorAll('[data-work-delete]').forEach(b=>b.onclick=()=>{if(!confirm('حذف هذا العمل وكل سجله؟'))return;data.worshipWorks=data.worshipWorks.filter(x=>String(x.id)!==String(b.dataset.workDelete));save();render()});
  }

  function improveDhikr(section){
    const details=section.querySelector('details.worship-custom-details');
    if(details){
      details.open=true;
      const s=details.querySelector(':scope > summary');
      if(s){s.textContent='أذكاري المضافة يدويًا';if(!s.dataset.locked){s.dataset.locked='1';s.addEventListener('click',e=>e.preventDefault())}}
      if(!details.dataset.keepOpen){details.dataset.keepOpen='1';details.addEventListener('toggle',()=>{if(!details.open)details.open=true})}
    }
    const bonus=section.querySelector('.worship-bonus-adhkar');
    if(bonus?.querySelector('.worship-reader-card')){
      const launch=section.querySelector('.worship-adhkar-launch');
      if(launch)launch.insertAdjacentElement('afterend',bonus);else section.prepend(bonus);
      bonus.classList.add('featured-bonus-dhikr');
    }
  }

  function improveHeader(root){
    const head=root.querySelector('.worship-home-head');
    if(!head)return;
    head.classList.add('worship-home-head-clean');
    const summary=head.querySelector('.worship-summary');
    if(!summary||summary.dataset.enhanced)return;
    ensure();
    summary.dataset.enhanced='1';
    const text=[...summary.querySelectorAll('span')].map(x=>x.textContent.trim());
    const dueToday=data.worshipWorks.filter(w=>due(w,day())),doneToday=dueToday.filter(w=>done(w,day())).length;
    summary.innerHTML='<strong>ملخص عبادتي اليوم</strong>'+
      '<button type="button" data-summary-tab="prayer">'+safe(text[0]||'🕌 الصلاة')+'</button>'+
      '<button type="button" data-summary-tab="adhkar">'+safe(text[1]||'📿 الأذكار')+'</button>'+
      '<button type="button" data-summary-tab="quran">'+safe(text[2]||'📖 القرآن')+'</button>'+
      '<button type="button" data-summary-tab="works">✨ أعمالي '+doneToday+'/'+dueToday.length+'</button>';
    summary.querySelectorAll('[data-summary-tab]').forEach(b=>b.onclick=()=>root.querySelector('[data-worship-tab="'+b.dataset.summaryTab+'"]')?.click());
  }

  function enhance(){
    if(busy)return;busy=true;
    try{
      if(typeof data==='undefined')return;
      ensure();
      const root=document.getElementById('view'),tabs=root?.querySelector('.worship-tabs');if(!root||!tabs)return;
      if(tabs.dataset.worshipEnhanced==='1')return;
      tabs.dataset.worshipEnhanced='1';
      improveHeader(root);
      const works=root.querySelector('[data-worship-section="works"]');
      const prayer=root.querySelector('[data-worship-section="prayer"]');
      const adhkar=root.querySelector('[data-worship-section="adhkar"]');
      if(works){
        const voluntary=prayer?.querySelector('.voluntary-prayer-area');
        if(voluntary){works.prepend(voluntary);voluntary.querySelector('h3')?.insertAdjacentHTML('afterend','<p class="sub worship-moved-note">النوافل موجودة هنا حتى تبقى صفحة الصلاة الرئيسية أخف.</p>')}
        renderWorksPanel(works);
      }
      if(adhkar)improveDhikr(adhkar);
    } finally {busy=false}
  }

  const obs=new MutationObserver(()=>queueMicrotask(enhance));
  const start=()=>{const view=document.getElementById('view');if(view)obs.observe(view,{childList:true,subtree:true});enhance()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();