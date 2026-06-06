// Reduces HP on the target. Clamps at 0 (M3 will introduce death; for now zero is the floor
// so a bug doesn't silently let HP go negative).
// target defaults to user when omitted (e.g. drinking a hostile potion).
export function effectDamage(user, target, params, _level, _registry) {
  const subject = target ?? user;
  const health = subject.components.get('health');
  if (!health) return;
  health.current = Math.max(0, health.current - (params.amount ?? 0));
}
