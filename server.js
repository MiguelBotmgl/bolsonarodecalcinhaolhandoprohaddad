const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const CREDENTIALS_FILE_PATH = './credentials.json';
const EXPIRATION_TIME_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
const VIP_SECTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for specific VIP pages

let credentials = {};
try {
  const rawCredentialsData = fs.readFileSync(CREDENTIALS_FILE_PATH, 'utf8');
  const parsedJson = JSON.parse(rawCredentialsData);
  for (const tipo in parsedJson) {
    if (Object.prototype.hasOwnProperty.call(parsedJson, tipo)) {
      const credEntry = parsedJson[tipo];
      if (Array.isArray(credEntry)) {
        credentials[tipo] = credEntry.filter(c => typeof c === 'object' && c !== null);
      } else if (typeof credEntry === 'object' && credEntry !== null && credEntry.username && credEntry.password) {
        credentials[tipo] = [credEntry];
      } else {
        console.warn(`[${new Date().toISOString()}] Formato inesperado para o tipo '${tipo}' no arquivo ${CREDENTIALS_FILE_PATH}. Inicializando como lista vazia.`);
        credentials[tipo] = [];
      }
    }
  }
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log(`[${new Date().toISOString()}] ${CREDENTIALS_FILE_PATH} não encontrado. Será criado um novo ao salvar credenciais.`);
  } else {
    console.error(`[${new Date().toISOString()}] Erro ao ler ou parsear o arquivo ${CREDENTIALS_FILE_PATH}:`, err);
  }
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'aK3$sP9!zQ7cTfG2@rX5vY8wZ1uJ0iH',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // Session cookie itself lasts 24 hours
  }
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function gerarCredencial(tipo) {
  const prefixoUser = "MGL" + tipo.charAt(0).toUpperCase() + tipo.slice(1);
  const sufixoUser = Math.floor(Math.random() * 90000 + 10000);
  const username = prefixoUser + sufixoUser;

  let senhaPrefixo;
  if (tipo === "pack") senhaPrefixo = "pk";
  else if (tipo === "casino") senhaPrefixo = "cs";
  else if (tipo === "bet") senhaPrefixo = "bt";
  else senhaPrefixo = "tmp";

  const letras = [...Array(2)].map(() => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
  const numeros = Math.floor(Math.random() * 900 + 100);
  const password = senhaPrefixo + letras + numeros;
  return { username, password };
}

async function sendTelegramMessageToAdmin(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn(`[${new Date().toISOString()}] Notificação para admin (Telegram) não configurada. TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID ausentes.`);
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' }),
    });
    const data = await response.json();
    if (data.ok) {
      console.log(`[${new Date().toISOString()}] Mensagem para admin (Telegram) enviada!`);
    } else {
      console.error(`[${new Date().toISOString()}] Erro ao enviar mensagem para admin (Telegram):`, data.description || JSON.stringify(data));
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erro ao conectar com a API do Telegram (admin):`, error.message);
  }
}

function saveCredentialsToFile() {
  try {
    fs.writeFileSync(CREDENTIALS_FILE_PATH, JSON.stringify(credentials, null, 2), 'utf8');
    console.log(`[${new Date().toISOString()}] Arquivo ${CREDENTIALS_FILE_PATH} atualizado.`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Erro ao salvar ${CREDENTIALS_FILE_PATH}:`, err);
  }
}

function cleanupExpiredCredentials() {
  let changed = false;
  const now = Date.now();
  console.log(`[${new Date().toISOString()}] Executando limpeza periódica de credenciais...`);

  for (const tipo in credentials) {
    const credenciaisDoTipo = credentials[tipo];
    if (Array.isArray(credenciaisDoTipo)) {
      for (let i = credenciaisDoTipo.length - 1; i >= 0; i--) {
        const cred = credenciaisDoTipo[i];
        if (cred && typeof cred === 'object' && cred.createdAt) {
          if (now - cred.createdAt > EXPIRATION_TIME_MS) {
            console.log(`[${new Date().toISOString()}] Credencial expirada para tipo '${tipo}' (usuário: ${cred.username}) removida pela limpeza periódica.`);
            credenciaisDoTipo.splice(i, 1);
            changed = true;
          }
        }
      }
    }
  }
  if (changed) {
    saveCredentialsToFile();
  }
}

