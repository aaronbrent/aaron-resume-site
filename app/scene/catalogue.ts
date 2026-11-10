import { extend } from "@react-three/fiber";
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CubeCamera,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  SpotLight,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
} from "three";

/**
 * The JSX elements the scene may use. R3F's <Canvas> registers the *whole*
 * THREE namespace (`extend(THREE)`), which defeats tree-shaking and alone put
 * the lazy chunk ~30 kB gz over budget. SceneCanvas uses `createRoot`
 * instead, so only what is registered here (plus what WebGLRenderer needs)
 * ships.
 *
 * Using an intrinsic element that is not listed (e.g. <torusKnotGeometry>)
 * throws "… is not part of the THREE namespace". Either add it here, or call
 * `extend({ TorusKnotGeometry })` in the module that uses it (extend is a
 * global registry), or render the instance with <primitive object={…} />.
 *
 * Covers: Sun, Nebula, DustMotes, OrbitGuides, Lighting (incl. drei
 * Lightformer/Environment), CardAnchors, and the usual
 * planet-building blocks for app/scene/planets.
 */
export function registerSceneElements(): void {
  extend({
    AmbientLight,
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    CircleGeometry,
    Color,
    ConeGeometry,
    CubeCamera,
    CylinderGeometry,
    DirectionalLight,
    Fog,
    Group,
    HemisphereLight,
    IcosahedronGeometry,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    InstancedMesh,
    LineBasicMaterial,
    LineLoop,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    MeshLambertMaterial,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    Object3D,
    PlaneGeometry,
    PointLight,
    Points,
    PointsMaterial,
    RingGeometry,
    ShaderMaterial,
    SphereGeometry,
    SpotLight,
    Sprite,
    SpriteMaterial,
    TorusGeometry,
  });
}
