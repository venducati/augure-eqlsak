'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DUNGEONS, type Spawn } from '../data/dungeons';
export { DUNGEONS } from '../data/dungeons';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  Eye,
  Gauge,
  MapPin,
  MousePointer2,
  Pause,
  Play,
  Rotate3D,
} from 'lucide-react';

type KataState = {
  mixer: THREE.AnimationMixer;
  actions: THREE.AnimationAction[];
  index: number;
  elapsed: number;
  interval: number;
  name: string;
};
type TourTarget = {
  position: THREE.Vector3;
  spawn: Spawn;
  likeness: THREE.Group;
  kata?: KataState;
  cameraPosition?: THREE.Vector3;
};
type WallSegment = { a: THREE.Vector3; b: THREE.Vector3 };
const dungeons = DUNGEONS;
const regionalModelDefaults: Record<string, string> = {
  blackburrow: 'splitpaw-gnoll',
  mistmoore: 'mistmoore-vampire',
  paw: 'splitpaw-gnoll',
  befallen: 'zombie',
  najena: 'goblin',
  gukbottom: 'froglok',
};
const kataNames = [
  'Changquan Flow',
  'Southern Fist Guard',
  'Crane-Wing Form',
  'Eight-Direction Form',
  'Coiling Dragon Form',
  'Drunken-Step Form',
];

function createKata(
  character: THREE.Object3D,
  clips: THREE.AnimationClip[],
  seed: number,
): KataState | undefined {
  const livingFallback = () => {
    const phase = (seed % 6) * 0.12;
    return new THREE.AnimationClip('living-idle', 2.4, [
      new THREE.NumberKeyframeTrack(
        '.rotation[y]',
        [0, 0.6, 1.2, 1.8, 2.4],
        [phase, phase + 0.09, phase, phase - 0.09, phase],
      ),
      new THREE.NumberKeyframeTrack(
        '.position[y]',
        [0, 0.6, 1.2, 1.8, 2.4],
        [0, 0.07, 0, 0.045, 0],
      ),
    ]);
  };
  if (!clips.length) {
    clips = [livingFallback()];
  }
  const mixer = new THREE.AnimationMixer(character),
    byName = new Map(clips.map((c) => [c.name, c]));
  // EQL's short clip codes contain its original skeletal combat motions. Each NPC gets a
  // different, non-repeating choreography of guards, strikes, turns, and recoveries.
  const forms = [
    ['p01', 'c05', 'p03', 'c10', 'l02', 'p06'],
    ['c09', 'p03', 'c05', 't06', 'p01', 'l01'],
    ['p06', 'c10', 'l02', 'c05', 'p03', 'o01'],
    ['t05', 'c05', 'p01', 'd01', 'p06', 'l01'],
    ['p02', 'c10', 'p03', 'c05', 'l02', 'p01'],
    ['s04', 'c03', 's12', 'c08', 'p03', 's19'],
  ];
  const desired = forms[seed % forms.length],
    selected = desired
      .map((n) => byName.get(n))
      .filter((c): c is THREE.AnimationClip => !!c);
  const fallback = clips
      .filter((c) => c.name && !c.name.startsWith('d'))
      .slice(0, 6),
    chosen = selected.length >= 3 ? selected : fallback.length ? fallback : [livingFallback()];
  const actions = chosen.map((c) =>
    mixer.clipAction(c).setLoop(THREE.LoopOnce, 1),
  );
  actions.forEach((a) => (a.clampWhenFinished = true));
  actions[0].reset().fadeIn(0.25).play();
  return {
    mixer,
    actions,
    index: 0,
    elapsed: 0,
    interval: Math.max(1.1, Math.min(2.6, chosen[0].duration * 0.82)),
    name: kataNames[seed % kataNames.length],
  };
}

