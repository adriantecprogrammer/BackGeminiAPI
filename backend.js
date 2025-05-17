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
  fs.writeFileSync(TIP_FILE, JSON.stringify(data, null, 2));
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
    const prompt = `Genera EXCLUSIVAMENTE un JSON válido (sin comentarios, sin marcas \`\`\`json) con una lista de consejos sobre: nutrición, ejercicio, salud mental y bienestar. 

Requisitos:
1. Estructura exacta:
{
  "tip": [
    {"categoria": "Nutrición", "consejo": "texto"},
    {"categoria": "Ejercicio", "consejo": "texto"}
  ],
  "lastUpdated": "fecha_ISO_actual"
}

2. Consejos deben ser breves y prácticos
3. 3 consejos por categoría
4. NO incluyas ningún texto fuera del JSON
5. NO uses markdown o bloques de código
6. El JSON debe ser perfectamente válido y parseable`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Limpieza adicional por si acaso
    text = text.replace(/^```json|```$/g, "").trim();

    try {
      const tipsData = JSON.parse(text);

      if (!tipsData.tip || !Array.isArray(tipsData.tip)) {
        throw new Error("La respuesta no contiene un array 'tip' válido");
      }

      const newData = {
        tip: tipsData.tip,
        lastUpdated: new Date().toISOString(),
      };

      saveTipFile(newData);
      return newData;
    } catch (e) {
      console.error("Error al parsear JSON:", {
        error: e.message,
        responseText: text,
      });
      throw new Error("La IA devolvió un formato inválido");
    }
  } catch (error) {
    console.error("Error en updateTip:", error);
    throw error;
  }
}

app.listen(port, () => {
  console.log(`Servidor listo en http://localhost:${port}`);
});
