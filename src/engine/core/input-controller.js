/**
 * Creates the input controller that bridges player input events to the async turn loop.
 * The turn loop calls `waitForInput()` and suspends; when the player acts (tap, keypress,
 * etc.), `submit(action)` resolves the pending promise. Inputs submitted while no one is
 * waiting are buffered (one slot) so taps during auto-move aren't silently dropped.
 */
export function createInputController() {
  let resolvePending = null;
  let pending = null;
  let buffered = null;

  function waitForInput() {
    if (buffered !== null) {
      const value = buffered;
      buffered = null;
      return Promise.resolve(value);
    }
    if (!pending) {
      pending = new Promise((resolve) => {
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
    } else {
      buffered = action;
    }
  }

  // True when the turn loop is waiting for player input.
  function isWaiting() {
    return resolvePending !== null;
  }

  // True when an input was submitted while no one was waiting.
  function hasPendingInput() {
    return buffered !== null;
  }

  return { waitForInput, submit, isWaiting, hasPendingInput };
}
