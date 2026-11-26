/** Animation layout definitions shared by generated sheets and the asset manifest. */
export interface AnimSpec {
  state: string;
  frames: number;
  rate: number;
  repeat: number;
}

export const CHARACTER_ANIMS: AnimSpec[] = [
  { state: 'idle', frames: 4, rate: 6, repeat: -1 },
  { state: 'walk', frames: 6, rate: 12, repeat: -1 },
  { state: 'attack', frames: 4, rate: 18, repeat: 0 },
  { state: 'cast', frames: 4, rate: 14, repeat: 0 },
  { state: 'dash', frames: 3, rate: 18, repeat: -1 },
  { state: 'hurt', frames: 2, rate: 10, repeat: 0 },
  { state: 'death', frames: 7, rate: 9, repeat: 0 },
];

export interface Pose {
  t: number;
  bob: number;
  lean: number;
  legL: number;
  legR: number;
  armAngle: number;
  glow: number;
  smear: number;
  sway: number;
  hurt: boolean;
  dash: boolean;
  fallen: number;
  dissolve: number;
}

const basePose = (): Pose => ({ t: 0, bob: 0, lean: 0, legL: 0, legR: 0, armAngle: 0.4, glow: 0, smear: 0, sway: 0, hurt: false, dash: false, fallen: 0, dissolve: 0 });

/** Generic humanoid pose curve per state/frame; character drawers interpret it. */
export const humanoidPose = (state: string, f: number, restAngle: number, attackCurve: number[], castCurve: number[]): Pose => {
  const p = basePose();
  p.armAngle = restAngle;
  switch (state) {
    case 'idle':
      p.bob = [0, 0, 1, 1][f];
      p.sway = [0, 1, 1, 0][f];
      p.t = f * 1.57;
      break;
    case 'walk': {
      const legs = [2, 1, -1, -2, -1, 1];
      p.legL = legs[f];
      p.legR = -legs[f];
      p.bob = [0, 1, 1, 0, 1, 1][f];
      p.sway = [1, 2, 1, 1, 2, 1][f];
      p.lean = 1;
      p.t = f * 1.05;
      p.armAngle = restAngle + [0.1, 0, -0.1, -0.1, 0, 0.1][f];
      break;
    }
    case 'attack':
      p.armAngle = attackCurve[f];
      p.lean = [-1, 1, 2, 1][f];
      p.smear = [0, 1, 1, 0][f];
      p.legL = [0, 1, 2, 1][f];
      p.legR = [0, -1, -1, 0][f];
      p.sway = 2;
      p.t = f;
      break;
    case 'cast':
      p.armAngle = castCurve[f];
      p.glow = [0.3, 0.7, 1, 0.6][f];
      p.lean = [0, 1, 1, 0][f];
      p.bob = [0, -1, -1, 0][f];
      p.sway = 1;
      p.t = f * 1.2;
      break;
    case 'dash':
      p.dash = true;
      p.lean = 2;
      p.legL = -2;
      p.legR = 2;
      p.sway = [3, 4, 3][f];
      p.t = f * 2;
      p.armAngle = restAngle + 0.6;
      break;
    case 'hurt':
      p.hurt = true;
      p.lean = [-2, -1][f];
      p.bob = [1, 0][f];
      p.sway = 0;
      break;
    case 'death':
      p.hurt = true;
      p.fallen = [0, 0.25, 0.5, 0.75, 1, 1, 1][f];
      p.dissolve = [0, 0, 0, 0, 0.35, 0.6, 0.85][f];
      p.lean = [-1, -2, -2, -1, -1, -1, -1][f];
      break;
  }
  return p;
};
