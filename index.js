import express from 'express';
import { handleDropboxChanges } from './utils.js';

const app = express();
app.use(express.json());

// Webhook verification
app.get('/webhook/2257b161-8822-401d-b3f8-ba2e1ae2150a', (req, res) => {
  const challenge = req.query.challenge;
  if (challenge) return res.status(200).send(challenge);
  return res.status(400).send('Missing challenge');
});

// Webhook listener
app.post('/webhook/2257b161-8822-401d-b3f8-ba2e1ae2150a', async (req, res) => {
  console.log('🔔 Webhook recibido');
  const { list_folder } = req.body;
  console.log('📦 Payload recibido:', JSON.stringify(list_folder, null, 2));
  
  res.status(200).send('OK');
  
  if (!list_folder?.accounts?.length) {
    console.log('⚠️ No hay cuentas en el webhook');
    return;
  }
  
  console.log('🔄 Procesando cambios para la cuenta:', list_folder.accounts[0]);
  
  try {
    const file = await handleDropboxChanges();
    if (file) {
      console.log('✅ Archivo encontrado:', JSON.stringify({
        name: file.name,
        path: file.path
      }, null, 2));
    } else {
      console.log('ℹ️ No se encontraron archivos nuevos');
    }
  } catch (error) {
    console.error('❌ Error al procesar el archivo:', error.message);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
  // Consider restarting the server or handling the error appropriately
  process.exit(1);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('🛑 Server terminated');
    process.exit(0);
  });
});
