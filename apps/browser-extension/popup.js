const statusEl = document.getElementById("status");
const descriptionEl = document.getElementById("description");
const openButton = document.getElementById("openButton");
const extension = globalThis.OttlineExtension;
const locale = extension.normalizeLocale(
  chrome.i18n.getUILanguage?.() ?? navigator.language,
);

let currentPayload = null;

function message(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

function applyLocalization() {
  document.documentElement.lang = locale;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = message(element.dataset.i18n);
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function platformName(payload) {
  const messageKey = extension.platformMessageKeyForSourceSite(
    payload.sourceSite,
  );
  return (messageKey && message(messageKey)) || payload.platform;
}

async function captureCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    setStatus(message("statusNoTab"));
    return;
  }

  if (!tab.url.startsWith("https://")) {
    setStatus(message("statusHttpsOnly"));
    return;
  }

  try {
    let response = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          type: "OTT_CAPTURE_PAGE",
        });
      } catch {
        response = null;
      }
      if (response?.ok) break;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    if (!response?.ok) {
      setStatus(message("statusUnsupported"));
      descriptionEl.textContent = message("descriptionUnsupported");
      return;
    }

    currentPayload = response;
    setStatus(message("statusReady", [platformName(response), response.title]));
    descriptionEl.textContent = message("descriptionReady");
    openButton.disabled = false;
  } catch {
    setStatus(message("statusUnavailable"));
    descriptionEl.textContent = message("descriptionUnavailable");
  }
}

openButton.addEventListener("click", async () => {
  if (!currentPayload) return;
  await chrome.tabs.create({
    url: extension.buildTargetUrl(currentPayload, locale),
  });
  window.close();
});

applyLocalization();
captureCurrentTab();
