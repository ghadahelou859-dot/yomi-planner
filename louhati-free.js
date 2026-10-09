/* Louhati free-layout interactions — keeps task data and theme intact */
(() => {
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const taskById=id=>(data.tasks||[]).find(x=>x.id===id);
  const reminderFor=id=>(data.reminders||[]).find(x=>x.taskId===id);
  const ensureBoard=()=>{data.boardSettings??={};data.boardSettings.snap??=true;data.boardSettings.gridSize??=20;data.boardSettings.previousLayout??=null};
  const snap=n=>{ensureBoard();const g=Math.max(5,Number(data.boardSettings.gridSize)||20);return data.boardSettings.snap?Math.round(n/g)*g:n};
  const defaultLayout=(task,index=0)=>({x:20+(index%3)*300,y:20+Math.floor(index/3)*290,w:task?.imageMedia?280:250,h:task?.imageMedia?260:185,z:index+1,rotation:0,pinned:false});
  const layoutFor=(task,index=0)=>{
    task.boardLayout??={};
    const d=defaultLayout(task,index),l=task.boardLayout;
    return {
      x:Number.isFinite(Number(l.x))?Number(l.x):d.x,
      y:Number.isFinite(Number(l.y))?Number(l.y):d.y,
      w:clamp(Number(l.w)||d.w,180,620),
      h:clamp(Number(l.h)||d.h,120,620),
      z:Number(l.z)||d.z,
      rotation:clamp(Number(l.rotation)||0,-3,3),
      pinned:!!l.pinned,
      shape:['rounded','square','soft','pill'].includes(l.shape)?l.shape:'rounded'
    };
  };
  const persistLayout=(task,patch)=>{task.boardLayout={...task.boardLayout,...patch};save()};

  function updateCanvasHeight(board){
    const cards=[...board.querySelectorAll('.board-free-card')];
    const bottom=cards.reduce((m,c)=>Math.max(m,c.offsetTop+c.offsetHeight),0);
    board.style.height=Math.max(540,bottom+50)+'px';
  }

  function addToolbarControls(){
    const toolbar=document.querySelector('.board-toolbar');
    if(!toolbar)return;
    const row=toolbar.querySelector('.row');if(!row||row.querySelector('[data-free-board-snap]'))return;
    ensureBoard();
    const snapBtn=document.createElement('button');snapBtn.type='button';snapBtn.className='soft';snapBtn.dataset.freeBoardSnap='1';snapBtn.textContent='🧲 '+(data.boardSettings.snap?'Snap':'حر');
    snapBtn.onclick=()=>{data.boardSettings.snap=!data.boardSettings.snap;save();decorateBoard()};
    const arrange=document.createElement('button');arrange.type='button';arrange.className='soft';arrange.dataset.freeBoardArrange='1';arrange.textContent='↻ ترتيب تلقائي';
    arrange.onclick=()=>autoArrange();
    const undo=document.createElement('button');undo.type='button';undo.className='soft';undo.dataset.freeBoardUndo='1';undo.textContent='↶ رجوع';undo.disabled=!data.boardSettings.previousLayout;
    undo.onclick=()=>undoArrange();
    row.append(snapBtn,arrange,undo);
  }

  function autoArrange(){
    const board=document.querySelector('.board-masonry.board-free-layout');if(!board)return;
    ensureBoard();
    data.boardSettings.previousLayout=Object.fromEntries((data.tasks||[]).map(t=>[t.id,{...(t.boardLayout||{})}]));
    const cards=[...board.querySelectorAll('.board-free-card')];
    cards.forEach((card,i)=>{
      const task=taskById(card.dataset.boardTask);if(!task)return;
      const d=defaultLayout(task,i);
      task.boardLayout={...task.boardLayout,x:d.x,y:d.y,w:d.w,h:d.h,z:i+1,rotation:0};
    });
    save();decorateBoard(true);
  }

  function undoArrange(){
    ensureBoard();
    const prev=data.boardSettings.previousLayout;if(!prev)return;
    (data.tasks||[]).forEach(t=>{if(prev[t.id])t.boardLayout={...prev[t.id]}});
    data.boardSettings.previousLayout=null;
    save();decorateBoard(true);
  }

  const shapeLabel=s=>({rounded:'▢',square:'□',soft:'▣',pill:'⬭'})[s]||'▢';
  const nextShape=s=>({rounded:'square',square:'soft',soft:'pill',pill:'rounded'})[s]||'rounded';
  const applyShape=(card,shape)=>{
    card.dataset.boardShape=shape;
    card.style.borderRadius=shape==='square'?'0':shape==='soft'?'10px':shape==='pill'?'32px':'20px';
  };

  function addCardTools(card,task){
    if(card.querySelector('.board-card-tools'))return;
    const l=layoutFor(task);
    const tools=document.createElement('div');tools.className='board-card-tools';
    const mk=(label,title,attr)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.title=title;b.setAttribute(attr,task.id);return b};
    tools.append(
      mk('✎','تعديل المهمة','data-free-board-edit'),
      mk(l.pinned?'📌':'📍','تثبيت البطاقة','data-free-board-pin'),
      mk('⬆','إحضار للأمام','data-free-board-front'),
      mk('⬇','إرسال للخلف','data-free-board-back'),
      mk(shapeLabel(l.shape),'تغيير شكل البطاقة','data-free-board-shape')
    );
    const resize=document.createElement('span');resize.className='board-resize-handle';resize.setAttribute('data-free-board-resize',task.id);resize.setAttribute('aria-label','تغيير حجم البطاقة');
    card.append(tools,resize);

    tools.querySelector('[data-free-board-edit]').onclick=e=>{
      e.preventDefault();e.stopPropagation();window.YOMI_BOARD_EDIT_TASK_ID=task.id;
      if(typeof card.onclick==='function')card.onclick({target:card,currentTarget:card,preventDefault(){},stopPropagation(){}});
      else card.click();
    };
    tools.querySelector('[data-free-board-pin]').onclick=e=>{
      e.preventDefault();e.stopPropagation();task.boardLayout??={};task.boardLayout.pinned=!task.boardLayout.pinned;
      e.currentTarget.textContent=task.boardLayout.pinned?'📌':'📍';card.dataset.boardPinned=task.boardLayout.pinned?'1':'0';save();
    };
    tools.querySelector('[data-free-board-front]').onclick=e=>{
      e.preventDefault();e.stopPropagation();const max=Math.max(1,...(data.tasks||[]).map(x=>Number(x.boardLayout?.z)||1));persistLayout(task,{z:max+1});decorateBoard(true);
    };
    tools.querySelector('[data-free-board-back]').onclick=e=>{
      e.preventDefault();e.stopPropagation();const min=Math.min(1,...(data.tasks||[]).map(x=>Number(x.boardLayout?.z)||1));persistLayout(task,{z:min-1});decorateBoard(true);
    };
    tools.querySelector('[data-free-board-shape]').onclick=e=>{
      e.preventDefault();e.stopPropagation();
      const shape=nextShape(layoutFor(task).shape);
      persistLayout(task,{shape});applyShape(card,shape);e.currentTarget.textContent=shapeLabel(shape);
    };

    resize.addEventListener('pointerdown',e=>{
      e.preventDefault();e.stopPropagation();if(task.boardLayout?.pinned)return;
      const sx=e.clientX,sy=e.clientY,sw=card.offsetWidth,sh=card.offsetHeight;
      resize.setPointerCapture?.(e.pointerId);card.classList.add('board-resizing');
      const move=ev=>{card.style.width=clamp(snap(sw+ev.clientX-sx),180,620)+'px';card.style.height=clamp(snap(sh+ev.clientY-sy),120,620)+'px';updateCanvasHeight(card.parentElement)};
      const up=()=>{resize.removeEventListener('pointermove',move);resize.removeEventListener('pointerup',up);resize.removeEventListener('pointercancel',up);card.classList.remove('board-resizing');persistLayout(task,{w:card.offsetWidth,h:card.offsetHeight});updateCanvasHeight(card.parentElement)};
      resize.addEventListener('pointermove',move);resize.addEventListener('pointerup',up);resize.addEventListener('pointercancel',up);
    });
  }

  function makeFreeCard(card,index){
    const task=taskById(card.dataset.boardTask);if(!task)return;
    const l=layoutFor(task,index);
    card.classList.add('board-free-card');
    Object.assign(card.style,{left:l.x+'px',top:l.y+'px',width:l.w+'px',height:l.h+'px',zIndex:String(l.z)});
    card.style.setProperty('--board-rotation',l.rotation+'deg');
    card.dataset.boardPinned=l.pinned?'1':'0';
    applyShape(card,l.shape);
    if(!card.dataset.freeBoardCapture){
      card.dataset.freeBoardCapture='1';
      card.addEventListener('click',e=>{
        window.YOMI_BOARD_EDIT_TASK_ID=task.id;
        if(card.dataset.boardMoved==='1'){e.preventDefault();e.stopImmediatePropagation();delete card.dataset.boardMoved}
      },true);
      card.addEventListener('pointerdown',e=>{
        if(e.target.closest('button,input,select,label,.board-resize-handle')||task.boardLayout?.pinned)return;
        e.preventDefault();const sx=e.clientX,sy=e.clientY,startX=card.offsetLeft,startY=card.offsetTop;let moved=false;
        card.setPointerCapture?.(e.pointerId);card.classList.add('board-dragging');
        const move=ev=>{const dx=ev.clientX-sx,dy=ev.clientY-sy;if(Math.abs(dx)+Math.abs(dy)>5)moved=true;card.style.left=Math.max(0,snap(startX+dx))+'px';card.style.top=Math.max(0,snap(startY+dy))+'px';updateCanvasHeight(card.parentElement)};
        const up=()=>{card.removeEventListener('pointermove',move);card.removeEventListener('pointerup',up);card.removeEventListener('pointercancel',up);card.classList.remove('board-dragging');if(moved){card.dataset.boardMoved='1';persistLayout(task,{x:parseFloat(card.style.left)||0,y:parseFloat(card.style.top)||0});setTimeout(()=>delete card.dataset.boardMoved,180)}};
        card.addEventListener('pointermove',move);card.addEventListener('pointerup',up);card.addEventListener('pointercancel',up);
      });
    }
    addCardTools(card,task);
  }

  function decorateCustomizer(){
    const form=document.getElementById('boardStyleForm');if(!form)return;
    const task=taskById(form.elements.taskId?.value);if(!task)return;
    const l=layoutFor(task);
    let box=form.querySelector('.board-free-dimensions');
    if(!box){
      box=document.createElement('div');box.className='board-free-dimensions board-style-grid';
      box.innerHTML='<label class="field">العرض المخصص px<input name="freeWidth" type="number" min="180" max="620"></label><label class="field">الارتفاع المخصص px<input name="freeHeight" type="number" min="120" max="620"></label><label class="field">شكل البطاقة<select name="freeShape"><option value="rounded">دائري ناعم</option><option value="soft">زوايا خفيفة</option><option value="square">مربع</option><option value="pill">كبسولة</option></select></label><label class="field">الدوران الخفيف<input name="freeRotation" type="range" min="-3" max="3" step="1"></label><label class="field"><span>تثبيت مكان البطاقة</span><input name="freePinned" type="checkbox"></label>';
      const styleGrid=form.querySelector('.board-style-grid');styleGrid?.insertAdjacentElement('afterend',box);
    }
    box.querySelector('[name="freeWidth"]').value=Math.round(l.w);
    box.querySelector('[name="freeHeight"]').value=Math.round(l.h);
    box.querySelector('[name="freeRotation"]').value=l.rotation;
    box.querySelector('[name="freeShape"]').value=l.shape;
    box.querySelector('[name="freePinned"]').checked=l.pinned;
    if(!form.dataset.freeBoardBound){
      form.dataset.freeBoardBound='1';
      form.addEventListener('submit',()=>{
        const t=taskById(form.elements.taskId?.value);if(!t)return;
        t.boardLayout??={};
        t.boardLayout.w=clamp(Number(form.elements.freeWidth?.value)||layoutFor(t).w,180,620);
        t.boardLayout.h=clamp(Number(form.elements.freeHeight?.value)||layoutFor(t).h,120,620);
        t.boardLayout.rotation=clamp(Number(form.elements.freeRotation?.value)||0,-3,3);
        t.boardLayout.pinned=!!form.elements.freePinned?.checked;
      },true);
    }
  }

  function decorateDialog(){
    const dialog=document.getElementById('boardTaskDialog');if(!dialog||dialog.dataset.freeBoardEdit)return;
    const task=taskById(window.YOMI_BOARD_EDIT_TASK_ID);if(!task)return;
    dialog.dataset.freeBoardEdit='1';
    const actions=dialog.querySelector('.row:last-child');if(!actions)return;
    const btn=document.createElement('button');btn.type='button';btn.className='primary';btn.textContent='✎ تعديل المهمة';
    actions.prepend(btn);
    const form=document.createElement('form');form.className='board-inline-edit';form.hidden=true;
    const rem=reminderFor(task.id);
    form.innerHTML='<label class="field">اسم المهمة<input name="title" required></label><div class="row"><label class="field">النوع<select name="kind"><option value="personal">شخصي</option><option value="work">شغل</option><option value="education">تعليمي</option></select></label><label class="field">التكرار<select name="repeat"><option value="once">مرة واحدة</option><option value="daily">يومي</option></select></label></div><div class="row"><label class="field">تبدأ يوم<input name="start" type="date" required></label><label class="field">تنتهي يوم<input name="end" type="date"></label><label class="field">وقت التذكير<input name="remindTime" type="time"></label></div><label class="field">تغيير الصورة (اختياري)<input name="image" type="file" accept="image/png,image/jpeg,image/webp,.jpg,.jpeg,.png,.webp"></label><label class="field"><span>مهمة صلاة؟</span><input name="prayer" type="checkbox"></label><p class="sub" data-free-edit-status></p><div class="row"><button class="primary">حفظ التعديل</button><button type="button" class="soft" data-free-edit-cancel>إلغاء</button></div>';
    form.elements.title.value=task.title||'';form.elements.kind.value=task.kind||'personal';form.elements.repeat.value=task.repeat||'once';form.elements.start.value=task.date||'';form.elements.end.value=task.end||'';form.elements.remindTime.value=rem?.time||'';form.elements.prayer.checked=!!task.prayer;
    actions.insertAdjacentElement('beforebegin',form);
    btn.onclick=()=>{form.hidden=false;btn.hidden=true;form.elements.title.focus()};
    form.querySelector('[data-free-edit-cancel]').onclick=()=>{form.hidden=true;btn.hidden=false};
    const image=form.elements.image;image.addEventListener('click',()=>{window.yomiFilePickerActive=true});image.addEventListener('change',()=>{window.yomiFilePickerActive=false});
    form.onsubmit=async e=>{
      e.preventDefault();const fd=new FormData(form),start=String(fd.get('start')||''),end=String(fd.get('end')||''),status=form.querySelector('[data-free-edit-status]');
      if(end&&end<start){status.textContent='تاريخ النهاية لازم يكون بعد البداية';return}
      const submit=form.querySelector('button[type="submit"]');submit.disabled=true;status.textContent='جارٍ حفظ التعديل…';
      try{
        task.title=String(fd.get('title')||'').trim();task.kind=String(fd.get('kind')||'personal');task.repeat=String(fd.get('repeat')||'once');task.date=start;task.end=end;task.prayer=fd.has('prayer');
        const file=image.files?.[0];if(file){if(!window.yomiMediaSaveImage)throw Error('media');task.imageMedia=await window.yomiMediaSaveImage(file,{max:1400,q:.8})}
        const remind=String(fd.get('remindTime')||'');let r=reminderFor(task.id);
        if(remind){if(r){r.title='موعد المهمة: '+task.title;r.date=start;r.time=remind}else data.reminders.push({id:id(),title:'موعد المهمة: '+task.title,date:start,time:remind,done:false,taskId:task.id})}
        else data.reminders=data.reminders.filter(x=>x.taskId!==task.id);
        save();if(window.yomiMediaSyncNow)Promise.resolve(window.yomiMediaSyncNow()).catch(console.error);
        const close=dialog.querySelector('[data-board-detail-close]');close?.click();
      }catch(err){console.error(err);status.textContent='تعذّر حفظ التعديل';submit.disabled=false}
    };
  }

  function decorateBoard(force=false){
    if(typeof page==='undefined'||page!=='board')return;
    addToolbarControls();decorateCustomizer();decorateDialog();
    const daily=document.querySelector('[data-board-view="daily"].primary');
    const masonry=document.querySelector('.board-masonry');
    document.querySelectorAll('[data-board-task]').forEach(card=>{
      if(!card.dataset.freeTaskCapture){card.dataset.freeTaskCapture='1';card.addEventListener('click',()=>{window.YOMI_BOARD_EDIT_TASK_ID=card.dataset.boardTask},true)}
    });
    if(!daily||!masonry)return;
    masonry.classList.add('board-free-layout');masonry.style.columns='auto';masonry.style.position='relative';
    [...masonry.querySelectorAll(':scope > .board-card')].forEach((card,i)=>makeFreeCard(card,i));
    updateCanvasHeight(masonry);
    const snapBtn=document.querySelector('[data-free-board-snap]');if(snapBtn)snapBtn.textContent='🧲 '+(data.boardSettings.snap?'Snap':'حر');
    const undoBtn=document.querySelector('[data-free-board-undo]');if(undoBtn)undoBtn.disabled=!data.boardSettings.previousLayout;
  }

  let queued=false;
  const view=document.getElementById('view');
  const observer=new MutationObserver(queue);
  function queue(){
    if(queued)return;
    queued=true;
    setTimeout(()=>{
      observer.disconnect();
      try{decorateBoard()}finally{queued=false;observer.observe(view,{childList:true,subtree:true})}
    },40);
  }
  observer.observe(view,{childList:true,subtree:true});
  window.addEventListener('yomi-pin-unlocked',queue);
  queue();
})();