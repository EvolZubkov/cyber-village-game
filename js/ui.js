/* Small DOM helpers shared by all screens. */
window.MG = window.MG || {};
(function (MG) {
  "use strict";

  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TYPE_DELAY_MS = 16;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /** Shows one screen section and hides the others. */
  function showScreen(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) screens[i].hidden = screens[i].id !== "screen-" + id;
    var active = document.getElementById("screen-" + id);
    active.classList.remove("enter");
    void active.offsetWidth; // restart the fade-in
    active.classList.add("enter");
    return active;
  }

  /**
   * Types text into a node one character at a time. Returns { skip, done }.
   * skip() shows the whole text at once; done() tells if typing finished.
   */
  function typewriter(node, text, onDone) {
    var index = 0;
    var finished = false;
    var timer = null;
    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      node.textContent = text;
      if (onDone) onDone();
    }
    if (reducedMotion || !text) {
      finish();
    } else {
      node.textContent = "";
      timer = setInterval(function () {
        index += 1;
        node.textContent = text.slice(0, index);
        if (index >= text.length) finish();
      }, TYPE_DELAY_MS);
    }
    return { skip: finish, done: function () { return finished; } };
  }

  /** Resolves when every image has loaded (or failed, so a missing file never blocks the game). */
  function preload(urls) {
    return Promise.all(urls.map(function (url) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = img.onerror = function () { resolve(); };
        img.src = url;
      });
    }));
  }

  function query() {
    var out = {};
    new URLSearchParams(location.search).forEach(function (value, key) { out[key] = value; });
    return out;
  }

  /** Blurred copy of the picture behind a locked stage (an absolute URL: it is used from the stylesheet). */
  function setBackdrop(node, path) {
    node.style.setProperty("--backdrop", 'url("' + new URL(path, document.baseURI).href + '")');
  }

  /**
   * Portrait screens (phones held upright) get the tall pictures, everything else the wide ones.
   * Returns the file prefix and the layout data of the chosen variant.
   */
  function variant() {
    var layout = window.MG_LAYOUT;
    // The size of the page itself (not the media query): inside an embedding frame the query can lag behind.
    var portrait = window.innerHeight > window.innerWidth && !!layout.mobile;
    if (!portrait) return { portrait: false, prefix: "", aspect: layout.sceneAspect, hotspots: layout.hotspots, cutscenes: layout.cutscenes || [] };
    return { portrait: true, prefix: "m_", aspect: layout.mobile.sceneAspect, hotspots: layout.mobile.hotspots, cutscenes: layout.mobile.cutscenes || [] };
  }

  /** Calls onChange once when the page turns between portrait and landscape; returns a function that stops listening. */
  function watchVariant(current, onChange) {
    function check() {
      if (variant().portrait === current) return;
      window.removeEventListener("resize", check);
      onChange();
    }
    window.addEventListener("resize", check);
    return function () { window.removeEventListener("resize", check); };
  }

  MG.ui = { watchVariant: watchVariant, variant: variant, setBackdrop: setBackdrop, el: el, clear: clear, showScreen: showScreen, typewriter: typewriter, preload: preload, query: query, reducedMotion: reducedMotion };
})(window.MG);