function labelTexture(text: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(7,11,9,.92)';
  x.roundRect(4, 4, 504, 88, 12);
  x.fill();
  x.strokeStyle = '#d5b766';
  x.lineWidth = 3;
  x.stroke();
  x.fillStyle = '#f4ead2';
  x.font = '600 26px Arial';
  x.fillText(text, 24, 43);
  x.fillStyle = '#aeb6aa';
  x.font = '18px Arial';
  x.fillText('Named spawn', 24, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function npcLikeness(spawn: Spawn) {
  const g = new THREE.Group(),
    palette = {
      noble: '#7c2746',
      caster: '#44558d',
      ritualist: '#702332',
      beast: '#65705f',
      warrior: '#7c5934',
      judge: '#75572d',
      brute: '#65533c',
      healer: '#587a6b',
      undead: '#65746c',
    },
    cloth = new THREE.MeshStandardMaterial({
      color: palette[spawn.likeness],
      roughness: 0.72,
      metalness: 0.1,
      emissive: palette[spawn.likeness],
      emissiveIntensity: 0.14,
    }),
    skin = new THREE.MeshStandardMaterial({
      color: spawn.likeness === 'undead' ? '#9fb0a4' : '#b6a08b',
      roughness: 0.9,
    }),
    metal = new THREE.MeshStandardMaterial({
      color: '#c8b06a',
      roughness: 0.38,
      metalness: 0.75,
    });
  if (spawn.likeness === 'beast') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.65, 20, 14), cloth);
    body.scale.set(1.55, 0.75, 0.75);
    body.position.y = 1.55;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 12), skin);
    head.position.set(1.8, 1.8, 0);
    g.add(head);
    for (const z of [-0.75, 0.75])
      for (const x of [-0.9, 0.9]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.24, 1.3, 10),
          cloth,
        );
        leg.position.set(x, 0.65, z);
        g.add(leg);
      }
  } else {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 1.05, 2.7, 16),
      cloth,
    );
    body.position.y = 2.05;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.58, 20, 14), skin);
    head.position.y = 3.9;
    g.add(head);
    const shoulder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 2.35, 10),
      cloth,
    );
    shoulder.rotation.z = Math.PI / 2;
    shoulder.position.y = 2.85;
    g.add(shoulder);
    if (['caster', 'ritualist', 'healer', 'judge'].includes(spawn.likeness)) {
      const staff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 4.3, 8),
        metal,
      );
      staff.position.set(1.05, 2.15, 0);
      g.add(staff);
    } else {
      const weapon = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 2.7, 0.28),
        metal,
      );
      weapon.rotation.z = -0.35;
      weapon.position.set(1.05, 2.05, 0);
      g.add(weapon);
    }
  }
  if (spawn.likeness === 'noble') {
    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(1.18, 3.15, 18, 1, true),
      cloth,
    );
    cloak.position.set(0, 2, -0.3);
    cloak.rotation.x = 0.08;
    g.add(cloak);
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.58, 0.32, 8),
      metal,
    );
    crown.position.y = 4.5;
    g.add(crown);
  }
  if (['caster', 'ritualist', 'healer'].includes(spawn.likeness)) {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.15, 18), cloth);
    hood.position.y = 4.55;
    g.add(hood);
  }
  if (spawn.likeness === 'caster') {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 0.62), metal);
    book.position.set(-0.92, 2.45, 0.55);
    book.rotation.z = 0.25;
    g.add(book);
  }
  if (spawn.likeness === 'ritualist' || spawn.likeness === 'undead') {
    for (const x of [-0.34, 0.34]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.75, 9), metal);
      horn.position.set(x, 4.72, 0);
      horn.rotation.z = x > 0 ? -0.28 : 0.28;
      g.add(horn);
    }
  }
  if (['warrior', 'brute'].includes(spawn.likeness)) {
    for (const x of [-1.02, 1.02]) {
      const pauldron = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 12, 8),
        metal,
      );
      pauldron.scale.set(1.35, 0.65, 1);
      pauldron.position.set(x, 2.85, 0);
      g.add(pauldron);
    }
  }
  if (spawn.likeness === 'judge') {
    const helm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.61, 0.66, 0.72, 10),
      metal,
    );
    helm.position.y = 4.16;
    g.add(helm);
  }
  if (spawn.likeness === 'healer') {
    const glow = new THREE.PointLight('#8fffd0', 4, 9);
    glow.position.set(1.05, 3.3, 0);
    g.add(glow);
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.09, 8, 40),
    new THREE.MeshBasicMaterial({ color: '#f0c86c' }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);
  g.userData.spawn = spawn;
  g.traverse((o) => (o.userData.spawn = spawn));
  return g;
}

function passageLoops(segments: WallSegment[]) {
  const snap = 0.45,
    key = (p: THREE.Vector3) =>
      `${Math.round(p.x / snap)},${Math.round(p.z / snap)}`;
  const groups = new Map<number, WallSegment[]>();
  for (const s of segments) {
    if (Math.abs(s.a.y - s.b.y) > 1.5) continue;
    const level = Math.round((s.a.y + s.b.y) / 2 / 2) * 2;
    groups.set(level, [...(groups.get(level) || []), s]);
  }
  const loops: { level: number; points: THREE.Vector2[] }[] = [];
  for (const [level, edges] of groups) {
    const links = new Map<string, number[]>(),
      points = new Map<string, THREE.Vector2>();
    edges.forEach((e, i) => {
      for (const p of [e.a, e.b]) {
        const k = key(p);
        links.set(k, [...(links.get(k) || []), i]);
        points.set(k, new THREE.Vector2(p.x, p.z));
      }
    });
    const used = new Set<number>();
    for (let seed = 0; seed < edges.length; seed++) {
      if (used.has(seed)) continue;
      const start = key(edges[seed].a);
      let current = start,
        edgeIndex = seed;
      const chain: THREE.Vector2[] = [];
      for (let guard = 0; guard < 2000; guard++) {
        if (used.has(edgeIndex)) break;
        used.add(edgeIndex);
        chain.push(points.get(current)!);
        const edge = edges[edgeIndex],
          ka = key(edge.a),
          kb = key(edge.b);
        current = current === ka ? kb : ka;
        if (current === start) break;
        const next = (links.get(current) || []).find((i) => !used.has(i));
        if (next === undefined) break;
        edgeIndex = next;
      }
      if (current === start && chain.length >= 3) {
        let area = 0;
        for (let i = 0; i < chain.length; i++) {
          const a = chain[i],
            b = chain[(i + 1) % chain.length];
          area += a.x * b.y - b.x * a.y;
        }
        area = Math.abs(area / 2);
        if (area > 2 && area < 12000) loops.push({ level, points: chain });
      }
    }
  }
  return loops;
}

