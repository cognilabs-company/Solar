/**
 * "Energiya sayyorasi" — the three.js scene behind the login page.
 *
 * A small low-poly planet turns under a fixed sun. Solar farms on the day side
 * track the sun and send energy along arcs to cities on the night side, which
 * light up as the grid charges. Dragging spins the planet; typing pushes more
 * energy through the arcs. Loaded as a lazy chunk from EnergyPlanet.tsx.
 */
import * as THREE from 'three';

export type PlanetStatus = 'idle' | 'submitting' | 'error' | 'success';

export interface PlanetStats {
  /** Grid charge, 0..1. */
  energy: number;
  litCities: number;
  totalCities: number;
  dayFarms: number;
  totalFarms: number;
}

export interface PlanetSceneOptions {
  reducedMotion: boolean;
  onStats?: (stats: PlanetStats) => void;
}

export interface PlanetScene {
  setStatus: (status: PlanetStatus) => void;
  pulse: () => void;
  dispose: () => void;
}

const R = 1.5;
const WIDE_MIN = 1024;

/* ------------------------------------------------------------------ noise -- */

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const zf = smooth(z - zi);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), xf);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), xf);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), xf);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), xf);
  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf) * 2 - 1;
}

/** Terrain height for a unit direction: > 0 is land, < 0 is sea. */
function terrain(dir: THREE.Vector3): number {
  let amp = 0.55;
  let freq = 1.35;
  let sum = 0;
  for (let octave = 0; octave < 5; octave += 1) {
    sum +=
      amp *
      valueNoise(dir.x * freq + 11.3, dir.y * freq + 4.1, dir.z * freq - 7.7);
    amp *= 0.5;
    freq *= 2.05;
  }
  return sum - 0.07;
}

