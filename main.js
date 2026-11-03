// ============================================================
//  AGRIGATE.ASIA — Interactive 3D Bangladesh Map
//  Three.js Engine with Accurate Vector Geometry from SVG
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { MAP_CONFIG, BRANCH_TYPES } from './data.js?v=37';
import { DEFAULT_TRANSFORMS } from './modelTransforms.js?v=37';
import { BANGLADESH_GEO } from './bangladeshGeo.js';

// ============================================================
//  GLOBALS
// ============================================================
let scene, camera, renderer, controls;
let mapGroup, markersGroup, beamsGroup;
let raycaster, mouse;
let districtMeshes = [];
let markerObjects = [];
let beamAnimations = [];
let activePopup = null;
let isZoomedIn = false;
let hoveredDistrict = null;
let selectedDistrict = null;
let hqBadge, resetBtn;
let clock;
let activeFocusLight = null;
let activeMarkerGroup = null;

// Auto-Panning State
let isAutoPanning = false;
let autoPanResumeTimer = null;
let cameraAnimId = null;

// 3D Model Editor State
let transformControls;
let isEditorActive = false;
let selectedMarkerGroup = null;
let savedTransforms = {};

const MAP_DEPTH = 0.3;
const gltfLoader = new GLTFLoader();
const MODEL_TEMPLATES = {};

// ============================================================
//  HELPERS & COORDINATE LOOKUPS
// ============================================================
// District name alias normalization for SVG vector map
const DISTRICT_ALIASES = {
  'bogura': 'Bogra',
  'bogra': 'Bogra',
  'bagura': 'Bogra',
  'natore': 'Nator',
  'nator': 'Nator',
  'jashore': 'Jessore',
  'jessore': 'Jessore',
  'cumilla': 'Comilla',
  'comilla': 'Comilla',
  'chattagong': 'Chittagong',
  'chattogram': 'Chittagong',
  'chapainababganj': 'Nawabganj',
  'chapainawabganj': 'Nawabganj',
  'nawabganj': 'Nawabganj',
  'nilphamari': 'Nilfamari',
  'nilfamari': 'Nilfamari',
  'jhenaidah': 'Jhinaidaha',
  'jhinaidaha': 'Jhinaidaha',
  'moulvibazar': 'Maulvibazar',
  'maulvibazar': 'Maulvibazar',
  'satkhira': 'Shatkhira',
  'shatkhira': 'Shatkhira',
  'sherpur': 'Sherpur',
  'shirajganj': 'Sirajganj',
  'sirajganj': 'Sirajganj',
  'jaipur haat': 'Jaipurhat',
  'jaipurhat': 'Jaipurhat',
  'joypurhat': 'Jaipurhat',
  'gaibandha': 'Gaibandha',
  'lakshmipur': 'Lakshmipur',
  'chandpur': 'Chandpur',
  'lalmonirhat': 'Lalmonirhat',
};

function normalizeDistrictName(name) {
  if (!name) return '';
  const clean = name.trim().toLowerCase();
  return DISTRICT_ALIASES[clean] || name;
}

function getDistrictWorldPos(districtName) {
  const normName = normalizeDistrictName(districtName);

  // Check exact or normalized match in textCenters
  if (BANGLADESH_GEO.textCenters && BANGLADESH_GEO.textCenters[normName]) {
    const [x, z] = BANGLADESH_GEO.textCenters[normName];
    return new THREE.Vector3(x, MAP_DEPTH, z);
  }
  
  // Look up by district property in districts
  const found = BANGLADESH_GEO.districts.find(
    d => d.district.toLowerCase() === normName.toLowerCase() ||
         d.district.toLowerCase() === districtName.toLowerCase()
  );
  if (found) {
    return new THREE.Vector3(found.center[0], MAP_DEPTH, found.center[1]);
  }
  
  // Default fallback (Dhaka center)
  return new THREE.Vector3(-0.45, MAP_DEPTH, -0.37);
}

function worldToScreen(position) {
  const vec = position.clone().project(camera);
  const container = renderer.domElement;
  return {
    x: (vec.x * 0.5 + 0.5) * container.clientWidth,
    y: (-vec.y * 0.5 + 0.5) * container.clientHeight,
  };
}

/**
 * Returns the actual world position of a marker's 3D model (taking into account any
 * custom position translations from editor adjustments or localStorage).
 */
function getModelWorldPos(markerGroup) {
  if (!markerGroup) return new THREE.Vector3();
  const wp = new THREE.Vector3();
  if (markerGroup.userData?.modelMesh) {
    markerGroup.userData.modelMesh.getWorldPosition(wp);
    return wp;
  }
  markerGroup.getWorldPosition(wp);
  return wp;
}

// ============================================================
//  PRELOAD CUSTOM 3D GLB MODELS (Scaled to 0.30x)
// ============================================================
async function loadModelTemplates() {
  const models = [
    { type: 'Headquarters',  path: './assets/3d Files/Head Office.glb' },
    { type: 'CBF',           path: './assets/3d Files/Branch.glb' },
    { type: 'CFF',           path: './assets/3d Files/Branch.glb' },
    { type: 'Supply Chain',  path: './assets/3d Files/Supply Chain.glb' },
    { type: 'Egg Warehouse', path: './assets/3d Files/warehouse.glb' },
    { type: 'Feedmill',      path: './assets/3d Files/feedmill.glb' },
    { type: 'Breeders Farm', path: './assets/3d Files/breeders farm.glb' },
  ];

  await Promise.all([
    ...models.map(async m => {
      try {
        const gltf = await gltfLoader.loadAsync(encodeURI(m.path));
        const model = gltf.scene;

        // Compute normals & assign PBR material (solid green for CBF, solid blue for CFF, vertexColors for others)
        model.traverse(child => {
          if (child.isMesh) {
            if (child.geometry && !child.geometry.attributes.normal) {
              child.geometry.computeVertexNormals();
            }
            if (m.type === 'CBF') {
              // Remove textures & vertex colors, give clean solid emerald green
              child.material = new THREE.MeshStandardMaterial({
                color: 0x2ecc71,
                roughness: 0.35,
                metalness: 0.15,
              });
            } else if (m.type === 'CFF') {
              // Remove textures & vertex colors, give clean solid blue for CFF branch
              child.material = new THREE.MeshStandardMaterial({
                color: 0x00a8ff,
                roughness: 0.35,
                metalness: 0.15,
              });
            } else if (m.type === 'Egg Warehouse') {
              // Remove textures & vertex colors, give clean solid purple for Egg Warehouse
              child.material = new THREE.MeshStandardMaterial({
                color: 0xa855f7,
                roughness: 0.35,
                metalness: 0.15,
              });
            } else if (m.type === 'Feedmill' || m.type === 'Breeders Farm') {
              // Remove textures & vertex colors, give clean solid industrial grey
              if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(mat => mat.dispose?.());
                else child.material.dispose?.();
              }
              child.material = new THREE.MeshStandardMaterial({
                color: 0x8a929b,
                roughness: 0.38,
                metalness: 0.20,
              });
            } else {
              child.material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.35,
                metalness: 0.15,
              });
            }
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Calculate bounds
        const bbox = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        // Center horizontally and align base to y = 0
        model.position.x = -center.x;
        model.position.z = -center.z;
        model.position.y = -bbox.min.y;

        // Wrap in pivot group with scale (0.01 for Egg Warehouse, 0.015 for Feedmill, 0.03 for Breeders Farm, 0.165 for CBF/CFF Branch, 0.20 for others)
        const pivot = new THREE.Group();
        pivot.add(model);
        let s = 0.20;
        if (m.type === 'Egg Warehouse') s = 0.01;
        else if (m.type === 'Feedmill') s = 0.015;
        else if (m.type === 'Breeders Farm') s = 0.03;
        else if (m.type === 'CBF' || m.type === 'CFF') s = 0.165;
        pivot.scale.set(s, s, s);

        MODEL_TEMPLATES[m.type] = pivot;
        if (m.type === 'Feedmill') {
          MODEL_TEMPLATES['Agrigate Feed Limited'] = pivot;
        }
        if (m.type === 'Breeders Farm') {
          MODEL_TEMPLATES['Agrigate Farm Limited'] = pivot;
        }
      } catch (err) {
        console.warn('Could not load GLB model for', m.type, err);
      }
    }),
    loadLogoModelTemplate(),
  ]);
}

// Glowing light textures & configs per branch type
const GLOW_TEXTURE_CACHE = {};
function getGlowTexture(colorStr) {
  if (GLOW_TEXTURE_CACHE[colorStr]) return GLOW_TEXTURE_CACHE[colorStr];
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, colorStr);
  grad.addColorStop(0.35, colorStr);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  GLOW_TEXTURE_CACHE[colorStr] = texture;
  return texture;
}

const GLOW_CONFIG = {
  'Headquarters':      { hex: 0x2ecc71, css: 'rgba(46, 204, 113, 0.50)', height: 0.50 },
  'CBF':               { hex: 0x2ecc71, css: 'rgba(46, 204, 113, 0.50)', height: 0.30 },
  'CFF':               { hex: 0x00e5ff, css: 'rgba(0, 229, 255, 0.50)',  height: 0.30 },
  'Egg Warehouse':     { hex: 0xa855f7, css: 'rgba(168, 85, 247, 0.50)', height: 0.28 },
  'Agrigate Factories':{ hex: 0x00e676, css: 'rgba(0, 230, 118, 0.50)', height: 0.32 },
  'Supply Chain':      { hex: 0xff7a00, css: 'rgba(255, 122, 0, 0.50)',   height: 0.42 },
};

// ============================================================
//  FLOATING 3D AGRIGATE LOGO (EXACT SVG SILHOUETTE)
// ============================================================
const svgLoader = new SVGLoader();
let MASTER_LOGO_MODEL = null;

