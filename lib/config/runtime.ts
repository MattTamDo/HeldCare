export type RuntimeConfig = {
  smartSpectra: {
    configured: boolean;
  };
  livekit: {
    configured: boolean;
    url: string | null;
  };
  phoneCamera: {
    publicBaseUrl: string | null;
    transport: "auto" | "local" | "livekit";
  };
};

export function runtimeConfig(): RuntimeConfig {
  const publicBaseUrl =
    process.env.CLOUDFLARE_TUNNEL_URL ??
    process.env.NEXT_PUBLIC_PHONE_BASE_URL ??
    null;

  const requestedPhoneTransport = process.env.PHONE_CAMERA_TRANSPORT;
  const phoneTransport =
    requestedPhoneTransport === "local" || requestedPhoneTransport === "livekit"
      ? requestedPhoneTransport
      : "auto";

  return {
    smartSpectra: {
      configured: Boolean(process.env.SMARTSPECTRA_API_KEY),
    },
    livekit: {
      configured: Boolean(
        process.env.LIVEKIT_URL &&
          process.env.LIVEKIT_API_KEY &&
          process.env.LIVEKIT_API_SECRET,
      ),
      url: process.env.LIVEKIT_URL ?? null,
    },
    phoneCamera: {
      publicBaseUrl,
      transport: phoneTransport,
    },
  };
}
