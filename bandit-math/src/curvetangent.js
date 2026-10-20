// A CURVE'S WAY WITHOUT THE GARBAGE: three's Curve.getTangent (and getTangentAt, which calls it) makes two new points
// every call to take the difference of, even when it is handed a vector to fill. The roads ask it for every wagon,
// rider and walker on them every frame, so it made megabytes of garbage a second for the collector. Here it is the
// same sum (the same two points either side, the same small step) into points kept for the purpose. Curves that work
// out their own way (a straight line's) keep theirs. Imported once, for its effect, before any curve is used.
import * as THREE from 'three';

const DELTA = 0.0001;   // (three's own step either side)
const A3 = new THREE.Vector3(), B3 = new THREE.Vector3(), A2 = new THREE.Vector2(), B2 = new THREE.Vector2();
const own = THREE.Curve.prototype.getTangent;
THREE.Curve.prototype.getTangent = function getTangent(t, optionalTarget) {
  let flat = this._flat;
  if (flat === undefined) { flat = this._flat = !!this.getPoint(0).isVector2; }   // (once per curve: in 2D or 3D)
  const t1 = Math.max(0, t - DELTA), t2 = Math.min(1, t + DELTA);
  const a = this.getPoint(t1, flat ? A2 : A3), b = this.getPoint(t2, flat ? B2 : B3);
  if (!a || !b) return own.call(this, t, optionalTarget);
  const tangent = optionalTarget || (flat ? new THREE.Vector2() : new THREE.Vector3());
  return tangent.copy(b).sub(a).normalize();
};
