"use client";
import { useEffect, useRef } from "react";

export function AmbientScene() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let disposed = false;
    let cleanup = () => {};
    void import("three").then((THREE) => {
      if (disposed || !host.current) return;
      let renderer: import("three").WebGLRenderer;
      try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" }); }
      catch { return; }
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
      camera.position.z = 5.2;
      const group = new THREE.Group();
      scene.add(group);
      const geometry = new THREE.IcosahedronGeometry(1.12, 5);
      const position = geometry.getAttribute("position");
      const colors = new Float32Array(position.count * 3);
      const coral = new THREE.Color("#ff8b84");
      const iris = new THREE.Color("#8471f4");
      const mint = new THREE.Color("#73d5c4");
      const color = new THREE.Color();
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
        const radius = 1 + Math.sin(x * 4.2 + z * 1.8) * Math.cos(y * 3.8 - z) * 0.08;
        position.setXYZ(i, x * radius, y * radius, z * radius);
        const t = THREE.MathUtils.clamp((y + 1.2) / 2.4, 0, 1);
        color.copy(coral).lerp(iris, THREE.MathUtils.smoothstep(t, 0, 0.58));
        if (t > 0.48) color.lerp(mint, THREE.MathUtils.smoothstep(t, 0.48, 1) * 0.72);
        colors.set([color.r, color.g, color.b], i * 3);
      }
      position.needsUpdate = true;
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const material = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.08, clearcoat: 1 });
      const core = new THREE.Mesh(geometry, material);
      group.add(core);
      const ringMat = new THREE.MeshBasicMaterial({ color: "#ded8ff", transparent: true, opacity: 0.75 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.58, 0.013, 8, 120), ringMat);
      ring.rotation.set(0.82, 0.18, -0.32);
      group.add(ring);
      const orbitMat = new THREE.MeshBasicMaterial({ color: "#ffa59a", transparent: true, opacity: 0.6 });
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.009, 8, 120), orbitMat);
      orbit.rotation.set(1.1, -0.42, 0.58);
      group.add(orbit);
      scene.add(new THREE.AmbientLight("#ffffff", 1.8));
      const key = new THREE.DirectionalLight("#fff2df", 3.2);
      key.position.set(3, 4, 5);
      scene.add(key);
      const rim = new THREE.PointLight("#b3a9ff", 18, 9);
      rim.position.set(-2.4, -1.3, 2.8);
      scene.add(rim);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.className = "ambient-scene-canvas";
      renderer.domElement.setAttribute("aria-hidden", "true");
      root.appendChild(renderer.domElement);
      let visible = true, frame = 0;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const draw = (time: number) => {
        frame = 0;
        if (document.hidden || !visible) return;
        const t = reduced ? 0 : time * 0.00022;
        group.rotation.y = t * 0.7;
        group.rotation.x = Math.sin(t * 0.55) * 0.16;
        core.rotation.z = Math.sin(t * 0.42) * 0.08;
        renderer.render(scene, camera);
        if (!reduced) frame = requestAnimationFrame(draw);
      };
      const resize = () => {
        const r = root.getBoundingClientRect();
        if (!r.width || !r.height) return;
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
        if (!frame) frame = requestAnimationFrame(draw);
      };
      const ro = new ResizeObserver(resize);
      ro.observe(root);
      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !frame) frame = requestAnimationFrame(draw);
        if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; }
      });
      io.observe(root);
      const onVisibility = () => {
        if (!document.hidden && visible && !frame) frame = requestAnimationFrame(draw);
        if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
      };
      document.addEventListener("visibilitychange", onVisibility);
      resize();
      cleanup = () => {
        if (frame) cancelAnimationFrame(frame);
        ro.disconnect(); io.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        geometry.dispose(); material.dispose(); ring.geometry.dispose(); orbit.geometry.dispose();
        ringMat.dispose(); orbitMat.dispose(); renderer.dispose(); renderer.domElement.remove();
      };
    }).catch(() => {});
    return () => { disposed = true; cleanup(); };
  }, []);
  return <div className="ambient-scene" ref={host} aria-hidden="true"><span className="ambient-scene-glow" /></div>;
}
