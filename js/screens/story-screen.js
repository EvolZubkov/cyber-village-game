/* Prologue screens: a picture, a text frame, and one place to tap.
 *
 * The place is not marked at first. After two taps beside it the real part of the picture starts to
 * flicker and a hint appears. The crash screen (prologue 3) zooms the picture slowly while the text types,
 * then shakes it (the text frame stays still) and moves on.
 */
window.MG = window.MG || {};
MG.screens = MG.screens || {};
(function (MG) {
  "use strict";

  var KEYS = ["prologue1", "prologue2", "prologue3"];
  var SHAKE_CLASS = "shake-animation";
  var TAKEOFF_CLASS = "takeoff-zoom";
  var MISSES_BEFORE_HINT = 2;

  var stage = null;
  var stopWatching = null;
  var autoTimer = null;
  var typing = null;

  function cleanup() {
    if (stage) stage.destroy();
    stage = null;
    if (stopWatching) stopWatching();
    stopWatching = null;
    clearTimeout(autoTimer);
    if (typing) typing.skip();
    typing = null;
  }

  function buildHotspot(spec, label, onTap) {
    var btn = MG.ui.el("button", "hotspot");
    btn.type = "button";
    btn.setAttribute("aria-label", label);
    btn.style.left = spec.x + "%";
    btn.style.top = spec.y + "%";
    btn.style.width = spec.w + "%";
    btn.style.height = spec.h + "%";
    btn.addEventListener("click", onTap);
    return btn;
  }

  /** A copy of the very part of the picture under the hotspot; it is made to flicker as the hint. */
  function buildGlow(spec, bgUrl) {
    var glow = MG.ui.el("div", "hot-glow");
    glow.style.left = spec.x + "%";
    glow.style.top = spec.y + "%";
    glow.style.width = spec.w + "%";
    glow.style.height = spec.h + "%";
    glow.style.backgroundImage = "url(" + bgUrl + ")";
    glow.style.backgroundSize = (10000 / spec.w) + "% " + (10000 / spec.h) + "%";
    glow.style.backgroundPosition = ((spec.x - spec.w / 2) / (100 - spec.w) * 100) + "% " + ((spec.y - spec.h / 2) / (100 - spec.h) * 100) + "%";
    return glow;
  }

  /**
   * @param {{key: "prologue1"|"prologue2"|"prologue3", onDone: function}} opts
   */
  function run(opts) {
    cleanup();
    var key = opts.key;
    var data = MG.story.prologue[key];
    var root = MG.ui.showScreen("story");
    var viewport = root.querySelector(".stage");
    var scene = root.querySelector(".scene");
    var frame = root.querySelector(".text-frame");
    var hint = root.querySelector(".tap-hint");
    var shaker = root.querySelector(".shake-target");
    MG.ui.clear(scene);
    shaker.classList.remove(SHAKE_CLASS);
    scene.classList.remove(TAKEOFF_CLASS);
    hint.hidden = true;

    var img = MG.ui.el("img", "scene-bg");
    img.alt = "";
    var look = MG.ui.variant();
    stopWatching = MG.ui.watchVariant(look.portrait, function () { run(opts); }); // the picture set follows the orientation
    var bgUrl = "assets/bg/" + look.prefix + key + ".webp";
    img.src = bgUrl;
    scene.appendChild(img);

    root.querySelector(".frame-title").textContent = data.title;
    var body = root.querySelector(".frame-text");
    var spec = look.hotspots[key];

    MG.ui.setBackdrop(viewport, bgUrl);
    stage = MG.createStage(viewport, scene, look.aspect, { locked: spec ? true : "cover" });
    stage.reset();

    if (spec) {
      typing = MG.ui.typewriter(body, data.text);
      var glow = buildGlow(spec, bgUrl);
      scene.appendChild(glow);
      scene.appendChild(buildHotspot(spec, data.hint, function () { cleanup(); opts.onDone(); }));
      var misses = 0;
      scene.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest(".hotspot")) return;
        misses += 1;
        if (misses === MISSES_BEFORE_HINT) {
          glow.classList.add("on");
          hint.textContent = data.hint;
          hint.hidden = false;
        }
      });
    } else {
      // Crash screen: the picture slowly zooms in (take-off) while the text types; when the text is
      // finished the picture shakes for crashShakeMs, then the game moves on.
      scene.classList.remove(TAKEOFF_CLASS);
      void scene.offsetWidth; // restart the animation
      scene.classList.add(TAKEOFF_CLASS);
      typing = MG.ui.typewriter(body, data.text, function () {
        shaker.classList.add(SHAKE_CLASS);
        autoTimer = setTimeout(function () { cleanup(); opts.onDone(); }, MG.config.crashShakeMs);
      });
    }
    frame.onclick = function () { if (typing) typing.skip(); };
  }

  MG.screens.story = { run: run, stop: cleanup, preloadUrls: function () { var prefix = MG.ui.variant().prefix; return KEYS.map(function (k) { return "assets/bg/" + prefix + k + ".webp"; }); } };
})(window.MG);
