/* Cutscene: the scene picture dimmed, what the player picked, and the story text in a framed box.
 * The outcome ("path") is not shown to the player, only the story text.
 */
window.MG = window.MG || {};
MG.screens = MG.screens || {};
(function (MG) {
  "use strict";

  var typing = null;
  var stopWatching = null;

  function stop() {
    if (stopWatching) stopWatching();
    stopWatching = null;
    if (typing) typing.skip();
    typing = null;
  }

  /** The story text without its first sentence (the one that lists the picked items). */
  function withoutFirstSentence(text) {
    var match = /^[\s\S]*?[.!?](\s+|$)/.exec(text);
    return match ? text.slice(match[0].length) : text;
  }

  function storyText(n, outcome) {
    var text = MG.story.scenes[n - 1].cutscenes[outcome];
    return MG.story.cutsceneListsItems[n].indexOf(outcome) !== -1 ? withoutFirstSentence(text) : text;
  }

  /** Swaps the picture set when the phone turns, without restarting the text. */
  function setPicture(root, opts) {
    var bg = root.querySelector(".cut-bg");
    var key = "sc" + opts.n + "_" + opts.outcome;
    var look = MG.ui.variant();
    stopWatching = MG.ui.watchVariant(look.portrait, function () { setPicture(root, opts); });
    var hasPicture = look.cutscenes.indexOf(key) !== -1;
    // A picture of the situation when there is one; otherwise the dimmed scene background.
    bg.style.backgroundImage = "url(assets/" + (hasPicture ? "cut/" + look.prefix + key : "bg/" + look.prefix + "scene" + opts.n) + ".webp)";
    bg.classList.toggle("situation", hasPicture);
    if (hasPicture) MG.ui.setBackdrop(root, "assets/cut/" + look.prefix + key + ".webp");
    else root.style.removeProperty("--backdrop");
  }

  /**
   * @param {{n: 1|2|3, outcome: string, picks: number[], onDone: function}} opts
   *   picks are the item indexes (0-9) the player took, used to show their icons
   */
  function run(opts) {
    stop();
    var data = MG.story.scenes[opts.n - 1];
    var root = MG.ui.showScreen("cutscene");
    setPicture(root, opts);

    var picksHost = root.querySelector(".cut-picks");
    MG.ui.clear(picksHost);
    if (!opts.picks.length) picksHost.appendChild(MG.ui.el("span", "cut-empty", "Ничего не выбрано"));
    opts.picks.forEach(function (index) {
      var img = MG.ui.el("img", "slot-icon");
      img.src = "assets/icons/s" + opts.n + "_" + index + ".webp";
      img.alt = data.items[index][1];
      picksHost.appendChild(img);
    });

    var took = root.querySelector(".cut-took");
    took.hidden = !opts.picks.length;
    took.textContent = "В руках: " + opts.picks.map(function (index) { return data.items[index][1]; }).join(", ");
    var body = root.querySelector(".frame-text");
    var next = root.querySelector(".next-btn");
    next.hidden = true;
    next.textContent = opts.n < MG.engine.SCENES_TOTAL ? "Дальше" : "К результатам";
    typing = MG.ui.typewriter(body, storyText(opts.n, opts.outcome), function () {
      next.hidden = false;
      next.focus();
    });
    root.querySelector(".text-frame").onclick = function () { if (typing) typing.skip(); };
    next.onclick = function () { stop(); opts.onDone(); };
  }

  MG.screens.cutscene = { run: run, stop: stop };
})(window.MG);
