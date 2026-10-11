/* Bridge to Skill'Ум after the Sandbox: system failure, the archetype's request, then the way out to the trainer.
 *
 * Desktop: a link opens the trainer in a new tab and the game waits for the code word it shows at the end.
 * Phone: the trainer does not run there, so the player sends the link to a computer.
 */
window.MG = window.MG || {};
MG.screens = MG.screens || {};
(function (MG) {
  "use strict";

  var FLASH_MS = 900;

  function fill(text, name) { return text.split("[Имя]").join(name); }

  function safeUrl(raw) { return /^https?:\/\//i.test(raw) ? raw : ""; }

  function button(label, onClick) {
    var btn = MG.ui.el("button", "btn", label);
    btn.type = "button";
    btn.addEventListener("click", onClick);
    return btn;
  }

  /** Copies text with the Clipboard API; resolves false when the browser refuses. */
  function copyText(text) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return Promise.resolve(false);
    return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
  }

  /**
   * @param {{name: string, archetype: string, url: string, wordHash: string, onDone: function({bonus: boolean}): void}} opts
   */
  function run(opts) {
    var story = MG.story.bridge;
    var url = safeUrl(opts.url);
    var name = opts.name || "Игрок";
    var root = MG.ui.showScreen("bridge");
    var title = root.querySelector(".bridge-title");
    var scroll = root.querySelector(".bridge-scroll");
    var avatar = root.querySelector(".bridge-avatar");
    var text = root.querySelector(".bridge-text");
    var dispatcher = root.querySelector(".bridge-dispatcher");
    var form = root.querySelector(".bridge-code");
    var input = root.querySelector("#bridge-code");
    var error = root.querySelector(".bridge-error");
    var actions = root.querySelector(".bridge-actions");
    var flash = root.querySelector(".bridge-flash");
    var plate = root.querySelector(".bridge-plate");
    var done = false;
    plate.classList.remove("alert", "ok");
    plate.classList.add("alert");
    root.querySelector("label[for=bridge-code]").textContent = story.codeLabel;

    function finish(bonus) {
      if (done) return;
      done = true;
      opts.onDone({ bonus: bonus });
    }

    function setActions(buttons) {
      MG.ui.clear(actions);
      buttons.forEach(function (b) { actions.appendChild(b); });
    }

    function removeExtras() {
      var extras = scroll.querySelectorAll(".bridge-extra");
      for (var i = 0; i < extras.length; i++) extras[i].remove();
    }

    function showAlert() {
      title.textContent = story.alertTitle;
      avatar.hidden = true;
      text.textContent = fill(story.alertText, name);
      dispatcher.hidden = true;
      form.hidden = true;
      setActions([button(story.nextButton, showRequest)]);
    }

    function openLink() {
      var link = MG.ui.el("a", "btn", story.openButton);
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.addEventListener("click", function () { setTimeout(showCode, 0); });
      return link;
    }

    function phoneButtons() {
      var shareButton = null;
      if (navigator.share) {
        shareButton = button(story.shareButton, function () {
          navigator.share({ title: "Skill'Ум", url: url }).catch(function () { /* the player closed the share sheet */ });
        });
      } else {
        shareButton = button(story.copyButton, function () {
          copyText(url).then(function (ok) { shareButton.textContent = ok ? story.copiedLabel : story.copyButton; });
        });
      }
      return [shareButton, button(story.phoneSkipButton, function () { finish(false); })];
    }

    function showRequest() {
      plate.classList.remove("alert");
      title.textContent = MG.story.archetypeNames[opts.archetype] || "";
      avatar.src = "assets/badges/" + opts.archetype + ".webp";
      avatar.hidden = false;
      text.textContent = fill(story.replies[opts.archetype] || "", name);
      dispatcher.textContent = story.dispatcher;
      dispatcher.hidden = false;
      removeExtras();
      form.hidden = true;
      if (!url) return setActions([button(story.skipButton, function () { finish(false); })]);
      if (MG.ui.isPhone()) {
        var note = MG.ui.el("p", "bridge-extra bridge-note", story.phoneText);
        var link = MG.ui.el("p", "bridge-extra bridge-link", url);
        scroll.appendChild(note);
        scroll.appendChild(link);
        return setActions(phoneButtons());
      }
      setActions([openLink(), button(story.skipButton, function () { finish(false); })]);
    }

    function showCode() {
      if (done) return;
      removeExtras();
      avatar.hidden = true;
      title.textContent = story.badgeTitle;
      text.textContent = story.codeHint;
      dispatcher.hidden = true;
      form.hidden = false;
      error.hidden = true;
      input.value = "";
      setActions([button(story.codeButton, submitCode), button(story.codeSkip, function () { finish(false); })]);
      input.focus({ preventScroll: true });
    }

    function showSuccess() {
      form.hidden = true;
      plate.classList.add("ok");
      title.textContent = story.badgeTitle;
      text.textContent = fill(story.codeOk, name);
      if (!MG.ui.reducedMotion) {
        flash.classList.remove("on");
        void flash.offsetWidth; // restart the animation
        flash.classList.add("on");
        setTimeout(function () { flash.classList.remove("on"); }, FLASH_MS);
      }
      setActions([button(story.boardButton, function () { finish(true); })]);
    }

    function submitCode() {
      if (MG.engine.bridgeWordMatches(input.value, opts.wordHash)) return showSuccess();
      error.textContent = story.codeWrong;
      error.hidden = false;
      input.focus({ preventScroll: true });
    }

    form.onsubmit = function (e) { e.preventDefault(); submitCode(); };
    showAlert();
  }

  MG.screens.bridge = { run: run };
})(window.MG);
