const { PrismaClient, StatusType, AlertType } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Cleaning database...");
  await prisma.dailyUsage.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.history.deleteMany();
  await prisma.childUrlSetting.deleteMany();
  await prisma.childCategorySetting.deleteMany();
  await prisma.urlCatalog.deleteMany();
  await prisma.categoryCatalog.deleteMany();
  await prisma.child.deleteMany();
  await prisma.user.deleteMany();

  console.log("🌱 Seeding realistic data...");

  // 1. Үндсэн категориуд
  const categories = [
    "Education",
    "Social Media",
    "Games",
    "Adult",
    "Entertainment",
  ];
  const categoryRecords = [];
  for (const name of categories) {
    const cat = await prisma.categoryCatalog.create({ data: { name } });
    categoryRecords.push(cat);
  }

  // 2. Үндсэн URL-ууд
  const urlData = [
    { domain: "khanacademy.org", categoryName: "Education", safetyScore: 100 },
    { domain: "roblox.com", categoryName: "Games", safetyScore: 70 },
    { domain: "facebook.com", categoryName: "Social Media", safetyScore: 60 },
    { domain: "pornhub.com", categoryName: "Adult", safetyScore: 0 },
    { domain: "youtube.com", categoryName: "Entertainment", safetyScore: 80 },
  ];

  for (const item of urlData) {
    await prisma.urlCatalog.create({
      data: { ...item, tags: [item.categoryName.toLowerCase()] },
    });
  }
  const urls = await prisma.urlCatalog.findMany();

  // 3. Тест Эцэг эх (Нэвтрэхэд ашиглана)
  const user = await prisma.user.create({
    data: {
      email: "parent@test.com",
      password: "password123",
      name: "Д. Бат",
      verified: true,
    },
  });

  // 4. Тест Хүүхдүүд
  const child1 = await prisma.child.create({
    data: { name: "Анарт", age: 10, pin: "1111", parentId: user.id },
  });
  const child2 = await prisma.child.create({
    data: { name: "Хүслэн", age: 14, pin: "2222", parentId: user.id },
  });

  // 5. Settings (Анарт тоглоом 60 мин хязгаартай, Adult блоклогдсон)
  await prisma.childCategorySetting.createMany({
    data: [
      {
        childId: child1.id,
        categoryId: categoryRecords.find((c) => c.name === "Games").id,
        status: "LIMITED",
        timeLimit: 60,
      },
      {
        childId: child1.id,
        categoryId: categoryRecords.find((c) => c.name === "Adult").id,
        status: "BLOCKED",
      },
    ],
  });

  // 6. Daily Usage (Анарт өнөөдөр 55 мин тоглосон - Тест хийхэд зориулав)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.dailyUsage.create({
    data: {
      childId: child1.id,
      categoryId: categoryRecords.find((c) => c.name === "Games").id,
      date: today,
      duration: 55 * 60, // 55 минут
    },
  });

  // 7. Бага хэмжээний History (Сүүлийн 10)
  for (let i = 0; i < 10; i++) {
    const randomUrl = urls[Math.floor(Math.random() * urls.length)];
    await prisma.history.create({
      data: {
        childId: child1.id,
        fullUrl: `https://${randomUrl.domain}/page-${i}`,
        domain: randomUrl.domain,
        categoryName: randomUrl.categoryName,
        duration: 60,
        actionTaken: randomUrl.safetyScore < 50 ? "BLOCKED" : "ALLOWED",
        visitedAt: new Date(Date.now() - i * 3600000),
      },
    });
  }

  console.log("✅ Seed finished. Login: parent@test.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
