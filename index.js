import express from 'express';
import bodyParser from 'body-parser';
import { verifyChallenge, handleDropboxChanges } from './utils.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Dropbox webhook verification
app.get('/webhook', verifyChallenge);

// Webhook listener
app.post('/webhook', async (req, res) => {
  // Acknowledge webhook immediately
  res.sendStatus(200);

  const { list_folder } = req.body;
  if (!list_folder?.accounts?.length) return;

  try {
    // Solo procesamos el primer account ID ya que es una única carpeta
    const lastFile = await handleDropboxChanges(list_folder.accounts[0]);
    if (lastFile) {
      console.log('Último archivo subido:', lastFile);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