app.get('/', (req, res) => {
  res.redirect('/site_vip/index.html');
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/pagamento.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pagamento.html'));
});

app.get('/confirmado.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'confirmado.html'));
});

app.get('/cancelamento.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cancelamento.html'));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  let tipoLogado = null;
  let credencialEncontrada = null;
  let credencialTentadaExpirou = false;

  console.log(`[${new Date().toISOString()}] Tentativa de login para usuário: ${username}. SessionID: ${req.sessionID}`);

  for (const tipo in credentials) {
    const credenciaisDoTipo = credentials[tipo];
    if (Array.isArray(credenciaisDoTipo)) {
      for (let i = 0; i < credenciaisDoTipo.length; i++) {
        const cred = credenciaisDoTipo[i];
        if (cred && typeof cred === 'object' && cred.username && cred.password) {
          const isCurrentAttempt = (cred.username === username);
          if (cred.createdAt) {
            if (Date.now() - cred.createdAt > EXPIRATION_TIME_MS) {
              console.log(`[${new Date().toISOString()}] Credencial expirada (12h) encontrada durante login para tipo '${tipo}' (usuário: ${cred.username}). Removendo. SessionID: ${req.sessionID}`);
              credenciaisDoTipo.splice(i, 1);
              i--;
              saveCredentialsToFile();
              if (isCurrentAttempt && cred.password === password) {
                credencialTentadaExpirou = true;
              }
              continue;
            }
          }
          if (cred.username === username && cred.password === password) {
            tipoLogado = tipo;
            credencialEncontrada = cred;
            break;
          }
        }
      }
    }
    if (credencialEncontrada) {
      break;
    }
  }

  if (credencialTentadaExpirou && !credencialEncontrada) {
    console.log(`[${new Date().toISOString()}] Falha no login para usuário: ${username}. Credencial expirada (12h) e removida. SessionID: ${req.sessionID}`);
    return res.json({ success: false, message: 'Credencial expirada. Por favor, gere uma nova.' });
  }

  if (tipoLogado && credencialEncontrada) {
    req.session.loggedIn = true;
    req.session.userType = tipoLogado;
    req.session.username = credencialEncontrada.username;
    delete req.session.vipSectionEntryTimestamp; // Clear VIP timer on new login

    let redirectPath;
    // CERTIFIQUE-SE QUE OS CAMINHOS DE REDIRECIONAMENTO SÃO ABSOLUTOS (começam com /)
    if (tipoLogado === "packvip" || tipoLogado === "pack") {
      redirectPath = "/packvip-page.html";
    } else if (tipoLogado === "casino") {
      redirectPath = "/casino-page.html";
    } else if (tipoLogado === "bet") {
      redirectPath = "/bet-page.html";
    } else if (tipoLogado === "temp") {
      redirectPath = "/generic-dashboard.html";
    } else {
      console.warn(`[${new Date().toISOString()}] Tipo de login '${tipoLogado}' não tem redirecionamento específico. Usando dashboard genérico. SessionID: ${req.sessionID}`);
      redirectPath = "/generic-dashboard.html";
    }
    console.log(`[${new Date().toISOString()}] Login bem-sucedido para usuário: ${username}, tipo: ${tipoLogado}, redirecionando para: ${redirectPath}. SessionID: ${req.sessionID}`);
    res.json({ success: true, redirect: redirectPath });
  } else {
    console.log(`[${new Date().toISOString()}] Falha no login para usuário: ${username}. Usuário ou senha incorretos. SessionID: ${req.sessionID}`);
    res.json({ success: false, message: 'Usuário ou senha incorretos.' });
  }
});

