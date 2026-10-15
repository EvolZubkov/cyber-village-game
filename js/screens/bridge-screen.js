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

  function artUrl() { return "assets/bridge/" + MG.ui.variant().prefix + "glitch.webp"; }

  /** Pictures to load before the screen is shown (both orientations, the phone may turn). */
  function preloadUrls() { return ["assets/bridge/glitch.webp", "assets/bridge/m_glitch.webp", "assets/badges/repairman.webp"]; }

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
    var stopWatching = null;
    var art = root.querySelector(".bridge-bg");
    function applyArt() {
      art.style.backgroundImage = "url(\"" + artUrl() + "\")";
      if (stopWatching) stopWatching();
      stopWatching = MG.ui.watchVariant(MG.ui.variant().portrait, applyArt);
    }
    applyArt();
    plate.classList.remove("alert", "ok");
    plate.classList.add("alert");
    root.querySelector("label[for=bridge-code]").textContent = story.codeLabel;

    function finish(bonus) {
      if (done) return;
      done = true;
      if (stopWatching) stopWatching();
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
      link.target = "skilum-trainer";
      // No noopener on purpose: the trainer's "back to the game" button uses window.opener to return to this tab.
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
      setActions([openLink()]);
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
      setActions([button(story.demoButton, showDemoForm), button(story.boardButton, function () { finish(true); })]);
    }

    /** Check boxes with the demos the player wants and one free-text contact line. */
    function demoField(id, label) {
      var row = MG.ui.el("label", "bridge-check");
      var box = MG.ui.el("input");
      box.type = "checkbox";
      box.value = id;
      row.appendChild(box);
      row.appendChild(MG.ui.el("span", "", label));
      return row;
    }

    function showDemoForm() {
      removeExtras();
      form.hidden = true;
      title.textContent = story.demoTitle;
      text.textContent = story.demoText;
      var box = MG.ui.el("form", "bridge-extra bridge-demo");
      box.autocomplete = "off";
      Object.keys(story.demos).forEach(function (id) { box.appendChild(demoField(id, story.demos[id])); });
      var who = MG.ui.el("label", "", story.demoContactLabel);
      var contact = MG.ui.el("input");
      contact.type = "text";
      contact.maxLength = MG.engine.MAX_CONTACT_LENGTH;
      contact.placeholder = story.demoContactHint;
      contact.setAttribute("aria-label", story.demoContactLabel);
      who.appendChild(contact);
      var problem = MG.ui.el("p", "bridge-error");
      problem.hidden = true;
      box.appendChild(who);
      box.appendChild(problem);
      scroll.appendChild(box);

      function submitDemo() {
        var chosen = Array.prototype.filter.call(box.querySelectorAll("input[type=checkbox]"), function (c) { return c.checked; })
          .map(function (c) { return c.value; });
        var signup = { contact: contact.value, demos: chosen };
        if (!MG.engine.cleanSignup(signup)) {
          problem.textContent = chosen.length ? story.demoNoContact : story.demoNoChoice;
          problem.hidden = false;
          return;
        }
        problem.hidden = true;
        send.disabled = true;
        MG.signups.submit(signup, { name: opts.name, archetype: opts.archetype }).then(function () {
          removeExtras();
          text.textContent = fill(story.demoThanks, name);
          setActions([button(story.boardButton, function () { finish(true); })]);
        }, function () {
          send.disabled = false;
          problem.textContent = story.demoFailed;
          problem.hidden = false;
        });
      }

      var send = button(story.demoSend, submitDemo);
      box.onsubmit = function (e) { e.preventDefault(); submitDemo(); };
      setActions([send, button(story.demoBack, showSuccess)]);
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

  MG.screens.bridge = { run: run, preloadUrls: preloadUrls };
})(window.MG);
