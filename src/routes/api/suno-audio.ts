import { createFileRoute } from "@tanstack/react-router";
import { sunoAudioResponse } from "@/lib/suno-audio-server";

export const Route = createFileRoute("/api/suno-audio")({
  server: {
    handlers: {
      GET: async ({ request }) => sunoAudioResponse(request),
    },
  },
});
