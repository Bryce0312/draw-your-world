import sharp from "sharp";
import { WallError } from "./store";

export async function normalizedArtwork(input: Uint8Array | string) {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    const match = input.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/);
    if (!match) throw new WallError("Use a PNG, JPEG or WebP drawing.");
    bytes = Buffer.from(match[2], "base64");
  } else {
    bytes = input;
  }
  try {
    const image = sharp(bytes, { limitInputPixels: 16_000_000 });
    const metadata = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format || "")) throw new Error("Unsupported image");
    const normalized = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    if (normalized.byteLength > 4_000_000) throw new WallError("This picture is too detailed for the preview. Try a smaller picture.", 413);
    return `data:image/png;base64,${normalized.toString("base64")}`;
  } catch (error) {
    if (error instanceof WallError) throw error;
    throw new WallError("The picture could not be opened. Your drawing is still on the canvas.");
  }
}
