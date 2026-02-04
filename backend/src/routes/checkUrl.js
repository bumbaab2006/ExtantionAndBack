const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { classifyWebsite } = require("../lib/ai"); // Gemini функцээ дуудна

// POST: /api/check-url
router.post("/", async (req, res, next) => {
  try {
    const { childId, url } = req.body;

    if (!childId || !url) {
      return res.status(400).json({ action: "ALLOWED", error: "Missing data" });
    }

    // 1. URL Parse хийх
    let domain;
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname.replace(/^www\./, "");
    } catch (e) {
      return res.json({ action: "ALLOWED" });
    }

    // 2. Баазаас (Catalog) хайх
    let catalogEntry = await prisma.urlCatalog.findUnique({
      where: { domain },
    });

    // --- ШИНЭ: AI ХЭСЭГ ---
    // Хэрэв каталогт байхгүй бол Gemini-аар шинжлүүлээд баазад нэмнэ
    if (!catalogEntry) {
      console.log(`🤖 Gemini шинжилж байна: ${domain}`);
      const aiResult = await classifyWebsite(domain);

      if (aiResult) {
        try {
          catalogEntry = await prisma.urlCatalog.create({
            data: {
              domain: domain,
              categoryName: aiResult.category,
              safetyScore: aiResult.safetyScore,
              tags: [aiResult.category],
            },
          });
          console.log(
            `✅ ${domain} сайтыг ${aiResult.category} ангилалд бүртгэлээ.`,
          );
        } catch (dbErr) {
          console.error("Catalog Save Error:", dbErr);
        }
      }
    }
    // ----------------------

    // 3. Хувийн тохиргоог хайх (Хэрэв каталогт олдсон бол)
    let personalSetting = null;
    if (catalogEntry) {
      personalSetting = await prisma.childUrlSetting.findUnique({
        where: {
          childId_urlId: {
            childId: Number(childId),
            urlId: catalogEntry.id,
          },
        },
      });
    }

    // 4. Шийдвэр гаргах (Decision Engine)
    let action = "ALLOWED";
    let category = catalogEntry?.categoryName || "Uncategorized";

    // Эцэг эхийн тохиргоо эсвэл AI-ийн оноог шалгах
    if (personalSetting?.status === "BLOCKED") {
      action = "BLOCK";
    } else if (catalogEntry && catalogEntry.safetyScore < 50) {
      action = "BLOCK";
    }

    // 5. History-д хадгалах (Prisma Enum-д тааруулж BLOCKED/ALLOWED гэж бичнэ)
    const historyAction = action === "BLOCK" ? "BLOCKED" : "ALLOWED";

    prisma.history
      .create({
        data: {
          childId: Number(childId),
          fullUrl: url,
          domain: domain,
          categoryName: category,
          actionTaken: historyAction,
          duration: 0,
        },
      })
      .catch((err) => console.error("History Save Error:", err));

    // 6. Extension-д хариу илгээх (Таны хүссэнээр BLOCK эсвэл ALLOWED)
    return res.json({ action });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
