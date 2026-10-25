// All distances use the same logical coordinates for drawing and collisions.
export const GRAVITY = .62;
export const JUMP_SPEED = 16.4;
export const COYOTE_TICKS = 6;
export const BUFFER_TICKS = 8;
export function stepPlayer(player, keys, platforms, ground) {
 if (keys.left) { player.vx -= .75; player.facing = -1; }
 if (keys.right) { player.vx += .75; player.facing = 1; }
 player.vx = Math.max(-player.speed, Math.min(player.speed, player.vx));
 if (!keys.left && !keys.right) player.vx *= .82;
 player.coyote = player.grounded ? COYOTE_TICKS : Math.max(0, (player.coyote || 0) - 1);
 player.jumpBuffer = keys.jump ? BUFFER_TICKS : Math.max(0, (player.jumpBuffer || 0) - 1);
 keys.jump = false;
 if (player.jumpBuffer && player.coyote) {
  player.vy = -JUMP_SPEED; player.grounded = false; player.coyote = 0; player.jumpBuffer = 0;
 }
 const feet = player.y + player.h;
 player.vy += GRAVITY; player.x += player.vx; player.y += player.vy; player.grounded = false;
 // Sweep the feet across platform tops, even at high falling speeds.
 const crossed = platforms.filter(p => player.vy >= 0 && player.x < p.x + p.w && player.x + player.w > p.x && feet <= ground - p.y && player.y + player.h >= ground - p.y);
 if (crossed.length) {
  const top = Math.min(...crossed.map(p => ground - p.y));
  player.y = top - player.h; player.vy = 0; player.grounded = true;
 }
}
