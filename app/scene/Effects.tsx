import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode, type EffectComposer as Composer } from "postprocessing";

/**
 * Post stack (docs/PLAN-STAR-SYSTEM.md §4): MSAA on the composer's input
 * buffer (the canvas itself is created with antialias: false), HDR bloom
 * that only catches emissive surfaces (luminance > 1: the sun, lava, bright
 * motes), then ACES tone mapping and a soft vignette. No SSAO, no FXAA.
 *
 * The composer renders the scene into a half-float target and switches the
 * renderer's own tone mapping off, so ACES is applied here, after bloom.
 */
export interface EffectsProps {
  onFirstFrame?: () => void;
  /** MSAA samples on the composer input (quality tier). */
  multisampling?: number;
  /** HDR bloom on emissive surfaces (quality tier). */
  bloom?: boolean;
}

export function Effects({ onFirstFrame, multisampling = 4, bloom = true }: EffectsProps) {
  const composer = useRef<Composer>(null);
  const reported = useRef(false);

  // Priority 2 runs after the composer's own render (priority 1). The ref is
  // only set once the composer exists, so this fires after a real frame.
  useFrame(() => {
    if (reported.current || !composer.current || !onFirstFrame) return;
    reported.current = true;
    requestAnimationFrame(onFirstFrame);
  }, 2);

  return (
    <EffectComposer ref={composer} multisampling={multisampling}>
      {/* Unmounted, not zeroed: Bloom's luminance + blur passes run at any
          intensity (gate 2, finding 3). */}
      {bloom ? (
        <Bloom
          mipmapBlur
          luminanceThreshold={1}
          luminanceSmoothing={0.25}
          intensity={1.3}
          radius={0.8}
        />
      ) : (
        <></>
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={0.55} />
    </EffectComposer>
  );
}