async function loadLogoModelTemplate() {
  if (MASTER_LOGO_MODEL) return MASTER_LOGO_MODEL;

  try {
    const svgData = await svgLoader.loadAsync('assets/agrigatelogo.svg');
    const logoGroup = new THREE.Group();

    // Clean authentic PBR materials matching SVG brand colors
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.15,
    });
    const limeMat = new THREE.MeshStandardMaterial({
      color: 0xbcd978,
      roughness: 0.25,
      metalness: 0.15,
    });
    const deepGreenMat = new THREE.MeshStandardMaterial({
      color: 0x407939,
      roughness: 0.25,
      metalness: 0.15,
    });

    // Extrusion settings:
    // White 4-lobed backing shape: depth 0.8 with smooth bevels
    // Petals: depth 0.25 slightly raised on front (+Z) and back (-Z)
    svgData.paths.forEach((path, pIdx) => {
      const shapes = SVGLoader.createShapes(path);
      if (!shapes || shapes.length === 0) return;

      if (pIdx === 0) {
        // White backing clover/flower contour
        const whiteGeo = new THREE.ExtrudeGeometry(shapes, {
          depth: 0.8,
          bevelEnabled: true,
          bevelThickness: 0.18,
          bevelSize: 0.18,
          bevelSegments: 2,
        });
        const whiteMesh = new THREE.Mesh(whiteGeo, whiteMat);
        whiteMesh.castShadow = true;
        logoGroup.add(whiteMesh);
      } else {
        // Petal shapes (1..4 lime, 5..8 deep green)
        const mat = (pIdx <= 4) ? limeMat : deepGreenMat;

        // Front face petals (raised on +Z)
        const frontGeo = new THREE.ExtrudeGeometry(shapes, {
          depth: 0.25,
          bevelEnabled: true,
          bevelThickness: 0.08,
          bevelSize: 0.08,
          bevelSegments: 1,
        });
        const frontMesh = new THREE.Mesh(frontGeo, mat);
        frontMesh.position.z = 0.82;
        logoGroup.add(frontMesh);

        // Back face petals (raised on -Z)
        const backGeo = new THREE.ExtrudeGeometry(shapes, {
          depth: 0.25,
          bevelEnabled: true,
          bevelThickness: 0.08,
          bevelSize: 0.08,
          bevelSegments: 1,
        });
        const backMesh = new THREE.Mesh(backGeo, mat);
        backMesh.position.z = -0.27;
        logoGroup.add(backMesh);
      }
    });

    // Center geometry around (0, 0, 0)
    const bbox = new THREE.Box3().setFromObject(logoGroup);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    logoGroup.position.set(-center.x, -center.y, -center.z);

    const pivot = new THREE.Group();
    pivot.add(logoGroup);

    // SVG coordinates have Y increasing downward.
    // Scale factor: scale SVG dimensions (~30 units) down to ~0.26 Three.js world units.
    // Using (s, -s, -s) inverts Y while keeping positive determinant (no inverted normals).
    const s = 0.26 / 30;
    pivot.scale.set(s, -s, -s);

    MASTER_LOGO_MODEL = new THREE.Group();
    MASTER_LOGO_MODEL.add(pivot);
    return MASTER_LOGO_MODEL;
  } catch (err) {
    console.warn('Could not load exact-shape SVG logo:', err);
    return null;
  }
}

function createFloatingLogoMedallion() {
  if (!MASTER_LOGO_MODEL) return null;
  const clone = MASTER_LOGO_MODEL.clone(true);
  // Clone materials so this medallion can have independent emissive / glow states
  clone.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      child.userData.origEmissive = child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000);
      child.userData.origEmissiveIntensity = child.material.emissiveIntensity ?? 0;
      child.userData.isPetal = (child.material.color.getHex() !== 0xffffff);
    }
  });
  clone.userData = {
    isMedallion: true,
    baseScale: 1.0,
  };
  return clone;
}

// Stylized procedural 3D Box Factory landmark for Agrigate Factories
function createFactoryBoxMesh() {
  const group = new THREE.Group();

  // Foundation plinth
  const baseGeo = new THREE.BoxGeometry(0.32, 0.04, 0.28);
  baseGeo.translate(0, 0.02, 0);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.2,
  });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Main 3D Box Factory building (solid vibrant emerald green theme)
  const mainGeo = new THREE.BoxGeometry(0.28, 0.22, 0.24);
  mainGeo.translate(0, 0.04 + 0.11, 0);
  const mainMat = new THREE.MeshStandardMaterial({
    color: 0x00e676,
    roughness: 0.35,
    metalness: 0.18,
  });
  const mainMesh = new THREE.Mesh(mainGeo, mainMat);
  mainMesh.castShadow = true;
  mainMesh.receiveShadow = true;
  group.add(mainMesh);

  // Industrial rooftop box machinery / skylight unit
  const roofGeo = new THREE.BoxGeometry(0.18, 0.06, 0.16);
  roofGeo.translate(0, 0.26 + 0.03, 0);
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x059669,
    roughness: 0.4,
    metalness: 0.25,
  });
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.castShadow = true;
  group.add(roofMesh);

  // Front factory entrance canopy box
  const doorGeo = new THREE.BoxGeometry(0.08, 0.08, 0.04);
  doorGeo.translate(0, 0.04 + 0.04, 0.12 + 0.02);
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x064e3b,
    roughness: 0.3,
  });
  const doorMesh = new THREE.Mesh(doorGeo, doorMat);
  group.add(doorMesh);

  return group;
}

// Stylized procedural 3D Warehouse for Egg Warehouse hubs (0.20x proportion)
function createEggWarehouseMesh() {
  const group = new THREE.Group();

  // Warehouse shed body
  const w = 0.28, h = 0.17, d = 0.22;
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  bodyGeo.translate(0, h / 2, 0);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x7e22ce,
    roughness: 0.45,
    metalness: 0.1,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Gable roof
  const roofH = 0.08;
  const roofGeo = new THREE.CylinderGeometry(0.18, 0.18, d + 0.03, 3);
  roofGeo.rotateZ(Math.PI / 2);
  roofGeo.rotateY(Math.PI / 2);
  roofGeo.translate(0, h + roofH / 2, 0);
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    roughness: 0.35,
    metalness: 0.2,
  });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  group.add(roof);

  // Small golden lantern beacon on roof ridge
  const tipGeo = new THREE.OctahedronGeometry(0.04, 0);
  tipGeo.translate(0, h + roofH + 0.04, 0);
  const tipMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
  group.add(new THREE.Mesh(tipGeo, tipMat));

  return group;
}

// Procedural fallback marker if a model file is missing
function createFallbackMesh(colorVal, isHQ) {
  const group = new THREE.Group();
  const w = isHQ ? 0.24 : 0.16;
  const h = isHQ ? 0.45 : 0.28;
  const geo = new THREE.BoxGeometry(w, h, w);
  geo.translate(0, h / 2, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorVal),
    roughness: 0.3,
    metalness: 0.2,
  });
  group.add(new THREE.Mesh(geo, mat));
  return group;
}

// Responsive camera frustum calculation so Bangladesh is never clipped on mobile/portrait screens
function getFitCameraPosition() {
  const section = document.getElementById('network-map') || document.body;
  const width = section.clientWidth || window.innerWidth;
  const height = section.clientHeight || window.innerHeight;
  const aspect = width / height;

  // Bangladesh geographic bounds: width ~22, height ~27
  const fovRad = THREE.MathUtils.degToRad(camera ? camera.fov : 45);
  const tanHalf = Math.tan(fovRad / 2);

  // Height required to fit 27 units vertically with ~18% padding
  const distH = (27 / 2) / tanHalf;
  // Width required to fit 22 units horizontally with ~18% padding
  const distW = (22 / 2) / (tanHalf * aspect);

  const targetY = Math.max(distH, distW) * 1.18;
  return new THREE.Vector3(0, Math.max(36, targetY), 0.001);
}

// ============================================================
//  INITIALIZATION
// ============================================================
async function init() {
  try {
    clock = new THREE.Clock();
    const container = document.getElementById('map-canvas');
    const section = document.getElementById('network-map');
    const { theme } = MAP_CONFIG;

    const width = section.clientWidth || window.innerWidth;
    const height = section.clientHeight || window.innerHeight;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.backgroundColor);
    const isLightBg = (theme.backgroundColor.toLowerCase() === '#ffffff' || theme.backgroundColor.toLowerCase() === '#fff');
    if (!isLightBg) {
      scene.fog = new THREE.FogExp2(theme.backgroundColor, 0.012);
    }

    // Camera (responsive frustum fitting)
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500);
    const fitPos = getFitCameraPosition();
    camera.position.copy(fitPos);
    camera.lookAt(0, 0, 0);

    // Renderer (optimized pixel ratio for mobile vs desktop)
    renderer = new THREE.WebGLRenderer({ canvas: container, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    const isMobile = (window.innerWidth <= 768);
    renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.panSpeed = 0.6;
    controls.enableZoom = true;
    controls.minDistance = 6;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.set(0, 0, 0);
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.6;

    controls.addEventListener('start', onControlsInteractionStart);
    controls.addEventListener('end', onControlsInteractionEnd);

    // Raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Groups
    mapGroup = new THREE.Group();
    markersGroup = new THREE.Group();
    beamsGroup = new THREE.Group();
    scene.add(mapGroup, markersGroup, beamsGroup);

    // Build scene
    createLighting();
    createDistrictMap();

    loadSavedTransforms();

    // Load custom 3D models before spawning markers
    await loadModelTemplates();

    createMarkers();
    createBeams();
    setupHQBadge();
    setupResetButton();
    setupModelEditor();

    // Event listeners
    window.addEventListener('resize', onResize);
    container.addEventListener('click', onMapClick);
    container.addEventListener('mousemove', onMapHover);

    // Hide loader
    setTimeout(() => {
      document.querySelector('.map-loader')?.classList.add('hidden');
      hqBadge?.classList.add('visible');
    }, 400);

    animate();
  } catch (err) {
    console.error('Map init error:', err);
    const loader = document.querySelector('.map-loader');
    if (loader) {
      loader.querySelector('.loader-text').textContent = 'Error rendering map: ' + err.message;
    }
  }
}

