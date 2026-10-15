/* Game flow: prologue -> three scenes with cutscenes -> final -> Sandbox -> leaderboard.
 *
 * The game state is never mutated: every step makes a new copy (see engine.js).
 * Developer shortcuts (query string): ?scene=2  ?final=saboteur  ?sandbox=1 (its result stays local)  ?edit=1&scene=1  ?clearboard=1
 */
(function (MG) {
  "use strict";

  MG.layout = window.MG_LAYOUT;
  var state = MG.engine.createState();

  function patch(changes) { state = Object.assign({}, state, changes); }

  /** Shows the loading screen until the pictures are ready, then runs the next step. */
  function afterLoading(urls, next) {
    MG.ui.showScreen("loading");
    MG.ui.preload(urls).then(next);
  }

  function startGame() {
    state = MG.engine.createState();
    patch({ currentScene: "prologue1" });
    afterLoading(MG.screens.story.preloadUrls(), function () {
      MG.screens.story.run({ key: "prologue1", onDone: function () {
        MG.screens.story.run({ key: "prologue2", onDone: function () {
          MG.screens.story.run({ key: "prologue3", onDone: function () { playScene(1); } });
        } });
      } });
    });
  }

  function playScene(n) {
    patch({ currentScene: "scene" + n, currentInventory: [] });
    afterLoading(MG.screens.scene.preloadUrls(n), function () {
      MG.screens.scene.run({ n: n, onEnd: function (tags, indexes) { playCutscene(n, tags, indexes); } });
    });
  }

  function playCutscene(n, tags, indexes) {
    var outcome = MG.engine.resolveOutcome(tags);
    patch(MG.engine.applyOutcome(Object.assign({}, state, { currentInventory: tags }), outcome));
    MG.screens.cutscene.run({
      n: n, outcome: outcome, picks: indexes,
      onDone: function () {
        if (n < MG.engine.SCENES_TOTAL) playScene(n + 1);
        else showFinal(MG.engine.determineFinal(state));
      }
    });
  }

  function showFinal(key) {
    patch({ finalArchetype: key, currentScene: "final" });
    afterLoading(MG.screens.final.preloadUrls(key), function () {
      MG.screens.final.run({ key: key, onRetry: startGame, onPassport: function (name) { startSandbox(name, key); } });
    });
  }

  function startSandbox(name, archetype) {
    patch({ playerName: name, finalArchetype: archetype, currentScene: "sandbox", sandboxStartTime: performance.now() });
    var urls = window.MG_SANDBOX_SCENE.items.map(function (item) { return item.src; });
    afterLoading(urls, function () {
      MG.screens.sandbox.run({ playerName: name, archetype: archetype, onFinish: finishSandbox });
    });
  }

  function finishSandbox(timeMs) {
    patch({ sandboxTotalTime: timeMs });
    var entry = { name: state.playerName, archetype: state.finalArchetype, time: timeMs, timestamp: Date.now() };
    MG.ui.showScreen("loading");
    MG.leaderboard.submit(entry, { localOnly: !!MG.ui.query().sandbox }).catch(function () { /* an invalid entry is simply not stored */ return null; }).then(function (saved) {
      if (!MG.config.skilumUrl) return showLeaderboard(entry);
      showBridge(entry, saved);
    });
  }

  var RESUME_KEY = "mars-census-resume";
  var RESUME_MAX_AGE_MS = 6 * 3600 * 1000;

  /** Remembers the finished run while the player is in the trainer, so "back to the game" can reopen the code screen. */
  function rememberRun(entry, saved) {
    try { localStorage.setItem(RESUME_KEY, JSON.stringify({ entry: entry, saved: saved, at: Date.now() })); } catch (e) { /* no storage: no resume */ }
  }

  function forgetRun() {
    try { localStorage.removeItem(RESUME_KEY); } catch (e) { /* nothing to forget */ }
  }

  /** The run remembered by rememberRun, or null when it is missing, stale or damaged. */
  function recallRun() {
    try {
      var data = JSON.parse(localStorage.getItem(RESUME_KEY) || "null");
      var entry = data && MG.leaderboard.validEntry(data.entry);
      if (!entry || !(Date.now() - Number(data.at) < RESUME_MAX_AGE_MS)) return null;
      return { entry: entry, saved: data.saved && typeof data.saved === "object" ? data.saved : null };
    } catch (e) {
      return null;
    }
  }

  /** Bridge to Skill'Ум: a correct code word gives the saved result the repairman badge before the table opens. */
  function showBridge(entry, saved, startAt) {
    patch({ currentScene: "bridge" });
    rememberRun(entry, saved);
    afterLoading(MG.screens.bridge.preloadUrls(), function () {
      MG.screens.bridge.run({
        name: entry.name, archetype: entry.archetype, url: MG.config.skilumUrl, wordHash: MG.config.bridgeWordHash, startAt: startAt,
        onDone: function (result) {
          forgetRun();
          if (!result.bonus) return showLeaderboard(entry);
          MG.ui.showScreen("loading");
          MG.leaderboard.markBonus(entry, saved).then(function (ok) {
            showLeaderboard(ok ? Object.assign({}, entry, { bonus: true }) : entry);
          });
        }
      });
    });
  }

  function showLeaderboard(entry) {
    patch({ currentScene: "leaderboard" });
    MG.screens.leaderboard.run({ entry: entry });
  }

  function boot() {
    var q = MG.ui.query();
    if (q.clearboard) MG.leaderboard.clearLocal(); // ?clearboard=1 empties the table kept on this device
    if (q.final && MG.engine.FINAL_KEYS.indexOf(q.final) !== -1) return showFinal(q.final);
    if (q.resume === "bridge" && MG.config.skilumUrl) {
      var run = recallRun();
      if (run) return showBridge(run.entry, run.saved, "code"); // back from the trainer: straight to the code word
    }
    if (q.sandbox) return startSandbox("Тестер", q.type || "nikolay");
    if (q.scene && /^[123]$/.test(q.scene)) return playScene(Number(q.scene));
    startGame();
  }

  document.addEventListener("DOMContentLoaded", boot);
})(window.MG);
