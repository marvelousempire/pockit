/** Compat alias — canonical resolver is pockit-weave.js */
(function (global) {
  if (global.PockitWeave) global.LaunchpadWeave = global.PockitWeave;
})(typeof window !== "undefined" ? window : globalThis);