// ============================================================
//  LIGHTING
// ============================================================
function createLighting() {
  const isLightBg = (MAP_CONFIG.theme.backgroundColor.toLowerCase() === '#ffffff' || MAP_CONFIG.theme.backgroundColor.toLowerCase() === '#fff');
  const ambient = new THREE.AmbientLight(0xffffff, isLightBg ? 0.95 : 0.7);
  scene.add(ambient);

  const mainLight = new THREE.DirectionalLight(0xffffff, isLightBg ? 1.3 : 1.2);
  mainLight.position.set(12, 28, 14);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0x1abc9c, 0.45);
  fillLight.position.set(-14, 18, -12);
  scene.add(fillLight);

  // Subtle Dhaka HQ point light (emerald green)
  const hqPos = getDistrictWorldPos(MAP_CONFIG.headquarters.district);
  const hqLight = new THREE.PointLight(0x2ecc71, 0.5, 8);
  hqLight.position.set(hqPos.x, MAP_DEPTH + 1.2, hqPos.z);
  scene.add(hqLight);

  // Single shared focus PointLight for active/selected branch (replaces 34 individual dynamic lights)
  activeFocusLight = new THREE.PointLight(0x00e5ff, 0, 5.0);
  activeFocusLight.position.set(0, MAP_DEPTH + 1.0, 0);
  scene.add(activeFocusLight);
}

// ============================================================
//  BUILD 3D DISTRICT MAP WITH VERTICAL SLAB DEPTH (NO BOTTOM CAP)
// ============================================================
// Helper to build vertical side walls along polygon perimeter (excluding underneath bottom layer)
function createSideWallGeometry(ring, topY, bottomY) {
  const positions = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % n];

    const x1 = p1[0], z1 = p1[1];
    const x2 = p2[0], z2 = p2[1];

    // Triangle 1: p1_top, p1_bot, p2_top
    positions.push(
      x1, topY, z1,
      x1, bottomY, z1,
      x2, topY, z2
    );
    // Triangle 2: p2_top, p1_bot, p2_bot
    positions.push(
      x2, topY, z2,
      x1, bottomY, z1,
      x2, bottomY, z2
    );
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

function setDistrictMeshColor(mesh, hexColor, isHighlight = false) {
  if (!mesh) return;
  const top = mesh.userData.topMesh || mesh;
  const side = top.userData?.sideMesh;

  if (top && top.material) {
    top.material.color.set(hexColor);
  }
  if (side && side.material) {
    if (isHighlight) {
      const c = new THREE.Color(hexColor).multiplyScalar(0.55);
      side.material.color.copy(c);
    } else {
      side.material.color.set(side.userData.defaultColor);
    }
  }
}

function resetDistrictMeshColor(mesh) {
  if (!mesh) return;
  const top = mesh.userData.topMesh || mesh;
  const side = top.userData?.sideMesh;

  if (top && top.material) {
    top.material.color.set(top.userData.defaultColor);
  }
  if (side && side.material) {
    side.material.color.set(side.userData.defaultColor);
  }
}

function createDistrictMap() {
  const { theme } = MAP_CONFIG;
  const SLAB_DEPTH = 0.20;
  const sideColor = 0x091424; // Sleek architectural deep navy edge

  BANGLADESH_GEO.districts.forEach(dData => {
    dData.rings.forEach((ring, rIdx) => {
      if (ring.length < 3) return;

      const shape = new THREE.Shape();
      ring.forEach(([x, z], i) => {
        if (i === 0) shape.moveTo(x, -z);
        else shape.lineTo(x, -z);
      });
      shape.closePath();

      // 1. Top Surface: Flat 2D ShapeGeometry (fast, responsive)
      const geom = new THREE.ShapeGeometry(shape);
      geom.rotateX(-Math.PI / 2);

      const mat = new THREE.MeshStandardMaterial({
        color: theme.mapColor,
        roughness: 0.65,
        metalness: 0.15,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = MAP_DEPTH;
      mesh.userData = {
        isDistrict: true,
        district: dData.district,
        id: dData.id,
        defaultColor: theme.mapColor,
      };

      // 2. Vertical Extruded Side Walls (underneath bottom layer completely excluded)
      const sideGeom = createSideWallGeometry(ring, MAP_DEPTH, MAP_DEPTH - SLAB_DEPTH);
      const sideMat = new THREE.MeshStandardMaterial({
        color: sideColor,
        roughness: 0.55,
        metalness: 0.25,
        side: THREE.DoubleSide,
      });
      const sideMesh = new THREE.Mesh(sideGeom, sideMat);
      sideMesh.userData = {
        isDistrict: true,
        isDistrictSide: true,
        district: dData.district,
        id: dData.id,
        defaultColor: sideColor,
        topMesh: mesh,
      };
      mesh.userData.sideMesh = sideMesh;

      mapGroup.add(mesh);
      mapGroup.add(sideMesh);
      districtMeshes.push(mesh);
      districtMeshes.push(sideMesh);

      // 3. District outline borders - subtle 14% cyan glow elevated slightly above plane
      const borderPoints = ring.map(([x, z]) => new THREE.Vector3(x, MAP_DEPTH + 0.005, z));
      borderPoints.push(borderPoints[0].clone());
      const lineGeom = new THREE.BufferGeometry().setFromPoints(borderPoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: theme.mapEdgeColor,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      });
      const borderLine = new THREE.Line(lineGeom, lineMat);
      mapGroup.add(borderLine);
    });
  });
}

// ============================================================
//  3D MARKERS WITH MULTI-BRANCH CO-LOCATION
// ============================================================
function createMarkers() {
  const { headquarters, operationAreas } = MAP_CONFIG;

  // Group all branches by normalized district
  const districtGroups = new Map();

  function addBranchToGroup(districtName, item) {
    const norm = normalizeDistrictName(districtName).toLowerCase();
    if (!districtGroups.has(norm)) {
      districtGroups.set(norm, []);
    }
    districtGroups.get(norm).push(item);
  }

  // 1. Add HQ to Dhaka
  addBranchToGroup(headquarters.district, { ...headquarters, isHQ: true });

  // 2. Add all operation areas
  operationAreas.forEach(area => {
    addBranchToGroup(area.district, { ...area, isHQ: false });
  });

  // 3. For each district group, compute positions
  districtGroups.forEach((branches, normDistrict) => {
    const centerPos = getDistrictWorldPos(normDistrict);
    const count = branches.length;

    if (count === 1) {
      createSingleMarker(centerPos, branches[0]);
    } else {
      // Multiple branches in the same district
      const hasHQ = branches.some(b => b.isHQ);

      if (hasHQ) {
        // HQ stays at the center
        const hqItem = branches.find(b => b.isHQ);
        createSingleMarker(centerPos, hqItem);

        // Other branches (e.g. Egg Warehouses in Dhaka) offset around it
        const others = branches.filter(b => !b.isHQ);
        const radius = 0.26;
        others.forEach((b, idx) => {
          const angle = (idx * (2 * Math.PI / others.length)) + Math.PI / 4;
          const offsetPos = new THREE.Vector3(
            centerPos.x + Math.cos(angle) * radius,
            MAP_DEPTH,
            centerPos.z + Math.sin(angle) * radius
          );
          createSingleMarker(offsetPos, b);
        });
      } else if (normDistrict.toLowerCase() === 'bogra') {
        // Keep existing CBF and Supply Chain landmarks at their exact coordinates (angles 0 and PI)
        // and place new factory at an offset angle so existing models never move!
        branches.forEach((b, idx) => {
          let angle, radius;
          if (idx === 0) {
            angle = 0;
            radius = 0.20;
          } else if (idx === 1) {
            angle = Math.PI;
            radius = 0.20;
          } else {
            angle = Math.PI / 2;
            radius = 0.22;
          }
          const offsetPos = new THREE.Vector3(
            centerPos.x + Math.cos(angle) * radius,
            MAP_DEPTH,
            centerPos.z + Math.sin(angle) * radius
          );
          createSingleMarker(offsetPos, b);
        });
      } else {
        // Distribute on small circle around center so models don't collide
        const radius = count === 2 ? 0.20 : 0.24;
        branches.forEach((b, idx) => {
          const angle = idx * (2 * Math.PI / count);
          const offsetPos = new THREE.Vector3(
            centerPos.x + Math.cos(angle) * radius,
            MAP_DEPTH,
            centerPos.z + Math.sin(angle) * radius
          );
          createSingleMarker(offsetPos, b);
        });
      }
    }
  });
}

function createSingleMarker(worldPos, data) {
  const isHQ = !!data.isHQ;
  const type = data.type || (isHQ ? 'Headquarters' : 'Supply Chain');
  const typeConfig = BRANCH_TYPES[type] || BRANCH_TYPES['Supply Chain'];
  const colorVal = typeConfig.color;

  const group = new THREE.Group();
  group.position.set(worldPos.x, MAP_DEPTH, worldPos.z);

  // Base Grounding Disc (elevated 0.1 higher, directly beneath the 3D model)
  const baseRadius = isHQ ? 0.22 : 0.16;
  const padGeo = new THREE.CircleGeometry(baseRadius, 32);
  const padMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colorVal),
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.201;
  pad.renderOrder = 10;
  group.add(pad);

  // Water Drop Expanding Ripple Rings (0.1 higher, directly under the branch)
  const rippleY = 0.202;
  const ripples = [];
  for (let r = 0; r < 2; r++) {
    const rGeo = new THREE.RingGeometry(baseRadius * 0.82, baseRadius, 32);
    const rMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorVal),
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const rMesh = new THREE.Mesh(rGeo, rMat);
    rMesh.rotation.x = -Math.PI / 2;
    rMesh.position.y = rippleY + r * 0.001;
    rMesh.renderOrder = 11;
    group.add(rMesh);
    ripples.push(rMesh);
  }

  // 3D Model Attachment
  let modelMesh = null;
  const isFeedmill = (type === 'Agrigate Factories' && (data.branchName?.includes('Feed') || data.name?.includes('Feed'))) || type === 'Feedmill';
  const isBreedersFarm = (type === 'Agrigate Factories' && (data.branchName?.includes('Farm') || data.name?.includes('Farm'))) || type === 'Breeders Farm';

  if (isFeedmill && (MODEL_TEMPLATES['Feedmill'] || MODEL_TEMPLATES['Agrigate Feed Limited'])) {
    const tmpl = MODEL_TEMPLATES['Feedmill'] || MODEL_TEMPLATES['Agrigate Feed Limited'];
    modelMesh = tmpl.clone(true);
    group.add(modelMesh);
  } else if (isBreedersFarm && (MODEL_TEMPLATES['Breeders Farm'] || MODEL_TEMPLATES['Agrigate Farm Limited'])) {
    const tmpl = MODEL_TEMPLATES['Breeders Farm'] || MODEL_TEMPLATES['Agrigate Farm Limited'];
    modelMesh = tmpl.clone(true);
    group.add(modelMesh);
  } else if (MODEL_TEMPLATES[type]) {
    modelMesh = MODEL_TEMPLATES[type].clone(true);
    group.add(modelMesh);
  } else if (type === 'Agrigate Factories') {
    modelMesh = createFactoryBoxMesh();
    group.add(modelMesh);
  } else if (type === 'Egg Warehouse') {
    modelMesh = createEggWarehouseMesh();
    group.add(modelMesh);
  } else {
    modelMesh = createFallbackMesh(colorVal, isHQ);
    group.add(modelMesh);
  }

  // Reposition 0.1 higher and rotate horizontally 90 degrees right (North to East)
  modelMesh.position.y = 0.1;
  modelMesh.rotation.y = -Math.PI / 2;

  const markerKey = data.id || (isHQ ? 'hq' : (data.branchName || 'branch_' + markerObjects.length));

  // Apply any previously saved custom transforms from localStorage
  if (savedTransforms[markerKey]) {
    const st = savedTransforms[markerKey];
    if (st.position) {
      modelMesh.position.set(st.position.x, st.position.y, st.position.z);
    }
    if (st.rotation) {
      modelMesh.rotation.set(
        THREE.MathUtils.degToRad(st.rotation.x),
        THREE.MathUtils.degToRad(st.rotation.y),
        THREE.MathUtils.degToRad(st.rotation.z)
      );
    }
    if (st.scale) {
      const sc = typeof st.scale === 'number' ? st.scale : st.scale.x;
      modelMesh.scale.set(sc, sc, sc);
    }
  }

  // Glowing light effects over every branch
  const glowCfg = GLOW_CONFIG[type] || GLOW_CONFIG['Supply Chain'];

  // Atmospheric glowing energy aura sprite above branch (soft subtle halo for branches)
  const isBranch = (type === 'CBF' || type === 'CFF');
  const isLightBg = (MAP_CONFIG.theme.backgroundColor.toLowerCase() === '#ffffff' || MAP_CONFIG.theme.backgroundColor.toLowerCase() === '#fff');
  const glowTex = getGlowTexture(glowCfg.css);
  const spriteMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffffff,
    transparent: true,
    opacity: isBranch ? 0.30 : (isLightBg ? 0.65 : 0.50),
    blending: (isBranch || isLightBg) ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowSprite = new THREE.Sprite(spriteMat);
  const spriteY = isBranch ? (modelMesh.position.y + 0.38) : (modelMesh.position.y + glowCfg.height - 0.02);
  glowSprite.position.set(modelMesh.position.x, spriteY, modelMesh.position.z);
  glowSprite.scale.set(0.40, 0.40, 1.0);
  group.add(glowSprite);

  // Floating 3D Agrigate Logo over Branch.glb landmarks (CBF & CFF)
  let logoMedallion = null;
  if (isBranch) {
    logoMedallion = createFloatingLogoMedallion();
    if (logoMedallion) {
      const my = modelMesh.position.y;
      logoMedallion.position.set(modelMesh.position.x, my + 0.38, modelMesh.position.z);
      logoMedallion.userData.baseY = my + 0.38;
      group.add(logoMedallion);
    }
  }

  group.userData = {
    isMarker: true,
    isHQ: isHQ,
    isFeedmill: isFeedmill,
    isBreedersFarm: isBreedersFarm,
    key: markerKey,
    data: data,
    padMesh: pad,
    pulseMesh: ripples[0],
    ripples: ripples,
    modelMesh: modelMesh,
    glowSprite: glowSprite,
    glowLight: null,
    logoMedallion: logoMedallion,
    baseScale: modelMesh.scale.x,
    baseColor: colorVal,
  };

  // Ensure water drops (pad + ripples) and glowing lights track model's current position
  syncMarkerAttachments(group);

  markersGroup.add(group);
  markerObjects.push(group);
}

