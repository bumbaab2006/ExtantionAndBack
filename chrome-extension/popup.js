const PASS = "123456";

// Нэвтрэх хэсэг
document.getElementById("unlock-btn").onclick = () => {
  const passInput = document.getElementById("parent-pass").value;
  if (passInput === PASS) {
    document.getElementById("lock-screen").style.display = "none";
    document.getElementById("settings").style.display = "block";
    renderBlacklist(); // Жагсаалтыг харуулах
  } else {
    alert("Буруу нууц үг!");
  }
};

// Жагсаалтыг дэлгэцэнд зурах функц
function renderBlacklist() {
  const listElement = document.getElementById("blacklist-items");
  listElement.innerHTML = ""; // Цэвэрлэх

  chrome.storage.local.get(["blacklist"], (result) => {
    const list = result.blacklist || [];
    list.forEach((item, index) => {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.justifyContent = "space-between";
      li.style.marginBottom = "5px";
      li.style.fontSize = "14px";

      li.innerHTML = `
        <span>${item.keyword}</span>
        <button class="remove-btn" data-id="${item.id}" data-index="${index}" style="width: auto; padding: 2px 8px; background: #e74c3c;">Устгах</button>
      `;
      listElement.appendChild(li);
    });

    // Устгах товчлууруудад event listener нэмэх
    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.onclick = (e) =>
        removeSite(
          e.target.getAttribute("data-id"),
          e.target.getAttribute("data-index"),
        );
    });
  });
}

// Сайт нэмэх функц
document.getElementById("add-btn").onclick = () => {
  const keyword = document
    .getElementById("new-keyword")
    .value.trim()
    .toLowerCase();
  if (keyword) {
    const ruleId = Math.floor(Math.random() * 10000) + 10;

    chrome.declarativeNetRequest.updateDynamicRules(
      {
        addRules: [
          {
            id: ruleId,
            priority: 1,
            action: { type: "block" },
            condition: {
              urlFilter: `*${keyword}*`,
              resourceTypes: ["main_frame"],
            },
          },
        ],
        removeRuleIds: [],
      },
      () => {
        chrome.storage.local.get(["blacklist"], (result) => {
          const list = result.blacklist || [];
          list.push({ keyword: keyword, id: ruleId }); // ID-тай нь хамт хадгалах
          chrome.storage.local.set({ blacklist: list }, () => {
            renderBlacklist();
            document.getElementById("new-keyword").value = "";
          });
        });
      },
    );
  }
};

// Сайт устгах функц
function removeSite(ruleId, index) {
  const idToRemove = parseInt(ruleId, 10);
  const indexToRemove = parseInt(index, 10);

  if (isNaN(idToRemove)) {
    removeFromStorage(indexToRemove, null);
    return;
  }

  // 1. Chrome-ийн хаалтыг цуцлах
  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: [idToRemove],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("Rule устгахад алдаа:", chrome.runtime.lastError);
      } else {
        // 2. Жагсаалтаас нэрийг нь олж аваад, тэр сайтыг Reload хийх
        chrome.storage.local.get(["blacklist"], (result) => {
          const list = result.blacklist || [];
          const siteKeyword = list[indexToRemove]?.keyword;

          removeFromStorage(indexToRemove, siteKeyword);
        });
      }
    },
  );
}

function removeFromStorage(index, keyword) {
  chrome.storage.local.get(["blacklist"], (result) => {
    let list = result.blacklist || [];
    list.splice(index, 1);
    chrome.storage.local.set({ blacklist: list }, () => {
      renderBlacklist();

      // 3. ШИНЭ: Сайтыг нээмэгц тухайн сайтыг reload хийж хаалтыг гаргах
      if (keyword) {
        chrome.tabs.query({ url: `*://*.${keyword}/*` }, (tabs) => {
          tabs.forEach((tab) => chrome.tabs.reload(tab.id));
        });
      }
    });
  });
}
