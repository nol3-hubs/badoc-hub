(function(){
  function applyLabel(theme){
    var btn = document.getElementById('themeToggleBtn');
    var mobileBtn = document.getElementById('mobileThemeToggle');
    var txt = document.querySelector('.theme-switch-text');
    var isDark = theme === 'dark';
    if(btn) btn.setAttribute('aria-checked', isDark ? 'true' : 'false');
    if(txt) txt.textContent = isDark ? 'Dark Mode' : 'Light Mode';
    if(mobileBtn){
      mobileBtn.setAttribute('aria-checked', isDark ? 'true' : 'false');
      mobileBtn.querySelector('.mobile-theme-icon').textContent = isDark ? '☾' : '☀';
      mobileBtn.querySelector('.mobile-theme-label').textContent = isDark ? 'Dark' : 'Light';
    }
  }
  document.addEventListener('DOMContentLoaded', function(){
    applyLabel(document.documentElement.getAttribute('data-theme') || 'light');
    var btn = document.getElementById('themeToggleBtn');
    if(!btn) return;
    function toggleTheme(){
      var root = document.documentElement;
      var current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('badochub-theme', next); } catch(e) {}
      applyLabel(next);
    }
    btn.addEventListener('click', toggleTheme);
    var mobileBtn = document.getElementById('mobileThemeToggle');
    if(mobileBtn) mobileBtn.addEventListener('click', toggleTheme);
  });
})();
