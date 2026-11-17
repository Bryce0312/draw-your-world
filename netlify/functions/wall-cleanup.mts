import { pruneWallDrafts } from "../../src/lib/wall/store";

export default async function cleanup() {
  const result = await pruneWallDrafts();
  return Response.json(result);
}

export const config = { schedule: "@daily" };
