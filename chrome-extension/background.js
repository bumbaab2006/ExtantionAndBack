const BASE_URL = "http://localhost:5000/api";
let trackingInterval = null;

// 1. Browser асахад цэвэрлэх
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.remove("activeChildId");
});

// ==============================
// 2. Navigation Blocker (Check URL)
// ==============================
chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    if (details.frameId !== 0) return; // Зөвхөн үндсэн frame
    const url = details.url;

    if (url.startsWith("chrome://") || url.includes("extension")) return;

    const storage = await chrome.storage.local.get(["activeChildId"]);

    // Нэвтрээгүй бол Login хуудас руу
    if (!storage.activeChildId) {
      if (!url.includes("login_required.html")) {
        chrome.tabs.update(details.tabId, {
          url: chrome.runtime.getURL("login_required.html"),
        });
      }
      return;
    }

    // Backend-ээс шалгах
    try {
      const response = await fetch(`${BASE_URL}/check-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId: storage.activeChildId,
          url: url,
        }),
      });

      const data = await response.json();

      if (data.action === "BLOCK") {
        chrome.tabs.update(details.tabId, {
          url: chrome.runtime.getURL("blocked.html"),
        });
      }
    } catch (err) {
      console.error("Server connection error:", err);
    }
  },
  { url: [{ schemes: ["http", "https"] }] },
);

// ==============================
// 3. Time Tracking (Heartbeat)
// ==============================

// Шинэ сайт ачаалагдахад Tracker-ийг шинэчлэх
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url.startsWith("http")) {
    restartTracking(tabId, tab.url);
  }
});

// Tab солигдоход Tracker-ийг шинэчлэх
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url && tab.url.startsWith("http")) {
    restartTracking(activeInfo.tabId, tab.url);
  } else {
    stopTracking(); // Системийн хуудас руу орвол зогсооно
  }
});

function stopTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
}

function restartTracking(tabId, url) {
  stopTracking(); // Хуучныг зогсооно

  // 1 минут (60000ms) тутамд Ping хийх
  trackingInterval = setInterval(async () => {
    try {
      // Таб хаагдсан эсвэл идэвхгүй болсон эсэхийг шалгах
      const currentTab = await chrome.tabs.get(tabId);
      if (!currentTab.active) return;

      const storage = await chrome.storage.local.get(["activeChildId"]);
      if (!storage.activeChildId) return;

      const res = await fetch(`${BASE_URL}/track-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId: storage.activeChildId,
          url: url,
        }),
      });

      const data = await res.json();

      // Хэрэв цаг дууссан бол блоклох
      if (data.status === "BLOCK") {
        stopTracking();
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL("blocked.html"),
        });
      }
    } catch (e) {
      console.error("Tracking error:", e);
      stopTracking();
    }
  }, 60000); // 1 минут
}
