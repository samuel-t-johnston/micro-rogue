// Does nothing and consumes the entity's turn. Returns false (not a free action)
// so the turn loop advances — a free action would re-run the actor immediately.
export function executeWait() {
  return false;
}