// ============================================================
//  CATEGORY-SPECIFIC GRADIENT LIGHT BEAMS
// ============================================================
function createBeams() {
  const { headquarters, operationAreas } = MAP_CONFIG;
  scene.updateMatrixWorld(true);

  const hqMarker = markerObjects.find(m => m.userData.isHQ);
  const hqPos = hqMarker ? getModelWorldPos(hqMarker) : getDistrictWorldPos(headquarters.district);
  hqPos.y += 0.35;

  operationAreas.forEach((area, idx) => {
    // Find the specific marker object corresponding to this hub
    const targetMarker = markerObjects.find(m => m.userData.data?.id === area.id);
    const targetPos = targetMarker ? getModelWorldPos(targetMarker) : getDistrictWorldPos(area.district);
    targetPos.y += 0.18;

    const distance = hqPos.distanceTo(targetPos);
    const arcHeight = Math.max(distance * 0.42, 1.6);

    const midPoint = new THREE.Vector3().lerpVectors(hqPos, targetPos, 0.5);
    midPoint.y += arcHeight;

    const curve = new THREE.QuadraticBezierCurve3(hqPos.clone(), midPoint, targetPos.clone());

    const typeConfig = BRANCH_TYPES[area.type] || BRANCH_TYPES['Supply Chain'];
    const baseColor = new THREE.Color(typeConfig.beamBase);
    const headColor = new THREE.Color(typeConfig.beamHead);

    // Subtle ambient arc guideline
    const isLightBg = (MAP_CONFIG.theme.backgroundColor.toLowerCase() === '#ffffff' || MAP_CONFIG.theme.backgroundColor.toLowerCase() === '#fff');
    const guidePoints = curve.getPoints(60);
    const guideGeo = new THREE.BufferGeometry().setFromPoints(guidePoints);
    const guideMat = new THREE.LineBasicMaterial({
      color: headColor,
      transparent: true,
      opacity: isLightBg ? 0.35 : 0.10,
    });
    const guideline = new THREE.Line(guideGeo, guideMat);
    beamsGroup.add(guideline);

    // Animated long light beam segment (gradient trail)
    const segmentCount = 36;
    const beamPositions = new Float32Array(segmentCount * 3);
    const beamColors = new Float32Array(segmentCount * 3);

    for (let i = 0; i < segmentCount; i++) {
      const alpha = i / (segmentCount - 1);
      const c = new THREE.Color().lerpColors(baseColor, headColor, Math.pow(alpha, 1.4));
      beamColors[i * 3] = c.r * alpha;
      beamColors[i * 3 + 1] = c.g * alpha;
      beamColors[i * 3 + 2] = c.b * alpha;
    }

    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPositions, 3));
    beamGeo.setAttribute('color', new THREE.BufferAttribute(beamColors, 3));

    const beamMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: isLightBg ? THREE.NormalBlending : THREE.AdditiveBlending,
      linewidth: 2,
    });

    const beamLine = new THREE.Line(beamGeo, beamMat);
    beamsGroup.add(beamLine);

    // Glow head point at the tip of the beam
    const headGeo = new THREE.BufferGeometry();
    headGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    const headMat = new THREE.PointsMaterial({
      color: headColor,
      size: isLightBg ? 0.38 : 0.32,
      transparent: true,
      opacity: 0.95,
      blending: isLightBg ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    const headPoint = new THREE.Points(headGeo, headMat);
    beamsGroup.add(headPoint);

    const beamLength = 0.35;
    beamAnimations.push({
      areaId: area.id,
      targetMarker,
      guideline,
      curve,
      beamLine,
      headPoint,
      segmentCount,
      beamLength,
      speed: 0.11 + (idx % 4) * 0.015,
      offset: (idx / operationAreas.length),
    });
  });
}

function updateBeams() {
  const hqMarker = markerObjects.find(m => m.userData.isHQ);
  if (!hqMarker || beamAnimations.length === 0) return;
  scene.updateMatrixWorld(true);

  const hqPos = getModelWorldPos(hqMarker);
  hqPos.y += 0.35;

  beamAnimations.forEach(beam => {
    const targetMarker = beam.targetMarker;
    if (!targetMarker) return;
    const targetPos = getModelWorldPos(targetMarker);
    targetPos.y += 0.18;

    const distance = hqPos.distanceTo(targetPos);
    const arcHeight = Math.max(distance * 0.42, 1.6);

    const midPoint = new THREE.Vector3().lerpVectors(hqPos, targetPos, 0.5);
    midPoint.y += arcHeight;

    beam.curve.v0.copy(hqPos);
    beam.curve.v1.copy(midPoint);
    beam.curve.v2.copy(targetPos);

    if (beam.guideline) {
      const guidePoints = beam.curve.getPoints(60);
      beam.guideline.geometry.setFromPoints(guidePoints);
    }
  });
}

