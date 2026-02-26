// functions/config.js
require('dotenv').config(); // Este comando é o que "liga" a leitura do arquivo .env

module.exports = {
  // Agora ele busca a chave real que você colou no arquivo .env
  GEMINI_API_KEY: process.env.GEMINI_API_KEY, 
  
  // Alterado para 1.5-pro para evitar o erro 404 que vimos nos logs
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-pro", 
  
  REGION: process.env.REGION || "us-central1",
  
  CONCIERGE_NUMBER: process.env.CONCIERGE_NUMBER || "+14454563363"
};