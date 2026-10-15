/* Demo-day sign-ups: Firebase Realtime Database over REST (table "demoSignups"), or this device only (demo mode).
 *
 * A row is { contact, skilum, botapp, player, archetype, timestamp }. The table is write-only for visitors
 * (see tools/firebase-rules.json): contacts are read in the Firebase console, never from the game.
 */
window.MG = window.MG || {};
(function (MG) {
  "use strict";

  var LOCAL_KEY = "mars-census-signups";
  var REQUEST_TIMEOUT_MS = 8000;
  var MAX_LOCAL_ENTRIES = 50;

  function dbUrl() { return (MG.config.firebaseDatabaseUrl || "").replace(/\/+$/, ""); }

  function writeLocal(row) {
    try {
      var list = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      list = (Array.isArray(list) ? list : []).concat([row]).slice(-MAX_LOCAL_ENTRIES);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    } catch (e) {
      // Private mode or full storage: the sign-up is simply not kept on the device.
    }
  }

  /**
   * Saves one sign-up. signup is { contact, demos: [ids] }, player is { name, archetype }.
   * Resolves { mode: "server" | "local" } and rejects when the data is invalid or the server did not take the row
   * (the form then lets the player try again).
   */
  function submit(signup, player) {
    var clean = MG.engine.cleanSignup(signup);
    if (!clean) return Promise.reject(new Error("invalid sign-up"));
    var row = Object.assign({}, clean, {
      player: MG.engine.cleanName(player && player.name),
      archetype: player && typeof player.archetype === "string" ? player.archetype : "",
      timestamp: Date.now()
    });
    if (!dbUrl()) {
      writeLocal(row);
      return Promise.resolve({ mode: "local" });
    }
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error("timeout")); }, REQUEST_TIMEOUT_MS);
      fetch(dbUrl() + "/demoSignups.json", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(row)
      }).then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error("HTTP " + res.status);
        resolve({ mode: "server" });
      }).catch(function (e) { clearTimeout(timer); reject(e); });
    });
  }

  MG.signups = { submit: submit };
})(window.MG);