// ============================================================
//  ANIMATION LOOP
// ============================================================
const _beamScratchVec = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  controls.update();

  // Water drop ripple animation under branches (elevated .1 higher)
  markerObjects.forEach(marker => {
    const ripples = marker.userData.ripples;
    if (ripples) {
      ripples.forEach((ringMesh, rIdx) => {
        // Continuous water ripple wave expansion (0 to 1)
        const t = ((elapsed * 0.85 + rIdx * 0.5 + marker.position.x * 1.5) % 1 + 1) % 1;
        // Expand outward like a water drop ripple
        const s = 1.0 + t * 1.6;
        ringMesh.scale.set(s, s, 1);
        // Fade smoothly to 0 as it ripples outward
        ringMesh.material.opacity = Math.max(0, 0.5 * (1 - t));
      });
    }

    const glow = marker.userData.glowSprite;
    if (glow) {
      const isActive = (marker === activeMarkerGroup);
      const isBranch = (marker.userData.logoMedallion != null);
      const baseScale = isBranch ? (isActive ? 0.48 : 0.40) : (isActive ? 0.58 : 0.42);
      const baseOpacity = isBranch ? (isActive ? 0.32 : 0.28) : (isActive ? 0.72 : 0.45);
      const gs = baseScale + Math.sin(elapsed * 2.6 + marker.position.x * 3) * 0.04;
      glow.scale.set(gs, gs, 1.0);
      glow.material.opacity = baseOpacity + Math.sin(elapsed * 2.0 + marker.position.z * 2) * 0.05;
    }

    const medallion = marker.userData.logoMedallion;
    if (medallion) {
      // Slow 360-degree rotation (approx 12s per full turn with natural spatial phase offset)
      medallion.rotation.y = (elapsed * 0.55 + marker.position.x * 0.3) % (Math.PI * 2);

      // Micro levitation bobbing (smooth sine wave)
      const baseY = medallion.userData.baseY || 0.48;
      medallion.position.y = baseY + Math.sin(elapsed * 2.2 + marker.position.x * 2) * 0.02;
    }
  });

  // Light beams animation (smooth continuous laser flow with zero per-frame allocations)
  beamAnimations.forEach(beam => {
    const headT = (elapsed * beam.speed + beam.offset) % 1;
    const tailT = headT - beam.beamLength;

    const positions = beam.beamLine.geometry.attributes.position.array;
    const segCount = beam.segmentCount;

    for (let i = 0; i < segCount; i++) {
      const frac = i / (segCount - 1);
      const sampleT = THREE.MathUtils.clamp(tailT + frac * beam.beamLength, 0.001, 0.999);
      beam.curve.getPoint(sampleT, _beamScratchVec);

      positions[i * 3] = _beamScratchVec.x;
      positions[i * 3 + 1] = _beamScratchVec.y;
      positions[i * 3 + 2] = _beamScratchVec.z;
    }
    beam.beamLine.geometry.attributes.position.needsUpdate = true;

    const fadeEdge = Math.sin(headT * Math.PI);
    beam.beamLine.material.opacity = 0.15 + fadeEdge * 0.85;

    beam.curve.getPoint(THREE.MathUtils.clamp(headT, 0.001, 0.999), _beamScratchVec);
    const headPosArray = beam.headPoint.geometry.attributes.position.array;
    headPosArray[0] = _beamScratchVec.x;
    headPosArray[1] = _beamScratchVec.y;
    headPosArray[2] = _beamScratchVec.z;
    beam.headPoint.geometry.attributes.position.needsUpdate = true;
    beam.headPoint.material.opacity = fadeEdge * 0.9;
  });

  updateHQBadgePosition();
  updatePopupPosition();

  renderer.render(scene, camera);
}

// ============================================================
//  HQ BADGE
// ============================================================
function setupHQBadge() {
  hqBadge = document.querySelector('.hq-badge');
}

function updateHQBadgePosition() {
  if (!hqBadge) return;
  const hqMarker = markerObjects.find(m => m.userData.isHQ);
  if (!hqMarker) return;

  const worldPos = getModelWorldPos(hqMarker);
  worldPos.y += 0.65;

  const screen = worldToScreen(worldPos);
  hqBadge.style.left = screen.x + 'px';
  hqBadge.style.top = screen.y + 'px';
}

// ============================================================
//  3D MODEL EDITOR TOOLBAR & TRANSFORMS PERSISTENCE
// ============================================================
function loadSavedTransforms() {
  // Start with default canonical transforms baked into the codebase
  savedTransforms = { ...DEFAULT_TRANSFORMS };

  // Overlay any active local browser customizations from localStorage
  try {
    const raw = localStorage.getItem('agrigate_map_transforms');
    if (raw) {
      const localData = JSON.parse(raw);
      // Upgrade any stale cached 0.20/0.25 scales for CBF/CFF branches to the new 0.165 scale
      const cbfKeys = [
        'cbf-rangpur', 'cbf-natore', 'cbf-rajshahi', 'cbf-jashore',
        'cbf-bogura', 'cbf-mymensingh', 'cbf-barisal', 'cbf-chattagong',
        'cbf-cumilla', 'cbf-tangail', 'cbf-dinajpur', 'cff-sherpur'
      ];
      cbfKeys.forEach(k => {
        if (localData[k] && (localData[k].scale === 0.2 || localData[k].scale === 0.25)) {
          localData[k].scale = 0.165;
        }
      });
      savedTransforms = { ...savedTransforms, ...localData };
    }
  } catch (e) {
    console.warn('Could not read saved transforms:', e);
  }
}

function syncMarkerAttachments(markerGroup) {
  if (!markerGroup || !markerGroup.userData.modelMesh) return;
  const modelMesh = markerGroup.userData.modelMesh;
  const padMesh = markerGroup.userData.padMesh;
  const ripples = markerGroup.userData.ripples;
  const glowLight = markerGroup.userData.glowLight;
  const glowSprite = markerGroup.userData.glowSprite;
  const type = markerGroup.userData.data?.type || (markerGroup.userData.isHQ ? 'Headquarters' : 'Supply Chain');
  const glowCfg = GLOW_CONFIG[type] || GLOW_CONFIG['Supply Chain'];

  const px = modelMesh.position.x;
  const py = modelMesh.position.y;
  const pz = modelMesh.position.z;

  // Base ground disc directly beneath 3D model (elevated 0.1 higher so it's always clearly visible)
  const padY = Math.max(0.101, py + 0.101);
  if (padMesh) {
    padMesh.position.set(px, padY, pz);
  }

  // Water drop ripple rings directly under 3D model (elevated 0.1 higher)
  const rippleY = Math.max(0.102, py + 0.102);
  if (ripples) {
    ripples.forEach((rMesh, r) => {
      rMesh.position.set(px, rippleY + r * 0.001, pz);
    });
  }

  // Atmospheric glowing light & sprite above model (centered directly on logo emblem for branches)
  if (glowLight) {
    glowLight.position.set(px, py + glowCfg.height + 0.02, pz);
  }
  const isBranch = !markerGroup.userData.isHQ && !markerGroup.userData.isFeedmill && !markerGroup.userData.isBreedersFarm;
  const spriteY = isBranch ? (py + 0.38) : (py + glowCfg.height - 0.02);
  if (glowSprite) {
    glowSprite.position.set(px, spriteY, pz);
  }

  // Floating Agrigate logo medallion tracks model in X, Y, Z
  const logoMedallion = markerGroup.userData.logoMedallion;
  if (logoMedallion) {
    logoMedallion.position.set(px, py + 0.38, pz);
    logoMedallion.userData.baseY = py + 0.38;
  }
}

function syncGlowPosition(markerGroup) {
  syncMarkerAttachments(markerGroup);
}

function syncUIFromModel(markerGroup) {
  if (!markerGroup || !markerGroup.userData.modelMesh) return;
  const m = markerGroup.userData.modelMesh;

  // Position
  const posX = m.position.x;
  const posY = m.position.y;
  const posZ = m.position.z;

  const posXRange = document.getElementById('prop-pos-x-range');
  const posXNum = document.getElementById('prop-pos-x-num');
  const posYRange = document.getElementById('prop-pos-y-range');
  const posYNum = document.getElementById('prop-pos-y-num');
  const posZRange = document.getElementById('prop-pos-z-range');
  const posZNum = document.getElementById('prop-pos-z-num');

  if (posXRange) posXRange.value = posX;
  if (posXNum) posXNum.value = posX.toFixed(2);
  if (posYRange) posYRange.value = posY;
  if (posYNum) posYNum.value = posY.toFixed(2);
  if (posZRange) posZRange.value = posZ;
  if (posZNum) posZNum.value = posZ.toFixed(2);

  // Rotation (radians to degrees)
  const rotXDeg = Math.round(THREE.MathUtils.radToDeg(m.rotation.x));
  const rotYDeg = Math.round(THREE.MathUtils.radToDeg(m.rotation.y));
  const rotZDeg = Math.round(THREE.MathUtils.radToDeg(m.rotation.z));

  const rotXRange = document.getElementById('prop-rot-x-range');
  const rotXNum = document.getElementById('prop-rot-x-num');
  const rotYRange = document.getElementById('prop-rot-y-range');
  const rotYNum = document.getElementById('prop-rot-y-num');
  const rotZRange = document.getElementById('prop-rot-z-range');
  const rotZNum = document.getElementById('prop-rot-z-num');

  if (rotXRange) rotXRange.value = rotXDeg;
  if (rotXNum) rotXNum.value = rotXDeg;
  if (rotYRange) rotYRange.value = rotYDeg;
  if (rotYNum) rotYNum.value = rotYDeg;
  if (rotZRange) rotZRange.value = rotZDeg;
  if (rotZNum) rotZNum.value = rotZDeg;

  // Scale (uniform scale using x)
  const sc = m.scale.x;
  const scaleRange = document.getElementById('prop-scale-range');
  const scaleNum = document.getElementById('prop-scale-num');
  if (scaleRange) scaleRange.value = sc;
  if (scaleNum) scaleNum.value = sc.toFixed(3);

  // Select dropdown value
  const select = document.getElementById('editor-model-select');
  if (select && markerGroup.userData.key) {
    select.value = markerGroup.userData.key;
  }
}

