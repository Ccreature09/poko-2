if(!self.define){let e,s={};const t=(t,n)=>(t=new URL(t+".js",n).href,s[t]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=t,e.onload=s,document.head.appendChild(e)}else e=t,importScripts(t),s()})).then((()=>{let e=s[t];if(!e)throw new Error(`Module ${t} didn’t register its module`);return e})));self.define=(n,i)=>{const a=e||("document"in self?document.currentScript.src:"")||location.href;if(s[a])return;let c={};const u=e=>t(e,a),r={module:{uri:a},exports:c,require:u};s[a]=Promise.all(n.map((e=>r[e]||u(e)))).then((e=>(i(...e),c)))}}define(["./workbox-4754cb34"],(function(e){"use strict";importScripts(),self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"/_next/app-build-manifest.json",revision:"25e41942d4331dddbc6f6e0a47a3a499"},{url:"/_next/static/B2lTkbtR6eZWuT7F2z7AU/_buildManifest.js",revision:"f8a108205d5f2d724a56a2390e463833"},{url:"/_next/static/B2lTkbtR6eZWuT7F2z7AU/_ssgManifest.js",revision:"b6652df95db52feb4daf4eca35380933"},{url:"/_next/static/chunks/1046-17738565c08fae98.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/1795-e7d731778357212f.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/1868-14b53f3d17bdb8ec.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/2170a4aa-4a9383fecaf2c543.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/3879-99b2ceb6a35323ca.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/4076-7f4847e71cc43d3c.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/4191-bba1e9773396e739.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/4379-6bc96a11a522847f.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/4597-7bdf5104e43b4f72.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/4845-7b4ec63dab344f6c.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/4bd1b696-2b99ff47588ed1aa.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/5311-1cfe5a4fbf0b08c9.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/5363-bb486312cecf3b7c.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/5655-66c3181a3e729f4d.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/6208-7a0b7c82f30702f5.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/6587-753af37186fc0e64.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/7023-f57ba6c35c413744.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/7119-280884929d61dfef.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/7428-7ac7729fe63c76f4.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/7789-7d55a636e52bb239.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/8027-604a2ac0e7bc0273.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/8091-11dc8766054973ea.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/8750-080cf7df1d929578.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/8936-9868243a6d6728ce.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/8999ae8c-d86c9ef223226e26.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/9344-46f5d2d179eb1e4e.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/9468.0787f1cc8c7b7cd0.js",revision:"0787f1cc8c7b7cd0"},{url:"/_next/static/chunks/9761.eda99bc69085522b.js",revision:"eda99bc69085522b"},{url:"/_next/static/chunks/app/_not-found/page-b2b607d99aadbc92.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/about/page-95418b9c837adc4b.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/add-grades/page-09dddd95b585751b.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/assignments/%5BassignmentId%5D/page-444e030d1829d17c.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/assignments/page-7e66d611899a7475.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/contact/page-b6f31695716024d8.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/courses/%5BcourseId%5D/edit/page-a5c13ee67fb8f85a.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/courses/%5BcourseId%5D/page-806f1346671ce145.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/courses/page-083d2603c75b9710.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/create-assignment/page-dcd1f323589a347b.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/create-course/page-bb53dcf7fd2c1719.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/create-quiz/page-27a330e40d592487.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/create-school/page-07d33cbaf97b62ac.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/create-timetable/page-ef450ee9a9d80236.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/dashboard/%5BschoolId%5D/page-4cdd8fe93271dc33.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/edit-assignment/%5BassignmentId%5D/page-57f30e57654deae9.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/faq/page-1c69553393e5227b.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/layout-0a1f0543dbf85665.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/login/page-6c8074cbc5dcc788.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/manage-subjects/page-0b1f043cb3c97336.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/messages/page-04b0c6ea2af7925e.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/offline/page-5e5bd5d30fade814.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/page-824bf00e3e0de697.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/privacy/page-0e12fd6b04d4ff23.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/profile/page-39d578b2dea6c0e7.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/quiz-reviews/%5BquizId%5D/monitor/page-d62fc945f1d53d7e.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/quiz-reviews/%5BquizId%5D/student/%5BstudentId%5D/page-22a74c8907398b42.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/quiz-reviews/page-8022752a363f6221.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/quizzes/%5BquizId%5D/edit/page-db39afadc7cb34bc.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/quizzes/%5BquizId%5D/page-a1ba239a8b38c243.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/quizzes/page-c6377e6b283feac9.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/report-card/page-33f5c011bab4b8b7.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/statistics/page-fae0f6561dd6b47f.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/support/page-ba299c4fae057144.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/terms/page-887c5c4b3ac10fc1.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/app/timetable/page-3f21edc300418772.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/bc9e92e6-5a4590e21b41cf13.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/framework-c054b661e612b06c.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/main-7ab9bb26678d987d.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/main-app-1484fe788b2274bf.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/pages/_app-4472d05d360df47c.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/pages/_error-8f5c1d50aa91bf6e.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/chunks/polyfills-42372ed130431b0a.js",revision:"846118c33b2c0e922d7b3a7676f81f6f"},{url:"/_next/static/chunks/webpack-0399a713d95dcabe.js",revision:"B2lTkbtR6eZWuT7F2z7AU"},{url:"/_next/static/css/8d44c5ee8b4a94a8.css",revision:"8d44c5ee8b4a94a8"},{url:"/_next/static/media/26a46d62cd723877-s.woff2",revision:"befd9c0fdfa3d8a645d5f95717ed6420"},{url:"/_next/static/media/55c55f0601d81cf3-s.woff2",revision:"43828e14271c77b87e3ed582dbff9f74"},{url:"/_next/static/media/581909926a08bbc8-s.woff2",revision:"f0b86e7c24f455280b8df606b89af891"},{url:"/_next/static/media/6d93bde91c0c2823-s.woff2",revision:"621a07228c8ccbfd647918f1021b4868"},{url:"/_next/static/media/97e0cb1ae144a2a9-s.woff2",revision:"e360c61c5bd8d90639fd4503c829c2dc"},{url:"/_next/static/media/a34f9d1faa5f3315-s.p.woff2",revision:"d4fe31e6a2aebc06b8d6e558c9141119"},{url:"/_next/static/media/df0a9ae256c0569c-s.woff2",revision:"d54db44de5ccb18886ece2fda72bdfe0"},{url:"/icons/icon-128x128.png",revision:"cf6fbe6c12584f723c9ec3a9abff3264"},{url:"/icons/icon-144x144.png",revision:"323d93c4141331e75da2a91eb0fa9ffa"},{url:"/icons/icon-152x152.png",revision:"691e3d2d92ea63961c2eea1d04cac672"},{url:"/icons/icon-192x192.png",revision:"c4772b0f8f58075f7b6aff32dbfe42b3"},{url:"/icons/icon-256x256.png",revision:"039f03e6f1f8eba139175c2f947b2ede"},{url:"/icons/icon-384x384.png",revision:"d0762389077a4d23a12dc869b78b2d69"},{url:"/icons/icon-48x48.png",revision:"ba40e1e4ed9656df34ed2bda520bc57d"},{url:"/icons/icon-512x512.png",revision:"0d20658e24294991d5bd9d4697a3e1c9"},{url:"/icons/icon-72x72.png",revision:"c9ebe4b5fd15d9fce5add4993653ea41"},{url:"/icons/icon-96x96.png",revision:"812ac9778ebbc886412180a5f8a9345e"},{url:"/manifest.json",revision:"aac08639ed94fb23a3d3dd828f54608a"}],{ignoreURLParametersMatching:[]}),e.cleanupOutdatedCaches(),e.registerRoute("/",new e.NetworkFirst({cacheName:"start-url",plugins:[{cacheWillUpdate:async({request:e,response:s,event:t,state:n})=>s&&"opaqueredirect"===s.type?new Response(s.body,{status:200,statusText:"OK",headers:s.headers}):s}]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,new e.CacheFirst({cacheName:"google-fonts-webfonts",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:31536e3})]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,new e.StaleWhileRevalidate({cacheName:"google-fonts-stylesheets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,new e.StaleWhileRevalidate({cacheName:"static-font-assets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,new e.StaleWhileRevalidate({cacheName:"static-image-assets",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/image\?url=.+$/i,new e.StaleWhileRevalidate({cacheName:"next-image",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp3|wav|ogg)$/i,new e.CacheFirst({cacheName:"static-audio-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp4)$/i,new e.CacheFirst({cacheName:"static-video-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:js)$/i,new e.StaleWhileRevalidate({cacheName:"static-js-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:css|less)$/i,new e.StaleWhileRevalidate({cacheName:"static-style-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/data\/.+\/.+\.json$/i,new e.StaleWhileRevalidate({cacheName:"next-data",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:json|xml|csv)$/i,new e.NetworkFirst({cacheName:"static-data-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>{if(!(self.origin===e.origin))return!1;const s=e.pathname;return!s.startsWith("/api/auth/")&&!!s.startsWith("/api/")}),new e.NetworkFirst({cacheName:"apis",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:16,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>{if(!(self.origin===e.origin))return!1;return!e.pathname.startsWith("/api/")}),new e.NetworkFirst({cacheName:"others",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>!(self.origin===e.origin)),new e.NetworkFirst({cacheName:"cross-origin",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:3600})]}),"GET")}));
