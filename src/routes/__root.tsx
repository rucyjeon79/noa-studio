import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { PcFrame } from "@/components/pc-frame";
import appCss from "../styles.css?url";

const APP_NAME = "NOA STUDIO";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "AI Artist Noa. ACT와 장르를 고르면 단곡 또는 10곡 묶음 패키지를 만듭니다.",
      },
      { name: "theme-color", content: "#0B0B0D" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "application-name", content: APP_NAME },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600&family=Noto+Serif+KR:wght@500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
    scripts: [
      {
        children:
          'window.addEventListener("vite:preloadError",function(e){try{e.preventDefault();}catch(err){}try{if(sessionStorage.getItem("noa-health-hold")==="1"||sessionStorage.getItem("noa-fill-live")==="1")return;if(sessionStorage.getItem("noa-stale-reload")==="1")return;sessionStorage.setItem("noa-stale-reload","1");}catch(err){return;}location.reload();});window.__noaInstall=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__noaInstall=e;try{window.dispatchEvent(new Event("noa-install"));}catch(err){}});if(navigator.serviceWorker){navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(function(){});}(function(){var y=0;document.addEventListener("touchstart",function(e){if(e.touches&&e.touches[0])y=e.touches[0].clientY;},{passive:true});document.addEventListener("touchmove",function(e){if(!e.touches||!e.touches[0])return;var n=e.touches[0].clientY;var top=(document.scrollingElement&&document.scrollingElement.scrollTop)||0;if(top<=0&&n>y)e.preventDefault();y=n;},{passive:false});window.addEventListener("keydown",function(e){if(e.key==="F5"||((e.ctrlKey||e.metaKey)&&(e.key==="r"||e.key==="R")))e.preventDefault();});})();',
      },
    ],
  }),
  component: () => (
    <html lang="ko" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <PcFrame>
            <Outlet />
          </PcFrame>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