function selectModelForEditing(markerKey) {
  const marker = markerObjects.find(m => m.userData.key === markerKey);
  if (!marker || !marker.userData.modelMesh) return;

  selectedMarkerGroup = marker;

  if (transformControls) {
    transformControls.attach(marker.userData.modelMesh);
  }

  syncUIFromModel(marker);
}

function showEditorToast(msg) {
  const toast = document.getElementById('editor-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2600);
}

function setupModelEditor() {
  const panel = document.getElementById('model-editor-panel');
  const toggleBtn = document.getElementById('editor-toggle-btn');
  const closeBtn = document.getElementById('editor-close-btn');
  const modelSelect = document.getElementById('editor-model-select');

  if (!panel || !toggleBtn) return;

  // Initialize TransformControls
  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.size = 0.75;
  transformControls.space = 'world';
  scene.add(transformControls);

  transformControls.addEventListener('dragging-changed', function (event) {
    controls.enabled = !event.value;
  });

  transformControls.addEventListener('change', function () {
    if (selectedMarkerGroup) {
      syncUIFromModel(selectedMarkerGroup);
      syncMarkerAttachments(selectedMarkerGroup);
      updateBeams();
    }
  });

  // Populate Dropdown with optgroups
  if (modelSelect) {
    modelSelect.innerHTML = '';

    const categories = {
      'Headquarters': [],
      'CBF Branches': [],
      'CFF Branch': [],
      'Egg Warehouses': [],
      'Agrigate Factories': [],
      'Supply Chain Hubs': [],
    };

    markerObjects.forEach(m => {
      const data = m.userData.data;
      const isHQ = m.userData.isHQ;
      const key = m.userData.key;
      const type = data.type || (isHQ ? 'Headquarters' : 'Supply Chain');
      const name = data.branchName || data.name || (isHQ ? 'Head Office' : 'Branch');
      const district = data.district || '';

      const item = { key, label: `${name} (${district})` };

      if (isHQ) categories['Headquarters'].push(item);
      else if (type === 'CBF') categories['CBF Branches'].push(item);
      else if (type === 'CFF') categories['CFF Branch'].push(item);
      else if (type === 'Egg Warehouse') categories['Egg Warehouses'].push(item);
      else if (type === 'Agrigate Factories') categories['Agrigate Factories'].push(item);
      else categories['Supply Chain Hubs'].push(item);
    });

    Object.entries(categories).forEach(([catTitle, items]) => {
      if (items.length === 0) return;
      const optgroup = document.createElement('optgroup');
      optgroup.label = catTitle;
      items.forEach(it => {
        const opt = document.createElement('option');
        opt.value = it.key;
        opt.textContent = it.label;
        optgroup.appendChild(opt);
      });
      modelSelect.appendChild(optgroup);
    });

    modelSelect.addEventListener('change', () => {
      selectModelForEditing(modelSelect.value);
    });
  }

  // Toggle Panel open/close
  function toggleEditor(open) {
    isEditorActive = (typeof open === 'boolean') ? open : !isEditorActive;
    if (isEditorActive) {
      stopAutoPanning();
      panel.classList.add('visible');
      toggleBtn.classList.add('active');
      closePopup();

      if (!selectedMarkerGroup && markerObjects.length > 0) {
        const hq = markerObjects.find(m => m.userData.isHQ) || markerObjects[0];
        selectModelForEditing(hq.userData.key);
      } else if (selectedMarkerGroup) {
        transformControls.attach(selectedMarkerGroup.userData.modelMesh);
      }
    } else {
      panel.classList.remove('visible');
      toggleBtn.classList.remove('active');
      transformControls.detach();
    }
  }

  toggleBtn.addEventListener('click', () => toggleEditor());
  closeBtn?.addEventListener('click', () => toggleEditor(false));

  // Transform Mode Buttons
  const modeBtns = panel.querySelectorAll('.editor-mode-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      transformControls.setMode(mode);
    });
  });

  // Keyboard Shortcuts (W = Translate, E = Rotate, R = Scale, Escape = Close)
  window.addEventListener('keydown', (e) => {
    if (!isEditorActive) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    if (e.key === 'w' || e.key === 'W') {
      transformControls.setMode('translate');
      panel.querySelector('[data-mode="translate"]')?.click();
    } else if (e.key === 'e' || e.key === 'E') {
      transformControls.setMode('rotate');
      panel.querySelector('[data-mode="rotate"]')?.click();
    } else if (e.key === 'r' || e.key === 'R') {
      transformControls.setMode('scale');
      panel.querySelector('[data-mode="scale"]')?.click();
    } else if (e.key === 'Escape') {
      toggleEditor(false);
    }
  });

  // Helper to bind range + number inputs
  function bindAxisInput(rangeId, numId, getter, setter) {
    const rangeEl = document.getElementById(rangeId);
    const numEl = document.getElementById(numId);
    if (!rangeEl || !numEl) return;

    rangeEl.addEventListener('input', () => {
      const val = parseFloat(rangeEl.value);
      numEl.value = Number.isInteger(val) ? val : val.toFixed(2);
      if (selectedMarkerGroup) {
        setter(selectedMarkerGroup.userData.modelMesh, val);
        syncMarkerAttachments(selectedMarkerGroup);
        updateBeams();
      }
    });

    numEl.addEventListener('input', () => {
      const val = parseFloat(numEl.value) || 0;
      rangeEl.value = val;
      if (selectedMarkerGroup) {
        setter(selectedMarkerGroup.userData.modelMesh, val);
        syncMarkerAttachments(selectedMarkerGroup);
        updateBeams();
      }
    });
  }

  // Bind Position Inputs
  bindAxisInput('prop-pos-x-range', 'prop-pos-x-num', m => m.position.x, (m, v) => m.position.x = v);
  bindAxisInput('prop-pos-y-range', 'prop-pos-y-num', m => m.position.y, (m, v) => m.position.y = v);
  bindAxisInput('prop-pos-z-range', 'prop-pos-z-num', m => m.position.z, (m, v) => m.position.z = v);

  // Bind Rotation Inputs (converted to radians)
  bindAxisInput('prop-rot-x-range', 'prop-rot-x-num', m => m.rotation.x, (m, v) => m.rotation.x = THREE.MathUtils.degToRad(v));
  bindAxisInput('prop-rot-y-range', 'prop-rot-y-num', m => m.rotation.y, (m, v) => m.rotation.y = THREE.MathUtils.degToRad(v));
  bindAxisInput('prop-rot-z-range', 'prop-rot-z-num', m => m.rotation.z, (m, v) => m.rotation.z = THREE.MathUtils.degToRad(v));

  // Bind Scale Input
  const scaleRange = document.getElementById('prop-scale-range');
  const scaleNum = document.getElementById('prop-scale-num');
  const scaleAllTypeCb = document.getElementById('prop-scale-all-type');

  function updateScale(val) {
    if (!selectedMarkerGroup) return;
    const applyToAll = scaleAllTypeCb?.checked;
    const currentType = selectedMarkerGroup.userData.data?.type || (selectedMarkerGroup.userData.isHQ ? 'Headquarters' : 'Supply Chain');

    if (applyToAll) {
      markerObjects.forEach(m => {
        const mType = m.userData.data?.type || (m.userData.isHQ ? 'Headquarters' : 'Supply Chain');
        if (mType === currentType && m.userData.modelMesh) {
          m.userData.modelMesh.scale.set(val, val, val);
          m.userData.baseScale = val;
        }
      });
    } else {
      selectedMarkerGroup.userData.modelMesh.scale.set(val, val, val);
      selectedMarkerGroup.userData.baseScale = val;
    }
  }

  scaleRange?.addEventListener('input', () => {
    const val = parseFloat(scaleRange.value);
    if (scaleNum) scaleNum.value = val.toFixed(3);
    updateScale(val);
  });

  scaleNum?.addEventListener('input', () => {
    const val = parseFloat(scaleNum.value) || 0.005;
    if (scaleRange) scaleRange.value = val;
    updateScale(val);
  });

  // Reset Sub-buttons
  document.getElementById('btn-reset-pos')?.addEventListener('click', () => {
    if (!selectedMarkerGroup) return;
    selectedMarkerGroup.userData.modelMesh.position.set(0, 0.1, 0);
    syncUIFromModel(selectedMarkerGroup);
    syncMarkerAttachments(selectedMarkerGroup);
    updateBeams();
  });

  document.getElementById('btn-reset-rot')?.addEventListener('click', () => {
    if (!selectedMarkerGroup) return;
    selectedMarkerGroup.userData.modelMesh.rotation.set(0, -Math.PI / 2, 0);
    syncUIFromModel(selectedMarkerGroup);
  });

  document.getElementById('btn-reset-scale')?.addEventListener('click', () => {
    if (!selectedMarkerGroup) return;
    const isWh = selectedMarkerGroup.userData.data?.type === 'Egg Warehouse';
    const isFm = selectedMarkerGroup.userData.isFeedmill;
    const isBf = selectedMarkerGroup.userData.isBreedersFarm;
    const isBranch = selectedMarkerGroup.userData.data?.type === 'CBF' || selectedMarkerGroup.userData.data?.type === 'CFF';
    const defScale = isWh ? 0.01 : (isFm ? 0.015 : (isBf ? 0.03 : (isBranch ? 0.165 : 0.20)));
    selectedMarkerGroup.userData.modelMesh.scale.set(defScale, defScale, defScale);
    selectedMarkerGroup.userData.baseScale = defScale;
    syncUIFromModel(selectedMarkerGroup);
  });

  function snapshotTransforms() {
    markerObjects.forEach(m => {
      const model = m.userData.modelMesh;
      const key = m.userData.key;
      if (!model || !key) return;

      const px = parseFloat(model.position.x.toFixed(3));
      const py = parseFloat(model.position.y.toFixed(3));
      const pz = parseFloat(model.position.z.toFixed(3));

      const rx = parseFloat(THREE.MathUtils.radToDeg(model.rotation.x).toFixed(1));
      const ry = parseFloat(THREE.MathUtils.radToDeg(model.rotation.y).toFixed(1));
      const rz = parseFloat(THREE.MathUtils.radToDeg(model.rotation.z).toFixed(1));

      const s = parseFloat(model.scale.x.toFixed(4));

      savedTransforms[key] = {
        position: { x: px, y: py, z: pz },
        rotation: { x: rx, y: ry, z: rz },
        scale: s,
      };
    });
    return savedTransforms;
  }

  // 1-Click Save to Codebase (Permanent for all browsers and mobile visitors)
  document.getElementById('btn-editor-save-codebase')?.addEventListener('click', async () => {
    snapshotTransforms();
    try {
      showEditorToast('Saving to project codebase...');
      const res = await fetch('/api/save-transforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedTransforms, null, 2),
      });

      if (res.ok) {
        // Also sync local storage
        try { localStorage.setItem('agrigate_map_transforms', JSON.stringify(savedTransforms, null, 2)); } catch (_) {}
        showEditorToast('✓ Saved to codebase! Baked for all browsers & mobile.');
      } else {
        const err = await res.json().catch(() => ({}));
        showEditorToast('⚠️ Server error: ' + (err.message || res.statusText));
      }
    } catch (err) {
      console.error('Save to codebase error:', err);
      showEditorToast('⚠️ Server API not reachable');
    }
  });

  // Save to Local Browser Storage Only
  document.getElementById('btn-editor-save')?.addEventListener('click', () => {
    snapshotTransforms();
    try {
      localStorage.setItem('agrigate_map_transforms', JSON.stringify(savedTransforms, null, 2));
      showEditorToast('✓ Saved to this browser!');
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
      showEditorToast('⚠️ Could not write to storage');
    }
  });

  // Copy JSON
  document.getElementById('btn-editor-copy')?.addEventListener('click', () => {
    const jsonStr = JSON.stringify(savedTransforms, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      showEditorToast('✓ JSON copied to clipboard!');
    }).catch(() => {
      showEditorToast('⚠️ Clipboard copy blocked by browser');
    });
  });

  // Export JSON File Download
  document.getElementById('btn-editor-download')?.addEventListener('click', () => {
    const jsonStr = JSON.stringify(savedTransforms, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model_transforms.json';
    a.click();
    URL.revokeObjectURL(url);
    showEditorToast('✓ Downloaded model_transforms.json');
  });

  // Reset All Saved
  document.getElementById('btn-editor-reset-all')?.addEventListener('click', () => {
    if (confirm('Reset all models back to factory defaults and clear saved transforms?')) {
      savedTransforms = {};
      localStorage.removeItem('agrigate_map_transforms');

      markerObjects.forEach(m => {
        const model = m.userData.modelMesh;
        if (!model) return;
        const isWh = m.userData.data?.type === 'Egg Warehouse';
        const isFm = m.userData.isFeedmill;
        const isBf = m.userData.isBreedersFarm;
        const isBranch = m.userData.data?.type === 'CBF' || m.userData.data?.type === 'CFF';
        const defScale = isWh ? 0.01 : (isFm ? 0.015 : (isBf ? 0.03 : (isBranch ? 0.165 : 0.20)));

        model.position.set(0, 0.1, 0);
        model.rotation.set(0, -Math.PI / 2, 0);
        model.scale.set(defScale, defScale, defScale);
        m.userData.baseScale = defScale;
        syncMarkerAttachments(m);
      });

      updateBeams();

      if (selectedMarkerGroup) {
        syncUIFromModel(selectedMarkerGroup);
      }
      showEditorToast('↺ All models reset to default');
    }
  });
}

