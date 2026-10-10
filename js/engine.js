/* Pure game rules: no DOM, no timers. Works in the browser (MG.engine) and in Node (tests). */
(function (root) {
  "use strict";

  var HEROES = ["nikolay", "robonya", "baragozin"];
  var OUTCOMES = HEROES.concat(["goose", "chaos", "afk"]);
  var FINAL_KEYS = ["goose_true", "cabbage", "anarchist", "saboteur", "passive_anarchist",
    "cringe_veggie", "samodelkin", "nikolay", "robonya", "baragozin"];
  var MAX_NAME_LENGTH = 24;
  var SCENES_TOTAL = 3;

  function createState() {
    return {
      counter_nikolay: 0, counter_robonya: 0, counter_baragozin: 0,
      counter_goose: 0, counter_afk: 0, counter_chaos: 0,
      lastHero: "", // the hero who won the most recent scene: decides a tie in the final
      currentScene: "start_screen", playerName: "", finalArchetype: "",
      currentInventory: [], sandboxStartTime: 0, sandboxTotalTime: 0
    };
  }

  /** What one scene turns into, given the tags the player picked (spec 1.3 plus the agreed extras). */
  function resolveOutcome(inventory) {
    if (!inventory.length) return "afk";
    var heroes = inventory.filter(function (tag) { return tag !== "goose"; });
    if (!heroes.length) return "goose"; // the goose only counts when no hero was picked
    var counts = {};
    heroes.forEach(function (tag) { counts[tag] = (counts[tag] || 0) + 1; });
    var kinds = Object.keys(counts);
    if (heroes.length >= 2 && kinds.length === heroes.length) return "chaos"; // all different
    return kinds.reduce(function (best, tag) { return counts[tag] > counts[best] ? tag : best; });
  }

  function applyOutcome(state, outcome) {
    if (OUTCOMES.indexOf(outcome) === -1) throw new Error("Unknown outcome: " + outcome);
    var next = Object.assign({}, state, { currentInventory: [] });
    next["counter_" + outcome] = state["counter_" + outcome] + 1;
    if (HEROES.indexOf(outcome) !== -1) next.lastHero = outcome;
    return next;
  }

  /** Final screen key. Checks run top to bottom, the first match wins (spec section 4). */
  function determineFinal(state) {
    var s = state;
    if (s.counter_goose === 3) return "goose_true";
    if (s.counter_afk === 3) return "cabbage";
    if (s.counter_chaos === 3) return "anarchist";
    var vinaigrette = s.counter_chaos === 1 && s.counter_goose === 1 && s.counter_afk === 1;
    if (s.counter_goose + s.counter_chaos === 3 || vinaigrette) return "saboteur";
    if (s.counter_afk + s.counter_chaos === 3) return "passive_anarchist";
    if (s.counter_goose + s.counter_afk === 3) return "cringe_veggie";
    if (s.counter_nikolay === 1 && s.counter_robonya === 1 && s.counter_baragozin === 1) return "samodelkin";
    var top = Math.max(s.counter_nikolay, s.counter_robonya, s.counter_baragozin);
    var leaders = HEROES.filter(function (hero) { return s["counter_" + hero] === top; });
    // A tie goes to the hero who won the latest scene; without that record the list order decides.
    return leaders.indexOf(s.lastHero) !== -1 ? s.lastHero : leaders[0];
  }

  function formatTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var seconds = total % 60;
    return Math.floor(total / 60) + ":" + (seconds < 10 ? "0" : "") + seconds;
  }

  function cleanName(raw) {
    if (typeof raw !== "string") return "";
    return raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_NAME_LENGTH);
  }

  /**
   * Phrases in random order without repeats: every phrase is shown once before any comes again,
   * and the first phrase of a new round never equals the last one of the previous round.
   * @param {string[]} phrases
   * @param {function(): number} [random] returns [0, 1)
   * @returns {function(): string} next phrase
   */
  function createPhraseBag(phrases, random) {
    var rnd = random || Math.random;
    var queue = [];
    var last = null;
    function refill() {
      var round = phrases.slice();
      for (var i = round.length - 1; i > 0; i--) {
        var j = Math.floor(rnd() * (i + 1));
        var tmp = round[i]; round[i] = round[j]; round[j] = tmp;
      }
      if (round.length > 1 && round[0] === last) { round.push(round.shift()); }
      queue = round;
    }
    return function next() {
      if (queue.length === 0) refill();
      last = queue.shift();
      return last;
    };
  }

  var api = {
    HEROES: HEROES, OUTCOMES: OUTCOMES, FINAL_KEYS: FINAL_KEYS, MAX_NAME_LENGTH: MAX_NAME_LENGTH,
    SCENES_TOTAL: SCENES_TOTAL, createState: createState, resolveOutcome: resolveOutcome,
    applyOutcome: applyOutcome, determineFinal: determineFinal, formatTime: formatTime, cleanName: cleanName, createPhraseBag: createPhraseBag
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.MG = root.MG || {}; root.MG.engine = api; }
})(typeof window !== "undefined" ? window : globalThis);
