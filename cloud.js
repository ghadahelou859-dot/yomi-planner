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
  let user = null, base = null, remoteUpdatedAt = null, timer = null, busy = false;
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
  function backupPrompt() {
    paint('تعارض بين الجهازين · احفظي نسخة احتياطية');
    alert('في تعديلين متعارضين على نفس السجل. بيانات هذا الجهاز محفوظة، ولم نستبدل نسخة الحساب. صدّري نسخة احتياطية من الجهازين قبل حل التعارض.');
  }
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
        if(result.conflicts.length){backupPrompt();return}
        merged=shape(result.value);
      } else if(!row) {
        merged=local;
      } else if(same(local,remote) || !nonempty(local)) {
        merged=remote;
      } else {
        const result=window.yomiMerge(shape(initial()),local,remote);
        if(result.conflicts.length){backupPrompt();return}
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
    user=null;identify();base=null;localStorage.removeItem(baseKey);data=initial();saveLocal();render();
    gate.hidden=false;badge.hidden=true;document.getElementById('signOutBtn').hidden=true;
  };
}