// ============================================================
//  RESET TO TOP-DOWN VIEW
// ============================================================
function setupResetButton() {
  resetBtn = document.querySelector('.reset-view-btn');
  resetBtn?.addEventListener('click', resetToTopDown);
}

function resetToTopDown() {
  stopAutoPanning();
  closePopup();
  isZoomedIn = false;
  resetBtn?.classList.remove('visible');

  // Clear district selection
  if (selectedDistrict) {
    resetDistrictMeshColor(selectedDistrict);
    selectedDistrict = null;
  }

  const fitPos = getFitCameraPosition();
  animateCamera(fitPos, new THREE.Vector3(0, 0, 0), 1000);
}

// ============================================================
//  AUTO SLOW CAMERA PANNING (ORBITAL SWEEP)
// ============================================================
function onControlsInteractionStart() {
  if (autoPanResumeTimer) {
    clearTimeout(autoPanResumeTimer);
    autoPanResumeTimer = null;
  }
  if (isAutoPanning) {
    controls.autoRotate = false;
  }
}

function onControlsInteractionEnd() {
  if (isAutoPanning && isZoomedIn && activePopup && !isEditorActive) {
    autoPanResumeTimer = setTimeout(() => {
      if (isAutoPanning && isZoomedIn && activePopup && !isEditorActive) {
        controls.autoRotate = true;
      }
    }, 1500);
  }
}

function startAutoPanning(markerGroup) {
  if (isEditorActive) return;
  if (autoPanResumeTimer) {
    clearTimeout(autoPanResumeTimer);
    autoPanResumeTimer = null;
  }
  isAutoPanning = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
}

function stopAutoPanning() {
  isAutoPanning = false;
  controls.autoRotate = false;
  if (autoPanResumeTimer) {
    clearTimeout(autoPanResumeTimer);
    autoPanResumeTimer = null;
  }
}

// ============================================================
//  CAMERA SMOOTH TWEENING
// ============================================================
function animateCamera(targetPos, lookAtTarget, duration = 800, onComplete = null) {
  if (cameraAnimId) {
    cancelAnimationFrame(cameraAnimId);
    cameraAnimId = null;
  }

  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const startTime = performance.now();

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = easeInOutCubic(progress);

    camera.position.lerpVectors(startPos, targetPos, ease);
    controls.target.lerpVectors(startTarget, lookAtTarget, ease);

    if (progress < 1) {
      cameraAnimId = requestAnimationFrame(step);
    } else {
      cameraAnimId = null;
      if (typeof onComplete === 'function') {
        onComplete();
      }
    }
  }

  cameraAnimId = requestAnimationFrame(step);
}

// ============================================================
//  CLICK INTERACTIONS
// ============================================================
function onMapClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // If Editor is active: clicking any model selects it for editing without opening popup
  if (isEditorActive) {
    const allMarkerMeshes = [];
    markerObjects.forEach(group => {
      group.traverse(child => {
        if (child.isMesh) {
          child.userData.parentMarker = group;
          allMarkerMeshes.push(child);
        }
      });
    });

    const markerHits = raycaster.intersectObjects(allMarkerMeshes, false);
    if (markerHits.length > 0) {
      const hitMarker = markerHits[0].object.userData.parentMarker;
      if (hitMarker && hitMarker.userData.key) {
        selectModelForEditing(hitMarker.userData.key);
      }
    }
    return;
  }

  // 1. Check Marker clicks
  const allMarkerMeshes = [];
  markerObjects.forEach(group => {
    group.traverse(child => {
      if (child.isMesh) {
        child.userData.parentMarker = group;
        allMarkerMeshes.push(child);
      }
    });
  });

  const markerHits = raycaster.intersectObjects(allMarkerMeshes, false);
  if (markerHits.length > 0) {
    const hitMarker = markerHits[0].object.userData.parentMarker;
    if (hitMarker && hitMarker.userData.data) {
      onMarkerClick(hitMarker);
      return;
    }
  }

  // 2. Check District polygon clicks
  const districtHits = raycaster.intersectObjects(districtMeshes, false);
  if (districtHits.length > 0) {
    const rawHit = districtHits[0].object;
    const hitDistrict = rawHit.userData.topMesh || rawHit;
    const districtName = hitDistrict.userData.district;

    // Check if matching branch exists in this district
    const matchingMarker = markerObjects.find(
      m => m.userData.data?.district?.toLowerCase() === districtName.toLowerCase() ||
           normalizeDistrictName(m.userData.data?.district || '').toLowerCase() === districtName.toLowerCase()
    );

    if (matchingMarker) {
      onMarkerClick(matchingMarker);
    } else {
      zoomToDistrict(hitDistrict);
    }
    return;
  }

  // Click on background
  if (activePopup) closePopup();
}

function setMarkerActiveState(markerGroup, isActive) {
  if (!markerGroup) return;

  // Natural PBR rendering: no artificial emissive core
  const logoMedallion = markerGroup.userData.logoMedallion;
  if (logoMedallion) {
    logoMedallion.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.emissive.set(0x000000);
        child.material.emissiveIntensity = 0;
      }
    });
  }
}

