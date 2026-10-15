"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");

test("empty inventory is AFK", () => {
  assert.equal(E.resolveOutcome([]), "afk");
});

test("only the goose gives the goose outcome", () => {
  assert.equal(E.resolveOutcome(["goose"]), "goose");
});

test("three different heroes make chaos", () => {
  assert.equal(E.resolveOutcome(["nikolay", "robonya", "baragozin"]), "chaos");
});

test("two different heroes (partial AFK) make chaos", () => {
  assert.equal(E.resolveOutcome(["nikolay", "baragozin"]), "chaos");
});

test("two or three items of one hero win for that hero", () => {
  assert.equal(E.resolveOutcome(["robonya", "robonya"]), "robonya");
  assert.equal(E.resolveOutcome(["baragozin", "baragozin", "baragozin"]), "baragozin");
});

test("one hero item at timeout wins for that hero", () => {
  assert.equal(E.resolveOutcome(["nikolay"]), "nikolay");
});

test("2 + 1 split goes to the hero with more items", () => {
  assert.equal(E.resolveOutcome(["nikolay", "nikolay", "robonya"]), "nikolay");
  assert.equal(E.resolveOutcome(["robonya", "baragozin", "baragozin"]), "baragozin");
});

test("the goose never beats a hero", () => {
  assert.equal(E.resolveOutcome(["nikolay", "goose"]), "nikolay");
  assert.equal(E.resolveOutcome(["baragozin", "baragozin", "goose"]), "baragozin");
});

test("two heroes plus the goose make chaos", () => {
  assert.equal(E.resolveOutcome(["nikolay", "robonya", "goose"]), "chaos");
});

test("applyOutcome returns a new state and leaves the old one untouched", () => {
  const before = E.createState();
  const after = E.applyOutcome(before, "goose");
  assert.equal(before.counter_goose, 0);
  assert.equal(after.counter_goose, 1);
  assert.notEqual(before, after);
});

test("applyOutcome rejects an unknown outcome", () => {
  assert.throws(() => E.applyOutcome(E.createState(), "nope"));
});

function finalFor(outcomes) {
  return E.determineFinal(outcomes.reduce(E.applyOutcome, E.createState()));
}

test("final: three geese", () => assert.equal(finalFor(["goose", "goose", "goose"]), "goose_true"));
test("final: three AFK", () => assert.equal(finalFor(["afk", "afk", "afk"]), "cabbage"));
test("final: three chaos", () => assert.equal(finalFor(["chaos", "chaos", "chaos"]), "anarchist"));
test("final: goose + chaos", () => {
  assert.equal(finalFor(["goose", "goose", "chaos"]), "saboteur");
  assert.equal(finalFor(["goose", "chaos", "chaos"]), "saboteur");
});
test("final: afk + chaos", () => {
  assert.equal(finalFor(["afk", "afk", "chaos"]), "passive_anarchist");
  assert.equal(finalFor(["afk", "chaos", "chaos"]), "passive_anarchist");
});
test("final: goose + afk", () => {
  assert.equal(finalFor(["goose", "goose", "afk"]), "cringe_veggie");
  assert.equal(finalFor(["goose", "afk", "afk"]), "cringe_veggie");
});
test("final: the vinaigrette (one chaos, one goose, one afk) is the saboteur", () => {
  assert.equal(finalFor(["chaos", "goose", "afk"]), "saboteur");
});
test("final: one win for each hero is the combo", () => {
  assert.equal(finalFor(["nikolay", "robonya", "baragozin"]), "samodelkin");
});
test("final: the hero with most wins", () => {
  assert.equal(finalFor(["nikolay", "nikolay", "robonya"]), "nikolay");
  assert.equal(finalFor(["robonya", "robonya", "afk"]), "robonya");
  assert.equal(finalFor(["baragozin", "chaos", "baragozin"]), "baragozin");
});
test("final: a hero beats goose and afk noise", () => {
  assert.equal(finalFor(["nikolay", "goose", "goose"]), "nikolay");
  assert.equal(finalFor(["robonya", "afk", "chaos"]), "robonya");
});
test("final: a tie goes to the hero who won the latest scene", () => {
  assert.equal(finalFor(["nikolay", "robonya", "goose"]), "robonya");
  assert.equal(finalFor(["robonya", "baragozin", "afk"]), "baragozin");
  assert.equal(finalFor(["baragozin", "robonya", "afk"]), "robonya");
});

