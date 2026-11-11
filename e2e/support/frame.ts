import type { Page } from "@playwright/test";

/**
 * Black-frame check (docs/PLAN-STAR-SYSTEM.md §7). The scene never draws
 * pure black — even empty space is the nebula's #07061a or brighter — so a
 * large share of near-black pixels means the frame wasn't drawn (the real-GPU
 * post-processing failure that software-GL QA missed). Decodes the
 * screenshot inside the page with canvas 2D, so it needs no dependencies.
 */

/** A pixel counts as "black" when every channel is at or below this (0–255). */
export const BLACK_CHANNEL_MAX = 4;
/** More than this share of black pixels fails the frame. */
export const MAX_BLACK_FRACTION = 0.05;

const HIDE_DOCUMENT = "#main, footer { visibility: hidden !important; }";

/** Fraction of near-black pixels in the current viewport, document hidden. */
export async function blackFraction(page: Page): Promise<number> {
  const style = await page.addStyleTag({ content: HIDE_DOCUMENT });
  try {
    const png = await page.screenshot({ type: "png", scale: "css" });
    // No named inner functions: keeps tsx/esbuild from injecting __name,
    // which doesn't exist in the page (scripts/ reuse this helper).
    return await page.evaluate(
      async ([b64, limit]) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const w = Math.min(320, img.width);
        const h = Math.max(1, Math.round((img.height * w) / img.width));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h).data;
        let black = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i]! <= limit && d[i + 1]! <= limit && d[i + 2]! <= limit) black++;
        }
        return black / (w * h);
      },
      [png.toString("base64"), BLACK_CHANNEL_MAX] as const,
    );
  } finally {
    await style.evaluate((el) => (el as Element).remove());
  }
}