function onMarkerClick(markerGroup) {
  stopAutoPanning();
  closePopup();
  const data = markerGroup.userData.data;
  const isHQ = markerGroup.userData.isHQ;
  const isBranch = !markerGroup.userData.isHQ && !markerGroup.userData.isFeedmill && !markerGroup.userData.isBreedersFarm;

  activeMarkerGroup = markerGroup;
  setMarkerActiveState(markerGroup, true);

  const worldPos = getModelWorldPos(markerGroup);

  // Single overhead floodlight positioned directly above the logo to illuminate BOTH the logo and the branch building below
  if (activeFocusLight) {
    const type = data.type || (isHQ ? 'Headquarters' : 'Supply Chain');
    const typeConfig = BRANCH_TYPES[type] || BRANCH_TYPES['Supply Chain'];
    activeFocusLight.color.set(typeConfig.color);
    const lightY = isBranch ? (worldPos.y + 0.68) : (worldPos.y + 0.60);
    const lightZ = isBranch ? (worldPos.z + 0.04) : worldPos.z;
    activeFocusLight.position.set(worldPos.x, lightY, lightZ);
    activeFocusLight.intensity = isBranch ? 1.1 : 0.8;
    activeFocusLight.distance = 6.0;
  }

  // Smooth cinematic 3D zoom angle centered on branch
  const cameraTarget = worldPos.clone();
  const cameraPos = new THREE.Vector3(
    worldPos.x + 2.0,
    worldPos.y + 3.8,
    worldPos.z + 3.2
  );

  isZoomedIn = true;
  resetBtn?.classList.add('visible');

  animateCamera(cameraPos, cameraTarget, 850, () => {
    if (isZoomedIn && !isEditorActive) {
      startAutoPanning(markerGroup);
    }
  });
  setTimeout(() => showPopup(markerGroup, data, isHQ), 450);
}

function zoomToDistrict(rawMesh) {
  stopAutoPanning();
  closePopup();
  const districtMesh = rawMesh.userData.topMesh || rawMesh;
  if (selectedDistrict && selectedDistrict !== districtMesh) {
    resetDistrictMeshColor(selectedDistrict);
  }
  selectedDistrict = districtMesh;
  setDistrictMeshColor(districtMesh, MAP_CONFIG.theme.districtSelectedColor, true);

  const pos = new THREE.Vector3();
  districtMesh.getWorldPosition(pos);
  if (!districtMesh.geometry.boundingBox) districtMesh.geometry.computeBoundingBox();
  const bounds = districtMesh.geometry.boundingBox;
  if (bounds) {
    const center = new THREE.Vector3();
    bounds.getCenter(center);
    pos.add(center);
  }

  const cameraTarget = new THREE.Vector3(pos.x, MAP_DEPTH, pos.z);
  const cameraPos = new THREE.Vector3(pos.x + 3.0, MAP_DEPTH + 7.0, pos.z + 6.0);

  isZoomedIn = true;
  resetBtn?.classList.add('visible');

  animateCamera(cameraPos, cameraTarget, 850);
}

// ============================================================
//  HOVER EFFECTS
// ============================================================
function onMapHover(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Check markers
  const allMarkerMeshes = [];
  markerObjects.forEach(group => {
    group.traverse(child => {
      if (child.isMesh) {
        child.userData.parentMarker = group;
        allMarkerMeshes.push(child);
      }
    });
  });

  const markerHits = raycaster.intersectObjects(allMarkerMeshes, false);
  if (markerHits.length > 0) {
    renderer.domElement.style.cursor = 'pointer';
    markerObjects.forEach(group => {
      if (group.userData.modelMesh) {
        group.userData.modelMesh.scale.setScalar(group.userData.baseScale || 1.0);
      }
      if (group.userData.logoMedallion) {
        group.userData.logoMedallion.scale.setScalar(1.0);
      }
    });
    const hitMarker = markerHits[0].object.userData.parentMarker;
    if (hitMarker?.userData.modelMesh) {
      hitMarker.userData.modelMesh.scale.setScalar((hitMarker.userData.baseScale || 1.0) * 1.25);
    }
    if (hitMarker?.userData.logoMedallion) {
      hitMarker.userData.logoMedallion.scale.setScalar(1.22);
    }
    return;
  }

  // Check district meshes (top surface or 3D side walls)
  const districtHits = raycaster.intersectObjects(districtMeshes, false);
  if (districtHits.length > 0) {
    renderer.domElement.style.cursor = 'pointer';
    const rawHitMesh = districtHits[0].object;
    const hitMesh = rawHitMesh.userData.topMesh || rawHitMesh;

    if (hoveredDistrict && hoveredDistrict !== hitMesh && hoveredDistrict !== selectedDistrict) {
      resetDistrictMeshColor(hoveredDistrict);
    }
    if (hitMesh !== selectedDistrict) {
      setDistrictMeshColor(hitMesh, MAP_CONFIG.theme.districtHoverColor, true);
      hoveredDistrict = hitMesh;
    }
  } else {
    renderer.domElement.style.cursor = 'grab';
    if (hoveredDistrict && hoveredDistrict !== selectedDistrict) {
      resetDistrictMeshColor(hoveredDistrict);
      hoveredDistrict = null;
    }
    markerObjects.forEach(group => {
      if (group.userData.modelMesh) {
        group.userData.modelMesh.scale.setScalar(group.userData.baseScale || 1.0);
      }
      if (group.userData.logoMedallion) {
        group.userData.logoMedallion.scale.setScalar(1.0);
      }
    });
  }
}

// ============================================================
//  INFO POPUP (FLOATING CARD)
// ============================================================
function showPopup(markerGroup, data, isHQ) {
  let popup = document.getElementById('info-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'info-popup';
    popup.className = 'info-popup';
    document.querySelector('.map-section').appendChild(popup);
  }

  const branchName = data.branchName || data.name || 'Branch';
  const district = data.district || '';
  const operationType = data.type || (isHQ ? 'Headquarters' : 'Supply Chain');
  const typeConfig = BRANCH_TYPES[operationType] || BRANCH_TYPES['Supply Chain'];
  const tagClass = typeConfig.tagClass || 'supply-chain';
  const phone = data.phone || '';
  const address = data.address || '';

  popup.innerHTML = `
    <button class="popup-close" onclick="window.__mapClosePopup()">✕</button>
    <div class="popup-branch-name">${branchName}</div>
    ${district ? `<div class="popup-district">${district}</div>` : ''}
    <div class="popup-divider"></div>
    ${phone ? `
      <div class="popup-contact-row">
        <div class="popup-icon">
          <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </div>
        <a href="tel:${phone.replace(/\s/g, '')}">${phone}</a>
      </div>` : ''}
    ${address ? `
      <div class="popup-contact-row">
        <div class="popup-icon">
          <svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <a href="https://maps.google.com/?q=${encodeURIComponent(address + ', Bangladesh')}" target="_blank" rel="noopener">${address}</a>
      </div>` : ''}
    <div class="popup-arrow bottom"></div>
  `;

  activePopup = {
    element: popup,
    markerGroup: markerGroup,
  };

  updatePopupPosition();
  requestAnimationFrame(() => popup.classList.add('visible'));
}

function updatePopupPosition() {
  if (!activePopup) return;

  const section = document.getElementById('network-map');
  const containerW = section ? section.clientWidth : window.innerWidth;
  const containerH = section ? section.clientHeight : window.innerHeight;

  const worldPos = getModelWorldPos(activePopup.markerGroup);
  worldPos.y += (activePopup.markerGroup.userData.isHQ ? 0.65 : 0.45);

  const screen = worldToScreen(worldPos);

  const popupEl = activePopup.element;
  const popupW = popupEl.offsetWidth || 280;
  const popupH = popupEl.offsetHeight || 160;
  const margin = 16;
  const pointerGap = 16;

  let targetLeft = screen.x - popupW / 2;
  targetLeft = Math.max(margin, Math.min(containerW - popupW - margin, targetLeft));

  let targetTop = screen.y - popupH - pointerGap;
  let arrowIsBottom = true;

  if (targetTop < margin + 60) {
    targetTop = screen.y + pointerGap + 12;
    arrowIsBottom = false;
  }
  if (targetTop + popupH > containerH - margin) {
    targetTop = Math.max(margin, containerH - popupH - margin);
  }

  popupEl.style.left = targetLeft + 'px';
  popupEl.style.top = targetTop + 'px';

  const arrowEl = popupEl.querySelector('.popup-arrow');
  if (arrowEl) {
    const arrowX = screen.x - targetLeft;
    const clampedArrowX = Math.max(20, Math.min(popupW - 20, arrowX));
    arrowEl.style.left = clampedArrowX + 'px';
    arrowEl.style.transform = arrowIsBottom 
      ? 'translateX(-50%) rotate(45deg)' 
      : 'translateX(-50%) rotate(225deg)';
    arrowEl.className = 'popup-arrow ' + (arrowIsBottom ? 'bottom' : 'top');
  }
}

function closePopup() {
  stopAutoPanning();
  if (activeMarkerGroup) {
    setMarkerActiveState(activeMarkerGroup, false);
    activeMarkerGroup = null;
  }
  if (activePopup) {
    activePopup.element.classList.remove('visible');
    activePopup = null;
  }
  if (activeFocusLight) {
    activeFocusLight.intensity = 0;
  }
}

window.__mapClosePopup = closePopup;

// ============================================================
//  WINDOW RESIZE
// ============================================================
function onResize() {
  const section = document.getElementById('network-map');
  const width = section.clientWidth || window.innerWidth;
  const height = section.clientHeight || window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  const isMobile = (window.innerWidth <= 768);
  renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);

  if (!isZoomedIn) {
    const fitPos = getFitCameraPosition();
    camera.position.y = fitPos.y;
  }

  updatePopupPosition();
  updateHQBadgePosition();
}

// Start
document.addEventListener('DOMContentLoaded', init);
