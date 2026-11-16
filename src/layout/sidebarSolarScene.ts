/**
 * Tiny three.js "solar tracker" that rides the active sidebar link: a glossy PV
 * panel on a post follows a small orbiting sun. When the active link changes
 * the panel flips over in the direction of travel and fires a spark of energy.
 * Loaded lazily from SidebarSolarBadge.tsx.
 */
import * as THREE from 'three';

export interface SidebarSolarScene {
  /** Flip toward the new link; direction is +1 (moving down) or -1 (up). */
  flip: (direction: number) => void;
  setHover: (hovered: boolean) => void;
  dispose: () => void;
}

function cellTexture(): THREE.CanvasTexture {
  const w = 192;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const base = ctx.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#1d4fa8');
    base.addColorStop(0.55, '#123a82');
    base.addColorStop(1, '#0b2a63');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 4;
    const gap = 4;
    const cw = (w - gap * (cols + 1)) / cols;
    const ch = (h - gap * (rows + 1)) / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = gap + c * (cw + gap);
        const y = gap + r * (ch + gap);
        const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
        g.addColorStop(0, 'rgba(120,180,255,0.55)');
        g.addColorStop(0.5, 'rgba(40,100,210,0.35)');
        g.addColorStop(1, 'rgba(20,60,150,0.5)');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, cw, ch);
        ctx.fillStyle = 'rgba(200,225,255,0.25)';
        ctx.fillRect(x, y + ch / 2 - 0.5, cw, 1);
      }
    }
    ctx.strokeStyle = 'rgba(220,235,255,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function glowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,250,220,1)');
    g.addColorStop(0.25, 'rgba(255,214,90,0.9)');
    g.addColorStop(0.6, 'rgba(255,170,40,0.25)');
    g.addColorStop(1, 'rgba(255,170,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createSidebarSolarScene(
  canvas: HTMLCanvasElement,
  options: { reducedMotion: boolean },
): SidebarSolarScene {
  const { reducedMotion } = options;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const size = canvas.clientWidth || 44;
  renderer.setSize(size, size, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0.75, 0.7, 3.5);
  camera.lookAt(0, 0.08, 0);

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  scene.add(new THREE.HemisphereLight('#e6fff1', '#1c3d2a', 1.1));
  const sunLight = new THREE.PointLight('#ffd66b', 9, 6, 1.6);
  scene.add(sunLight);

  /* tracker: base -> post -> yaw -> tilt -> panel */
  const tracker = new THREE.Group();
  tracker.position.y = -0.38;
  scene.add(tracker);

  const metal = track(new THREE.MeshStandardMaterial({ color: '#d8e2dc', metalness: 0.7, roughness: 0.3 }));
  const base = new THREE.Mesh(track(new THREE.CylinderGeometry(0.28, 0.34, 0.08, 20)), track(
    new THREE.MeshStandardMaterial({ color: '#2fa35a', metalness: 0.1, roughness: 0.5 }),
  ));
  tracker.add(base);
  const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.055, 0.5, 12)), metal);
  post.position.y = 0.29;
  tracker.add(post);

  const yaw = new THREE.Group();
  yaw.position.y = 0.55;
  tracker.add(yaw);
  const hinge = new THREE.Mesh(track(new THREE.SphereGeometry(0.07, 16, 12)), metal);
  yaw.add(hinge);
  const tilt = new THREE.Group();
  yaw.add(tilt);

  const cells = track(cellTexture());
  const panelGroup = new THREE.Group();
  tilt.add(panelGroup);
  const panelTop = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.2, 0.8)),
    track(
      new THREE.MeshPhysicalMaterial({
        map: cells,
        metalness: 0.35,
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        emissive: new THREE.Color('#ffd34d'),
        emissiveIntensity: 0,
      }),
    ),
  );
  panelTop.rotation.x = -Math.PI / 2;
  panelTop.position.y = 0.031;
  panelGroup.add(panelTop);
  const panelBody = new THREE.Mesh(track(new THREE.BoxGeometry(1.24, 0.06, 0.84)), metal);
  panelGroup.add(panelBody);
  const panelEmissive = panelTop.material as THREE.MeshPhysicalMaterial;

  /* sun */
  const glowMap = track(glowTexture());
  const sun = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: glowMap,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  sun.scale.setScalar(0.5);
  scene.add(sun);

  /* spark: a burst of glowing dots that rise from the panel after a flip */
  const sparkCount = 10;
  const sparkGeometry = track(new THREE.BufferGeometry());
  const sparkPositions = new Float32Array(sparkCount * 3);
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMaterial = track(
    new THREE.PointsMaterial({
      map: glowMap,
      size: 0.22,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    }),
  );
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  scene.add(sparks);
  const sparkSeeds = Array.from({ length: sparkCount }, (_, i) => ({
    angle: (i / sparkCount) * Math.PI * 2,
    speed: 0.7 + ((i * 37) % 10) / 14,
  }));

  /* state */
  let time = 0;
  let flipStart = -10;
  let flipDirection = 1;
  let flipFrom = 0;
  let spin = 0;
  let sparkStart = -10;
  let hover = 0;
  let hoverTarget = 0;
  const flipDuration = 0.9;
  const sunPos = new THREE.Vector3();
  const local = new THREE.Vector3();
  const pivot = new THREE.Vector3();

  function update(dt: number) {
    time += dt;
    hover += (hoverTarget - hover) * Math.min(1, dt * 8);

    // Sun orbit above the tracker.
    const orbit = time * 0.55;
    sunPos.set(Math.cos(orbit) * 0.82, 0.52 + Math.sin(time * 0.9) * 0.06, Math.sin(orbit) * 0.5 + 0.2);
    sun.position.copy(sunPos);
    sunLight.position.copy(sunPos);
    sun.scale.setScalar(0.46 + 0.05 * Math.sin(time * 3) + hover * 0.1);

    // Panel tracks the sun.
    local.copy(sunPos).sub(pivot.set(0, tracker.position.y + yaw.position.y, 0));
    const targetYaw = Math.atan2(local.x, local.z);
    const ground = Math.hypot(local.x, local.z);
    const elevation = Math.atan2(local.y, ground);
    const yawDelta = Math.atan2(Math.sin(targetYaw - yaw.rotation.y), Math.cos(targetYaw - yaw.rotation.y));
    yaw.rotation.y += yawDelta * Math.min(1, dt * 3);
    const trackTilt = Math.PI / 2 - elevation;

    // Flip in the direction of travel.
    const flipT = Math.min(1, (time - flipStart) / flipDuration);
    if (flipT < 1) {
      spin = flipFrom + flipDirection * Math.PI * 2 * easeInOutCubic(flipT);
    } else {
      spin = 0;
    }
    tilt.rotation.x = trackTilt * 0.85 + spin;
    tracker.position.y = -0.38 + Math.sin(Math.min(flipT, 1) * Math.PI) * 0.12 + hover * 0.04;
    tracker.rotation.y = Math.sin(time * 0.6) * 0.08;

    // Charge glow after the flip, and the spark burst.
    const sparkT = (time - sparkStart) / 0.8;
    panelEmissive.emissiveIntensity = sparkT >= 0 && sparkT < 1 ? (1 - sparkT) * 0.55 : hover * 0.18;
    if (sparkT >= 0 && sparkT < 1) {
      sparkMaterial.opacity = 1 - sparkT;
      sparkSeeds.forEach((seed, i) => {
        const r = 0.15 + sparkT * 0.55 * seed.speed;
        sparkPositions[i * 3] = Math.cos(seed.angle) * r;
        sparkPositions[i * 3 + 1] = 0.25 + sparkT * 0.6 * seed.speed;
        sparkPositions[i * 3 + 2] = Math.sin(seed.angle) * r * 0.6;
      });
      sparkGeometry.attributes.position.needsUpdate = true;
    } else {
      sparkMaterial.opacity = 0;
    }
  }

  function render(dt: number) {
    update(dt);
    renderer.render(scene, camera);
  }

  let frame = 0;
  let last = performance.now();
  let accumulator = 0;
  let disposed = false;

  function tick(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = THREE.MathUtils.clamp((now - last) / 1000, 0, 0.1);
    last = now;
    const busy = time - flipStart < flipDuration + 0.1 || time - sparkStart < 0.9 || Math.abs(hover - hoverTarget) > 0.01;
    accumulator += dt;
    // Idle at ~30 fps; full rate while flipping or hovering.
    if (!busy && accumulator < 1 / 30) {
      return;
    }
    render(accumulator);
    accumulator = 0;
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
  document.addEventListener('visibilitychange', onVisibility);

  if (reducedMotion) {
    time = 1.2;
    render(0);
  } else {
    frame = requestAnimationFrame(tick);
  }

  return {
    flip(direction) {
      if (reducedMotion) return;
      flipFrom = spin;
      flipDirection = direction >= 0 ? 1 : -1;
      flipStart = time;
      sparkStart = time + flipDuration * 0.75;
    },
    setHover(hovered) {
      hoverTarget = hovered ? 1 : 0;
      if (reducedMotion) {
        hover = hoverTarget;
        render(0);
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const item of disposables) item.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