const locTransforms = [
  ([x, y, z]: Spawn['loc']) => new THREE.Vector3(x, z, -y),
  ([x, y, z]: Spawn['loc']) => new THREE.Vector3(y, z, -x),
  ([x, y, z]: Spawn['loc']) => new THREE.Vector3(-x, z, y),
  ([x, y, z]: Spawn['loc']) => new THREE.Vector3(-y, z, x),
];
function zoneLocTransform(spawns: Spawn[], floors: THREE.Vector3[]) {
  let chosen = 0,
    bestScore = Infinity;
  locTransforms.forEach((transform, index) => {
    let score = 0;
    for (const spawn of spawns) {
      const raw = transform(spawn.loc);
      let nearest = Infinity;
      for (const floor of floors)
        nearest = Math.min(
          nearest,
          Math.hypot(
            raw.x - floor.x,
            raw.z - floor.z,
            (raw.y - floor.y) * 0.45,
          ),
        );
      score += nearest;
    }
    if (score < bestScore) {
      bestScore = score;
      chosen = index;
    }
  });
  return chosen;
}
function groundedSpawn(
  spawn: Spawn,
  floors: THREE.Vector3[],
  center: THREE.Vector3,
  scale: number,
) {
  // EQL /loc records are X, Y, Z while imported zone meshes can use any of four
  // horizontal orientations. Select the orientation that best fits the complete
  // zone, then constrain every marker to an actual upward-facing floor sample.
  // This prevents a plausible raw coordinate from remaining outside the mesh or
  // floating in empty space after the zone is centered and scaled.
  const zoneSpawns = dungeons.find((d) => d.spawns.includes(spawn))?.spawns || [
      spawn,
    ],
    transformIndex =
      spawn.locOrder === 'yx'
        ? 1
        : spawn.locOrder === 'xy'
          ? 0
          : zoneLocTransform(zoneSpawns, floors),
    raw = locTransforms[transformIndex](spawn.loc);
  let ground: THREE.Vector3 | undefined,
    bestDistance = Infinity;
  for (const floor of floors) {
    const distance = Math.hypot(
      raw.x - floor.x,
      raw.z - floor.z,
      (raw.y - floor.y) * 0.45,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      ground = floor;
    }
  }
  if (ground) raw.copy(ground);
  return raw
    .sub(center)
    .multiplyScalar(scale)
    .add(new THREE.Vector3(0, 0.12, 0));
}

