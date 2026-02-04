const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function classifyWebsite(domain) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Маш хурдан модель
      generationConfig: { responseMimeType: "application/json" }, // JSON-оор хариу авах
    });

    const prompt = `Энэ "${domain}" домэйн нэртэй сайт ямар төрлийн сайт вэ?
    Дараах JSON форматаар хариул: 
    {
      "category": "Education, Social Media, Adult, Games, эсвэл Entertainment",
      "safetyScore": 0-100 хооронд тоо (0 бол маш аюултай, 100 бол маш аюулгүй)
    }`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return JSON.parse(response.text());
  } catch (error) {
    console.error("Gemini Classification Error:", error);
    return null;
  }
}

module.exports = { classifyWebsite };
