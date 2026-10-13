/* Deployment settings. Fill in the Firebase address to keep the leaderboard on a server.
 *
 * firebaseDatabaseUrl: for example "https://my-project-default-rtdb.europe-west1.firebasedatabase.app"
 *   (no trailing slash). Leave empty to keep results only on this device (demo mode).
 *
 * Realtime Database rules should allow reading and appending, and index the time field:
 *   { "rules": { "leaderboard": {
 *       ".indexOn": ["time"],
 *       ".read": true,
 *       "$id": { ".write": "!data.exists()",
 *                ".validate": "newData.hasChildren(['name','archetype','time','timestamp']) && newData.child('name').isString() && newData.child('name').val().length <= 24 && newData.child('time').isNumber()" }
 *   } } }
 * Anyone with the link can post a result, so treat the table as for fun, not as a verified score.
 */
window.MG = window.MG || {};
window.MG.config = {
  firebaseDatabaseUrl: "https://cyber-village-default-rtdb.asia-southeast1.firebasedatabase.app",
  skilumUrl: "https://test.edtech-rtk.ru/p/733fdb5e20ac2924c9070d48a2d2fdde85a3b4c892e3bdc48ef8d6340f947ed5", // public link to the Skill'Ум trainer; empty = the bridge screen is skipped
  bridgeWordHash: "12mxmo2ldul", // MG.engine.hashBridgeWord of the code word shown at the end of the trainer
  leaderboardSize: 10,
  sceneSeconds: 45,
  maxPicks: 3,
  lockDelayMs: 500,
  crashShakeMs: 5000 // the crash screen shakes this long after its text is typed
};