export default function Dungeon3D({
  initialDungeon,
}: {
  initialDungeon?: string;
}) {
  const mount = useRef<HTMLDivElement>(null),
    infoRef = useRef<HTMLElement>(null);
  const [zone, setZone] = useState(() =>
    Math.max(
      0,
      dungeons.findIndex(
        (d) => d.name === initialDungeon || d.id === initialDungeon,
      ),
    ),
  );
  const [active, setActive] = useState<Spawn | null>(null);
  const [tour, setTour] = useState(false);
  const [mode, setMode] = useState<'orbit' | 'fly'>('orbit');
  const [quality, setQuality] = useState<'cinematic' | 'performance'>(
    'cinematic',
  );
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState('');
  const targets = useRef<TourTarget[]>([]);
  const tourIndex = useRef(0),
    focusIndex = useRef<number | null>(null),
    focusRequest = useRef(0),
    tourRef = useRef(tour),
    modeRef = useRef(mode),
    activeRef = useRef<Spawn | null>(null),
    pendingFocusName = useRef<string | null>(null);
  const dungeon = dungeons[zone];
  useEffect(() => {
    tourRef.current = tour;
  }, [tour]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    if (!mount.current) return;
      let disposed=false;
      const mapAbort=new AbortController();
      const disposeObject=(root:THREE.Object3D)=>root.traverse(o=>{const mesh=o as THREE.Mesh;mesh.geometry?.dispose();if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){for(const value of Object.values(material))if(value instanceof THREE.Texture)value.dispose();material.dispose();}});
      const host = mount.current;
      setLoading(true);
      setActive(null);
      pendingFocusName.current = null;
      host.innerHTML = '';
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#101b16');
      scene.fog = new THREE.FogExp2(
        '#101a15',
        quality === 'cinematic' ? 0.0022 : 0.0015,
      );
      const camera = new THREE.PerspectiveCamera(
        58,
        host.clientWidth / host.clientHeight,
        0.1,
        1400,
      );
      const renderer = new THREE.WebGLRenderer({
        antialias: quality === 'cinematic',
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(
        Math.min(devicePixelRatio, quality === 'cinematic' ? 2 : 1.25),
      );
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 2.15;
      renderer.shadowMap.enabled = quality === 'cinematic';
      renderer.shadowMap.type = THREE.PCFShadowMap;
      host.appendChild(renderer.domElement);
      scene.add(new THREE.AmbientLight('#c8d8ce', 3.8));
      scene.add(new THREE.HemisphereLight('#e6fff5', '#4d4938', 4.4));
      const moon = new THREE.DirectionalLight('#d9e7ff', 6.2);
      moon.position.set(-90, 160, 80);
      moon.castShadow = true;
      scene.add(moon);
      const fire = new THREE.PointLight('#ffb05b', 155, 260, 1.25);
      fire.position.set(50, 45, 20);
      scene.add(fire);
      const fill = new THREE.PointLight('#75d8b5', 135, 290, 1.25);
      fill.position.set(-80, 35, -60);
      scene.add(fill);
      const torch = new THREE.PointLight('#ffe0aa', 85, 90, 1.1);
      torch.position.set(0, 0.5, 1);
      camera.add(torch);
      const headlamp = new THREE.SpotLight(
        '#fff4d3',
        260,
        145,
        Math.PI / 3,
        0.48,
        1,
      );
      headlamp.position.set(0, 0, 0);
      camera.add(headlamp);
      const lampTarget = new THREE.Object3D();
      lampTarget.position.set(0, 0, -12);
      camera.add(lampTarget);
      headlamp.target = lampTarget;
      scene.add(camera);
      const center = new THREE.Vector3();
      let yaw = 0,
        pitch = -0.4,
        distance = 210,
        dragButton = -1,
        last = [0, 0];
      const flyPosition = new THREE.Vector3(0, 18, 80),
        keys = new Set<string>(),
        markers: THREE.Object3D[] = [];
      targets.current = [];
      const loader = new THREE.TextureLoader();
      const wallMap = loader.load(
        dungeon.material === 'cave'
          ? '/textures/cave-limestone.png'
          : '/textures/gothic-stone.png',
      );
      const floorMap = loader.load('/textures/dungeon-floor.png');
      for (const t of [wallMap, floorMap]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(5, 5);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      if (
        [
          'blackburrow',
          'mistmoore',
          'paw',
          'befallen',
          'najena',
          'gukbottom',
        ].includes(dungeon.id)
      ) {
        new GLTFLoader().load(
          `/models/${dungeon.id}.glb`,
          (gltf) => {
            if(disposed){disposeObject(gltf.scene);return;}
            const model = gltf.scene;
            model.updateMatrixWorld(true);
            let triangles = 0;
            const floors: THREE.Vector3[] = [],
              zoneMeshes: THREE.Object3D[] = [];
            const material = new THREE.MeshStandardMaterial({
              map: wallMap,
              bumpMap: wallMap,
              bumpScale: 0.12,
              roughness: 0.86,
              metalness: 0.02,
              color: dungeon.material === 'cave' ? '#b7c3ba' : '#c3c0b8',
              emissive: dungeon.material === 'cave' ? '#18241d' : '#251d16',
              emissiveIntensity: 0.24,
              side: THREE.DoubleSide,
            });
            model.traverse((o) => {
              const mesh = o as THREE.Mesh;
              if (mesh.isMesh) {
                zoneMeshes.push(mesh);
                triangles += mesh.geometry.index
                  ? mesh.geometry.index.count / 3
                  : (mesh.geometry.attributes.position?.count || 0) / 3;
                const pos = mesh.geometry.attributes.position,
                  index = mesh.geometry.index;
                if (pos) {
                  const count = index ? index.count : pos.count;
                  for (let i = 0; i + 2 < count; i += 3) {
                    const a = new THREE.Vector3()
                        .fromBufferAttribute(pos, index ? index.getX(i) : i)
                        .applyMatrix4(mesh.matrixWorld),
                      b = new THREE.Vector3()
                        .fromBufferAttribute(
                          pos,
                          index ? index.getX(i + 1) : i + 1,
                        )
                        .applyMatrix4(mesh.matrixWorld),
                      c = new THREE.Vector3()
                        .fromBufferAttribute(
                          pos,
                          index ? index.getX(i + 2) : i + 2,
                        )
                        .applyMatrix4(mesh.matrixWorld);
                    const normal = new THREE.Vector3()
                      .crossVectors(b.clone().sub(a), c.clone().sub(a))
                      .normalize();
                    if (normal.y > 0.72)
                      floors.push(
                        a
                          .add(b)
                          .add(c)
                          .multiplyScalar(1 / 3),
                      );
                  }
                }
                mesh.material = material;
                mesh.castShadow = quality === 'cinematic';
                mesh.receiveShadow = true;
              }
            });
            const box = new THREE.Box3().setFromObject(model),
              size = box.getSize(new THREE.Vector3()),
              modelCenter = box.getCenter(new THREE.Vector3()),
              modelScale = 330 / Math.max(size.x, size.z, 1);
            model.position.sub(modelCenter);
            model.scale.setScalar(modelScale);
            scene.add(model);
            for (const spawn of dungeon.spawns) {
              const p = groundedSpawn(spawn, floors, modelCenter, modelScale),
                likeness = new THREE.Group(),
                regionalModel =
                  spawn.model || regionalModelDefaults[dungeon.id],
                target: TourTarget = { position: p, spawn, likeness };
              likeness.userData.spawn = spawn;
              if (regionalModel) {
                new GLTFLoader().load(
                  `/models/npcs/${regionalModel}.glb`,
                  (asset) => {
                    const character = asset.scene,
                      characterBox = new THREE.Box3().setFromObject(character),
                      characterSize = characterBox.getSize(new THREE.Vector3()),
                      characterCenter = characterBox.getCenter(
                        new THREE.Vector3(),
                      ),
                      characterScale =
                        spawn.likeness === 'beast'
                          ? 5.5 /
                            Math.max(
                              characterSize.x,
                              characterSize.y,
                              characterSize.z,
                              0.01,
                            )
                          : 5.8 / Math.max(characterSize.y, 0.01);
                    character.scale.setScalar(characterScale);
                    character.position.set(
                      -characterCenter.x * characterScale,
                      -characterBox.min.y * characterScale,
                      -characterCenter.z * characterScale,
                    );
                    character.traverse((o) => {
                      o.userData.spawn = spawn;
                      const mesh = o as THREE.Mesh;
                      if (mesh.isMesh) {
                        mesh.castShadow = quality === 'cinematic';
                        mesh.receiveShadow = true;
                      }
                    });
                    likeness.add(character);
                    target.kata = createKata(
                      character,
                      asset.animations,
                      dungeon.spawns.indexOf(spawn),
                    );
                  },
                );
              } else likeness.add(npcLikeness(spawn));
              likeness.position.copy(p);
              likeness.scale.setScalar(0.001);
              const npcLight = new THREE.PointLight('#ffdca4', 28, 24, 1.5);
              npcLight.position.set(0, 6, 3);
              likeness.add(npcLight);
              scene.add(likeness);
              markers.push(likeness, ...likeness.children);
              targets.current.push(target);
              const sprite = new THREE.Sprite(
                new THREE.SpriteMaterial({
                  map: labelTexture(spawn.name),
                  transparent: true,
                  depthTest: false,
                }),
              );
              sprite.position.set(0, 7.4, 0);
              sprite.scale.set(6.2, 1.16, 1);
              sprite.userData.nameplate = true;
              likeness.add(sprite);
            }
            model.updateMatrixWorld(true);
            const sightRay = new THREE.Raycaster();
            for (const target of targets.current) {
              const origin = target.position
                .clone()
                .add(new THREE.Vector3(0, 2.8, 0));
              let bestDirection = new THREE.Vector3(0, 0, 1),
                bestClearance = 0;
              for (let step = 0; step < 12; step++) {
                const angle = (step * Math.PI) / 6,
                  direction = new THREE.Vector3(
                    Math.sin(angle),
                    0,
                    Math.cos(angle),
                  );
                sightRay.set(origin, direction);
                const hit = sightRay
                    .intersectObjects(zoneMeshes, true)
                    .find((h) => h.distance > 0.7),
                  clearance = hit ? hit.distance : 20;
                if (clearance > bestClearance) {
                  bestClearance = clearance;
                  bestDirection = direction;
                }
              }
              target.cameraPosition = origin
                .clone()
                .addScaledVector(
                  bestDirection,
                  Math.min(14, Math.max(5, bestClearance - 1)),
                )
                .add(new THREE.Vector3(0, 3.4, 0));
            }
            center.set(0, 0, 0);
            distance = 240;
            const floor = floors.sort(
              (a, b) =>
                Math.hypot(a.x - modelCenter.x, a.z - modelCenter.z) +
                Math.abs(a.y - modelCenter.y) * 0.2 -
                (Math.hypot(b.x - modelCenter.x, b.z - modelCenter.z) +
                  Math.abs(b.y - modelCenter.y) * 0.2),
            )[0];
            if (floor)
              flyPosition
                .copy(floor.sub(modelCenter).multiplyScalar(modelScale))
                .add(new THREE.Vector3(0, 2.2, 0));
            else flyPosition.set(0, 2, 0);
            setStats(
              `${Math.round(triangles).toLocaleString()} authentic zone triangles · named NPCs constrained to walkable floors`,
            );
            setLoading(false);
          },
          undefined,
          () => {
            if(disposed)return;
            setStats('Zone mesh failed to load');
            setLoading(false);
          },
        );
      } else
        void fetch(`/maps/${dungeon.id}.txt`,{signal:mapAbort.signal})
          .then((r) => {if(!r.ok)throw new Error('Map unavailable');return r.text();})
          .then((text) => {
            if(disposed)return;
            const raw: number[][] = [];
            let minX = Infinity,
              maxX = -Infinity,
              minY = Infinity,
              maxY = -Infinity,
              minZ = Infinity,
              maxZ = -Infinity;
            for (const line of text.split(/\r?\n/)) {
              if (!line.startsWith('L ')) continue;
              const n = line.slice(2).split(',').map(Number);
              if (n.length < 6 || !n.every(Number.isFinite)) continue;
              const [x1, y1, z1, x2, y2, z2] = n;
              raw.push(n);
              minX = Math.min(minX, x1, x2);
              maxX = Math.max(maxX, x1, x2);
              minY = Math.min(minY, y1, y2);
              maxY = Math.max(maxY, y1, y2);
              minZ = Math.min(minZ, z1, z2);
              maxZ = Math.max(maxZ, z1, z2);
            }
            if(!raw.length)throw new Error('No readable map geometry');
            const offset = new THREE.Vector3(
                (minX + maxX) / 2,
                (minZ + maxZ) / 2,
                -(minY + maxY) / 2,
              ),
              scale = 360 / Math.max(maxX - minX, maxY - minY, 1);
            const segments = raw
              .map((n) => ({
                a: new THREE.Vector3(n[0], n[2], -n[1])
                  .sub(offset)
                  .multiplyScalar(scale),
                b: new THREE.Vector3(n[3], n[5], -n[4])
                  .sub(offset)
                  .multiplyScalar(scale),
              }))
              .filter((s) => s.a.distanceTo(s.b) > 0.2);
            const wallHeight = Math.max(3.5, Math.min(9, 18 * scale)),
              thickness = Math.max(0.45, Math.min(1.25, 3 * scale));
            const box = new THREE.BoxGeometry(1, 1, 1),
              matrix = new THREE.Matrix4(),
              quat = new THREE.Quaternion(),
              pos = new THREE.Vector3(),
              size = new THREE.Vector3();
            const walls = new THREE.InstancedMesh(
              box,
              new THREE.MeshStandardMaterial({
                map: wallMap,
                bumpMap: wallMap,
                bumpScale: 0.18,
                roughness: 0.9,
                metalness: 0.03,
                color: dungeon.material === 'cave' ? '#839087' : '#a6a9a2',
              }),
              segments.length,
            );
            segments.forEach((s, i) => {
              const dx = s.b.x - s.a.x,
                dz = s.b.z - s.a.z,
                len = Math.hypot(dx, dz);
              pos.set(
                (s.a.x + s.b.x) / 2,
                (s.a.y + s.b.y) / 2 + wallHeight / 2,
                (s.a.z + s.b.z) / 2,
              );
              quat.setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                -Math.atan2(dz, dx),
              );
              size.set(Math.max(len, 0.4), wallHeight, thickness);
              matrix.compose(pos, quat, size);
              walls.setMatrixAt(i, matrix);
            });
            walls.instanceMatrix.needsUpdate = true;
            walls.castShadow = quality === 'cinematic';
            walls.receiveShadow = true;
            scene.add(walls);
            const loops = passageLoops(segments);
            const floorMaterial = new THREE.MeshStandardMaterial({
              map: floorMap,
              bumpMap: floorMap,
              bumpScale: 0.22,
              roughness: 0.96,
              color: '#969b90',
              side: THREE.DoubleSide,
            });
            const ceilingMaterial = new THREE.MeshStandardMaterial({
              map: wallMap,
              bumpMap: wallMap,
              bumpScale: 0.12,
              roughness: 0.92,
              color: '#69736c',
              side: THREE.DoubleSide,
            });
            for (const loop of loops) {
              const shape = new THREE.Shape(loop.points);
              const floorGeom = new THREE.ShapeGeometry(shape);
              floorGeom.rotateX(Math.PI / 2);
              const floor = new THREE.Mesh(floorGeom, floorMaterial);
              floor.position.y = loop.level - 0.18;
              floor.receiveShadow = true;
              floor.castShadow = quality === 'cinematic';
              scene.add(floor);
              const ceilingGeom = floorGeom.clone();
              const ceiling = new THREE.Mesh(ceilingGeom, ceilingMaterial);
              ceiling.position.y = loop.level + wallHeight;
              ceiling.receiveShadow = true;
              ceiling.castShadow = quality === 'cinematic';
              scene.add(ceiling);
            }
            const outline = new THREE.BufferGeometry().setFromPoints(
              segments.flatMap((s) => [
                s.a.clone().add(new THREE.Vector3(0, wallHeight + 0.12, 0)),
                s.b.clone().add(new THREE.Vector3(0, wallHeight + 0.12, 0)),
              ]),
            );
            scene.add(
              new THREE.LineSegments(
                outline,
                new THREE.LineBasicMaterial({
                  color: '#9ab8a7',
                  transparent: true,
                  opacity: 0.28,
                }),
              ),
            );
            const dustCount = quality === 'cinematic' ? 900 : 250,
              dustPos = new Float32Array(dustCount * 3);
            for (let i = 0; i < dustCount; i++) {
              dustPos[i * 3] = (Math.random() - 0.5) * 390;
              dustPos[i * 3 + 1] = Math.random() * 70;
              dustPos[i * 3 + 2] = (Math.random() - 0.5) * 390;
            }
            const dustGeom = new THREE.BufferGeometry();
            dustGeom.setAttribute(
              'position',
              new THREE.BufferAttribute(dustPos, 3),
            );
            scene.add(
              new THREE.Points(
                dustGeom,
                new THREE.PointsMaterial({
                  color: '#d8c89a',
                  size: 0.22,
                  transparent: true,
                  opacity: 0.38,
                  depthWrite: false,
                }),
              ),
            );
            for (const spawn of dungeon.spawns) {
              const p = new THREE.Vector3(
                spawn.loc[0],
                spawn.loc[2],
                -spawn.loc[1],
              )
                .sub(offset)
                .multiplyScalar(scale);
              p.y += 2;
              const beacon = new THREE.Group();
              beacon.position.copy(p);
              beacon.userData.spawn = spawn;
              const orb = new THREE.Mesh(
                new THREE.IcosahedronGeometry(2.3, 2),
                new THREE.MeshStandardMaterial({
                  color: '#ff6c50',
                  emissive: '#b21f13',
                  emissiveIntensity: 3,
                  roughness: 0.25,
                }),
              );
              orb.userData.spawn = spawn;
              beacon.add(orb);
              const beam = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.8, 18, 12, 1, true),
                new THREE.MeshBasicMaterial({
                  color: '#ff6a4e',
                  transparent: true,
                  opacity: 0.18,
                  side: THREE.DoubleSide,
                  depthWrite: false,
                }),
              );
              beam.position.y = 7;
              beam.userData.spawn = spawn;
              beacon.add(beam);
              const ring = new THREE.Mesh(
                new THREE.TorusGeometry(3.6, 0.13, 8, 48),
                new THREE.MeshBasicMaterial({ color: '#ffc06c' }),
              );
              ring.rotation.x = Math.PI / 2;
              ring.userData.spawn = spawn;
              beacon.add(ring);
              scene.add(beacon);
              markers.push(beacon, ...beacon.children);
              targets.current.push({ position: p, spawn, likeness: beacon });
              const sprite = new THREE.Sprite(
                new THREE.SpriteMaterial({
                  map: labelTexture(spawn.name),
                  transparent: true,
                  depthTest: false,
                }),
              );
              sprite.position.copy(p).add(new THREE.Vector3(0, 13, 0));
              sprite.scale.set(35, 6.5, 1);
              scene.add(sprite);
            }
            const loopLevels = Array.from(
              new Set(loops.map((l) => l.level)),
            ).sort((a, b) => a - b);
            center.set(0, 0, 0);
            const startLoop = loops.reduce(
              (best, l) =>
                !best || l.points.length > best.points.length ? l : best,
              undefined as (typeof loops)[number] | undefined,
            );
            if (startLoop) {
              const start = startLoop.points
                .reduce((sum, p) => sum.add(p), new THREE.Vector2())
                .multiplyScalar(1 / startLoop.points.length);
              flyPosition.set(start.x, startLoop.level + 2.4, start.y);
            } else
              flyPosition.set(
                0,
                (loopLevels[Math.floor(loopLevels.length / 2)] ?? 0) + 2.4,
                0,
              );
            setStats(
              `${segments.length.toLocaleString()} walls · ${loops.length} enclosed passage surfaces`,
            );
            setLoading(false);
          }).catch(()=>{if(!disposed){setStats('Map could not be loaded. Choose another zone or retry.');setLoading(false);}});
      const down = (e: PointerEvent) => {
          if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
          dragButton = e.button;
          last = [e.clientX, e.clientY];
          renderer.domElement.setPointerCapture?.(e.pointerId);
        },
        move = (e: PointerEvent) => {
          if (dragButton < 0) return;
          const dx = e.clientX - last[0],
            dy = e.clientY - last[1];
          if (dragButton === 0) {
            yaw -= dx * 0.005;
            pitch = Math.max(-1.45, Math.min(1.2, pitch - dy * 0.005));
          } else {
            const right = new THREE.Vector3().setFromMatrixColumn(
                camera.matrixWorld,
                0,
              ),
              upVector = new THREE.Vector3().setFromMatrixColumn(
                camera.matrixWorld,
                1,
              ),
              panScale =
                (modeRef.current === 'orbit' ? distance : 0.7) * 0.0018;
            if (modeRef.current === 'orbit') {
              center.addScaledVector(right, -dx * panScale);
              center.addScaledVector(upVector, dy * panScale);
            } else {
              flyPosition.addScaledVector(right, -dx * panScale);
              flyPosition.addScaledVector(upVector, dy * panScale);
            }
          }
          last = [e.clientX, e.clientY];
        },
        up = () => (dragButton = -1),
        wheel = (e: WheelEvent) => {
          e.preventDefault();
          if (modeRef.current === 'orbit')
            distance = Math.max(20, Math.min(520, distance + e.deltaY * 0.14));
          else
            flyPosition.addScaledVector(
              camera.getWorldDirection(new THREE.Vector3()),
              e.deltaY * 0.055,
            );
        },
        contextmenu = (e: MouseEvent) => e.preventDefault(),
        keydown = (e: KeyboardEvent) => keys.add(e.key.toLowerCase()),
        keyup = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
      renderer.domElement.addEventListener('pointerdown', down);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('wheel', wheel, { passive: false });
      renderer.domElement.addEventListener('contextmenu', contextmenu);
      window.addEventListener('keydown', keydown);
      window.addEventListener('keyup', keyup);
      const ray = new THREE.Raycaster(),
        mouse = new THREE.Vector2(),
        click = (e: MouseEvent) => {
          const r = renderer.domElement.getBoundingClientRect();
          mouse.set(
            ((e.clientX - r.left) / r.width) * 2 - 1,
            -((e.clientY - r.top) / r.height) * 2 + 1,
          );
          ray.setFromCamera(mouse, camera);
          const hit = ray.intersectObjects(markers, true)[0];
          if (hit) {
            let o: THREE.Object3D | null = hit.object;
            while (o && !o.userData.spawn) o = o.parent;
            if (o?.userData.spawn) setActive(o.userData.spawn);
          }
        };
      renderer.domElement.addEventListener('click', click);
      const clock = new THREE.Clock();
      let frame = 0,
        dwell = 0,
        arrived = -1,
        seenRequest = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        if (seenRequest !== focusRequest.current) {
          seenRequest = focusRequest.current;
          arrived = -1;
          dwell = 0;
        }
        const dt = Math.min(clock.getDelta(), 0.05);
        for (const target of targets.current) {
          const kata = target.kata;
          if (!kata) continue;
          kata.mixer.update(dt);
          kata.elapsed += dt;
          if (kata.elapsed >= kata.interval) {
            const previous = kata.actions[kata.index],
              nextIndex = (kata.index + 1) % kata.actions.length,
              next = kata.actions[nextIndex];
            previous.fadeOut(0.28);
            next.reset().fadeIn(0.28).play();
            kata.index = nextIndex;
            kata.elapsed = 0;
            kata.interval = Math.max(
              1.1,
              Math.min(2.6, next.getClip().duration * 0.82),
            );
          }
        }
        for (const target of targets.current) {
          const plate = target.likeness.children.find(
            (o) => o.userData.nameplate,
          ) as THREE.Sprite | undefined;
          if (plate) {
            plate.visible = activeRef.current?.name !== target.spawn.name;
            const width = THREE.MathUtils.clamp(
              camera.position.distanceTo(target.position) * 0.22,
              4.8,
              6.5,
            );
            plate.scale.set(width, width / 5.33, 1);
          }
        }
        const tourTarget =
          (() => {
            if (pendingFocusName.current) {
              const pendingIndex = targets.current.findIndex(
                (target) => target.spawn.name === pendingFocusName.current,
              );
              if (pendingIndex >= 0) {
                focusIndex.current = pendingIndex;
                tourIndex.current = pendingIndex;
                pendingFocusName.current = null;
              }
            }
            return null;
          })() ||
          targets.current[
            tourRef.current
              ? tourIndex.current % Math.max(1, targets.current.length)
              : (focusIndex.current ?? -1)
          ];
        if ((tourRef.current || focusIndex.current !== null) && tourTarget) {
          const destination = (
              tourTarget.cameraPosition ||
              tourTarget.position.clone().add(new THREE.Vector3(11, 4.2, 14))
            ).clone(),
            blend = 1 - Math.exp(-dt * 1.15);
          flyPosition.lerp(destination, blend);
          camera.position.copy(flyPosition);
          camera.lookAt(
            tourTarget.position.clone().add(new THREE.Vector3(0, 2.2, 0)),
          );
          if (flyPosition.distanceTo(destination) < 1.35) {
            if (arrived !== tourIndex.current) {
              arrived = tourIndex.current;
              dwell = 0;
              tourTarget.likeness.scale.setScalar(1);
              activeRef.current = tourTarget.spawn;
              setActive(tourTarget.spawn);
            }
            dwell += dt;
            if (tourRef.current && dwell > 7 && targets.current.length > 1) {
              tourIndex.current =
                (tourIndex.current + 1) % targets.current.length;
              activeRef.current = null;
              setActive(null);
              dwell = 0;
            }
          }
        } else if (modeRef.current === 'fly') {
          const forward = new THREE.Vector3(
              -Math.sin(yaw) * Math.cos(pitch),
              Math.sin(pitch),
              -Math.cos(yaw) * Math.cos(pitch),
            ),
            right = new THREE.Vector3()
              .crossVectors(forward, new THREE.Vector3(0, 1, 0))
              .normalize(),
            speed = (keys.has('shift') ? 80 : 32) * dt;
          if (keys.has('w')) flyPosition.addScaledVector(forward, speed);
          if (keys.has('s')) flyPosition.addScaledVector(forward, -speed);
          if (keys.has('a')) flyPosition.addScaledVector(right, -speed);
          if (keys.has('d')) flyPosition.addScaledVector(right, speed);
          if (keys.has('q')) flyPosition.y -= speed;
          if (keys.has('e')) flyPosition.y += speed;
          camera.position.copy(flyPosition);
          camera.lookAt(flyPosition.clone().add(forward));
        } else {
          camera.position.set(
            center.x + Math.sin(yaw) * Math.cos(pitch) * distance,
            center.y - Math.sin(pitch) * distance,
            center.z + Math.cos(yaw) * Math.cos(pitch) * distance,
          );
          camera.lookAt(center);
        }
        renderer.render(scene, camera);
      };
      animate();
      const resize = () => {
        camera.aspect = host.clientWidth / host.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(host.clientWidth, host.clientHeight);
      };
      window.addEventListener('resize', resize);
      return () => {
        disposed=true;
        mapAbort.abort();
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('keydown', keydown);
        window.removeEventListener('keyup', keyup);
        renderer.dispose();
        disposeObject(scene);
        wallMap.dispose();floorMap.dispose();
        host.innerHTML = '';
      };
  }, [zone, quality, dungeon]);
  function nextStop() {
    if (!targets.current.length) return;
    tourIndex.current = (tourIndex.current + 1) % targets.current.length;
    focusIndex.current = null;
    activeRef.current = null;
    setActive(null);
  }
  function flyToSpawn(spawn: Spawn) {
    const index = targets.current.findIndex((t) => t.spawn.name === spawn.name);
    setTour(false);
    tourRef.current = false;
    setMode('fly');
    modeRef.current = 'fly';
    activeRef.current = spawn;
    setActive(spawn);
    if (index < 0) {
      pendingFocusName.current = spawn.name;
      focusIndex.current = null;
      focusRequest.current++;
      return;
    }
    pendingFocusName.current = null;
    focusIndex.current = index;
    focusRequest.current++;
    tourIndex.current = index;
  }
  return (
    <section className="instance3d">
      <div className="instancebar">
        <div>
          <small>AUTHENTIC EQL ZONE MESHES · ORIGINAL MODERN MATERIALS</small>
          <h2>Immersive 3D Instance Explorer</h2>
        </div>
        <div className="instanceselect">
          {dungeons.map((d, i) => (
            <button
              className={zone === i ? 'active' : ''}
              key={d.id}
              onClick={() => setZone(i)}
            >
              {d.name}
              <span>{d.range}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="viewerwrap">
        <div ref={mount} className="threeview" />
        <div className="viewertop">
          <span>
            <Rotate3D />
            Left-drag rotate
          </span>
          <span>
            <MousePointer2 />
            {mode === 'fly'
              ? 'Right-drag pan · wheel dolly'
              : 'Right-drag pan · wheel zoom'}
          </span>
          <button
            className={mode === 'fly' ? 'active' : ''}
            onClick={() => {
              const next = mode === 'orbit' ? 'fly' : 'orbit';
              setMode(next);
              modeRef.current = next;
              if (next === 'orbit') {
                setTour(false);
                tourRef.current = false;
                focusIndex.current = null;
              }
            }}
          >
            {mode === 'orbit' ? 'Enter fly mode' : 'Return to orbit'}
          </button>
          <button
            onClick={() => {
              const next = !tour;
              setTour(next);
              if (next) {
                focusIndex.current = null;
                tourIndex.current = 0;
                setMode('fly');
                modeRef.current = 'fly';
                setActive(null);
              }
            }}
          >
            {tour ? <Pause /> : <Play />}
            {tour ? 'Pause tour' : 'Auto NPC tour'}
          </button>
          {tour && <button onClick={nextStop}>Next named</button>}
          <button
            onClick={() =>
              setQuality(quality === 'cinematic' ? 'performance' : 'cinematic')
            }
          >
            <Gauge />
            {quality}
          </button>
        </div>
        {loading && (
          <div className="maploading">
            Forging solid geometry and materials…
          </div>
        )}
        <aside className="spawnpanel">
          <small>SPECIAL NPC LAYER</small>
          <h3>{dungeon.name}</h3>
          <p>
            {dungeon.status} · {dungeon.spawns.length} located named records
            <br />
            {stats}
          </p>
          {dungeon.spawns.map((s) => (
            <button
              key={s.name}
              className={active?.name === s.name ? 'active' : ''}
              onClick={() => flyToSpawn(s)}
              aria-label={`Fly to ${s.name}`}
            >
              <MapPin />
              <span>
                <b>{s.name}</b>
                <small>
                  Level {s.level} · {s.loot}
                </small>
              </span>
            </button>
          ))}
          {!dungeon.spawns.length && (
            <div className="emptymarkers">
              Solid reconstruction is available. Named coordinates still need
              EQL verification.
            </div>
          )}
        </aside>
        {active && (
          <article ref={infoRef} className="spawninfo npcbrief">
            <button
              onClick={() => {
                setActive(null);
                activeRef.current = null;
              }}
            >
              ×
            </button>
            <span>NAMED NPC · LEVEL {active.level}</span>
            <h3>{active.name}</h3>
            <dl>
              <div>
                <dt>Approximate /loc</dt>
                <dd>
                  X {active.loc[0]} · Y {active.loc[1]} · Z {active.loc[2]}
                </dd>
              </div>
              <div>
                <dt>Drops</dt>
                <dd>{active.loot}</dd>
              </div>
              <div>
                <dt>Quest intelligence</dt>
                <dd>{active.quest}</dd>
              </div>
              {active.modelLabel && (
                <div>
                  <dt>Regional NPC form</dt>
                  <dd>{active.modelLabel}</dd>
                </div>
              )}
            </dl>
            <small>
              <Eye />
              {active.source}
            </small>
          </article>
        )}
        <div className="accuracyflag">
          Geometry: authentic EQL client zone mesh · materials and lighting:
          original companion art
        </div>
      </div>
    </section>
  );
}
