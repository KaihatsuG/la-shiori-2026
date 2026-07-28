/* LA2026 しおり — オフライン用サービスワーカー
   方針：オンラインなら必ず最新を取りに行き、失敗したらキャッシュを返す。
   （以前は「キャッシュ優先」だったため、更新しても古い版が表示され続けていた） */
var VERSION = "20260728-1131";
var CACHE   = "la2026-" + VERSION;
var ASSETS  = ["./", "index.html", "payload.json", "manifest.webmanifest", "icon.png"];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){
        /* 確実に取り直すため、キャッシュを迂回して取得する */
        return Promise.all(ASSETS.map(function(u){
          return fetch(new Request(u, { cache: "reload" }))
            .then(function(r){ if (r && r.ok) return c.put(u, r); })
            .catch(function(){});
        }));
      })
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

/* ネットワーク優先。つながらないときだけキャッシュを使う。 */
self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(function(res){
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      })
      .catch(function(){
        return caches.match(req, { ignoreSearch: true }).then(function(hit){
          if (hit) return hit;
          if (req.mode === "navigate") return caches.match("index.html");
          throw new Error("offline");
        });
      })
  );
});

/* ページから版番号を問い合わせられるようにする */
self.addEventListener("message", function(e){
  if (e.data === "version" && e.source) e.source.postMessage({ version: VERSION });
});
