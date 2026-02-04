const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 1. Test хэрэглэгч үүсгэх
  const user = await prisma.user.upsert({
    where: { email: "parent@test.com" },
    update: {},
    create: {
      email: "parent@test.com",
      password: "password123",
      name: "Test Parent",
      verified: true,
    },
  });

  console.log("✅ User үүсгэлээ:", user);

  // 2. Test хүүхэд үүсгэх
  const child = await prisma.child.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Test Child",
      pin: "1234",
      age: 10,
      gender: "Male",
      parentId: user.id,
    },
  });

  console.log("✅ Child үүсгэлээ:", child);

  // 3. URL Catalog үүсгэх
  const urls = [
    {
      domain: "youtube.com",
      categoryName: "Entertainment",
      safetyScore: 70,
      tags: ["video", "social"],
    },
    {
      domain: "facebook.com",
      categoryName: "Social Media",
      safetyScore: 60,
      tags: ["social", "chat"],
    },
    {
      domain: "pornhub.com",
      categoryName: "Adult",
      safetyScore: 0,
      tags: ["adult", "nsfw"],
    },
    {
      domain: "wikipedia.org",
      categoryName: "Education",
      safetyScore: 100,
      tags: ["education", "reference"],
    },
  ];

  for (const url of urls) {
    await prisma.urlCatalog.upsert({
      where: { domain: url.domain },
      update: {},
      create: url,
    });
  }

  console.log("✅ URL Catalog үүсгэлээ");

  // 4. Child URL Setting үүсгэх (pornhub блоклох)
  const pornhubUrl = await prisma.urlCatalog.findUnique({
    where: { domain: "pornhub.com" },
  });

  if (pornhubUrl) {
    await prisma.childUrlSetting.upsert({
      where: {
        childId_urlId: {
          childId: child.id,
          urlId: pornhubUrl.id,
        },
      },
      update: {},
      create: {
        childId: child.id,
        urlId: pornhubUrl.id,
        status: "BLOCKED",
      },
    });
  }

  console.log("✅ Settings үүсгэлээ");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
