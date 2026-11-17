import {
  AmbientLight,
  BufferGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LinearFilter,
  Mesh,
  MeshToonMaterial,
  NearestFilter,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector4,
  WebGLRenderer,
} from "three";

export type TownFocus = "desk" | "letter" | "box" | "tree" | "listen" | "almanac" | null;

export interface TownSceneMetrics {
  frames: number;
  fps: number;
  drawCalls: number;
  triangles: number;
  pixelRatio: number;
  renderMs: number;
  quality: "full" | "economy";
}

export interface TownSceneHandle {
  setPaused(paused: boolean): void;
  setFocus(target: TownFocus): void;
  resize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}

interface TownSceneOptions {
  onReady(): void;
  onFailure(): void;
  onMetrics?(metrics: TownSceneMetrics): void;
}

const ART_WIDTH = 1536;
const ART_HEIGHT = 1024;

const artworkVertexShader = /* glsl */ `
  varying vec2 artworkUv;

  void main() {
    artworkUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const artworkFragmentShader = /* glsl */ `
  uniform sampler2D artwork;
  uniform float time;
  uniform vec4 focus;
  uniform float vaneFocus;
  uniform float breeze;
  varying vec2 artworkUv;

  float region(vec2 point, vec2 center, vec2 radius) {
    vec2 distance = (point - center) / radius;
    return 1.0 - smoothstep(0.35, 1.0, dot(distance, distance));
  }

  void main() {
    // Landmark coordinates use the illustration's top-left origin.
    vec2 point = vec2(artworkUv.x, 1.0 - artworkUv.y);
    vec2 samplePoint = point;

    float canopy = region(point, vec2(0.835, 0.556), vec2(0.170, 0.140));
    float outerLeaves = region(point, vec2(0.740, 0.685), vec2(0.100, 0.085));
    float treeWind = sin(time * 0.91 + point.y * 13.0);
    samplePoint.x += canopy * treeWind * (0.00135 + focus.x * 0.0010) * breeze;
    samplePoint.y += canopy * sin(time * 1.12 + point.x * 12.0) * 0.00055 * breeze;
    samplePoint.x += outerLeaves * sin(time * 1.04) * 0.0007 * breeze;

    float deskLeaves = region(point, vec2(0.345, 0.755), vec2(0.051, 0.096));
    samplePoint.x += deskLeaves * sin(time * 1.15 + point.y * 8.0) * (0.0007 + focus.y * 0.0009) * breeze;
    float towerLeaves = region(point, vec2(0.084, 0.358), vec2(0.058, 0.085));
    samplePoint.x += towerLeaves * sin(time * 0.83 + 1.2) * 0.00055 * breeze;

    // Move the existing bird's feather tips, leaving its letter readable.
    float upperWing = region(point, vec2(0.539, 0.096), vec2(0.029, 0.046));
    float leftWing = region(point, vec2(0.502, 0.117), vec2(0.046, 0.027));
    samplePoint.y += (upperWing + leftWing * 0.55) * sin(time * 2.25) * 0.0020;

    vec2 flagPivot = vec2(0.674, 0.547);
    vec2 flagLocal = (point - flagPivot) * vec2(1536.0, 1024.0);
    float flagRegion = region(point, vec2(0.679, 0.526), vec2(0.013, 0.030));
    float flagAngle = focus.z * 0.09 + sin(time * 0.87) * 0.012;
    mat2 flagTurn = mat2(cos(flagAngle), -sin(flagAngle), sin(flagAngle), cos(flagAngle));
    samplePoint += (flagTurn * flagLocal - flagLocal) / vec2(1536.0, 1024.0) * flagRegion;

    float vaneRegion = region(point, vec2(0.181, 0.069), vec2(0.065, 0.037));
    samplePoint.x += vaneRegion * sin(time * 0.47) * (0.00055 + vaneFocus * 0.0013);

    vec2 sampleUv = vec2(samplePoint.x, 1.0 - samplePoint.y);
    vec4 paper = texture2D(artwork, clamp(sampleUv, 0.0, 1.0));
    float windowLight = region(point, vec2(0.873, 0.258), vec2(0.023, 0.042)) * focus.w;
    paper.rgb *= mix(vec3(1.0), vec3(1.045, 1.025, 0.995), windowLight);
    gl_FragColor = paper;
    #include <colorspace_fragment>
  }