app.post('/confirm-payment', async (req, res) => {
  const { name, phone, product } = req.body;

  if (!name || !phone || !product) {
    return res.status(400).json({ success: false, message: 'Nome, telefone e produto são obrigatórios.' });
  }

  let tipoCredencialParaGerar;
  const upperProduct = product.toUpperCase();

  if (upperProduct.includes('PACK') || (upperProduct.includes('CASINOBOT') && upperProduct.includes('SPORTINGBOT'))) {
    tipoCredencialParaGerar = 'pack';
  } else if (upperProduct.includes('CASINOBOT')) {
    tipoCredencialParaGerar = 'casino';
  } else if (upperProduct.includes('SPORTINGBOT')) {
    tipoCredencialParaGerar = 'bet';
  } else {
    console.warn(`[${new Date().toISOString()}] Produto '${product}' não mapeado para um tipo de credencial conhecido (pack, casino, bet). Usando 'temp'.`);
    tipoCredencialParaGerar = 'temp';
  }

  const newCredentialBase = gerarCredencial(tipoCredencialParaGerar);
  const newCredential = {
    ...newCredentialBase,
    createdAt: Date.now()
  };

  if (!credentials[tipoCredencialParaGerar] || !Array.isArray(credentials[tipoCredencialParaGerar])) {
    credentials[tipoCredencialParaGerar] = [];
  }
  credentials[tipoCredencialParaGerar].push(newCredential);

  saveCredentialsToFile();
  console.log(`[${new Date().toISOString()}] Credencial para tipo '${tipoCredencialParaGerar}' (usuário: ${newCredential.username}) adicionada à lista em ${CREDENTIALS_FILE_PATH} com timestamp de criação.`);

  const telegramAdminMessage = `
  Nova Venda Confirmada! 🎉
  Produto: ${product}
  Nome: ${name}
  Telefone: ${phone}
  ---
  Credencial Gerada (válida por 12 horas):
  Usuário: \`${newCredential.username}\`
  Senha: \`${newCredential.password}\`
  (Tipo interno: ${tipoCredencialParaGerar})
  `;
  await sendTelegramMessageToAdmin(telegramAdminMessage);

  res.json({ success: true, message: 'Pagamento confirmado, credenciais geradas (válidas por 12 horas) e informações enviadas!' });
});

// Middleware de autenticação com logging detalhado
function isAuthenticated(req, res, next) {
  console.log(`[${new Date().toISOString()}] isAuthenticated CALLED for path: ${req.path}. SessionID: ${req.sessionID}, LoggedIn: ${req.session ? req.session.loggedIn : 'N/A'}, User: ${req.session ? req.session.username : 'N/A'}`);
  if (req.session && req.session.loggedIn && req.session.username && req.session.userType) {
    const userCredentialsForType = credentials[req.session.userType];
    let isValidSessionCredential = false;

    if (Array.isArray(userCredentialsForType)) {
      const activeCredential = userCredentialsForType.find(cred => cred.username === req.session.username);
      if (activeCredential) {
        if (activeCredential.createdAt && (Date.now() - activeCredential.createdAt > EXPIRATION_TIME_MS)) {
          console.log(`[${new Date().toISOString()}] isAuthenticated: Usuário ${req.session.username} (tipo ${req.session.userType}) - credencial na sessão expirou (12h). Deslogando. SessionID: ${req.sessionID}`);
          isValidSessionCredential = false;
        } else {
          isValidSessionCredential = true;
          console.log(`[${new Date().toISOString()}] isAuthenticated: Usuário ${req.session.username} AUTENTICADO E VÁLIDO. SessionID: ${req.sessionID}`);
        }
      } else {
        console.log(`[${new Date().toISOString()}] isAuthenticated: Usuário ${req.session.username} (tipo ${req.session.userType}) - credencial NÃO ENCONTRADA na lista de credenciais ativas. Deslogando. SessionID: ${req.sessionID}`);
        isValidSessionCredential = false;
      }
    } else {
      console.log(`[${new Date().toISOString()}] isAuthenticated: Usuário ${req.session.username} (tipo ${req.session.userType}) - NENHUMA lista de credenciais encontrada para o tipo. Deslogando. SessionID: ${req.sessionID}`);
      isValidSessionCredential = false;
    }

    if (isValidSessionCredential) {
      return next();
    } else {
      const originalUser = req.session.username;
      const originalType = req.session.userType;
      req.session.destroy(err => {
        if (err) console.error(`[${new Date().toISOString()}] Erro ao destruir sessão durante verificação isAuthenticated para ${originalUser} (tipo ${originalType}):`, err);
        res.clearCookie('connect.sid');
        if (!res.headersSent) {
          console.log(`[${new Date().toISOString()}] isAuthenticated: Redirecionando usuário ${originalUser} para login (sessão invalidada). SessionID: ${req.sessionID}`);
          res.redirect('/login.html?message=session_invalidated_DEBUG');
        }
      });
    }
  } else {
    console.log(`[${new Date().toISOString()}] isAuthenticated: Sessão AUSENTE ou NÃO logada. Redirecionando para login. Path: ${req.path}. SessionID: ${req.sessionID}`);
    if (!res.headersSent) {
      res.redirect('/login.html?message=not_logged_in_DEBUG');
    }
  }
}

