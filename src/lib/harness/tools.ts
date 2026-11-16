import OpenAI from "openai";
import sharp from "sharp";
import { drawingFeaturesSchema, transformResponseSchema } from "./schemas";
import type { DrawingFeatures, HtpSession, TransformationRequest } from "./types";

class DrawingAnalysisError extends Error {}

async function prepareDrawing(value: string): Promise<string> {
  const match = typeof value === "string" && /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) throw new DrawingAnalysisError("画布图片格式无效，请返回画布后重新提交。");
  if (match[2].length > 14_000_000) throw new DrawingAnalysisError("图片过大，请缩小后重试。");
  try {
    const input = Buffer.from(match[2], "base64");
    const image = sharp(input, { limitInputPixels: 16_000_000 });
    const metadata = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format ?? "")) throw new Error("Invalid image format");
    const jpeg = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#fffdf8" }).jpeg({ quality: 90 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    throw new DrawingAnalysisError("画布图片无法解码，请返回画布后重新提交。");
  }
}

export function drawingAnalysisErrorMessage(error: unknown): string {
  if (error instanceof DrawingAnalysisError) return error.message;
  if (error instanceof OpenAI.APIConnectionTimeoutError) return "识图等待超时，请稍后重试。原画已保留。";
  if (error instanceof OpenAI.APIConnectionError) return "无法连接识图服务，请检查网络后重试。";
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) return "识图服务认证失败，请检查服务端密钥配置。";
    if (error.status === 402) return "识图服务余额不足，请检查服务账户。";
    if (error.status === 429) return "识图服务繁忙，请稍后重试。";
    if (error.status === 400) return "识图服务未接受这张图片，请重试或返回画布重新提交。";
  }
  return "识图暂时失败，请重试。原画已保留，也可以直接继续体验。";
}

const objectLabels = { house: "房子", tree: "树", person: "人物" } as const;
const positions = { left: "左侧", center: "中间", right: "右侧" } as const;

function normalizeDrawingFeatures(features: DrawingFeatures): DrawingFeatures {
  const observations: string[] = [];
  const uncertainties: string[] = [];
  (Object.keys(objectLabels) as Array<keyof typeof objectLabels>).forEach((key) => {
    const state = features.objects[key];
    if (state === "present") observations.push(`画面中可见${objectLabels[key]}。`);
    if (state === "uncertain") uncertainties.push(`我暂时无法确认画面中是否有${objectLabels[key]}。`);
    const position = features.layout[`${key}Position`];
    if (state === "present" && position !== "uncertain") observations.push(`${objectLabels[key]}位于画面${positions[position]}。`);
  });
  const plainDetails = features.visibleDetails.filter((detail) => detail.length <= 60 && !/[`<>{}]/.test(detail));
  const plainRelations = features.layout.objectRelations.filter((relation) => relation.length <= 60 && !/[`<>{}]/.test(relation));
  observations.push(...plainRelations.slice(0, 2), ...plainDetails.slice(0, 3));
  if (!observations.length) observations.push("我还无法稳定确认画面里的具体元素。");
  return {
    ...features,
    observations: [...new Set(observations)].slice(0, 6),
    visibleDetails: plainDetails.slice(0, 6),
    layout: { ...features.layout, objectRelations: plainRelations.slice(0, 3) },
    uncertainties: [...new Set([...uncertainties, ...features.uncertainties.filter((item) => item.length <= 60 && !/[`<>{}]/.test(item))])].slice(0, 4),
  };
}

export async function analyzeDrawing(imageBase64: string): Promise<DrawingFeatures> {
  const imageUrl = await prepareDrawing(imageBase64);
  if (!process.env.DEEPSEEK_API_KEY) throw new DrawingAnalysisError("识图服务尚未配置，请设置服务端 DEEPSEEK_API_KEY。");

  const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com", timeout: 45_000, maxRetries: 0 });
  const response = await client.chat.completions.create({
    model: "deepseek-flash",
    // DeepSeek supports this value; this older SDK does not include it in its types.
    reasoning_effort: "none" as never,
    max_tokens: 1800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "你是严格的视觉观察器。只描述图片中可直接看到的元素。绝不输出情绪、人格、疾病、诊断、动机或象征意义。若无法确认，填 uncertain。仅返回 JSON。" },
      {
        role: "user",
        content: [
          { type: "text", text: `分析这幅手绘人树房图片，输出此 JSON 结构：{"source":"vision_observation","objects":{"house":"present|absent|uncertain","tree":"present|absent|uncertain","person":"present|absent|uncertain"},"observations":["中性可见事实"],"layout":{"housePosition":"left|center|right|uncertain","treePosition":"left|center|right|uncertain","personPosition":"left|center|right|uncertain","relativeSizes":["可见大小比较"],"objectRelations":["可见空间关系"]},"visibleDetails":["门窗、树叶、云朵等"],"uncertainties":["不确定处"]}` },
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
        ],
      },
    ],
  });
  const raw = response.choices[0]?.message.content;
  if (!raw || response.choices[0]?.finish_reason === "length") throw new DrawingAnalysisError("识图结果不完整，请重试。");
  try {
    return normalizeDrawingFeatures(drawingFeaturesSchema.parse(JSON.parse(raw)));
  } catch {
    throw new DrawingAnalysisError("识图结果格式异常，请重试。");
  }
}

export function buildTransformPrompt(request: TransformationRequest) {
  return [
    "保持原始儿童手绘线稿、笔触、配色倾向以及人、树、房的相对位置。",
    "不要改成写实插画，不要添加文字、额外人物、未要求的象征物或情节。",
    "只执行用户明确要求的视觉改动：",
    ...request.requestedChanges.map((change) => `- ${change}`),
  ].join("\n");
}

function findImageUrl(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) return value.map(findImageUrl).find(Boolean);
  const record = value as Record<string, unknown>;
  for (const key of ["url", "image", "image_url"]) if (typeof record[key] === "string" && /^https?:\/\//.test(record[key] as string)) return record[key] as string;
  return Object.values(record).map(findImageUrl).find(Boolean);
}

export async function transformWorld(session: HtpSession): Promise<{ imageUrl: string; appliedPrompt: string }> {
  if (!session.beforeImage || !session.transformationRequest) throw new Error("转化需要原始绘画和用户确认的视觉改变。");
  if (!process.env.DASHSCOPE_API_KEY || !process.env.DASHSCOPE_IMAGE_ENDPOINT) throw new Error("未配置图像编辑 API，已切换为本地演示效果。");

  const appliedPrompt = buildTransformPrompt(session.transformationRequest);
  const response = await fetch(process.env.DASHSCOPE_IMAGE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}` },
    body: JSON.stringify({
      model: "qwen-image-3.0",
      input: { messages: [{ role: "user", content: [{ image: session.beforeImage }, { text: appliedPrompt }] }] },
      parameters: { n: 1, watermark: false },
    }),
  });
  if (!response.ok) throw new Error("图像编辑服务暂时不可用，已保留你的原始作品。");
  const payload = await response.json();
  const imageUrl = findImageUrl(payload);
  return transformResponseSchema.parse({ imageUrl, appliedPrompt });
}
