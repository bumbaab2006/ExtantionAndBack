const API_URL = "http://localhost:5000/api/check-url";
const CHILD_ID = 1; // Seed script-ээр үүсгэсэн Test Child-ийн ID

chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    // Зөвхөн үндсэн хуудсыг шалгана (iframe-ийг алгасана)
    if (details.frameId !== 0) return;

    const url = details.url;

    // Системийн хуудсуудыг алгасах
    if (
      url.startsWith("chrome://") ||
      url.startsWith("about:") ||
      url.includes("blocked.html")
    )
      return;

    console.log("Checking URL:", url);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId: CHILD_ID,
          url: url,
        }),
      });

      const data = await response.json();

      if (data.action === "BLOCK") {
        console.warn("🚫 AI/Parent says BLOCK:", url);
        chrome.tabs.update(details.tabId, {
          url: chrome.runtime.getURL("blocked.html"),
        });
      } else {
        console.log("✅ AI/Parent says ALLOW");
      }
    } catch (err) {
      console.error("❌ Backend-тэй холбогдоход алдаа гарлаа:", err);
    }
  },
  { url: [{ schemes: ["http", "https"] }] },
);
