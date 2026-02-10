const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const {
  getUBTodayDate,
  getUBCurrentTime,
  checkTimeLimit,
} = require("../lib/timeUtils");

// Extension 60 секунд тутамд дуудах тул бид баазад 60 секунд нэмнэ
const TRACK_INCREMENT_SEC = 60;
router.post("/", async (req, res) => {
  const { childId, url } = req.body;

  if (!childId || !url) {
    return res.status(400).json({ status: "ERROR", message: "Missing data" });
  }

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, "");

    // 1. Огноог бэлдэх (Цагийг нь 00:00:00 болгох)
    const today = getUBTodayDate();
    if (!(today instanceof Date)) {
      // Хэрэв функц тань Date объект буцаадаггүй бол энд заавал Date болгох хэрэгтэй
      throw new Error("getUBTodayDate must return a Date object");
    }
    today.setHours(0, 0, 0, 0);

    const exactTime = getUBCurrentTime();

    // 2. Категори олох
    let categoryName = "Uncategorized";
    const catalog = await prisma.urlCatalog.findUnique({ where: { domain } });
    if (catalog) categoryName = catalog.categoryName;

    const category = await prisma.categoryCatalog.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });

    // 3. TRANSACTION
    await prisma.$transaction(async (tx) => {
      // A. DAILY USAGE UPDATE
      await tx.dailyUsage.upsert({
        where: {
          childId_categoryId_date: {
            childId: Number(childId),
            categoryId: category.id,
            date: today, // Яг 00:00:00 цагтай Date объект
          },
        },
        update: { duration: { increment: TRACK_INCREMENT_SEC } },
        create: {
          childId: Number(childId),
          categoryId: category.id,
          date: today,
          duration: TRACK_INCREMENT_SEC,
        },
      });

      // B. HISTORY UPDATE
      const recentHistory = await tx.history.findFirst({
        where: {
          childId: Number(childId),
          domain: domain,
          visitedAt: {
            gte: new Date(exactTime.getTime() - 5 * 60 * 1000),
          },
        },
        orderBy: { visitedAt: "desc" },
      });

      if (recentHistory) {
        await tx.history.update({
          where: { id: recentHistory.id },
          data: {
            duration: { increment: TRACK_INCREMENT_SEC },
            fullUrl: url, // Сүүлийн үзсэн URL (Reel) болон шинэчлэгдэнэ
            visitedAt: exactTime, // Хамгийн сүүлд хэзээ байсныг нь шинэчилнэ
          },
        });
      } else {
        await tx.history.create({
          data: {
            childId: Number(childId),
            fullUrl: url,
            domain: domain,
            categoryName: categoryName,
            actionTaken: "ALLOWED",
            duration: TRACK_INCREMENT_SEC,
            visitedAt: exactTime,
          },
        });
      }
    });

    // 4. Лимит шалгах
    const timeStatus = await checkTimeLimit(Number(childId), category.id);

    if (timeStatus.isBlocked) {
      return res.json({
        status: "BLOCK",
        reason: "TIME_LIMIT_EXCEEDED",
        category: categoryName,
      });
    }

    res.json({ status: "OK", remaining: timeStatus.remainingSeconds });
  } catch (error) {
    console.error("❌ TrackTime Error:", error.message);
    res.status(500).json({ status: "ERROR" });
  }
});
module.exports = router;
