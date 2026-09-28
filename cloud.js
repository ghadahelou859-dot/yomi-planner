import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
window.YOMI_CLOUD_READY = true;
const cfg = window.YOMI_SUPABASE_CONFIG;
const ready = cfg?.url?.startsWith('https://') && cfg?.publishableKey?.startsWith('sb_publishable_') && !cfg.url.includes('YOUR_');
if (ready) {
  const client = createClient(cfg.url, cfg.publishableKey);
  const gate = document.getElementById('accountGate');
  const form = document.getElementById('accountForm');
  const status = document.getElementById('accountStatus');
  const badge = document.getElementById('cloudBadge');
  const identity = document.getElementById('accountIdentity');
  const syncBtn = document.getElementById('syncBtn');
  syncBtn.hidden = false;
  const baseKey = 'yomi-sync-base-v2';
  let user = null, base = null, remoteUpdatedAt = null, timer = null, busy = false, conflictSnapshot = null;
  const conflictDialog = document.getElementById('conflictDialog');
  const shape = d => ({...initial(), ...(d || {})});
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const nonempty = d => ['tasks','achievements','expenses','incomes','debts','reminders','notes','periods','restDays','dhikrs','waterEntries','readings','journal','habits','routines','timerSessions','budgets','bills','projects','savings','careLogs','diary'].some(k => d[k]?.length) || !!d.waterGoal || !!d.quran?.lastPage || !!d.quran?.log?.length;
  const paint = s => {badge.hidden = false;badge.textContent = s};
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
  function backupPrompt(snapshot, details) {
    if(conflictDialog.open&&conflictSnapshot&&
       same(conflictSnapshot.local,snapshot.local)&&
       same(conflictSnapshot.remote,snapshot.remote))return;
    conflictSnapshot={...snapshot,details,localDownloaded:false,remoteDownloaded:false};
    paint('تعارض بين الجهازين · احفظي نسخة احتياطية');
    const sections={tasks:'مهامي',dhikrs:'أذكاري',quran:'وردي القرآني',readings:'القراءة',journal:'مراجعتي',diary:'مذكرتي',careLogs:'عنايتي',expenses:'مصاريفي',incomes:'دخلي',savings:'ادّخاري',waterEntries:'المي',projects:'مشاريع شغلي',routines:'روتيني',debts:'الديون',notes:'ملاحظاتي',reminders:'تذكيراتي'};
    const fields={title:'الاسم',body:'النص',amount:'المبلغ',paid:'المدفوع',lastPage:'آخر صفحة',done:'مكتمل',date:'التاريخ',status:'الحالة',count:'العدد',waterGoal:'هدف المي'};
    const showValue=v=>v===undefined?'محذوف':JSON.stringify(v)?.slice(0,180)??'فارغ';
    document.getElementById('conflictRows').innerHTML=details.map((entry,i)=>{
      const parts=entry.path.split('.'),collection=parts[1],localItems=Array.isArray(snapshot.local[collection])?snapshot.local[collection]:[],remoteItems=Array.isArray(snapshot.remote[collection])?snapshot.remote[collection]:[],record=[...localItems,...remoteItems].find(x=>x.id===parts[2]);
      const label=[sections[collection]||collection,record?.title||record?.date||'',fields[parts.at(-1)]||parts.at(-1)].filter(Boolean).join(' · ');
      return '<fieldset><legend>'+safe(label)+'</legend><label><input type="radio" name="choice'+i+'" value="local" required> هذا الجهاز: '+safe(showValue(entry.local))+'</label><label><input type="radio" name="choice'+i+'" value="remote" required> الحساب: '+safe(showValue(entry.remote))+'</label></fieldset>';
    }).join('');
    document.getElementById('conflictBackupStatus').textContent='حمّلي النسختين قبل اعتماد أي اختيار.';
    if(!conflictDialog.open)conflictDialog.showModal();
  }
  function downloadConflict(which){
    if(!conflictSnapshot)return;
    const snapshot=which==='local'?conflictSnapshot.local:conflictSnapshot.remote;
    const file=new Blob([JSON.stringify({app:'yomi',version:1,exportedAt:new Date().toISOString(),data:snapshot},null,2)],{type:'application/json'});
    const link=document.createElement('a');link.href=URL.createObjectURL(file);link.download='yomi-'+which+'-'+new Date().toISOString().slice(0,10)+'.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),5000);
    conflictSnapshot[which+'Downloaded']=true;
    document.getElementById('conflictBackupStatus').textContent=conflictSnapshot.localDownloaded&&conflictSnapshot.remoteDownloaded?'نُزّلت النسختان. اختاري قيمة لكل اختلاف.':'حمّلي النسخة الثانية أيضًا.';
  }
  document.getElementById('localConflictBackup').onclick=()=>downloadConflict('local');
  document.getElementById('cloudConflictBackup').onclick=()=>downloadConflict('remote');
  document.getElementById('closeConflict').onclick=()=>conflictDialog.close();
  document.getElementById('conflictForm').onsubmit=async event=>{
    event.preventDefault();
    const snapshot=conflictSnapshot;
    if(!snapshot||busy)return;
    if(!snapshot.localDownloaded||!snapshot.remoteDownloaded){alert('نزّلي نسخة هذا الجهاز ونسخة الحساب أولًا.');return}
    if(!navigator.onLine){paint('بدون نت · محفوظ على هذا الجهاز');return}
    if(!same(shape(data),snapshot.local)){conflictDialog.close();paint('تغيّرت بيانات هذا الجهاز · راجعي التعارض من جديد');return}
    const choices=Object.fromEntries(snapshot.details.map((entry,i)=>[entry.path,new FormData(event.currentTarget).get('choice'+i)]));
    if(Object.values(choices).some(x=>!x)){alert('اختاري قيمة لكل اختلاف.');return}
    busy=true;
    try{
      const {data:latest,error}=await client.from('yomi_state').select('payload,updated_at').eq('user_id',user.id).maybeSingle();
      if(error)throw error;
      if(!latest||latest.updated_at!==snapshot.updatedAt){conflictDialog.close();paint('تغيّرت نسخة الحساب · اضغطي مزامنة الآن للمراجعة');return}
      const merged=shape(window.yomiMerge(snapshot.baseline,snapshot.local,snapshot.remote,choices).value);
      const {data:saved,error:writeError}=await client.from('yomi_state').update({payload:merged,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('updated_at',snapshot.updatedAt).select('updated_at').maybeSingle();
      if(writeError)throw writeError;
      if(!saved){conflictDialog.close();paint('تغيّرت نسخة الحساب · اضغطي مزامنة الآن');return}
      if(!same(shape(data),snapshot.local)){setBase(merged,saved.updated_at);conflictDialog.close();paint('ظهرت تعديلات جديدة · اضغطي مزامنة الآن');return}
      data=merged;saveLocal();setBase(merged,saved.updated_at);conflictSnapshot=null;conflictDialog.close();render();paint('✓ محفوظ في الحساب');
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
        data=merged;saveLocal();setBase(merged,row.updated_at);render();paint('✓ محفوظ في الحساب');
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
      paint(changedDuringWrite?'جارٍ مزامنة تعديل أحدث…':'✓ محفوظ في الحساب');
    } catch(e) {paint('تعذّرت المزامنة · محفوظ على هذا الجهاز');console.error('Sync failed',e)}
    finally {busy=false;if(user && navigator.onLine && pending() && badge.textContent.includes('جارٍ')) schedule()}
  }
  function schedule() {clearTimeout(timer);timer=setTimeout(()=>{timer=null;reconcile()},900)}
  save = () => {saveLocal();paint(!navigator.onLine?'بدون نت · محفوظ على هذا الجهاز':user?'جارٍ المزامنة…':'محفوظ على هذا الجهاز · سجّلي الدخول للمزامنة');if(user&&navigator.onLine)schedule()};
  async function showAccount() {
    if(!navigator.onLine){gate.hidden=true;paint('بدون نت · محفوظ على هذا الجهاز');return}
    gate.hidden=false;
    status.textContent='سجّلي دخولك بنفس الحساب على الهاتف واللابتوب.';
    const {data:{user:found},error}=await client.auth.getUser();
    if(error && error.name!=='AuthSessionMissingError')status.textContent='تعذّر التحقق من الحساب. تحققي من الاتصال.';
    if(found){user=found;identify();loadBase();gate.hidden=true;document.getElementById('signOutBtn').hidden=false;await reconcile()}
  }
  form.onsubmit=async event=>{
    event.preventDefault();
    const email=form.elements.email.value.trim(),password=form.elements.password.value;
    status.textContent='جارٍ التحقق…';
    const action=event.submitter?.value||'login';
    const result=action==='signup'?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):await client.auth.signInWithPassword({email,password});
    if(result.error){status.textContent=result.error.message;return}
    if(!result.data.user||!result.data.session){status.textContent='راجعي بريدك لتأكيد الحساب، ثم سجّلي الدخول.';return}
    user=result.data.user;identify();loadBase();gate.hidden=true;document.getElementById('signOutBtn').hidden=false;form.reset();await reconcile();
  };
  window.addEventListener('yomi-pin-unlocked',showAccount);
  if(document.getElementById('lock').classList.contains('hidden'))showAccount();
  document.getElementById('offlineBtn').onclick=()=>{gate.hidden=true;paint('بيانات هذا الجهاز فقط · سجّلي الدخول لاحقًا للمزامنة')};
  syncBtn.onclick=()=>{if(!navigator.onLine){paint('بدون نت · محفوظ على هذا الجهاز');return}if(user)reconcile();else showAccount()};
  window.addEventListener('online',()=>{if(user)reconcile();else paint('رجع النت · أعيدي فتح الصفحة للمزامنة')});
  window.addEventListener('focus',()=>{if(user&&navigator.onLine)reconcile()});
  document.getElementById('signOutBtn').onclick=async()=>{
    await client.auth.signOut();window.dispatchEvent(new Event('yomi-signed-out'));
    user=null;identify();base=null;conflictSnapshot=null;if(conflictDialog.open)conflictDialog.close();localStorage.removeItem(baseKey);data=initial();saveLocal();render();
    gate.hidden=false;badge.hidden=true;document.getElementById('signOutBtn').hidden=true;
  };
}
