/* يومي 2.0 — تنظيم التقويم، العملاء، التعلم، العبادات، المتابعة والتخصيص */
(() => {
  const y2 = {
    page: {
      planner: 'التقويم',
      clients: 'العملاء',
      learning: 'تعلّمي',
      worship: 'عبادتي',
      tracking: 'متابعتي',
      customize: 'تخصيص'
    },
    clientId: null,
    projectId: null,
    courseId: null
  };

  function ensure() {
    data.calendarEvents ??= [];
    data.importantDates ??= [];
    data.clients ??= [];
    data.learningSpaces ??= [];
    data.prayerChecks ??= {};
    data.dailyAdhkar ??= {
      morning: [
        {id:id(), text:'أصبحنا وأصبح الملك لله', target:1},
        {id:id(), text:'سبحان الله وبحمده', target:100}
      ],
      evening: [
        {id:id(), text:'أمسينا وأمسى الملك لله', target:1},
        {id:id(), text:'سبحان الله وبحمده', target:100}
      ],
      extra: [
        {id:id(), text:'اللهم صلِّ على سيدنا محمد', target:100}
      ],
      counts:{}
    };
    data.weightEntries ??= [];
    data.debtPeople ??= [];
    data.designSettings ??= {background:null, stickers:[]};
  }

  function addNavPages() {
    for (const [k,v] of Object.entries(y2.page)) if (!pages.some(x => x[0] === k)) pages.push([k,v]);
  }

  function y2money(n){ return Number(n||0).toLocaleString('en-US')+' ₪'; }
  function monthKey(d=selected){ return d.slice(0,7); }
  function monthStart(d=selected){ return monthKey(d)+'-01'; }
  function monthDays(d=selected){ return new Date(Number(d.slice(0,4)),Number(d.slice(5,7)),0).getDate(); }
  function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
  function getMonthOffset(d,delta){
    const x = new Date(d.slice(0,7)+'-01T12:00:00Z');
    x.setUTCMonth(x.getUTCMonth()+delta);
    return x.toISOString().slice(0,10);
  }
  function weekdayMon0(d){
    const w = new Date(d+'T12:00:00Z').getUTCDay();
    return (w+6)%7;
  }
  function eventOccurrences(ev, month){
    const start = month+'-01', end = month+'-'+String(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()).padStart(2,'0');
    if (!ev.repeat || ev.repeat === 'none') return ev.date>=start&&ev.date<=end ? [{...ev, occurrenceDate:ev.date, occurrenceTime:ev.time||''}] : [];
    if (ev.repeat !== 'daily') return [];
    const out=[];
    const until = ev.until && ev.until<end ? ev.until : end;
    let d = ev.date>start ? ev.date : start;
    const baseDate=ev.date;
    while(d<=until){
      let t=ev.time||'';
      if(t && Number(ev.driftMinutes||0)){
        const [h,m]=t.split(':').map(Number), delta=daysBetween(baseDate,d)*Number(ev.driftMinutes||0);
        const total=((h*60+m+delta)%(24*60)+(24*60))%(24*60);
        t=String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');
      }
      out.push({...ev, occurrenceDate:d, occurrenceTime:t});
      d=dayAfter(d);
    }
    return out;
  }
  function allPlannerItems(month=monthKey()){
    const out=[];
    for(const ev of data.calendarEvents) for(const occ of eventOccurrences(ev,month)) out.push({source:'event',...occ});
    for(const x of data.tasks.filter(x=>x.date?.startsWith(month))) out.push({source:'task',id:x.id,title:x.title,occurrenceDate:x.date,occurrenceTime:x.time||'',color:'#7f96ad',sticker:'✓',done:completedTask(x,x.date)});
    for(const x of data.projects.filter(x=>x.due?.startsWith(month))) out.push({source:'project',id:x.id,title:x.title,occurrenceDate:x.due,occurrenceTime:x.time||'',color:'#bb925c',sticker:'💼',done:x.done});
    for(const x of data.importantDates.filter(x=>x.date?.slice(5)===selected.slice(5) || x.date?.startsWith(month))) {
      const d=x.yearly ? month.slice(0,4)+'-'+x.date.slice(5) : x.date;
      if(d.startsWith(month)) out.push({source:'important',id:x.id,title:x.title,occurrenceDate:d,occurrenceTime:'',color:x.color||'#a8738b',sticker:x.sticker||'⭐',done:false});
    }
    return out.sort((a,b)=>(a.occurrenceDate+(a.occurrenceTime||'')).localeCompare(b.occurrenceDate+(b.occurrenceTime||'')));
  }

  function planner(){
    const month=monthKey(), first=monthStart(), pad=weekdayMon0(first), count=monthDays(), items=allPlannerItems(month);
    const cells=[];
    for(let i=0;i<pad;i++) cells.push('<div class="cal-cell cal-empty"></div>');
    for(let day=1;day<=count;day++){
      const d=month+'-'+String(day).padStart(2,'0'), dayItems=items.filter(x=>x.occurrenceDate===d);
      cells.push(`<button class="cal-cell ${d===today()?'today':''} ${d===selected?'selected':''}" data-cal-day="${d}"><b>${day}</b><span class="cal-dots">${dayItems.slice(0,4).map(x=>`<i style="background:${safe(x.color||'#a8738b')}"></i>`).join('')}</span><small>${safe(dayItems[0]?.sticker||'')} ${safe(dayItems[0]?.title||'')}</small></button>`);
    }
    const dayItems=items.filter(x=>x.occurrenceDate===selected);
    return `<div class="panel">
      <div class="row between"><div><h2>Calendar Planner</h2><p class="sub">للشغل، التسليمات، الدراسة والمواعيد. العبادات والمتابعة الصحية تبقى في صفحاتها الخاصة.</p></div>
      <div class="row"><button class="soft" data-month-nav="-1">‹</button><strong>${dateLabel(first)}</strong><button class="soft" data-month-nav="1">›</button></div></div>
      <div class="calendar-week"><span>الإثنين</span><span>الثلاثاء</span><span>الأربعاء</span><span>الخميس</span><span>الجمعة</span><span>السبت</span><span>الأحد</span></div>
      <div class="calendar-grid">${cells.join('')}</div>
    </div>
    <div class="panel"><div class="row between"><h3>${dateLabel(selected)}</h3><button class="soft" id="exportIcs">تصدير الشهر للتقويم</button></div>
      ${dayItems.map(x=>`<div class="item"><span class="event-chip" style="--chip:${safe(x.color||'#a8738b')}">${safe(x.sticker||'•')}</span><div class="grow ${x.done?'done':''}"><b>${safe(x.title)}</b><small>${x.occurrenceTime?safe(x.occurrenceTime)+' · ':''}${x.source==='project'?'مشروع':x.source==='task'?'مهمة':x.source==='important'?'تاريخ مميز':'موعد'}</small></div>${x.source==='event'?'<button data-event-toggle="'+x.id+'">'+(x.done?'إلغاء الإنجاز':'تم')+'</button><button data-event-delete="'+x.id+'">حذف</button>':''}</div>`).join('')||'<div class="empty">ما في شيء مسجّل لهذا اليوم</div>'}
    </div>
    <div class="panel"><h3>إضافة للتقويم</h3>
      <form id="calendarEventForm">
        <div class="row"><label class="field">الاسم<input name="title" required></label><label class="field">النوع<select name="kind"><option value="work">شغل</option><option value="study">تعلم</option><option value="event">موعد/مناسبة</option></select></label></div>
        <div class="row"><label class="field">التاريخ<input name="date" type="date" value="${selected}" required></label><label class="field">الوقت (اختياري)<input name="time" type="time"></label><label class="field">حتى<input name="endTime" type="time"></label></div>
        <div class="row"><label class="field">التكرار<select name="repeat"><option value="none">مرة واحدة</option><option value="daily">يومي</option></select></label><label class="field">تغيير الوقت يوميًا بالدقائق<input name="drift" type="number" step="1" value="0"></label><label class="field">حتى تاريخ<input name="until" type="date"></label></div>
        <div class="row"><label class="field">الأهمية<select name="priority"><option value="normal">عادي</option><option value="important">مهم</option><option value="urgent">عاجل</option></select></label><label class="field">اللون<select name="color"><option value="#7f96ad">أزرق</option><option value="#746b99">بنفسجي</option><option value="#749485">أخضر</option><option value="#bb925c">ذهبي</option><option value="#c98570">برتقالي</option><option value="#a3334d">أحمر</option></select></label><label class="field">Sticker<input name="sticker" maxlength="4" placeholder="💼"></label></div>
        <label class="field">ملاحظة<textarea name="note"></textarea></label><button class="primary">إضافة</button>
      </form>
      <hr>
      <h3>تاريخ مميز</h3>
      <form id="importantDateForm" class="row"><label class="field">الاسم<input name="title" required></label><label class="field">التاريخ<input name="date" type="date" value="${selected}" required></label><label class="field">الرمز<input name="sticker" maxlength="4" value="⭐"></label><label class="field">يتكرر سنويًا<select name="yearly"><option value="0">لا</option><option value="1">نعم</option></select></label><label class="field">يظهر في اليوم<select name="showHome"><option value="1">نعم</option><option value="0">لا</option></select></label><button class="soft">حفظ</button></form>
    </div>`;
  }

  function worship(){
    const prayers=['الفجر','الظهر','العصر','المغرب','العشاء'];
    const p=data.prayerChecks[selected]||{};
    function adhkarBlock(group,title){
      const list=data.dailyAdhkar[group]||[];
      return `<div class="panel"><h3>${title}</h3>${list.map(x=>{const key=selected+'|'+x.id,n=Number(data.dailyAdhkar.counts[key]||0);return `<div class="item"><div class="grow"><b>${safe(x.text)}</b><small>${n} من ${x.target}</small></div><button data-adhkar-inc="${x.id}" data-group="${group}">+1</button><button data-adhkar-edit="${x.id}" data-group="${group}">تعديل</button></div>`}).join('')||'<div class="empty">ما في أذكار</div>'}<form class="row" data-adhkar-add="${group}"><label class="field">ذكر جديد<input name="text" required></label><label class="field">الهدف<input name="target" type="number" min="1" value="1" required></label><button class="soft">إضافة</button></form></div>`;
    }
    return `<div class="panel"><h2>عبادتي</h2><p class="sub">هذا القسم مستقل عن نسبة إنجاز المهام. عدم وضع ✓ يعني فقط أنه لم يتم التسجيل هنا.</p>${datePicker()}<h3>صلاتي</h3><div class="prayer-grid">${prayers.map(name=>`<label class="prayer-card"><input type="checkbox" data-prayer="${name}" ${p[name]?'checked':''}><span>🕌 ${name}</span></label>`).join('')}</div><p class="sub">المسجّل اليوم: ${prayers.filter(x=>p[x]).length} من 5 — لا نعتبر غير المسجّل صلاة فائتة.</p><div class="row"><button class="soft" data-go="quran">فتح وردي القرآني</button></div></div>
    ${adhkarBlock('morning','أذكار الصباح ☀️')}${adhkarBlock('evening','أذكار المساء 🌙')}${adhkarBlock('extra','أذكاري الإضافية')}`;
  }

  function tracking(){
    const weights=[...data.weightEntries].sort((a,b)=>b.date.localeCompare(a.date));
    const latest=weights[0], prev=weights[1], diff=latest&&prev?(Number(latest.kg)-Number(prev.kg)).toFixed(1):null;
    return `<div class="panel"><h2>متابعتي</h2><p class="sub">الوزن والمي والعادات كتتبّع، مش كمهام تزاحم شغلك.</p>${datePicker()}<div class="grid"><div class="stat">آخر وزن<b>${latest?latest.kg+' كغم':'—'}</b>${diff!==null?'<small class="sub">الفرق عن السابق: '+(Number(diff)>0?'+':'')+diff+' كغم</small>':''}</div><div class="stat">المي اليوم<b>${waterText(waterAmount(selected))}</b><span class="sub">${data.waterGoal?'الهدف '+waterText(data.waterGoal):'الهدف غير محدد'}</span></div><div class="stat">عادات الامتناع<b>${data.habits.length}</b></div></div>
      <form id="weightForm" class="row"><label class="field">الوزن كغم<input name="kg" type="number" min="20" max="300" step="0.1" required></label><label class="field">التاريخ<input name="date" type="date" value="${selected}" required></label><button class="primary">حفظ الوزن</button></form>
      <h3>السجل</h3>${weights.slice(0,12).map(x=>`<div class="item"><div class="grow"><b>${x.kg} كغم</b><small>${dateLabel(x.date)}</small></div><button data-weight-delete="${x.id}">حذف</button></div>`).join('')||'<div class="empty">ما في وزن مسجّل</div>'}
    </div><div class="panel"><h3>المي</h3><div class="row"><button class="soft" data-y2-water="250">+ 250 مل</button><button class="soft" data-y2-water="500">+ 500 مل</button><button class="soft" data-go="wellness">تفاصيل المي والعادات</button></div></div>`;
  }

  function debtLedgerSection(){
    const rows=data.debtPeople.map(person=>{
      const bal=sum((person.transactions||[]).map(t=>Number(t.delta)||0));
      return `<div class="debt-person"><div class="row between"><div><b>${safe(person.name)}</b><small class="sub">${bal>0?'إلي عليها '+y2money(bal):bal<0?'عليّ إلها '+y2money(Math.abs(bal)):'الحساب مسكّر'}</small></div><button data-debt-person-delete="${person.id}">حذف</button></div>
      <form class="row" data-debt-tx="${person.id}"><label class="field">الحركة<select name="type"><option value="owed">إلي عليها</option><option value="owe">عليّ إلها</option><option value="received">دفعت لي</option><option value="paid">دفعت إلها</option></select></label><label class="field">المبلغ<input name="amount" type="number" min="0.01" step="0.01" required></label><label class="field">التاريخ<input name="date" type="date" value="${selected}" required></label><label class="field">ملاحظة<input name="note"></label><button class="soft">إضافة حركة</button></form>
      <details><summary>سجل الحركات (${(person.transactions||[]).length})</summary>${[...(person.transactions||[])].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<div class="item"><div class="grow">${safe(t.label)}<small>${safe(t.date)} · ${y2money(Math.abs(t.delta))} ${safe(t.note||'')}</small></div></div>`).join('')||'<div class="empty">لا يوجد</div>'}</details></div>`;
    }).join('');
    return `<div class="panel y2-debts"><h2>حساب الديون حسب الشخص</h2><p class="sub">كل شخص له كشف واحد؛ الإضافات والدفعات تبقى محفوظة بالتاريخ.</p><form id="debtPersonForm" class="row"><label class="field">الاسم<input name="name" required placeholder="مثلاً سلوى"></label><button class="primary">إضافة شخص</button></form>${rows||'<div class="empty">أضيفي أول شخص</div>'}</div>`;
  }

  function cycleDotsSection(){
    const open=[...data.periods].filter(x=>!x.end).sort((a,b)=>b.start.localeCompare(a.start))[0];
    if(!open) return '<div class="panel"><h3>متابعة أيام الدورة</h3><p class="sub">ما في دورة مفتوحة حاليًا. عند تسجيل أول يوم ستبقى مفتوحة حتى تغلقيها بنفسك.</p></div>';
    const elapsed=Math.max(1,daysBetween(open.start,today())+1);
    return `<div class="panel"><h3>متابعة الدورة الحالية</h3><p class="sub">بدأت ${dateLabel(open.start)} · اليوم ${elapsed}. ما في حد 7 أيام؛ تظل مفتوحة لحد ما تضغطي إنهاء.</p><div class="cycle-dots">${Array.from({length:Math.min(14,Math.max(7,elapsed))},(_,i)=>`<span class="${i<elapsed?'active':''}">${i+1}</span>`).join('')}</div><button class="primary" data-cycle-close="${open.id}">إنهاء الدورة اليوم</button></div>`;
  }

  function importantHome(){
    const matches=data.importantDates.filter(x=>x.showHome!==false && (x.date===selected || (x.yearly&&x.date.slice(5)===selected.slice(5))));
    if(!matches.length) return '';
    return `<div class="panel special-date-card"><h3>✨ تاريخ مميز</h3>${matches.map(x=>`<div class="item"><span class="big-sticker">${safe(x.sticker||'⭐')}</span><div class="grow"><b>${safe(x.title)}</b><small>${dateLabel(selected)}</small></div></div>`).join('')}</div>`;
  }

  function clients(){
    if(!data.clients.length || !y2.clientId || !data.clients.some(x=>x.id===y2.clientId)){
      const cards=data.clients.map(c=>`<button class="client-card" data-client-open="${c.id}"><b>${safe(c.name)}</b><small>${(c.projects||[]).length} مشروع</small></button>`).join('');
      return `<div class="panel"><h2>العملاء والمشاريع</h2><p class="sub">كل عميلة لها ملف، وداخل الملف أكثر من عروس أو مشروع.</p><form id="clientForm" class="row"><label class="field">اسم العميلة/العميل<input name="name" required></label><button class="primary">إنشاء ملف</button></form><div class="client-grid">${cards||'<div class="empty">ما في عملاء بعد</div>'}</div></div>`;
    }
    const c=data.clients.find(x=>x.id===y2.clientId); c.projects??=[];
    if(!y2.projectId || !c.projects.some(x=>x.id===y2.projectId)){
      return `<div class="panel"><div class="row between"><div><button class="soft" id="clientsBack">‹ كل العملاء</button><h2>${safe(c.name)}</h2></div><div class="stat">المشاريع<b>${c.projects.length}</b></div></div>
      <form id="clientProjectForm"><div class="row"><label class="field">اسم المشروع/العروس<input name="title" required></label><label class="field">موعد التسليم<input name="due" type="date"></label></div><div class="row"><label class="field">المبلغ المتفق ₪<input name="amount" type="number" min="0" step="0.01"></label><label class="field">المدفوع ₪<input name="paid" type="number" min="0" step="0.01"></label></div><button class="primary">إضافة مشروع</button></form>
      ${c.projects.map(p=>`<button class="project-card" data-project-open="${p.id}"><div><b>${safe(p.title)}</b><small>${p.due?'التسليم '+dateLabel(p.due):'بدون موعد'} · ${safe(p.status||'جديد')}</small></div><span>${y2money(Number(p.amount||0)-Number(p.paid||0))} باقي</span></button>`).join('')||'<div class="empty">أضيفي أول مشروع</div>'}</div>`;
    }
    const p=c.projects.find(x=>x.id===y2.projectId); p.assets??=[];
    return `<div class="panel"><button class="soft" id="projectBack">‹ ${safe(c.name)}</button><h2>${safe(p.title)}</h2><div class="grid"><div class="stat">الحالة<b style="font-size:1rem">${safe(p.status||'جديد')}</b></div><div class="stat">المتفق<b>${y2money(p.amount)}</b></div><div class="stat">المدفوع<b>${y2money(p.paid)}</b><span class="sub">الباقي ${y2money(Number(p.amount||0)-Number(p.paid||0))}</span></div></div>
      <form id="projectEditForm"><div class="row"><label class="field">الحالة<select name="status">${['جديد','جاري','بانتظار العميل','تعديل','جاهز','تم التسليم','مغلق'].map(s=>`<option ${p.status===s?'selected':''}>${s}</option>`).join('')}</select></label><label class="field">موعد التسليم<input name="due" type="date" value="${safe(p.due||'')}"></label><label class="field">المدفوع ₪<input name="paid" type="number" min="0" step="0.01" value="${Number(p.paid||0)}"></label></div>
      <label class="field">شو المطلوب؟<textarea name="required">${safe(p.required||'')}</textarea></label><label class="field">شو تم تنفيذه؟<textarea name="doneText">${safe(p.doneText||'')}</textarea></label><label class="field">شو لسه ما تم؟<textarea name="pending">${safe(p.pending||'')}</textarea></label><label class="field">شو استلمت من العميل؟<textarea name="received">${safe(p.received||'')}</textarea></label><label class="field">ملاحظات<textarea name="notes">${safe(p.notes||'')}</textarea></label><button class="primary">حفظ المشروع</button></form>
    </div><div class="panel"><h3>الصور والاعتمادات</h3><p class="sub">أضيفي الصورة وحددي حالتها بنفسك: مرجع، قيد العمل، معتمدة، تحتاج تعديل، أو نهائية.</p><form id="projectAssetForm"><div class="row"><label class="field">الصورة<input name="file" type="file" accept="image/*" required></label><label class="field">الحالة<select name="status"><option>مرجع</option><option>قيد العمل</option><option>معتمدة</option><option>غير معتمدة</option><option>تحتاج تعديل</option><option>نهائية</option></select></label><label class="field">ملاحظة<input name="caption"></label></div><button class="soft">إضافة الصورة</button></form><div class="asset-grid">${p.assets.map(a=>`<div class="asset-card"><img src="${a.src}" alt=""><b>${safe(a.status)}</b><small>${safe(a.caption||'')}</small><button data-asset-delete="${a.id}">حذف</button></div>`).join('')||'<div class="empty">ما في صور بعد</div>'}</div></div>`;
  }

  function learning(){
    if(!y2.courseId || !data.learningSpaces.some(x=>x.id===y2.courseId)){
      return `<div class="panel"><h2>دفتر تعلّمي</h2><p class="sub">صور النوتات، روابط الدروس، الفيديوهات وما تعلمتيه في مكان واحد.</p><form id="courseForm" class="row"><label class="field">اسم الدورة<input name="title" required placeholder="مثلاً Photoshop"></label><button class="primary">إضافة دورة</button></form><div class="client-grid">${data.learningSpaces.map(c=>`<button class="client-card" data-course-open="${c.id}"><b>${safe(c.title)}</b><small>${(c.items||[]).length} مادة</small></button>`).join('')||'<div class="empty">أضيفي أول دورة</div>'}</div></div>`;
    }
    const c=data.learningSpaces.find(x=>x.id===y2.courseId); c.items??=[];
    return `<div class="panel"><button class="soft" id="courseBack">‹ كل الدورات</button><h2>${safe(c.title)}</h2><form id="courseItemForm"><div class="row"><label class="field">العنوان<input name="title" required></label><label class="field">النوع<select name="type"><option value="note">ملاحظة</option><option value="video">فيديو/رابط</option><option value="image">صورة نوت</option></select></label><label class="field">الرابط (اختياري)<input name="url" type="url"></label><label class="field">الصورة (اختياري)<input name="file" type="file" accept="image/*"></label></div><label class="field">ملاحظاتي<textarea name="note"></textarea></label><label><input name="watched" type="checkbox"> حضرت/أنجزت</label><button class="primary">حفظ</button></form></div>
    <div class="panel">${c.items.map(i=>`<div class="learning-item ${i.watched?'done-card':''}">${i.src?'<img src="'+i.src+'" alt="">':''}<div class="grow"><b>${safe(i.title)}</b><small>${safe(i.type)} · ${i.watched?'تم':'لسه'}</small><p>${safe(i.note||'')}</p>${i.url?'<a href="'+safe(i.url)+'" target="_blank" rel="noopener">فتح الرابط</a>':''}</div><button data-course-item-toggle="${i.id}">${i.watched?'إرجاع':'تم'}</button><button data-course-item-delete="${i.id}">حذف</button></div>`).join('')||'<div class="empty">أضيفي أول مادة</div>'}</div>`;
  }

  function customize(){
    const d=data.designSettings;
    return `<div class="panel"><h2>تصميم يومي</h2><p class="sub">بدل تعديل الكود كل مرة: غيّري الخلفية وأضيفي Stickers وحددي مكانها. التصميم مقيد بنسب آمنة حتى يبقى مناسبًا للموبايل واللابتوب.</p><form id="backgroundForm"><label class="field">صورة الخلفية<input name="file" type="file" accept="image/*" required></label><button class="primary">استخدام الخلفية</button> ${d.background?'<button type="button" class="soft" id="clearBackground">إزالة الخلفية</button>':''}</form></div>
    <div class="panel"><h3>Stickers</h3><form id="stickerForm"><div class="row"><label class="field">Emoji أو رمز<input name="text" maxlength="8" placeholder="🌸" required></label><label class="field">يمين/يسار %<input name="x" type="range" min="3" max="97" value="85"></label><label class="field">أعلى/أسفل %<input name="y" type="range" min="3" max="97" value="18"></label><label class="field">الحجم<input name="size" type="range" min="20" max="100" value="44"></label></div><button class="soft">إضافة Sticker</button></form>${d.stickers.map(s=>`<div class="item"><div class="grow"><b style="font-size:2rem">${safe(s.text)}</b><small>x ${s.x}% · y ${s.y}% · ${s.size}px</small></div><button data-sticker-delete="${s.id}">حذف</button></div>`).join('')||'<div class="empty">ما في Stickers مضافة</div>'}</div>`;
  }

  function compressImage(file,max=1280,quality=.72){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=reject; reader.onload=()=>{
        const img=new Image(); img.onerror=reject; img.onload=()=>{
          let w=img.width,h=img.height; const scale=Math.min(1,max/Math.max(w,h)); w=Math.round(w*scale); h=Math.round(h*scale);
          const cv=document.createElement('canvas'); cv.width=w;cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h);
          resolve(cv.toDataURL('image/jpeg',quality));
        }; img.src=reader.result;
      }; reader.readAsDataURL(file);
    });
  }

  function applyDesign(){
    if(window.yomiV3DesignActive)return;
    ensure();
    const d=data.designSettings;
    document.body.dataset.userBg=d.background?'1':'0';
    document.documentElement.style.setProperty('--yomi-user-bg',d.background?`url("${d.background}")`:'none');
    document.querySelectorAll('.yomi-user-sticker').forEach(x=>x.remove());
    for(const s of d.stickers){
      const el=document.createElement('div');el.className='yomi-user-sticker';el.textContent=s.text;
      el.style.left=s.x+'%';el.style.top=s.y+'%';el.style.fontSize=s.size+'px';document.body.appendChild(el);
    }
  }

  function downloadIcs(){
    const items=allPlannerItems(monthKey()).filter(x=>['event','task','project','important'].includes(x.source));
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Yomi Planner//AR'];
    const escIcs=s=>String(s||'').replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
    for(const x of items){
      const d=x.occurrenceDate.replaceAll('-',''), tm=(x.occurrenceTime||'').replace(':','')+'00';
      lines.push('BEGIN:VEVENT','UID:'+x.id+'-'+d+'@yomi','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''));
      if(x.occurrenceTime) lines.push('DTSTART:'+d+'T'+tm); else lines.push('DTSTART;VALUE=DATE:'+d);
      lines.push('SUMMARY:'+escIcs(x.title),'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/calendar'}));a.download='yomi-'+monthKey()+'.ics';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  }

  function attachCustom(){
    document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{page=b.dataset.go;render()});
    document.querySelectorAll('[data-month-nav]').forEach(b=>b.onclick=()=>{selected=getMonthOffset(selected,Number(b.dataset.monthNav));render()});
    document.querySelectorAll('[data-cal-day]').forEach(b=>b.onclick=()=>{selected=b.dataset.calDay;render()});
    const cal=$('#calendarEventForm'); if(cal) cal.onsubmit=e=>{e.preventDefault();const f=new FormData(cal);data.calendarEvents.push({id:id(),title:f.get('title').trim(),kind:f.get('kind'),date:f.get('date'),time:f.get('time'),endTime:f.get('endTime'),repeat:f.get('repeat'),driftMinutes:Number(f.get('drift')||0),until:f.get('until'),priority:f.get('priority'),color:f.get('color'),sticker:f.get('sticker')||({work:'💼',study:'📚',event:'⭐'}[f.get('kind')]),note:f.get('note').trim(),done:false});save();render()};
    const imp=$('#importantDateForm');if(imp)imp.onsubmit=e=>{e.preventDefault();const f=new FormData(imp);data.importantDates.push({id:id(),title:f.get('title').trim(),date:f.get('date'),sticker:f.get('sticker')||'⭐',yearly:f.get('yearly')==='1',showHome:f.get('showHome')==='1'});save();render()};
    document.querySelectorAll('[data-event-toggle]').forEach(b=>b.onclick=()=>{const x=data.calendarEvents.find(e=>e.id===b.dataset.eventToggle);if(x){x.done=!x.done;save();render()}});
    document.querySelectorAll('[data-event-delete]').forEach(b=>b.onclick=()=>{if(confirm('حذف هذا الموعد؟')){data.calendarEvents=data.calendarEvents.filter(x=>x.id!==b.dataset.eventDelete);save();render()}});
    if($('#exportIcs'))$('#exportIcs').onclick=downloadIcs;

    document.querySelectorAll('[data-prayer]').forEach(c=>c.onchange=()=>{data.prayerChecks[selected]??={};data.prayerChecks[selected][c.dataset.prayer]=c.checked;save();render()});
    document.querySelectorAll('[data-adhkar-inc]').forEach(b=>b.onclick=()=>{const key=selected+'|'+b.dataset.adhkarInc;data.dailyAdhkar.counts[key]=Number(data.dailyAdhkar.counts[key]||0)+1;save();render()});
    document.querySelectorAll('[data-adhkar-edit]').forEach(b=>b.onclick=()=>{const arr=data.dailyAdhkar[b.dataset.group],x=arr.find(z=>z.id===b.dataset.adhkarEdit);const txt=prompt('نص الذكر',x.text);if(txt===null)return;const target=Number(prompt('الهدف اليومي',String(x.target)));if(!txt.trim()||!Number.isFinite(target)||target<1)return;x.text=txt.trim();x.target=Math.round(target);save();render()});
    document.querySelectorAll('[data-adhkar-add]').forEach(f=>f.onsubmit=e=>{e.preventDefault();const fd=new FormData(f);data.dailyAdhkar[f.dataset.adhkarAdd].push({id:id(),text:fd.get('text').trim(),target:Number(fd.get('target'))});save();render()});

    const wf=$('#weightForm');if(wf)wf.onsubmit=e=>{e.preventDefault();const f=new FormData(wf);data.weightEntries.push({id:id(),kg:Number(f.get('kg')),date:f.get('date')});save();render()};
    document.querySelectorAll('[data-weight-delete]').forEach(b=>b.onclick=()=>{data.weightEntries=data.weightEntries.filter(x=>x.id!==b.dataset.weightDelete);save();render()});
    document.querySelectorAll('[data-y2-water]').forEach(b=>b.onclick=()=>{data.waterEntries.push({id:id(),date:selected,ml:Number(b.dataset.y2Water)});save();render()});

    const dpf=$('#debtPersonForm');if(dpf)dpf.onsubmit=e=>{e.preventDefault();const f=new FormData(dpf);data.debtPeople.push({id:id(),name:f.get('name').trim(),transactions:[]});save();render()};
    document.querySelectorAll('[data-debt-tx]').forEach(f=>f.onsubmit=e=>{e.preventDefault();const p=data.debtPeople.find(x=>x.id===f.dataset.debtTx),fd=new FormData(f),amt=Number(fd.get('amount')),type=fd.get('type');const delta={owed:amt,owe:-amt,received:-amt,paid:amt}[type];const label={owed:'إلي عليها',owe:'عليّ إلها',received:'دفعت لي',paid:'دفعت إلها'}[type];p.transactions.push({id:id(),date:fd.get('date'),delta,label,note:fd.get('note').trim()});save();render()});
    document.querySelectorAll('[data-debt-person-delete]').forEach(b=>b.onclick=()=>{if(confirm('حذف كشف هذا الشخص بكل الحركات؟')){data.debtPeople=data.debtPeople.filter(x=>x.id!==b.dataset.debtPersonDelete);save();render()}});
    document.querySelectorAll('[data-cycle-close]').forEach(b=>b.onclick=()=>{const p=data.periods.find(x=>x.id===b.dataset.cycleClose);if(p){p.end=today();save();render()}});

    const cf=$('#clientForm');if(cf)cf.onsubmit=e=>{e.preventDefault();const f=new FormData(cf);const c={id:id(),name:f.get('name').trim(),projects:[]};data.clients.push(c);y2.clientId=c.id;save();render()};
    document.querySelectorAll('[data-client-open]').forEach(b=>b.onclick=()=>{y2.clientId=b.dataset.clientOpen;y2.projectId=null;render()});
    if($('#clientsBack'))$('#clientsBack').onclick=()=>{y2.clientId=null;y2.projectId=null;render()};
    const cpf=$('#clientProjectForm');if(cpf)cpf.onsubmit=e=>{e.preventDefault();const c=data.clients.find(x=>x.id===y2.clientId),f=new FormData(cpf),p={id:id(),title:f.get('title').trim(),due:f.get('due'),amount:Number(f.get('amount')||0),paid:Number(f.get('paid')||0),status:'جديد',assets:[]};c.projects.push(p);y2.projectId=p.id;save();render()};
    document.querySelectorAll('[data-project-open]').forEach(b=>b.onclick=()=>{y2.projectId=b.dataset.projectOpen;render()});
    if($('#projectBack'))$('#projectBack').onclick=()=>{y2.projectId=null;render()};
    const pef=$('#projectEditForm');if(pef)pef.onsubmit=e=>{e.preventDefault();const c=data.clients.find(x=>x.id===y2.clientId),p=c.projects.find(x=>x.id===y2.projectId),f=new FormData(pef);for(const k of ['status','due','required','doneText','pending','received','notes'])p[k]=f.get(k);p.paid=Number(f.get('paid')||0);save();render()};
    const paf=$('#projectAssetForm');if(paf)paf.onsubmit=async e=>{e.preventDefault();const c=data.clients.find(x=>x.id===y2.clientId),p=c.projects.find(x=>x.id===y2.projectId),f=new FormData(paf),file=f.get('file');if(!file?.size)return;const src=await compressImage(file,1200,.68);p.assets.push({id:id(),src,status:f.get('status'),caption:f.get('caption').trim()});save();render()};
    document.querySelectorAll('[data-asset-delete]').forEach(b=>b.onclick=()=>{const c=data.clients.find(x=>x.id===y2.clientId),p=c.projects.find(x=>x.id===y2.projectId);p.assets=p.assets.filter(x=>x.id!==b.dataset.assetDelete);save();render()});

    const crf=$('#courseForm');if(crf)crf.onsubmit=e=>{e.preventDefault();const f=new FormData(crf),c={id:id(),title:f.get('title').trim(),items:[]};data.learningSpaces.push(c);y2.courseId=c.id;save();render()};
    document.querySelectorAll('[data-course-open]').forEach(b=>b.onclick=()=>{y2.courseId=b.dataset.courseOpen;render()});
    if($('#courseBack'))$('#courseBack').onclick=()=>{y2.courseId=null;render()};
    const cif=$('#courseItemForm');if(cif)cif.onsubmit=async e=>{e.preventDefault();const c=data.learningSpaces.find(x=>x.id===y2.courseId),f=new FormData(cif),file=f.get('file');let src='';if(file?.size)src=await compressImage(file,1200,.68);c.items.push({id:id(),title:f.get('title').trim(),type:f.get('type'),url:f.get('url'),src,note:f.get('note').trim(),watched:f.get('watched')==='on'});save();render()};
    document.querySelectorAll('[data-course-item-toggle]').forEach(b=>b.onclick=()=>{const c=data.learningSpaces.find(x=>x.id===y2.courseId),i=c.items.find(x=>x.id===b.dataset.courseItemToggle);i.watched=!i.watched;save();render()});
    document.querySelectorAll('[data-course-item-delete]').forEach(b=>b.onclick=()=>{const c=data.learningSpaces.find(x=>x.id===y2.courseId);c.items=c.items.filter(x=>x.id!==b.dataset.courseItemDelete);save();render()});

    const bg=$('#backgroundForm');if(bg)bg.onsubmit=async e=>{e.preventDefault();const f=new FormData(bg),file=f.get('file');if(!file?.size)return;data.designSettings.background=await compressImage(file,1600,.70);save();applyDesign();render()};
    if($('#clearBackground'))$('#clearBackground').onclick=()=>{data.designSettings.background=null;save();applyDesign();render()};
    const sf=$('#stickerForm');if(sf)sf.onsubmit=e=>{e.preventDefault();const f=new FormData(sf);data.designSettings.stickers.push({id:id(),text:f.get('text').trim(),x:Number(f.get('x')),y:Number(f.get('y')),size:Number(f.get('size'))});save();applyDesign();render()};
    document.querySelectorAll('[data-sticker-delete]').forEach(b=>b.onclick=()=>{data.designSettings.stickers=data.designSettings.stickers.filter(x=>x.id!==b.dataset.stickerDelete);save();applyDesign();render()});
  }

  ensure(); addNavPages();

  const oldHome=home, oldFinance=finance, oldCycle=cycle;
  home=function(){ return importantHome()+oldHome(); };
  finance=function(){ return oldFinance()+debtLedgerSection(); };
  cycle=function(){ return oldCycle()+cycleDotsSection(); };

  const baseRender=render;
  const customRenderers={planner,clients,learning,worship,tracking,customize};
  render=function(){
    ensure();
    if(!customRenderers[page]){
      baseRender();
      attachCustom();
      applyDesign();
      return;
    }
    nav();
    $('#todayLabel').textContent=dateLabel(today());
    $('#view').innerHTML=customRenderers[page]();
    attachCommon();
    window.yomiTimerRender?.();
    window.yomiThemeApply?.();
    attachCustom();
    applyDesign();
  };
  window.yomiV2ApplyDesign=applyDesign;
  applyDesign();
  render();
})();