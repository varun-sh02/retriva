/**
 * Retriva embeddable chat widget.
 *
 *   <script src="https://your-app.vercel.app/widget.js"
 *           data-retriva-token="YOUR_SHARE_TOKEN"></script>
 *
 * Everything renders inside an iframe pointed at Retriva's own origin. That
 * is deliberate on three counts: the host page's CSS cannot leak in and break
 * the chat (or vice versa), the widget ships no framework onto a page that
 * may already have its own, and the chat request is same-origin from inside
 * the frame, so there is no CORS surface and no third-party cookie to rely on.
 *
 * The only thing this file needs from the host page is the share token.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var token = script.getAttribute("data-retriva-token");
  if (!token) {
    console.error("[retriva] missing data-retriva-token on the widget script tag");
    return;
  }

  // Derive the origin from this script's own URL so the snippet never has to
  // repeat it, and can never point the frame at a different host than the one
  // that served the loader.
  var origin = new URL(script.src, window.location.href).origin;
  var label = script.getAttribute("data-retriva-label") || "Ask a question";
  var accent = script.getAttribute("data-retriva-accent") || "#E08A1E";
  var side = script.getAttribute("data-retriva-side") === "left" ? "left" : "right";

  if (document.getElementById("retriva-widget-root")) return;

  var root = document.createElement("div");
  root.id = "retriva-widget-root";

  var style = document.createElement("style");
  style.textContent = [
    "#retriva-widget-root{position:fixed;bottom:20px;" + side + ":20px;z-index:2147483000;}",
    "#retriva-launcher{display:flex;align-items:center;gap:8px;border:0;border-radius:9999px;",
    "padding:12px 18px;font:500 14px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;",
    "color:#fff;background:" + accent + ";cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.18);}",
    "#retriva-launcher:hover{opacity:.92}",
    "#retriva-panel{position:fixed;bottom:84px;" + side + ":20px;width:400px;height:600px;",
    "max-width:calc(100vw - 32px);max-height:calc(100dvh - 112px);border:0;border-radius:14px;",
    "overflow:hidden;background:#fff;box-shadow:0 12px 48px rgba(0,0,0,.22);display:none;}",
    "#retriva-panel.retriva-open{display:block}",
    // On a phone the panel is the screen; a 400px floating card would be
    // unusable next to the on-screen keyboard.
    "@media (max-width:480px){#retriva-panel{inset:0;width:100vw;height:100dvh;",
    "max-width:100vw;max-height:100dvh;border-radius:0}}",
  ].join("");

  var launcher = document.createElement("button");
  launcher.id = "retriva-launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "retriva-panel");
  launcher.textContent = label;

  var frame = document.createElement("iframe");
  frame.id = "retriva-panel";
  frame.title = "Chat";
  frame.setAttribute("loading", "lazy");
  // allow-same-origin is required, not incidental: without it the frame gets
  // an opaque origin, which makes its own /api/public/chat request count as
  // cross-origin (blocked, since that endpoint sends no CORS headers) and
  // makes localStorage throw. It does NOT grant reach into the host page —
  // the frame is cross-origin to it either way, so "same origin" here means
  // Retriva's origin, not the embedder's. allow-popups only lets the frame's
  // own links (the "Powered by Retriva" footer) open in a new tab; withholding
  // allow-top-navigation is what actually keeps the widget from hijacking the
  // host page.
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");

  var loaded = false;
  function toggle() {
    var open = frame.classList.toggle("retriva-open");
    launcher.setAttribute("aria-expanded", String(open));
    // Defer the iframe's cost until someone actually opens the chat, so an
    // embed on a landing page costs nothing until it is used.
    if (open && !loaded) {
      frame.src = origin + "/embed/" + encodeURIComponent(token);
      loaded = true;
    }
  }

  launcher.addEventListener("click", toggle);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && frame.classList.contains("retriva-open")) toggle();
  });

  root.appendChild(style);
  root.appendChild(launcher);
  root.appendChild(frame);
  document.body.appendChild(root);
})();
