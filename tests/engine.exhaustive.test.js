/* Exhaustive checks of the rules in global_scen.md (sections 1.3 and 4): every possible pick set of a
 * scene and every possible combination of three scene outcomes. The expected values are written
 * separately from engine.js, from the spec text, so a slip in one place shows up as a difference.
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");

const HEROES = ["nikolay", "robonya", "baragozin"];
const SCENE_ITEMS = [
  ...HEROES.flatMap((h) => [h, h, h]), // three items per hero
  "goose"
]; // 10 items, each can be taken once

function pickSets() {
  const sets = [[]];
  const n = SCENE_ITEMS.length;
  for (let a = 0; a < n; a++) {
    sets.push([a]);
    for (let b = a + 1; b < n; b++) {
      sets.push([a, b]);
      for (let c = b + 1; c < n; c++) sets.push([a, b, c]);
    }
  }
  return sets;
}

/** Expected outcome written from the spec's own wording. */
function expectedOutcome(tags) {
  if (tags.length === 0) return "afk";
  const heroTags = tags.filter((t) => t !== "goose");
  if (heroTags.length === 0) return "goose";
  const counts = HEROES.map((h) => heroTags.filter((t) => t === h).length);
  const kinds = counts.filter((c) => c > 0).length;
  if (kinds >= 2 && Math.max(...counts) === 1) return "chaos"; // 1+1 or 1+1+1 of different heroes
  return HEROES[counts.indexOf(Math.max(...counts))]; // 1, 2, 3 of one hero, or 2+1
}

test("176 possible pick sets: outcome matches the spec", () => {
  const sets = pickSets();
  assert.equal(sets.length, 1 + 10 + 45 + 120);
  for (const indexes of sets) {
    const tags = indexes.map((i) => SCENE_ITEMS[i]);
    assert.equal(E.resolveOutcome(tags), expectedOutcome(tags), tags.join(","));
  }
});

test("spec examples for one scene", () => {
  const cases = [
    [[], "afk"],
    [["goose"], "goose"],
    [["nikolay"], "nikolay"],
    [["nikolay", "nikolay"], "nikolay"],
    [["nikolay", "nikolay", "nikolay"], "nikolay"],
    [["nikolay", "nikolay", "robonya"], "nikolay"], // 2 + 1: the larger one wins
    [["robonya", "baragozin", "baragozin"], "baragozin"],
    [["nikolay", "robonya", "baragozin"], "chaos"],
    [["nikolay", "baragozin"], "chaos"], // partial AFK, two different heroes
    [["nikolay", "goose"], "nikolay"], // hero + goose: hero wins
    [["nikolay", "nikolay", "goose"], "nikolay"],
    [["nikolay", "robonya", "goose"], "chaos"], // two heroes + goose
    [["goose", "baragozin"], "baragozin"]
  ];
  for (const [tags, outcome] of cases) assert.equal(E.resolveOutcome(tags), outcome, tags.join(","));
});

function counterCombos() {
  const keys = E.OUTCOMES;
  const out = [];
  for (const a of keys) for (const b of keys) for (const c of keys) out.push([a, b, c]);
  return out;
}

function playOutcomes(outcomes) {
  return outcomes.reduce((state, outcome) => E.applyOutcome(state, outcome), E.createState());
}

/** Expected final from section 4: first matching rule wins. */
function expectedFinal(s, outcomes) {
  const heroPoints = { nikolay: s.counter_nikolay, robonya: s.counter_robonya, baragozin: s.counter_baragozin };
  const rules = [
    [s.counter_goose === 3, "goose_true"],
    [s.counter_afk === 3, "cabbage"],
    [s.counter_chaos === 3, "anarchist"],
    [s.counter_goose + s.counter_chaos === 3, "saboteur"],
    [s.counter_goose === 1 && s.counter_chaos === 1 && s.counter_afk === 1, "saboteur"], // vinaigrette
    [s.counter_afk + s.counter_chaos === 3, "passive_anarchist"],
    [s.counter_goose + s.counter_afk === 3, "cringe_veggie"],
    [heroPoints.nikolay === 1 && heroPoints.robonya === 1 && heroPoints.baragozin === 1, "samodelkin"]
  ];
  for (const [matches, key] of rules) if (matches) return key;
  const top = Math.max(...Object.values(heroPoints));
  const tied = HEROES.filter((h) => heroPoints[h] === top);
  const lastWinner = [...outcomes].reverse().find((o) => HEROES.includes(o)); // a tie goes to the latest scene winner
  return tied.includes(lastWinner) ? lastWinner : tied[0];
}

test("216 outcome combinations: counters sum to 3 and the final matches the spec", () => {
  for (const outcomes of counterCombos()) {
    const state = playOutcomes(outcomes);
    const total = E.OUTCOMES.reduce((sum, o) => sum + state["counter_" + o], 0);
    assert.equal(total, 3, outcomes.join(","));
    assert.equal(E.determineFinal(state), expectedFinal(state, outcomes), outcomes.join(","));
  }
});

test("hand-checked finals", () => {
  const cases = [
    [["goose", "goose", "goose"], "goose_true"],
    [["afk", "afk", "afk"], "cabbage"],
    [["chaos", "chaos", "chaos"], "anarchist"],
    [["goose", "goose", "chaos"], "saboteur"],
    [["goose", "chaos", "chaos"], "saboteur"],
    [["goose", "chaos", "afk"], "saboteur"], // vinaigrette
    [["afk", "afk", "chaos"], "passive_anarchist"],
    [["afk", "chaos", "chaos"], "passive_anarchist"],
    [["goose", "goose", "afk"], "cringe_veggie"],
    [["goose", "afk", "afk"], "cringe_veggie"],
    [["nikolay", "robonya", "baragozin"], "samodelkin"],
    [["nikolay", "nikolay", "robonya"], "nikolay"],
    [["robonya", "robonya", "afk"], "robonya"],
    [["baragozin", "afk", "goose"], "baragozin"],
    [["nikolay", "robonya", "afk"], "robonya"], // tie: the latest scene winner
    [["robonya", "nikolay", "afk"], "nikolay"],
    [["robonya", "baragozin", "chaos"], "baragozin"],
    [["baragozin", "afk", "robonya"], "robonya"],
    [["baragozin", "baragozin", "baragozin"], "baragozin"]
  ];
  for (const [outcomes, key] of cases) assert.equal(E.determineFinal(playOutcomes(outcomes)), key, outcomes.join(","));
});
