export async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const userId = typeof localStorage !== "undefined" ? localStorage.getItem("watchlog.userId") : null;
    const deviceId = typeof localStorage !== "undefined" ? localStorage.getItem("watchlog.deviceId") : null;

    const res = await fetch(`/api${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(userId ? { "X-User-Id": userId } : {}),
            ...(deviceId ? { "X-Device-Id": deviceId } : {}),
            ...(init?.headers ?? {}),
        },
        cache: "no-store",
    });

    if (!res.ok) {
        let msg = res.statusText;
        try {
            const body = await res.json();
            msg = body?.message ?? JSON.stringify(body);
        } catch {
            const text = await res.text().catch(() => "");
            if (text) msg = text;
        }
        throw new Error(`API ${res.status}: ${msg}`);
    }
    return res.json() as Promise<T>;
}
