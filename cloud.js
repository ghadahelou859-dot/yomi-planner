import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
const cfg = window.YOMI_SUPABASE_CONFIG;
const ready = cfg?.url?.startsWith('https://') && cfg?.publishableKey?.startsWith('sb_publishable_') && !cfg.url.includes('YOUR_');
if (ready && !window.YOMI_CLOUD_READY) {
  window.YOMI_CLOUD_READY = true;
  const client = createClient(cfg.url, cfg.publishableKey);
  const gate = document.getElementById('accountGate');
  const form = document.getElementById('accountForm');
  const status = document.getElementById('accountStatus');
  const badge = document.getElementById('cloudBadge');
  const identity = document.getElementById('accountIdentity');
  const syncBtn = document.getElementById('syncBtn');
  syncBtn.hidden = false;
  const baseKey = 'yomi-sync-base-v2';
  const archiveKey = 'yomi-conflict-archives-v1';
  let user = null, base = null, remoteUpdatedAt = null, timer = null, busy = false, conflictSnapshot = null;
  window.yomiMemoriesSession = () => user ? {client,user} : null;
  const notifyMemories = () => window.dispatchEvent(new Event('yomi-cloud-session'));
  const conflictDialog = document.getElementById('conflictDialog');
  const shape = d => ({...initial(), ...(d || {})});
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const nonempty = d => ['tasks','achievements','expenses','incomes','debts','reminders','notes','periods','restDays','dhikrs','waterEntries','readings','journal','habits','routines','timerSessions','budgets','bills','projects','savings','careLogs','diary','memories','subscriptions','givingPayments','appIdeas'].some(k => d[k]?.length) || !!d.cycleSettings?.minDays || !!d.waterGoal || !!d.quran?.lastPage || !!d.quran?.log?.length || !!d.quran?.tracks?.length || !!d.quran?.extraLogs?.length || Number(d.givingRates?.salary ?? 5)!==5 || Number(d.givingRates?.work ?? 15)!==15;
  const paint = s => {badge.hidden = false;badge.textContent = s};
  const paintSynced = updatedAt => {
    const time = updatedAt && new Intl.DateTimeFormat('ar-PS', {hour:'numeric',minute:'2-digit',timeZone:'Asia/Jerusalem'}).format(new Date(updatedAt));
    paint('✓ محفوظ في الحساب' + (time ? ' · آخر مزامنة ' + time : ''));
  };
  const identify = () => {identity.hidden=!user;identity.textContent=user?'الحساب: '+user.email:''};
  const saveLocal = () => localStorage.setItem(KEY, JSON.stringify(data));
  function loadBase() {
    try {
      const record = JSON.parse(localStorage.getItem(baseKey) || 'null');
      base = record?.userId === user.id ? shape(record.data) : null;
      remoteUpdatedAt = record?.userId === user.id ? record.updatedAt : null;
    } catch {base=null;remoteUpdatedAt=null}
  }
  function setBase(snapshot, updatedAt) {
    base = structuredClone(shape(snapshot));
    remoteUpdatedAt = updatedAt;
    localStorage.setItem(baseKey, JSON.stringify({userId:user.id,data:base,updatedAt}));
  }
  function pending() {return base ? !same(data,base) : nonempty(data)}
  function archives() {
    try {return JSON.parse(localStorage.getItem(archiveKey)||'[]').filter(x=>x.userId===user?.id)}
    catch {return []}
  }
  function archiveConflict(snapshot) {
    const existing=archives();
    if(existing.some(x=>same(x.local,snapshot.local)&&same(x.remote,snapshot.remote)))return true;
    const record={id:crypto.randomUUID(),userId:user.id,date:new Date().toISOString(),local:snapshot.local,remote:snapshot.remote};
    try {
      // A failed write leaves the older archives intact. Never resolve without a recoverable copy.
      const all=JSON.parse(localStorage.getItem(archiveKey)||'[]');
      localStorage.setItem(archiveKey,JSON.stringify([record,...existing].slice(0,3).concat(all.filter(x=>x.userId!==user.id))));
      return true;
    } catch(e) {console.error('Conflict archive failed',e);return false}
  }
  async function showArchives() {
    const list=document.getElementById('conflictArchives');
    list.textContent='جارٍ تحميل النسخ المحفوظة…';
    const local=archives().map(x=>({...x,source:'هذا الجهاز'}));
    let cloud=[],failed=false;
    if(user&&navigator.onLine){
      try {
        const {data:rows,error}=await client.from('yomi_conflict_backups').select('id,device_copy,account_copy,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20);
        if(error)throw error;
        cloud=(rows||[]).map(x=>({id:x.id,date:x.created_at,local:x.device_copy,remote:x.account_copy,source:'الحساب'}));
      }catch(e){failed=true;console.error('Loading backups failed',e)}
    }
    const saved=[...cloud,...local.filter(x=>!cloud.some(y=>same(x.local,y.local)&&same(x.remote,y.remote)))];
    list.innerHTML=(failed?'<p>تعذّر تحميل نسخ الحساب. نسخ هذا الجهاز ظاهرة تحت.</p>':'')+(saved.length?saved.map((x,i)=>'<div class="row"><span>نسخة '+safe(x.source)+' · '+safe(new Date(x.date).toLocaleString('ar-PS'))+'</span><button type="button" class="soft" data-archive="'+i+'" data-copy="local">استعادة نسخة هذا الجهاز</button><button type="button" class="soft" data-archive="'+i+'" data-copy="remote">استعادة نسخة الحساب</button></div>').join(''):'<p>ما في نسخ تعارض محفوظة لهذا الحساب.</p>');
    list.querySelectorAll('[data-archive]').forEach(button=>button.onclick=()=>{
      const record=saved[Number(button.dataset.archive)];
      if(!record)return;
      if(!confirm('استعادة هذه النسخة ستستبدل بيانات هذا الجهاز الحالية. متابعة؟'))return;
      data=structuredClone(button.dataset.copy==='local'?record.local:record.remote);
      saveLocal();document.getElementById('backupDialog').close();render();
      paint('تمت الاستعادة على هذا الجهاز · اضغطي مزامنة الآن لمراجعة الحساب');
    });
  }
  document.getElementById('showConflictArchives').onclick=showArchives;
  async function ensureCloudBackup(snapshot) {
    if(snapshot.cloudArchiveSaved)return true;
    if(!user||!navigator.onLine)return false;
    if(snapshot.cloudArchivePromise)return snapshot.cloudArchivePromise;
    snapshot.cloudArchivePromise=(async()=>{
      try {
        const bytes=new TextEncoder().encode(JSON.stringify([snapshot.local,snapshot.remote]));
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        const key=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
        const {error}=await client.from('yomi_conflict_backups').insert({user_id:user.id,conflict_key:key,device_copy:snapshot.local,account_copy:snapshot.remote});
        if(error&&error.code!=='23505')throw error;
        snapshot.cloudArchiveSaved=true;
        if(conflictSnapshot===snapshot)document.getElementById('conflictBackupStatus').textContent='انحفظت النسختان تلقائيًا في الحساب، وبإمكانك استعادتهما من أي جهاز بنفس الحساب. اختاري القيمة الصحيحة واعملي مزامنة.';
        return true;
      }catch(e){
        console.error('Cloud backup failed',e);
        if(conflictSnapshot===snapshot)document.getElementById('conflictBackupStatus').textContent='تعذّر حفظ النسختين في الحساب. بيانات هذا الجهاز محفوظة؛ تأكدي من النت وجرّبي المزامنة مرة ثانية.';
        return false;
      }finally{snapshot.cloudArchivePromise=null}
    })();
    return snapshot.cloudArchivePromise;
  }
  function backupPrompt(snapshot, details) {
    if(conflictDialog.open&&conflictSnapshot&&
       same(conflictSnapshot.local,snapshot.local)&&
       same(conflictSnapshot.remote,snapshot.remote))return;
    conflictSnapshot={...snapshot,details,archived:archiveConflict(snapshot),backupDownloaded:false};
    paint(conflictSnapshot.archived?'تعارض بين الجهازين · النسختان محفوظتان على هذا الجهاز':'تعارض بين الجهازين · نزّلي نسخة احتياطية');
    const sections={tasks:'مهامي',dhikrs:'أذكاري',quran:'وردي القرآني',readings:'القراءة',journal:'مراجعتي',diary:'مذكرتي',careLogs:'عنايتي',expenses:'مصاريفي',incomes:'دخلي',savings:'ادّخاري',waterEntries:'المي',projects:'مشاريع شغلي',routines:'روتيني',debts:'الديون',notes:'ملاحظاتي',reminders:'تذكيراتي'};
    const fields={title:'الاسم',body:'النص',amount:'المبلغ',paid:'المدفوع',lastPage:'آخر صفحة',done:'مكتمل',date:'التاريخ',status:'الحالة',count:'العدد',waterGoal:'هدف المي'};
    const showValue=v=>v===undefined?'محذوف':JSON.stringify(v)?.slice(0,180)??'فارغ';
    document.getElementById('conflictRows').innerHTML=details.map((entry,i)=>{
      const parts=entry.path.split('.'),collection=parts[1],localItems=Array.isArray(snapshot.local[collection])?snapshot.local[collection]:[],remoteItems=Array.isArray(snapshot.remote[collection])?snapshot.remote[collection]:[],record=[...localItems,...remoteItems].find(x=>x.id===parts[2]);
      const label=[sections[collection]||collection,record?.title||record?.date||'',fields[parts.at(-1)]||parts.at(-1)].filter(Boolean).join(' · ');
      return '<fieldset><legend>'+safe(label)+'</legend><label><input type="radio" name="choice'+i+'" value="local" required> هذا الجهاز: '+safe(showValue(entry.local))+'</label><label><input type="radio" name="choice'+i+'" value="remote" required> الحساب: '+safe(showValue(entry.remote))+'</label></fieldset>';
    }).join('');
    document.getElementById('conflictBackupStatus').textContent='جارٍ حفظ نسختَي الجهاز والحساب تلقائيًا في حسابك…';
    if(!conflictDialog.open)conflictDialog.showModal();
    ensureCloudBackup(conflictSnapshot);
  }
  function downloadConflict(){
    if(!conflictSnapshot)return;
    try{
      const file=new Blob([JSON.stringify({app:'yomi-conflict',version:1,exportedAt:new Date().toISOString(),local:conflictSnapshot.local,remote:conflictSnapshot.remote},null,2)],{type:'application/json'});
      const link=document.createElement('a');link.href=URL.createObjectURL(file);link.download='yomi-two-copies-'+new Date().toISOString().slice(0,10)+'.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(link.href),5000);
      conflictSnapshot.backupDownloaded=true;
      document.getElementById('conflictBackupStatus').textContent='بدأ تنزيل ملف النسختين. تأكدي إنه موجود في التنزيلات، ثم اعتمدي اختيارك.';
    }catch(e){paint('لم يبدأ تنزيل النسخة الاحتياطية');console.error('Backup failed',e)}
  }
  document.getElementById('bothConflictBackup').onclick=downloadConflict;
  document.getElementById('closeConflict').onclick=()=>conflictDialog.close();
  document.getElementById('conflictForm').onsubmit=async event=>{
    event.preventDefault();
    const snapshot=conflictSnapshot;
    if(!snapshot||busy)return;
    if(!snapshot.archived&&!snapshot.backupDownloaded&&!snapshot.cloudArchiveSaved){alert('تعذّر حفظ النسختين داخل التطبيق. نزّلي الملف واحفظيه في «الملفات» أولًا.');return}
    if(!navigator.onLine){paint('بدون نت · محفوظ على هذا الجهاز');return}
    if(!same(shape(data),snapshot.local)){conflictDialog.close();paint('تغيّرت بيانات هذا الجهاز · راجعي التعارض من جديد');return}
    const choices=Object.fromEntries(snapshot.details.map((entry,i)=>[entry.path,new FormData(event.currentTarget).get('choice'+i)]));
    if(Object.values(choices).some(x=>!x)){alert('اختاري قيمة لكل اختلاف.');return}
    busy=true;
    try{
      if(!await ensureCloudBackup(snapshot)){paint('تعذّر حفظ النسختين في الحساب · جرّبي المزامنة مرة ثانية');return}
      const {data:latest,error}=await client.from('yomi_state').select('payload,updated_at').eq('user_id',user.id).maybeSingle();
      if(error)throw error;
      if(!latest||latest.updated_at!==snapshot.updatedAt){conflictDialog.close();paint('تغيّرت نسخة الحساب · اضغطي مزامنة الآن للمراجعة');return}
      const merged=shape(window.yomiMerge(snapshot.baseline,snapshot.local,snapshot.remote,choices).value);
      const {data:saved,error:writeError}=await client.from('yomi_state').update({payload:merged,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('updated_at',snapshot.updatedAt).select('updated_at').maybeSingle();
      if(writeError)throw writeError;
      if(!saved){conflictDialog.close();paint('تغيّرت نسخة الحساب · اضغطي مزامنة الآن');return}
      if(!same(shape(data),snapshot.local)){setBase(merged,saved.updated_at);conflictDialog.close();paint('ظهرت تعديلات جديدة · اضغطي مزامنة الآن');return}
      data=merged;saveLocal();setBase(merged,saved.updated_at);conflictSnapshot=null;conflictDialog.close();render();paintSynced(saved.updated_at);
    }catch(e){paint('تعذّر حل التعارض · النسختان محفوظتان');console.error('Conflict resolution failed',e)}
    finally{busy=false}
  };
  async function reconcile() {
    if (!user || !navigator.onLine || busy) return;
    busy=true;
    try {
      const {data:row,error} = await client.from('yomi_state').select('payload,updated_at').eq('user_id',user.id).maybeSingle();
      if(error) throw error;
      const remote=row?shape(row.payload):shape(initial());
      const local=shape(data);
      let merged;
      if(base) {
        const result=window.yomiMerge(base,local,remote);
        if(result.conflicts.length){backupPrompt({baseline:base,local,remote,updatedAt:row?.updated_at},result.details);return}
        merged=shape(result.value);
      } else if(!row) {
        merged=local;
      } else if(same(local,remote) || !nonempty(local)) {
        merged=remote;
      } else {
        const result=window.yomiMerge(shape(initial()),local,remote);
        if(result.conflicts.length){backupPrompt({baseline:shape(initial()),local,remote,updatedAt:row?.updated_at},result.details);return}
        merged=shape(result.value);
      }
      if(!same(local,shape(data))){paint('تعديلات جديدة · جارٍ إعادة المزامنة');return}
      if(same(merged,remote) && row) {
        data=merged;saveLocal();setBase(merged,row.updated_at);render();paintSynced(row.updated_at);
        return;
      }
      const {data:latest,error:checkError}=await client.from('yomi_state').select('payload,updated_at').eq('user_id',user.id).maybeSingle();
      if(checkError)throw checkError;
      if((latest?.updated_at||null)!==(row?.updated_at||null)){paint('تحديث من جهاز آخر · جارٍ إعادة المزامنة');return}
      if(!same(local,shape(data))){paint('تعديلات جديدة · جارٍ إعادة المزامنة');return}
      // Conditional update prevents another device's newer snapshot from being overwritten.
      const write={payload:merged,updated_at:new Date().toISOString()};
      const {data:saved,error:writeError}=row
        ? await client.from('yomi_state').update(write).eq('user_id',user.id).eq('updated_at',row.updated_at).select('updated_at').maybeSingle()
        : await client.from('yomi_state').insert({user_id:user.id,...write}).select('updated_at').maybeSingle();
      if(writeError)throw writeError;
      if(!saved){paint('تحديث من جهاز آخر · جارٍ إعادة المزامنة');schedule();return}
      // If another edit occurred during the write, keep that local edit and sync again.
      const changedDuringWrite=!same(local,shape(data));
      if(!changedDuringWrite){data=merged;saveLocal()}
      setBase(merged,saved.updated_at);render();
      if(changedDuringWrite)paint('جارٍ مزامنة تعديل أحدث…');else paintSynced(saved.updated_at);
    } catch(e) {paint('تعذّرت المزامنة · محفوظ على هذا الجهاز');console.error('Sync failed',e)}
    finally {busy=false;if(user && navigator.onLine && pending() && badge.textContent.includes('جارٍ')) schedule()}
  }
  function schedule() {clearTimeout(timer);timer=setTimeout(()=>{timer=null;reconcile()},900)}
  save = () => {saveLocal();paint(!navigator.onLine?'بدون نت · محفوظ على هذا الجهاز':user?'جارٍ المزامنة…':'محفوظ على هذا الجهاز · سجّلي الدخول للمزامنة');if(user&&navigator.onLine)schedule()};
  async function showAccount() {
    if(!navigator.onLine){gate.hidden=true;paint('بدون نت · محفوظ على هذا الجهاز');return}
    if(user){gate.hidden=true;await reconcile();return}
    status.textContent='جارٍ التحقق من الحساب…';
    try {
      const {data:{user:found},error}=await client.auth.getUser();
      if(found){user=found;identify();loadBase();gate.hidden=true;document.getElementById('signOutBtn').hidden=false;await reconcile();notifyMemories();return}
      gate.hidden=false;
      status.textContent=error && error.name!=='AuthSessionMissingError'?'تعذّر التحقق من الحساب. تحققي من الاتصال.':'سجّلي دخولك بنفس البريد وكلمة المرور على الهاتف واللابتوب. رمز الرقمين لهذا الجهاز فقط.';
    } catch(e) {gate.hidden=false;status.textContent='تعذّر الاتصال بالحساب. بيانات هذا الجهاز محفوظة.';console.error('Account check failed',e)}
  }
  form.onsubmit=async event=>{
    event.preventDefault();
    const email=form.elements.email.value.trim(),password=form.elements.password.value;
    status.textContent='جارٍ التحقق…';
    const action=event.submitter?.value||'login';
    const result=action==='signup'?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):await client.auth.signInWithPassword({email,password});
    if(result.error){status.textContent=result.error.message;return}
    if(!result.data.user||!result.data.session){status.textContent='راجعي بريدك لتأكيد الحساب، ثم سجّلي الدخول.';return}
    user=result.data.user;identify();loadBase();gate.hidden=true;document.getElementById('signOutBtn').hidden=false;form.reset();await reconcile();notifyMemories();
  };
  window.addEventListener('yomi-pin-unlocked',showAccount);
  if(document.getElementById('lock').classList.contains('hidden'))showAccount();
  document.getElementById('offlineBtn').onclick=()=>{gate.hidden=true;paint('بيانات هذا الجهاز فقط · سجّلي الدخول لاحقًا للمزامنة')};
  syncBtn.onclick=()=>{if(!navigator.onLine){paint('بدون نت · محفوظ على هذا الجهاز');return}if(user)reconcile();else showAccount()};
  window.addEventListener('online',()=>{if(user)reconcile();else showAccount()});
  window.addEventListener('focus',()=>{if(user&&navigator.onLine)reconcile()});
  window.addEventListener('pageshow',()=>{if(user&&navigator.onLine)reconcile()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&user&&navigator.onLine)reconcile()});
  setInterval(()=>{if(document.visibilityState==='visible'&&user&&navigator.onLine)reconcile()},60000);
  document.getElementById('signOutBtn').onclick=async()=>{
    await client.auth.signOut();window.dispatchEvent(new Event('yomi-signed-out'));notifyMemories();
    user=null;identify();base=null;conflictSnapshot=null;if(conflictDialog.open)conflictDialog.close();localStorage.removeItem(baseKey);data=initial();saveLocal();render();
    gate.hidden=false;badge.hidden=true;document.getElementById('signOutBtn').hidden=true;
  };
}
