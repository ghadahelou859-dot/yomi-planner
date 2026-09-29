/* Memory metadata lives in the planner JSON. Photo blobs are kept in IndexedDB
   and, after sign-in, in a private per-user Supabase Storage folder. */
const memoryBucket = 'yomi-memories';
const memoryUrls = new Set();
const memoryTransfers = new Set();
const memoryDeleteQueueKey='yomi-memory-delete-queue-v1';
let memoryEditing = null;
let memoryDraft = {date:selected,title:'',body:'',position:'above',files:[]};
const memoryPreviewUrls = new Set();
function memoryClearPreviewUrls() {for(const url of memoryPreviewUrls)URL.revokeObjectURL(url);memoryPreviewUrls.clear();}
function memoryResetDraft() {memoryEditing=null;memoryDraft={date:selected,title:'',body:'',position:'above',files:[]};memoryClearPreviewUrls();}
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
  const source=URL.createObjectURL(file);
  let picture;
  try {
    picture=new Image();picture.src=source;
    await picture.decode();
  } catch {throw Error('ما قدرنا نقرأ الصورة. جرّبي JPG أو PNG.');}
  finally {URL.revokeObjectURL(source)}
  const ratio = Math.min(1, 1600 / Math.max(picture.naturalWidth, picture.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(picture.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(picture.naturalHeight * ratio));
  const context=canvas.getContext('2d');
  if(!context)throw Error('تعذّر تجهيز الصورة على هذا الجهاز.');
  context.drawImage(picture, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .83));
  if (!blob || blob.size > 5 * 1024 * 1024) throw Error('تعذّر تجهيز الصورة؛ جرّبي صورة أصغر.');
  return blob;
}
function memoryGallery(x) {
  return `<div class="memory-gallery">${(x.photos||[]).length ? x.photos.map((photo,i)=>`<div class="memory-photo" data-memory-photo="${safe(x.id)}:${i}"><span>جارٍ عرض الصورة…</span></div>`).join('') : '<div class="memory-photo"><span aria-hidden="true">🍂</span></div>'}</div>`;
}
function memories() {
  const rows = [...(data.memories || [])].sort((a,b) => (b.date + b.id).localeCompare(a.date + a.id));
  const preview=memoryDraft.files.length ? `<div class="memory-draft-gallery" id="memoryDraftGallery" aria-label="معاينة الصور المختارة">${memoryDraft.files.map((file,i)=>`<div class="memory-draft-photo"><img data-memory-preview="${i}" alt="معاينة الصورة ${i+1}"><div class="memory-photo-tools"><button type="button" data-memory-draft-move="${i}:-1" aria-label="تقديم الصورة">→</button><button type="button" data-memory-draft-move="${i}:1" aria-label="تأخير الصورة">←</button><button type="button" data-memory-draft-remove="${i}" aria-label="إزالة الصورة">×</button></div></div>`).join('')}</div>` : '';
  return `<div class="panel memory-intro"><h2>ذكرياتي 📷</h2><p class="sub">اختاري صورك وشوفيها هون قبل الحفظ. بتقدري تغيّري ترتيبها ومكانها.</p>
    <form id="memoryForm"><div class="row"><label class="field">تاريخ الذكرى<input name="date" type="date" value="${safe(memoryDraft.date)}" required></label><label class="field">عنوان الذكرى<input name="title" maxlength="120" value="${safe(memoryDraft.title)}" required placeholder="مثلاً: يوم جميل مع العائلة"></label></div>
    <label class="field">شو بتحبي تتذكّري؟<textarea name="body" rows="4" maxlength="5000" placeholder="اكتبي تفاصيل اللحظة…">${safe(memoryDraft.body)}</textarea></label>
    <div class="row memory-upload-row"><label class="soft memory-picker">＋ إضافة صور<input name="photo" type="file" accept="image/*" multiple class="memory-native-picker" aria-label="إضافة صور للذكرى"></label><span class="sub" id="memoryFileCount">${memoryDraft.files.length ? memoryDraft.files.length+' صور مختارة' : 'ما اخترتِ صور بعد'}</span></div>
    ${preview}<label class="field">مكان الصور في الذكرى<select name="position"><option value="above" ${memoryDraft.position==='above'?'selected':''}>فوق النص</option><option value="below" ${memoryDraft.position==='below'?'selected':''}>تحت النص</option></select></label>
    <div class="row"><button class="primary" type="submit" id="memorySubmit">${memoryEditing?'حفظ التعديل':'حفظ الذكرى'}</button><button class="soft ${memoryEditing?'':'hidden'}" type="button" id="memoryCancel">إلغاء التعديل</button></div><p id="memoryStatus" class="sub" role="status"></p></form></div>
    <div class="memory-grid">${rows.map(x => `<article class="panel memory-card">${x.position==='below'?'':memoryGallery(x)}<div class="memory-content"><small>${safe(x.date)}</small><h3>${safe(x.title)}</h3>${x.body ? `<p>${safe(x.body)}</p>` : ''}${(x.photos||[]).some(photo=>photo.local) ? '<small class="memory-pending">بعض الصور على هذا الجهاز · بانتظار المزامنة</small>' : ''}${x.position==='below'?memoryGallery(x):''}<div class="row"><button class="soft" data-memory-edit="${safe(x.id)}">تعديل</button><button class="soft" data-memory-delete="${safe(x.id)}">حذف</button></div></div></article>`).join('') || '<div class="panel empty">لسّه ما في ذكريات. ابدئي بأول لحظة بتحبي تحتفظي فيها 🌼</div>'}</div>`;
}
function memoryShowDraftPreviews() {
  memoryClearPreviewUrls();
  document.querySelectorAll('[data-memory-preview]').forEach(img=>{
    const file=memoryDraft.files[Number(img.dataset.memoryPreview)];
    if(!file)return;
    const url=URL.createObjectURL(file);memoryPreviewUrls.add(url);img.src=url;
  });
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
        box.replaceChildren(img);const tools=document.createElement('div');tools.className='memory-photo-tools';for(const [label,attribute,value] of [['→','memoryMove',box.dataset.memoryPhoto+':-1'],['←','memoryMove',box.dataset.memoryPhoto+':1'],['×','memoryRemove',box.dataset.memoryPhoto]]){const button=document.createElement('button');button.type='button';button.dataset[attribute]=value;button.textContent=label;button.setAttribute('aria-label',label==='×'?'حذف الصورة':'تغيير ترتيب الصورة');tools.append(button)}box.append(tools);
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
  memoryPaint();memoryShowDraftPreviews();
  const form=$('#memoryForm'),status=$('#memoryStatus');
  for(const name of ['date','title','body','position'])form.elements[name].oninput=event=>{memoryDraft[name]=event.target.value};
  form.elements.photo.onchange=()=>{
    const picked=[...form.elements.photo.files];
    if(memoryDraft.files.length+picked.length>12){status.textContent='اختاري حتى 12 صورة لكل ذكرى.';return}
    memoryDraft.files.push(...picked);
    // Keep typed text and selected File objects across account sync re-renders.
    render();
    $('#memoryStatus').textContent=`جاهزة للمعاينة: ${memoryDraft.files.length} صورة. اضغطي حفظ الذكرى بعد ما تخلصي.`;
  };
  document.querySelectorAll('[data-memory-draft-remove]').forEach(button=>button.onclick=()=>{memoryDraft.files.splice(Number(button.dataset.memoryDraftRemove),1);render()});
  document.querySelectorAll('[data-memory-draft-move]').forEach(button=>button.onclick=()=>{
    const [from,delta]=button.dataset.memoryDraftMove.split(':').map(Number),to=from+delta;
    if(to<0||to>=memoryDraft.files.length)return;
    [memoryDraft.files[from],memoryDraft.files[to]]=[memoryDraft.files[to],memoryDraft.files[from]];render();
  });
  form.onsubmit=async event=>{
    event.preventDefault();
    const submit=$('#memorySubmit');submit.disabled=true;status.textContent='جارٍ حفظ الذكرى…';
    const added=[];
    try {
      if(memoryDraft.files.length>12)throw Error('اختاري حتى 12 صورة لكل ذكرى.');
      for(const file of memoryDraft.files){
        const blob=await memoryImage(file);
        const local='local:'+id();await memoryStore(local,blob);added.push({local});
      }
      const existing=memoryEditing&&data.memories?.find(x=>x.id===memoryEditing);
      const fields={date:memoryDraft.date,title:memoryDraft.title.trim(),body:memoryDraft.body.trim(),position:memoryDraft.position};
      if(!fields.title)throw Error('اكتبي عنوان الذكرى.');
      if(existing){Object.assign(existing,fields);existing.photos??=[];existing.photos.push(...added)}
      else {data.memories??=[];data.memories.push({id:id(),...fields,photos:added})}
      memoryResetDraft();save();render();memoryUploadPending();
    } catch(error){for(const photo of added)await memoryForget(photo.local).catch(()=>{});if($('#memoryStatus')){$('#memoryStatus').textContent=error.message||'تعذّر حفظ الذكرى';$('#memorySubmit').disabled=false}}
  };
  $('#memoryCancel').onclick=()=>{memoryResetDraft();render()};
  document.querySelectorAll('[data-memory-edit]').forEach(button=>button.onclick=()=>{
    const x=data.memories.find(row=>row.id===button.dataset.memoryEdit);if(!x)return;
    memoryEditing=x.id;memoryDraft={date:x.date,title:x.title,body:x.body||'',position:x.position||'above',files:[]};render();
    $('#memoryForm').scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('#view').onclick=async event=>{
    const button=event.target.closest('[data-memory-remove],[data-memory-move]');if(!button)return;
    const value=button.dataset.memoryRemove||button.dataset.memoryMove;
    const [memoryId,indexText,deltaText]=value.split(':'),index=Number(indexText);
    const x=data.memories?.find(row=>row.id===memoryId),photo=x?.photos?.[index];if(!photo)return;
    if(button.dataset.memoryMove){const to=index+Number(deltaText);if(to<0||to>=x.photos.length)return;[x.photos[index],x.photos[to]]=[x.photos[to],x.photos[index]];save();render();return}
    if(!confirm('حذف هذه الصورة من الذكرى؟'))return;
    x.photos.splice(index,1);save();render();
    if(photo.local)await memoryForget(photo.local).catch(console.error);
    if(photo.path)memoryQueueDelete(photo.path);memoryUploadPending();
  };
  document.querySelectorAll('[data-memory-delete]').forEach(button=>button.onclick=async()=>{
    const x=data.memories.find(row=>row.id===button.dataset.memoryDelete);
    if(!x||!confirm('حذف هذه الذكرى وصورها؟'))return;
    data.memories=data.memories.filter(row=>row.id!==x.id);if(memoryEditing===x.id)memoryResetDraft();save();render();
    for(const photo of x.photos||[]){if(photo.local)await memoryForget(photo.local).catch(console.error);if(photo.path)memoryQueueDelete(photo.path)}
    memoryUploadPending();
  });
};
window.addEventListener('yomi-cloud-session',()=>{memoryUploadPending();if(page==='memories')render()});
window.addEventListener('online',()=>{memoryUploadPending();if(page==='memories')memoryPaint()});
render();
