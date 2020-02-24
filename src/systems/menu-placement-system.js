/* global Ammo */
import { setMatrixWorld } from "../utils/three-utils";
import { v3String } from "../utils/pretty-print";
import { computeLocalBoundingBox } from "../utils/auto-box-collider";
import { waitForDOMContentLoaded } from "../utils/async-utils";
const SWEEP_TEST_LAYER = require("../constants").COLLISION_LAYERS.CONVEX_SWEEP_TEST;
const HIT_FRACTION_FUDGE_FACTOR = 0.02;
const DRAW_DEBUG_BOXES = true;

const drawBox = (function() {
  const transform = new THREE.Matrix4();
  return function drawBox(position, quaternion, halfExtents, color = 0x222222) {
    transform.compose(
      position,
      quaternion,
      halfExtents
    );
    const geometry = new THREE.BoxBufferGeometry(2, 2, 2);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 0.3 })
    );
    setMatrixWorld(mesh, transform);
    AFRAME.scenes[0].object3D.add(mesh);
    return mesh;
  };
})();

const calculateDesiredMenuQuaternion = (function() {
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const back = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const rotation = new THREE.Matrix4();
  return function calculateDesiredMenuQuaternion(cameraPosition, intersectionPoint, desiredMenuQuaternion) {
    back.subVectors(cameraPosition, intersectionPoint).normalize();
    up.set(0, 1, 0);
    forward.copy(back).multiplyScalar(-1);
    right.crossVectors(forward, up).normalize();
    up.crossVectors(right, forward);
    rotation.makeBasis(right, up, back);
    return desiredMenuQuaternion.setFromRotationMatrix(rotation);
  };
})();

function isVisibleUpToRoot(node, root) {
  if (node === root) return true;
  if (!node.visible) return false;
  return isVisibleUpToRoot(node.parent, root);
}

const calculateMenuHalfExtents = (function() {
  const menuRotation = new THREE.Matrix4();
  const menuRight = new THREE.Vector3();
  const menuForward = new THREE.Vector3();
  const menuUp = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const menuWorldScale = new THREE.Vector3();
  const menuWorldPosition = new THREE.Vector3();
  const localBoundingBox = new THREE.Box3();
  return function calculateMenuHalfExtents(menu, halfExtents, offsetToCenter) {};
})();

let doConvexSweepTest;
const createFunctionForConvexSweepTest = function(btCollisionWorld) {
  const menuBtHalfExtents = new Ammo.btVector3(0, 0, 0);
  const menuBtFromTransform = new Ammo.btTransform();
  const menuBtQuaternion = new Ammo.btQuaternion();
  const menuBtToTransform = new Ammo.btTransform();
  return function doConvexSweepTest(datum, el, menuHalfExtents, fromPosition, toPosition, desiredMenuQuaternion) {
    menuBtHalfExtents.setValue(menuHalfExtents.x, menuHalfExtents.y, menuHalfExtents.z);
    const menuBtBoxShape = new Ammo.btBoxShape(menuBtHalfExtents);
    menuBtFromTransform.setIdentity();
    menuBtFromTransform.getOrigin().setValue(fromPosition.x, fromPosition.y, fromPosition.z);
    menuBtQuaternion.setValue(
      desiredMenuQuaternion.x,
      desiredMenuQuaternion.y,
      desiredMenuQuaternion.z,
      desiredMenuQuaternion.w
    );
    menuBtFromTransform.setRotation(menuBtQuaternion);
    menuBtToTransform.setIdentity();
    menuBtToTransform.getOrigin().setValue(toPosition.x, toPosition.y, toPosition.z);
    menuBtToTransform.setRotation(menuBtQuaternion);
    const bodyHelper = el.components["body-helper"];
    if (!bodyHelper) {
      console.error("No body-helper component found on root element. Cannot place the menu!", el);
      return;
    }
    const group = bodyHelper.data.collisionFilterGroup;
    const mask = bodyHelper.data.collisionFilterMask;
    // We avoid using setAttribute for the collisionFilter data because
    // of the extra work that setAttribute does and because we do not need
    // to check for overlapping pairs:
    // https://github.com/InfiniteLee/three-ammo/blob/master/src/body.js#L219
    const broadphaseProxy = bodyHelper.body.physicsBody.getBroadphaseProxy();
    broadphaseProxy.set_m_collisionFilterGroup(SWEEP_TEST_LAYER);
    broadphaseProxy.set_m_collisionFilterMask(SWEEP_TEST_LAYER);
    const menuBtClosestConvexResultCallback = new Ammo.ClosestConvexResultCallback(
      menuBtFromTransform.getOrigin(),
      menuBtToTransform.getOrigin()
    ); // TODO: (performance) Do not recreate this every time
    menuBtClosestConvexResultCallback.set_m_collisionFilterGroup(SWEEP_TEST_LAYER);
    menuBtClosestConvexResultCallback.set_m_collisionFilterMask(SWEEP_TEST_LAYER);
    // TODO: (performance) Try creating a new Ammo.btDiscreteDynamicsWorld,
    // adding ONLY the menu and mesh rigid bodies,
    // then removing them after the convexSweepTest.
    btCollisionWorld.convexSweepTest(
      menuBtBoxShape,
      menuBtFromTransform,
      menuBtToTransform,
      menuBtClosestConvexResultCallback,
      0.01
    );
    broadphaseProxy.set_m_collisionFilterGroup(group);
    broadphaseProxy.set_m_collisionFilterMask(mask);
    const closestHitFraction = menuBtClosestConvexResultCallback.get_m_closestHitFraction();
    const fractionToUse = THREE.Math.clamp(closestHitFraction - HIT_FRACTION_FUDGE_FACTOR, 0, 1);
    // Pull back from the hit point just a bit to guard against the convex sweep test allowing a small overlap.
    Ammo.destroy(menuBtBoxShape);
    Ammo.destroy(menuBtClosestConvexResultCallback);
    return fractionToUse;
  };
};

