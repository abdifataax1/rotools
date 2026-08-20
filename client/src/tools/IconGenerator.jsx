import React, { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { Card, PageTitle } from '../components/Card.jsx';
import { useToast } from '../components/Toast.jsx';

const defaults = { resolution: 512, rotationY: 25, elevationX: 12, cameraRoll: 0, zoom: 1.2, fieldOfView: 35, orthographic: true, outlineEnabled: true, outlineColor: '#050505', outlineThickness: 0.045, shadows: true, sunColor: '#ffffff', ambientColor: '#8ecbff', secondaryColor: '#ff8bd3', sunIntensity: 2.4, ambientIntensity: 1.4, secondaryIntensity: 0.8, exposure: 1.1, roughness: 0.55, metallic: 0, highContrastBump: true, transparency: true };

export function IconGenerator() {
  const mount = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const lightsRef = useRef([]);
  const outlineRef = useRef(null);
  const modelRef = useRef(null);
  const frameRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [active, setActive] = useState('');
  const [loadStatus, setLoadStatus] = useState('Upload a model to preview it here.');
  const [settings, setSettings] = useState(defaults);
  const { push } = useToast();
  useEffect(() => {
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.current.clientWidth, 520, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.current.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(35, mount.current.clientWidth / 520, 0.1, 100);
    camera.position.set(0, 0.6, 4.6);
    const hemi = new THREE.HemisphereLight('#ffffff', '#0a0d14', 0.7);
    hemi.userData.baseLight = true;
    scene.add(hemi);
    sceneRef.current = scene; rendererRef.current = renderer; cameraRef.current = camera;
    const resize = () => {
      if (!mount.current || !rendererRef.current || !cameraRef.current) return;
      const width = Math.max(320, mount.current.clientWidth);
      rendererRef.current.setSize(width, 520, false);
      cameraRef.current.aspect = width / 520;
      cameraRef.current.updateProjectionMatrix();
      renderScene();
    };
    window.addEventListener('resize', resize);
    let dragging = false; let lastX = 0;
    const canvas = renderer.domElement;
    canvas.onpointerdown = (e) => { dragging = true; lastX = e.clientX; };
    canvas.onpointerup = () => { dragging = false; };
    canvas.onpointermove = (e) => { if (dragging) { setSettings((s) => ({ ...s, rotationY: s.rotationY + (e.clientX - lastX) * 0.4 })); lastX = e.clientX; } };
    canvas.onwheel = (e) => { e.preventDefault(); setSettings((s) => ({ ...s, zoom: Math.min(4, Math.max(.4, s.zoom + e.deltaY * .001)) })); };
    return () => { window.removeEventListener('resize', resize); renderer.dispose(); canvas.remove(); };
  }, []);
  useEffect(() => { renderScene(); });
  async function loadFiles(list) {
    const next = [];
    for (const file of list) {
      const url = URL.createObjectURL(file);
      next.push({ name: file.name.replace(/\.[^.]+$/, ''), file, url });
    }
    setFiles((old) => [...old, ...next]);
    if (!active && next[0]) setActive(next[0].name);
  }
  useEffect(() => {
    const entry = files.find((f) => f.name === active);
    if (entry) loadModel(entry);
  }, [active, files.length]);
  async function loadModel(entry) {
    setLoadStatus(`Loading ${entry.name}...`);
    const ext = entry.file.name.split('.').pop().toLowerCase();
    const loader = ext === 'obj' ? new OBJLoader() : ext === 'fbx' ? new FBXLoader() : new GLTFLoader();
    loader.load(entry.url, (asset) => {
      const object = asset.scene || asset;
      const scene = sceneRef.current;
      if (!scene) return;
      if (modelRef.current) scene.remove(modelRef.current);
      if (outlineRef.current) {
        scene.remove(outlineRef.current);
        outlineRef.current = null;
      }
      object.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        child.material = materials.map((material) => {
          const next = material || new THREE.MeshStandardMaterial({ color: '#d7f7ff' });
          next.roughness = Number(settings.roughness);
          next.metalness = Number(settings.metallic);
          next.needsUpdate = true;
          return next;
        });
        if (child.material.length === 1) child.material = child.material[0];
      });
      object.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) {
        console.error('RoTools model load failed: model contains no renderable mesh.');
        setLoadStatus(`${entry.name} has no renderable mesh.`);
        push(`${entry.name} has no renderable mesh.`, 'error');
        return;
      }
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxAxis = Math.max(size.x, size.y, size.z) || 1;
      const frame = new THREE.Group();
      object.position.sub(center);
      object.scale.setScalar(2.4 / maxAxis);
      frame.add(object);
      modelRef.current = frame;
      scene.add(frame);
      frameRef.current = { radius: Math.max(1.2, maxAxis * (2.4 / maxAxis) * 0.75) };
      setLoadStatus(`${entry.name} loaded.`);
      renderScene();
    }, undefined, (error) => {
      console.error('RoTools model load failed:', error);
      setLoadStatus(`Could not load ${entry.name}.`);
      push(`Could not load ${entry.name}.`, 'error');
    });
  }
  function renderScene(exportSize) {
    const scene = sceneRef.current, renderer = rendererRef.current, camera = cameraRef.current, model = modelRef.current;
    if (!scene || !renderer || !camera) return;
    renderer.setClearColor(0x000000, settings.transparency ? 0 : 1);
    renderer.toneMappingExposure = settings.exposure;
    lightsRef.current.forEach((light) => scene.remove(light));
    lightsRef.current = [];
    if (outlineRef.current) {
      scene.remove(outlineRef.current);
      outlineRef.current = null;
    }
    const sun = new THREE.DirectionalLight(settings.sunColor, settings.sunIntensity); sun.position.set(4, 5, 6); scene.add(sun);
    const ambient = new THREE.AmbientLight(settings.ambientColor, settings.ambientIntensity); scene.add(ambient);
    const second = new THREE.DirectionalLight(settings.secondaryColor, settings.secondaryIntensity); second.position.set(-4, 2, -3); scene.add(second);
    lightsRef.current = [sun, ambient, second];
    if (model) {
      model.rotation.set(THREE.MathUtils.degToRad(settings.elevationX), THREE.MathUtils.degToRad(settings.rotationY), THREE.MathUtils.degToRad(settings.cameraRoll));
      model.traverse((child) => {
        if (!child.isMesh) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (!material) return;
          material.roughness = Number(settings.roughness);
          material.metalness = Number(settings.metallic);
          material.needsUpdate = true;
        });
      });
      if (settings.outlineEnabled) {
        const outline = model.clone();
        outline.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshBasicMaterial({ color: settings.outlineColor, side: THREE.BackSide, depthWrite: false });
            child.renderOrder = 0;
          }
        });
        outline.scale.multiplyScalar(1 + Number(settings.outlineThickness));
        outlineRef.current = outline;
        scene.add(outline);
        model.traverse((child) => { if (child.isMesh) child.renderOrder = 1; });
      }
    }
    const radius = frameRef.current?.radius || 1.8;
    camera.fov = Number(settings.fieldOfView);
    camera.position.set(0, radius * 0.28, (radius * 2.8) / Number(settings.zoom));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const old = renderer.getSize(new THREE.Vector2());
    if (exportSize) renderer.setSize(exportSize, exportSize, false);
    renderer.render(scene, camera);
    if (exportSize) renderer.setSize(old.x, old.y, false);
  }
  function exportPng(name = active) {
    renderScene(Number(settings.resolution));
    const url = rendererRef.current.domElement.toDataURL('image/png');
    const a = document.createElement('a'); a.href = url; a.download = `${name || 'rbx-icon'}.png`; a.click();
  }
  async function exportZip() {
    const zip = new JSZip();
    for (const file of files) {
      setActive(file.name);
      await new Promise((r) => setTimeout(r, 200));
      renderScene(Number(settings.resolution));
      const data = rendererRef.current.domElement.toDataURL('image/png').split(',')[1];
      zip.file(`${file.name}.png`, data, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'rbx-icons.zip'; a.click(); URL.revokeObjectURL(url);
  }
  const controls = [['resolution', 'select', [64, 128, 256, 512, 1024]], ['rotationY', 'range', [-180, 180]], ['elevationX', 'range', [-90, 90]], ['cameraRoll', 'range', [-45, 45]], ['zoom', 'range', [.4, 4]], ['fieldOfView', 'range', [15, 75]], ['outlineThickness', 'range', [0, .16]], ['sunIntensity', 'range', [0, 5]], ['ambientIntensity', 'range', [0, 4]], ['secondaryIntensity', 'range', [0, 4]], ['exposure', 'range', [.2, 2.5]], ['roughness', 'range', [0, 1]], ['metallic', 'range', [0, 1]]];
  return (
    <div>
      <PageTitle eyebrow="3D Icon / Outline Generator" title="Render Roblox-style model icons">Upload GLB, GLTF, OBJ, or FBX models and export transparent outlined PNGs or a ZIP batch.</PageTitle>
      <div className="grid gap-4 xl:grid-cols-[320px_1fr_260px]">
        <Card className="p-4"><label className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 p-8 text-center text-slate-300"><Upload className="mb-2 text-neon" /> Drop or upload models<input multiple className="hidden" type="file" accept=".glb,.gltf,.obj,.fbx" onChange={(e) => loadFiles(e.target.files)} /></label>{controls.map(([key, type, opts]) => <label key={key} className="mb-3 block text-xs uppercase tracking-wide text-slate-400">{key}{type === 'select' ? <select className="field mt-1" value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}>{opts.map((x) => <option key={x}>{x}</option>)}</select> : <input className="mt-1 w-full accent-neon" type="range" min={opts[0]} max={opts[1]} step="0.01" value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} />}</label>)}{['orthographic', 'outlineEnabled', 'shadows', 'highContrastBump', 'transparency'].map((key) => <label key={key} className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })} /> {key}</label>)}{['outlineColor', 'sunColor', 'ambientColor', 'secondaryColor'].map((key) => <label key={key} className="mb-3 flex items-center justify-between text-sm">{key}<input type="color" value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} /></label>)}</Card>
        <Card className="overflow-hidden p-3"><div className="relative min-h-[520px] rounded-xl bg-[radial-gradient(circle_at_center,rgba(101,228,255,.12),rgba(0,0,0,.08)_48%,rgba(0,0,0,.22))]"><div ref={mount} className="min-h-[520px]" /><div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-slate-300 backdrop-blur">{loadStatus}</div></div></Card>
        <Card className="p-4"><h3 className="mb-3 font-bold">Export results</h3><div className="mb-4 grid gap-2">{files.length ? files.map((f) => <button key={f.name} onClick={() => setActive(f.name)} className={`rounded-lg px-3 py-2 text-left text-sm ${active === f.name ? 'bg-neon/15 text-neon' : 'bg-white/5'}`}>{f.name}</button>) : <p className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">No models uploaded yet.</p>}</div><button className="btn-primary mb-2 w-full" disabled={!active} onClick={() => exportPng()}><Download size={16} /> Export PNG</button><button className="btn-ghost mb-2 w-full" disabled={!files.length} onClick={exportZip}>Batch ZIP</button><button className="btn-ghost w-full" onClick={() => setSettings(defaults)}><RotateCcw size={16} /> Reset camera</button></Card>
      </div>
    </div>
  );
}
