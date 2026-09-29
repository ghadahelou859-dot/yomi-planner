/* Memory metadata lives in the planner JSON. Photo blobs are kept in IndexedDB
   and, after sign-in, in a private per-user Supabase Storage folder. */
const memoryBucket = 'yomi-memories';
const memoryUrls = new Set();
const memoryTransfers = new Set();
const memoryDeleteQueueKey='yomi-memory-delete-queue-v1';
let memoryEditing = null;
function memoryDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('yomi-memory-photos-v1', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function memoryStore(key, value) {
  const db = await memoryDb();
  try { await new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').put(value, key);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  }); } finally { db.close(); }
}
async function memoryRead(key) {
  const db = await memoryDb();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readonly');
    const req = tx.objectStore('photos').get(key);
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  }); } finally { db.close(); }
}
async function memoryForget(key) {
  if (!key) return;
  const db = await memoryDb();
  try { await new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').delete(key);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  }); } finally { db.close(); }
}
async function memoryImage(file) {
  if (!file.type.startsWith('image/')) throw Error('اختاري ملف صورة.');
  if (file.size > 20 * 1024 * 1024) throw Error('الصورة كبيرة جدًا؛ اختاري صورة أقل من 20 ميغابايت.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw Error('ما قدرنا نقرأ الصورة. جرّبي JPG أو PNG.'); }
  const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .83));
  if (!blob || blob.size > 5 * 1024 * 1024) throw Error('تعذّر تجهيز الصورة؛ جرّبي صورة أصغر.');
  return blob;
}
function memories() {
  const rows = [...(data.memories || [])].sort((a,b) => (b.date + b.id).localeCompare(a.date + a.id));
  return `<div class="panel memory-intro"><h2>ذكرياتي 📷</h2><p class="sub">اللحظات اللي بتحبي ترجعي إلها، مع صورة ووصف صغير.</p>
    <form id="memoryForm"><div class="row"><label class="field">تاريخ الذكرى<input name="date" type="date" value="${selected}" required></label><label class="field">عنوان الذكرى<input name="title" maxlength="120" required placeholder="مثلاً: يوم جميل مع العائلة"></label></div>
    <label class="field">شو بتحبي تتذكّري؟<textarea name="body" rows="4" maxlength="5000" placeholder="اكتبي تفاصيل اللحظة…"></textarea></label>
    <label class="field">صور الذكرى (اختيارية)<input name="photo" type="file" accept="image/*" multiple></label><p class="sub">الصور تحفظ على جهازك أولًا، وتنتقل لحسابك عند توفر النت وتسجيل الدخول. يمكنك إضافة صور أخرى عند تعديل الذكرى.</p>
    <div class="row"><button class="primary" type="submit" id="memorySubmit">حفظ الذكرى</button><button class="soft hidden" type="button" id="memoryCancel">إلغاء التعديل</button></div><p id="memoryStatus" class="sub" role="status"></p></form></div>
    <div class="memory-grid">${rows.map(x => `<article class="panel memory-card"><div class="memory-gallery">${(x.photos||[]).length ? x.photos.map((photo,i)=>`<div class="memory-photo" data-memory-photo="${safe(x.id)}:${i}"><span>جارٍ عرض الصورة…</span><button class="memory-remove" type="button" data-memory-remove="${safe(x.id)}:${i}" aria-label="حذف هذه الصورة">×</button></div>`).join('') : '<div class="memory-photo"><span aria-hidden="true">🍂</span></div>'}</div><div class="memory-content"><small>${safe(x.date)}</small><h3>${safe(x.title)}</h3>${x.body ? `<p>${safe(x.body)}</p>` : ''}${(x.photos||[]).some(photo=>photo.local) ? '<small class="memory-pending">بعض الصور على هذا الجهاز · بانتظار المزامنة</small>' : ''}<div class="row"><button class="soft" data-memory-edit="${safe(x.id)}">تعديل</button><button class="soft" data-memory-delete="${safe(x.id)}">حذف</button></div></div></article>`).join('') || '<div class="panel empty">لسّه ما في ذكريات. ابدئي بأول لحظة بتحبي تحتفظي فيها 🌼</div>'}</div>`;
}
async function memoryPaint() {
  for (const url of memoryUrls) URL.revokeObjectURL(url);
  memoryUrls.clear();
  const session = window.yomiMemoriesSession?.();
  for (const box of document.querySelectorAll('[data-memory-photo]')) {
    const [memoryId,photoIndex]=box.dataset.memoryPhoto.split(':');
    const x = data.memories?.find(row => row.id === memoryId);
    const photo=x?.photos?.[Number(photoIndex)];
    if (!photo) continue;
    const key = photo.local || (session && `${session.user.id}:${photo.path}`);
    try {
      let blob = key ? await memoryRead(key) : null;
      if (!blob && photo.path && session && navigator.onLine && photo.path.startsWith(session.user.id + '/')) {
        const {data:download, error} = await session.client.storage.from(memoryBucket).download(photo.path);
        if (error) throw error;
        blob = download;
        await memoryStore(key, blob);
      }
      if (!box.isConnected) continue;
      if (blob) {
        const url = URL.createObjectURL(blob); memoryUrls.add(url);
        const img = document.createElement('img'); img.src=url; img.alt='صورة الذكرى: '+x.title; img.loading='lazy';
        box.replaceChildren(img);const remove=document.createElement('button');remove.type='button';remove.className='memory-remove';remove.dataset.memoryRemove=box.dataset.memoryPhoto;remove.setAttribute('aria-label','حذف هذه الصورة');remove.textContent='×';box.append(remove);
      } else box.textContent = 'الصورة تحتاج اتصالًا بالإنترنت لعرضها أول مرة';
    } catch (error) { if (box.isConnected) box.textContent='تعذّر عرض الصورة الآن'; console.error('Memory photo failed', error); }
  }
}
async function memoryUploadPending() {
  const session=window.yomiMemoriesSession?.();
  if (!session || !navigator.onLine) return;
  await memoryCleanup(session);
  for (const x of [...(data.memories || [])]) for (const photo of [...(x.photos||[])]) {
    if (!photo.local || memoryTransfers.has(photo.local)) continue;
    memoryTransfers.add(photo.local);
    try {
      const blob=await memoryRead(photo.local);
      if (!blob) continue;
      const path=`${session.user.id}/${x.id}-${crypto.randomUUID()}.jpg`;
      const {error}=await session.client.storage.from(memoryBucket).upload(path,blob,{contentType:'image/jpeg',upsert:false});
      if (error) throw error;
      const current=data.memories?.find(row=>row.id===x.id)?.photos?.find(item=>item.local===photo.local);
      if (!current) {await session.client.storage.from(memoryBucket).remove([path]);continue;}
      await memoryStore(`${session.user.id}:${path}`,blob);
      current.path=path;delete current.local;save();
      await memoryForget(photo.local);
      if (page==='memories') render();
    } catch(error) { console.error('Memory upload failed',error); }
    finally { memoryTransfers.delete(photo.local); }
  }
}
function memoryQueueDelete(path) {
  const paths=JSON.parse(localStorage.getItem(memoryDeleteQueueKey)||'[]');
  localStorage.setItem(memoryDeleteQueueKey,JSON.stringify([...new Set([...paths,path])]));
}
async function memoryCleanup(session) {
  const paths=JSON.parse(localStorage.getItem(memoryDeleteQueueKey)||'[]');
  for(const path of paths.filter(path=>path.startsWith(session.user.id+'/'))) {
    const {error}=await session.client.storage.from(memoryBucket).remove([path]);
    if(error){console.error('Memory cleanup failed',error);continue;}
    await memoryForget(`${session.user.id}:${path}`).catch(console.error);
    const latest=JSON.parse(localStorage.getItem(memoryDeleteQueueKey)||'[]');
    localStorage.setItem(memoryDeleteQueueKey,JSON.stringify(latest.filter(item=>item!==path)));
  }
}
const renderBeforeMemories=render;
render=function() {
  renderBeforeMemories();
  if (page!=='memories') return;
  memoryPaint();
  const form=$('#memoryForm'),status=$('#memoryStatus');
  form.onsubmit=async event=>{
    event.preventDefault();
    const submit=$('#memorySubmit'); submit.disabled=true; status.textContent='جارٍ حفظ الذكرى…';
    const added=[];
    try {
      const files=[...form.elements.photo.files];
      if(files.length>12) throw Error('اختاري حتى 12 صورة بكل مرة.');
      for (const file of files) {
        const blob=await memoryImage(file);
        const local='local:'+id();await memoryStore(local,blob);added.push({local});
      }
      const values=new FormData(form);
      const existing=memoryEditing && data.memories?.find(x=>x.id===memoryEditing);
      if (existing) {
        Object.assign(existing,{date:values.get('date'),title:values.get('title').trim(),body:values.get('body').trim()});
        existing.photos??=[];existing.photos.push(...added);
      } else {
        data.memories??=[];
        data.memories.push({id:id(),date:values.get('date'),title:values.get('title').trim(),body:values.get('body').trim(),photos:added});
      }
      memoryEditing=null;save();render();memoryUploadPending();
    } catch(error) { for(const photo of added) await memoryForget(photo.local).catch(()=>{}); status.textContent=error.message || 'تعذّر حفظ الصورة';submit.disabled=false; }
  };
  $('#memoryCancel').onclick=()=>{memoryEditing=null;render()};
  document.querySelectorAll('[data-memory-edit]').forEach(button=>button.onclick=()=>{
    const x=data.memories.find(row=>row.id===button.dataset.memoryEdit);if(!x)return;
    memoryEditing=x.id;form.elements.date.value=x.date;form.elements.title.value=x.title;
    form.elements.body.value=x.body||'';$('#memorySubmit').textContent='حفظ التعديل';$('#memoryCancel').classList.remove('hidden');
    status.textContent='أي صور جديدة ستُضاف إلى الصور الموجودة.';
    form.scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('#view').onclick=async event=>{
    const button=event.target.closest('[data-memory-remove]');if(!button)return;
    const [memoryId,index]=button.dataset.memoryRemove.split(':');
    const x=data.memories?.find(row=>row.id===memoryId);const photo=x?.photos?.[Number(index)];
    if(!photo || !confirm('حذف هذه الصورة من الذكرى؟'))return;
    x.photos.splice(Number(index),1);save();render();
    if(photo.local)await memoryForget(photo.local).catch(console.error);
    if(photo.path)memoryQueueDelete(photo.path);memoryUploadPending();
  };
  document.querySelectorAll('[data-memory-delete]').forEach(button=>button.onclick=async()=>{
    const x=data.memories.find(row=>row.id===button.dataset.memoryDelete);
    if (!x || !confirm('حذف هذه الذكرى وصورتها؟')) return;
    data.memories=data.memories.filter(row=>row.id!==x.id);save();render();
    for(const photo of x.photos||[]) {
      if(photo.local) await memoryForget(photo.local).catch(console.error);
      if(photo.path) memoryQueueDelete(photo.path);
    }
    memoryUploadPending();
  });
};
window.addEventListener('yomi-cloud-session',()=>{memoryUploadPending();if(page==='memories')render()});
window.addEventListener('online',()=>{memoryUploadPending();if(page==='memories')memoryPaint()});
render();