const computeMenuPlacementFlat = (function() {
  return function computeMenuPlacementFlat(el, datum, cameraPosition) {};
})();

const computeMenuPlacement3D = (function() {
  const desiredMenuPosition = new THREE.Vector3();
  const desiredMenuScale = new THREE.Vector3();
  const desiredMenuTransform = new THREE.Matrix4();
  const halfExtents = new THREE.Vector3();
  const offsetToCenter = new THREE.Vector3();
  return function computeMenuPlacement3D(el, datum, cameraPosition) {
    datum.menuEl.object3D.updateMatrices();
    calculateDesiredMenuQuaternion(cameraPosition, datum.intersectionPoint, datum.desiredMenuQuaternion);
    const distanceToIntersection = new THREE.Vector3().subVectors(cameraPosition, datum.intersectionPoint).length();
    desiredMenuScale.setScalar(0.45 * distanceToIntersection);
    console.log("desired scale is ", desiredMenuScale.x);

    const localMax = datum.menuLocalBoundingBox.max;
    const localMin = datum.menuLocalBoundingBox.min;
    const localCenter = new THREE.Vector3().addVectors(localMax, localMin).multiplyScalar(0.5);
    localCenter.z = 0;
    const localHalfExtents = new THREE.Vector3().subVectors(localMax, localMin).multiplyScalar(0.5);
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    datum.menuEl.object3D.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

    const desiredMat4 = new THREE.Matrix4().compose(
      datum.intersectionPoint,
      datum.desiredMenuQuaternion,
      desiredMenuScale
    );
    const center = new THREE.Vector3().copy(localCenter).applyMatrix4(desiredMat4);
    drawBox(center, new THREE.Quaternion(), new THREE.Vector3(0.1, 0.1, 0.1), 0x00ff00);
    halfExtents.copy(localHalfExtents).multiply(desiredMenuScale);
    halfExtents.z = -0.005;
    offsetToCenter.subVectors(datum.intersectionPoint, center);
    const pointA = new THREE.Vector3().copy(cameraPosition);
    const pointB = new THREE.Vector3().addVectors(datum.intersectionPoint, offsetToCenter);
    const hitFraction = doConvexSweepTest(datum, el, halfExtents, pointA, pointB, datum.desiredMenuQuaternion);
    if (hitFraction === 0) {
      desiredMenuPosition.lerpVectors(pointA, pointB, 0.8);
    } else {
      desiredMenuPosition.lerpVectors(pointA, pointB, hitFraction);
    }
    desiredMenuTransform.compose(
      desiredMenuPosition,
      datum.desiredMenuQuaternion,
      desiredMenuScale
    );
    if (DRAW_DEBUG_BOXES) {
      //if (datum.debugBox2) {
      //  datum.debugBox2.parent.remove(datum.debugBox2);
      //}
      //datum.debugBox2 = drawBox(center, worldQuaternion, halfExtents);
    }
    if (DRAW_DEBUG_BOXES) {
      if (datum.debugBox) {
        datum.debugBox.parent.remove(datum.debugBox);
      }
      datum.debugBox = drawBox(
        new THREE.Vector3().addVectors(desiredMenuPosition, offsetToCenter.multiplyScalar(-1)),
        datum.desiredMenuQuaternion,
        halfExtents,
        0xff0000
      );
    }
    setMatrixWorld(datum.menuEl.object3D, desiredMenuTransform);
  };
})();

