const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { getTodayDate, checkTimeLimit } = require("../lib/timeUtils");

router.post("/", async (req, res) => {
  try {
    const { childId, url } = req.body;

    // URL-аас категорийг нь олох
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, "");

    const catalog = await prisma.urlCatalog.findUnique({
      where: { domain },
    });

    if (!catalog) return res.json({ status: "OK" });

    const category = await prisma.categoryCatalog.findUnique({
      where: { name: catalog.categoryName },
    });

    if (!category) return res.json({ status: "OK" });

    // 1. DailyUsage-г ШИНЭЧЛЭХ (60 секунд нэмнэ)
    await prisma.dailyUsage.upsert({
      where: {
        childId_categoryId_date: {
          childId: Number(childId),
          categoryId: category.id,
          date: getTodayDate(),
        },
      },
      update: { duration: { increment: 60 } },
      create: {
        childId: Number(childId),
        categoryId: category.id,
        date: getTodayDate(),
        duration: 60,
      },
    });

    // 2. Лимит хэтэрсэн эсэхийг дахин шалгах
    const timeStatus = await checkTimeLimit(childId, category.id);

    if (timeStatus.isBlocked) {
      return res.json({ status: "BLOCK", reason: "TIME_LIMIT_EXCEEDED" });
    }

    res.json({ status: "OK", remaining: timeStatus.remainingSeconds });
  } catch (error) {
    console.error("TrackTime error:", error);
    res.status(500).json({ status: "ERROR" });
  }
});

module.exports = router;
