/* Leaderboard storage: Firebase Realtime Database over its REST API, or this device only (demo mode).
 *
 * An entry is { name, archetype, time (ms), timestamp, bonus? }. bonus (the bridge badge) is set later by markBonus. Everything that comes back from the server
 * is checked before it is shown, because anyone with the link can write to the table.
 */
window.MG = window.MG || {};
(function (MG) {
  "use strict";

  var LOCAL_KEY = "mars-census-leaderboard";
  var REQUEST_TIMEOUT_MS = 8000;
  var MAX_LOCAL_ENTRIES = 200;
  var ARCHETYPES = ["nikolay", "robonya", "baragozin", "cabbage", "anarchist",
    "samodelkin", "saboteur", "passive_anarchist", "cringe_veggie"];

  function dbUrl() {
    return (MG.config.firebaseDatabaseUrl || "").replace(/\/+$/, "");
  }

  function isServerMode() { return dbUrl() !== ""; }

  /** Returns a clean entry or null when the data cannot be trusted. */
  function validEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    var name = MG.engine.cleanName(raw.name);
    var time = Number(raw.time);
    var timestamp = Number(raw.timestamp);
    if (!name || !isFinite(time) || time <= 0 || time > 24 * 3600 * 1000) return null;
    if (ARCHETYPES.indexOf(raw.archetype) === -1) return null;
    return { name: name, archetype: raw.archetype, time: Math.round(time), timestamp: isFinite(timestamp) ? timestamp : 0, bonus: raw.bonus === true };
  }

  function sortFastestFirst(entries) {
    return entries.slice().sort(function (a, b) { return a.time - b.time || a.timestamp - b.timestamp; });
  }

  function withTimeout(promise) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error("timeout")); }, REQUEST_TIMEOUT_MS);
      promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }

  function readLocal() {
    try {
      var list = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      return Array.isArray(list) ? list.map(validEntry).filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function writeLocal(entry) {
    try {
      var list = sortFastestFirst(readLocal().concat([entry])).slice(0, MAX_LOCAL_ENTRIES);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    } catch (e) {
      // Private mode or full storage: the result simply is not kept.
    }
  }

  /** Gives the bridge badge to the stored result (same name, time and timestamp) kept on this device. */
  function markLocalBonus(entry) {
    try {
      var list = readLocal().map(function (item) {
        var same = item.name === entry.name && item.time === entry.time && item.timestamp === entry.timestamp;
        return same ? Object.assign({}, item, { bonus: true }) : item;
      });
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    } catch (e) {
      // Nothing to mark when storage is unavailable.
    }
  }

  /** Forgets every result kept on this device (the server table is cleared with tools/clear_leaderboard.py). */
  function clearLocal() {
    try { localStorage.removeItem(LOCAL_KEY); } catch (e) { /* nothing to clear */ }
  }

  /**
   * Saves one result. Resolves { mode: "server" | "local" | "local-fallback", id? }; server errors fall back to local.
   * id is the server key of the new row, needed later by markBonus.
   * With options.localOnly the result stays on this device (test runs must not reach the shared table).
   */
  function submit(entry, options) {
    var clean = validEntry(entry);
    if (!clean) return Promise.reject(new Error("invalid entry"));
    if (!isServerMode() || (options && options.localOnly)) {
      writeLocal(clean);
      return Promise.resolve({ mode: "local" });
    }
    return withTimeout(fetch(dbUrl() + "/leaderboard.json", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clean)
    })).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json().then(function (body) { return { mode: "server", id: body && typeof body.name === "string" ? body.name : "" }; });
    }).catch(function () {
      writeLocal(clean);
      return { mode: "local-fallback" };
    });
  }

  /**
   * Gives the "repairman" badge to a stored result. result is what submit resolved with, entry is what was submitted.
   * Server rows may only turn bonus from false to true (see tools/firebase-rules.json). Never rejects.
   */
  function markBonus(entry, result) {
    var clean = validEntry(entry);
    if (!clean) return Promise.resolve(false);
    if (!result || result.mode !== "server" || !result.id) {
      markLocalBonus(clean);
      return Promise.resolve(true);
    }
    return withTimeout(fetch(dbUrl() + "/leaderboard/" + encodeURIComponent(result.id) + "/bonus.json", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: "true"
    })).then(function (res) { return res.ok; }).catch(function () { return false; });
  }

  function parseServerTable(json) {
    if (!json || typeof json !== "object") return [];
    return Object.keys(json).map(function (id) { return validEntry(json[id]); }).filter(Boolean);
  }

  function fetchTable(url) {
    return withTimeout(fetch(url)).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  /** The fastest results, best first. Resolves { entries, mode }. */
  function top(limit) {
    var size = limit || MG.config.leaderboardSize;
    if (!isServerMode()) {
      return Promise.resolve({ entries: sortFastestFirst(readLocal()).slice(0, size), mode: "local" });
    }
    var indexed = dbUrl() + "/leaderboard.json?orderBy=%22time%22&limitToFirst=" + size;
    return fetchTable(indexed).catch(function () {
      return fetchTable(dbUrl() + "/leaderboard.json"); // no index defined: sort here instead
    }).then(function (json) {
      return { entries: sortFastestFirst(parseServerTable(json)).slice(0, size), mode: "server" };
    }).catch(function () {
      return { entries: sortFastestFirst(readLocal()).slice(0, size), mode: "local-fallback" };
    });
  }

  MG.leaderboard = { clearLocal: clearLocal, submit: submit, markBonus: markBonus, top: top, validEntry: validEntry, isServerMode: isServerMode, ARCHETYPES: ARCHETYPES };
})(window.MG);
