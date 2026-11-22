(() => {
  try {
    const theme = JSON.parse(localStorage.getItem('rv:theme'));
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    const lang = JSON.parse(localStorage.getItem('rv:lang'));
    if (lang === 'pl' || lang === 'en') document.documentElement.lang = lang;
  } catch {}
})();
