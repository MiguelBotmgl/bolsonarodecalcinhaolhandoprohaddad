const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const session = require('express-session');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const CREDENTIALS_FILE_PATH = './credentials.json';
const EXPIRATION_TIME_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
const VIP_SECTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for specific VIP pages

let credentials = {};
try {
  const rawCredentialsData = fs.readFileSync(CREDENTIALS_FILE_PATH, 'utf8'); //
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
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));


// --- NODEMAILER TRANSPORTER SETUP ---
let transporter;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });
  console.log(`[${new Date().toISOString()}] Nodemailer transporter configurado.`);
} else {
  console.warn(`[${new Date().toISOString()}] ATENÇÃO: SMTP_HOST, SMTP_USER, ou SMTP_PASS não configurados no .env. O envio de email estará desabilitado.`);
}

async function sendVipInfoEmail(name, email) {
  if (!transporter) {
    console.warn(`[${new Date().toISOString()}] Nodemailer não configurado. Pulando envio de email para ${email}.`);
    return;
  }

  const mailOptions = {
    from: process.env.SMTP_FROM_EMAIL || `"MGL Bots" <noreply@example.com>`,
    to: email,
    subject: '✨ Informações Especiais do Grupo VIP MGL Bots! ✨',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
          <h2 style="color: #5a0081; text-align: center;">Olá ${name},</h2>
          <p style="font-size: 16px;">Agradecemos por seu interesse e por se registrar para acessar nosso conteúdo gratuito!</p>
          <p style="font-size: 16px;">Quer elevar sua experiência e resultados a um novo patamar? Nosso <strong>Grupo VIP MGL Bots</strong> oferece vantagens exclusivas que farão toda a diferença:</p>
          <ul style="font-size: 16px; list-style-type: disc; padding-left: 20px;">
            <li>🤖 Sinais e palpites premium com maior assertividade.</li>
            <li>🚀 Acesso antecipado a novas funcionalidades e bots.</li>
            <li>💎 Conteúdo exclusivo e estratégias avançadas.</li>
            <li>🤝 Suporte prioritário e personalizado.</li>
            <li>📈 Comunidade VIP para networking e troca de experiências.</li>
          </ul>
          <p style="font-size: 16px;">Não perca a oportunidade de se juntar à elite e maximizar seus ganhos!</p>
          <p style="text-align: center; margin-top: 30px;">
            <a href="https://mglbots.online" style="background-color: #00c67c; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold;">Quero Ser VIP Agora!</a>
          </p>
          <p style="font-size: 14px; color: #555; margin-top: 30px;">Atenciosamente,<br>Equipe MGL Bots</p>
        </div>
      </div>
    `
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log(`[${new Date().toISOString()}] Email com informações VIP enviado para ${email}: ${info.messageId}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erro ao enviar email com informações VIP para ${email}:`, error);
  }
}
// --- END OF NODEMAILER ---


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
    const response = await fetch(url, { // Uso global de fetch, não precisa de import específico
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
        if (cred && typeof cred === 'object' && cred.createdAt) { // Verifica se createdAt existe
          if (now - cred.createdAt > EXPIRATION_TIME_MS) {
            console.log(`[${new Date().toISOString()}] Credencial expirada para tipo '${tipo}' (usuário: ${cred.username}) removida pela limpeza periódica.`);
            credenciaisDoTipo.splice(i, 1);
            changed = true;
          }
        } else if (cred && typeof cred === 'object' && !cred.createdAt) {
          // Adiciona createdAt se não existir, para credenciais antigas sem ele
          // Isso ajuda a evitar que credenciais sem createdAt sejam consideradas sempre válidas
          console.log(`[${new Date().toISOString()}] Adicionando createdAt para credencial antiga (usuário: ${cred.username}, tipo: ${tipo}).`);
          cred.createdAt = now; // Ou um valor que as torne elegíveis para expiração em breve
          changed = true;
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
  res.sendFile(path.join(__dirname, 'public', 'login.html')); //
});

app.get('/pagamento.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pagamento.html')); //
});

app.get('/confirmado.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'confirmado.html')); //
});

app.get('/cancelamento.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cancelamento.html')); //
});


// --- ENDPOINT for Free Group Registration ---
app.post('/api/register-free-group', async (req, res) => {
  const { name, email, groupName } = req.body;

  if (!name || !email || !groupName) {
    return res.status(400).json({ success: false, message: 'Nome, email e nome do grupo são obrigatórios.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Formato de email inválido.' });
  }

  console.log(`[${new Date().toISOString()}] Novo registro para grupo free: ${groupName}. Nome: ${name}, Email: ${email}`);
  await sendVipInfoEmail(name, email);

  const telegramAdminMessage = `
  📝 Novo Registro para Grupo Free!
  👥 Grupo: ${groupName}
  👤 Nome: ${name}
  📧 Email: ${email}
  `;
  await sendTelegramMessageToAdmin(telegramAdminMessage);

  res.json({ success: true, message: 'Registro efetuado com sucesso! Você receberá um email com mais informações sobre nossos planos VIP em breve.' });
});
// --- END OF NEW ENDPOINT ---


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
          } else { // Se não tem createdAt, é uma credencial antiga, considera-a não expirada por agora, mas loga
            console.warn(`[${new Date().toISOString()}] Credencial sem createdAt encontrada para usuário: ${cred.username}, tipo: ${tipo}. Considere adicionar createdAt ao gerar.`);
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
    delete req.session.vipSectionEntryTimestamp;

    let redirectPath;
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

// VERSÃO CORRIGIDA DE /confirm-payment
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
    createdAt: Date.now() // Adiciona createdAt ao gerar nova credencial
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

  // LOGAR O USUÁRIO AUTOMATICAMENTE E DEFINIR REDIRECIONAMENTO
  req.session.loggedIn = true;
  req.session.userType = tipoCredencialParaGerar;
  req.session.username = newCredential.username;
  delete req.session.vipSectionEntryTimestamp;

  let redirectPath;
  if (tipoCredencialParaGerar === "packvip" || tipoCredencialParaGerar === "pack") {
    redirectPath = "/packvip-page.html";
  } else if (tipoCredencialParaGerar === "casino") {
    redirectPath = "/casino-page.html";
  } else if (tipoCredencialParaGerar === "bet") {
    redirectPath = "/bet-page.html";
  } else if (tipoCredencialParaGerar === "temp") {
    redirectPath = "/generic-dashboard.html"; // Certifique-se que está em protected_pages
  } else {
    console.warn(`[${new Date().toISOString()}] Tipo de credencial gerada '${tipoCredencialParaGerar}' não tem redirecionamento específico após pagamento. Usando dashboard genérico. SessionID: ${req.sessionID}`);
    redirectPath = "/generic-dashboard.html"; // Certifique-se que está em protected_pages
  }
  console.log(`[${new Date().toISOString()}] Pagamento confirmado para usuário: ${newCredential.username}, tipo: ${tipoCredencialParaGerar}, redirecionando para: ${redirectPath}. SessionID: ${req.sessionID}`);

  res.json({
    success: true,
    message: 'Pagamento confirmado, credenciais geradas e acesso liberado!',
    username: newCredential.username,
    password: newCredential.password,
    redirect: redirectPath
  });
});


// --- Middleware de autenticação e rotas protegidas ---
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
        if (!res.headersSent) { return res.status(500).send("Erro ao fazer logout devido à expiração da sessão VIP."); }
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

app.get('/casino-page.html', isAuthenticated, (req, res) => {
  const pagePath = path.join(protectedPagesPath, 'casino-page.html'); //
  handleVipSectionAccess(req, res, pagePath);
});

app.get('/packvip-page.html', isAuthenticated, (req, res) => {
  const pagePath = path.join(protectedPagesPath, 'packvip-page.html'); //
  handleVipSectionAccess(req, res, pagePath);
});

app.get('/bet-page.html', isAuthenticated, (req, res) => {
  const pagePath = path.join(protectedPagesPath, 'bet-page.html'); //
  handleVipSectionAccess(req, res, pagePath);
});

app.get('/generic-dashboard.html', isAuthenticated, (req, res) => {
  console.log(`[${new Date().toISOString()}] Acessando rota protegida /generic-dashboard.html para usuário ${req.session.username}. Tentando servir de ${protectedPagesPath}`);
  const pagePath = path.join(protectedPagesPath, 'generic-dashboard.html');
  // Removido handleVipSectionAccess se esta página não tiver o timer específico de 5 min
  res.sendFile(pagePath);
});

app.get('/logout', (req, res) => {
  const originalUser = req.session ? req.session.username : 'Usuário desconhecido';
  const sessionID = req.sessionID;
  console.log(`[${new Date().toISOString()}] Tentativa de logout para usuário: ${originalUser}. SessionID: ${sessionID}`);
  req.session.destroy(err => {
    if (err) {
      console.error(`[${new Date().toISOString()}] Erro ao destruir sessão no logout para ${originalUser}:`, err);
      if (!res.headersSent) { return res.status(500).send("Erro ao fazer logout."); }
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
    if (!res.headersSent) { res.status(404).sendFile(filePath); }
  } else {
    if (!res.headersSent) { res.status(404).send("Página não encontrada e arquivo 404.html ausente."); }
  }
});

app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Erro não tratado: Path: ${req.path}`, err.stack);
  const filePath = path.join(__dirname, 'public', '500.html');
  if (fs.existsSync(filePath)) {
    if (!res.headersSent) { res.status(500).sendFile(filePath); }
  } else {
    if (!res.headersSent) { res.status(500).send("Erro interno do servidor e arquivo 500.html ausente."); }
  }
});

cleanupExpiredCredentials();
setInterval(cleanupExpiredCredentials, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Servidor rodando na porta ${PORT} - http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[${new Date().toISOString()}] ATENÇÃO: Usando MemoryStore para sessões (padrão). Não recomendado para produção!`);
  }
  console.log(`[${new Date().toISOString()}] Credenciais temporárias (12h) expirarão após ${EXPIRATION_TIME_MS / (60 * 60 * 1000)} horas.`);
  console.log(`[${new Date().toISOString()}] Sessão em páginas VIP específicas expirará após ${VIP_SECTION_TIMEOUT_MS / (60 * 1000)} minutos de entrada na seção (se handleVipSectionAccess for usado).`);
  console.log(`[${new Date().toISOString()}] Limpeza periódica de credenciais configurada para rodar a cada hora.`);
});