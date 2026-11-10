import {
  Suspense,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getConsoleFunction, setConsoleFunction } from "three";
import { createRoot, type ReconcilerRoot, type RenderProps } from "@react-three/fiber";
import { registerSceneElements } from "./catalogue";
import { FailBoundary } from "./FailBoundary";

registerSceneElements();

/**
 * R3F 9 still builds its store clock with THREE.Clock, which three r183
 * deprecated, so every mount logs a warning we can't fix from here. three's
 * own console hook lets us drop exactly that notice — everything else is
 * forwarded untouched — until R3F moves to THREE.Timer.
 */
const UPSTREAM_NOTICES = [/^THREE\.Clock: This module has been deprecated/];
const forward = getConsoleFunction();
setConsoleFunction((type, message, ...params) => {
  if (type === "warn" && UPSTREAM_NOTICES.some((re) => re.test(message))) return;
  if (forward) forward(type, message, ...params);
  else console[type](message, ...params);
});

type SceneCanvasProps = Omit<RenderProps<HTMLCanvasElement>, "size" | "events"> & {
  children: ReactNode;
  /** The scene threw, or the renderer could not be created. */
  onError: () => void;
  /** The browser dropped the WebGL context (not fired for our own teardown). */
  onContextLost: () => void;
};

/**
 * A minimal stand-in for R3F's <Canvas> built on `createRoot`, so the bundle
 * only carries the three classes registered in ./catalogue (see there). No
 * pointer events (the scene is an aria-hidden, pointer-events:none backdrop)
 * and no context bridge (nothing in the scene reads DOM-side React context).
 */
export function SceneCanvas({
  children,
  onError,
  onContextLost,
  ...config
}: SceneCanvasProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const root = useRef<ReconcilerRoot<HTMLCanvasElement> | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Our own teardown force-loses the context; only report losses before it.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("webglcontextlost", onContextLost);
    return () => canvas.removeEventListener("webglcontextlost", onContextLost);
  }, [onContextLost]);

  // Insertion effects aren't replayed by StrictMode: release the root only on
  // real removal (mirrors R3F's own <Canvas>).
  useInsertionEffect(
    () => () => {
      root.current?.unmount();
      root.current = null;
    },
    [],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    const current = (root.current ??= createRoot(canvas));
    current.configure({ ...config, size: { ...size, top: 0, left: 0 } }).then(
      () => {
        if (root.current !== current) return;
        // Errors inside the R3F root don't reach DOM-side boundaries; relay them.
        current.render(
          <FailBoundary onError={onError}>
            <Suspense fallback={null}>{children}</Suspense>
          </FailBoundary>,
        );
      },
      () => onError(),
    );
  });

  return (
    <div ref={wrapper} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}
