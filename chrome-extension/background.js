const BASE_URL = "http://localhost:5000/api";
const PING_INTERVAL_MS = 60000; // 1 минут (60 секунд)

let trackingTimer = null; // Тоолуурын ID
let currentTabId = null; // Одоогийн идэвхтэй таб ID
let currentDomain = null; // Одоогийн домайн (Жишээ нь: instagram.com)

console.log("🚀 Background Monitor Loaded (Domain-Based Tracking)");

// Туслах функц: URL-аас домайныг ялгаж авах
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch (e) {
    return null;
  }
}

// 1. Browser эхлэх үед
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.remove("activeChildId");
});

// 2. Navigation Monitor (Сайт руу орох үед БЛОК хийх эсэхийг шалгах)
chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    if (details.frameId !== 0) return;
    const url = details.url;
    if (!url.startsWith("http")) return;

    const storage = await chrome.storage.local.get(["activeChildId"]);
    if (!storage.activeChildId) return;

    try {
      const res = await fetch(`${BASE_URL}/check-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: storage.activeChildId, url: url }),
      });
      const data = await res.json();
      if (data.action === "BLOCK") {
        chrome.tabs.update(details.tabId, {
          url: chrome.runtime.getURL("blocked.html"),
        });
      }
    } catch (e) {
      console.error("Check URL failed:", e);
    }
  },
  { url: [{ schemes: ["http", "https"] }] },
);

// ============================================
// 3. УХААЛАГ TRACKING LOGIC (DOMAINS BASED)
// ============================================

// A. Таб идэвхжих үед
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  handleTabChange(activeInfo.tabId);
});

// B. Таб шинэчлэгдэх үед (URL солигдох)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    handleTabChange(tabId);
  }
});

async function handleTabChange(newTabId) {
  const tab = await chrome.tabs.get(newTabId).catch(() => null);

  // Хэрэв хүчингүй таб бол (Settings, New Tab г.м) -> ЗОГСООНО
  if (!tab || !tab.url || !tab.url.startsWith("http")) {
    console.log("⏸️ Tracking Paused (Non-http page)");
    stopTracking();
    return;
  }

  const newDomain = getDomain(tab.url);

  // === ГОЛ ӨӨРЧЛӨЛТ ===
  // Хэрэв өмнөх домайнтай ИЖИЛ байвл тоолуурыг ЗОГСООХГҮЙ (Reset хийхгүй)
  // Жишээ нь: Reel 1 -> Reel 2 руу шилжихэд timer үргэлжилнэ.
  if (trackingTimer && currentDomain === newDomain) {
    console.log(`🔄 Same domain (${newDomain}). Keeping timer alive.`);
    currentTabId = newTabId; // Зөвхөн ID-г шинэчилнэ, timer хэвээр үлдэнэ
    return;
  }
  // ====================

  // Хэрэв өөр домайн бол (Facebook -> YouTube) -> ШИНЭЭР ЭХЭЛНЭ
  stopTracking();
  startTracking(newTabId, tab.url, newDomain);
}

function stopTracking() {
  if (trackingTimer) {
    console.log("🛑 Timer Stopped/Reset");
    clearInterval(trackingTimer);
    trackingTimer = null;
  }
  currentTabId = null;
  currentDomain = null;
}

function startTracking(tabId, url, domain) {
  console.log(`⏱️ New Timer Started for Domain: ${domain}`);

  currentTabId = tabId;
  currentDomain = domain;

  trackingTimer = setInterval(async () => {
    // 1 минут болох бүрт ЯГ ОДООгийн URL-ийг авч илгээнэ
    // (Reel үзэж байхад url нь 1 минутын өмнөхөөс өөрчлөгдсөн байж болно)
    const currentTab = await chrome.tabs.get(currentTabId).catch(() => null);

    if (!currentTab || !currentTab.active) {
      stopTracking();
      return;
    }

    // Хэрэв домайн өөрчлөгдөөгүй бол л илгээнэ
    if (getDomain(currentTab.url) === currentDomain) {
      sendPing(currentTab.url, currentTabId);
    } else {
      // Хэрэв хэрэглэгч гэнэт өөр домайн руу үсэрсэн бол
      handleTabChange(currentTabId);
    }
  }, PING_INTERVAL_MS);
}

// Сервер рүү мэдээлэл илгээх
async function sendPing(url, tabId) {
  try {
    const storage = await chrome.storage.local.get(["activeChildId"]);
    if (!storage.activeChildId) return;

    console.log(`📡 Sending 60s Data: ${url}`);

    const response = await fetch(`${BASE_URL}/track-time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId: storage.activeChildId,
        url: url, // Энэ нь тухайн агшин дахь Reel URL байна
      }),
    });

    const data = await response.json();

    if (data.status === "BLOCK") {
      stopTracking();
      chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") });
    }
  } catch (error) {
    console.warn("⚠️ Ping failed:", error.message);
  }
}
