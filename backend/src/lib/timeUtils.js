const prisma = require("./prisma");

// Улаанбаатарын цагаар "Өнөөдөр"-ийн огноог авах (00:00:00)
// Жишээ: 2026-02-09T00:00:00.000Z (гэхдээ энэ нь UB-ийн өдөр)
function getUBTodayDate() {
  const now = new Date();
  // UB цагаар огноог текст болгож авах (YYYY-MM-DD)
  const ubDateString = now.toLocaleDateString("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
  });
  // Текстийг буцаад Date объект болгох
  return new Date(ubDateString);
}

// Улаанбаатарын яг одоогийн цагийг авах (History visitedAt-д зориулж)
function getUBCurrentTime() {
  const now = new Date();
  // Одоогийн системийг цагийг UB руу хөрвүүлэх
  const ubString = now.toLocaleString("en-US", {
    timeZone: "Asia/Ulaanbaatar",
  });
  return new Date(ubString);
}

async function checkTimeLimit(childId, categoryId) {
  const today = getUBTodayDate();

  // 1. Тухайн өдрийн хэрэглээг авах
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

  // 2. Хүүхдийн тохиргоог шалгах
  const setting = await prisma.childCategorySetting.findUnique({
    where: {
      childId_categoryId: {
        childId: Number(childId),
        categoryId: Number(categoryId),
      },
    },
  });

  // --- ШИНЭЧЛЭЛТ: BLOCKED төлөвийг шалгах ---
  if (!setting) {
    return { isBlocked: false, remainingSeconds: null };
  }

  // Хэрэв эцэг эх шууд БЛОКЛОСОН бол хугацаа харахгүй шууд хаана
  if (setting.status === "BLOCKED") {
    return {
      isBlocked: true,
      usedSeconds,
      limitSeconds: 0,
      remainingSeconds: 0,
    };
  }

  // Хэрэв хязгаар тогтоогоогүй бол (ALLOWED)
  if (setting.status !== "LIMITED" || !setting.timeLimit) {
    return { isBlocked: false, remainingSeconds: null };
  }

  // 3. LIMITED үед хугацаа шалгах
  const limitSeconds = setting.timeLimit * 60;
  const isBlocked = usedSeconds >= limitSeconds;

  return {
    isBlocked,
    usedSeconds,
    limitSeconds,
    remainingSeconds: Math.max(0, limitSeconds - usedSeconds),
  };
}
