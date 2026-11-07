(() => {
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return;

  window.va =
    window.va ||
    function () {
      (window.vaq = window.vaq || []).push(arguments);
    };

  window.va('beforeSend', (event) => {
    const url = new URL(event.url, window.location.origin);
    url.search = '';
    url.hash = '';
    return { ...event, url: url.toString() };
  });

  const analytics = document.createElement('script');
  analytics.defer = true;
  analytics.src = '/_vercel/insights/script.js';
  document.head.append(analytics);
})();
