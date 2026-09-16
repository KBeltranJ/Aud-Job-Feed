const CACHE="audrey-job-feed-v5";
const ASSETS=["./","./index.html","./styles.css","./cloud-sync.css","./app.js","./career-defaults.js","./cloud-sync.js","./refresh-recommendations.js","./supabase-config.js","./manifest.webmanifest","./jobs.json","./applied-index.json","./icon.svg"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(url.pathname.endsWith("/jobs.json")||url.pathname.endsWith("/applied-index.json")){
    event.respondWith(fetch(event.request,{cache:"no-store"}).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }).catch(()=>caches.match(event.request)));
    return;
  }
  if(url.origin!==self.location.origin){
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request)));
});
