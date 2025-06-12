import { Dropbox } from 'dropbox';
import fetch from 'node-fetch';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de OAuth 2.0 - Valores fijos temporalmente
const config = {
  clientId: 'tuwv23i2wgljx65',
  clientSecret: 'fphniq6d5wiiq48',
  // Asegúrate de que esta URL coincida exactamente con la configurada en la consola de Dropbox
  // Incluye la barra al final si es necesario
  redirectUri: 'http://localhost:3000/oauth/callback',
  tokenPath: path.join(__dirname, '.token.json')
};

console.log('🔗 URL de redirección configurada:', config.redirectUri);

console.log('⚠️ Usando configuración fija para depuración');

// Verificar que las variables de entorno estén definidas
if (!config.clientId || !config.clientSecret || !config.redirectUri) {
  console.error('❌ Error: Faltan variables de configuración de Dropbox');
  console.error('🔍 Configuración actual:', {
    DROPBOX_APP_KEY: config.clientId ? '✅ Presente' : '❌ Faltante',
    DROPBOX_APP_SECRET: config.clientSecret ? '✅ Presente' : '❌ Faltante',
    DROPBOX_REDIRECT_URI: config.redirectUri || '❌ No definida'
  });
  process.exit(1);
}

console.log('✅ Configuración de Dropbox cargada correctamente');

// Función para generar el code_verifier para PKCE
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('hex');
}

// Función para generar el code_challenge
function generateCodeChallenge(verifier) {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Cargar tokens guardados
function loadTokens() {
  try {
    if (fs.existsSync(config.tokenPath)) {
      return JSON.parse(fs.readFileSync(config.tokenPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error al cargar tokens:', error);
  }
  return null;
}

// Guardar tokens
function saveTokens(tokens) {
  try {
    fs.writeFileSync(config.tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
    // Actualizar variables de entorno
    if (tokens.access_token) process.env.DROPBOX_ACCESS_TOKEN = tokens.access_token;
    if (tokens.refresh_token) process.env.DROPBOX_REFRESH_TOKEN = tokens.refresh_token;
    if (tokens.expires_at) process.env.DROPBOX_TOKEN_EXPIRES_AT = tokens.expires_at.toString();
  } catch (error) {
    console.error('Error al guardar tokens:', error);
  }
}

// Verificar si el token está expirado
function isTokenExpired(tokens) {
  if (!tokens || !tokens.expires_at) return true;
  return Date.now() >= parseInt(tokens.expires_at, 10);
}

// Obtener URL de autorización
function getAuthUrl() {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: config.redirectUri,
    token_access_type: 'offline'
  });

  return {
    url: `https://www.dropbox.com/oauth2/authorize?${params.toString()}`,
    verifier
  };
}

// Intercambiar código por token
async function getAccessToken(code, verifier) {
  try {
    const response = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: verifier,
        redirect_uri: config.redirectUri
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Error al obtener token: ${JSON.stringify(error)}`);
    }

    const tokens = await response.json();
    tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
    saveTokens(tokens);
    return tokens;
  } catch (error) {
    console.error('Error en getAccessToken:', error);
    throw error;
  }
}

// Refrescar token
async function refreshAccessToken() {
  const tokens = loadTokens();
  if (!tokens || !tokens.refresh_token) {
    throw new Error('No hay refresh token disponible');
  }

  try {
    const response = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: config.clientId,
        client_secret: config.clientSecret
      })
    });

    if (!response.ok) {
      throw new Error(`Error al refrescar token: ${response.statusText}`);
    }

    const newTokens = await response.json();
    newTokens.refresh_token = tokens.refresh_token; // Mantener el refresh token original
    newTokens.expires_at = Date.now() + (newTokens.expires_in * 1000);
    saveTokens(newTokens);
    return newTokens;
  } catch (error) {
    console.error('Error al refrescar token:', error);
    throw error;
  }
}

// Obtener cliente de Dropbox autenticado
async function getAuthenticatedClient() {
  let tokens = loadTokens();
  
  // Si no hay token o está expirado, intentar refrescarlo
  if (!tokens || isTokenExpired(tokens)) {
    try {
      tokens = await refreshAccessToken();
    } catch (error) {
      console.log('No se pudo refrescar el token. Se requiere nueva autenticación.');
      const auth = getAuthUrl();
      console.log(`Por favor, autentícate en: ${auth.url}`);
      throw new Error('Se requiere autenticación. Por favor, sigue la URL proporcionada.');
    }
  }

  return new Dropbox({
    accessToken: tokens.access_token,
    fetch
  });
}

// Listar cambios en la carpeta
async function listFolderChanges() {
  try {
    const dbx = await getAuthenticatedClient();
    const folderPath = process.env.DROPBOX_FOLDER_PATH || '';

    // Listar contenido de la carpeta
    const response = await dbx.filesListFolder({
      path: folderPath,
      recursive: true,
      include_deleted: false
    });

    const files = response.result.entries.filter(e => e['.tag'] === 'file');
    
    if (files.length > 0) {
      // Ordenar por fecha de modificación
      files.sort((a, b) => new Date(b.server_modified) - new Date(a.server_modified));
      const lastFile = files[0];
      console.log('✅ Archivo más reciente:', lastFile.name);
      return [{
        name: lastFile.name,
        path: lastFile.path_display || lastFile.path_lower
      }];
    }

    console.log('ℹ️ No se encontraron archivos en la carpeta');
    return [];
  } catch (error) {
    console.error('❌ Error en listFolderChanges:', error.message);
    throw error;
  }
}

// Exportar funciones de autenticación
const authUtils = {
  getAuthUrl,
  getAccessToken,
  refreshAccessToken,
  loadTokens
};

export { authUtils, listFolderChanges };