// Helper function for VIP Section Access Control
function handleVipSectionAccess(req, res, pagePath) {
  const now = Date.now();
  console.log(`[${new Date().toISOString()}] handleVipSectionAccess para ${req.session.username}, Path: ${pagePath}. SessionID: ${req.sessionID}. VIP Timestamp: ${req.session.vipSectionEntryTimestamp}`);

  if (!req.session.vipSectionEntryTimestamp) {
    req.session.vipSectionEntryTimestamp = now;
    console.log(`[${new Date().toISOString()}] Usuário ${req.session.username} entrou na seção VIP. Timer de ${VIP_SECTION_TIMEOUT_MS / 60000}min iniciado. SessionID: ${req.sessionID}. Timestamp: ${req.session.vipSectionEntryTimestamp}`);
  }

  if (now - req.session.vipSectionEntryTimestamp > VIP_SECTION_TIMEOUT_MS) {
    console.log(`[${new Date().toISOString()}] Sessão VIP para ${req.session.username} (tipo ${req.session.userType}) expirou (mais de ${VIP_SECTION_TIMEOUT_MS / 60000} minutos). Deslogando. SessionID: ${req.sessionID}`);
    const originalUser = req.session.username;
    req.session.destroy(err => {
      if (err) {
        console.error(`[${new Date().toISOString()}] Erro ao destruir sessão por timeout VIP para ${originalUser}:`, err);
        if (!res.headersSent) {
          return res.status(500).send("Erro ao fazer logout devido à expiração da sessão VIP.");
        }
        return;
      }
      res.clearCookie('connect.sid');
      if (!res.headersSent) {
        console.log(`[${new Date().toISOString()}] handleVipSectionAccess: Redirecionando usuário ${originalUser} para login (sessão VIP expirada). SessionID: ${req.sessionID}`);
        res.redirect('/login.html?message=vip_session_expired_DEBUG');
      }
    });
  } else {
    if (!res.headersSent) {
      console.log(`[${new Date().toISOString()}] handleVipSectionAccess: Servindo página ${pagePath} para ${req.session.username}. SessionID: ${req.sessionID}`);
      res.sendFile(pagePath);
    }
  }
}

const protectedPagesPath = path.join(__dirname, 'protected_pages');