`;

interface SmokePuff {
  mesh: Mesh<IcosahedronGeometry, MeshToonMaterial>;
  x: number;
  y: number;
  phase: number;
  size: number;
}

interface FloatingLeaf {
  mesh: Mesh<BufferGeometry, MeshToonMaterial>;
  x: number;
  y: number;
  phase: number;
  area: "tree" | "desk";
}

function illustrationPosition(x: number, y: number) {
  return { x: (x - 0.5) * ART_WIDTH, y: (0.5 - y) * ART_HEIGHT };
}

function leafGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    0, -1, 0,
    -0.52, -0.12, 0,
    0, 1, 0,
    0, 0, 0.23,
    0.52, 0.12, 0,
  ], 3));
  geometry.setIndex([0, 1, 3, 1, 2, 3, 2, 4, 3, 4, 0, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

/** Lazy-loaded by the React scenery layer. All browser work begins inside this call. */
export async function createTownScene(canvas: HTMLCanvasElement, options: TownSceneOptions): Promise<TownSceneHandle> {
  const context = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    stencil: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  });
  if (!context) {
    options.onFailure();
    throw new Error("Town scenery requires WebGL 2.");
  }

  const renderer = new WebGLRenderer({ canvas, context, antialias: false, alpha: false });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(new Color("#fff8e7"), 1);
  const scene = new Scene();
  const camera = new OrthographicCamera(-ART_WIDTH / 2, ART_WIDTH / 2, ART_HEIGHT / 2, -ART_HEIGHT / 2, 0.1, 2000);
  camera.position.z = 1000;

  let artworkTexture: Texture | undefined;
  let artworkGeometry: PlaneGeometry | undefined;
  let artworkMaterial: ShaderMaterial | undefined;
  const puffGeometry = new IcosahedronGeometry(1, 1);
  const floatingLeafGeometry = leafGeometry();
  const toonSteps = new DataTexture(new Uint8Array([135, 205, 255]), 3, 1, RedFormat);
  toonSteps.minFilter = NearestFilter;
  toonSteps.magFilter = NearestFilter;
  toonSteps.generateMipmaps = false;
  toonSteps.needsUpdate = true;
  const leafMaterial = new MeshToonMaterial({
    color: "#9da773",
    gradientMap: toonSteps,
    side: DoubleSide,
    forceSinglePass: true,
    transparent: true,
    opacity: 0.64,
    depthWrite: false,
  });
  const puffMaterials: MeshToonMaterial[] = [];
  const smoke: SmokePuff[] = [];
  const leaves: FloatingLeaf[] = [];
  const focus = new Vector4();
  const desiredFocus = new Vector4();
  let desiredVaneFocus = 0;
  let vaneFocus = 0;
  let disposed = false;
  let failed = false;
  let paused = true;
  let animationFrame = 0;
  let elapsed = 0;
  let lastPaint = 0;
  let frameCount = 0;
  let metricsFrames = 0;
  let metricsStart = performance.now();
  let motionStarted = metricsStart;
  let slowSamples = 0;
  let measuredFps = 0;
  let renderCost = 0;
  let mobile = window.matchMedia("(max-width: 780px)").matches;
  let economy = mobile;
  let degraded = false;
  let requestedPixelRatio = 1;
  let width = ART_WIDTH;
  let height = ART_HEIGHT;

  function publishMetrics(now = performance.now()) {
    options.onMetrics?.({
      frames: frameCount,
      fps: paused ? 0 : measuredFps,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      pixelRatio: renderer.getPixelRatio(),
      renderMs: Math.round(renderCost * 100) / 100,
      quality: economy ? "economy" : "full",
    });
    metricsFrames = 0;
    metricsStart = now;
  }

  function cancelAnimation() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function fail() {
    if (failed || disposed) return;
    failed = true;
    paused = true;
    cancelAnimation();
    options.onFailure();
  }

  function contextLost(event: Event) {
    event.preventDefault();
    fail();
  }
  canvas.addEventListener("webglcontextlost", contextLost);
  renderer.debug.onShaderError = fail;

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimation();
    canvas.removeEventListener("webglcontextlost", contextLost);
    artworkTexture?.dispose();
    artworkGeometry?.dispose();
    artworkMaterial?.dispose();
    puffGeometry.dispose();
    floatingLeafGeometry.dispose();
    toonSteps.dispose();
    leafMaterial.dispose();
    for (const material of puffMaterials) material.dispose();
    scene.clear();
    renderer.dispose();
    if (!context?.isContextLost()) renderer.forceContextLoss();
  }

  function applyResolution() {
    const maximum = mobile ? 1 : 1.25;
    const pixelRatio = degraded ? Math.min(requestedPixelRatio * 0.8, 0.8) : Math.min(requestedPixelRatio, maximum);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    economy = mobile || degraded;
    smoke.forEach((puff, index) => { puff.mesh.visible = !economy || index % 2 === 0; });
    leaves.forEach((leaf, index) => { leaf.mesh.visible = !economy || index % 2 === 0; });
  }

  function paint() {
    if (disposed || failed || !artworkMaterial) return;
    focus.lerp(desiredFocus, 0.1);
    vaneFocus += (desiredVaneFocus - vaneFocus) * 0.1;
    artworkMaterial.uniforms.time.value = elapsed;
    artworkMaterial.uniforms.vaneFocus.value = vaneFocus;
    artworkMaterial.uniforms.breeze.value = economy ? 0.72 : 1;

    for (const puff of smoke) {
      const age = ((elapsed * 0.09 + puff.phase) % 1 + 1) % 1;
      const fade = Math.sin(age * Math.PI);
      puff.mesh.position.set(
        puff.x + Math.sin(age * 3 + puff.phase * 7) * 9 + age * 11,
        puff.y + age * 47,
        4,
      );
      const size = puff.size * (0.7 + age * 1.35);
      puff.mesh.scale.set(size * 1.35, size * 0.8, size * 0.35);
      puff.mesh.rotation.z = age * 0.3;
      puff.mesh.material.opacity = fade * 0.15;
    }

    for (const leaf of leaves) {
      const localFocus = leaf.area === "tree" ? focus.x : focus.y;
      const cycle = elapsed * 0.37 + leaf.phase;
      leaf.mesh.position.set(
        leaf.x + Math.sin(cycle) * (2.3 + localFocus * 3),
        leaf.y + Math.cos(cycle * 1.3) * 1.3,
        8,
      );
      leaf.mesh.rotation.set(Math.sin(cycle * 0.8) * 0.6, Math.cos(cycle) * 0.48, Math.sin(cycle) * 0.48 + leaf.phase);
    }

    const start = performance.now();
    try { renderer.render(scene, camera); }
    catch { fail(); return; }
    const cost = performance.now() - start;
    renderCost = frameCount > 1 ? renderCost * 0.88 + cost * 0.12 : cost;
    frameCount++;
    metricsFrames++;
    // Shader compilation is excluded from the quality decision.
    if (!degraded && frameCount > 30 && renderCost > 14) {
      degraded = true;
      applyResolution();
    }
  }

  function animate(now: number) {
    if (paused || disposed || failed) return;
    animationFrame = requestAnimationFrame(animate);
    const interval = 1000 / (degraded ? 20 : mobile ? 24 : 30);
    if (now - lastPaint < interval - 1) return;
    elapsed += Math.min((now - lastPaint) / 1000, 0.1);
    lastPaint = now;
    paint();
    const sampleMs = now - metricsStart;
    if (sampleMs >= 1000) {
      measuredFps = Math.round(metricsFrames * 1000 / sampleMs);
      const targetFps = mobile ? 24 : 30;
      if (!degraded && metricsStart - motionStarted >= 2000) {
        slowSamples = measuredFps < targetFps * 0.65 ? slowSamples + 1 : 0;
        if (slowSamples >= 2) {
          degraded = true;
          applyResolution();
        }
      }
      publishMetrics(now);
    }
  }

  function resize(nextWidth: number, nextHeight: number, pixelRatio: number) {
    if (disposed || failed) return;
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    requestedPixelRatio = Math.max(0.1, pixelRatio);
    mobile = window.matchMedia("(max-width: 780px)").matches;
    const aspect = width / height;
    const viewHeight = Math.max(ART_HEIGHT, ART_WIDTH / aspect);
    camera.left = -viewHeight * aspect / 2;
    camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    applyResolution();
    paint();
    publishMetrics();
  }

  try {
    artworkTexture = await new TextureLoader().loadAsync("/art/elsewhere-town-gentle.png");
    if (disposed || failed) throw new Error("Town scenery was interrupted.");
    artworkTexture.colorSpace = SRGBColorSpace;
    artworkTexture.minFilter = LinearFilter;
    artworkTexture.magFilter = LinearFilter;
    artworkTexture.generateMipmaps = false;
    artworkMaterial = new ShaderMaterial({
      uniforms: {
        artwork: { value: artworkTexture },
        time: { value: 0 },
        focus: { value: focus },
        vaneFocus: { value: 0 },
        breeze: { value: 1 },
      },
      vertexShader: artworkVertexShader,
      fragmentShader: artworkFragmentShader,
      toneMapped: false,
      depthWrite: false,
    });
    artworkGeometry = new PlaneGeometry(ART_WIDTH, ART_HEIGHT);
    scene.add(new Mesh(artworkGeometry, artworkMaterial));
    scene.add(new AmbientLight("#fff7e5", 2.5));
    const light = new DirectionalLight("#fff7de", 1.4);
    light.position.set(-300, 500, 800);
    scene.add(light);

    const chimneys = [{ x: 0.391, y: 0.235, count: 4, size: 7 }, { x: 0.919, y: 0.042, count: 2, size: 6 }];
    for (const chimney of chimneys) {
      const anchor = illustrationPosition(chimney.x, chimney.y);
      for (let index = 0; index < chimney.count; index++) {
        const material = new MeshToonMaterial({ color: "#d3d5bb", gradientMap: toonSteps, transparent: true, opacity: 0, depthWrite: false });
        puffMaterials.push(material);
        const mesh = new Mesh(puffGeometry, material);
        mesh.renderOrder = 1;
        scene.add(mesh);
        smoke.push({ mesh, ...anchor, phase: index / chimney.count, size: chimney.size });
      }
    }

    const leafAnchors = [
      { x: 0.742, y: 0.476, area: "tree" as const },
      { x: 0.923, y: 0.517, area: "tree" as const },
      { x: 0.792, y: 0.626, area: "tree" as const },
      { x: 0.944, y: 0.643, area: "tree" as const },
      { x: 0.345, y: 0.731, area: "desk" as const },
      { x: 0.365, y: 0.786, area: "desk" as const },
    ];
    leafAnchors.forEach((anchor, index) => {
      const mesh = new Mesh(floatingLeafGeometry, leafMaterial);
      const size = index < 4 ? 4.2 : 3.6;
      mesh.scale.set(size * 0.8, size, size);
      mesh.renderOrder = 2;
      scene.add(mesh);
      leaves.push({ mesh, ...illustrationPosition(anchor.x, anchor.y), area: anchor.area, phase: index * 1.7 });
    });

    const bounds = canvas.getBoundingClientRect();
    resize(bounds.width || ART_WIDTH, bounds.height || ART_HEIGHT, Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.25));
    if (failed) throw new Error("Town scenery could not be drawn.");
    options.onReady();
    return {
      setPaused(nextPaused) {
        if (disposed || failed || paused === nextPaused) return;
        paused = nextPaused;
        cancelAnimation();
        lastPaint = performance.now();
        motionStarted = lastPaint;
        slowSamples = 0;
        if (!paused) animationFrame = requestAnimationFrame(animate);
        publishMetrics();
      },
      setFocus(target) {
        desiredFocus.set(Number(target === "tree"), Number(target === "desk"), Number(target === "box" || target === "letter"), Number(target === "listen"));
        desiredVaneFocus = Number(target === "almanac");
      },
      resize,
      dispose,
    };
  } catch (error) {
    fail();
    dispose();
    throw error;
  }
}
