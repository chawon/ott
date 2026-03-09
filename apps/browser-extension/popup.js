const APP_BASE_URL = "https://ott.preview.pe.kr/ko";

const statusEl = document.getElementById("status");
const descriptionEl = document.getElementById("description");
const openButton = document.getElementById("openButton");

let currentPayload = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function buildTargetUrl(payload) {
  const target = new URL(APP_BASE_URL);
  target.searchParams.set("quick", "1");
  target.searchParams.set("quick_focus", "1");
  target.searchParams.set("capture_title", payload.title);
  target.searchParams.set("capture_type", payload.contentType);
  target.searchParams.set("capture_platform", payload.platform);
  target.searchParams.set("capture_source_site", payload.sourceSite);
  target.searchParams.set("capture_source_url", payload.sourceUrl);
  return target.toString();
}

async function captureCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    setStatus("현재 탭을 찾지 못했습니다.");
    return;
  }

  if (!tab.url.startsWith("https://")) {
    setStatus("HTTPS 페이지에서만 동작합니다.");
    return;
  }

  try {
    let response = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      response = await chrome.tabs.sendMessage(tab.id, {
        type: "OTT_CAPTURE_PAGE",
      });
      if (response?.ok) break;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    if (!response?.ok) {
      setStatus("지원하지 않는 페이지이거나 제목을 읽지 못했습니다.");
      descriptionEl.textContent =
        "Netflix, Disney+, TVING, wavve, Coupang Play, WATCHA 작품 페이지에서 다시 시도해보세요. 확장을 방금 로드했다면 탭을 새로고침해야 합니다.";
      return;
    }

    currentPayload = response;
    setStatus(`${response.platform} · ${response.title}`);
    descriptionEl.textContent =
      "QuickLog 검색어와 플랫폼을 채운 뒤, 웹앱에서 직접 저장합니다.";
    openButton.disabled = false;
  } catch {
    setStatus("지원 사이트에서 페이지를 다시 열어주세요.");
    descriptionEl.textContent =
      "content script가 동작하지 않았습니다. 탭을 새로고침한 뒤 다시 시도해보세요.";
  }
}

openButton.addEventListener("click", async () => {
  if (!currentPayload) return;
  await chrome.tabs.create({ url: buildTargetUrl(currentPayload) });
  window.close();
});

captureCurrentTab();