// Adicionando logging detalhado para a rota /casino-page.html como exemplo
app.get('/casino-page.html',
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] REQ para /casino-page.html. SessionID: ${req.sessionID}. User: ${req.session ? req.session.username : 'N/A'} - ANTES de isAuthenticated.`);
    next();
  },
  isAuthenticated,
  (req, res) => {
    console.log(`[${new Date().toISOString()}] REQ para /casino-page.html. SessionID: ${req.sessionID}. User: ${req.session ? req.session.username : 'N/A'} - DEPOIS de isAuthenticated, antes de handleVipSectionAccess.`);
    const pagePath = path.join(protectedPagesPath, 'casino-page.html');
    handleVipSectionAccess(req, res, pagePath);
  }
);

app.get('/packvip-page.html', isAuthenticated, (req, res) => {
  // Para depuração completa, adicione logs como no /casino-page.html aqui também
  console.log(`[${new Date().toISOString()}] REQ para /packvip-page.html (simplificado). User: ${req.session ? req.session.username : 'N/A'}`);
  const pagePath = path.join(protectedPagesPath, 'packvip-page.html');
  handleVipSectionAccess(req, res, pagePath);
});

app.get('/bet-page.html', isAuthenticated, (req, res) => {
  // Para depuração completa, adicione logs como no /casino-page.html aqui também
  console.log(`[${new Date().toISOString()}] REQ para /bet-page.html (simplificado). User: ${req.session ? req.session.username : 'N/A'}`);
  const pagePath = path.join(protectedPagesPath, 'bet-page.html');
  handleVipSectionAccess(req, res, pagePath);
});

app.get('/generic-dashboard.html', isAuthenticated, (req, res) => {
  console.log(`[${new Date().toISOString()}] REQ para /generic-dashboard.html. User: ${req.session ? req.session.username : 'N/A'}`);
  res.sendFile(path.join(protectedPagesPath, 'generic-dashboard.html'));
});

app.get('/logout', (req, res) => {
  const originalUser = req.session ? req.session.username : 'Usuário desconhecido';
  const sessionID = req.sessionID;
  console.log(`[${new Date().toISOString()}] Tentativa de logout para usuário: ${originalUser}. SessionID: ${sessionID}`);
  req.session.destroy(err => {
    if (err) {
      console.error(`[${new Date().toISOString()}] Erro ao destruir sessão no logout para ${originalUser}:`, err);
      if (!res.headersSent) {
        return res.status(500).send("Erro ao fazer logout.");
      }
      return;
    }
    res.clearCookie('connect.sid');
    if (!res.headersSent) {
      console.log(`[${new Date().toISOString()}] Logout bem-sucedido para ${originalUser}. Redirecionando. SessionID: ${sessionID}`);
      res.redirect('/login.html?message=logout_successful');
    }
  });
});

app.use((req, res, next) => {
  const filePath = path.join(__dirname, 'public', '404.html');
  console.log(`[${new Date().toISOString()}] Rota não encontrada: ${req.path}. Tentando servir 404.html.`);
  if (fs.existsSync(filePath)) {
    if (!res.headersSent) {
      res.status(404).sendFile(filePath);
    }
  } else {
    if (!res.headersSent) {
      res.status(404).send("Página não encontrada e arquivo 404.html ausente.");
    }
  }
});

app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Erro não tratado: Path: ${req.path}`, err.stack);
  const filePath = path.join(__dirname, 'public', '500.html');
  if (fs.existsSync(filePath)) {
    if (!res.headersSent) {
      res.status(500).sendFile(filePath);
    }
  } else {
    if (!res.headersSent) {
      res.status(500).send("Erro interno do servidor e arquivo 500.html ausente.");
    }
  }
});

cleanupExpiredCredentials();
setInterval(cleanupExpiredCredentials, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Servidor rodando na porta ${PORT} - http://localhost:${PORT}`);
  console.warn(`[${new Date().toISOString()}] ATENÇÃO: Usando MemoryStore para sessões. Não recomendado para produção!`);
  console.log(`[${new Date().toISOString()}] Credenciais temporárias (12h) expirarão após ${EXPIRATION_TIME_MS / (60 * 60 * 1000)} horas.`);
  console.log(`[${new Date().toISOString()}] Sessão em páginas VIP específicas expirará após ${VIP_SECTION_TIMEOUT_MS / (60 * 1000)} minutos de entrada na seção.`);
  console.log(`[${new Date().toISOString()}] Limpeza periódica de credenciais configurada para rodar a cada hora.`);
});