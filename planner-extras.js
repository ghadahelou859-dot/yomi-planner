/* Extra finance and development views; all records stay in the existing synced JSON. */
(function () {
  const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const rate = type => Math.max(0, Math.min(100, Number(data.givingRates?.[type] ?? (type === 'salary' ? 5 : 15))));
  const monthOf = x => x.month || x.date?.slice(0, 7) || '';
  const salary = x => x.source === 'راتب' && (!x.givingType || x.givingType === 'salary');
  const work = x => x.givingType === 'work';
  const obligation = x => round(Number(x.amount || 0) * Number(x.givingRate ?? (salary(x) ? 5 : 15)) / 100);
  const payments = x => (data.givingPayments || []).filter(p => p.incomeId === x.id);
  const paid = x => round(sum(payments(x).map(p => p.amount)));
  const due = x => Math.max(0, round(obligation(x) - paid(x)));
  const dateInRange = date => !!date && belongs(date);
  const workCosts = () => data.expenses.filter(x => x.category === 'شغل' && !x.subscriptionId && dateInRange(x.date));
  const subscriptionCosts = () => data.expenses.filter(x => x.subscriptionId && dateInRange(x.date));
  const sourceLabel = x => x.workKind === 'cards' ? 'كروت' : 'شغل خارجي آخر';
  function advanceMonth(day, count) {
    const [year, month, date] = day.split('-').map(Number);
    const target = new Date(Date.UTC(year, month - 1 + count, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(date, last)).padStart(2, '0')}`;
  }
  function nextDue(x) {
    let day = x.start;
    const step = x.cycle === 'yearly' ? 12 : 1;
    for (let n = 0; n < 240; n++) {
      if (!(x.payments || []).some(p => p.due === day)) return day;
      day = advanceMonth(x.start, step * (n + 1));
    }
    return day;
  }
  function salaryPanel() {
    const month = selected.slice(0, 7);
    const rows = (data.incomes || []).filter(salary).sort((a, b) => monthOf(b).localeCompare(monthOf(a)));
    const current = rows.find(x => monthOf(x) === month);
    return `<section class="panel"><h2>راتبي والصدقة 🌿</h2><p class="sub">أدخلي قيمة الراتب بنفسك كل شهر. النسبة تخص الراتب فقط، وتثبّت مع تسجيل كل شهر.</p>
      <form id="salaryForm" class="row"><label class="field">شهر الراتب<input name="month" type="month" value="${month}" required></label><label class="field">الراتب الذي وصلني ₪<input name="amount" type="number" min="0.01" step="0.01" value="${current?.amount || ''}" required></label><button class="primary">${current ? 'تحديث راتب الشهر' : 'تسجيل راتب الشهر'}</button></form>
      <form id="salaryRateForm" class="row rate-form"><label class="field">نسبة الراتب للتسجيلات القادمة ٪<input name="rate" type="number" min="0" max="100" step="0.01" value="${rate('salary')}" required></label><button class="soft">تغيير النسبة</button></form>
      ${rows.map(x => incomeGivingRow(x)).join('') || '<div class="empty">لسّه ما سجّلتي راتب شهر</div>'}</section>`;
  }
  function incomeGivingRow(x) {
    return `<div class="item giving-item"><div class="grow"><strong>${safe(x.title)}</strong><small>${safe(monthOf(x))} · دخل ${money(x.amount)} · نسبة ${Number(x.givingRate ?? (salary(x) ? 5 : 15))}٪</small><small>مقترح ${money(obligation(x))} · دفعتي ${money(paid(x))} · باقي ${money(due(x))}</small>${payments(x).map(p => `<small>دفعة ${money(p.amount)} · ${safe(p.date)} <button class="inline-delete" data-giving-delete="${safe(p.id)}">حذف الدفعة</button></small>`).join('')}</div><div class="row"><button class="soft" data-giving-pay="${safe(x.id)}">سجّلتُ صدقة</button><button class="soft" data-giving-income-edit="${safe(x.id)}">تعديل</button><button class="soft" data-giving-income-delete="${safe(x.id)}">حذف</button></div></div>`;
  }
  function workPanel() {
    const month = selected.slice(0, 7);
    const rows = (data.incomes || []).filter(work).sort((a,b) => b.date.localeCompare(a.date));
    const monthRows = rows.filter(x => x.date.startsWith(month));
    const revenue = sum(monthRows.map(x => x.amount));
    const sub = sum(data.expenses.filter(x => x.subscriptionId && x.date.startsWith(month)).map(x => x.amount));
    const direct = sum(data.expenses.filter(x => x.category === 'شغل' && !x.subscriptionId && x.date.startsWith(month)).map(x => x.amount));
    return `<section class="panel"><h2>شغل الكروت والشغل الخارجي ✨</h2><div class="grid"><div class="stat">دخل الشغل هذا الشهر<b>${money(revenue)}</b></div><div class="stat">اشتراكات دُفعت<b>${money(sub)}</b></div><div class="stat">المتبقي بعد تكاليف الشغل<b>${money(revenue - sub - direct)}</b></div></div>
      <p class="sub">نسبة الصدقة تُحسب من المبلغ المقبوض لكل شغل بدون خصم الاشتراكات أو مصاريف الشغل. الربح المالي يُعرض مستقلًا بعد التكاليف.</p>
      <form id="workIncomeForm" class="row"><label class="field">الشغل<input name="title" required placeholder="اسم الكرت أو المشروع"></label><label class="field">النوع<select name="workKind"><option value="cards">كروت</option><option value="other">شغل خارجي آخر</option></select></label><label class="field">المبلغ الذي قبضته ₪<input name="amount" type="number" min="0.01" step="0.01" required></label><label class="field">تاريخ القبض<input name="date" type="date" value="${selected}" required></label><button class="primary">تسجيل دخل الشغل</button></form>
      <form id="workRateForm" class="row rate-form"><label class="field">نسبة الشغل للتسجيلات القادمة ٪<input name="rate" type="number" min="0" max="100" step="0.01" value="${rate('work')}" required></label><button class="soft">تغيير النسبة</button></form>
      ${rows.slice(0, 60).map(x => `<div class="work-type">${sourceLabel(x)}</div>${incomeGivingRow(x)}`).join('') || '<div class="empty">لسّه ما في دخل شغل مسجّل</div>'}</section>`;
  }
  function subscriptionPanel() {
    const rows = data.subscriptions || [];
    const active = rows.filter(x => !x.stopped);
    const monthlyEquivalent = sum(active.map(x => x.cycle === 'yearly' ? Number(x.amount) / 12 : Number(x.amount)));
    return `<section class="panel"><h2>اشتراكات الشغل 🔁</h2><p class="sub">سجّلي ما تدفعينه للأدوات. عند الضغط على «دفعتُه» يُضاف مصروف شغل مرة واحدة، وتظهر قيمته في التقارير.</p><div class="stat">التكلفة الشهرية التقديرية للاشتراكات النشطة<b>${money(round(monthlyEquivalent))}</b></div>
      <form id="subscriptionForm" class="row"><label class="field">اسم الاشتراك<input name="title" required placeholder="مثلاً: Canva"></label><label class="field">قيمة الدفعة ₪<input name="amount" type="number" min="0.01" step="0.01" required></label><label class="field">يتجدد<select name="cycle"><option value="monthly">شهريًا</option><option value="yearly">سنويًا</option></select></label><label class="field">أول موعد دفع<input name="start" type="date" value="${selected}" required></label><button class="primary">إضافة اشتراك</button></form>
      ${rows.map(x => {const next=nextDue(x);return `<div class="item subscription-item"><div class="grow"><strong>${safe(x.title)}</strong><small>${money(x.amount)} · ${x.cycle === 'yearly' ? 'سنوي' : 'شهري'} · ${x.stopped ? 'متوقف' : 'الموعد القادم: '+safe(next)}</small><small>دُفع ${money(sum((x.payments || []).map(p => p.amount)))} عبر ${(x.payments || []).length} دفعات</small></div><div class="row">${!x.stopped && next <= today() ? `<button class="soft" data-sub-pay="${safe(x.id)}">دفعتُه</button>` : ''}<button class="soft" data-sub-edit="${safe(x.id)}">تعديل</button>${!x.stopped ? `<button class="soft" data-sub-stop="${safe(x.id)}">إيقاف</button>` : `<button class="soft" data-sub-resume="${safe(x.id)}">استئناف</button>`}</div></div>`}).join('') || '<div class="empty">ما في اشتراكات مسجّلة</div>'}</section>`;
  }
  function givingSummary() {
    const salaries = (data.incomes || []).filter(x => salary(x) && monthOf(x) === selected.slice(0, 7));
    const jobs = (data.incomes || []).filter(x => work(x) && x.date.startsWith(selected.slice(0, 7)));
    const stats = entries => ({expected:sum(entries.map(obligation)),paid:sum(entries.map(paid)),due:sum(entries.map(due))});
    const s=stats(salaries),w=stats(jobs);
    return `<section class="panel"><h3>صدقة لوجه الله تعالى · ${safe(selected.slice(0,7))}</h3><div class="grid"><div class="stat">من الراتب<b>${money(s.expected)}</b><small>مدفوع ${money(s.paid)} · باقي ${money(s.due)}</small></div><div class="stat">من شغل الكروت والخارجي<b>${money(w.expected)}</b><small>مدفوع ${money(w.paid)} · باقي ${money(w.due)}</small></div></div><p class="sub">القيم للتنظيم الشخصي؛ كل مصدر ونسبته ودفعاته منفصلة. تعديل النسبة لا يغيّر التسجيلات القديمة.</p></section>`;
  }
  function financeExtras() {return givingSummary()+salaryPanel()+workPanel()+unclassifiedPanel()+subscriptionPanel()}
  function unclassifiedPanel() {
    const rows=(data.incomes||[]).filter(x=>x.source==='دخل آخر'&&!x.givingType);
    if(!rows.length)return '';
    return `<section class="panel"><h3>دخل قديم غير مصنّف</h3><p class="sub">إذا كنتِ سجّلتِ دخل كرت أو شغل سابقًا تحت «دخل آخر»، حدّديه هنا حتى يظهر في حساب صدقة الشغل. ما رح نحوّل أي مبلغ من غير اختيارك.</p>${rows.map(x=>`<div class="item"><div class="grow">${safe(x.title)}<small>${money(x.amount)} · ${safe(x.date)}</small></div><button class="soft" data-work-convert="${safe(x.id)}:cards">كروت</button><button class="soft" data-work-convert="${safe(x.id)}:other">شغل آخر</button></div>`).join('')}</section>`;
  }
  function extraReport() {
    const jobs=(data.incomes||[]).filter(x=>work(x)&&dateInRange(x.date));
    const salaries=(data.incomes||[]).filter(x=>salary(x)&&dateInRange(x.date));
    const received=sum(jobs.map(x=>x.amount)),subs=sum(subscriptionCosts().map(x=>x.amount)),costs=sum(workCosts().map(x=>x.amount));
    const monthlyEquivalent=sum((data.subscriptions||[]).filter(x=>!x.stopped).map(x=>x.cycle==='yearly'?Number(x.amount)/12:Number(x.amount)));
    return `<section class="panel"><h2>شغلي واشتراكاتي خلال الفترة</h2><div class="grid"><div class="stat">قبضت من الشغل<b>${money(received)}</b></div><div class="stat">اشتراكات مدفوعة<b>${money(subs)}</b></div><div class="stat">مصاريف شغل أخرى<b>${money(costs)}</b></div><div class="stat">المتبقي بعد التكاليف<b>${money(received-subs-costs)}</b></div></div><p class="sub">تقدير الاشتراكات النشطة لشهر واحد ${money(round(monthlyEquivalent))}؛ لا يُخصم مرة ثانية من المصاريف المدفوعة.</p>${donut([{label:'اشتراكات',value:subs},{label:'مصاريف شغل أخرى',value:costs}],money(subs+costs),'تكاليف الشغل',money)}<h3>الصدقة المقترحة والمدفوعة</h3><div class="grid"><div class="stat">الراتب<b>${money(sum(salaries.map(obligation)))}</b><small>دفعتِ ${money(sum(salaries.map(paid)))}</small></div><div class="stat">الشغل الخارجي<b>${money(sum(jobs.map(obligation)))}</b><small>دفعتِ ${money(sum(jobs.map(paid)))}</small></div></div></section>`;
  }
  // Weekly ideas stay available offline and sync as ordinary records; the month view gathers their history.
  let ideaDate=today(), ideaView='week';
  function weekStart(day) {const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-d.getUTCDay());return d.toISOString().slice(0,10)}
  function improvementRows(items) {return items.map(x=>`<div class="item idea-item"><label class="idea-check"><input type="checkbox" data-idea-toggle="${safe(x.id)}" ${x.doneAt?'checked':''}><span>${safe(x.title)}</span></label><div class="grow"><small>أسبوع ${safe(x.weekStart)}${x.doneAt?' · أُنجز '+safe(x.doneAt.slice(0,10)):''}</small>${x.note?`<p class="memo-text">${safe(x.note)}</p>`:''}</div><div class="row"><button class="soft" data-idea-edit="${safe(x.id)}">تعديل</button>${!x.doneAt?`<button class="soft" data-idea-next="${safe(x.id)}">للأسبوع القادم</button>`:''}<button class="soft" data-idea-delete="${safe(x.id)}">حذف</button></div></div>`).join('') || '<div class="empty">ما في تعديلات لهذه الفترة</div>'}
  improvements=function() {
    const week=weekStart(ideaDate),month=ideaDate.slice(0,7);
    const items=(data.appIdeas||[]).filter(x=>ideaView==='week'?x.weekStart===week:x.weekStart.startsWith(month)||x.createdAt?.startsWith(month)).sort((a,b)=>a.weekStart.localeCompare(b.weekStart));
    const done=items.filter(x=>x.doneAt).length;
    return `<section class="panel"><h2>تطوير يومي 🛠️</h2><p class="sub">اكتبي التعديلات اللي بدك نشتغل عليها كل أسبوع؛ العرض الشهري يجمع ما سجّلتيه وما اكتمل.</p><div class="row"><button class="tab ${ideaView==='week'?'active':''}" data-idea-view="week">هذا الأسبوع</button><button class="tab ${ideaView==='month'?'active':''}" data-idea-view="month">الشهر</button><label class="field">التاريخ<input id="ideaDate" type="date" value="${ideaDate}"></label></div><div class="stat">${ideaView==='week'?'أسبوع الأحد '+week:'شهر '+month}<b>${done} من ${items.length} تعديل مكتمل</b></div>
      <form id="ideaForm"><label class="field">التعديل المقترح<input name="title" required placeholder="شو بدك نضيف أو نصلّح؟"></label><label class="field">تفاصيل (اختياري)<textarea name="note" rows="3"></textarea></label><label class="field">أسبوع العمل<input name="weekDate" type="date" value="${ideaDate}" required></label><button class="primary">إضافة لقائمة التعديلات</button></form></section><section class="panel"><h3>${ideaView==='week'?'تعديلات هذا الأسبوع':'تعديلات الشهر'}</h3>${improvementRows(items)}</section>`;
  };
  const previousRender=render;
  render=function() {
    previousRender();
    if(page==='giving'){$('#view').innerHTML=`<div class="panel"><h2>صدقة لوجه الله تعالى 💚</h2><p class="sub">الراتب 5٪ والشغل 15٪ مبدئيًا، وبإمكانك تغيير كل نسبة.</p>${datePicker()}</div>`+financeExtras();attachCommon();bindFinance()}
    if(page==='home'){
      const month=selected.slice(0,7),entries=(data.incomes||[]).filter(x=>salary(x)?monthOf(x)===month:work(x)&&x.date.startsWith(month));
      const expected=sum(entries.map(obligation)),remaining=sum(entries.map(due));
      $('#view').insertAdjacentHTML('afterbegin',`<section class="panel giving-shortcut"><h2>صدقة لوجه الله تعالى 💚</h2><p>${entries.length?`المقترح لهذا الشهر ${money(expected)} · المتبقي ${money(remaining)}`:'سجّلي راتبك أو شغل الكروت لتظهر المبالغ هنا.'}</p><button class="primary" id="homeGiving">افتحي صدقتي وشغلي</button></section>`);
      $('#homeGiving').onclick=()=>{page='giving';render()};
    }
    if(page==='finance'){
      $('#view').insertAdjacentHTML('afterbegin',givingSummary()+`<div class="panel"><button class="primary" id="openGiving">افتحي صدقة لوجه الله تعالى والاشتراكات 💚</button></div>`);
      $('#openGiving').onclick=()=>{page='giving';render()};
      document.querySelectorAll('[data-delete^="incomes:"]').forEach(button=>{
        const key=button.dataset.delete.split(':')[1],entry=data.incomes.find(x=>x.id===key);if(!entry?.givingType&&entry?.source!=='راتب')return;
        button.onclick=()=>{if(!confirm('حذف هذا الدخل ودفعات الصدقة المرتبطة به؟'))return;
          data.incomes=data.incomes.filter(x=>x.id!==key);data.givingPayments=data.givingPayments.filter(x=>x.incomeId!==key);save();render()};
      });
      document.querySelectorAll('[data-delete^="expenses:"]').forEach(button=>{
        const expense=data.expenses.find(x=>x.id===button.dataset.delete.split(':')[1]);if(!expense?.subscriptionId)return;
        button.onclick=()=>{if(!confirm('حذف دفعة الاشتراك هذه من المصاريف والسجل؟'))return;
          data.expenses=data.expenses.filter(x=>x.id!==expense.id);const sub=data.subscriptions.find(x=>x.id===expense.subscriptionId);
          if(sub)sub.payments=(sub.payments||[]).filter(p=>p.expenseId!==expense.id);save();render()};
      });
    }
    if(page==='reports')$('#view').insertAdjacentHTML('beforeend',extraReport());
    if(page==='improvements')bindIdeas();
  };
  const validAmount=value=>Number.isFinite(Number(value))&&Number(value)>0&&Number(value)<=100000000;
  function bindForm(selector,fn){const form=$(selector);if(!form)return;form.onsubmit=event=>{event.preventDefault();const success=fn(new FormData(form));if(success!==false){save();render()}}}
  function bindFinance() {
    bindForm('#salaryForm',f=>{
      const month=String(f.get('month')),amount=Number(f.get('amount'));if(!validAmount(amount))return false;
      const x=data.incomes.find(item=>salary(item)&&item.month===month) || data.incomes.find(item=>item.source==='راتب'&&!item.givingType&&item.date?.startsWith(month));
      if(x){x.amount=amount;x.month=month;x.givingType='salary';x.givingRate??=rate('salary')} 
      else data.incomes.push({id:id(),source:'راتب',givingType:'salary',givingRate:rate('salary'),title:'راتب '+month,month,date:month+'-01',amount});
    });
    bindForm('#workIncomeForm',f=>{
      const amount=Number(f.get('amount'));if(!validAmount(amount))return false;
      data.incomes.push({id:id(),source:'شغل خارجي',givingType:'work',givingRate:rate('work'),workKind:f.get('workKind'),title:String(f.get('title')).trim(),amount,date:f.get('date')});
    });
    for(const [selector,type] of [['#salaryRateForm','salary'],['#workRateForm','work']])bindForm(selector,f=>{
      const value=Number(f.get('rate'));if(!Number.isFinite(value)||value<0||value>100){alert('اكتبي نسبة بين 0 و100');return false}
      data.givingRates??={salary:5,work:15};data.givingRates[type]=round(value);
    });
    bindForm('#subscriptionForm',f=>{
      const amount=Number(f.get('amount'));if(!validAmount(amount))return false;
      data.subscriptions??=[];data.subscriptions.push({id:id(),title:String(f.get('title')).trim(),amount,cycle:f.get('cycle'),start:f.get('start'),payments:[]});
    });
    document.querySelectorAll('[data-work-convert]').forEach(button=>button.onclick=()=>{
      const [key,kind]=button.dataset.workConvert.split(':'),x=data.incomes.find(row=>row.id===key);if(!x||x.givingType)return;
      if(!confirm(`تصنيف ${x.title} كدخل شغل مع نسبة ${rate('work')}٪؟`))return;
      x.givingType='work';x.givingRate=rate('work');x.workKind=kind;x.source='شغل خارجي';save();render();
    });
    document.querySelectorAll('[data-giving-pay]').forEach(button=>button.onclick=()=>{
      const x=data.incomes.find(row=>row.id===button.dataset.givingPay);if(!x)return;
      const input=prompt('كم دفعتِ صدقة من هذا المبلغ بالشيكل؟',String(due(x)||''));if(input===null)return;
      const amount=Number(input);if(!validAmount(amount)){alert('اكتبي مبلغًا أكبر من صفر');return}
      data.givingPayments??=[];data.givingPayments.push({id:id(),incomeId:x.id,amount:round(amount),date:today()});save();render();
    });
    document.querySelectorAll('[data-giving-delete]').forEach(button=>button.onclick=()=>{
      if(!confirm('حذف تسجيل دفعة الصدقة؟'))return;data.givingPayments=data.givingPayments.filter(x=>x.id!==button.dataset.givingDelete);save();render();
    });
    document.querySelectorAll('[data-giving-income-edit]').forEach(button=>button.onclick=()=>{
      const x=data.incomes.find(row=>row.id===button.dataset.givingIncomeEdit);if(!x)return;
      const input=prompt('المبلغ المقبوض بالشيكل',String(x.amount));if(input===null)return;
      const amount=Number(input);if(!validAmount(amount)){alert('اكتبي مبلغًا صحيحًا');return}
      x.amount=round(amount);save();render();
    });
    document.querySelectorAll('[data-giving-income-delete]').forEach(button=>button.onclick=()=>{
      const key=button.dataset.givingIncomeDelete;if(!confirm('حذف هذا الدخل ودفعات الصدقة المرتبطة به؟'))return;
      data.incomes=data.incomes.filter(x=>x.id!==key);data.givingPayments=data.givingPayments.filter(x=>x.incomeId!==key);save();render();
    });
    document.querySelectorAll('[data-sub-pay]').forEach(button=>button.onclick=()=>{
      const x=data.subscriptions.find(row=>row.id===button.dataset.subPay);if(!x||x.stopped)return;
      const payDue=nextDue(x);if(payDue>today())return;
      if(!confirm(`تسجيل دفع ${money(x.amount)} لاشتراك ${x.title}؟ سيُضاف إلى المصاريف مرة واحدة.`))return;
      const expenseId=id();x.payments??=[];x.payments.push({id:id(),due:payDue,date:today(),amount:Number(x.amount),expenseId});
      data.expenses.push({id:expenseId,title:'اشتراك '+x.title,amount:Number(x.amount),category:'شغل',date:today(),subscriptionId:x.id});save();render();
    });
    document.querySelectorAll('[data-sub-stop]').forEach(button=>button.onclick=()=>{const x=data.subscriptions.find(row=>row.id===button.dataset.subStop);x.stopped=today();save();render()});
    document.querySelectorAll('[data-sub-resume]').forEach(button=>button.onclick=()=>{const x=data.subscriptions.find(row=>row.id===button.dataset.subResume);delete x.stopped;x.start=today();save();render()});
    document.querySelectorAll('[data-sub-edit]').forEach(button=>button.onclick=()=>{
      const x=data.subscriptions.find(row=>row.id===button.dataset.subEdit);if(!x)return;
      const input=prompt('قيمة الدفعة القادمة بالشيكل (المدفوع سابقًا لا يتغير)',String(x.amount));if(input===null)return;
      const amount=Number(input);if(!validAmount(amount)){alert('اكتبي مبلغًا صحيحًا');return}x.amount=round(amount);save();render();
    });
  }
  function bindIdeas() {
    $('#ideaDate').onchange=event=>{ideaDate=event.target.value||today();render()};
    document.querySelectorAll('[data-idea-view]').forEach(button=>button.onclick=()=>{ideaView=button.dataset.ideaView;render()});
    bindForm('#ideaForm',f=>{data.appIdeas??=[];data.appIdeas.push({id:id(),title:String(f.get('title')).trim(),note:String(f.get('note')).trim(),weekStart:weekStart(f.get('weekDate')),createdAt:new Date().toISOString(),doneAt:null})});
    document.querySelectorAll('[data-idea-toggle]').forEach(input=>input.onchange=()=>{const x=data.appIdeas.find(item=>item.id===input.dataset.ideaToggle);x.doneAt=input.checked?new Date().toISOString():null;save();render()});
    document.querySelectorAll('[data-idea-next]').forEach(button=>button.onclick=()=>{const x=data.appIdeas.find(item=>item.id===button.dataset.ideaNext);x.weekStart=dayAfter(x.weekStart,7);save();render()});
    document.querySelectorAll('[data-idea-edit]').forEach(button=>button.onclick=()=>{const x=data.appIdeas.find(item=>item.id===button.dataset.ideaEdit);const title=prompt('عنوان التعديل',x.title);if(title===null)return;if(!title.trim()){alert('العنوان مطلوب');return}const note=prompt('التفاصيل',x.note||'');if(note===null)return;x.title=title.trim();x.note=note.trim();save();render()});
    document.querySelectorAll('[data-idea-delete]').forEach(button=>button.onclick=()=>{if(!confirm('حذف هذا التعديل من القائمة؟'))return;data.appIdeas=data.appIdeas.filter(x=>x.id!==button.dataset.ideaDelete);save();render()});
  }
  render();
})();
