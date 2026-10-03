import { SIZE, HEIGHT, WATER } from './world.js';
export const PLAYER_RADIUS = .29, PLAYER_HEIGHT = 1.78, EYE_HEIGHT = 1.62;
export function overlapsBlock(position, x, y, z) {
  return position.x + PLAYER_RADIUS > x && position.x - PLAYER_RADIUS < x + 1 && position.y + PLAYER_HEIGHT > y && position.y < y + 1 && position.z + PLAYER_RADIUS > z && position.z - PLAYER_RADIUS < z + 1;
}
export function collides(world, position) {
  if (position.x - PLAYER_RADIUS < 0 || position.z - PLAYER_RADIUS < 0 || position.x + PLAYER_RADIUS > SIZE || position.z + PLAYER_RADIUS > SIZE || position.y < 0) return true;
  const e = 1e-7;
  for (let x = Math.floor(position.x - PLAYER_RADIUS + e); x <= Math.floor(position.x + PLAYER_RADIUS - e); x++)
    for (let y = Math.floor(position.y + e); y <= Math.floor(position.y + PLAYER_HEIGHT - e); y++)
      for (let z = Math.floor(position.z - PLAYER_RADIUS + e); z <= Math.floor(position.z + PLAYER_RADIUS - e); z++) if (world.solid(x, y, z)) return true;
  return false;
}
export function moveAxis(world, position, axis, delta) {
  if (delta === 0) return false;
  const original = position[axis];
  position[axis] += delta;
  if (!collides(world, position)) return false;
  // Binary resolution permits sliding while leaving a tiny clearance.
  let low = 0, high = 1;
  for (let i = 0; i < 14; i++) {
    const mid = (low + high) * .5;
    position[axis] = original + delta * mid;
    if (collides(world, position)) high = mid; else low = mid;
  }
  position[axis] = original + delta * low;
  return true;
}
export class Player {
  constructor(position) {
    this.position = { ...position };
    this.velocityY = 0;
    this.yaw = .15;
    this.pitch = -.08;
    this.grounded = false;
    this.jumpHeld = false;
    this.distanceWalked = 0;
    this.inWater = false;
  }
  step(world, input, dt) {
    dt = Math.min(.02, Math.max(0, dt));
    this.inWater = world.get(Math.floor(this.position.x), Math.floor(this.position.y + .8), Math.floor(this.position.z)) === WATER;
    let forward = Number(input.forward) - Number(input.backward), right = Number(input.right) - Number(input.left);
    const length = Math.hypot(forward, right);
    if (length) { forward /= length; right /= length; }
    const speed = this.inWater ? 3 : input.sprint ? 7 : 4.5;
    const dx = (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * right) * speed * dt;
    const dz = (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * right) * speed * dt;
    const beforeX = this.position.x, beforeZ = this.position.z;
    moveAxis(world, this.position, 'x', dx); moveAxis(world, this.position, 'z', dz);
    this.distanceWalked += Math.hypot(this.position.x - beforeX, this.position.z - beforeZ);
    if (input.jump && this.inWater) this.velocityY = 3.7;
    else if (input.jump && !this.jumpHeld && this.grounded) { this.velocityY = 8; this.grounded = false; }
    this.jumpHeld = Boolean(input.jump);
    this.velocityY = Math.max(this.inWater ? -3 : -25, this.velocityY - (this.inWater ? 7 : 24) * dt);
    const hit = moveAxis(world, this.position, 'y', this.velocityY * dt);
    this.grounded = hit && this.velocityY < 0;
    if (hit) this.velocityY = 0;
    if (this.position.y > HEIGHT + 8) this.velocityY = Math.min(this.velocityY, 0);
  }
  look(dx, dy, sensitivity) {
    this.yaw -= dx * .002 * sensitivity;
    this.pitch = Math.max(-Math.PI / 2 + .02, Math.min(Math.PI / 2 - .02, this.pitch - dy * .002 * sensitivity));
  }
  get eye() { return { x: this.position.x, y: this.position.y + EYE_HEIGHT, z: this.position.z }; }
  get direction() { return { x: -Math.sin(this.yaw) * Math.cos(this.pitch), y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * Math.cos(this.pitch) }; }
}

export function movementAction(event) {
  // event.key reflects AZERTY labels; event.code is reserved for non-letter keys.
  const key = event.key?.toLowerCase();
  if (key === 'z') return 'forward';
  if (key === 'q') return 'left';
  if (key === 's') return 'backward';
  if (key === 'd') return 'right';
  if (event.code === 'Space') return 'jump';
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') return 'sprint';
  return null;
}