function radiusFor(height: number): number {
  return height > 0 ? R * (1.006 + 0.07 * Math.pow(height, 0.9)) : R * (0.986 + 0.02 * height);
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDirection(rand: () => number, target = new THREE.Vector3()): THREE.Vector3 {
  const u = rand() * 2 - 1;
  const theta = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return target.set(s * Math.cos(theta), u, s * Math.sin(theta));
}

/* --------------------------------------------------------------- textures -- */

function glowTexture(stops: Array<[number, string]>, size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [offset, color] of stops) {
      gradient.addColorStop(offset, color);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function raysTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.translate(size / 2, size / 2);
    const rays = 14;
    for (let i = 0; i < rays; i += 1) {
      const angle = (i / rays) * Math.PI * 2 + (i % 2) * 0.09;
      const length = size * (i % 2 === 0 ? 0.5 : 0.34);
      const width = i % 2 === 0 ? 0.05 : 0.03;
      const gradient = ctx.createLinearGradient(0, 0, Math.cos(angle) * length, Math.sin(angle) * length);
      gradient.addColorStop(0, 'rgba(255,226,140,0.55)');
      gradient.addColorStop(1, 'rgba(255,226,140,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, length, angle - width, angle + width);
      ctx.closePath();
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ---------------------------------------------------------------- shaders -- */

const glowPointsVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / -mv.z;
    vAlpha = aAlpha;
    vColor = aColor;
  }
`;

const glowPointsFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(0.35, 0.0, d);
    float halo = pow(max(1.0 - d, 0.0), 2.2);
    float a = (halo * 0.7 + core) * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor * (0.7 + core * 0.6), a);
  }
`;

const cityVertex = /* glsl */ `
  attribute float aSeed;
  uniform vec3 uSun;
  uniform vec3 uCenter;
  uniform float uLit;
  uniform float uTime;
  uniform float uError;
  uniform float uScale;
  varying float vAlpha;
  varying float vOn;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(world.xyz - uCenter);
    float night = smoothstep(0.12, -0.22, dot(n, uSun));
    float on = smoothstep(aSeed, aSeed - 0.04, uLit);
    float flicker = mix(1.0, step(0.5, fract(sin(uTime * 23.0 + aSeed * 91.0) * 43758.5)), uError);
    vOn = on * flicker;
    vAlpha = night * (0.16 + 0.84 * vOn) * (0.82 + 0.18 * sin(uTime * 2.4 + aSeed * 60.0));
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.016 + vOn * 0.04) * (0.6 + fract(aSeed * 13.0) * 0.7) * uScale / -mv.z;
  }
`;

const cityFragment = /* glsl */ `
  varying float vAlpha;
  varying float vOn;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(1.0 - d, 0.0), 2.0) * vAlpha;
    if (a < 0.003) discard;
    vec3 warm = vec3(1.0, 0.82, 0.45);
    vec3 dim = vec3(0.45, 0.62, 0.7);
    gl_FragColor = vec4(mix(dim, warm, vOn), a);
  }
`;

const arcVertex = /* glsl */ `
  varying float vAlong;
  void main() {
    vAlong = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const arcFragment = /* glsl */ `
  uniform float uTime;
  uniform float uActive;
  uniform float uSpeed;
  uniform float uOffset;
  uniform float uError;
  varying float vAlong;
  void main() {
    float phase = fract(vAlong * 4.0 - uTime * uSpeed + uOffset);
    float dash = smoothstep(0.0, 0.12, phase) * (1.0 - smoothstep(0.32, 0.5, phase));
    float ends = smoothstep(0.0, 0.08, vAlong) * smoothstep(1.0, 0.92, vAlong);
    float a = (0.14 + dash * 0.86) * uActive * ends;
    vec3 color = mix(vec3(0.49, 0.95, 0.6), vec3(1.0, 0.83, 0.3), vAlong);
    color = mix(color, vec3(1.0, 0.33, 0.3), uError);
    gl_FragColor = vec4(color, a);
  }
`;

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const haloFragment = /* glsl */ `
  uniform vec3 uSun;
  uniform float uError;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  void main() {
    float intensity = pow(smoothstep(0.0, 0.56, -vNormal.z), 1.7);
    float day = clamp(dot(vWorldNormal, uSun) * 0.5 + 0.5, 0.0, 1.0);
    vec3 color = mix(vec3(0.12, 0.62, 0.5), vec3(1.0, 0.8, 0.42), pow(day, 2.0));
    color = mix(color, vec3(0.9, 0.25, 0.22), uError * 0.7);
    gl_FragColor = vec4(color, intensity * (0.55 + day * 0.65));
  }
`;

const rimFragment = /* glsl */ `
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  void main() {
    float rim = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
    float day = smoothstep(-0.3, 0.6, dot(vWorldNormal, uSun));
    vec3 color = mix(vec3(0.16, 0.7, 0.55), vec3(1.0, 0.88, 0.6), day);
    gl_FragColor = vec4(color, rim * (0.35 + day * 0.55));
  }
`;

const starVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 40.0));
    gl_PointSize = (0.8 + aSeed * 1.8) * uScale;
  }
`;

const starFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d) * vAlpha;
    gl_FragColor = vec4(0.85, 0.97, 0.92, a);
  }
`;

/* ------------------------------------------------------------------ scene -- */

interface Farm {
  normal: THREE.Vector3;
  tangent: THREE.Vector3;
  bitangent: THREE.Vector3;
  center: THREE.Vector3;
  tilt: number;
  day: number;
}

interface Arc {
  curve: THREE.CatmullRomCurve3;
  material: THREE.ShaderMaterial;
  farm: number;
  cityNormal: THREE.Vector3;
  phase: number;
  speed: number;
  active: number;
}

export function createPlanetScene(
  canvas: HTMLCanvasElement,
  options: PlanetSceneOptions,
): PlanetScene {
  const { reducedMotion, onStats } = options;
  const isNarrow = () => window.innerWidth < WIDE_MIN;
  const lowDetail = window.innerWidth < 640;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  camera.position.set(0, 0, 9);

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  /* ---- world rig: tilt -> spin (planet) */
  const world = new THREE.Group();
  scene.add(world);
  const tilt = new THREE.Group();
  tilt.rotation.z = 0.32;
  world.add(tilt);
  const planet = new THREE.Group();
  tilt.add(planet);

  /* ---- light */
  const sunLight = new THREE.DirectionalLight('#fff0cf', 3.1);
  scene.add(sunLight, sunLight.target);
  scene.add(new THREE.AmbientLight('#2c6f68', 0.42));
  const sunDir = new THREE.Vector3(1, 0.85, 0.75).normalize();

  /* ---- land */
  const landGeometry = track(new THREE.IcosahedronGeometry(R, lowDetail ? 16 : 21));
  {
    const position = landGeometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    const v = new THREE.Vector3();
    const heights = new Float32Array(position.count);
    const ys = new Float32Array(position.count);
    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i).normalize();
      const h = terrain(v);
      heights[i] = h;
      ys[i] = v.y;
      v.multiplyScalar(radiusFor(h));
      position.setXYZ(i, v.x, v.y, v.z);
    }
    const palette = {
      deep: new THREE.Color('#0c3f4a'),
      shelf: new THREE.Color('#14706d'),
      sand: new THREE.Color('#d7c58a'),
      meadow: new THREE.Color('#58b04f'),
      forest: new THREE.Color('#2f8a45'),
      upland: new THREE.Color('#7d9a4c'),
      rock: new THREE.Color('#6f7a5c'),
      snow: new THREE.Color('#eef6ef'),
    };
    const c = new THREE.Color();
    for (let i = 0; i < position.count; i += 3) {
      const h = (heights[i] + heights[i + 1] + heights[i + 2]) / 3;
      const lat = Math.abs((ys[i] + ys[i + 1] + ys[i + 2]) / 3);
      if (h < -0.04) c.copy(palette.deep);
      else if (h < 0) c.copy(palette.shelf);
      else if (h < 0.03) c.copy(palette.sand);
      else if (h < 0.14) c.copy(palette.meadow);
      else if (h < 0.25) c.copy(palette.forest);
      else if (h < 0.34) c.copy(palette.upland);
      else if (h < 0.5) c.copy(palette.rock);
      else c.copy(palette.snow);
      if (lat > 0.93 && h > -0.02) c.copy(palette.snow);
      const jitter = (hash3(i * 0.37, 1.7, 2.9) - 0.5) * 0.035;
      c.offsetHSL(0, 0, jitter);
      for (let k = 0; k < 3; k += 1) {
        colors[(i + k) * 3] = c.r;
        colors[(i + k) * 3 + 1] = c.g;
        colors[(i + k) * 3 + 2] = c.b;
      }
    }
    landGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    landGeometry.computeVertexNormals();
  }
  const land = new THREE.Mesh(
    landGeometry,
    track(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.92,
        metalness: 0,
      }),
    ),
  );
  planet.add(land);

  const sea = new THREE.Mesh(
    track(new THREE.IcosahedronGeometry(R * 0.998, 9)),
    track(
      new THREE.MeshStandardMaterial({
        color: '#127079',
        roughness: 0.22,
        metalness: 0.1,
        flatShading: true,
        transparent: true,
        opacity: 0.86,
      }),
    ),
  );
  planet.add(sea);

  /* ---- surface sampling */
  const rand = mulberry32(20261116);
  const sample = new THREE.Vector3();
  function sampleLand(minH: number, maxH: number, near?: THREE.Vector3, spread = 0.2): THREE.Vector3 | null {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      if (near) {
        randomDirection(rand, sample).multiplyScalar(spread).add(near).normalize();
      } else {
        randomDirection(rand, sample);
      }
      if (Math.abs(sample.y) > 0.82) continue;
      const h = terrain(sample);
      if (h >= minH && h <= maxH) {
        return sample.clone();
      }
    }
    return null;
  }

  /* ---- solar farms (instanced panels that track the sun) */
  const farmCount = lowDetail ? 16 : 26;
  const panelsPerFarm = 6;
  const farms: Farm[] = [];
  for (let i = 0; i < farmCount; i += 1) {
    const dir = sampleLand(0.03, 0.16);
    if (!dir) continue;
    if (farms.some((farm) => farm.normal.dot(dir) > 0.985)) continue;
    const helper = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3().crossVectors(helper, dir).normalize();
    const bitangent = new THREE.Vector3().crossVectors(dir, tangent).normalize();
    farms.push({
      normal: dir,
      tangent,
      bitangent,
      center: dir.clone().multiplyScalar(radiusFor(terrain(dir)) + 0.004),
      tilt: 0,
      day: 0,
    });
  }

  const panelGeometry = track(new THREE.BoxGeometry(0.06, 0.005, 0.042));
  const panelMaterial = track(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const panels = new THREE.InstancedMesh(panelGeometry, panelMaterial, farms.length * panelsPerFarm);
  panels.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(farms.length * panelsPerFarm * 3),
    3,
  );
  planet.add(panels);

  const postGeometry = track(new THREE.CylinderGeometry(0.0035, 0.0035, 0.03, 4));
  postGeometry.translate(0, 0.015, 0);
  const posts = new THREE.InstancedMesh(
    postGeometry,
    track(new THREE.MeshStandardMaterial({ color: '#c9d4cf', roughness: 0.6 })),
    farms.length * panelsPerFarm,
  );
  planet.add(posts);

  const panelOffsets: THREE.Vector3[] = [];
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      panelOffsets.push(new THREE.Vector3((col - 1) * 0.072, 0, (row - 0.5) * 0.06));
    }
  }

  {
    const m = new THREE.Matrix4();
    const basis = new THREE.Matrix4();
    farms.forEach((farm, f) => {
      basis.makeBasis(farm.tangent, farm.normal, farm.bitangent);
      panelOffsets.forEach((offset, k) => {
        const p = farm.center
          .clone()
          .addScaledVector(farm.tangent, offset.x)
          .addScaledVector(farm.bitangent, offset.z)
          .addScaledVector(farm.normal, -0.012);
        m.copy(basis).setPosition(p);
        posts.setMatrixAt(f * panelsPerFarm + k, m);
      });
    });
    posts.instanceMatrix.needsUpdate = true;
  }

  /* ---- farm halos */
  function makeGlowPoints(count: number) {
    const geometry = track(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const material = track(
      new THREE.ShaderMaterial({
        vertexShader: glowPointsVertex,
        fragmentShader: glowPointsFragment,
        uniforms: { uScale: { value: 300 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return { points, geometry, material };
  }

  const farmHalos = makeGlowPoints(farms.length);
  farms.forEach((farm, f) => {
    const p = farm.center.clone().addScaledVector(farm.normal, 0.03);
    farmHalos.geometry.attributes.position.setXYZ(f, p.x, p.y, p.z);
    farmHalos.geometry.attributes.aColor.setXYZ(f, 1, 0.86, 0.42);
  });
  planet.add(farmHalos.points);

  /* ---- cities */
  const clusterCount = lowDetail ? 16 : 24;
  const cityPositions: number[] = [];
  const citySeeds: number[] = [];
  const cityClusters: THREE.Vector3[] = [];
  for (let c = 0; c < clusterCount; c += 1) {
    const centre = sampleLand(0.0, 0.24);
    if (!centre) continue;
    cityClusters.push(centre);
    const size = 4 + Math.floor(rand() * 6);
    for (let k = 0; k < size; k += 1) {
      const dir = k === 0 ? centre : sampleLand(0.0, 0.3, centre, 0.09);
      if (!dir) continue;
      const p = dir.clone().multiplyScalar(radiusFor(terrain(dir)) + 0.006);
      cityPositions.push(p.x, p.y, p.z);
      citySeeds.push(0.04 + rand() * 0.94);
    }
  }
  const cityGeometry = track(new THREE.BufferGeometry());
  cityGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cityPositions, 3));
  cityGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(citySeeds, 1));
  const cityUniforms = {
    uSun: { value: new THREE.Vector3() },
    uCenter: { value: new THREE.Vector3() },
    uLit: { value: 0 },
    uTime: { value: 0 },
    uError: { value: 0 },
    uScale: { value: 300 },
  };
  const cities = new THREE.Points(
    cityGeometry,
    track(
      new THREE.ShaderMaterial({
        vertexShader: cityVertex,
        fragmentShader: cityFragment,
        uniforms: cityUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  cities.frustumCulled = false;
  planet.add(cities);

  /* ---- energy arcs: farm -> city cluster */
  const arcs: Arc[] = [];
  const arcGroup = new THREE.Group();
  planet.add(arcGroup);
  farms.forEach((farm, f) => {
    if (arcs.length >= (lowDetail ? 9 : 14) || f % 2 === 1) return;
    const candidates = cityClusters
      .map((cluster) => ({ cluster, angle: farm.normal.angleTo(cluster) }))
      .filter(({ angle }) => angle > 0.6 && angle < 1.9)
      .sort((a, b) => a.angle - b.angle);
    const target = candidates[Math.floor(rand() * Math.min(3, candidates.length))];
    if (!target) return;
    const points: THREE.Vector3[] = [];
    const a = farm.normal;
    const b = target.cluster;
    const omega = a.angleTo(b);
    for (let s = 0; s <= 32; s += 1) {
      const t = s / 32;
      const wa = Math.sin((1 - t) * omega) / Math.sin(omega);
      const wb = Math.sin(t * omega) / Math.sin(omega);
      const p = a.clone().multiplyScalar(wa).addScaledVector(b, wb).normalize();
      points.push(p.multiplyScalar(R * (1.03 + 0.2 * omega * Math.sin(Math.PI * t))));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const material = track(
      new THREE.ShaderMaterial({
        vertexShader: arcVertex,
        fragmentShader: arcFragment,
        uniforms: {
          uTime: { value: 0 },
          uActive: { value: 0 },
          uSpeed: { value: 0.5 },
          uOffset: { value: rand() },
          uError: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const tube = new THREE.Mesh(track(new THREE.TubeGeometry(curve, 72, 0.0065, 5, false)), material);
    arcGroup.add(tube);
    arcs.push({
      curve,
      material,
      farm: f,
      cityNormal: b.clone(),
      phase: rand(),
      speed: 0.22 + rand() * 0.12,
      active: 0,
    });
  });

  const arcHeads = makeGlowPoints(arcs.length);
  planet.add(arcHeads.points);

  /* ---- atmosphere */
  const atmosphereUniforms = { uSun: { value: new THREE.Vector3() }, uError: { value: 0 } };
  const halo = new THREE.Mesh(
    track(new THREE.SphereGeometry(R * 1.2, 64, 48)),
    track(
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: haloFragment,
        uniforms: atmosphereUniforms,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  tilt.add(halo);
  const rim = new THREE.Mesh(
    track(new THREE.SphereGeometry(R * 1.035, 64, 48)),
    track(
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: rimFragment,
        uniforms: { uSun: atmosphereUniforms.uSun },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  tilt.add(rim);

  /* ---- orbit ring with "data" satellites */
  const ringGroup = new THREE.Group();
  ringGroup.rotation.set(1.18, 0.2, -0.28);
  tilt.add(ringGroup);
  const ringRadius = R * 1.58;
  const ring = new THREE.Mesh(
    track(new THREE.RingGeometry(ringRadius - 0.004, ringRadius + 0.004, 160)),
    track(
      new THREE.MeshBasicMaterial({
        color: '#9be7c4',
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  ringGroup.add(ring);
  const satellites = makeGlowPoints(3);
  for (let s = 0; s < 3; s += 1) {
    satellites.geometry.attributes.aColor.setXYZ(s, s === 0 ? 1 : 0.6, s === 0 ? 0.85 : 1, s === 0 ? 0.4 : 0.75);
    satellites.geometry.attributes.aSize.setX(s, s === 0 ? 0.13 : 0.09);
    satellites.geometry.attributes.aAlpha.setX(s, 1);
  }
  ringGroup.add(satellites.points);

  /* ---- sun */
  const sunGroup = new THREE.Group();
  scene.add(sunGroup);
  const sunGlow = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: track(
          glowTexture([
            [0, 'rgba(255,250,225,1)'],
            [0.1, 'rgba(255,236,170,0.95)'],
            [0.24, 'rgba(255,205,90,0.45)'],
            [0.55, 'rgba(255,170,60,0.1)'],
            [1, 'rgba(255,160,60,0)'],
          ]),
        ),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  sunGroup.add(sunGlow);
  const sunRaysMaterial = track(
    new THREE.SpriteMaterial({
      map: track(raysTexture()),
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    }),
  );
  const sunRays = new THREE.Sprite(sunRaysMaterial);
  sunGroup.add(sunRays);

  /* ---- stars */
  const starCount = lowDetail ? 500 : 1100;
  const starPositions = new Float32Array(starCount * 3);
  const starSeeds = new Float32Array(starCount);
  const starDir = new THREE.Vector3();
  for (let s = 0; s < starCount; s += 1) {
    randomDirection(rand, starDir);
    if (starDir.z > 0.2) starDir.z = -starDir.z;
    starDir.multiplyScalar(60 + rand() * 30);
    starPositions.set([starDir.x, starDir.y, starDir.z], s * 3);
    starSeeds[s] = rand();
  }
  const starGeometry = track(new THREE.BufferGeometry());
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('aSeed', new THREE.BufferAttribute(starSeeds, 1));
  const starUniforms = { uTime: { value: 0 }, uScale: { value: 300 } };
  const stars = new THREE.Points(
    starGeometry,
    track(
      new THREE.ShaderMaterial({
        vertexShader: starVertex,
        fragmentShader: starFragment,
        uniforms: starUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  scene.add(stars);

  /* ------------------------------------------------------------ layout -- */
  let width = 1;
  let height = 1;
  let planetScale = 1;
  const planetHome = new THREE.Vector3();
  const pointScaleUniforms = [
    farmHalos.material.uniforms.uScale,
    arcHeads.material.uniforms.uScale,
    satellites.material.uniforms.uScale,
    cityUniforms.uScale,
  ];

  function layout() {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, lowDetail ? 1.5 : 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const distance = camera.position.z;
    const viewHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const worldPerPx = viewHeight / height;

    let centerX: number;
    let centerY: number;
    let radiusPx: number;
    if (isNarrow()) {
      centerX = width * 0.5;
      centerY = Math.min(height * 0.41, 200 + width * 0.38);
      radiusPx = Math.min(width * 0.28, height * 0.18);
    } else {
      centerX = width * 0.43;
      centerY = height * 0.62;
      radiusPx = Math.min(height * 0.25, width * 0.165);
    }
    planetScale = (radiusPx * worldPerPx) / R;
    planetHome.set((centerX - width / 2) * worldPerPx, (height / 2 - centerY) * worldPerPx, 0);
    world.scale.setScalar(planetScale);

    // Sun sits above-right of the planet, between it and the login card.
    const sunOffset = new THREE.Vector3(0.95, 1.35, 0.4).multiplyScalar(R * planetScale);
    sunGroup.position.copy(planetHome).add(sunOffset);
    sunDir.copy(sunOffset).normalize();
    const sunSize = R * planetScale * 1.5;
    sunGlow.scale.setScalar(sunSize);
    sunRays.scale.setScalar(sunSize * 1.55);

    const pointScale =
      ((height * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
      planetScale;
    for (const uniform of pointScaleUniforms) uniform.value = pointScale;
    starUniforms.uScale.value = renderer.getPixelRatio();
  }

  /* --------------------------------------------------------- interaction -- */
  let spin = 0.6;
  let spinVelocity = 0;
  let pitch = 0.12;
  let pitchVelocity = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();

  function onPointerDown(event: PointerEvent) {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent) {
    pointer.set((event.clientX / width) * 2 - 1, (event.clientY / height) * 2 - 1);
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    spinVelocity = dx * 0.006;
    pitchVelocity = dy * 0.004;
    spin += spinVelocity;
    pitch = THREE.MathUtils.clamp(pitch + pitchVelocity, -0.55, 0.55);
    if (reducedMotion) render(0);
  }
  function onPointerUp(event: PointerEvent) {
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  /* --------------------------------------------------------------- state -- */
  let status: PlanetStatus = 'idle';
  let energy = reducedMotion ? 0.72 : 0;
  let flowBoost = 0;
  let errorLevel = 0;
  let shake = 0;
  let successLevel = 0;
  let intro = reducedMotion ? 1 : 0;
  let time = 0;
  let statsTimer = 0;
  let dayFarmCount = 0;

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const sunLocal = new THREE.Vector3();
  const planetQuat = new THREE.Quaternion();
  const invQuat = new THREE.Quaternion();
  const panelMatrix = new THREE.Matrix4();
  const tiltMatrix = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const panelColor = new THREE.Color();
  const navy = new THREE.Color('#0f1d36');
  const cell = new THREE.Color('#3f86e0');
  const gold = new THREE.Color('#ffd76a');
  const viewDirLocal = new THREE.Vector3();
  const towardSun = new THREE.Vector3();
  const panelNormal = new THREE.Vector3();
  const half = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scaleOne = new THREE.Vector3(1, 1, 1);

  function update(dt: number) {
    time += dt;
    const ease = (rate: number) => (reducedMotion ? 1 : Math.min(1, dt * rate));

    // Intro: the planet rises and the grid starts empty.
    intro = Math.min(1, intro + dt / 1.6);
    const introEase = 1 - Math.pow(1 - intro, 3);

    // Spin with inertia.
    if (!dragging) {
      spinVelocity *= Math.pow(0.04, dt);
      pitchVelocity *= Math.pow(0.04, dt);
      spin += spinVelocity + dt * 0.07;
      pitch += (0.12 - pitch) * Math.min(1, dt * 0.6);
    }

    flowBoost = Math.max(status === 'submitting' ? 2 : 0, flowBoost - dt * 1.1);
    errorLevel = Math.max(0, errorLevel - dt / 1.6);
    shake = Math.max(0, shake - dt * 2.2);
    if (status === 'success') successLevel = Math.min(1, successLevel + dt / 0.9);

    // Pointer parallax.
    pointerSmooth.lerp(pointer, Math.min(1, dt * 2.5));

    world.position.copy(planetHome);
    world.position.y -= (1 - introEase) * 0.6 * planetScale;
    world.scale.setScalar(planetScale * (0.82 + 0.18 * introEase) * (1 + successLevel * 0.12));
    if (shake > 0) {
      world.position.x += Math.sin(time * 70) * 0.03 * shake * planetScale;
      world.position.y += Math.cos(time * 53) * 0.02 * shake * planetScale;
    }
    camera.position.x = pointerSmooth.x * 0.25;
    camera.position.y = -pointerSmooth.y * 0.18;
    camera.lookAt(0, 0, 0);

    planet.rotation.set(pitch, spin, 0);
    world.updateMatrixWorld(true);

    // Sun-related vectors.
    const centre = tmp.setFromMatrixPosition(world.matrixWorld);
    sunLight.position.copy(centre).addScaledVector(sunDir, 10);
    sunLight.target.position.copy(centre);
    sunLight.intensity = 3.1 * (1 - errorLevel * 0.55) + successLevel * 1.2;
    cityUniforms.uSun.value.copy(sunDir);
    cityUniforms.uCenter.value.copy(centre);
    atmosphereUniforms.uSun.value.copy(sunDir);
    atmosphereUniforms.uError.value = errorLevel;

    planet.getWorldQuaternion(planetQuat);
    invQuat.copy(planetQuat).invert();
    sunLocal.copy(sunDir).applyQuaternion(invQuat);
    viewDirLocal.copy(camera.position).sub(centre).normalize().applyQuaternion(invQuat);
    half.copy(sunLocal).add(viewDirLocal).normalize();

    // Panels: track the sun on the day side, stow flat at night.
    dayFarmCount = 0;
    const haloAlpha = farmHalos.geometry.attributes.aAlpha as THREE.BufferAttribute;
    const haloSize = farmHalos.geometry.attributes.aSize as THREE.BufferAttribute;
    farms.forEach((farm, f) => {
      const sunHeight = farm.normal.dot(sunLocal);
      const day = THREE.MathUtils.smoothstep(sunHeight, -0.04, 0.22) * (1 - errorLevel * 0.7);
      farm.day = day;
      if (day > 0.4) dayFarmCount += 1;

      // Direction of the sun projected onto the ground plane.
      towardSun.copy(sunLocal).addScaledVector(farm.normal, -sunHeight);
      const groundLen = towardSun.length();
      const azimuth = groundLen > 1e-4 ? Math.atan2(towardSun.dot(farm.bitangent), towardSun.dot(farm.tangent)) : 0;
      const elevation = Math.atan2(Math.max(sunHeight, 0), groundLen);
      const targetTilt = day > 0.05 ? Math.min(Math.PI / 2 - elevation, 1.05) * day : 0;
      farm.tilt += (targetTilt - farm.tilt) * ease(2.4);

      basis.makeBasis(farm.tangent, farm.normal, farm.bitangent);
      tiltMatrix.makeRotationY(-azimuth);
      basis.multiply(tiltMatrix);
      tiltMatrix.makeRotationZ(-farm.tilt);
      basis.multiply(tiltMatrix);
      quat.setFromRotationMatrix(basis);

      panelNormal.set(0, 1, 0).applyQuaternion(quat);
      const glint = Math.pow(Math.max(panelNormal.dot(half), 0), 30) * day;

      panelOffsets.forEach((offset, k) => {
        tmp2
          .copy(farm.center)
          .addScaledVector(farm.tangent, offset.x)
          .addScaledVector(farm.bitangent, offset.z)
          .addScaledVector(farm.normal, 0.02);
        panelMatrix.compose(tmp2, quat, scaleOne);
        const index = f * panelsPerFarm + k;
        panels.setMatrixAt(index, panelMatrix);
        panelColor.copy(navy).lerp(cell, 0.15 + day * 0.85);
        panelColor.lerp(gold, Math.min(1, glint * 1.4));
        panels.setColorAt(index, panelColor);
      });

      haloAlpha.setX(f, day * (0.35 + 0.25 * Math.min(flowBoost, 1.5)) * introEase);
      haloSize.setX(f, 0.2 + 0.05 * Math.sin(time * 3 + f));
    });
    panels.instanceMatrix.needsUpdate = true;
    if (panels.instanceColor) panels.instanceColor.needsUpdate = true;
    haloAlpha.needsUpdate = true;
    haloSize.needsUpdate = true;

    // Grid charge: the day side fills it, the night side drains it.
    const dayFraction = farms.length ? dayFarmCount / farms.length : 0;
    if (status === 'success') {
      energy += (1 - energy) * Math.min(1, dt * 4);
    } else if (!reducedMotion) {
      const gain = 0.42 * Math.max(dayFraction, 0.25) * (1 + flowBoost) * introEase;
      energy += (gain * (1 - energy) - 0.07 * energy) * dt;
    }
    energy = THREE.MathUtils.clamp(energy, 0, 1);
    cityUniforms.uLit.value = energy * (1 - errorLevel * 0.85);
    cityUniforms.uTime.value = time;
    cityUniforms.uError.value = errorLevel;

    // Arcs: active when the source farm is in daylight.
    const headPos = arcHeads.geometry.attributes.position as THREE.BufferAttribute;
    const headAlpha = arcHeads.geometry.attributes.aAlpha as THREE.BufferAttribute;
    const headSize = arcHeads.geometry.attributes.aSize as THREE.BufferAttribute;
    const headColor = arcHeads.geometry.attributes.aColor as THREE.BufferAttribute;
    const speed = 1 + flowBoost * 1.6 + successLevel * 2;
    arcs.forEach((arc, a) => {
      const source = farms[arc.farm];
      const target = 0.25 + 0.75 * THREE.MathUtils.smoothstep(-arc.cityNormal.dot(sunLocal), -0.4, 0.2);
      const desired = Math.max(source.day, errorLevel) * target * introEase;
      arc.active += (desired - arc.active) * ease(3);
      arc.phase = (((arc.phase + dt * arc.speed * speed) % 1) + 1) % 1;
      const u = arc.material.uniforms;
      u.uTime.value = time;
      u.uActive.value = arc.active;
      u.uSpeed.value = 0.5 * speed;
      u.uError.value = errorLevel;
      arc.curve.getPointAt(arc.phase, tmp2);
      headPos.setXYZ(a, tmp2.x, tmp2.y, tmp2.z);
      headAlpha.setX(a, arc.active * Math.sin(Math.PI * arc.phase));
      headSize.setX(a, 0.11 + 0.05 * Math.min(flowBoost, 2));
      if (errorLevel > 0.05) headColor.setXYZ(a, 1, 0.35, 0.3);
      else headColor.setXYZ(a, 0.7 + arc.phase * 0.3, 0.95 - arc.phase * 0.1, 0.55 - arc.phase * 0.2);
    });
    headPos.needsUpdate = true;
    headAlpha.needsUpdate = true;
    headSize.needsUpdate = true;
    headColor.needsUpdate = true;

    // Satellites ride the ring.
    const satPos = satellites.geometry.attributes.position as THREE.BufferAttribute;
    for (let s = 0; s < 3; s += 1) {
      const angle = time * (0.22 + s * 0.05) * (1 + flowBoost * 0.4) + s * 2.1;
      satPos.setXYZ(s, Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, 0);
    }
    satPos.needsUpdate = true;

    // Sun.
    sunRays.material.rotation = time * 0.03;
    sunRaysMaterial.opacity = (0.32 + 0.1 * Math.sin(time * 0.8) + successLevel * 0.4) * (1 - errorLevel * 0.7) * introEase;
    sunGlow.material.opacity = (1 - errorLevel * 0.5) * (0.3 + 0.7 * introEase);
    starUniforms.uTime.value = time;
  }

  function render(dt: number) {
    update(dt);
    renderer.render(scene, camera);
  }

  /* ---------------------------------------------------------------- loop -- */
  let frame = 0;
  let last = performance.now();
  let disposed = false;

  function emitStats() {
    onStats?.({
      energy: cityUniforms.uLit.value,
      litCities: citySeeds.filter((seed) => seed <= cityUniforms.uLit.value).length,
      totalCities: citySeeds.length,
      dayFarms: dayFarmCount,
      totalFarms: farms.length,
    });
  }

  function tick(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    // rAF timestamps can precede the performance.now() taken at start-up.
    const dt = THREE.MathUtils.clamp((now - last) / 1000, 0, 0.05);
    last = now;
    render(dt);
    statsTimer += dt;
    if (statsTimer > 0.25) {
      statsTimer = 0;
      emitStats();
    }
  }

  function onVisibility() {
    if (reducedMotion || disposed) return;
    if (document.hidden) {
      cancelAnimationFrame(frame);
    } else {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function onResize() {
    layout();
    if (reducedMotion) render(0);
  }

  layout();
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);

  if (reducedMotion) {
    render(0);
    emitStats();
  } else {
    frame = requestAnimationFrame(tick);
  }

  return {
    setStatus(next) {
      if (next === 'error') {
        errorLevel = 1;
        shake = 1;
        energy *= 0.35;
      }
      status = next;
      if (reducedMotion) {
        render(0);
        emitStats();
      }
    },
    pulse() {
      flowBoost = Math.min(2.5, flowBoost + 0.55);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      panels.dispose();
      posts.dispose();
      for (const item of disposables) item.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
