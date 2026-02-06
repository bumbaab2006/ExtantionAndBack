const prisma = require("./prisma");

// Өнөөдрийн 00:00 цагийг авах (Улаанбаатарын цагийн бүсээр тооцох боломжтой)
function getTodayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Хүүхдийн тухайн категори дээрх лимитийг шалгах
async function checkTimeLimit(childId, categoryId) {
  const today = getTodayDate();

  // 1. Одоогийн хэрэглээг DailyUsage-аас харах
  const usage = await prisma.dailyUsage.findUnique({
    where: {
      childId_categoryId_date: {
        childId: Number(childId),
        categoryId: Number(categoryId),
        date: today,
      },
    },
  });

  const usedSeconds = usage ? usage.duration : 0;

  // 2. Тухайн хүүхдийн тухайн категорийн тохиргоог харах
  const setting = await prisma.childCategorySetting.findUnique({
    where: {
      childId_categoryId: {
        childId: Number(childId),
        categoryId: Number(categoryId),
      },
    },
  });

  // Хэрэв LIMITED биш эсвэл лимит байхгүй бол зөвшөөрнө
  if (!setting || setting.status !== "LIMITED" || !setting.timeLimit) {
    return { isBlocked: false, remainingSeconds: null };
  }

  const limitSeconds = setting.timeLimit * 60; // Минутыг секунд болгох
  const isBlocked = usedSeconds >= limitSeconds;

  return {
    isBlocked,
    usedSeconds,
    limitSeconds,
    remainingSeconds: Math.max(0, limitSeconds - usedSeconds),
  };
}

module.exports = { getTodayDate, checkTimeLimit };
