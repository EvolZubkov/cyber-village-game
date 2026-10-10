/* Sandbox: find the 10 secrets in the yard as fast as you can. The clock runs until the last one. */
window.MG = window.MG || {};
MG.screens = MG.screens || {};
(function (MG) {
  "use strict";

  var TOTAL = 10;
  var HINT_MS = 6000;
  var MISSES_PER_HECKLE = 3;
  var HECKLE_SHOW_MS = 5500;
  var HECKLE_COOLDOWN_MS = 3000; // after the goose hides, misses do not count for this long
  var HECKLES_PER_CLUE = 5; // after this many taunts the goose points at a secret that is still hidden
  var CLUE_RING_MS = 7000;
  var FADE_MS = 550; // matches the .sb-item.egg fade in game.css

  var stage = null;
  var clockTimer = null;
  var hintTimer = null;
  var heckleTimer = null;
  var clueTimer = null;

  function cleanup() {
    if (stage) stage.destroy();
    stage = null;
    clearInterval(clockTimer);
    clearTimeout(hintTimer);
    var panel = document.querySelector("#screen-sandbox .side-panel");
    if (panel) panel.classList.remove("open");
    clearTimeout(heckleTimer);
    clearTimeout(clueTimer);
    var heckler = document.querySelector("#screen-sandbox .goose-heckle");
    if (heckler) heckler.classList.remove("show");
  }

  function decodeMask(mask) {
    var raw = atob(mask.bits);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return { w: mask.w, h: mask.h, bytes: bytes };
  }

  function maskHit(mask, lx, ly) {
    var cx = Math.min(mask.w - 1, Math.floor(lx * mask.w));
    var cy = Math.min(mask.h - 1, Math.floor(ly * mask.h));
    var idx = cy * mask.w + cx;
    return ((mask.bytes[idx >> 3] >> (7 - (idx & 7))) & 1) === 1;
  }

  /**
   * @param {{playerName: string, archetype: string, onFinish: function(number): void}} opts
   *   onFinish receives the time in milliseconds
   */
  function run(opts) {
    cleanup();
    var data = window.MG_SANDBOX_SCENE;
    var eggTexts = MG.story.sandbox.eggs;
    var root = MG.ui.showScreen("sandbox");
    var viewport = root.querySelector(".stage");
    var scene = root.querySelector(".scene");
    var hudCount = root.querySelector(".hud-count");
    var hudTime = root.querySelector(".hud-time");
    var banner = root.querySelector(".banner");
    var hint = root.querySelector(".tap-hint");
    var modal = root.querySelector(".side-panel");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    var wrap = root.querySelector(".stage-wrap");
    wrap.classList.add("has-backdrop");
    MG.ui.setBackdrop(wrap, "assets/sandbox/bg1.webp");
    MG.ui.clear(scene);

    var eggs = [];
    data.items.forEach(function (item) {
      var img = MG.ui.el("img", item.kind === "egg" ? "sb-item egg" : "sb-item layer");
      img.src = item.src;
      img.alt = "";
      img.draggable = false;
      img.style.cssText = "left:" + item.left * 100 + "%;top:" + item.top * 100 + "%;width:" + item.width * 100 + "%;height:" + item.height * 100 + "%;z-index:" + item.z;
      scene.appendChild(img);
      if (item.kind === "egg") eggs.push({ item: item, el: img, mask: decodeMask(item.mask), found: false });
    });
    // Front-most first, so a tap hits the object the player sees on top.
    eggs.sort(function (a, b) { return b.item.z - a.item.z; });

    stage = MG.createStage(viewport, scene, data.sceneAspect, { onGesture: function () { hint.classList.add("off"); } });
    stage.reset("auto");

    var found = 0;
    var misses = 0;
    var heckleCount = 0;
    var clueRing = null;
    var heckleBlockedUntil = 0; // Infinity while the goose is on screen, then now + cooldown
    var nextHeckle = MG.engine.createPhraseBag(MG.story.sandbox.heckles);
    var heckler = root.querySelector(".goose-heckle");
    heckler.classList.remove("show");
    var panelOpen = false;
    var panelTimer = null;
    var finished = false;
    var startedAt = performance.now();
    var totalMs = 0;

    banner.hidden = opts.archetype !== "cabbage";
    if (!banner.hidden) banner.textContent = MG.story.sandbox.cabbageBanner(opts.playerName || "Игрок");
    hint.classList.remove("off");
    hint.textContent = "Двигай двор пальцем, увеличивай щипком и ищи секреты";
    hintTimer = setTimeout(function () { hint.classList.add("off"); }, HINT_MS);

    function updateHud() {
      hudCount.textContent = "Секреты: ";
      hudCount.appendChild(MG.ui.el("span", "digits", String(found)));
      hudCount.appendChild(document.createTextNode(" / "));
      hudCount.appendChild(MG.ui.el("span", "digits", String(TOTAL)));
    }
    updateHud();
    hudTime.textContent = "0:00";
    clockTimer = setInterval(function () { hudTime.textContent = MG.engine.formatTime(performance.now() - startedAt); }, 250);

    function isPanelOpen() { return panelOpen; }

    /** The description slides in from the right once the found object has faded away. */
    function openPanel(egg) {
      var texts = eggTexts[egg.item.n];
      modal.querySelector(".modal-count").textContent = "Секрет " + found + " из " + TOTAL;
      modal.querySelector(".modal-title").textContent = texts[0];
      modal.querySelector(".modal-text").textContent = texts[1];
      panelOpen = true;
      hint.classList.add("off");
      panelTimer = setTimeout(function () {
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        modal.querySelector("button").focus({ preventScroll: true });
      }, MG.ui.reducedMotion ? 0 : FADE_MS);
    }

    function closeModal() {
      clearTimeout(panelTimer);
      panelOpen = false;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      if (finished) {
        cleanup();
        opts.onFinish(totalMs);
      }
    }

    function onFound(egg) {
      egg.found = true;
      hideClue();
      egg.el.classList.add("found");
      found += 1;
      updateHud();
      if (found === TOTAL) {
        // The result is fixed when the last secret is found, not when its text is closed.
        totalMs = performance.now() - startedAt;
        finished = true;
        clearInterval(clockTimer);
        hudTime.textContent = MG.engine.formatTime(totalMs);
      }
      openPanel(egg);
    }

    /** A pulsing ring over a random secret that has not been found yet; the view moves to it. */
    function showClue() {
      var hidden = eggs.filter(function (egg) { return !egg.found; });
      if (!hidden.length) return false;
      var egg = hidden[Math.floor(Math.random() * hidden.length)].item;
      var cx = (egg.left + egg.width / 2) * 100;
      var cy = (egg.top + egg.height / 2) * 100;
      var diameter = Math.max(egg.width * 100, (egg.height * 100) / data.sceneAspect, 7);
      hideClue();
      clueRing = MG.ui.el("div", "clue-ring");
      clueRing.style.cssText = "left:" + cx + "%;top:" + cy + "%;width:" + diameter + "%";
      scene.appendChild(clueRing);
      stage.focus(cx, cy);
      clearTimeout(clueTimer);
      clueTimer = setTimeout(hideClue, CLUE_RING_MS);
      return true;
    }

    function hideClue() {
      if (clueRing) clueRing.remove();
      clueRing = null;
    }

    /** Every third tap beside the secrets makes the goose pop up with a random, not recently used taunt. */
    function onMiss() {
      if (performance.now() < heckleBlockedUntil) return; // goose still on screen or just left: ignore the tap
      misses += 1;
      if (misses % MISSES_PER_HECKLE !== 0) return;
      heckleCount += 1;
      var clue = heckleCount % HECKLES_PER_CLUE === 0 && showClue();
      heckler.querySelector("p span").textContent = clue ? MG.story.sandbox.clueLine : nextHeckle();
      heckler.classList.add("show");
      heckleBlockedUntil = Infinity;
      clearTimeout(heckleTimer);
      heckleTimer = setTimeout(function () {
        heckler.classList.remove("show");
        heckleBlockedUntil = performance.now() + HECKLE_COOLDOWN_MS;
      }, HECKLE_SHOW_MS);
    }

    viewport.onclick = function (e) {
      if (finished || isPanelOpen()) return;
      var r = scene.getBoundingClientRect();
      var u = (e.clientX - r.left) / r.width;
      var v = (e.clientY - r.top) / r.height;
      for (var i = 0; i < eggs.length; i++) {
        var egg = eggs[i];
        if (egg.found) continue;
        var lx = (u - egg.item.left) / egg.item.width;
        var ly = (v - egg.item.top) / egg.item.height;
        if (lx < 0 || lx > 1 || ly < 0 || ly > 1) continue;
        if (maskHit(egg.mask, lx, ly)) { onFound(egg); return; }
      }
      onMiss();
    };
    modal.querySelector("button").onclick = closeModal;
    modal.onkeydown = function (e) { if (e.key === "Escape") closeModal(); };
  }

  MG.screens.sandbox = { run: run, stop: cleanup };
})(window.MG);
