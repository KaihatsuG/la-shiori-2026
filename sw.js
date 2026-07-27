/* LA2026 しおり — オフライン用サービスワーカー
   すべてを端末にキャッシュし、以後はネットワークなしで動かす。 */
var CACHE = "la2026-v1";
var ASSETS = [
  "./",
  "index.html",
  "payload.json",
  "manifest.webmanifest",
  
  
  "icon.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(ASSETS); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){
        return Promise.all(keys.map(function(k){
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

/* キャッシュ優先。オフラインでも必ず開けることを最優先する。 */
self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function(hit){
      if (hit) {
        /* 裏で静かに更新（オンライン時のみ成功する） */
        fetch(req).then(function(res){
          if (res && res.ok) caches.open(CACHE).then(function(c){ c.put(req, res.clone()); });
        }).catch(function(){});
        return hit;
      }
      return fetch(req)
        .then(function(res){
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function(c){ c.put(req, copy); });
          }
          return res;
        })
        .catch(function(){
          /* 未キャッシュのページ要求は入口に戻す */
          if (req.mode === "navigate") return caches.match("index.html");
          throw new Error("offline");
        });
    })
  );
});
