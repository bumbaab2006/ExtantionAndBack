const { PrismaClient } = require("@prisma/client");

// Global хувьсагчид хадгалж, дахин дахин connection үүсгэхээс сэргийлнэ
const globalForPrisma = global;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"], // Зөвхөн алдаа гарвал log бичнэ (Production mode-д цэвэрхэн)
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

module.exports = prisma;
