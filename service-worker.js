self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open("pwa-cache-v1").then(function (cache) {
      return cache.addAll([
        "./index.html",
        "./css/public.css",
        "./lib/layui-v2.6.3/css/layui.css",
        "./js/lay-config.js",
        "./images/logo.png",
        "./images/favicon.ico",
      ]);
    })
  );
});

self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (response) {
      return response || fetch(event.request);
    })
  );
});
