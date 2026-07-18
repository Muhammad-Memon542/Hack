"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The "Odds Arena" — a live, interactive 3D reimagining of the odds chart.
 * Two glowing pillars (YES green / NO red) rise and fall as the market moves;
 * a neon grid floor, drifting particle field, and colored rim lights set the
 * mood. Drag to orbit, click a pillar to make it jump. Heights lerp toward the
 * live odds every frame, so bot trades visibly push the book in real time.
 *
 * Pure three.js in a single effect (no react-three-fiber) for a light, reliable
 * build; loaded client-only via next/dynamic from OddsChart.
 */
export function OddsArena3D({
  yes,
  yesPool,
  noPool,
  live,
}: {
  yes: number; // 0..100
  yesPool: number;
  noPool: number;
  live: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Live targets pushed in without rebuilding the scene.
  const targets = useRef({ yes, yesPool, noPool });
  targets.current = { yes, yesPool, noPool };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 600;
    let height = mount.clientHeight || 300;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    camera.position.set(0, 3.4, 8.2);
    camera.lookAt(0, 1.1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.style.display = "block";

    // ---- lights ----
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(3, 8, 6);
    scene.add(key);
    const yesLight = new THREE.PointLight(0x22e07a, 42, 18, 2);
    yesLight.position.set(-2.2, 2.4, 2.2);
    scene.add(yesLight);
    const noLight = new THREE.PointLight(0xff4d6d, 42, 18, 2);
    noLight.position.set(2.2, 2.4, 2.2);
    scene.add(noLight);

    // group we rotate on drag
    const group = new THREE.Group();
    scene.add(group);

    // ---- neon grid floor ----
    const grid = new THREE.GridHelper(20, 30, 0x8b8bd6, 0x2a2a44);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    grid.position.y = 0;
    group.add(grid);

    // ---- pillars ----
    function makePillar(color: number, x: number) {
      const geo = new THREE.BoxGeometry(1.5, 1, 1.5);
      geo.translate(0, 0.5, 0); // base at y=0, grows upward
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.55,
        metalness: 0.35,
        roughness: 0.25,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = x;
      // glowing wireframe cage
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5, 1, 1.5).translate(0, 0.5, 0)),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
      );
      mesh.add(edges);
      group.add(mesh);
      return mesh;
    }
    const yesPillar = makePillar(0x18c964, -1.7);
    const noPillar = makePillar(0xff4d6d, 1.7);

    // halo rings around pillar bases
    function makeRing(color: number, x: number) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.15, 1.4, 48),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.02, 0);
      group.add(ring);
      return ring;
    }
    const yesRing = makeRing(0x18c964, -1.7);
    const noRing = makeRing(0xff4d6d, 1.7);

    // ---- particle field ----
    const P = 240;
    const pgeo = new THREE.BufferGeometry();
    const pos = new Float32Array(P * 3);
    for (let i = 0; i < P; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    pgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const particles = new THREE.Points(
      pgeo,
      new THREE.PointsMaterial({
        color: 0xa9b0ff,
        size: 0.06,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    group.add(particles);

    // ---- interaction: drag to orbit ----
    let dragging = false;
    let px = 0,
      py = 0;
    let velY = 0.0025; // idle auto-spin
    let velX = 0;
    let rotX = 0.18;
    let downT = 0;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const bump = { yes: 0, no: 0 }; // click impulse

    const onDown = (e: PointerEvent) => {
      dragging = true;
      downT = performance.now();
      px = e.clientX;
      py = e.clientY;
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      px = e.clientX;
      py = e.clientY;
      velY = dx * 0.005;
      velX = dy * 0.004;
      group.rotation.y += velY;
      rotX = Math.max(-0.15, Math.min(0.9, rotX + velX));
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      renderer.domElement.style.cursor = "grab";
      // treat as click if quick + no movement → bounce nearest pillar
      if (performance.now() - downT < 220 && Math.abs(velY) < 0.01) {
        const rect = renderer.domElement.getBoundingClientRect();
        ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObjects([yesPillar, noPillar], false)[0];
        if (hit) {
          if (hit.object === yesPillar) bump.yes = 1;
          else bump.no = 1;
        }
      }
      if (!velY) velY = 0.0025;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    // ---- animation ----
    let yh = 1,
      nh = 1;
    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const t = clock.getElapsedTime();
      const { yes: yTarget } = targets.current;
      // map percentage → height (0.5 .. 4.2)
      const yTargetH = 0.5 + (yTarget / 100) * 3.7;
      const nTargetH = 0.5 + ((100 - yTarget) / 100) * 3.7;
      yh += (yTargetH - yh) * 0.08;
      nh += (nTargetH - nh) * 0.08;

      const yBump = bump.yes * 0.6 * Math.sin(Math.min(1, bump.yes) * Math.PI);
      const nBump = bump.no * 0.6 * Math.sin(Math.min(1, bump.no) * Math.PI);
      bump.yes = Math.max(0, bump.yes - 0.06);
      bump.no = Math.max(0, bump.no - 0.06);

      const yBob = Math.sin(t * 1.6) * 0.05;
      const nBob = Math.sin(t * 1.6 + 1) * 0.05;
      yesPillar.scale.y = yh + yBump + yBob;
      noPillar.scale.y = nh + nBump + nBob;

      // pulse emissive with a subtle heartbeat
      (yesPillar.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.12;
      (noPillar.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(t * 3 + 1) * 0.12;

      // rings pulse
      const rs = 1 + Math.sin(t * 2) * 0.06;
      yesRing.scale.setScalar(rs);
      noRing.scale.setScalar(1 + Math.sin(t * 2 + 1) * 0.06);

      // idle spin + inertia decay
      if (!dragging) {
        group.rotation.y += velY;
        velY += (0.0025 - velY) * 0.02; // ease back to idle spin
      }
      group.rotation.x += (rotX - group.rotation.x) * 0.08;

      // drift particles upward, wrap around
      const pa = particles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < P; i++) {
        let yv = pa.getY(i) + 0.006;
        if (yv > 8) yv = 0;
        pa.setY(i, yv);
      }
      pa.needsUpdate = true;
      particles.rotation.y = t * 0.03;

      // move rim lights with pillars
      yesLight.position.y = yh * 0.9 + 0.6;
      noLight.position.y = nh * 0.9 + 0.6;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    // ---- resize ----
    const ro = new ResizeObserver(() => {
      width = mount.clientWidth || width;
      height = mount.clientHeight || height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
