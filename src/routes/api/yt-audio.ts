import { createFileRoute } from "@tanstack/react-router";
import { ytAudioResponse } from "@/lib/yt-audio-server";

export const Route = createFileRoute("/api/yt-audio")({
  server: {
    handlers: {
      GET: async ({ request }) => ytAudioResponse(request),
    },
  },
});
