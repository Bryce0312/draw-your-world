import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { analyzeArtwork, generateImage, pollVideo, submitVideo } from "./providers";
import type { StudioProposal } from "./types";

const proposal: StudioProposal = { id: "proposal", kind: "image", artworkVersion: 1, sourceAssetId: "source", summary: "只添叶子", changes: ["树上加一片叶子"], preserve: ["夜色与原笔触"], status: "approved", createdAt: new Date().toISOString() };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("live provider contracts (mock HTTP only)", () => {
  it("uses current DeepSeek vision and non-thinking JSON observation", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      expect(body.thinking).toEqual({ type: "disabled" });
      expect(body.messages[1].content[1].image_url.url).toMatch(/^data:image\/png;base64,/);
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ items: ["一棵树"], uncertainties: [] }) } }] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await analyzeArtwork(Buffer.from("image-bytes"), "image/png")).toEqual({ items: ["一棵树"], uncertainties: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("edits from the source image and downloads validated image bytes", async () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "test-key");
    vi.stubEnv("DASHSCOPE_IMAGE_ENDPOINT", "https://example.com/image-api");
    const png = await sharp({ create: { width: 400, height: 300, channels: 4, background: "#fff" } }).png().toBuffer();
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("image-api")) {
        const body = JSON.parse(init!.body as string);
        expect(body.model).toBe("qwen-image-3.0");
        expect(body.parameters.prompt_extend).toBe(false);
        expect(body.input.messages[0].content[1].text).toContain("夜色与原笔触");
        return new Response(JSON.stringify({ output: { choices: [{ message: { content: [{ image: "https://example.com/result.png" }] } }] } }));
      }
      return new Response(png, { headers: { "Content-Type": "image/png" } });
    }));
    const result = await generateImage(png, "image/png", proposal, "live");
    expect(result.mimeType).toBe("image/png");
    expect((await sharp(result.bytes).metadata()).width).toBe(400);
  });
  it("submits Wan3 asynchronously and polls the same task", async () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "test-key");
    vi.stubEnv("DASHSCOPE_VIDEO_ENDPOINT", "https://example.com/api/v1/services/aigc/video-generation/video-synthesis");
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        expect(body.model).toBe("wan3.0-video");
        expect(body.input.media[0].type).toBe("first_frame");
        expect(body.parameters).toMatchObject({ duration: 5, resolution: "720P", audio: false });
        expect((init.headers as Record<string, string>)["X-DashScope-Async"]).toBe("enable");
        return new Response(JSON.stringify({ output: { task_id: "task-123", task_status: "PENDING" } }));
      }
      expect(String(url)).toBe("https://example.com/api/v1/tasks/task-123");
      return new Response(JSON.stringify({ output: { task_status: "SUCCEEDED", video_url: "https://example.com/video.mp4" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await submitVideo(Buffer.from("image"), "image/png", { ...proposal, kind: "video" })).toEqual({ taskId: "task-123" });
    expect(await pollVideo("task-123")).toEqual({ status: "succeeded", url: "https://example.com/video.mp4" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
