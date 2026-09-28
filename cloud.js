import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
const cfg = window.YOMI_SUPABASE_CONFIG;
const ready = cfg?.url?.startsWith('https://') && cfg?.publishableKey?.startsWith('sb_publishable_') && !cfg.url.includes('YOUR_');
if (ready) {
  const client = createClient(cfg.url, cfg.publishableKey);
  let user = null;
  let timer = null;
  let remoteUpdatedAt = null;
  const gate = document.getElementById('accountGate');
  const form = document.getElementById('accountForm');
  const status = document.getElementById('accountStatus');
  const badge = document.getElementById('cloudBadge');
  const nonempty = d => ['tasks','achievements','expenses','incomes','debts','reminders','notes','periods','restDays','dhikrs','waterEntries','readings','journal'].some(k => d[k]?.length) || !!d.waterGoal;
  const shape = d => ({...initial(), ...d});
  const paint = s => { badge.textContent = s; badge.hidden = false; };
  async function pull() {
    const { data: row, error } = await client.from('yomi_state').select('payload,updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!row) {
      if (nonempty(data)) {
        const upload = confirm('وجدت بيانات محفوظة على هذا الجهاز. هل تريدين نسخها إلى حسابك الآن؟');
        if (!upload) { data = initial(); saveLocal(); render(); return; }
      }
      await push(true);
    } else {
      const local = data;
      if (nonempty(local) && JSON.stringify(local) !== JSON.stringify(shape(row.payload))) {
        const useLocal = confirm('في بيانات مختلفة على هذا الجهاز. اضغطي موافق لرفع بيانات الجهاز واستبدال نسخة الحساب، أو إلغاء لاستخدام بيانات الحساب. صدّري نسخة احتياطية أولًا إذا لزم.');
        if (useLocal) { remoteUpdatedAt = row.updated_at; await push(true); return; }
      }
      data = shape(row.payload);
      remoteUpdatedAt = row.updated_at;
      saveLocal(); render(); paint('✓ محفوظ في الحساب');
    }
  }
  const saveLocal = () => localStorage.setItem(KEY, JSON.stringify(data));
  async function push(force=false) {
    if (!user) return;
    try {
      if (!force && remoteUpdatedAt) {
        const { data: current, error: checkError } = await client.from('yomi_state').select('updated_at').eq('user_id',user.id).maybeSingle();
        if (checkError) throw checkError;
        if (current?.updated_at !== remoteUpdatedAt) {
          paint('تغيّرت البيانات على جهاز آخر · أعيدي التحميل');
          alert('تم تعديل حسابك من جهاز آخر. صدّري نسخة من هذا الجهاز ثم أعيدي تحميل الصفحة قبل المتابعة.');
          return;
        }
      }
      const { data: saved, error } = await client.from('yomi_state').upsert({user_id:user.id,payload:data,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select('updated_at').single();
      if (error) throw error;
      remoteUpdatedAt=saved.updated_at;paint('✓ محفوظ في الحساب');
    } catch (e) { paint('تعذّر الحفظ السحابي · محفوظ على الجهاز'); console.error('Sync failed',e); }
  }
  function queue() { saveLocal(); if (user) {paint('جارٍ الحفظ…'); clearTimeout(timer); timer=setTimeout(()=>{timer=null;push()},700);} }
  save = queue;
  async function showAccount() {
    gate.hidden=false;
    status.textContent='سجّلي دخولك لتظهر بياناتك على الهاتف واللابتوب.';
    const { data: { user: found }, error }=await client.auth.getUser();
    if (error && error.name!=='AuthSessionMissingError') status.textContent='تعذّر التحقق من الحساب. تحققي من الاتصال.';
    if (found) { user=found; gate.hidden=true;document.getElementById('signOutBtn').hidden=false; await pull(); }
  }
  form.onsubmit=async event=>{
    event.preventDefault();
    const email=form.elements.email.value.trim();const password=form.elements.password.value;
    const action=event.submitter?.value||'login';
    status.textContent='جارٍ التحقق…';
    const result=action==='signup'?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):await client.auth.signInWithPassword({email,password});
    if(result.error){status.textContent=result.error.message;return;}
    if(!result.data.user || !result.data.session){status.textContent='راجعي بريدك لتأكيد الحساب، ثم سجّلي الدخول.';return;}
    user=result.data.user;gate.hidden=true;document.getElementById('signOutBtn').hidden=false;form.reset();await pull();
  };
  window.addEventListener('yomi-pin-unlocked',showAccount);if(document.getElementById('lock').classList.contains('hidden'))showAccount();
  document.getElementById('signOutBtn').onclick=async()=>{await client.auth.signOut();user=null;data=initial();saveLocal();render();gate.hidden=false;badge.hidden=true;document.getElementById('signOutBtn').hidden=true};
  window.addEventListener('focus',async()=>{if(!user || timer)return;const {data:row}=await client.from('yomi_state').select('payload,updated_at').eq('user_id',user.id).maybeSingle();if(row && row.updated_at!==remoteUpdatedAt){data=shape(row.payload);remoteUpdatedAt=row.updated_at;saveLocal();render();paint('✓ تم تحديث بياناتك')}});
}
