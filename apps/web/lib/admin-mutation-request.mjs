function firstForwardedValue(value) {
  return value?.split(",", 1)[0]?.trim() || null;
}

function requestOrigin(request) {
  const url = new URL(request.url);
  const protocol =
    firstForwardedValue(request.headers.get("X-Forwarded-Proto")) ??
    url.protocol.slice(0, -1);
  const host =
    firstForwardedValue(request.headers.get("X-Forwarded-Host")) ??
    request.headers.get("Host")?.trim() ??
    url.host;

  if (protocol !== "http" && protocol !== "https") return null;

  try {
    const publicUrl = new URL(`${protocol}://${host}`);
    if (
      publicUrl.username ||
      publicUrl.password ||
      publicUrl.pathname !== "/" ||
      publicUrl.search ||
      publicUrl.hash
    ) {
      return null;
    }
    return publicUrl.origin;
  } catch {
    return null;
  }
}

export function validateAdminMutationRequest(request) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== requestOrigin(request)) {
    return { body: "Invalid origin", status: 403 };
  }

  if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
    return { body: "Content-Type must be application/json", status: 415 };
  }

  return null;
}
