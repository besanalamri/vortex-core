import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export type EngineEvents = {
  score: (distance: number, crystals: number, speed: number) => void;
  crystal: () => void;
  gameover: (score: number, crystals: number) => void;
};

type Hazard = { group: THREE.Group; lane: number; z: number; gap: number; passed: boolean };
type Pickup = { mesh: THREE.Mesh; lane: number; z: number; collected: boolean };

export class VortexEngine {
  private canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1, 0.1, 180);
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private player = new THREE.Group();
  private hazards: Hazard[] = [];
  private pickups: Pickup[] = [];
  private sparks: THREE.Points[] = [];
  private ringLines: THREE.Line[] = [];
  private clock = new THREE.Clock();
  private frame = 0;
  private running = false;
  private lastSpawn = 0;
  private distance = 0;
  private crystals = 0;
  private lane = 0;
  private targetLane = 0;
  private speed = 17;
  private shield = false;
  private multiplier = 1;
  private skin = '#3cf7ff';
  private events: EngineEvents;
  private audio?: AudioContext;
  private musicTimer?: number;
  private touchX?: number;

  constructor(canvas: HTMLCanvasElement, events: EngineEvents) {
    this.canvas = canvas;
    this.events = events;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.composer = new EffectComposer(this.renderer);
    this.setupScene();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  setLoadout(loadout: { shield: boolean; multiplier: number; skin: string }) {
    this.shield = loadout.shield;
    this.multiplier = loadout.multiplier;
    this.skin = loadout.skin;
    const material = (this.player.children[0] as THREE.Mesh)?.material as THREE.MeshStandardMaterial | undefined;
    if (material) material.color.set(this.skin);
  }

  start() {
    this.reset();
    this.running = true;
    this.initAudio();
    this.clock.start();
    this.animate();
  }

  stop() { this.running = false; if (this.musicTimer) window.clearInterval(this.musicTimer); }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.dispose();
  }

  private setupScene() {
    this.scene.fog = new THREE.FogExp2(0x050718, 0.018);
    this.scene.background = null;
    this.camera.position.set(0, 1.5, 7.5);
    this.camera.lookAt(0, 0, -24);
    this.scene.add(new THREE.AmbientLight(0x182d66, 1.8));
    const key = new THREE.PointLight(0x38e8ff, 35, 32); key.position.set(0, 2, 4); this.scene.add(key);
    const magenta = new THREE.PointLight(0xff27ce, 25, 55); magenta.position.set(0, -2, -35); this.scene.add(magenta);

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 3), new THREE.MeshStandardMaterial({ color: this.skin, emissive: 0x0c8ea8, emissiveIntensity: 4.4, roughness: 0.18, metalness: 0.6 }));
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.055, 12, 64), new THREE.MeshBasicMaterial({ color: 0xff4eea, transparent: true, opacity: .9 }));
    halo.rotation.x = Math.PI / 2;
    this.player.add(core, halo); this.player.position.set(0, 0.05, 1.2); this.scene.add(this.player);

    for (let i = 0; i < 16; i++) {
      const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, 5.5 + (i % 4) * 1.1, 3.3 + (i % 3) * 0.8, 0, Math.PI * 2, false, 0).getPoints(80)), new THREE.LineBasicMaterial({ color: i % 2 ? 0x1a65ff : 0xc42bff, transparent: true, opacity: .32 }));
      ring.rotation.x = Math.PI / 2; ring.position.z = -i * 8 - 3; this.scene.add(ring); this.ringLines.push(ring);
    }
    const grid = new THREE.GridHelper(48, 30, 0x1f51c7, 0x112458); grid.position.y = -2.7; grid.position.z = -52; grid.scale.z = 3; (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = .6; this.scene.add(grid);
    const renderPass = new RenderPass(this.scene, this.camera); this.composer.addPass(renderPass);
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 1.45, .65, .38));
    this.spawnSparks();
  }

  private spawnSparks() {
    const count = 900; const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { positions[i * 3] = (Math.random() - .5) * 34; positions[i * 3 + 1] = (Math.random() - .5) * 20; positions[i * 3 + 2] = -Math.random() * 130; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x63ddff, size: .08, transparent: true, opacity: .78 })); this.scene.add(points); this.sparks.push(points);
  }

  private reset() {
    this.hazards.forEach(h => this.scene.remove(h.group)); this.pickups.forEach(p => this.scene.remove(p.mesh)); this.hazards = []; this.pickups = [];
    this.distance = 0; this.crystals = 0; this.speed = 17; this.lane = 0; this.targetLane = 0; this.lastSpawn = 0;
    this.player.visible = true; this.player.position.x = 0;
  }

  private spawnHazard(z: number) {
    const gap = Math.floor(Math.random() * 3) - 1; const group = new THREE.Group();
    [-1, 0, 1].filter(l => l !== gap).forEach(l => { const bar = new THREE.Mesh(new THREE.BoxGeometry(2.25, .38, .5), new THREE.MeshStandardMaterial({ color: 0xff2bc2, emissive: 0xf0189a, emissiveIntensity: 5, metalness: .4 })); bar.position.set(l * 2.05, 0, 0); group.add(bar); });
    group.position.set(0, 1, z); this.scene.add(group); this.hazards.push({ group, lane: 0, z, gap, passed: false });
    if (Math.random() > .2) { const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(.34, 1), new THREE.MeshStandardMaterial({ color: 0x7dfff6, emissive: 0x15d6ff, emissiveIntensity: 7 })); mesh.position.set(gap * 2.05, .2, z - 1.3); this.scene.add(mesh); this.pickups.push({ mesh, lane: gap, z: z - 1.3, collected: false }); }
  }

  private animate = () => {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), .05); this.frame += dt; this.distance += dt * this.speed; this.speed = Math.min(30, 17 + this.distance / 180);
    this.targetLane = Math.max(-1, Math.min(1, this.targetLane)); this.lane += (this.targetLane - this.lane) * Math.min(1, dt * 10); this.player.position.x = this.lane * 2.05; this.player.rotation.z = (this.targetLane - this.lane) * -.22; this.player.children[0].rotation.y += dt * 2.2; this.player.children[1].rotation.z -= dt * 2.8;
    this.lastSpawn -= dt; if (this.lastSpawn <= 0) { this.spawnHazard(-90); this.lastSpawn = Math.max(.72, 1.35 - this.distance / 4200); }
    this.hazards.forEach(h => { h.group.position.z += this.speed * dt; if (!h.passed && h.group.position.z > 2.3) { h.passed = true; this.playTone(660, .045); } if (h.group.position.z > 5) this.scene.remove(h.group); });
    this.pickups.forEach(p => { p.mesh.position.z += this.speed * dt; p.mesh.rotation.x += dt * 3; p.mesh.rotation.y += dt * 4; if (!p.collected && p.mesh.position.z > .45 && p.mesh.position.z < 2 && Math.abs(this.lane - p.lane) < .38) { p.collected = true; this.crystals += this.multiplier; p.mesh.visible = false; this.events.crystal(); this.playTone(980, .08); } if (p.mesh.position.z > 5) this.scene.remove(p.mesh); });
    this.hazards.filter(h => h.group.position.z > -.3 && h.group.position.z < 1.7).forEach(h => { if (Math.abs(this.lane - h.gap) > .3) this.endGame(); });
    this.ringLines.forEach((r, i) => { r.position.z += this.speed * dt; if (r.position.z > 8) r.position.z -= 128; r.rotation.z += dt * (.06 + i * .002); }); this.sparks.forEach(s => { s.position.z += this.speed * dt * .42; if (s.position.z > 8) s.position.z = -120; });
    this.events.score(Math.floor(this.distance), this.crystals, this.speed); this.composer.render(); requestAnimationFrame(this.animate);
  };

  private endGame() { if (!this.running) return; if (this.shield) { this.shield = false; this.playTone(180, .2); this.hazards.forEach(h => { if (h.group.position.z > -.6 && h.group.position.z < 1.8) h.group.position.z = 5; }); return; } this.running = false; this.playTone(90, .4); this.player.visible = false; this.burst(); this.events.gameover(Math.floor(this.distance), this.crystals); }
  private burst() { const count = 180; const pos = new Float32Array(count * 3); const vel = new Float32Array(count * 3); for (let i=0;i<count;i++){pos[i*3]=this.player.position.x;pos[i*3+1]=.2;pos[i*3+2]=1;vel[i*3]=(Math.random()-.5)*.35;vel[i*3+1]=(Math.random()-.5)*.35;vel[i*3+2]=Math.random()*.55;} const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));const p=new THREE.Points(g,new THREE.PointsMaterial({color:0xff54dc,size:.13,transparent:true,opacity:1}));this.scene.add(p);let t=0;const tick=()=>{t+=.016;const a=p.geometry.attributes.position.array as Float32Array;for(let i=0;i<count;i++){a[i*3]+=vel[i*3];a[i*3+1]+=vel[i*3+1];a[i*3+2]+=vel[i*3+2];}p.geometry.attributes.position.needsUpdate=true;p.material.opacity=Math.max(0,1-t/1.7);if(t<1.7)requestAnimationFrame(tick);else this.scene.remove(p);};tick();}

  private initAudio() { if (this.audio) return; this.audio = new AudioContext(); const master = this.audio.createGain(); master.gain.value = .035; master.connect(this.audio.destination); const notes = [110, 146.83, 164.81, 220]; let index = 0; this.musicTimer = window.setInterval(() => { if (!this.audio) return; const osc = this.audio.createOscillator(); const gain = this.audio.createGain(); osc.type='sawtooth';osc.frequency.value=notes[index++%notes.length];gain.gain.setValueAtTime(.0001,this.audio.currentTime);gain.gain.exponentialRampToValueAtTime(.16,this.audio.currentTime+.02);gain.gain.exponentialRampToValueAtTime(.0001,this.audio.currentTime+.24);osc.connect(gain).connect(master);osc.start();osc.stop(this.audio.currentTime+.25); }, 320); }
  private playTone(freq: number, duration: number) { if (!this.audio) return; const osc=this.audio.createOscillator();const gain=this.audio.createGain();osc.type='triangle';osc.frequency.value=freq;gain.gain.setValueAtTime(.0001,this.audio.currentTime);gain.gain.exponentialRampToValueAtTime(.15,this.audio.currentTime+.01);gain.gain.exponentialRampToValueAtTime(.0001,this.audio.currentTime+duration);osc.connect(gain).connect(this.audio.destination);osc.start();osc.stop(this.audio.currentTime+duration+.02); }
  private resize = () => { const w=this.canvas.clientWidth||window.innerWidth,h=this.canvas.clientHeight||window.innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.composer.setSize(w,h); };
  private onKeyDown = (e: KeyboardEvent) => { if (e.key==='ArrowLeft'||e.key.toLowerCase()==='a') this.targetLane--; if (e.key==='ArrowRight'||e.key.toLowerCase()==='d') this.targetLane++; };
  private onPointerDown = (e: PointerEvent) => { this.touchX=e.clientX; };
  private onPointerUp = (e: PointerEvent) => { if (this.touchX===undefined) return; const dx=e.clientX-this.touchX; if (Math.abs(dx)>24) this.targetLane += dx>0 ? 1 : -1; this.touchX=undefined; };
  private bindInput() { window.addEventListener('keydown', this.onKeyDown); this.canvas.addEventListener('pointerdown', this.onPointerDown); this.canvas.addEventListener('pointerup', this.onPointerUp); }
}
