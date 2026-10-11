/* Final table: the 10 fastest players, the player's own row highlighted. */
window.MG = window.MG || {};
MG.screens = MG.screens || {};
(function (MG) {
  "use strict";

  var MODE_NOTES = {
    local: "Демо-режим: результаты сохраняются только на этом телефоне.",
    "local-fallback": "Нет связи с сервером: показаны результаты только с этого телефона."
  };

  function row(rank, entry, mine) {
    var tr = MG.ui.el("tr", mine ? "mine" : "");
    tr.appendChild(MG.ui.el("td", "rank", String(rank)));
    var badgeCell = MG.ui.el("td", "badge-cell");
    var badge = MG.ui.el("img", "lb-badge");
    badge.src = "assets/badges/" + entry.archetype + ".webp";
    badge.alt = MG.story.archetypeNames[entry.archetype] || "";
    badge.width = 40;
    badge.height = 40;
    badgeCell.appendChild(badge);
    tr.appendChild(badgeCell);
    var nameCell = MG.ui.el("td", "lb-name", entry.name); // textContent: names come from other players
    if (entry.bonus) {
      var bonus = MG.ui.el("span", "lb-bonus", "🛠️");
      bonus.title = MG.story.bridge.badgeTitle;
      bonus.setAttribute("aria-label", MG.story.bridge.badgeTitle);
      nameCell.appendChild(bonus);
    }
    tr.appendChild(nameCell);
    tr.appendChild(MG.ui.el("td", "lb-time", MG.engine.formatTime(entry.time)));
    return tr;
  }

  /**
   * @param {{entry?: {name: string, archetype: string, time: number, timestamp: number}}} opts
   */
  function run(opts) {
    var root = MG.ui.showScreen("leaderboard");
    var body = root.querySelector("tbody");
    var note = root.querySelector(".lb-note");
    var status = root.querySelector(".lb-status");
    MG.ui.clear(body);
    note.textContent = "";
    status.textContent = "Загружаем таблицу…";
    root.querySelector(".lb-outro").textContent = MG.story.sandbox.outro;

    var mine = opts.entry ? MG.leaderboard.validEntry(opts.entry) : null; // same rounding as the stored row
    var mineShown = false;
    MG.leaderboard.top().then(function (result) {
      status.textContent = result.entries.length ? "" : "Пока здесь пусто. Ты первый!";
      result.entries.forEach(function (entry, i) {
        var isMine = !!mine && !mineShown && entry.timestamp === mine.timestamp && entry.name === mine.name && entry.time === mine.time;
        if (isMine) mineShown = true;
        body.appendChild(row(i + 1, entry, isMine));
      });
      note.textContent = MODE_NOTES[result.mode] || "";
      if (mine && !mineShown) {
        status.textContent = "Твой результат: " + MG.engine.formatTime(mine.time) + ". До первой десятки не хватило совсем чуть-чуть.";
      }
    });
  }

  MG.screens.leaderboard = { run: run };
})(window.MG);
