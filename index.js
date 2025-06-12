import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// 1. Configuración inicial
const app = express();
const PORT = process.env.PORT || 3000;

// 2. Configuración simplificada de express-session
app.use(session({
  secret: 'clave-secreta-temporal-para-desarrollo',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Usar true solo en producción con HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

console.log('🔐 Sesión configurada con clave temporal para desarrollo');

// 3. Middleware para verificar la sesión
const requireSession = (req, res, next) => {
  if (!req.session) {
    console.error('❌ Error: No se pudo acceder a la sesión');
    return res.status(500).send('Error de sesión');
  }
  next();
};

// 4. Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 5. Cargar variables de entorno
if (process.env.NODE_ENV !== 'production') {
  const envPath = path.join(__dirname, '.env');
  console.log(`🔍 Modo desarrollo: Buscando archivo .env en: ${envPath}`);
  
  if (fs.existsSync(envPath)) {
    console.log('✅ Archivo .env encontrado, cargando variables...');
    dotenv.config({ path: envPath });
  } else {
    console.log('ℹ️ No se encontró archivo .env, usando variables de entorno del sistema');
  }
}

// Verificar variables de entorno requeridas
const requiredVars = ['DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET', 'DROPBOX_REDIRECT_URI'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Error: Faltan variables de entorno requeridas:', missingVars.join(', '));
  process.exit(1);
}

console.log('✅ Configuración de entorno verificada correctamente');

// 6. Importar dropboxClient después de cargar las variables de entorno
import { authUtils, listFolderChanges } from './dropboxClient.js';

// 7. Configuración de middlewares adicionales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Ruta principal - Muestra el estado de autenticación
app.get('/', async (req, res) => {
  try {
    const tokens = authUtils.loadTokens();
    const isAuthenticated = tokens && tokens.access_token && 
      (tokens.expires_at > Date.now());
    
    res.send(`
      <h1>Dropbox Webhook Server</h1>
      <p>Status: ${isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}</p>
      ${!isAuthenticated ? 
        `<a href="/auth/dropbox">
          <button>Authenticate with Dropbox</button>
        </a>` : 
        '<p>✅ Ready to receive webhook notifications</p>'
      }
    `);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

// Iniciar flujo de autenticación
app.get('/auth/dropbox', (req, res) => {
  try {
    console.log('🔑 Iniciando flujo de autenticación...');
    
    // Verificar si ya hay una sesión activa
    if (req.session.codeVerifier) {
      console.log('⚠️ Ya existe un flujo de autenticación en curso');
    }
    
    // Generar nueva URL de autenticación
    const { url, verifier } = authUtils.getAuthUrl();
    
    // Guardar el verifier en la sesión
    req.session.codeVerifier = verifier;
    console.log('🔐 Verificador generado y guardado en sesión');
    
    // Forzar el guardado de la sesión antes de redirigir
    req.session.save(err => {
      if (err) {
        console.error('❌ Error al guardar la sesión:', err);
        return res.status(500).send('Error al iniciar la autenticación');
      }
      
      console.log('🔗 URL de autenticación generada:', url);
      console.log('🔄 Redirigiendo a Dropbox para autenticación...');
      
      // Redirigir al usuario a la URL de autenticación
      res.redirect(url);
    });
  } catch (error) {
    console.error('❌ Error en /auth/dropbox:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error de Autenticación</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background-color: #f5f5f5;
            }
            .error { 
              background: white; 
              padding: 30px; 
              border-radius: 10px; 
              display: inline-block; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 600px;
            }
            h1 { color: #e74c3c; }
            pre { 
              background: #f8f8f8; 
              padding: 15px; 
              border-radius: 5px; 
              text-align: left;
              overflow-x: auto;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Error al iniciar la autenticación</h1>
            <p>${error.message}</p>
            <h3>Detalles del error:</h3>
            <pre>${error.stack || error.message}</pre>
            <p><a href="/">Volver a intentar</a></p>
          </div>
        </body>
      </html>
    `);
  }
});

// Callback de autenticación
app.get('/oauth/callback', requireSession, async (req, res) => {
  try {
    console.log('🔑 Callback recibido. Query params:', req.query);
    
    const { code } = req.query;
    const verifier = req.session?.codeVerifier;

    console.log('🔍 Datos recibidos:', { code, verifier: verifier ? 'presente' : 'ausente' });

    if (!code) {
      throw new Error('No se recibió el código de autorización');
    }
    
    if (!verifier) {
      throw new Error('No se encontró el verificador en la sesión. Por favor, intenta autenticarte nuevamente.');
    }

    console.log('🔄 Intercambiando código por tokens...');
    const tokens = await authUtils.getAccessToken(code, verifier);
    
    console.log('✅ Tokens recibidos:', {
      access_token: tokens.access_token ? '✅ Presente' : '❌ Ausente',
      refresh_token: tokens.refresh_token ? '✅ Presente' : '❌ Ausente',
      expires_in: tokens.expires_in ? `${tokens.expires_in} segundos` : '❌ No especificado'
    });

    // Guardar tokens en el archivo .env
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    
    // Actualizar o agregar tokens
    const updates = {
      'DROPBOX_ACCESS_TOKEN': tokens.access_token,
      'DROPBOX_REFRESH_TOKEN': tokens.refresh_token,
      'DROPBOX_TOKEN_EXPIRES_AT': (Date.now() + (tokens.expires_in * 1000)).toString()
    };

    let updated = false;
    let newContent = [];
    
    // Procesar líneas existentes
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.trim() === '') continue;
      
      const key = line.split('=')[0];
      if (updates[key] !== undefined) {
        newContent.push(`${key}=${updates[key]}`);
        delete updates[key];
        updated = true;
      } else {
        newContent.push(line);
      }
    }
    
    // Agregar nuevas variables si no existían
    for (const [key, value] of Object.entries(updates)) {
      newContent.push(`${key}=${value}`);
      updated = true;
    }
    
    if (updated) {
      fs.writeFileSync(envPath, newContent.join('\n'));
      console.log('✅ Tokens actualizados en .env');
    }

    // Limpiar el verifier de la sesión
    if (req.session) {
      delete req.session.codeVerifier;
    }

    console.log('✅ Autenticación exitosa. Tokens guardados.');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Autenticación Exitosa</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background-color: #f5f5f5;
            }
            .success { 
              background: white; 
              padding: 30px; 
              border-radius: 10px; 
              display: inline-block; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 { color: #2ecc71; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ Autenticación Exitosa</h1>
            <p>Los tokens de acceso se han guardado correctamente.</p>
            <p>Puedes cerrar esta ventana y volver a la aplicación.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ Error en /oauth/callback:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error de Autenticación</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background-color: #f5f5f5;
            }
            .error { 
              background: white; 
              padding: 30px; 
              border-radius: 10px; 
              display: inline-block; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 600px;
            }
            h1 { color: #e74c3c; }
            pre { 
              background: #f8f8f8; 
              padding: 15px; 
              border-radius: 5px; 
              text-align: left;
              overflow-x: auto;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Error de Autenticación</h1>
            <p>${error.message}</p>
            <p>Por favor, intenta nuevamente o verifica la consola para más detalles.</p>
            <h3>Detalles del error:</h3>
            <pre>${error.stack || error.message}</pre>
            <p><a href="/">Volver a intentar</a></p>
          </div>
        </body>
      </html>
    `);
  }
});

// Ruta para verificación del webhook
app.get('/webhook/:webhookKey', (req, res) => {
  const challenge = req.query.challenge;
  console.log('✅ Webhook verification request received');
  res.type('text/plain').send(challenge);
});

// Ruta para recibir notificaciones del webhook
app.post('/webhook/:webhookKey', async (req, res) => {
  console.log('🔔 Webhook notification received');
  res.status(200).send('OK');
  
  try {
    // Verificar que estamos autenticados
    const tokens = authUtils.loadTokens();
    if (!tokens || !tokens.access_token) {
      console.error('❌ Not authenticated with Dropbox');
      return;
    }
    
    console.log('🔄 Processing changes...');
    const file = await handleDropboxChanges();
    if (file) {
      console.log('✅ File found:', JSON.stringify({
        name: file.name,
        path: file.path
      }, null, 2));
    } else {
      console.log('ℹ️ No new files found');
    }
  } catch (error) {
    console.error('❌ Error processing changes:', error);
  }
});

// Función para manejar los cambios en Dropbox
async function handleDropboxChanges() {
  try {
    const files = await listFolderChanges();
    return files.length > 0 ? files[0] : null;
  } catch (error) {
    console.error('❌ Error in handleDropboxChanges:', error);
    throw error;
  }
}

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  
  // Verificar autenticación al iniciar
  const tokens = authUtils.loadTokens();
  if (tokens && tokens.access_token) {
    console.log('🔑 Using existing Dropbox access token');
    if (tokens.expires_at && tokens.expires_at < Date.now()) {
      console.log('⚠️ Access token has expired. Please re-authenticate.');
    }
  } else {
    console.log('🔐 Please authenticate with Dropbox by visiting http://localhost:3000');
  }
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
