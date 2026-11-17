import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";
import { config, proxy } from "../../../proxy";

afterEach(() => vi.unstubAllEnvs());

describe("Netlify archived studio gate", () => {
  it("matches every archived endpoint and leaves the wall routes outside the gate", () => {
    for (const url of ["/studio", "/studio/anything", "/api/agent", "/api/session", "/api/artworks", "/api/assets/image-id", "/api/jobs", "/api/proposals"]) {
      expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
    }
    for (const url of ["/", "/professional", "/api/wall", "/api/wall/artwork", "/api/wall/assets/image-id", "/_next/static/app.js"]) {
      expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
    }
  });

  it("returns a controlled error for legacy cloud APIs before their handlers run", async () => {
    vi.stubEnv("NETLIFY", "true");
    const response = proxy(new NextRequest("https://preview.example/api/jobs", { method: "POST" }));
    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toHaveProperty("error");
  });

  it("redirects the archived page to the current home in cloud storage mode", () => {
    vi.stubEnv("NETLIFY", "");
    vi.stubEnv("WALL_STORAGE", "netlify");
    const response = proxy(new NextRequest("https://preview.example/studio?old=1"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://preview.example/");
  });

  it("preserves the local archived routes", () => {
    vi.stubEnv("DYW_NETLIFY_BUILD", "");
    vi.stubEnv("NETLIFY", "");
    vi.stubEnv("WALL_STORAGE", "local");
    const response = proxy(new NextRequest("http://localhost:3000/api/agent", { method: "POST" }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps the cloud gate active when the adapter only has the compiled build flag", () => {
    vi.stubEnv("DYW_NETLIFY_BUILD", "1");
    vi.stubEnv("NETLIFY", "");
    vi.stubEnv("WALL_STORAGE", "");
    expect(proxy(new NextRequest("https://preview.example/api/agent")).status).toBe(410);
  });
});
