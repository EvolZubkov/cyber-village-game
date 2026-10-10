/* A pannable, zoomable stage for wide pictures. Used by the prologue, the scenes and the Sandbox.
 *
 * The viewport is a scrolling container, the scene inside it is as wide as the picture needs.
 * Pinch (or Ctrl + wheel) zooms; there are no zoom buttons. Only the Sandbox is zoomable;
 * other screens pass {locked: true} (whole picture) or {locked: "cover"} (fills the screen, cropped). Zoom 1 means "the picture just covers the screen". The smallest zoom shows the whole picture.
 */
window.MG = window.MG || {};
(function (MG) {
  "use strict";

  var MAX_ZOOM = 5;
  var PORTRAIT_SPAN = 2.6;
  var MAX_CROP_RATIO = 1.45; // locked stage: crop at most this much of the picture height
  var DRAG_THRESHOLD = 6;
  var GESTURE_CLICK_GUARD_MS = 350;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /**
   * @param {HTMLElement} viewport scrolling container
   * @param {HTMLElement} scene element holding the picture and everything placed on it
   * @param {number} aspect picture width / height
   * @param {{onGesture?: function}} [options]
   */
  function createStage(viewport, scene, aspect, options) {
    var opts = options || {};
    var zoom = 1;
    var moved = false;
    var lastPinchAt = 0;
    var drag = null;
    var pinch = null;
    var disposers = [];
    scene.style.aspectRatio = String(aspect);

    function coverWidth() { return Math.max(viewport.clientWidth, viewport.clientHeight * aspect); }
    function fitZoom() { return Math.min(viewport.clientWidth, viewport.clientHeight * aspect) / coverWidth(); }
    function center() {
      var r = viewport.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    /** Sets the zoom and keeps the scene point under (cx, cy) where it was. */
    function applyZoom(next, cx, cy) {
      var before = scene.getBoundingClientRect();
      var u = before.width ? (cx - before.left) / before.width : 0.5;
      var v = before.height ? (cy - before.top) / before.height : 0.5;
      zoom = clamp(next, fitZoom(), MAX_ZOOM);
      scene.style.width = (coverWidth() * zoom) + "px";
      var after = scene.getBoundingClientRect();
      viewport.scrollLeft += (after.left + u * after.width) - cx;
      viewport.scrollTop += (after.top + v * after.height) - cy;
      if (opts.onGesture) opts.onGesture();
    }

    /**
     * Opens at "auto" zoom. A portrait phone gets a picture about 2.6 screens wide (big enough to tap,
     * with room to pan); anywhere else the picture covers the screen. "fit" shows the whole picture.
     */
    function reset(startZoom) {
      var mode = startZoom || "auto";
      var portrait = viewport.clientHeight > viewport.clientWidth;
      if (mode === "fit") zoom = fitZoom();
      else if (mode === "auto" && portrait) zoom = clamp(viewport.clientWidth * PORTRAIT_SPAN / coverWidth(), fitZoom(), 1);
      else zoom = 1;
      scene.style.width = (coverWidth() * zoom) + "px";
      viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
      viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
    }

    /** Scrolls so that the point (xPct, yPct) of the picture is in the middle of the screen. */
    function focus(xPct, yPct) {
      var w = scene.offsetWidth;
      var h = scene.offsetHeight;
      viewport.scrollLeft = (xPct / 100) * w - viewport.clientWidth / 2;
      viewport.scrollTop = (yPct / 100) * h - viewport.clientHeight / 2;
    }

    function on(target, type, handler, options2) {
      target.addEventListener(type, handler, options2);
      disposers.push(function () { target.removeEventListener(type, handler, options2); });
    }

    // Locked stage (prologue and scenes): the whole picture is shown, no pan and no zoom.
    if (opts.locked) {
      viewport.classList.add("locked");
      var refit = function () {
        // Fill the screen width; the picture's top is cropped a little when the screen is not wide enough.
        // Very wide screens fall back to showing the whole picture.
        var widthZoom = viewport.clientWidth / coverWidth();
        var cropOk = viewport.clientWidth / aspect <= viewport.clientHeight * MAX_CROP_RATIO;
        zoom = opts.locked === "cover" ? 1 : (cropOk ? widthZoom : fitZoom());
        scene.style.width = (coverWidth() * zoom) + "px";
        viewport.style.alignItems = scene.offsetHeight > viewport.clientHeight ? "flex-end" : "center";
      };
      on(window, "resize", refit);
      return {
        reset: refit,
        focus: function () {},
        getZoom: function () { return zoom; },
        destroy: function () { disposers.forEach(function (d) { d(); }); disposers = []; viewport.classList.remove("locked"); }
      };
    }
    viewport.classList.remove("locked");
    on(window, "resize", function () { var c = center(); applyZoom(zoom, c.x, c.y); });

    // Mouse drag pans like a finger does on a touch screen.
    on(viewport, "pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      moved = false;
    });
    on(viewport, "pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) { moved = true; viewport.classList.add("drag"); }
      if (moved) { viewport.scrollLeft = drag.left - dx; viewport.scrollTop = drag.top - dy; }
    });
    function endDrag() {
      drag = null;
      viewport.classList.remove("drag");
      setTimeout(function () { moved = false; }, 0);
    }
    on(viewport, "pointerup", endDrag);
    on(viewport, "pointercancel", endDrag);
    on(viewport, "pointerleave", endDrag);

    // Pinch with two fingers. Touch events are used because pan-x pan-y hands pinches to the page.
    function span(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    on(viewport, "touchstart", function (e) {
      if (e.touches.length === 2) pinch = { dist: span(e.touches), zoom: zoom };
    }, { passive: true });
    on(viewport, "touchmove", function (e) {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      var t = e.touches;
      applyZoom(pinch.zoom * span(t) / pinch.dist, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
      lastPinchAt = Date.now();
    }, { passive: false });
    on(viewport, "touchend", function (e) { if (e.touches.length < 2) pinch = null; }, { passive: true });

    // Trackpad pinch and Ctrl + wheel.
    on(viewport, "wheel", function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      applyZoom(zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    }, { passive: false });

    // A drag or a pinch must never count as a tap on whatever lies under the fingers.
    on(viewport, "click", function (e) {
      if (moved || Date.now() - lastPinchAt < GESTURE_CLICK_GUARD_MS) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);

    return {
      reset: reset, focus: focus,
      getZoom: function () { return zoom; },
      destroy: function () { disposers.forEach(function (d) { d(); }); disposers = []; }
    };
  }

  MG.createStage = createStage;
})(window.MG);
