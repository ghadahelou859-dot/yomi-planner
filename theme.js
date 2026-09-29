(function () {
  const names = {
    autumn: 'الخريف الفوتوغرافي', autumnPhoto: 'الخريف الفوتوغرافي', autumnClassic: 'الخريف اليقطيني البسيط', winter: 'الشتاء الهادئ',
    christmas: 'أعياد الميلاد', ramadan: 'رمضان',
    spring: 'الربيع', summer: 'الصيف'
  };
  const modes = new Set(['auto', ...Object.keys(names)]);
  const picker = document.getElementById('themeSelect');
  const dialog = document.getElementById('themeDialog');

  function seasonal() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem', month: 'numeric', day: 'numeric'
    }).formatToParts(new Date());
    const month = Number(parts.find(x => x.type === 'month').value);
    const day = Number(parts.find(x => x.type === 'day').value);
    if (month === 12 && day >= 15 || month === 1 && day <= 6) return 'christmas';
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumnPhoto';
    return 'winter';
  }

  function apply() {
    const mode = modes.has(data.appearance?.mode) ? data.appearance.mode : 'auto';
    const active = mode === 'auto' ? seasonal() : mode === 'autumn' ? 'autumnPhoto' : mode === 'autumnClassic' ? 'autumn' : mode;
    document.body.dataset.theme = active;
    const leaf = document.querySelector('#entryScene .entry-leaf');
    if (leaf) leaf.textContent = {autumnPhoto:'🍂', autumn:'🍁', winter:'❄️', christmas:'🎄', ramadan:'🌙', spring:'🌸', summer:'☀️'}[active];
    picker.value = mode === 'autumnPhoto' ? 'autumn' : mode;
    document.getElementById('themeStatus').textContent =
      'المظهر الحالي: ' + names[active] + (mode === 'auto' ? ' · تغيّر تلقائيًا مع الموسم' : ' · اختيارك محفوظ على حسابك');
  }

  document.getElementById('themeBtn').onclick = () => { apply(); dialog.showModal(); };
  picker.onchange = () => {
    data.appearance = {mode: picker.value};
    save();
    document.body.classList.remove('theme-switching');
    void document.body.offsetWidth;
    document.body.classList.add('theme-switching');
    setTimeout(() => document.body.classList.remove('theme-switching'), 500);
    apply();
  };
  document.getElementById('themeClose').onclick = () => dialog.close();
  window.yomiThemeApply = apply;
  apply();
  // Refresh the automatic choice when a tab stays open across a season boundary.
  window.addEventListener('focus', apply);
})();
