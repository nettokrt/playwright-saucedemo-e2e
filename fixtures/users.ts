// SauceDemo accepts a fixed set of accounts, all sharing the same password.
// Several are seeded with known, intentional bugs so scenarios can target a
// specific broken behavior (locked out, broken images, slow inventory, etc).
export const PASSWORD = 'secret_sauce';

export const USERS = {
  standard: 'standard_user',
  lockedOut: 'locked_out_user',
  problem: 'problem_user',
  performanceGlitch: 'performance_glitch_user',
  error: 'error_user',
  visual: 'visual_user',
} as const;

export type UserKey = keyof typeof USERS;
