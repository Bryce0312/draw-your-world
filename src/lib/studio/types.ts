export type StudioMode = "live" | "demo";
export type AssetKind = "original" | "image" | "video";
export interface StudioAsset {
  id: string; kind: AssetKind; artworkVersion: number; parentId?: string;
  mimeType: string; url: string; createdAt: string;
}
export interface StudioMessage {
  id: string; role: "user" | "assistant"; content: string; createdAt: string;
}
export interface StudioProposal {
  id: string; kind: "image" | "video" | "understanding"; artworkVersion: number;
  sourceAssetId: string; summary: string; changes: string[]; preserve: string[];
  status: "draft" | "approved" | "rejected" | "stale" | "completed"; createdAt: string;
}
export interface GenerationJob {
  id: string; proposalId: string; kind: "image" | "video"; artworkVersion: number;
  sourceAssetId: string; status: "queued" | "submitted" | "running" | "succeeded" | "failed" | "cancelled" | "unknown";
  providerTaskId?: string; resultAssetId?: string; error?: string;
  createdAt: string; updatedAt: string; mode: StudioMode; accepted?: boolean;
}
export interface StudioSession {
  id: string; version: number; artworkVersion: number; originalAssetId?: string; activeAssetId?: string;
  assets: StudioAsset[]; messages: StudioMessage[]; proposals: StudioProposal[]; jobs: GenerationJob[];
  observation?: { artworkVersion: number; status: "ready" | "failed"; items: string[]; uncertainties: string[] };
  userStatements: string[]; rejectedInterpretations: string[];
  feedback?: { moodBefore?: number; moodAfter?: number; text?: string };
  status: "active" | "complete"; mode: StudioMode; createdAt: string;
}
export type StudioEvent =
  | { type: "message"; text: string }
  | { type: "request_change"; kind: "image" | "video" }
  | { type: "reject_proposal"; proposalId: string }
  | { type: "accept_understanding"; proposalId: string }
  | { type: "accept_result"; jobId: string }
  | { type: "discard_result"; jobId: string }
  | { type: "cancel_job"; jobId: string }
  | { type: "complete"; text?: string; mood?: number }
  | { type: "record_mood"; mood: number };
export type StudioStreamEvent =
  | { type: "text.delta"; text: string }
  | { type: "state"; session: StudioSession }
  | { type: "error"; message: string };
export interface StudioCapabilities {
  mode: StudioMode; chat: boolean; vision: boolean; image: boolean; video: boolean; worker: boolean;
}
export interface StudioSnapshot { session: StudioSession; capabilities: StudioCapabilities }