test("every one of the 216 scene combinations has a final", () => {
  const outcomes = ["nikolay", "robonya", "baragozin", "goose", "chaos", "afk"];
  const known = new Set(E.FINAL_KEYS);
  for (const a of outcomes) for (const b of outcomes) for (const c of outcomes) {
    assert.ok(known.has(finalFor([a, b, c])), `${a},${b},${c}`);
  }
});

test("formatTime shows minutes and seconds", () => {
  assert.equal(E.formatTime(0), "0:00");
  assert.equal(E.formatTime(84250), "1:24");
  assert.equal(E.formatTime(61000), "1:01");
  assert.equal(E.formatTime(600000), "10:00");
});

test("cleanName trims, strips control characters and caps length", () => {
  assert.equal(E.cleanName("  Иван  "), "Иван");
  assert.equal(E.cleanName("a\u0000b\nc"), "abc");
  assert.equal(E.cleanName("x".repeat(40)).length, E.MAX_NAME_LENGTH);
  assert.equal(E.cleanName(undefined), "");
});

test("phrase bag shows every phrase once per round and never repeats back to back", () => {
  const phrases = ["a", "b", "c", "d"];
  const next = E.createPhraseBag(phrases, () => 0.3);
  let previous = null;
  for (let round = 0; round < 5; round++) {
    const seen = [];
    for (let i = 0; i < phrases.length; i++) {
      const phrase = next();
      assert.notEqual(phrase, previous);
      previous = phrase;
      seen.push(phrase);
    }
    assert.deepEqual([...seen].sort(), phrases);
  }
});

test("phrase bag with a single phrase keeps returning it", () => {
  const next = E.createPhraseBag(["only"]);
  assert.equal(next(), "only");
  assert.equal(next(), "only");
});

test("bridge word is compared without case, spaces, punctuation and the e/yo difference", () => {
  assert.equal(E.normalizeBridgeWord("  Изолента "), "ИЗОЛЕНТА");
  assert.equal(E.normalizeBridgeWord("изол ё нта!"), "ИЗОЛЕНТА");
  assert.equal(E.normalizeBridgeWord(null), "");
  assert.equal(E.normalizeBridgeWord(42), "");
});

test("bridge word matches only its own hash", () => {
  const hash = E.hashBridgeWord("ИЗОЛЕНТА");
  assert.equal(typeof hash, "string");
  assert.equal(E.bridgeWordMatches("изолента", hash), true);
  assert.equal(E.bridgeWordMatches(" ИЗОЛЁНТА ", hash), true);
  assert.equal(E.bridgeWordMatches("изолента2", hash), false);
  assert.equal(E.bridgeWordMatches("", hash), false);
  assert.equal(E.bridgeWordMatches("изолента", ""), false);
  assert.equal(E.bridgeWordMatches(undefined, hash), false);
});

test("the hash stored in config.js stays the hash of the agreed word", () => {
  assert.equal(E.hashBridgeWord("ИЗОЛЕНТА"), "12mxmo2ldul");
});

test("demo sign-up needs a contact and at least one demo", () => {
  assert.deepEqual(E.cleanSignup({ contact: "  Иван, @ivan ", demos: ["skilum", "botapp"] }), { contact: "Иван, @ivan", skilum: true, botapp: true });
  assert.deepEqual(E.cleanSignup({ contact: "a@b.ru", demos: ["botapp"] }), { contact: "a@b.ru", skilum: false, botapp: true });
  assert.equal(E.cleanSignup({ contact: "a@b.ru", demos: [] }), null);
  assert.equal(E.cleanSignup({ contact: "a@b.ru", demos: ["other"] }), null);
  assert.equal(E.cleanSignup({ contact: "   ", demos: ["skilum"] }), null);
  assert.equal(E.cleanSignup({ demos: ["skilum"] }), null);
  assert.equal(E.cleanSignup(null), null);
});

test("demo sign-up contact is cut to the limit and loses control characters", () => {
  const clean = E.cleanSignup({ contact: "x".repeat(300) + "\n", demos: ["skilum"] });
  assert.equal(clean.contact.length, E.MAX_CONTACT_LENGTH);
  assert.equal(E.cleanSignup({ contact: "a\u0000b\nc", demos: ["skilum"] }).contact, "abc");
});