export class MenuPlacementSystem {
  constructor(physicsSystem, interactionSystem) {
    this.physicsSystem = physicsSystem;
    this.interactionSystem = interactionSystem;
    this.els = [];
    this.data = new Map();
    this.tick = this.tick.bind(this);
    waitForDOMContentLoaded().then(() => {
      this.viewingCamera = document.getElementById("viewing-camera").object3D;
    });
  }
  register(el, menuEl) {
    this.els.push(el);
    this.data.set(el, {
      mesh: null,
      menuEl,
      shouldComputeMenuLocalBoundingBox: true,
      menuLocalBoundingBox: new THREE.Box3(),
      menuScaleAtBBComputeTime: new THREE.Vector3(),
      intersectionPoint: new THREE.Vector3(),
      desiredMenuQuaternion: new THREE.Quaternion()
    });
  }
  unregister(el) {
    this.els.splice(this.els.indexOf(el), 1);
    this.data.delete(el);
  }

  shouldComputeMenuLocalBoundingBox(el) {
    this.data.get(el).shouldComputeMenuLocalBoundingBox = true;
  }

  tryGetReady() {
    if (!this.viewingCamera) {
      return false;
    }
    if (!Ammo || !(this.physicsSystem.world && this.physicsSystem.world.physicsWorld)) {
      return false;
    }
    // Must wait for Ammo / WASM initialization before we can
    // initialize Ammo data structures like Ammo.btVector3
    doConvexSweepTest = createFunctionForConvexSweepTest(this.physicsSystem.world.physicsWorld);
    this.leftCursorController = document.getElementById("left-cursor-controller").components["cursor-controller"];
    this.rightCursorController = document.getElementById("right-cursor-controller").components["cursor-controller"];
    return true;
  }

  tick = (function() {
    const cameraPosition = new THREE.Vector3();
    return function tick() {
      if (!this.isReady) {
        this.isReady = this.tryGetReady();
        if (!this.isReady) {
          return;
        }
      }
      this.viewingCamera.updateMatrices();
      cameraPosition.setFromMatrixPosition(this.viewingCamera.matrixWorld);
      for (let i = 0; i < this.els.length; i++) {
        const el = this.els[i];
        const datum = this.data.get(el);
        datum.mesh = el.getObject3D("mesh");
        if (!datum.mesh) {
          continue;
        }
        const isMenuVisible = datum.menuEl.object3D.visible;
        const isMenuOpening = isMenuVisible && !datum.wasMenuVisible;
        if (isMenuOpening) {
          if (!el.components["gltf-model-plus"]) {
            computeMenuPlacementFlat(el, datum, cameraPosition);
          } else {
            if (datum.shouldComputeMenuLocalBoundingBox) {
              datum.shouldComputeMenuLocalBoundingBox = false;
              computeLocalBoundingBox(datum.menuEl.object3D, datum.menuLocalBoundingBox, true);
              datum.menuScaleAtBBComputeTime.setFromMatrixScale(datum.menuEl.object3D.matrixWorld);
              //const localMax = datum.menuLocalBoundingBox.max;
              //const localMin = datum.menuLocalBoundingBox.min;
              //const localCenter = new THREE.Vector3().addVectors(localMax, localMin).multiplyScalar(0.5);
              //localCenter.z = 0;
              //const localHalfExtents = new THREE.Vector3().subVectors(localMax, localMin).multiplyScalar(0.5);
              //const worldPosition = new THREE.Vector3();
              //const worldQuaternion = new THREE.Quaternion();
              //const worldScale = new THREE.Vector3();
              //datum.menuEl.object3D.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
              //if (DRAW_DEBUG_BOXES) {
              //  if (datum.debugBox2) {
              //    datum.debugBox2.parent.remove(datum.debugBox2);
              //  }
              //  const center = new THREE.Vector3().copy(localCenter).applyMatrix4(datum.menuEl.object3D.matrixWorld);
              //  const halfExtents = new THREE.Vector3().copy(localHalfExtents).multiply(worldScale);

              //  halfExtents.z = -0.005;
              //  datum.debugBox2 = drawBox(center, worldQuaternion, halfExtents);
              //}
            }
            const intersection =
              (this.interactionSystem.state.rightRemote.hovered === el && this.rightCursorController.intersection) ||
              (this.interactionSystem.state.leftRemote.hovered === el && this.leftCursorController.intersection);
            if (!intersection) {
              // Must be on mobile, where all menus open simultaneously
              el.object3D.updateMatrices();
              datum.intersectionPoint.setFromMatrixPosition(el.object3D.matrixWorld);
            } else {
              datum.intersectionPoint.copy(intersection.point);
            }
            computeMenuPlacement3D(el, datum, cameraPosition);
          }
        }
        datum.wasMenuVisible = isMenuVisible;
      }
    };
  })();
}