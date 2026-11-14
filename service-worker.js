const CACHE_NAME = "lalapan-legenda-grab-share-20261115-green-highlights";
const SHARE_CACHE_NAME = "ll-shared-grab-images-v1";
const APP_FILES = ["./", "./index.html", "./manifest.json", "./icons/icon.jpeg"];
function sharedFileKey(id){return new Request(new URL("./__shared_grab_image__?id="+encodeURIComponent(id),self.registration.scope).href)}
self.addEventListener("install", event => {event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);for(const file of APP_FILES){try{await cache.add(file)}catch(e){console.warn("Cache gagal:",file,e)}}await self.skipWaiting()})())});
self.addEventListener("activate", event => {event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith("lalapan-legenda-")&&k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener("fetch", event => {
 const request=event.request,url=new URL(request.url),appRoot=new URL("./",self.registration.scope);
 if(request.method==="POST"&&url.origin===appRoot.origin&&url.pathname===appRoot.pathname&&url.searchParams.has("share-target")){
  event.respondWith((async()=>{
   try{
    const form=await request.formData(),file=form.getAll("files").find(item=>item instanceof File&&item.type.startsWith("image/"));
    if(!file)return Response.redirect(new URL("./?share-error=no-image",appRoot).href,303);
    const id=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10),cache=await caches.open(SHARE_CACHE_NAME);
    await cache.put(sharedFileKey(id),new Response(file,{headers:{"Content-Type":file.type||"image/jpeg","X-Shared-File-Name":encodeURIComponent(file.name||"grab-order.jpg")}}));
    return Response.redirect(new URL("./?shared="+encodeURIComponent(id),appRoot).href,303);
   }catch(error){console.error("Gagal menerima gambar dari menu Bagikan",error);return Response.redirect(new URL("./?share-error=failed",appRoot).href,303)}
  })());return;
 }
 if(request.method!=="GET"||url.origin!==self.location.origin)return;
 if(request.mode==="navigate"){event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put("./index.html",copy))}return response}).catch(async()=>await caches.match("./index.html")||Response.error()));return}
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy))}return response})))
});

self.addEventListener("notificationclick", event => {
 event.notification.close();
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const client of windows){if("focus" in client)return client.focus()}
  return self.clients.openWindow(new URL("./",self.registration.scope).href);
 })());
});
