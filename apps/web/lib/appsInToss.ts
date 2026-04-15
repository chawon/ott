type GraniteNativeEmitter = {
  on: (eventName: string, callback: (payload: unknown) => void) => (() => void) | void;
};

type AppsInTossWindow = Window & {
  __appsInToss?: Record<string, unknown>;
  __GRANITE_NATIVE_EMITTER?: GraniteNativeEmitter;
  ReactNativeWebView?: {
    postMessage: (message: string) => void;
  };
};

type NativeErrorPayload = {
  __isError?: boolean;
  message?: string;
};

function getAppsInTossWindow(): AppsInTossWindow | null {
  if (typeof window === "undefined") return null;
  return window as AppsInTossWindow;
}

function createEventId() {
  return Math.random().toString(36).slice(2, 15);
}

function normalizeNativeError(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    ("message" in payload || "__isError" in payload)
  ) {
    const nativeError = payload as NativeErrorPayload;
    return new Error(nativeError.message || "AppsInToss bridge error");
  }

  return payload instanceof Error
    ? payload
    : new Error("AppsInToss bridge error");
}

async function callAppsInTossBridge<TResult>(
  functionName: string,
  params: Record<string, unknown>,
): Promise<TResult> {
  const bridgeWindow = getAppsInTossWindow();

  if (
    !bridgeWindow?.ReactNativeWebView ||
    !bridgeWindow.__GRANITE_NATIVE_EMITTER
  ) {
    throw new Error("AppsInToss bridge unavailable");
  }

  const webView = bridgeWindow.ReactNativeWebView;
  const emitter = bridgeWindow.__GRANITE_NATIVE_EMITTER;

  const eventId = createEventId();

  return new Promise<TResult>((resolve, reject) => {
    const cleanup = (unsubscribers: Array<(() => void) | void>) => {
      for (const unsubscribe of unsubscribers) {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      }
    };

    const unsubscribers = [
      emitter.on(`${functionName}/resolve/${eventId}`, (payload) => {
        cleanup(unsubscribers);
        resolve(payload as TResult);
      }),
      emitter.on(`${functionName}/reject/${eventId}`, (payload) => {
        cleanup(unsubscribers);
        reject(normalizeNativeError(payload));
      }),
    ];

    webView.postMessage(
      JSON.stringify({
        type: "method",
        functionName,
        eventId,
        args: [params],
      }),
    );
  });
}

async function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to convert blob to base64"));
        return;
      }

      const [, base64 = ""] = reader.result.split(",", 2);
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("Failed to read blob"));
    };

    reader.readAsDataURL(blob);
  });
}

export function isAppsInTossEnvironment() {
  const bridgeWindow = getAppsInTossWindow();

  if (!bridgeWindow) return false;

  return (
    Boolean(bridgeWindow.__appsInToss) ||
    /(^|\.)tossmini\.com$/i.test(window.location.hostname)
  );
}

export async function saveBlobInAppsInToss(blob: Blob, filename: string) {
  if (!isAppsInTossEnvironment()) return false;

  const base64 = await blobToBase64(blob);

  await callAppsInTossBridge<void>("saveBase64Data", {
    data: base64,
    fileName: filename,
    mimeType: blob.type || "application/octet-stream",
  });

  return true;
}

export async function shareTextInAppsInToss(message: string) {
  if (!isAppsInTossEnvironment()) return false;

  await callAppsInTossBridge<void>("share", {
    message,
  });

  return true;
}
