import { createServerFn } from "@tanstack/react-start";

export const listLiveFiles = createServerFn({ method: "POST" })
  .validator((input: { dir?: string }) => ({ dir: String(input?.dir || "") }))
  .handler(async ({ data }) => {
    const store = await import("./live-files.server");
    return store.liveList(data.dir);
  });

export const readLiveFile = createServerFn({ method: "POST" })
  .validator((input: { path?: string }) => ({ path: String(input?.path || "") }))
  .handler(async ({ data }) => {
    const store = await import("./live-files.server");
    return store.liveRead(data.path);
  });

export const writeLiveFile = createServerFn({ method: "POST" })
  .validator((input: { path?: string; text?: string }) => ({ path: String(input?.path || ""), text: String(input?.text ?? "") }))
  .handler(async ({ data }) => {
    const store = await import("./live-files.server");
    return store.liveWrite(data.path, data.text);
  });

export const renameLiveFile = createServerFn({ method: "POST" })
  .validator((input: { path?: string; name?: string }) => ({ path: String(input?.path || ""), name: String(input?.name || "") }))
  .handler(async ({ data }) => {
    const store = await import("./live-files.server");
    return store.liveRename(data.path, data.name);
  });

export const makeLiveDir = createServerFn({ method: "POST" })
  .validator((input: { dir?: string; name?: string }) => ({ dir: String(input?.dir || ""), name: String(input?.name || "") }))
  .handler(async ({ data }) => {
    const store = await import("./live-files.server");
    return store.liveMakeDir(data.dir, data.name);
  });

export const moveLiveFile = createServerFn({ method: "POST" })
  .validator((input: { path?: string; dir?: string }) => ({ path: String(input?.path || ""), dir: String(input?.dir || "") }))
  .handler(async ({ data }) => {
    const store = await import("./live-files.server");
    return store.liveMove(data.path, data.dir);
  });

export const copyLiveFile = createServerFn({ method: "POST" })
  .validator((input: { path?: string; dir?: string }) => ({ path: String(input?.path || ""), dir: String(input?.dir || "") }))
  .handler(async ({ data }) => {
    const store = await import("./live-files.server");
    return store.liveCopy(data.path, data.dir);
  });

export const removeLiveFile = createServerFn({ method: "POST" })
  .validator((input: { path?: string; password?: string }) => ({ path: String(input?.path || ""), password: String(input?.password || "") }))
  .handler(async ({ data }) => {
    const store = await import("./live-files.server");
    return store.liveRemove(data.path, data.password);
  });
