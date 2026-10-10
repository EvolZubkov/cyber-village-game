/* Final screen: the archetype, a name field and the passport button, or the secret goose ending.
 * The goose video loops; the text sits in a plate and "Попробовать снова" is visible at once.
 */
window.MG = window.MG || {};
MG.screens = MG.screens || {};
(function (MG) {
  "use strict";

  function stop() {
    var video = document.querySelector("#screen-final video");
    if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
  }

  function showGoose(root, data, onRetry) {
    var video = root.querySelector("video");
    var caption = root.querySelector(".goose-caption");
    var retry = root.querySelector(".retry-btn");
    caption.hidden = false;
    caption.textContent = data.caption;
    retry.hidden = false;
    retry.onclick = function () { stop(); onRetry(); };
    video.hidden = false;
    video.loop = true;
    video.src = "assets/goose.mp4";
    video.currentTime = 0;
    var play = video.play();
    if (play && play.catch) {
      play.catch(function () {
        // Sound autoplay can be refused: try muted.
        video.muted = true;
        var second = video.play();
        if (second && second.catch) second.catch(function () { video.controls = true; });
      });
    }
    retry.focus({ preventScroll: true });
  }

  /**
   * @param {{key: string, onPassport: function(string): void, onRetry: function}} opts
   */
  function run(opts) {
    stop();
    var data = MG.story.finals[opts.key];
    var root = MG.ui.showScreen("final");
    var isGoose = opts.key === "goose_true";
    root.classList.toggle("goose-final", isGoose);

    root.querySelector(".final-headline").textContent = data.headline;
    root.querySelector(".final-title").textContent = isGoose ? "" : data.title;
    root.querySelector(".final-text").textContent = data.text;
    var badge = root.querySelector(".final-badge");
    var form = root.querySelector(".passport-form");
    var video = root.querySelector("video");

    if (isGoose) {
      badge.hidden = true;
      form.hidden = true;
      showGoose(root, data, opts.onRetry);
      return;
    }

    video.hidden = true;
    root.querySelector(".goose-caption").hidden = true;
    root.querySelector(".retry-btn").hidden = true;
    badge.hidden = false;
    badge.src = "assets/badges/" + opts.key + ".webp";
    badge.alt = data.title;
    form.hidden = false;
    var input = form.querySelector("input");
    var button = form.querySelector("button");
    input.value = "";
    button.disabled = true;
    input.oninput = function () { button.disabled = MG.engine.cleanName(input.value) === ""; };
    form.onsubmit = function (e) {
      e.preventDefault();
      var name = MG.engine.cleanName(input.value);
      if (!name) return;
      opts.onPassport(name);
    };
    input.focus({ preventScroll: true });
  }

  MG.screens.final = { run: run, stop: stop, preloadUrls: function (key) { return key === "goose_true" ? [] : ["assets/badges/" + key + ".webp"]; } };
})(window.MG);
