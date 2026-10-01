import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { RotateCw, ZoomIn, ZoomOut, Layers } from 'lucide-react';

export const Heatmap3DView = ({ hotspots = [], screenImage, onFallback }) => {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer, scene, camera, plane, animationFrameId;
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotationSpeed = { x: 0.001, y: 0.004 };

    try {
      // 1. Scene & Camera setup
      scene = new THREE.Scene();
      scene.background = null; // Transparent background for glassmorphism

      const width = container.clientWidth || 760;
      const height = container.clientHeight || 480;

      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(0, -6, 12);
      camera.lookAt(0, 0, 0);

      // 2. WebGL Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      container.appendChild(renderer.domElement);

      // 3. Studio Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
      scene.add(ambientLight);

      // Warm key light
      const keyLight = new THREE.DirectionalLight(0xffeedd, 2.0);
      keyLight.position.set(8, 12, 10);
      scene.add(keyLight);

      // Indigo rim light
      const rimLight = new THREE.DirectionalLight(0x6c63ff, 2.5);
      rimLight.position.set(-10, -5, 6);
      scene.add(rimLight);

      // Soft coral fill light
      const fillLight = new THREE.DirectionalLight(0xf08a7e, 1.8);
      fillLight.position.set(0, -10, 4);
      scene.add(fillLight);

      // 4. Create Topography Geometry
      const segW = 80;
      const segH = 50;
      const geomWidth = 14;
      const geomHeight = 8.8;
      const geometry = new THREE.PlaneGeometry(geomWidth, geomHeight, segW, segH);

      // Create vertex colors based on height / heat density
      const count = geometry.attributes.position.count;
      const colors = new Float32Array(count * 3);
      const pos = geometry.attributes.position;

      // Color palette:
      // Base: Pale peach (#FDE8E4) -> Mid: Soft coral (#F08A7E) -> High: Deep rose (#D94E4E)
      const colorBase = new THREE.Color('#FDE8E4');
      const colorMid = new THREE.Color('#F08A7E');
      const colorHigh = new THREE.Color('#D94E4E');

      // Displace vertices based on hotspots
      for (let i = 0; i < count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);

        // Normalize (vx, vy) to 0..760 and 0..480 coordinates
        const normX = ((vx / (geomWidth / 2)) + 1) * 0.5 * 760;
        const normY = (1 - ((vy / (geomHeight / 2)) + 1) * 0.5) * 480;

        let totalHeat = 0;
        hotspots.forEach(h => {
          const dx = h.cx - normX;
          const dy = h.cy - normY;
          const distSq = dx * dx + dy * dy;
          const sigma = 65; // spread
          const weight = (h.baseClicks + (h.rageClicks || 0) * 1.5) / 50;
          totalHeat += weight * Math.exp(-distSq / (2 * sigma * sigma));
        });

        const elevation = Math.min(2.8, totalHeat * 1.6);
        pos.setZ(i, elevation);

        // Interpolate color by elevation
        const t = Math.min(1, elevation / 2.2);
        const vertexColor = t > 0.5
          ? colorMid.clone().lerp(colorHigh, (t - 0.5) * 2)
          : colorBase.clone().lerp(colorMid, t * 2);

        colors[i * 3] = vertexColor.r;
        colors[i * 3 + 1] = vertexColor.g;
        colors[i * 3 + 2] = vertexColor.b;
      }

      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();

      // 5. Translucent Glass Surface Material
      const material = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        metalness: 0.1,
        roughness: 0.18,
        transmission: 0.65, // translucent glass
        thickness: 0.8,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        wireframe: false,
      });

      plane = new THREE.Mesh(geometry, material);
      plane.rotation.x = -Math.PI / 4.5;
      scene.add(plane);

      // Wireframe overlay for modern topography contour look
      const wireframeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.12,
      });
      const wireframeMesh = new THREE.Mesh(geometry, wireframeMat);
      plane.add(wireframeMesh);

      // 6. Base border ring
      const baseBox = new THREE.BoxGeometry(geomWidth + 0.2, geomHeight + 0.2, 0.15);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x17171B,
        roughness: 0.4,
        metalness: 0.8,
        transparent: true,
        opacity: 0.4,
      });
      const baseMesh = new THREE.Mesh(baseBox, baseMat);
      baseMesh.position.z = -0.1;
      plane.add(baseMesh);

      setLoading(false);

      // 7. Interactive mouse drag rotation (Orbit style)
      const onMouseDown = (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
      };

      const onMouseMove = (e) => {
        if (!isDragging || !plane) return;
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        plane.rotation.z += deltaX * 0.008;
        plane.rotation.x += deltaY * 0.008;

        previousMousePosition = { x: e.clientX, y: e.clientY };
      };

      const onMouseUp = () => { isDragging = false; };

      const onWheel = (e) => {
        e.preventDefault();
        camera.position.z = Math.max(6, Math.min(22, camera.position.z + e.deltaY * 0.015));
      };

      container.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      container.addEventListener('wheel', onWheel, { passive: false });

      // Resize observer
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w && h) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
          }
        }
      });
      resizeObserver.observe(container);

      // 8. Animation loop
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        if (!isDragging && plane) {
          plane.rotation.z += 0.002; // slow cinematic auto-rotation
        }
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        cancelAnimationFrame(animationFrameId);
        container.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        container.removeEventListener('wheel', onWheel);
        resizeObserver.disconnect();
        if (renderer?.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    } catch (err) {
      console.warn('WebGL initialization failed, falling back to 2D view:', err);
      setWebglError(true);
      if (onFallback) onFallback();
    }
  }, [hotspots, onFallback]);

  if (webglError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-[#6B6B70] dark:text-[#98989F]">
        <Layers size={36} className="text-[#F08A7E] mb-3" />
        <p className="font-heading font-semibold text-base text-[#1C1C1E] dark:text-[#F2F2F7]">3D WebGL Unavailable</p>
        <p className="text-xs max-w-sm mt-1">Your browser hardware acceleration is disabled. Reverting seamlessly to the high-fidelity 2D thermal canvas.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[480px] rounded-2xl overflow-hidden bg-gradient-to-b from-[#F7F6F3]/50 to-[#ECEAE5]/30 dark:from-[#17171B] dark:to-[#0F0F12] select-none cursor-grab active:cursor-grabbing">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-[#17171B]/60 backdrop-blur-sm z-20">
          <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Floating 3D Controls & Guidance Pill */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/80 dark:bg-[#1E1E24]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#ECEAE5] dark:border-[#26262F] text-[11px] font-semibold text-[#6B6B70] dark:text-[#98989F] shadow-md">
        <span className="w-2 h-2 rounded-full bg-[#6C63FF] animate-ping" />
        <span>3D Glass Topography</span>
        <span className="opacity-40">•</span>
        <span className="font-normal text-[10px]">Drag to orbit, scroll to zoom</span>
      </div>

      {/* Topography Elevation Legend */}
      <div className="absolute bottom-4 right-4 z-10 bg-white/85 dark:bg-[#1E1E24]/85 backdrop-blur-md px-3 py-2 rounded-xl border border-[#ECEAE5] dark:border-[#26262F] shadow-lg text-[10px] flex flex-col gap-1">
        <span className="font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">Click Density Peak:</span>
        <div className="flex items-center gap-2">
          <span>0 (Flat)</span>
          <div className="w-20 h-2 rounded-full bg-gradient-to-r from-[#FDE8E4] via-[#F08A7E] to-[#D94E4E]" />
          <span className="font-bold text-[#D94E4E]">High (Peak)</span>
        </div>
      </div>
    </div>
  );
};

export default Heatmap3DView;
