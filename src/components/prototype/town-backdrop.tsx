"use client";

import { useEffect, useRef, useState } from "react";
import type { TownFocus, TownSceneHandle } from "./town-scene";

export type TownPlace = TownFocus;

interface TownBackdropProps {
  variant: "entrance" | "map";
  enabled: boolean;
  focus?: TownPlace;
  onUnavailable: () => void;
}

export function TownBackdrop({ variant, enabled, focus = null, onUnavailable }: TownBackdropProps) {
  const host = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<TownSceneHandle | null>(null);
  const enabledRef = useRef(enabled);
  const focusRef = useRef(focus);
  const updateActivity = useRef<() => void>(() => {});
  const unavailable = useRef(onUnavailable);
  const [state, setState] = useState("static");

  useEffect(() => { unavailable.current = onUnavailable; }, [onUnavailable]);
  useEffect(() => {
    enabledRef.current = enabled;
    updateActivity.current();
  }, [enabled]);
  useEffect(() => {
    focusRef.current = focus;
    scene.current?.setFocus(focus);
  }, [focus]);

  useEffect(() => {
    const element = host.current;
    const imagePlane = plane.current;
    const surface = canvas.current;
    if (!element || !imagePlane || !surface) return;
    let disposed = false;
    let loading = false;
    let failed = false;
    let inView = false;
    let size = { width: 1, height: 1, pixelRatio: 1 };

    function resize() {
      const bounds = element!.getBoundingClientRect();
      const mobile = window.matchMedia("(max-width: 780px)").matches;
      const fit = variant === "entrance" && mobile ? Math.max : Math.min;
      const scale = fit(bounds.width / 1536, bounds.height / 1024);
      const width = Math.max(1, 1536 * scale);
      const height = Math.max(1, 1024 * scale);
      Object.assign(imagePlane!.style, {
        width: `${width}px`, height: `${height}px`,
        left: `${(bounds.width - width) / 2}px`, top: `${(bounds.height - height) / 2}px`,
      });
      const pixelBudget = mobile ? 700_000 : 1_800_000;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.25, Math.sqrt(pixelBudget / (width * height)));
      size = { width, height, pixelRatio };
      scene.current?.resize(width, height, pixelRatio);
    }

    function fail() {
      if (disposed || failed) return;
      failed = true;
      setState("fallback");
      surface!.dataset.paused = "true";
      scene.current?.dispose();
      scene.current = null;
      unavailable.current();
    }

    async function start() {
      if (loading || disposed || failed || scene.current) return;
      loading = true;
      setState("loading");
      try {
        const { createTownScene } = await import("./town-scene");
        if (disposed || failed) return;
        const created = await createTownScene(surface!, {
          onReady() { if (!disposed && !failed) setState("ready"); },
          onFailure: fail,
          onMetrics(metrics) {
            if (disposed) return;
            Object.assign(surface!.dataset, {
              frames: String(metrics.frames), fps: String(metrics.fps),
              drawCalls: String(metrics.drawCalls), triangles: String(metrics.triangles),
              pixelRatio: String(metrics.pixelRatio), quality: metrics.quality,
            });
          },
        });
        if (disposed || failed) { created.dispose(); return; }
        scene.current = created;
        created.resize(size.width, size.height, size.pixelRatio);
        created.setFocus(focusRef.current);
        synchronize();
      } catch { fail(); }
      finally { loading = false; }
    }

    function synchronize() {
      const running = enabledRef.current && !document.hidden && inView && !failed;
      surface!.dataset.paused = String(!running);
      if (scene.current) scene.current.setPaused(!running);
      else if (running) void start();
    }

    updateActivity.current = synchronize;
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const visibility = new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? false;
      synchronize();
    });
    visibility.observe(element);
    document.addEventListener("visibilitychange", synchronize);
    window.addEventListener("resize", resize);
    resize();
    return () => {
      disposed = true;
      observer.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", synchronize);
      window.removeEventListener("resize", resize);
      updateActivity.current = () => {};
      scene.current?.dispose();
      scene.current = null;
    };
  }, [variant]);

  return <div className={`lp-town-backdrop lp-town-backdrop-${variant}`} data-state={state} ref={host}>
    <div className="lp-town-image-plane" ref={plane}>
      <img src="/art/elsewhere-town-gentle.png" alt="Hand-drawn town of Elsewhere with a post office, drawing desk and tree hollow" draggable={false}/>
      <canvas ref={canvas} data-town-scene data-frames="0" aria-hidden="true"/>
    </div>
  </div>;
}
