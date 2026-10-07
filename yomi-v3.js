/* يومي 3.0 — تحسينات المشاريع، عبادتي، التقويم، الرفع والتخصيص */
(() => {
  window.yomiV3DesignActive=true;
  const BG_KEY='yomi-bg-v3', BG_SCOPE_KEY='yomi-bg-scope-v3', TRANS_KEY='yomi-transparency-v1', NAV_KEY='yomi-nav-visibility-v1';
  const state={client:null,project:null,course:null,prayer:null};
  const bucket='yomi-memories', urls=new Set();
  let pendingBackgroundFile=null,pendingBackgroundPreviewUrl=null,projectClockInterval=null;
  const formatDuration=ms=>{ms=Math.max(0,Number(ms)||0);const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return (h?h+' س ':'')+(m?m+' د ':'')+(!h&&m<10?sec+' ث':'')||'0 ث'};
  const projectElapsed=p=>{const t=p.timerState||{elapsed:0,running:false,startedAt:null};return Number(t.elapsed||0)+(t.running&&t.startedAt?Math.max(0,Date.now()-Number(t.startedAt)):0)};
  const projectTotalTime=p=>sum((p.timeSessions||[]).map(x=>Number(x.duration)||0))+projectElapsed(p);
  function ensure(){
    data.fastingLog??=[]; data.fastingPrefs??={mondayThursday:true,whiteDays:true,arafah:true,ashura:true};
    data.debtPeople??=[]; data.clients??=[]; data.learningSpaces??=[];
    data.designSettings??={background:null,stickers:[]}; data.designSettings.stickers??=[];
    data.designSettings.applyAll ??= true;
    data.designSettings.targetPage ??= 'home';
    data.designSettings.includeLogin ??= false;
    data.designSettings.panelTransparency ??= 35;
    data.designSettings.transparency ??= null;
    data.designSettings.navVisibility ??= null;
    data.designSettings.audioMode ??= null;
    data.prayerChecks??={};data.adhkarChecks??={};data.prayerWorks??=[];
    data.quran??={lastPage:0,log:[]};data.quran.log??=[];
    if(data.designSettings.background===null&&!data.designSettings.backgroundMigrated){
      const old=localStorage.getItem(BG_KEY);if(old){data.designSettings.background=old;Object.assign(data.designSettings,JSON.parse(localStorage.getItem(BG_SCOPE_KEY)||'{}'))}
      data.designSettings.backgroundMigrated=true;
    }
    data.cyclePeriodLength??=7;
    for(const c of data.clients){c.projects??=[];for(const p of c.projects){
      p.projectType??='مشروع';p.assets??=[];p.payments??=[];p.checklist??=[];p.publishDelay??=1;p.workLog??=[];p.timeSessions??=[];p.timerState??={elapsed:0,running:false,startedAt:null};
      if(!p.payments.length&&Number(p.paid||0)>0&&!p._paidMigrated){p.payments.push({id:id(),amount:Number(p.paid),date:p.due||today(),note:'دفعة سابقة'});p._paidMigrated=true}
      if(!p.checklist.length&&p.required){p.checklist=String(p.required).split(/\n+/).map(x=>x.trim()).filter(Boolean).map(text=>({id:id(),text,done:false}));p.required=''}
    }}
  }
  const cash=n=>Number(n||0).toLocaleString('en-US')+' ₪';
  const projectPaid=p=>sum((p.payments||[]).map(x=>Number(x.amount)||0));
  const publishDate=p=>p.publishDate||(p.eventDate?dayAfter(p.eventDate,Number(p.publishDelay??1)):'');
  const monthKey=d=>d.slice(0,7);
  function monthOffset(d,n){const x=new Date(d.slice(0,7)+'-01T12:00:00Z');x.setUTCMonth(x.getUTCMonth()+n);return x.toISOString().slice(0,10)}
  function clientItems(month){
    const out=[];for(const c of data.clients)for(const p of c.projects||[]){
      if(p.due?.startsWith(month))out.push({kind:'client',cid:c.id,pid:p.id,date:p.due,title:'تسليم · '+p.title,icon:'📦',color:'#bb925c'});
      if(p.eventDate?.startsWith(month))out.push({kind:'client',cid:c.id,pid:p.id,date:p.eventDate,title:'المناسبة · '+p.title,icon:'💍',color:'#a8738b'});
      const pd=publishDate(p);if(pd?.startsWith(month)&&!p.published)out.push({kind:'client',cid:c.id,pid:p.id,date:pd,title:'انشري المشروع · '+p.title,icon:'📱',color:'#749485'});
    }return out
  }
  function plannerRows(month){
    const a=[],monthStart=month+'-01',monthEnd=month+'-'+String(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()).padStart(2,'0');
    for(const x of data.tasks||[])if(x.date?.startsWith(month))a.push({kind:'task',date:x.date,title:x.title,icon:'✓',color:'#7f96ad'});
    for(const x of data.calendarEvents||[]){
      if(x.repeat==='daily'){
        let d=x.date>monthStart?x.date:monthStart,until=x.until&&x.until<monthEnd?x.until:monthEnd;
        while(d<=until){let time=x.time||'';if(time&&Number(x.driftMinutes||0)){const hm=time.split(':').map(Number),delta=daysBetween(x.date,d)*Number(x.driftMinutes||0),total=((hm[0]*60+hm[1]+delta)%1440+1440)%1440;time=String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0')}a.push({kind:'event',date:d,title:x.title,icon:x.sticker||'•',color:x.color||'#7f96ad',time});d=dayAfter(d)}
      }else if(x.date?.startsWith(month))a.push({kind:'event',date:x.date,title:x.title,icon:x.sticker||'•',color:x.color||'#7f96ad',time:x.time||''});
    }
    for(const x of data.projects||[])if(x.due?.startsWith(month))a.push({kind:'project',date:x.due,title:x.title,icon:'💼',color:'#bb925c',time:x.time||''});
    for(const x of data.importantDates||[]){const d=x.yearly?month.slice(0,4)+'-'+String(x.date||'').slice(5):x.date;if(d?.startsWith(month))a.push({kind:'important',date:d,title:x.title,icon:x.sticker||'⭐',color:x.color||'#a8738b'})}
    a.push(...clientItems(month));return a.sort((x,y)=>(x.date+(x.time||'')).localeCompare(y.date+(y.time||'')))
  }
  function planner(){
    const month=monthKey(selected),first=month+'-01',days=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate(),pad=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7,rows=plannerRows(month),cells=[];
    for(let i=0;i<pad;i++)cells.push('<div class="cal-cell cal-empty"></div>');
    for(let n=1;n<=days;n++){const d=month+'-'+String(n).padStart(2,'0'),r=rows.filter(x=>x.date===d);cells.push('<button class="cal-cell '+(d===today()?'today ':'')+(d===selected?'selected':'')+'" data-v3-day="'+d+'"><b>'+n+'</b><span class="cal-dots">'+r.slice(0,4).map(x=>'<i style="background:'+x.color+'"></i>').join('')+'</span><small>'+((r.length?String(r.length)+' عنصر':''))+'</small></button>')}
    const r=rows.filter(x=>x.date===selected);
    return '<div class="panel glass-panel"><div class="row between"><div><h2>Calendar Planner</h2><p class="sub">اضغطي على التاريخ ليظهر كل ما عندك فيه.</p></div><div class="row"><button class="soft" data-v3-month="-1">‹</button><strong>'+dateLabel(first)+'</strong><button class="soft" data-v3-month="1">›</button></div></div><div class="calendar-week"><span>الإثنين</span><span>الثلاثاء</span><span>الأربعاء</span><span>الخميس</span><span>الجمعة</span><span>السبت</span><span>الأحد</span></div><div class="calendar-grid">'+cells.join('')+'</div></div>'+
    '<div class="panel"><h3>'+dateLabel(selected)+'</h3>'+(r.map(x=>'<div class="item"><span class="event-chip" style="--chip:'+x.color+'">'+x.icon+'</span><div class="grow"><b>'+safe(x.title)+'</b><small>'+(x.time?safe(x.time)+' · ':'')+(x.kind==='client'?'مشروع عميل':x.kind==='task'?'مهمة':x.kind==='project'?'مشروع':'موعد')+'</small></div>'+(x.kind==='client'?'<button data-v3-open="'+x.cid+':'+x.pid+'">فتح المشروع</button>':'')+'</div>').join('')||'<div class="empty">ما في شيء مسجّل لهذا اليوم</div>')+'</div>'+
    '<div class="panel"><h3>إضافة موعد</h3><form id="v3Event"><div class="row"><label class="field">الاسم<input name="title" required></label><label class="field">التاريخ<input name="date" type="date" value="'+selected+'" required></label><label class="field">الوقت<input name="time" type="time"></label><label class="field">اللون<select name="color"><option value="#7f96ad">أزرق</option><option value="#749485">أخضر</option><option value="#bb925c">ذهبي</option><option value="#a8738b">وردي</option></select></label></div><div class="row"><label class="field">التكرار<select name="repeat"><option value="none">مرة واحدة</option><option value="daily">يومي</option></select></label><label class="field">تغيير الوقت يوميًا بالدقائق<input name="drift" type="number" step="1" value="0"></label><label class="field">حتى تاريخ<input name="until" type="date"></label></div><button class="primary">إضافة</button></form></div>'
  }
  function fastTips(){
    const d=new Date(selected+'T12:00:00Z'),w=d.getUTCDay(),t=[];
    if(data.fastingPrefs.mondayThursday&&(w===1||w===4))t.push(w===1?'الاثنين':'الخميس');
    try{const p=new Intl.DateTimeFormat('en-u-ca-islamic',{day:'numeric',month:'numeric',timeZone:TZ}).formatToParts(d),hd=Number(p.find(x=>x.type==='day')?.value),hm=Number(p.find(x=>x.type==='month')?.value);if(data.fastingPrefs.whiteDays&&[13,14,15].includes(hd))t.push('الأيام البيض');if(data.fastingPrefs.ashura&&hm===1&&hd===10)t.push('عاشوراء');if(data.fastingPrefs.arafah&&hm===12&&hd===9)t.push('عرفة')}catch{}return t
  }
  function worship(){
    const prayers=['الفجر','الظهر','العصر','المغرب','العشاء'],p=data.prayerChecks?.[selected]||{},fast=data.fastingLog.find(x=>x.date===selected),tips=fastTips(),dh=(data.dhikrs||[]).filter(x=>activeDhikr(x,selected));
    const prayerCard=n=>{const works=(data.prayerWorks||[]).filter(x=>x.prayer===n),done=works.filter(x=>x.completed?.[selected]).length,autoDone=works.length>0&&done===works.length,doneNow=!!p[n]||autoDone;return '<button type="button" class="prayer-card prayer-page-card '+(doneNow?'prayer-complete':'')+'" data-prayer-open="'+n+'"><span class="prayer-card-title">🕌 '+n+'</span><small>'+(works.length?done+' / '+works.length+' أعمال':doneNow?'✓ منجزة':'اضغطي لفتح الصفحة')+'</small><span class="prayer-card-state">'+(doneNow?'✓ منجزة':'فتح الصفحة')+'</span></button>'};
    return '<div class="panel"><h2>عبادتي</h2><p class="sub">اضغطي على أي صلاة لفتح صفحتها وإدارة الأعمال والورد المرتبط فيها.</p>'+datePicker()+'<div class="prayer-grid">'+prayers.map(prayerCard).join('')+'</div><p class="sub">المسجّل اليوم: '+prayers.filter(n=>p[n]||((data.prayerWorks||[]).filter(x=>x.prayer===n).length>0&&(data.prayerWorks||[]).filter(x=>x.prayer===n).every(x=>x.completed?.[selected]))).length+' من 5.</p></div>'+
    adhkarDaily()+prayerDetails()+quran()+ '<div class="panel"><div class="row between"><h3>الصيام</h3>'+(tips.length?'<span class="fast-tip">🌙 تذكير: '+safe(tips.join(' · '))+'</span>':'')+'</div><form id="v3Fast" class="row"><label class="field">نوع الصيام<select name="type">'+['قضاء رمضان','نفل','نذر','كفارة','لوجه الله تعالى'].map(v=>'<option '+(fast?.type===v?'selected':'')+'>'+v+'</option>').join('')+'</select></label><label class="field">التاريخ<input name="date" type="date" value="'+selected+'"></label><label class="field">ملاحظة<input name="note" value="'+safe(fast?.note||'')+'"></label><button class="primary">'+(fast?'تحديث':'تسجيل')+'</button></form>'+(fast?'<div class="notice">مسجّل: '+safe(fast.type)+' <button class="soft" data-v3-fast-del="'+fast.id+'">حذف</button></div>':'')+'<details><summary>تذكيرات صيام النفل</summary><div class="fasting-prefs"><label><input type="checkbox" data-v3-pref="mondayThursday" '+(data.fastingPrefs.mondayThursday?'checked':'')+'> الاثنين والخميس</label><label><input type="checkbox" data-v3-pref="whiteDays" '+(data.fastingPrefs.whiteDays?'checked':'')+'> الأيام البيض</label><label><input type="checkbox" data-v3-pref="arafah" '+(data.fastingPrefs.arafah?'checked':'')+'> عرفة</label><label><input type="checkbox" data-v3-pref="ashura" '+(data.fastingPrefs.ashura?'checked':'')+'> عاشوراء</label></div></details></div>'+
    '<div class="panel worship-dhikr-panel"><div class="row between"><div><h3>أذكاري</h3><p class="sub">الإضافة والتعديل والحذف من هون فقط.</p></div><strong>مجموع اليوم: '+sum((data.dhikrs||[]).map(x=>dhikrCount(x,selected)))+'</strong></div>'+
      '<form id="v3DhikrNew" class="dhikr-new-form"><label class="field">الذكر<input name="title" required placeholder="مثلاً: سبحان الله"></label><label class="field">الهدف اليومي<input name="target" type="number" inputmode="numeric" min="1" step="1" required value="33"></label><label class="field">يبدأ يوم<input name="start" type="date" required value="'+selected+'"></label><label class="field">ينتهي يوم (اختياري)<input name="end" type="date"></label><button class="primary">إضافة ذكر</button></form>'+
      (dh.map(x=>'<div class="dhikr-manage-card"><div class="dhikr-copy"><b>'+safe(x.title)+'</b><small>'+dhikrCount(x,selected)+' / '+dhikrTargetOn(x,selected)+' اليوم'+(dhikrCount(x,selected)>=dhikrTargetOn(x,selected)?' · ✓ مكتمل':'')+'</small><div class="bar"><i style="width:'+Math.min(100,pct(dhikrCount(x,selected),dhikrTargetOn(x,selected)))+'%"></i></div></div><div class="dhikr-count-row"><button class="dhikr-plus" data-v3-dhikr="'+x.id+'">+1</button><label class="field dhikr-number-field">إضافة عدد<input type="number" inputmode="numeric" min="1" step="1" placeholder="مثلاً 40" data-v3-dhikr-amount="'+x.id+'"></label><button class="primary" data-v3-dhikr-add="'+x.id+'">إضافة</button></div><div class="dhikr-manage-actions"><button class="soft" data-v3-dhikr-edit="'+x.id+'">تصحيح المجموع</button><button class="soft" data-v3-dhikr-target="'+x.id+'">تعديل الهدف</button><button class="soft" data-v3-dhikr-stop="'+x.id+'">إيقاف</button><button class="danger" data-v3-dhikr-del="'+x.id+'">حذف</button></div></div>').join('')||'<div class="empty">أضيفي أول ذكر من هون.</div>')+
    '</div>'
  }
  function adhkarDaily(){
    const checks=data.adhkarChecks[selected]||{};
    return '<div class="panel"><h3>أذكار الصباح والمساء</h3><div class="prayer-grid">'+['أذكار الصباح','أذكار المساء'].map(n=>'<label class="prayer-card"><input type="checkbox" data-daily-adhkar="'+n+'" '+(checks[n]?'checked':'')+'><span>'+n+(checks[n]?' · ✓ تمت اليوم':'')+'</span></label>').join('')+'</div></div>';
  }
  function prayerDetails(){
    const n=state.prayer;if(!n)return '<div class="notice prayer-open-hint">اختاري صلاة من الأعلى لفتح صفحتها الخاصة.</div>';
    const q=data.quran,last=Number(q.lastPage)||0,logs=q.log.filter(x=>x.date===selected&&x.prayer===n),works=(data.prayerWorks||[]).filter(x=>x.prayer===n),done=works.filter(x=>x.completed?.[selected]).length,allDone=works.length>0&&done===works.length,manual=!!data.prayerChecks?.[selected]?.[n],complete=allDone||manual,pctDone=works.length?Math.round(done/works.length*100):(complete?100:0);
    return '<div class="panel prayer-detail-page">'+
      '<div class="row between prayer-detail-head"><div><button type="button" class="soft" data-prayer-back>‹ كل الصلوات</button><h2>🕌 صلاة '+safe(n)+'</h2><p class="sub">'+dateLabel(selected)+'</p></div><div class="prayer-status-badge '+(complete?'complete':'')+'">'+(complete?'✓ منجزة':'قيد الإنجاز')+'</div></div>'+
      '<div class="prayer-progress"><div class="row between"><b>إنجاز الأعمال</b><span>'+done+' / '+works.length+(works.length?' · '+pctDone+'%':'')+'</span></div><div class="bar"><i style="width:'+pctDone+'%"></i></div>'+(works.length&&allDone?'<p class="sub">✓ اكتملت كل الأعمال، وتم اعتبار الصلاة منجزة تلقائيًا.</p>':'')+'</div>'+
      '<div class="prayer-section"><div class="row between"><h3>الورد القرآني</h3><span class="badge">آخر صفحة '+last+'</span></div><div class="notice">'+(last<604?'القراءة التالية تبدأ من صفحة '+(last+1):'أتممتِ الختمة ✓')+'</div>'+logs.map(x=>'<div class="prayer-log">✓ '+(x.from===x.to?'تمت قراءة صفحة '+x.to:'تمت قراءة الصفحات '+x.from+'–'+x.to)+'</div>').join('')+
      (last<604?'<form id="prayerQuran" class="row prayer-quran-form"><label class="field">قرأتِ حتى صفحة<input name="page" type="number" inputmode="numeric" min="'+(last+1)+'" max="604" step="1" value="'+(last+1)+'" required></label><button class="primary">تسجيل القراءة</button></form>':'')+
      '<p class="sub">هذا نفس الورد الموجود في «وردي القرآني»، ويكمل معك بين الصلوات والأيام.</p></div>'+
      '<div class="prayer-section"><div class="row between"><div><h3>الأعمال بعد الصلاة</h3><p class="sub">علّمي «تم الإنجاز» لكل عمل. عند اكتمالها كلها، الصلاة تصير منجزة تلقائيًا.</p></div><button type="button" class="soft" data-prayer-mark-manual="'+n+'">'+(manual?'إلغاء الإنجاز اليدوي':'تحديد الصلاة منجزة يدويًا')+'</button></div>'+
      (works.map(x=>'<div class="prayer-work-card '+(x.completed?.[selected]?'done':'')+'"><label class="prayer-work-check"><input type="checkbox" data-prayer-work="'+x.id+'" '+(x.completed?.[selected]?'checked':'')+'><span>'+safe(x.title)+'</span></label><div class="prayer-work-actions"><button type="button" class="soft" data-prayer-work-edit="'+x.id+'">تعديل</button><button type="button" class="danger" data-prayer-work-delete="'+x.id+'">حذف</button></div></div>').join('')||'<div class="empty">ما أضفتِ أعمالًا لهذه الصلاة بعد.</div>')+
      '<form id="prayerWorkNew" class="row prayer-work-new"><label class="field">إضافة عمل لهذه الصلاة<input name="title" placeholder="مثلاً: أذكار بعد الصلاة أو سورة يس" required></label><button class="primary">إضافة عمل</button></form></div>'+
    '</div>';
  }
  function clients(){
    if(!data.clients.length||!state.client||!data.clients.some(x=>x.id===state.client))return '<div class="panel"><h2>العملاء والمشاريع</h2><form id="v3Client" class="row"><label class="field">اسم العميل<input name="name" required></label><button class="primary">إنشاء ملف</button></form><div class="client-grid">'+(data.clients.map(c=>'<button class="client-card" data-v3-client="'+c.id+'"><b>'+safe(c.name)+'</b><small>'+(c.projects||[]).length+' مشروع</small></button>').join('')||'<div class="empty">ما في عملاء بعد</div>')+'</div></div>';
    const c=data.clients.find(x=>x.id===state.client);c.projects??=[];
    if(!state.project||!c.projects.some(x=>x.id===state.project))return '<div class="panel"><button class="soft" data-v3-client-back>‹ كل العملاء</button><h2>'+safe(c.name)+'</h2><form id="v3ProjectNew"><div class="row"><label class="field">اسم المشروع<input name="title" required></label><label class="field">النوع<select name="type"><option>كرت دعوة</option><option>تصميم عرس</option><option>إعلان</option><option>تصميم آخر</option></select></label></div><div class="row"><label class="field">موعد التسليم<input name="due" type="date"></label><label class="field">موعد العرس/المناسبة<input name="event" type="date"></label><label class="field">النشر بعد المناسبة<select name="delay"><option value="1">بعد يوم</option><option value="2">بعد يومين</option><option value="3">بعد 3 أيام</option></select></label></div><div class="row"><label class="field">المبلغ المتفق ₪<input name="amount" type="number" min="0" step=".01"></label><label class="field">دفعة أولى ₪<input name="first" type="number" min="0" step=".01"></label></div><button class="primary">إضافة مشروع</button></form>'+(c.projects.map(p=>'<button class="project-card" data-v3-project="'+p.id+'"><div><b>'+safe(p.title)+'</b><small>'+safe(p.projectType||'مشروع')+' · '+(p.due?'التسليم '+dateLabel(p.due):'بدون موعد')+'</small></div><span>'+cash(Math.max(0,Number(p.amount||0)-projectPaid(p)))+' باقي</span></button>').join('')||'<div class="empty">أضيفي أول مشروع</div>')+'</div>';
    const p=c.projects.find(x=>x.id===state.project),paid=projectPaid(p),remain=Math.max(0,Number(p.amount||0)-paid),pub=publishDate(p);
    return '<div class="panel"><button class="soft" data-v3-project-back>‹ '+safe(c.name)+'</button><div class="row between"><div><h2>'+safe(p.title)+'</h2><span class="project-type">'+safe(p.projectType||'مشروع')+'</span></div><button class="'+(p.published?'primary':'soft')+'" data-v3-published="'+p.id+'">'+(p.published?'✓ تم النشر':'تحديد تم النشر')+'</button></div><div class="grid"><div class="stat">الحالة<b class="stat-small">'+safe(p.status||'جديد')+'</b></div><div class="stat">التسليم<b class="stat-small">'+(p.due?dateLabel(p.due):'—')+'</b></div><div class="stat">المناسبة<b class="stat-small">'+(p.eventDate?dateLabel(p.eventDate):'—')+'</b></div><div class="stat">المتفق<b>'+cash(p.amount)+'</b></div><div class="stat">المستلم<b>'+cash(paid)+'</b></div><div class="stat">المتبقي<b>'+cash(remain)+'</b></div></div>'+(pub?'<div class="notice">📱 موعد النشر: '+dateLabel(pub)+(p.published?' · ✓ تم':' · انشري المشروع وجهزي صور/Reel')+'</div>':'')+'<form id="v3ProjectEdit"><div class="row"><label class="field">الحالة<select name="status">'+['جديد','جاري','بانتظار العميل','تعديل','جاهز','تم التسليم','مغلق'].map(v=>'<option '+(p.status===v?'selected':'')+'>'+v+'</option>').join('')+'</select></label><label class="field">النوع<select name="type">'+['كرت دعوة','تصميم عرس','إعلان','تصميم آخر'].map(v=>'<option '+(p.projectType===v?'selected':'')+'>'+v+'</option>').join('')+'</select></label><label class="field">التسليم<input name="due" type="date" value="'+safe(p.due||'')+'"></label></div><div class="row"><label class="field">المناسبة<input name="event" type="date" value="'+safe(p.eventDate||'')+'"></label><label class="field">النشر بعد كم يوم<input name="delay" type="number" min="0" max="30" value="'+Number(p.publishDelay??1)+'"></label><label class="field">موعد نشر مخصص<input name="publish" type="date" value="'+safe(p.publishDate||'')+'"></label></div><label class="field">ملاحظات<textarea name="notes">'+safe(p.notes||'')+'</textarea></label><button class="primary">حفظ</button></form></div>'+
    '<div class="panel"><h3>المطلوب والتنفيذ</h3><form id="v3CheckNew" class="row"><label class="field">بند جديد<input name="text" required></label><button class="soft">إضافة</button></form>'+(p.checklist.map(i=>'<label class="check-row"><input type="checkbox" data-v3-check="'+i.id+'" '+(i.done?'checked':'')+'><span class="'+(i.done?'done':'')+'">'+safe(i.text)+'</span><button type="button" data-v3-check-del="'+i.id+'">×</button></label>').join('')||'<div class="empty">أضيفي المطلوب كبنود.</div>')+'</div>'+
    '<div class="panel project-time-panel"><div class="row between"><div><h3>⏱ وقت العمل على المشروع</h3><p class="sub">سجلي وقتك الحقيقي على هذا المشروع.</p></div><div class="project-total-time">الإجمالي <b>'+formatDuration(projectTotalTime(p))+'</b></div></div><div class="project-stopwatch" data-v3-project-clock>'+formatDuration(projectElapsed(p))+'</div><div class="row project-timer-actions">'+(p.timerState?.running?'<button class="soft" data-v3-timer-pause>⏸ إيقاف مؤقت</button><button class="primary" data-v3-timer-finish>■ إنهاء الجلسة</button>':'<button class="primary" data-v3-timer-start>▶ '+(Number(p.timerState?.elapsed||0)>0?'متابعة':'ابدأ العمل')+'</button>'+(Number(p.timerState?.elapsed||0)>0?'<button class="soft" data-v3-timer-finish>■ حفظ الجلسة</button>':''))+'</div>'+(p.timeSessions.length?'<div class="time-session-list">'+[...p.timeSessions].reverse().map(x=>'<div class="item"><div class="grow"><b>'+formatDuration(x.duration)+'</b><small>'+safe(x.date||'')+(x.note?' · '+safe(x.note):'')+'</small></div><button data-v3-time-del="'+x.id+'">حذف</button></div>').join('')+'</div>':'<div class="empty">ما في جلسات عمل محفوظة بعد.</div>')+'</div>'+
    '<div class="panel project-log-panel"><h3>🗓 سجل العمل</h3><form id="v3WorkLog"><div class="row"><label class="field">التاريخ<input name="date" type="date" value="'+today()+'" required></label><label class="field grow">شو عملتي؟<input name="text" placeholder="مثلاً: أرسلت التصميم للعميلة" required></label><button class="soft">إضافة للسجل</button></div></form>'+(p.workLog.length?'<div class="work-log-list">'+[...p.workLog].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>'<div class="work-log-row"><span class="work-log-date">'+safe(x.date||'')+'</span><div class="grow"><b>'+safe(x.text)+'</b>'+(x.duration?'<small>'+formatDuration(x.duration)+'</small>':'')+'</div><button data-v3-log-del="'+x.id+'">×</button></div>').join('')+'</div>':'<div class="empty">أضيفي أول تحديث للمشروع.</div>')+'</div>'+
    '<div class="panel"><h3>الدفعات</h3><form id="v3Pay" class="row"><label class="field">المبلغ<input name="amount" type="number" min=".01" step=".01" required></label><label class="field">التاريخ<input name="date" type="date" value="'+selected+'"></label><label class="field">ملاحظة<input name="note"></label><button class="soft">إضافة دفعة</button></form>'+(p.payments.map(x=>'<div class="item"><div class="grow"><b>'+cash(x.amount)+'</b><small>'+safe(x.date)+' · '+safe(x.note||'')+'</small></div><button data-v3-pay-del="'+x.id+'">حذف</button></div>').join('')||'<div class="empty">ما في دفعات.</div>')+'</div>'+
    '<div class="panel"><h3>الصور والاعتمادات</h3><form id="v3Assets"><div class="row"><label class="field">الصور<input name="file" type="file" accept="image/png,image/jpeg,image/webp" multiple required></label><label class="field">الحالة<select name="status"><option>مرجع</option><option>قيد العمل</option><option>معتمدة</option><option>غير معتمدة</option><option>تحتاج تعديل</option><option>نهائية</option></select></label><label class="field">ملاحظة<input name="caption"></label></div><div class="upload-preview" data-v3-preview></div><p class="sub" data-v3-status></p><button class="soft">إضافة الصور</button></form><div class="asset-grid">'+(p.assets.map(a=>'<div class="asset-card"><div class="media-box" data-v3-media="'+safe(a.local||a.path||'')+'"></div><b>'+safe(a.status)+'</b><small>'+safe(a.caption||'')+'</small><button data-v3-asset-del="'+a.id+'">حذف</button></div>').join('')||'<div class="empty">ما في صور.</div>')+'</div></div>'
  }
  function learning(){
    if(!state.course||!data.learningSpaces.some(x=>x.id===state.course))return '<div class="panel"><h2>دفتر تعلّمي</h2><form id="v3Course" class="row"><label class="field">اسم الدورة<input name="title" required></label><button class="primary">إضافة دورة</button></form><div class="client-grid">'+(data.learningSpaces.map(c=>'<button class="client-card" data-v3-course="'+c.id+'"><b>'+safe(c.title)+'</b><small>'+(c.items||[]).length+' مادة</small></button>').join('')||'<div class="empty">أضيفي دورة.</div>')+'</div></div>';
    const c=data.learningSpaces.find(x=>x.id===state.course);c.items??=[];
    return '<div class="panel"><button class="soft" data-v3-course-back>‹ كل الدورات</button><h2>'+safe(c.title)+'</h2><form id="v3CourseItem"><div class="row"><label class="field">العنوان<input name="title" required></label><label class="field">النوع<select name="type"><option value="note">ملاحظة</option><option value="video">فيديو/رابط</option><option value="image">صورة نوت</option></select></label><label class="field">الرابط<input name="url" type="url"></label><label class="field">الصورة<input name="file" type="file" accept="image/png,image/jpeg,image/webp"></label></div><label class="field">ملاحظاتي<textarea name="note"></textarea></label><label><input name="watched" type="checkbox"> تم</label><p class="sub" data-v3-learning-status></p><button class="primary">حفظ</button></form></div><div class="panel">'+(c.items.map(i=>'<div class="learning-item '+(i.watched?'done-card':'')+'">'+(i.media?'<div class="learning-media media-box" data-v3-media="'+safe(i.media.local||i.media.path||'')+'"></div>':i.src?'<img src="'+i.src+'" alt="">':'')+'<div class="grow"><b>'+safe(i.title)+'</b><small>'+safe(i.type)+'</small><p>'+safe(i.note||'')+'</p>'+(i.url?'<a href="'+safe(i.url)+'" target="_blank">فتح الرابط</a>':'')+'</div><button data-v3-course-toggle="'+i.id+'">'+(i.watched?'إرجاع':'تم')+'</button></div>').join('')||'<div class="empty">ما في مواد.</div>')+'</div>'
  }
  function customize(){
    const d=data.designSettings,bgSaved=d,tCfg=transparencyConfig(),tPages=tCfg.pages||{};
    const pagesOptions=[
      ['home','يومي'],['worship','عبادتي'],['planner','التقويم'],['clients','العملاء'],['learning','تعلّمي'],
      ['finance','مالي'],['tasks','مهامي'],['wellness','عاداتي'],['quran','وردي القرآني'],['achievements','إنجازاتي'],
      ['notes','ملاحظات'],['diary','مذكرتي'],['memories','ذكرياتي'],['care','عنايتي'],['cycle','دورتي'],['reports','التقارير'],
      ['customize','تخصيص']
    ];
    let bgDestination='all';
    if(bgSaved.applyAll===false)bgDestination=bgSaved.targetPage==='lock'?'login':'page';
    else if(bgSaved.includeLogin)bgDestination='all-login';
    const transDestination=tCfg.lastDestination||'page',transTarget=tCfg.lastTarget||'home',trans=Number(tPages[transTarget]??35);
    const currentBg=d.background,currentBgRef=d.backgroundMedia?.path||d.backgroundMedia?.local||'';
    return '<div class="panel customize-main"><h2>تصميم يومي</h2><p class="sub">الخلفية والشفافية صار لكل واحدة زر تطبيق ومكان مستقل.</p>'+
      '<form id="v3Bg"><h3>صورة عرضية للخلفية</h3><p class="sub">ارفعي الصورة من الهاتف أو اللابتوب. سجّلي الدخول بنفس الحساب حتى تظهر على الجهازين.</p><label class="upload-zone" for="v3BgFile"><input id="v3BgFile" name="file" class="upload-zone-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"><span class="upload-zone-icon">⬆️</span><b>اضغطي هنا لاختيار صورة</b><small>JPG · PNG · WebP</small></label><div class="upload-preview upload-preview-large" data-v3-bg-prev>'+(currentBgRef?'<div class="media-box bg-current-media" data-v3-media="'+safe(currentBgRef)+'"></div>':currentBg?'<img src="'+currentBg+'" alt="الخلفية الحالية">':'')+'</div><p class="sub upload-status" data-v3-bg-status>'+((currentBgRef||currentBg)?'✓ في خلفية محفوظة ومربوطة بالحساب':'ما تم اختيار صورة بعد')+'</p>'+
      '<label class="field">تطبيق الصورة على<select name="destination"><option value="login" '+(bgDestination==='login'?'selected':'')+'>صفحة الدخول فقط</option><option value="all" '+(bgDestination==='all'?'selected':'')+'>كل صفحات التطبيق</option><option value="all-login" '+(bgDestination==='all-login'?'selected':'')+'>كل الصفحات + صفحة الدخول</option><option value="page" '+(bgDestination==='page'?'selected':'')+'>صفحة محددة</option></select></label>'+
      '<label class="field" data-bg-page-picker>اختاري الصفحة<select name="target">'+pagesOptions.map(([k,v])=>'<option value="'+k+'" '+(bgSaved.targetPage===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
      '<div class="row"><label class="field">مكان الصورة أفقيًا<input name="bgX" type="range" min="0" max="100" value="'+Number(d.bgX??50)+'"></label><label class="field">مكان الصورة عموديًا<input name="bgY" type="range" min="0" max="100" value="'+Number(d.bgY??50)+'"></label><label class="field">تكبير الصورة<input name="bgZoom" type="range" min="100" max="200" value="'+Number(d.bgZoom??100)+'"></label></div><div class="row"><button class="primary">تطبيق الصورة</button><button type="button" class="soft" data-v3-bg-clear>إزالة الخلفية الحالية</button></div></form></div>'+
    '<div class="panel"><h3>شفافية المربعات</h3><p class="sub">اختاري الصفحة والشفافية بشكل مستقل عن الصورة.</p><form id="v3Transparency">'+
      '<label class="field">تطبيق الشفافية على<select name="destination"><option value="login" '+(transDestination==='login'?'selected':'')+'>صفحة الدخول فقط</option><option value="all" '+(transDestination==='all'?'selected':'')+'>كل صفحات التطبيق</option><option value="all-login" '+(transDestination==='all-login'?'selected':'')+'>كل الصفحات + صفحة الدخول</option><option value="page" '+(transDestination==='page'?'selected':'')+'>صفحة محددة</option></select></label>'+
      '<label class="field" data-trans-page-picker>اختاري الصفحة<select name="target">'+pagesOptions.map(([k,v])=>'<option value="'+k+'" '+(transTarget===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
      '<label class="field transparency-control"><span>الشفافية: <b data-v3-trans-value>'+trans+'%</b></span><input name="transparency" type="range" min="0" max="95" step="1" value="'+trans+'"><small class="sub">0% = واضحة، 95% = شفافة جدًا</small></label>'+
      '<div class="transparency-preview"><div class="preview-card" data-v3-trans-preview>معاينة المربعات</div></div>'+
      '<div class="row"><button class="primary">تطبيق الشفافية</button><button type="button" class="soft" data-v3-trans-reset>إلغاء شفافية الصفحة المختارة</button></div>'+
    '</form></div>'+
    '<div class="panel"><h3>شريط الصفحات</h3><p class="sub">اختاري إذا بدك شريط التنقل ظاهر أو مخفي، لكل صفحة أو لكل التطبيق.</p><form id="v3NavVisibility">'+
      '<label class="field">تطبيق على<select name="destination"><option value="all">كل صفحات التطبيق</option><option value="page" selected>صفحة محددة</option></select></label>'+
      '<label class="field" data-nav-page-picker>اختاري الصفحة<select name="target">'+pagesOptions.map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label>'+
      '<label class="field">حالة الشريط<select name="visible"><option value="show">إظهار الشريط</option><option value="hide">إخفاء الشريط</option></select></label>'+
      '<button class="primary">تطبيق على شريط الصفحات</button></form></div>'+
    '<div class="panel customize-page-preview"><div class="row between"><div><h3>معاينة الصفحة كاملة</h3><p class="sub">اختاري الصفحة ثم افتحي معاينة كبيرة قبل التطبيق.</p></div><button type="button" class="primary" data-v3-preview-open>فتح المعاينة</button></div>'+
      '<label class="field">الصفحة التي تريدين معاينتها<select id="v3PreviewPage"><option value="lock">صفحة الدخول</option>'+pagesOptions.map(([k,v])=>'<option value="'+k+'" '+((bgSaved.targetPage||transTarget)==k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
      '<dialog id="v3PreviewDialog" class="preview-dialog"><div class="preview-dialog-head"><div><h3>معاينة الصفحة</h3><p class="sub">هذه معاينة فقط، بدون حفظ.</p></div><div class="preview-device-switch"><button type="button" class="soft active" data-v3-preview-device="desktop">لابتوب</button><button type="button" class="soft" data-v3-preview-device="mobile">موبايل</button><button type="button" class="soft" data-v3-preview-close>إغلاق</button></div></div><div class="full-page-preview desktop" data-v3-full-preview><div class="full-preview-screen"></div></div></dialog></div>'+
    '<div class="panel"><h3>Stickers</h3><p class="sub">ممكن ترفعي PNG بخلفية شفافة أو تستخدمي Emoji، واختاري إذا يكون ثابت على الشاشة أو مرتبط بالصفحة.</p><form id="v3Sticker"><div class="row"><label class="field">صورة Sticker<input name="file" type="file" accept="image/png,image/webp,image/jpeg,.jpg,.jpeg,.png,.webp"></label><label class="field">أو Emoji<input name="text" maxlength="8" placeholder="مثلاً 🌸"></label><label class="field">الصفحة<select name="target"><option value="all">كل التطبيق</option><option value="lock">صفحة الدخول</option><option value="home">يومي</option><option value="planner">التقويم</option><option value="worship">عبادتي</option><option value="learning">تعلّمي</option><option value="clients">العملاء</option><option value="finance">مالي</option></select></label><label class="field">التثبيت<select name="positionMode"><option value="screen">ثابت على الشاشة</option><option value="page">مرتبط بالصفحة</option></select></label></div><div class="row"><label class="field">أفقي<input name="x" type="range" min="5" max="95" value="85"></label><label class="field">عمودي<input name="y" type="range" min="5" max="95" value="18"></label><label class="field">الحجم<input name="size" type="range" min="24" max="140" value="54"></label></div><div class="upload-preview" data-v3-sticker-prev></div><button class="soft">إضافة Sticker</button></form>'+(d.stickers.map(s=>'<div class="item"><div class="grow"><div class="sticker-thumb" '+((s.local||s.path)?'data-v3-media="'+safe(s.path||s.local)+'"':'')+'>'+safe(s.text||'')+'</div><small>'+safe(s.target||'all')+' · '+(s.positionMode==='page'?'مرتبط بالصفحة':'ثابت على الشاشة')+' · '+s.size+'px</small></div><button data-v3-sticker-toggle="'+s.id+'">'+(s.hidden?'إظهار':'إخفاء')+'</button><button data-v3-sticker-del="'+s.id+'">حذف</button></div>').join('')||'<div class="empty">ما في Stickers.</div>')+'</div>'
  }

  function previewPageLabel(k){
    return ({lock:'صفحة الدخول',home:'يومي',worship:'عبادتي',planner:'التقويم',clients:'العملاء',learning:'تعلّمي',finance:'مالي',tasks:'مهامي',wellness:'عاداتي',quran:'وردي القرآني',achievements:'إنجازاتي',notes:'ملاحظات',diary:'مذكرتي',memories:'ذكرياتي',care:'عنايتي',cycle:'دورتي',reports:'التقارير',customize:'تخصيص'})[k]||'يومي'
  }
  function previewBody(k){
    if(k==='lock')return '<div class="mock-lock-card"><div class="mock-flower">🌺</div><h2>أهلاً بك في يومي</h2><label>الإيميل<div class="mock-input">name@example.com</div></label><label>رمز الدخول<div class="mock-input mock-pin">••••</div></label><div class="mock-primary">دخول</div></div>';
    if(k==='planner'){
      const cells=Array.from({length:35},(_,i)=>'<div class="mock-day '+([8,13,21].includes(i)?'has-event ':'')+(i===16?'selected':'')+'"><b>'+((i%30)+1)+'</b><span></span></div>').join('');
      return '<div class="mock-page-heading"><div><small>Calendar Planner</small><h2>التقويم</h2></div><div class="mock-pill">أكتوبر 2026</div></div><div class="mock-calendar">'+cells+'</div><div class="mock-card wide"><b>مواعيد اليوم</b><p>مشروع عميل · مهمة · موعد</p></div>';
    }
    if(k==='diary')return '<div class="mock-editorial"><div class="mock-card tall"><small>#Back to me</small><h2>Behind the story~</h2><div class="mock-line"></div><div class="mock-line short"></div><div class="mock-input tallbox"></div><div class="mock-primary">حفظ في مذكرتي</div></div><div class="mock-card tall"><small>Archived by you</small><h3>قصصي المحفوظة</h3><div class="mock-story-row"></div><div class="mock-story-row"></div><div class="mock-story-row short"></div></div></div>';
    if(k==='memories')return '<div class="mock-page-heading"><div><small>#Back to memories</small><h2>Behind the story~</h2></div><div class="mock-primary small">＋ ذكرى</div></div><div class="mock-memory-main"><div class="mock-memory-glass"><small>07.10.2026</small><h2>My story</h2><p>تفاصيل الذكرى تظهر فوق الصورة بطريقة Glass.</p></div></div><div class="mock-memory-side"><div></div><div></div></div>';
    if(k==='clients')return '<div class="mock-page-heading"><h2>العملاء والمشاريع</h2><div class="mock-pill">مشروع جاري</div></div><div class="mock-grid"><div class="mock-card"><b>عميل 01</b><p>3 مشاريع</p></div><div class="mock-card"><b>عميل 02</b><p>مشروع واحد</p></div><div class="mock-card"><b>وقت العمل</b><p>2 س 35 د</p></div><div class="mock-card"><b>سجل العمل</b><p>آخر تحديث اليوم</p></div></div>';
    if(k==='tasks')return '<div class="mock-page-heading"><h2>مهامي</h2><div class="mock-pill">اليوم</div></div><div class="mock-card wide"><div class="mock-task">○ مهمة جديدة</div><div class="mock-task">○ مهمة ثانية</div><div class="mock-task done">✓ مهمة منجزة</div></div><div class="mock-grid"><div class="mock-card"><b>إنجاز اليوم</b><p>67%</p></div><div class="mock-card"><b>الاستمرارية</b><p>8 أيام</p></div></div>';
    const label=previewPageLabel(k);
    return '<div class="mock-page-heading"><div><small>يومي</small><h2>'+safe(label)+'</h2></div><div class="mock-pill">'+dateLabel(today())+'</div></div><div class="mock-grid"><div class="mock-card"><b>بطاقة رئيسية</b><p>المحتوى يظهر هنا.</p></div><div class="mock-card"><b>ملخص</b><p>بيانات الصفحة.</p></div><div class="mock-card wide"><b>'+safe(label)+'</b><div class="mock-line"></div><div class="mock-line short"></div></div></div>';
  }
  async function refreshFullPreview(){
    const wrap=document.querySelector('[data-v3-full-preview]'),screen=wrap?.querySelector('.full-preview-screen'),sel=document.getElementById('v3PreviewPage');if(!wrap||!screen||!sel)return;
    const k=sel.value,bgForm=document.getElementById('v3Bg'),transForm=document.getElementById('v3Transparency'),navForm=document.getElementById('v3NavVisibility');
    let savedBg=data.designSettings.background||'',bgUrl=pendingBackgroundPreviewUrl||savedBg;if(!bgUrl&&data.designSettings.backgroundMedia){try{const blob=await blobFor(data.designSettings.backgroundMedia.path||data.designSettings.backgroundMedia.local);if(blob){bgUrl=URL.createObjectURL(blob);urls.add(bgUrl)}}catch{}}
    const trans=transForm?Math.max(0,Math.min(95,Number(transForm.elements.transparency.value||35))):35,alpha=Math.max(.05,(100-trans)/100);
    const navVisible=navForm?navForm.elements.visible.value!=='hide':(navConfig().pages?.[k]!==false);
    const labels=['يومي','عبادتي','التقويم','العملاء','مهامي'];
    const navHtml=k==='lock'?'':(navVisible?'<aside class="mock-nav">'+labels.map((x,i)=>'<span class="'+((k==='home'&&i===0)||(k==='planner'&&i===2)||(k==='clients'&&i===3)||(k==='tasks'&&i===4)?'active':'')+'">'+x+'</span>').join('')+'</aside>':'');
    screen.dataset.previewPage=k;
    const ds=data.designSettings;
    screen.style.backgroundPosition=(bgForm?.elements.bgX.value??ds.bgX??50)+'% '+(bgForm?.elements.bgY.value??ds.bgY??50)+'%';
    const zoom=Number(bgForm?.elements.bgZoom.value??ds.bgZoom??100);screen.style.backgroundSize=zoom===100?'cover':zoom+'% auto';
    screen.style.setProperty('--mock-alpha',String(alpha));
    screen.style.backgroundImage=bgUrl?'linear-gradient(rgba(24,24,24,.08),rgba(24,24,24,.08)),url("'+bgUrl+'")':'linear-gradient(135deg,#eee2d4,#f7f1e8)';
    screen.innerHTML=k==='lock'?previewBody(k):'<div class="mock-topbar"><b>يومي ✿</b><span>'+safe(previewPageLabel(k))+'</span></div><div class="mock-app-shell">'+navHtml+'<main class="mock-content">'+previewBody(k)+'</main></div>';
  }

  function specialDateHome(){
    const dates=data.importantDates||[],visible=dates.filter(x=>x.showHome!==false),hidden=dates.filter(x=>x.showHome===false);
    const cards=visible.map(x=>{
      let target=x.date;if(x.yearly)target=today().slice(0,4)+'-'+String(x.date||'').slice(5);
      const diff=target?daysBetween(today(),target):0;
      const count=diff===0?'اليوم':diff>0?'باقي '+diff+' يوم':'مرّ '+Math.abs(diff)+' يوم';
      return '<div class="special-home-row"><span class="big-sticker">'+safe(x.sticker||'⭐')+'</span><div class="grow"><b>'+safe(x.title)+'</b><small>'+safe(target?dateLabel(target):'')+' · '+count+'</small></div><button class="soft" data-v3-special-hide="'+x.id+'">إخفاء من يومي</button></div>'
    }).join('');
    return '<div class="panel special-date-card v3-special-home"><div class="row between"><h3>✨ اليوم المميز</h3>'+(hidden.length?'<button class="soft" data-v3-special-show-all>إرجاع المخفي ('+hidden.length+')</button>':'')+'</div>'+(cards||'<div class="empty">ما في تاريخ مميز ظاهر حاليًا.'+(hidden.length?' اضغطي «إرجاع المخفي».':'')+'</div>')+'</div>'
  }

  function homeExtra(){
    const dh=(data.dhikrs||[]).filter(x=>activeDhikr(x,selected)).slice(0,4),work=clientItems(monthKey(selected)).filter(x=>x.date>=selected).slice(0,4);
    return '<div class="panel quick-dhikr"><div class="row between"><h3>أذكاري السريعة</h3><button class="soft" data-go="worship">عبادتي</button></div>'+(dh.map(x=>'<div class="item"><div class="grow"><b>'+safe(x.title)+'</b><small>'+dhikrCount(x,selected)+' / '+dhikrTargetOn(x,selected)+'</small></div><button data-v3-dhikr="'+x.id+'">+1</button><button data-v3-dhikr-many="'+x.id+'">إضافة عدد</button></div>').join('')||'<div class="empty">أضيفي ذكرًا من مهامي.</div>')+'</div><div class="panel"><div class="row between"><h3>مواعيد مشاريع العملاء</h3><button class="soft" data-go="planner">التقويم</button></div>'+(work.map(x=>'<div class="item"><span class="event-chip" style="--chip:'+x.color+'">'+x.icon+'</span><div class="grow"><b>'+safe(x.title)+'</b><small>'+dateLabel(x.date)+'</small></div><button data-v3-open="'+x.cid+':'+x.pid+'">فتح</button></div>').join('')||'<div class="empty">ما في مواعيد قادمة.</div>')+'</div>'
  }
  function cycleExtra(){
    const ps=[...data.periods].sort((a,b)=>b.start.localeCompare(a.start)),open=ps.find(x=>!x.end),len=Number(data.cyclePeriodLength||7);
    return '<div class="panel v3-cycle"><div class="row between"><div><h2>تعديل سجل الدورة</h2><p class="sub">عدّلي التواريخ مباشرة من الخانات؛ بدون نوافذ منبثقة.</p></div><div class="cycle-usual"><label>المدة المعتادة <input id="v3CycleLen" type="number" min="1" max="14" value="'+len+'"> يوم</label><button class="soft" data-v3-cycle-save>حفظ</button></div></div>'+
      (open?'<div class="notice">النهاية المقترحة حسب المدة المعتادة: '+dateLabel(dayAfter(open.start,len-1))+' — تظل الدورة مفتوحة لحد ما تسجّلي النهاية.</div>':'')+
      (ps.map(x=>{const duration=x.end?daysBetween(x.start,x.end)+1:Math.max(1,daysBetween(x.start,today())+1);return '<form class="cycle-edit-card" data-v3-period-form="'+x.id+'"><div class="row"><label class="field">تاريخ البداية<input name="start" type="date" value="'+safe(x.start)+'" required></label><label class="field">تاريخ النهاية<input name="end" type="date" value="'+safe(x.end||'')+'"></label><div class="cycle-duration"><span>المدة</span><b>'+duration+' يوم</b></div></div><label class="field">ملاحظة<input name="symptom" value="'+safe(x.symptom||'')+'"></label><div class="row"><button class="primary">حفظ التعديل</button>'+(!x.end?'<button type="button" class="soft" data-v3-period-end="'+x.id+'">إنهاء اليوم</button>':'')+'<button type="button" class="danger" data-v3-period-del="'+x.id+'">حذف</button></div></form>'}).join('')||'<div class="empty">لا يوجد سجل.</div>')+'</div>'
  }
  function debtExtra(){
    return '<div class="panel v3-debts"><h2>حساب الأشخاص</h2><p class="sub">مستقل عن المصاريف والدخل.</p><form id="v3DebtPerson" class="row"><label class="field">الاسم<input name="name" required></label><button class="primary">إضافة شخص</button></form>'+((data.debtPeople||[]).map(p=>{const net=sum((p.transactions||[]).map(t=>Number(t.delta)||0));return '<div class="debt-person"><div class="row between"><b>'+safe(p.name)+'</b><strong>'+(net>0?cash(net)+' لصالحك':net<0?cash(Math.abs(net))+' عليك':'0 ₪')+'</strong></div><form class="row" data-v3-debt="'+p.id+'"><label class="field">الحركة<select name="type"><option value="owed">مبلغ مستحق لي</option><option value="owe">مبلغ مستحق عليّ</option><option value="received">استلام دفعة</option><option value="paid">دفع دفعة</option></select></label><label class="field">المبلغ<input name="amount" type="number" min=".01" step=".01" required></label><label class="field">التاريخ<input name="date" type="date" value="'+selected+'"></label><label class="field">ملاحظة<input name="note"></label><button class="soft">إضافة حركة</button></form></div>'}).join('')||'<div class="empty">أضيفي أول شخص.</div>')+'</div>'
  }

  function db(){return new Promise((ok,no)=>{const r=indexedDB.open('yomi-v3-media-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
  async function put(k,v){const d=await db();try{await new Promise((ok,no)=>{const t=d.transaction('files','readwrite');t.objectStore('files').put(v,k);t.oncomplete=ok;t.onerror=()=>no(t.error)})}finally{d.close()}}
  async function get(k){const d=await db();try{return await new Promise((ok,no)=>{const t=d.transaction('files','readonly'),r=t.objectStore('files').get(k);r.onsuccess=()=>ok(r.result||null);r.onerror=()=>no(r.error)})}finally{d.close()}}
  async function del(k){const d=await db();try{await new Promise((ok,no)=>{const t=d.transaction('files','readwrite');t.objectStore('files').delete(k);t.oncomplete=ok;t.onerror=()=>no(t.error)})}finally{d.close()}}
  async function imageBlob(file,max=1500,q=.8,alpha=false){
    if(!file?.size)throw Error('no-file');
    const ext=(file.name.split('.').pop()||'').toLowerCase(),allowed=['png','jpg','jpeg','webp'];
    if(!(file.type||'').startsWith('image/')&&!allowed.includes(ext))throw Error('type');
    let source,width,height,cleanup=()=>{};
    try{
      if('createImageBitmap' in window){source=await createImageBitmap(file);width=source.width;height=source.height;cleanup=()=>source.close?.()}
      else throw Error('bitmap-unavailable');
    }catch{
      const url=URL.createObjectURL(file);cleanup=()=>URL.revokeObjectURL(url);
      source=await new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=url});
      width=source.naturalWidth||source.width;height=source.naturalHeight||source.height;
    }
    if(!width||!height){cleanup();throw Error('image-size')}
    const s=Math.min(1,max/Math.max(width,height)),cv=document.createElement('canvas');
    cv.width=Math.max(1,Math.round(width*s));cv.height=Math.max(1,Math.round(height*s));
    const ctx=cv.getContext('2d');if(!ctx){cleanup();throw Error('canvas')}
    ctx.drawImage(source,0,0,cv.width,cv.height);cleanup();
    const preferred=alpha?'image/webp':'image/jpeg';
    const blob=await new Promise(ok=>cv.toBlob(ok,preferred,q));
    if(blob)return blob;
    const fallback=await new Promise(ok=>cv.toBlob(ok,'image/png'));
    if(!fallback)throw Error('compress');return fallback;
  }
  async function saveImage(file,opt={}){
    if(!file?.size)throw Error('no-file');
    let b;
    try{b=await imageBlob(file,opt.max||1500,opt.q||.8,!!opt.alpha)}
    catch(err){
      console.warn('Image compression failed; saving original file instead',err);
      if(file.size>15*1024*1024)throw Error('file-too-large');
      b=file;
    }
    const local='local:'+id();
    await put(local,b);
    const verify=await get(local);if(!verify)throw Error('store-failed');
    return {local,mime:b.type||file.type||'image/jpeg',name:file.name||''}
  }
  function records(){const r=[];for(const c of data.clients)for(const p of c.projects||[])for(const a of p.assets||[])if(a.local&&!a.path)r.push(a);for(const c of data.learningSpaces)for(const i of c.items||[])if(i.media?.local&&!i.media?.path)r.push(i.media);if(data.designSettings.backgroundMedia?.local&&!data.designSettings.backgroundMedia?.path)r.push(data.designSettings.backgroundMedia);if(data.designSettings.audioMedia?.local&&!data.designSettings.audioMedia?.path)r.push(data.designSettings.audioMedia);for(const s of data.designSettings.stickers||[])if(s.local&&!s.path)r.push(s);return r}
  function extForBlob(b,name=''){const t=String(b?.type||'').toLowerCase();if(t.includes('webp'))return'webp';if(t.includes('png'))return'png';if(t.includes('jpeg')||t.includes('jpg'))return'jpg';if(t.includes('mpeg'))return'mp3';if(t.includes('mp4')||t.includes('m4a'))return'm4a';if(t.includes('wav'))return'wav';if(t.includes('ogg'))return'ogg';if(t.includes('aac'))return'aac';if(t.includes('webm'))return'webm';const e=String(name||'').split('.').pop()?.toLowerCase();return e&&/^[a-z0-9]{2,5}$/.test(e)?e:'bin'}
  async function syncMedia(){const s=window.yomiMemoriesSession?.();if(!s||!navigator.onLine)return;for(const r of records()){const old=r.local;try{const blob=await get(old);if(!blob)continue;const ext=extForBlob(blob,r.name),path=s.user.id+'/planner-'+id()+'.'+ext,{error}=await s.client.storage.from(bucket).upload(path,blob,{contentType:blob.type||r.mime||'application/octet-stream',upsert:false});if(error)throw error;await put(path,blob);await put(s.user.id+':'+path,blob);r.path=path;save()}catch(e){console.error('Media sync failed',e)}}}
  async function blobFor(ref){let blob=await get(ref);const s=window.yomiMemoriesSession?.();if(!blob&&s){blob=await get(s.user.id+':'+ref);if(!blob&&ref.startsWith(s.user.id+'/')&&navigator.onLine){const {data:x,error}=await s.client.storage.from(bucket).download(ref);if(error)throw error;blob=x;await put(ref,blob);await put(s.user.id+':'+ref,blob)}}return blob}
  async function saveRawFile(file){if(!file?.size)throw Error('no-file');if(file.size>50*1024*1024)throw Error('file-too-large');const local='local:'+id();await put(local,file);return{local,mime:file.type||'application/octet-stream',name:file.name||''}}
  window.yomiMediaSaveFile=saveRawFile;window.yomiMediaBlobFor=blobFor;window.yomiMediaSyncNow=syncMedia;
  let backgroundMigrationRunning=false;
  async function migrateBackgroundToMedia(){
    if(backgroundMigrationRunning||data.designSettings?.backgroundMedia||!String(data.designSettings?.background||'').startsWith('data:image/'))return;
    backgroundMigrationRunning=true;
    try{
      const blob=await fetch(data.designSettings.background).then(r=>r.blob()),local='local:'+id();
      await put(local,blob);data.designSettings.backgroundMedia={local,mime:blob.type||'image/jpeg',name:'background.jpg'};save();await syncMedia();
    }catch(e){console.warn('Background migration skipped',e)}
    finally{backgroundMigrationRunning=false}
  }
  function backgroundApplies(){
    const d=data.designSettings||{},lockVisible=!document.getElementById('lock')?.classList.contains('hidden');
    if(lockVisible)return d.applyAll!==false ? !!d.includeLogin : d.targetPage==='lock';
    if(d.applyAll!==false)return true;
    return d.targetPage===page;
  }
  function transparencyConfig(){
    const cloud=data.designSettings?.transparency;if(cloud?.pages)return cloud;
    const saved=JSON.parse(localStorage.getItem(TRANS_KEY)||'null');
    if(saved?.pages){data.designSettings.transparency=structuredClone(saved);return saved;}
    const old=JSON.parse(localStorage.getItem(BG_SCOPE_KEY)||'null');
    const pages={};
    if(old&&Number.isFinite(Number(old.panelTransparency))){
      const v=Math.max(0,Math.min(95,Number(old.panelTransparency)));
      const appPages=['home','worship','planner','clients','learning','finance','tasks','wellness','quran','achievements','notes','diary','memories','care','cycle','reports','customize'];
      if(old.applyAll!==false){for(const k of appPages)pages[k]=v;if(old.includeLogin)pages.lock=v}
      else if(old.targetPage)pages[old.targetPage]=v;
    }
    return {pages,lastDestination:'page',lastTarget:'home'};
  }
  function navConfig(){
    const cloud=data.designSettings?.navVisibility;if(cloud?.pages)return cloud;
    const saved=JSON.parse(localStorage.getItem(NAV_KEY)||'null');
    if(saved?.pages){data.designSettings.navVisibility=structuredClone(saved);return saved}
    return {pages:{},lastDestination:'page',lastTarget:'planner'};
  }
  function applyNavVisibility(){
    const nav=document.getElementById('nav');if(!nav)return;
    const lockVisible=!document.getElementById('lock')?.classList.contains('hidden');
    const cfg=navConfig(),hidden=!lockVisible&&cfg.pages?.[page]===false;
    nav.hidden=hidden;
    document.body.dataset.navHidden=hidden?'1':'0';
    let reveal=document.getElementById('yomiNavReveal');
    if(hidden&&!reveal){
      reveal=document.createElement('button');reveal.id='yomiNavReveal';reveal.type='button';reveal.className='soft yomi-nav-reveal';reveal.textContent='☰ الصفحات';
      reveal.onclick=()=>{const x=structuredClone(navConfig());x.pages[page]=true;data.designSettings.navVisibility=structuredClone(x);localStorage.setItem(NAV_KEY,JSON.stringify(x));save();applyNavVisibility()};
      document.body.appendChild(reveal);
    }else if(!hidden&&reveal)reveal.remove();
  }
  async function paint(){
    for(const u of urls)URL.revokeObjectURL(u);urls.clear();
    for(const box of document.querySelectorAll('[data-v3-media]'))try{const b=await blobFor(box.dataset.v3Media);if(!b||!box.isConnected)continue;const u=URL.createObjectURL(b);urls.add(u);const im=document.createElement('img');im.src=u;im.alt='';box.replaceChildren(im)}catch{}
    const lockVisible=!document.getElementById('lock')?.classList.contains('hidden'),currentKey=lockVisible?'lock':page,tCfg=transparencyConfig(),raw=tCfg.pages?.[currentKey],plannerDefault=!lockVisible&&page==='planner'&&raw===undefined,hasTransparency=raw!==undefined&&raw!==null||plannerDefault,trans=Math.max(0,Math.min(95,Number(plannerDefault?60:(raw??35))));
    document.body.dataset.yomiPage=lockVisible?'lock':page;
    document.body.dataset.yomiDesign=hasTransparency?'1':'0';
    document.documentElement.style.setProperty('--yomi-panel-alpha',String((100-trans)/100));
    let bgData='',bgMedia=data.designSettings?.backgroundMedia;
    if(backgroundApplies()&&bgMedia&&(bgMedia.path||bgMedia.local)){try{const blob=await blobFor(bgMedia.path||bgMedia.local);if(blob){bgData=URL.createObjectURL(blob);urls.add(bgData)}}catch(e){console.error('Background load failed',e)}}
    if(!bgData&&backgroundApplies())bgData=data.designSettings?.background||'';
    if(bgData){document.documentElement.style.setProperty('--yomi-user-bg','url("'+bgData+'")');document.body.dataset.userBg='1'}
    else{document.documentElement.style.setProperty('--yomi-user-bg','none');document.body.dataset.userBg='0'}
    document.documentElement.style.setProperty('--yomi-bg-position',(data.designSettings.bgX??50)+'% '+(data.designSettings.bgY??50)+'%');
    const zoom=Number(data.designSettings.bgZoom??100);document.documentElement.style.setProperty('--yomi-bg-size',zoom===100?'cover':zoom+'% auto');
    applyNavVisibility();migrateBackgroundToMedia();syncMedia()
  }
  function stickers(){
    document.querySelectorAll('.yomi-v3-sticker').forEach(x=>x.remove());
    const lock=!document.getElementById('lock')?.classList.contains('hidden');
    for(const s of data.designSettings.stickers||[]){if(s.hidden)continue;const t=s.target||'all';if(t!=='all'&&t!==page&&!(t==='lock'&&lock))continue;const e=document.createElement('div');e.className='yomi-v3-sticker';e.dataset.stickerMode=s.positionMode||'screen';e.style.left=Math.max(3,Math.min(97,Number(s.x)||50))+'%';e.style.top=Math.max(3,Math.min(97,Number(s.y)||50))+'%';e.style.width=e.style.height=Math.max(24,Math.min(180,Number(s.size)||54))+'px';e.style.fontSize=Math.max(24,Math.min(180,Number(s.size)||54))+'px';if(s.text)e.textContent=s.text;if(s.local||s.path)e.dataset.v3Media=s.path||s.local;const host=s.positionMode==='page'&&!lock?document.getElementById('view'):document.body;host?.appendChild(e)}
  }

  function attach(){
    document.querySelectorAll('[data-daily-adhkar]').forEach(b=>b.onchange=()=>{data.adhkarChecks[selected]??={};data.adhkarChecks[selected][b.dataset.dailyAdhkar]=b.checked;save();render()});
    const syncPrayerCompletion=n=>{data.prayerChecks[selected]??={};const works=(data.prayerWorks||[]).filter(x=>x.prayer===n);if(works.length&&works.every(x=>x.completed?.[selected]))data.prayerChecks[selected][n]=true;else if(data.prayerChecks[selected][n]==='auto')delete data.prayerChecks[selected][n]};
    document.querySelectorAll('[data-prayer-open]').forEach(b=>b.onclick=()=>{state.prayer=b.dataset.prayerOpen;render()});
    document.querySelector('[data-prayer-back]')?.addEventListener('click',()=>{state.prayer=null;render()});
    const pq=$('#prayerQuran');if(pq)pq.onsubmit=e=>{e.preventDefault();const from=Number(data.quran.lastPage||0)+1,to=parseCount(pq.elements.page.value);if(!Number.isSafeInteger(to)||to<from||to>604){alert('اكتبي صفحة صحيحة من '+from+' إلى 604');return}data.quran.log.push({id:id(),date:selected,prayer:state.prayer,from,to});data.quran.lastPage=to;save();render()};
    const pw=$('#prayerWorkNew');if(pw)pw.onsubmit=e=>{e.preventDefault();const title=pw.elements.title.value.trim();if(!title)return;data.prayerWorks.push({id:id(),prayer:state.prayer,title,completed:{}});save();render()};
    document.querySelectorAll('[data-prayer-work]').forEach(b=>b.onchange=()=>{const x=data.prayerWorks.find(x=>x.id===b.dataset.prayerWork);x.completed??={};if(b.checked)x.completed[selected]=true;else delete x.completed[selected];data.prayerChecks[selected]??={};const works=data.prayerWorks.filter(w=>w.prayer===state.prayer);if(works.length&&works.every(w=>w.completed?.[selected]))data.prayerChecks[selected][state.prayer]=true;else if(data.prayerChecks[selected][state.prayer]===true)delete data.prayerChecks[selected][state.prayer];save();render()});
    document.querySelectorAll('[data-prayer-work-edit]').forEach(b=>b.onclick=()=>{const x=data.prayerWorks.find(x=>x.id===b.dataset.prayerWorkEdit);if(!x)return;const v=prompt('عدّلي اسم العمل',x.title);if(v===null)return;const title=v.trim();if(!title)return;x.title=title;save();render()});
    document.querySelectorAll('[data-prayer-work-delete]').forEach(b=>b.onclick=()=>{if(confirm('حذف هذا العمل؟')){const x=data.prayerWorks.find(x=>x.id===b.dataset.prayerWorkDelete),prayer=x?.prayer;data.prayerWorks=data.prayerWorks.filter(x=>x.id!==b.dataset.prayerWorkDelete);if(prayer){const works=data.prayerWorks.filter(w=>w.prayer===prayer);data.prayerChecks[selected]??={};if(works.length&&works.every(w=>w.completed?.[selected]))data.prayerChecks[selected][prayer]=true;else delete data.prayerChecks[selected][prayer]}save();render()}});
    document.querySelectorAll('[data-prayer-mark-manual]').forEach(b=>b.onclick=()=>{data.prayerChecks[selected]??={};const n=b.dataset.prayerMarkManual;if(data.prayerChecks[selected][n])delete data.prayerChecks[selected][n];else data.prayerChecks[selected][n]=true;save();render()});

    document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{page=b.dataset.go;render()});
    document.querySelectorAll('[data-v3-day]').forEach(b=>b.onclick=()=>{selected=b.dataset.v3Day;render()});
    document.querySelectorAll('[data-v3-month]').forEach(b=>b.onclick=()=>{selected=monthOffset(selected,Number(b.dataset.v3Month));render()});
    document.querySelectorAll('[data-v3-open]').forEach(b=>b.onclick=()=>{const z=b.dataset.v3Open.split(':');state.client=z[0];state.project=z[1];page='clients';render()});
    const ev=$('#v3Event');if(ev)ev.onsubmit=e=>{e.preventDefault();const f=new FormData(ev);data.calendarEvents.push({id:id(),title:f.get('title').trim(),date:f.get('date'),time:f.get('time'),color:f.get('color'),sticker:'•',repeat:f.get('repeat')||'none',driftMinutes:Number(f.get('drift')||0),until:f.get('until')||'',done:false});selected=f.get('date');save();render()};
    document.querySelectorAll('[data-v3-prayer]').forEach(x=>x.onchange=()=>{data.prayerChecks[selected]??={};data.prayerChecks[selected][x.dataset.v3Prayer]=x.checked;save();render()});
    document.querySelectorAll('[data-v3-dhikr]').forEach(b=>b.onclick=()=>{const x=data.dhikrs.find(z=>z.id===b.dataset.v3Dhikr);x.counts??={};x.counts[selected]=(Number(x.counts[selected])||0)+1;save();render()});
    document.querySelectorAll('[data-v3-dhikr-many]').forEach(b=>b.onclick=()=>{const x=data.dhikrs.find(z=>z.id===b.dataset.v3DhikrMany),v=prompt('كم مرة بدك تضيفي؟','10');if(v===null)return;const n=parseCount(v);if(!Number.isSafeInteger(n)||n<1)return;x.counts??={};x.counts[selected]=(Number(x.counts[selected])||0)+n;save();render()});
    const dn=$('#v3DhikrNew');if(dn)dn.onsubmit=e=>{e.preventDefault();const f=new FormData(dn),start=f.get('start'),end=f.get('end'),target=Number(f.get('target'));if(end&&end<start){alert('تاريخ النهاية لازم يكون بعد البداية');return}if(!Number.isSafeInteger(target)||target<1){alert('اكتبي هدفًا صحيحًا بالأرقام');return}data.dhikrs.push({id:id(),title:f.get('title').trim(),target,start,end,counts:{}});save();render()};
    document.querySelectorAll('[data-v3-dhikr-add]').forEach(b=>b.onclick=()=>{const x=data.dhikrs.find(z=>z.id===b.dataset.v3DhikrAdd),input=document.querySelector('[data-v3-dhikr-amount="'+b.dataset.v3DhikrAdd+'"]'),n=Number(input?.value);if(!Number.isSafeInteger(n)||n<1){input?.focus();return}x.counts??={};x.counts[selected]=(Number(x.counts[selected])||0)+n;save();render()});
    document.querySelectorAll('[data-v3-dhikr-edit]').forEach(b=>b.onclick=()=>{const x=data.dhikrs.find(z=>z.id===b.dataset.v3DhikrEdit),v=prompt('المجموع الصحيح لليوم',String(dhikrCount(x,selected)));if(v===null)return;const n=parseCount(v);if(!Number.isSafeInteger(n)||n<0){alert('اكتبي رقمًا صحيحًا من صفر فما فوق');return}x.counts??={};x.counts[selected]=n;save();render()});
    document.querySelectorAll('[data-v3-dhikr-target]').forEach(b=>b.onclick=()=>{const x=data.dhikrs.find(z=>z.id===b.dataset.v3DhikrTarget),v=prompt('الهدف اليومي الجديد',String(dhikrTargetOn(x,selected)));if(v===null)return;const n=parseCount(v);if(!Number.isSafeInteger(n)||n<1){alert('اكتبي رقمًا صحيحًا أكبر من صفر');return}x.initialTarget??=x.target;x.targetHistory??=[];x.targetHistory=x.targetHistory.filter(item=>item.from!==selected);x.targetHistory.push({from:selected,target:n});x.targetHistory.sort((a,b)=>a.from.localeCompare(b.from));x.target=n;save();render()});
    document.querySelectorAll('[data-v3-dhikr-stop]').forEach(b=>b.onclick=()=>{const x=data.dhikrs.find(z=>z.id===b.dataset.v3DhikrStop);if(x&&confirm('إيقاف هذا الذكر من اليوم؟')){x.stopped=selected;save();render()}});
    document.querySelectorAll('[data-v3-dhikr-del]').forEach(b=>b.onclick=()=>{if(confirm('حذف هذا الذكر وكل سجله؟')){data.dhikrs=data.dhikrs.filter(x=>x.id!==b.dataset.v3DhikrDel);save();render()}});
    const ff=$('#v3Fast');if(ff)ff.onsubmit=e=>{e.preventDefault();const f=new FormData(ff),d=f.get('date'),o=data.fastingLog.find(x=>x.date===d),r={id:o?.id||id(),date:d,type:f.get('type'),note:f.get('note').trim()};o?Object.assign(o,r):data.fastingLog.push(r);selected=d;save();render()};
    document.querySelectorAll('[data-v3-fast-del]').forEach(b=>b.onclick=()=>{data.fastingLog=data.fastingLog.filter(x=>x.id!==b.dataset.v3FastDel);save();render()});
    document.querySelectorAll('[data-v3-pref]').forEach(x=>x.onchange=()=>{data.fastingPrefs[x.dataset.v3Pref]=x.checked;save();render()});

    const cf=$('#v3Client');if(cf)cf.onsubmit=e=>{e.preventDefault();const f=new FormData(cf),c={id:id(),name:f.get('name').trim(),projects:[]};data.clients.push(c);state.client=c.id;save();render()};
    document.querySelectorAll('[data-v3-client]').forEach(b=>b.onclick=()=>{state.client=b.dataset.v3Client;state.project=null;render()});
    document.querySelector('[data-v3-client-back]')?.addEventListener('click',()=>{state.client=null;state.project=null;render()});
    document.querySelectorAll('[data-v3-project]').forEach(b=>b.onclick=()=>{state.project=b.dataset.v3Project;render()});
    document.querySelector('[data-v3-project-back]')?.addEventListener('click',()=>{state.project=null;render()});
    const pn=$('#v3ProjectNew');if(pn)pn.onsubmit=e=>{e.preventDefault();const c=data.clients.find(x=>x.id===state.client),f=new FormData(pn),event=f.get('event'),delay=Number(f.get('delay')||1),p={id:id(),title:f.get('title').trim(),projectType:f.get('type'),due:f.get('due'),eventDate:event,publishDelay:delay,publishDate:event?dayAfter(event,delay):'',published:false,amount:Number(f.get('amount')||0),status:'جديد',assets:[],payments:[],checklist:[],workLog:[{id:id(),date:today(),text:'تم إنشاء المشروع',kind:'system'}],timeSessions:[],timerState:{elapsed:0,running:false,startedAt:null},notes:''},first=Number(f.get('first')||0);if(first>0)p.payments.push({id:id(),amount:first,date:selected,note:'دفعة أولى'});c.projects.push(p);state.project=p.id;save();render()};
    const pe=$('#v3ProjectEdit');if(pe)pe.onsubmit=e=>{e.preventDefault();const p=data.clients.find(x=>x.id===state.client).projects.find(x=>x.id===state.project),f=new FormData(pe);p.status=f.get('status');p.projectType=f.get('type');p.due=f.get('due');p.eventDate=f.get('event');p.publishDelay=Number(f.get('delay')||0);p.publishDate=f.get('publish')||(p.eventDate?dayAfter(p.eventDate,p.publishDelay):'');p.notes=f.get('notes');save();render()};
    document.querySelectorAll('[data-v3-published]').forEach(b=>b.onclick=()=>{const p=data.clients.find(x=>x.id===state.client).projects.find(x=>x.id===b.dataset.v3Published);p.published=!p.published;save();render()});
    const ck=$('#v3CheckNew');if(ck)ck.onsubmit=e=>{e.preventDefault();const p=data.clients.find(x=>x.id===state.client).projects.find(x=>x.id===state.project),f=new FormData(ck);p.checklist.push({id:id(),text:f.get('text').trim(),done:false});save();render()};
    document.querySelectorAll('[data-v3-check]').forEach(x=>x.onchange=()=>{const p=data.clients.find(c=>c.id===state.client).projects.find(p=>p.id===state.project),i=p.checklist.find(i=>i.id===x.dataset.v3Check);i.done=x.checked;if(x.checked)p.workLog.push({id:id(),date:today(),text:'تم إنجاز: '+i.text,kind:'check'});save();render()});
    document.querySelectorAll('[data-v3-check-del]').forEach(b=>b.onclick=()=>{const p=data.clients.find(c=>c.id===state.client).projects.find(p=>p.id===state.project);p.checklist=p.checklist.filter(i=>i.id!==b.dataset.v3CheckDel);save();render()});
    const wl=$('#v3WorkLog');if(wl)wl.onsubmit=e=>{e.preventDefault();const p=data.clients.find(c=>c.id===state.client).projects.find(p=>p.id===state.project),f=new FormData(wl);p.workLog.push({id:id(),date:f.get('date')||today(),text:f.get('text').trim(),kind:'manual'});save();render()};
    document.querySelectorAll('[data-v3-log-del]').forEach(b=>b.onclick=()=>{const p=data.clients.find(c=>c.id===state.client).projects.find(p=>p.id===state.project);p.workLog=p.workLog.filter(x=>x.id!==b.dataset.v3LogDel);save();render()});
    document.querySelector('[data-v3-timer-start]')?.addEventListener('click',()=>{const p=data.clients.find(c=>c.id===state.client).projects.find(p=>p.id===state.project);p.timerState??={elapsed:0,running:false,startedAt:null};if(!p.timerState.running){p.timerState.running=true;p.timerState.startedAt=Date.now();save();render()}});
    document.querySelector('[data-v3-timer-pause]')?.addEventListener('click',()=>{const p=data.clients.find(c=>c.id===state.client).projects.find(p=>p.id===state.project);if(p.timerState?.running){p.timerState.elapsed=projectElapsed(p);p.timerState.running=false;p.timerState.startedAt=null;save();render()}});
    document.querySelector('[data-v3-timer-finish]')?.addEventListener('click',()=>{const p=data.clients.find(c=>c.id===state.client).projects.find(p=>p.id===state.project),duration=projectElapsed(p);if(duration<1000)return;p.timeSessions.push({id:id(),date:today(),duration,note:''});p.workLog.push({id:id(),date:today(),text:'جلسة عمل على المشروع',kind:'timer',duration});p.timerState={elapsed:0,running:false,startedAt:null};save();render()});
    document.querySelectorAll('[data-v3-time-del]').forEach(b=>b.onclick=()=>{const p=data.clients.find(c=>c.id===state.client).projects.find(p=>p.id===state.project);p.timeSessions=p.timeSessions.filter(x=>x.id!==b.dataset.v3TimeDel);save();render()});
    clearInterval(projectClockInterval);projectClockInterval=null;
    const clock=document.querySelector('[data-v3-project-clock]');if(clock){const p=data.clients.find(c=>c.id===state.client)?.projects.find(p=>p.id===state.project);if(p?.timerState?.running)projectClockInterval=setInterval(()=>{if(clock.isConnected)clock.textContent=formatDuration(projectElapsed(p));else{clearInterval(projectClockInterval);projectClockInterval=null}},1000)}

    const py=$('#v3Pay');if(py)py.onsubmit=e=>{e.preventDefault();const p=data.clients.find(x=>x.id===state.client).projects.find(x=>x.id===state.project),f=new FormData(py);p.payments.push({id:id(),amount:Number(f.get('amount')),date:f.get('date'),note:f.get('note').trim()});save();render()};
    document.querySelectorAll('[data-v3-pay-del]').forEach(b=>b.onclick=()=>{const p=data.clients.find(c=>c.id===state.client).projects.find(p=>p.id===state.project);p.payments=p.payments.filter(x=>x.id!==b.dataset.v3PayDel);save();render()});
    const as=$('#v3Assets');if(as){const input=as.elements.file,prev=as.querySelector('[data-v3-preview]'),st=as.querySelector('[data-v3-status]');input.onchange=()=>{prev.innerHTML='';[...input.files].forEach(f=>{const im=document.createElement('img');im.src=URL.createObjectURL(f);im.onload=()=>URL.revokeObjectURL(im.src);prev.appendChild(im)})};as.onsubmit=async e=>{e.preventDefault();const p=data.clients.find(x=>x.id===state.client).projects.find(x=>x.id===state.project),f=new FormData(as),files=[...input.files];if(!files.length){st.textContent='اختاري صورة واحدة على الأقل.';return}st.textContent='جارٍ حفظ '+files.length+' صورة…';try{for(const file of files){const med=await saveImage(file,{max:1400,q:.78});p.assets.push({id:id(),...med,status:f.get('status'),caption:f.get('caption').trim()})}save();render()}catch(err){console.error('Project image save failed',err);st.textContent='تعذّر حفظ الصور. جرّبي JPG/PNG/WebP أو صورة أصغر.'}}}
    document.querySelectorAll('[data-v3-asset-del]').forEach(b=>b.onclick=async()=>{const p=data.clients.find(c=>c.id===state.client).projects.find(p=>p.id===state.project),a=p.assets.find(x=>x.id===b.dataset.v3AssetDel);if(a?.local)await del(a.local).catch(()=>{});p.assets=p.assets.filter(x=>x.id!==b.dataset.v3AssetDel);save();render()});

    const co=$('#v3Course');if(co)co.onsubmit=e=>{e.preventDefault();const f=new FormData(co),c={id:id(),title:f.get('title').trim(),items:[]};data.learningSpaces.push(c);state.course=c.id;save();render()};
    document.querySelectorAll('[data-v3-course]').forEach(b=>b.onclick=()=>{state.course=b.dataset.v3Course;render()});
    document.querySelector('[data-v3-course-back]')?.addEventListener('click',()=>{state.course=null;render()});
    const ci=$('#v3CourseItem');if(ci)ci.onsubmit=async e=>{e.preventDefault();const c=data.learningSpaces.find(x=>x.id===state.course),f=new FormData(ci),file=ci.elements.file.files?.[0],st=ci.querySelector('[data-v3-learning-status]');try{let media=null;if(file)media=await saveImage(file,{max:1400,q:.78});c.items.push({id:id(),title:f.get('title').trim(),type:f.get('type'),url:f.get('url'),media,note:f.get('note').trim(),watched:f.get('watched')==='on'});save();render()}catch{st.textContent='تعذّر حفظ الصورة.'}};
    document.querySelectorAll('[data-v3-course-toggle]').forEach(b=>b.onclick=()=>{const c=data.learningSpaces.find(x=>x.id===state.course),i=c.items.find(x=>x.id===b.dataset.v3CourseToggle);i.watched=!i.watched;save();render()});

    const bg=$('#v3Bg');if(bg){
      const input=bg.elements.file,prev=bg.querySelector('[data-v3-bg-prev]'),st=bg.querySelector('[data-v3-bg-status]'),destination=bg.elements.destination,target=bg.elements.target,pagePicker=bg.querySelector('[data-bg-page-picker]');
      const liveBg=()=>{pagePicker.hidden=destination.value!=='page'};
      destination.onchange=liveBg;liveBg();
      input.addEventListener('click',()=>{window.yomiFilePickerActive=true});
      input.onchange=()=>{
        window.yomiFilePickerActive=false;
        const file=input.files?.[0];pendingBackgroundFile=file||null;prev.innerHTML='';
        if(pendingBackgroundPreviewUrl){URL.revokeObjectURL(pendingBackgroundPreviewUrl);pendingBackgroundPreviewUrl=null}
        if(!file){st.textContent='لم يتم اختيار صورة.';return}
        pendingBackgroundPreviewUrl=URL.createObjectURL(file);
        const im=document.createElement('img');im.src=pendingBackgroundPreviewUrl;im.alt='معاينة الخلفية';prev.appendChild(im);
        st.textContent='✓ الصورة جاهزة. اختاري مكانها ثم اضغطي «تطبيق الصورة».';refreshFullPreview();
      };
      bg.onsubmit=async e=>{
        e.preventDefault();
        try{
          if(pendingBackgroundFile){
            const med=await saveImage(pendingBackgroundFile,{max:1800,q:.82});
            data.designSettings.backgroundMedia=med;
            data.designSettings.background='';
            localStorage.removeItem(BG_KEY);
            pendingBackgroundFile=null;
          }
          if(!data.designSettings.backgroundMedia&&!data.designSettings.background){st.textContent='اختاري صورة أولًا.';return}
          const dest=destination.value,scope={applyAll:dest==='all'||dest==='all-login',includeLogin:dest==='all-login',targetPage:dest==='login'?'lock':dest==='page'?target.value:'home'};
          localStorage.setItem(BG_SCOPE_KEY,JSON.stringify(scope));
          data.designSettings.bgX=Number(bg.elements.bgX.value);data.designSettings.bgY=Number(bg.elements.bgY.value);data.designSettings.bgZoom=Number(bg.elements.bgZoom.value);data.designSettings.applyAll=scope.applyAll;data.designSettings.includeLogin=scope.includeLogin;data.designSettings.targetPage=scope.targetPage;
          save();await syncMedia();st.textContent='✓ تم حفظ الخلفية ومزامنتها مع الحساب.';render()
        }catch(err){console.error('Background save failed',err);alert('تعذّر حفظ الصورة. جرّبي صورة أصغر أو JPG.')}
      };
    }
    document.querySelector('[data-v3-bg-clear]')?.addEventListener('click',()=>{
      const oldBg=data.designSettings.backgroundMedia;if(oldBg?.local)del(oldBg.local).catch(()=>{});data.designSettings.background='';data.designSettings.backgroundMedia=null;data.designSettings.backgroundMigrated=true;save();localStorage.removeItem(BG_KEY);localStorage.removeItem(BG_SCOPE_KEY);pendingBackgroundFile=null;
      if(pendingBackgroundPreviewUrl){URL.revokeObjectURL(pendingBackgroundPreviewUrl);pendingBackgroundPreviewUrl=null}
      document.documentElement.style.setProperty('--yomi-user-bg','none');document.body.dataset.userBg='0';render()
    });
    const ts=$('#v3Transparency');if(ts){
      const destination=ts.elements.destination,target=ts.elements.target,pagePicker=ts.querySelector('[data-trans-page-picker]'),slider=ts.elements.transparency,label=ts.querySelector('[data-v3-trans-value]'),preview=ts.querySelector('[data-v3-trans-preview]');
      const showValue=()=>{const cfg=transparencyConfig(),v=destination.value==='page'?(cfg.pages?.[target.value]??slider.value):slider.value;slider.value=Math.max(0,Math.min(95,Number(v)));label.textContent=slider.value+'%';preview.style.background='rgba(255,253,250,'+((100-Number(slider.value))/100)+')'};
      const live=()=>{pagePicker.hidden=destination.value!=='page';showValue()};
      destination.onchange=live;target.onchange=showValue;slider.oninput=()=>{label.textContent=slider.value+'%';preview.style.background='rgba(255,253,250,'+((100-Number(slider.value))/100)+')';refreshFullPreview()};live();
      ts.onsubmit=e=>{
        e.preventDefault();
        const cfg=transparencyConfig(),pages=cfg.pages||{},v=Math.max(0,Math.min(95,Number(slider.value))),dest=destination.value,appPages=['home','worship','planner','clients','learning','finance','tasks','wellness','quran','achievements','notes','diary','memories','care','cycle','reports','customize'];
        if(dest==='login')pages.lock=v;
        else if(dest==='page')pages[target.value]=v;
        else{for(const k of appPages)pages[k]=v;if(dest==='all-login')pages.lock=v}
        const cfgNew={pages,lastDestination:dest,lastTarget:target.value};data.designSettings.transparency=structuredClone(cfgNew);localStorage.setItem(TRANS_KEY,JSON.stringify(cfgNew));save();render()
      };
      ts.querySelector('[data-v3-trans-reset]').onclick=()=>{
        const cfg=transparencyConfig(),pages=cfg.pages||{},dest=destination.value,appPages=['home','worship','planner','clients','learning','finance','tasks','wellness','quran','achievements','notes','diary','memories','care','cycle','reports','customize'];
        if(dest==='login')delete pages.lock;
        else if(dest==='page')delete pages[target.value];
        else{for(const k of appPages)delete pages[k];if(dest==='all-login')delete pages.lock}
        const cfgNew={pages,lastDestination:dest,lastTarget:target.value};data.designSettings.transparency=structuredClone(cfgNew);localStorage.setItem(TRANS_KEY,JSON.stringify(cfgNew));save();render()
      };
    }
    const nv=$('#v3NavVisibility');if(nv){
      const destination=nv.elements.destination,target=nv.elements.target,picker=nv.querySelector('[data-nav-page-picker]');
      const cfg=navConfig();destination.value=cfg.lastDestination||'page';target.value=cfg.lastTarget||'planner';
      const navLive=()=>{picker.hidden=destination.value!=='page'};destination.onchange=navLive;navLive();
      nv.onsubmit=e=>{e.preventDefault();const x=structuredClone(navConfig()),visible=nv.elements.visible.value==='show',dest=destination.value,appPages=['home','worship','planner','clients','learning','finance','tasks','wellness','quran','achievements','notes','diary','memories','care','cycle','reports','customize'];if(dest==='all')for(const k of appPages)x.pages[k]=visible;else x.pages[target.value]=visible;x.lastDestination=dest;x.lastTarget=target.value;data.designSettings.navVisibility=structuredClone(x);localStorage.setItem(NAV_KEY,JSON.stringify(x));save();render()};
    }
    const previewPage=document.getElementById('v3PreviewPage'),previewWrap=document.querySelector('[data-v3-full-preview]'),previewDialog=document.getElementById('v3PreviewDialog');
    previewPage?.addEventListener('change',()=>{if(previewDialog?.open)refreshFullPreview()});
    document.querySelector('[data-v3-preview-open]')?.addEventListener('click',()=>{refreshFullPreview();if(previewDialog?.showModal)previewDialog.showModal();else previewDialog?.setAttribute('open','')});
    document.querySelector('[data-v3-preview-close]')?.addEventListener('click',()=>previewDialog?.close?.());
    previewDialog?.addEventListener('click',e=>{if(e.target===previewDialog)previewDialog.close()});
    document.querySelectorAll('[data-v3-preview-device]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-v3-preview-device]').forEach(x=>x.classList.toggle('active',x===b));if(previewWrap){previewWrap.classList.toggle('mobile',b.dataset.v3PreviewDevice==='mobile');previewWrap.classList.toggle('desktop',b.dataset.v3PreviewDevice!=='mobile');refreshFullPreview()}});
    for(const formId of ['v3Bg','v3Transparency','v3NavVisibility']){const f=document.getElementById(formId);if(f)f.addEventListener('input',()=>{if(previewDialog?.open)refreshFullPreview()})}
    const sf=$('#v3Sticker');if(sf){const input=sf.elements.file,prev=sf.querySelector('[data-v3-sticker-prev]');input.onchange=()=>{prev.innerHTML='';const f=input.files?.[0];if(f){const im=document.createElement('img');im.src=URL.createObjectURL(f);im.onload=()=>URL.revokeObjectURL(im.src);prev.appendChild(im)}};sf.onsubmit=async e=>{e.preventDefault();const f=new FormData(sf),file=input.files?.[0],text=String(f.get('text')||'').trim();if(!file&&!text){alert('اختاري صورة Sticker أو اكتبي Emoji');return}try{let med={};if(file)med=await saveImage(file,{max:700,q:.9,alpha:true});data.designSettings.stickers.push({id:id(),...med,text,target:f.get('target'),positionMode:f.get('positionMode')||'screen',x:Number(f.get('x')),y:Number(f.get('y')),size:Number(f.get('size')),hidden:false});save();await syncMedia();render()}catch(err){console.error('Sticker save failed',err);alert('تعذّر حفظ Sticker. جرّبي PNG أو WebP أو JPG أصغر.')}}}
    document.querySelectorAll('[data-v3-sticker-toggle]').forEach(b=>b.onclick=()=>{const s=data.designSettings.stickers.find(x=>x.id===b.dataset.v3StickerToggle);s.hidden=!s.hidden;save();render()});
    document.querySelectorAll('[data-v3-sticker-del]').forEach(b=>b.onclick=async()=>{const s=data.designSettings.stickers.find(x=>x.id===b.dataset.v3StickerDel);if(s?.local)await del(s.local).catch(()=>{});data.designSettings.stickers=data.designSettings.stickers.filter(x=>x.id!==b.dataset.v3StickerDel);save();render()});

    document.querySelector('[data-v3-cycle-save]')?.addEventListener('click',()=>{const n=Number($('#v3CycleLen').value);if(Number.isInteger(n)&&n>=1&&n<=14){data.cyclePeriodLength=n;save();render()}});
    document.querySelectorAll('[data-v3-period-form]').forEach(f=>f.onsubmit=e=>{e.preventDefault();const p=data.periods.find(x=>x.id===f.dataset.v3PeriodForm),fd=new FormData(f),s=fd.get('start'),end=fd.get('end');if(end&&end<s){alert('تاريخ النهاية لازم يكون بعد البداية');return}p.start=s;p.end=end;p.symptom=fd.get('symptom').trim();save();render()});
    document.querySelectorAll('[data-v3-period-end]').forEach(b=>b.onclick=()=>{const p=data.periods.find(x=>x.id===b.dataset.v3PeriodEnd);if(p){p.end=today();save();render()}});
    document.querySelectorAll('[data-v3-period-del]').forEach(b=>b.onclick=()=>{if(confirm('حذف هذا التسجيل؟')){data.periods=data.periods.filter(x=>x.id!==b.dataset.v3PeriodDel);save();render()}});
    document.querySelectorAll('[data-v3-special-hide]').forEach(b=>b.onclick=()=>{const x=data.importantDates.find(v=>v.id===b.dataset.v3SpecialHide);if(x){x.showHome=false;save();render()}});
    document.querySelector('[data-v3-special-show-all]')?.addEventListener('click',()=>{for(const x of data.importantDates||[])x.showHome=true;save();render()});
    const dp=$('#v3DebtPerson');if(dp)dp.onsubmit=e=>{e.preventDefault();const f=new FormData(dp);data.debtPeople.push({id:id(),name:f.get('name').trim(),transactions:[]});save();render()};
    document.querySelectorAll('[data-v3-debt]').forEach(f=>f.onsubmit=e=>{e.preventDefault();const p=data.debtPeople.find(x=>x.id===f.dataset.v3Debt),d=new FormData(f),a=Number(d.get('amount')),t=d.get('type'),delta={owed:a,owe:-a,received:-a,paid:a}[t],label={owed:'مبلغ مستحق لي',owe:'مبلغ مستحق عليّ',received:'استلام دفعة',paid:'دفع دفعة'}[t];p.transactions.push({id:id(),date:d.get('date'),delta,label,note:d.get('note').trim()});save();render()})
  }

  ensure();
  const w=pages.findIndex(x=>x[0]==='worship');if(w>=0)pages.splice(w,1);const h=pages.findIndex(x=>x[0]==='home');pages.splice(h+1,0,['worship','عبادتي']);
  const qi=pages.findIndex(x=>x[0]==='quran');if(qi>=0)pages.splice(qi,1);
  const oldRender=render;
  render=function(){
    ensure();if(page==='quran')page='worship';const custom={planner,worship,clients,learning,customize};
    if(custom[page]){nav();$('#todayLabel').textContent=dateLabel(today());$('#view').innerHTML=custom[page]();attachCommon();window.yomiTimerRender?.();window.yomiThemeApply?.();attach();stickers();paint();return}
    oldRender();
    if(page==='home'){document.querySelectorAll('.special-date-card').forEach(x=>x.remove());$('#view').insertAdjacentHTML('afterbegin',specialDateHome()+homeExtra());attach()}
    if(page==='cycle'){$('#view').insertAdjacentHTML('beforeend',cycleExtra());attach()}
    if(page==='finance'){document.querySelector('.y2-debts')?.remove();$('#view').insertAdjacentHTML('beforeend',debtExtra());attach()}
    stickers();paint()
  };
  window.addEventListener('yomi-pin-unlocked',()=>{stickers();paint()});
  window.addEventListener('yomi-cloud-session',()=>{syncMedia();paint()});
  render();
})();
