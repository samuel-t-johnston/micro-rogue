// Bridges player input events to the async turn loop.
// The turn loop calls waitForInput() and suspends. When the player acts
// (tap, keypress, etc.), submit(action) resolves the pending promise.
export function createInputController() {
  let resolvePending = null;
  let pending = null;

  function waitForInput() {
    if (!pending) {
      pending = new Promise(resolve => {
        resolvePending = resolve;
      });
    }
    return pending;
  }

  function submit(action) {
    if (resolvePending) {
      const resolve = resolvePending;
      resolvePending = null;
      pending = null;
      resolve(action);
    }
  }

  // True when the turn loop is waiting for player input.
  function isWaiting() {
    return resolvePending !== null;
  }

  return { waitForInput, submit, isWaiting };
}
