import { afterEach, describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import sharp from "sharp";
import { analyzeDrawing, drawingAnalysisErrorMessage } from "./tools";
import { runHtpAgent } from "./agent";
import { createSession } from "./types";

const features = {
  source: "vision_observation",
  objects: { house: "present", tree: "absent", person: "uncertain" },
  observations: ["房子"],
  layout: { housePosition: "left", treePosition: "uncertain", personPosition: "uncertain", relativeSizes: [], objectRelations: [] },
  visibleDetails: [], uncertainties: [],
};

async function drawing() {
  const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: "#fffdf8" } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("drawing analysis", () => {
  it("rejects invalid image bytes before sending them to the provider", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(analyzeDrawing("data:image/png;base64,bm90LWFuLWltYWdl")).rejects.toThrow("无法解码");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports missing configuration instead of returning a pretend observation", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    await expect(analyzeDrawing(await drawing())).rejects.toThrow("尚未配置");
  });

  it("sends a decodable JPEG and retries the saved drawing without an orchestration call", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit | undefined) => {
      const body = JSON.parse(init?.body as string);
      expect(body.tools).toBeUndefined();
      const dataUrl = body.messages[1].content[1].image_url.url;
      expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect((await sharp(Buffer.from(dataUrl.split(",")[1], "base64")).metadata()).format).toBe("jpeg");
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(features) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const beforeImage = await drawing();
    const session = { ...createSession(), phase: "vision_check" as const, beforeImage, toolError: "旧错误" };
    const result = await runHtpAgent(session, { type: "vision_retry" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.session.beforeImage).toBe(beforeImage);
    expect(result.session.toolError).toBeUndefined();
    expect(result.session.drawingFeatures?.objects.house).toBe("present");
    expect(session.toolError).toBe("旧错误");
  });

  it("preserves the image and reports malformed provider output as failure", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "{}" } }] }), { status: 200, headers: { "Content-Type": "application/json" } })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const imageBase64 = await drawing();
    const result = await runHtpAgent({ ...createSession(), phase: "drawing" }, { type: "drawing_submitted", imageBase64 });
    expect(result.session.phase).toBe("vision_check");
    expect(result.session.beforeImage).toBe(imageBase64);
    expect(result.session.drawingFeatures).toBeUndefined();
    expect(result.session.toolError).toContain("格式异常");
    expect(result.turn.assistantText).toContain("未能完成");
  });

  it("does not expose raw provider errors or secrets", () => {
    const error = new OpenAI.APIError(401, { message: "secret-provider-content" }, "secret-provider-content", new Headers());
    expect(drawingAnalysisErrorMessage(error)).toContain("认证失败");
    expect(drawingAnalysisErrorMessage(error)).not.toContain("secret-provider-content");
  });
});
