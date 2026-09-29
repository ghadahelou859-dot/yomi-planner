(function () {
  const params = new URLSearchParams(location.search);
  if (params.get('preview') !== 'autumn-photo') return;
  document.body.dataset.autumnPreview = 'true';
  const banner = document.getElementById('autumnPreviewBanner');
  banner.hidden = false;
  document.getElementById('endAutumnPreview').onclick = () => {
    params.delete('preview');
    const next = location.pathname + (params.size ? '?' + params.toString() : '') + location.hash;
    history.replaceState(null, '', next);
    delete document.body.dataset.autumnPreview;
    banner.hidden = true;
  };
})();
