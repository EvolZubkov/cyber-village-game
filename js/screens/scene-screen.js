/* Interactive scene: flat items lie on the map, picked items go to the backpack (round icons).
 *
 * Rules (spec 1.2): 45 seconds, at most 3 picks, every item once. The scene ends when the third item
 * is picked (after a short pause), when the player presses "Готово" with 1-2 items, or when the timer
 * runs out. sceneResolved makes sure it ends only once. A picked item can be put back by tapping it
 * in the backpack. The items change places on every run.
 */
window.MG = window.MG || {};
MG.screens = MG.screens || {};
(function (MG) {
  "use strict";

  var TIMER_TICK_MS = 100;
  var FLY_MS = 450;
  var HURRY_MS = 10000;
  var ITEM_TOP_ROOM = 12; // percent of the picture height kept above the highest item place
  var HINT_MS = 8000; // how long the "take 3 items" hint stays on screen

  var stage = null;
  var tickTimer = null;
  var lockTimer = null;
  var hintTimer = null;
  var stopWatching = null;

  function cleanup() {
    if (stage) stage.destroy();
    stage = null;
    clearInterval(tickTimer);
    clearTimeout(lockTimer);
    clearTimeout(hintTimer);
    if (stopWatching) stopWatching();
    stopWatching = null;
  }

  function assetUrls(n) {
    var urls = ["assets/bg/" + MG.ui.variant().prefix + "scene" + n + ".webp"];
    for (var i = 0; i < 10; i++) urls.push("assets/items/s" + n + "_" + i + ".webp", "assets/icons/s" + n + "_" + i + ".webp");
    return urls;
  }

  /** Fisher-Yates copy; the original array stays as it is. */
  function shuffled(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  /** Flies a copy of an image from one screen rectangle to another. */
  function fly(from, to, src, done) {
    if (MG.ui.reducedMotion || !document.body.animate) { done(); return; }
    var clone = MG.ui.el("img", "fly");
    clone.src = src;
    clone.alt = "";
    clone.style.cssText = "left:" + from.left + "px;top:" + from.top + "px;width:" + from.width + "px;height:" + from.height + "px";
    document.body.appendChild(clone);
    var dx = to.left + to.width / 2 - (from.left + from.width / 2);
    var dy = to.top + to.height / 2 - (from.top + from.height / 2);
    var scale = Math.min(to.width / from.width, to.height / from.height);
    var anim = clone.animate(
      [{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: "translate(" + dx + "px," + dy + "px) scale(" + scale + ")", opacity: 0.95 }],
      { duration: FLY_MS, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
    anim.onfinish = function () { clone.remove(); done(); };
  }

  function formatDigits(msLeft) {
    return MG.engine.formatTime(Math.ceil(msLeft / 1000) * 1000);
  }

  /** Dragging of items in the edit mode (index.html?edit=1) and export of the places. */
  function enableEditing(root, scene, places, itemEls) {
    var bar = root.querySelector(".edit-bar");
    var out = bar.querySelector("textarea");
    bar.hidden = false;
    function exportPlaces() {
      var rows = places.map(function (p) { return "(" + Math.round(p.x) + ", " + Math.round(p.y) + ")"; });
      out.value = "[" + rows.join(", ") + "]";
    }
    itemEls.forEach(function (node, i) {
      node.classList.add("editable");
      node.addEventListener("pointerdown", function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        node.setPointerCapture(ev.pointerId);
        function move(e) {
          var r = scene.getBoundingClientRect();
          places[i].x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
          places[i].y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
          node.style.left = places[i].x + "%";
          node.style.top = places[i].y + "%";
          exportPlaces();
        }
        function up() { node.removeEventListener("pointermove", move); node.removeEventListener("pointerup", up); }
        node.addEventListener("pointermove", move);
        node.addEventListener("pointerup", up);
      });
    });
    exportPlaces();
  }

  /**
   * @param {{n: 1|2|3, onEnd: function(string[], number[]): void}} opts
   *   onEnd gets the picked tags and the picked item indexes, both in pick order
   */
  function run(opts) {
    cleanup();
    var n = opts.n;
    var max = MG.config.maxPicks;
    var data = MG.story.scenes[n - 1];
    var layout = MG.layout.scenes[String(n)];
    var editMode = !!MG.ui.query().edit;
    var look = MG.ui.variant();
    // Which place each item takes (shuffled once per run); the places themselves depend on the picture set.
    var order = layout.items.map(function (_, i) { return i; });
    if (!editMode) order = shuffled(order);
    var places = [];

    var root = MG.ui.showScreen("scene");
    var viewport = root.querySelector(".stage");
    var scene = root.querySelector(".scene");
    var slotsHost = root.querySelector(".slots");
    var digits = root.querySelector(".hud-timer");
    var intro = root.querySelector(".intro-overlay");
    var counter = root.querySelector(".pick-counter .digits");
    var doneBtn = root.querySelector(".done-btn");
    var hint = root.querySelector(".scene-hint");
    hint.classList.add("off");
    root.querySelector(".hud-title").textContent = "Сцена " + n + ". " + data.title;
    root.querySelector(".pick-counter .digits:last-child").textContent = String(max);
    root.querySelector(".edit-bar").hidden = true;

    MG.ui.clear(scene);
    var bg = MG.ui.el("img", "scene-bg");
    bg.alt = "";
    scene.appendChild(bg);

    var inventory = [];   // tags in pick order
    var pickedOrder = []; // item indexes in pick order
    var locked = true;    // nothing can be picked before the intro is closed
    var sceneResolved = false;
    var itemEls = [];

    function resolveScene() {
      if (sceneResolved) return; // third pick, the button and the timer can arrive together
      sceneResolved = true;
      locked = true;
      var tags = inventory.slice();
      var indexes = pickedOrder.slice();
      cleanup();
      opts.onEnd(tags, indexes);
    }

    function updateControls() {
      counter.textContent = String(inventory.length);
      doneBtn.disabled = locked || inventory.length === 0;
    }

    function renderSlots(arrivingSlot) {
      MG.ui.clear(slotsHost);
      for (var s = 0; s < max; s++) {
        if (s < pickedOrder.length) {
          var index = pickedOrder[s];
          var slot = MG.ui.el("button", "slot filled");
          slot.type = "button";
          slot.setAttribute("aria-label", "Вернуть на карту: " + data.items[index][1]);
          slot.appendChild(MG.ui.el("span", "slot-label", data.items[index][1]));
          var icon = MG.ui.el("img", "slot-icon");
          icon.src = "assets/icons/s" + n + "_" + index + ".webp";
          icon.alt = "";
          slot.appendChild(icon);
          if (s === arrivingSlot) slot.classList.add("arriving");
          (function (slotIndex) { slot.addEventListener("click", function () { unpick(slotIndex); }); })(s);
          slotsHost.appendChild(slot);
        } else {
          var empty = MG.ui.el("div", "slot");
          empty.appendChild(MG.ui.el("span", "slot-label", "Слот " + (s + 1)));
          empty.appendChild(MG.ui.el("span", "slot-empty"));
          slotsHost.appendChild(empty);
        }
      }
    }

    function pick(index, node) {
      if (locked || pickedOrder.indexOf(index) !== -1 || inventory.length >= max) return;
      inventory = inventory.concat([data.items[index][0]]);
      pickedOrder = pickedOrder.concat([index]);
      var slotIndex = pickedOrder.length - 1;
      node.classList.add("picked");
      node.disabled = true;
      renderSlots(slotIndex);
      var from = node.querySelector("img").getBoundingClientRect();
      var slotEl = slotsHost.children[slotIndex];
      fly(from, slotEl.getBoundingClientRect(), node.querySelector("img").src, function () { slotEl.classList.remove("arriving"); });
      if (inventory.length === max) {
        locked = true;
        clearInterval(tickTimer);
        lockTimer = setTimeout(resolveScene, MG.config.lockDelayMs);
      }
      updateControls();
    }

    /** Puts a picked item back on the map (only while fewer than the maximum are picked). */
    function unpick(slotIndex) {
      if (locked || sceneResolved) return;
      var slotEl = slotsHost.children[slotIndex];
      if (!slotEl || slotEl.classList.contains("arriving")) return;
      var index = pickedOrder[slotIndex];
      var node = itemEls[index];
      var from = slotEl.querySelector("img").getBoundingClientRect();
      inventory = inventory.filter(function (_, i) { return i !== slotIndex; });
      pickedOrder = pickedOrder.filter(function (_, i) { return i !== slotIndex; });
      renderSlots(-1);
      updateControls();
      node.style.transition = "none"; // measure the item at its final size, not mid-animation
      node.classList.remove("picked");
      node.classList.add("flying");
      node.disabled = false;
      var to = node.querySelector("img").getBoundingClientRect();
      fly(from, to, node.querySelector("img").src, function () {
        node.classList.remove("flying");
        node.style.transition = "";
      });
    }

    layout.items.forEach(function (entry, index) {
      var btn = MG.ui.el("button", "map-item");
      btn.type = "button";
      btn.setAttribute("aria-label", data.items[index][1]);
      var img = MG.ui.el("img");
      img.alt = "";
      img.draggable = false;
      img.src = "assets/items/" + entry.id + ".webp";
      btn.appendChild(img);
      btn.appendChild(MG.ui.el("span", "map-label", data.items[index][1]));
      btn.addEventListener("click", function () { if (!editMode) pick(index, btn); });
      scene.appendChild(btn);
      itemEls.push(btn);
    });

    /** Picture, item places, item sizes and stage for the current orientation. Runs again when the phone turns. */
    function applyLook() {
      look = MG.ui.variant();
      var allSpots = look.portrait ? MG.layout.mobile.spots : layout.spots;
      var bgUrl = "assets/bg/" + look.prefix + "scene" + n + ".webp";
      bg.src = bgUrl;
      MG.ui.setBackdrop(viewport, bgUrl);
      places = layout.items.map(function (_, i) { return { x: allSpots[order[i]][0], y: allSpots[order[i]][1] }; });
      layout.items.forEach(function (entry, index) {
        var btn = itemEls[index];
        btn.style.left = places[index].x + "%";
        btn.style.top = places[index].y + "%";
        btn.style.width = (look.portrait ? entry.wm : entry.w) + "%";
        btn.classList.toggle("label-up", places[index].y > 80);
      });
      if (stage) stage.destroy();
      // The top of the picture may be cropped only above the highest item place (minus room for its size).
      var highest = Math.min.apply(null, allSpots.map(function (spot) { return spot[1]; }));
      stage = MG.createStage(viewport, scene, look.aspect, { locked: true, safeCrop: (highest - ITEM_TOP_ROOM) / 100 });
      stage.reset();
      if (stopWatching) stopWatching();
      stopWatching = editMode ? null : MG.ui.watchVariant(look.portrait, applyLook);
    }
    applyLook();
    renderSlots(-1);
    updateControls();
    doneBtn.onclick = function () { if (!locked) resolveScene(); };

    function startTimer() {
      hint.classList.remove("off");
      hintTimer = setTimeout(function () { hint.classList.add("off"); }, HINT_MS);
      locked = false;
      updateControls();
      var total = MG.config.sceneSeconds * 1000;
      var deadline = performance.now() + total;
      digits.textContent = formatDigits(total);
      tickTimer = setInterval(function () {
        var left = Math.max(0, deadline - performance.now());
        digits.textContent = formatDigits(left);
        root.classList.toggle("hurry", left < HURRY_MS);
        if (left <= 0) resolveScene();
      }, TIMER_TICK_MS);
    }

    digits.textContent = formatDigits(MG.config.sceneSeconds * 1000);
    root.classList.remove("hurry");

    if (editMode) {
      intro.hidden = true;
      enableEditing(root, scene, places, itemEls);
      return;
    }

    intro.hidden = false;
    intro.querySelector(".intro-title").textContent = "Сцена " + n + ". " + data.title;
    intro.querySelector(".intro-text").textContent = data.intro;
    var start = intro.querySelector("button");
    start.onclick = function () { intro.hidden = true; startTimer(); };
    start.focus();
  }

  MG.screens.scene = { run: run, stop: cleanup, preloadUrls: assetUrls };
})(window.MG);
