require("dotenv").config();
const express = require("express");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 3000;
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const TIP_FILE = "daily_tip.json";

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/daily-tip", async (req, res) => {
  try {
    const tipData = await getDailyTip();
    res.json({ tip: tipData.tip });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "No se pudo obtener el consejo" });
  }
});

async function getDailyTip() {
  let currentData = readTipFile();

  if (shouldUpdate(currentData.lastUpdated)) {
    console.log("Generando nuevo consejo...");
    currentData = await updateTip();
  }

  return currentData;
}

function readTipFile() {
  try {
    if (fs.existsSync(TIP_FILE)) {
      return JSON.parse(fs.readFileSync(TIP_FILE));
    }
  } catch (error) {
    console.error("Error leyendo archivo:", error);
  }

  // Datos iniciales si el archivo no existe
  return {
    tip: "¡Buen día! Hoy es un buen día para comenzar una vida sana",
    lastUpdated: "1970-01-01T00:00:00.000Z",
  };
}

function saveTipFile(data) {
  fs.writeFileSync(TIP_FILE, JSON.stringify(data));
}

function shouldUpdate(lastUpdated) {
  const now = new Date();
  const lastDate = new Date(lastUpdated);
  const updateHour = parseInt(process.env.UPDATE_HOUR) || 19;

  return (
    now.getDate() !== lastDate.getDate() ||
    (now.getDate() === lastDate.getDate() &&
      now.getHours() >= updateHour &&
      lastDate.getHours() < updateHour)
  );
}

async function updateTip() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt =
      "Genera un consejo breve e inspirador para el día sobre el cuidado de alimentacion y el ejercicio. Máximo 40 caracteres.";

    const result = await model.generateContent(prompt);
    const newTip = result.response.text().trim();

    const newData = {
      tip: newTip,
      lastUpdated: new Date().toISOString(),
    };

    saveTipFile(newData);
    return newData;
  } catch (error) {
    console.error("Error con Gemini API:", error);
    throw error;
  }
}

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor listo en http://localhost:${port}`);
});
