/* Extra pages and reports. Saved data remains in the planner's existing JSON payload. */
function diary(){
  let rows=[...(data.diary||[])].sort((a,b)=>(b.createdAt||b.date).localeCompare(a.createdAt||a.date));
  return '<div class="panel"><h2>مذكرتي ✍️</h2><p class="sub">أفكارك وتعلّمك وملاحظات شغلك.</p>'+datePicker()+
    '<form id="diaryForm"><label class="field">العنوان<input name="title" required></label><label class="field">القسم<select name="category"><option>فكرة</option><option>تعلّمت</option><option>شغل</option><option>شخصي</option></select></label>'+
    '<label class="field">مشروع (اختياري)<select name="projectId"><option value="">بدون مشروع</option>'+data.projects.map(x=>'<option value="'+safe(x.id)+'">'+safe(x.title)+'</option>').join('')+'</select></label>'+
    '<label class="field">اكتبي بحرية<textarea name="body" rows="9" required></textarea></label><button class="primary">حفظ في مذكرتي</button></form></div>'+
    '<div class="panel"><label class="field">بحث في المذكرة<input id="diarySearch" type="search"></label>'+
    (rows.map(x=>{const project=data.projects.find(p=>p.id===x.projectId);return '<article class="diary-entry" data-diary-row="'+safe([x.title,x.body,x.category,project?.title||''].join(' '))+'"><strong>'+safe(x.title)+'</strong><small> · '+safe(x.date)+' · '+safe(x.category)+(project?' · '+safe(project.title):'')+'</small><p>'+safe(x.body)+'</p><button data-diary-edit="'+x.id+'">تعديل</button> <button data-feature-delete="diary:'+x.id+'">حذف</button></article>'}).join('')||'<div class="empty">مذكرتك جاهزة لأول فكرة 🌿</div>')+'</div>';
}
function care(){
  const entries=(data.careLogs||[]).filter(x=>belongs(x.date));
  return '<div class="panel"><h2>عنايتي 🌸</h2>'+common()+'<p class="sub">سجّلي الروتين والملاحظات الصحية بطريقتك، من غير افتراض سبب الأعراض.</p>'+
    '<form id="careForm"><label class="field">النوع<select name="kind"><option>عناية بالبشرة</option><option>عناية بالشعر</option><option>صحة وحركة</option><option>نوم وراحة</option><option>ملاحظة عن البشرة</option><option>أخرى</option></select></label>'+
    '<label class="field">شو عملتِ أو لاحظتِ؟<input name="title" required></label><label class="field">تفاصيل اختيارية<textarea name="note"></textarea></label><button class="primary">تسجيل العناية</button></form>'+
    '<button class="soft" data-care-routine>الروتين المتكرر وشرب المي</button></div><div class="panel"><h3>سجلّ العناية</h3>'+
    (entries.map(x=>'<div class="item"><div class="grow"><strong>'+safe(x.title)+'</strong><small>'+safe(x.date)+' · '+safe(x.kind)+'</small><p class="memo-text">'+safe(x.note||'')+'</p></div><button data-feature-delete="careLogs:'+x.id+'">حذف</button></div>').join('')||'<div class="empty">لسّه ما في تسجيلات لهالفترة</div>')+'</div>';
}
function savingsPanel(){
  const entries=data.savings||[], period=entries.filter(x=>belongs(x.date)),balance=sum(entries.map(x=>x.type==='deposit'?x.amount:-x.amount));
  return '<div class="panel"><h2>ادّخاري 💰</h2><div class="grid"><div class="stat">رصيد الادّخار المسجّل<b>'+money(balance)+'</b></div><div class="stat">أضفتُ خلال الفترة<b>'+money(sum(period.filter(x=>x.type==='deposit').map(x=>x.amount)))+'</b></div><div class="stat">سحبتُ خلال الفترة<b>'+money(sum(period.filter(x=>x.type==='withdraw').map(x=>x.amount)))+'</b></div></div>'+
    '<p class="sub">التحويل للادّخار أو السحب منه لا يُحسب دخلًا أو مصروفًا ثانية. هذا سجلّك وليس رصيد البنك.</p>'+
    '<form id="savingForm" class="row"><label class="field">الحركة<select name="type"><option value="deposit">إضافة للادّخار</option><option value="withdraw">سحب من الادّخار</option></select></label><label class="field">المبلغ ₪<input name="amount" type="number" min="0.01" step="0.01" required></label><label class="field">السبب<input name="title" required></label><button class="primary">تسجيل الحركة</button></form>'+
    ([...entries].reverse().slice(0,20).map(x=>'<div class="item"><div class="grow">'+safe(x.title)+'<small>'+safe(x.date)+' · '+(x.type==='deposit'?'إضافة':'سحب')+'</small></div><b>'+money(x.amount)+'</b><button data-feature-delete="savings:'+x.id+'">حذف</button></div>').join('')||'<div class="empty">ما في ادّخار مسجّل بعد</div>')+'</div>';
}
function reportExtras(){
  const ex=filtered(data.expenses),inc=filtered(data.incomes||[]),s=(data.savings||[]).filter(x=>belongs(x.date));
  const spent=sum(ex.map(x=>x.amount)),income=sum(inc.map(x=>x.amount)),allocated=sum(s.map(x=>x.type==='deposit'?x.amount:-x.amount));
  const categories=[...new Set(ex.map(x=>x.category))].map(label=>({label,value:sum(ex.filter(x=>x.category===label).map(x=>x.amount))})).sort((a,b)=>b.value-a.value);
  const projects=data.projects.filter(x=>x.due&&belongs(x.due));
  const owe=sum(data.debts.filter(x=>x.type==='owe').map(x=>Math.max(0,Number(x.amount)-Number(x.paid||0))));
  const owed=sum(data.debts.filter(x=>x.type==='owed').map(x=>Math.max(0,Number(x.amount)-Number(x.paid||0))));
  const times=data.tasks.flatMap(x=>Object.entries(x.completedAt||{}).filter(([d,t])=>belongs(d)&&t&&completedTask(x,d)&&d===fmt.format(new Date(t))).map(([,t])=>t));
  const hours=times.map(t=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',hour12:false}).format(new Date(t))));
  const activity=[['الصباح',5,12],['الظهر',12,17],['المساء',17,22],['الليل',22,29]].map(([label,a,b])=>({label,value:hours.filter(h=>h>=a&&h<b||b===29&&h<5).length}));
  const best=activity.reduce((a,b)=>b.value>a.value?b:a,{label:'—',value:0});
  return '<div class="panel"><h3>مالي وإنجازاتي خلال الفترة</h3><div class="grid"><div class="stat">الدخل<b>'+money(income)+'</b></div><div class="stat">المصاريف<b>'+money(spent)+'</b></div><div class="stat">التغيير في الادّخار<b>'+money(allocated)+'</b></div><div class="stat">المتاح بعد تخصيص الادّخار<b>'+money(income-spent-allocated)+'</b></div><div class="stat">ديون عليّ (المتبقي)<b>'+money(owe)+'</b></div><div class="stat">مصاري إليّ (المتبقي)<b>'+money(owed)+'</b></div><div class="stat">المشاريع المكتملة من المستحقّة<b>'+projects.filter(x=>x.done).length+' / '+projects.length+'</b></div><div class="stat">الإنجازات المسجّلة<b>'+filtered(data.achievements).length+'</b></div></div>'+
    '<p class="sub">المتاح تقديري من التسجيلات، وليس رصيد حسابك البنكي.</p><h3>توزيع المصاريف</h3>'+donut(categories,money(spent),'مصاريف الفترة',money)+'</div>'+
    '<div class="panel"><h3>متى بتنجزي أكثر؟</h3>'+(hours.length?'<div class="notice">أكثر فترة أنجزتِ فيها مهام: '+best.label+' ('+best.value+').</div>'+bars(activity):'<div class="empty">كمّلي المهام في يومها لتظهر أوقات نشاطك. المهام القديمة بلا ساعة إكمال لا تُخمَّن.</div>')+'<p class="sub">يعتمد على وقت إكمال المهام بتوقيت فلسطين.</p></div>';
}
const previousRender=render;
render=function(){
  previousRender();
  if(page==='finance')$('#view').insertAdjacentHTML('beforeend',savingsPanel());
  if(page==='reports')$('#view').insertAdjacentHTML('beforeend',reportExtras());
  if(page==='wellness')$('#view').querySelector('.panel')?.insertAdjacentHTML('afterbegin','<button class="soft" data-care-open>افتحي صفحة عنايتي 🌸</button>');
  document.querySelectorAll('[data-task-toggle]').forEach(el=>{const original=el.onchange;el.onchange=event=>{const x=data.tasks.find(t=>t.id===el.dataset.taskToggle),day=el.dataset.taskDay;if(x){x.completedAt??={};if(el.checked&&day===today())x.completedAt[day]=new Date().toISOString();else delete x.completedAt[day]}original?.(event)}});
  if(page==='tasks'){
    $('#view').querySelector('.panel')?.insertAdjacentHTML('afterbegin','<button class="soft" data-tomorrow>جهّزي مهام بكرا</button>');
    document.querySelectorAll('[data-delete^="tasks:"]').forEach(el=>el.insertAdjacentHTML('beforebegin','<button data-edit-task="'+el.dataset.delete.split(':')[1]+'">تعديل</button>'));
  }
  $('#view').querySelectorAll('[data-care-open],[data-care-routine]').forEach(el=>el.onclick=()=>{page=el.hasAttribute('data-care-open')?'care':'wellness';render()});
  $('#view').querySelectorAll('[data-tomorrow]').forEach(el=>el.onclick=()=>{selected=dayAfter(today());range='daily';render()});
  $('#view').querySelectorAll('[data-edit-task]').forEach(el=>el.onclick=()=>{
    const x=data.tasks.find(t=>t.id===el.dataset.editTask);if(!x)return;
    const title=prompt('اسم المهمة',x.title);if(title===null)return;
    const start=prompt('تاريخ البداية YYYY-MM-DD',x.date);if(start===null)return;
    const end=prompt('تاريخ النهاية YYYY-MM-DD أو فارغ',x.end||'');if(end===null)return;
    if(!title.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(start)||Number.isNaN(Date.parse(start))||(end&&(!/^\d{4}-\d{2}-\d{2}$/.test(end)||Number.isNaN(Date.parse(end))||end<start))){alert('تحققي من اسم المهمة والتواريخ');return}
    x.title=title.trim();x.date=start;x.end=end;data.reminders.filter(r=>r.taskId===x.id).forEach(r=>{r.title='موعد المهمة: '+x.title;r.date=start});save();render();
  });
  const bind=(selector,handler)=>{const form=$(selector);if(form)form.onsubmit=e=>{e.preventDefault();const ok=handler(new FormData(form));if(ok!==false){save();render()}}};
  bind('#diaryForm',f=>{data.diary??=[];data.diary.push({id:id(),date:selected,title:f.get('title').trim(),body:f.get('body').trim(),category:f.get('category'),projectId:f.get('projectId')||'',createdAt:new Date().toISOString()})});
  bind('#careForm',f=>{data.careLogs??=[];data.careLogs.push({id:id(),date:selected,title:f.get('title').trim(),kind:f.get('kind'),note:f.get('note').trim()})});
  bind('#savingForm',f=>{const amount=Number(f.get('amount')),balance=sum((data.savings||[]).map(x=>x.type==='deposit'?x.amount:-x.amount));if(!Number.isFinite(amount)||amount<=0||f.get('type')==='withdraw'&&amount>balance){alert('المبلغ غير صحيح أو أكبر من المُدّخر');return false}data.savings??=[];data.savings.push({id:id(),date:selected,type:f.get('type'),amount,title:f.get('title').trim()})});
  $('#diarySearch')?.addEventListener('input',e=>{const q=e.target.value.trim().toLocaleLowerCase('ar');document.querySelectorAll('[data-diary-row]').forEach(row=>row.hidden=!row.dataset.diaryRow.toLocaleLowerCase('ar').includes(q))});
  document.querySelectorAll('[data-diary-edit]').forEach(el=>el.onclick=()=>{const x=data.diary.find(t=>t.id===el.dataset.diaryEdit);if(!x)return;const title=prompt('العنوان',x.title);if(title===null)return;const body=prompt('النص',x.body);if(body===null)return;if(!title.trim()||!body.trim()){alert('العنوان والنص مطلوبان');return}x.title=title.trim();x.body=body.trim();x.editedAt=new Date().toISOString();save();render()});
  document.querySelectorAll('[data-feature-delete]').forEach(el=>el.onclick=()=>{const [type,key]=el.dataset.featureDelete.split(':');if(!confirm('حذف هذا السجل؟'))return;data[type]=(data[type]||[]).filter(x=>x.id!==key);save();render()});
};
render();
