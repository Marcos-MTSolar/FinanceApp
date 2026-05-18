/**
 * api/index.ts — Vercel Serverless Function Entry Point
 * ──────────────────────────────────────────────────────
 * A Vercel não executa processos long-running (app.listen).
 * Este arquivo exporta o Express app como um handler serverless,
 * que é o padrão exigido pelo runtime @vercel/node.
 *
 * O server.ts original continua funcionando para desenvolvimento local
 * via `npm run dev` (tsx server.ts → app.listen(3000)).
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Groq } from 'groq-sdk';
// @ts-ignore
import * as pdfParseModule from 'pdf-parse';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';
import multer from 'multer';
import { generatePdfStream } from '../serverReportGenerator';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB — mesmo limite exibido na UI
  },
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Firebase Admin (inicializa somente uma vez em warm lambdas) ──────────────
if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    console.warn('[api/index] Firebase Admin init failed:', e);
  }
}

// ── Middleware de autenticação Firebase ──────────────────────────────────────
const requireAuth = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split('Bearer ')[1];

  if (!admin.apps.length) {
    // Fallback: sem Firebase Admin configurado (dev sem FIREBASE_SERVICE_ACCOUNT_JSON)
    req.user = { uid: 'mock_dev_uid' };
    return next();
  }

  try {
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// ── Rate limiter de IA ───────────────────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Limite de requisições de IA atingido. Faça upgrade do plano.' },
});

// ── Express App ──────────────────────────────────────────────────────────────
const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://*'],
      connectSrc: ["'self'", 'https://*'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors());
// Limite de 10MB para payloads JSON (ex: histórico de mensagens grande)
app.use(express.json({ limit: '10mb' }));
// Limite de 10MB para form-urlencoded (necessário para req.body.textoBruto via FormData de texto)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rota: Relatório PDF ──────────────────────────────────────────────────────
app.post('/api/relatorio', requireAuth, async (req, res) => {
  try {
    const stream = await generatePdfStream(req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio.pdf');
    stream.pipe(res);
  } catch (err) {
    console.error('[/api/relatorio]', err);
    res.status(500).json({ error: 'Erro gerando relatório' });
  }
});

// ── Rota: Chat IA com SSE Streaming ─────────────────────────────────────────
app.post('/api/groq/chat', requireAuth, aiLimiter, async (req, res) => {
  const keyPresent = !!process.env.GROQ_API_KEY;
  console.log('[/api/groq/chat] GROQ_API_KEY presente:', keyPresent);
  if (!keyPresent) {
    return res.status(500).json({ error: 'GROQ_API_KEY não configurada no servidor.' });
  }

  const { messages, context = {} } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Nenhuma mensagem fornecida.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const systemPrompt = `Você é um consultor financeiro pessoal. O usuário tem score ${context.score ?? 'N/A'}, renda R$${context.renda ?? 0}, dívidas de R$${context.dividas ?? 0}, economias de R$${context.economias ?? 0}. Responda em português, de forma direta e prática. Seja objetivo e use formatação simples.`;

  try {
    const stream = await groq.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      model: 'llama3-8b-8192',
      temperature: 0.5,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[/api/groq/chat] ERRO:', error?.message);
    res.write(`data: ${JSON.stringify({ error: 'Erro no assistente IA: ' + (error instanceof Error ? error.message : String(error)) })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ── Rota: Classificar transações via IA ─────────────────────────────────────
app.post('/api/ia/classificar', requireAuth, aiLimiter, upload.single('file'), async (req: any, res: any) => {
  try {
    // Log diagnóstico — visível nos logs da Vercel
    console.log('[/api/ia/classificar] Chegou requisição:', {
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSizeKB: req.file ? Math.round(req.file.size / 1024) : 0,
      hasTextoBruto: !!req.body?.textoBruto,
      textoBrutoLen: req.body?.textoBruto?.length || 0,
      contentType: req.headers['content-type'],
    });

    let textoBruto: string = req.body?.textoBruto || '';
    let transacoes: any[] | null = null;

    // Tenta parsear transacoes se vier como string JSON no body
    if (req.body?.transacoes) {
      try { transacoes = JSON.parse(req.body.transacoes); } catch { /* ignora */ }
    }

    const fileBuffer = req.file?.buffer;
    if (fileBuffer) {
      const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
      console.log('[/api/ia/classificar] Processando arquivo .%s (%d KB)', ext, Math.round(fileBuffer.length / 1024));

      if (ext === 'pdf') {
        const pdfParse = (pdfParseModule as any).default || pdfParseModule;
        const data = await pdfParse(Buffer.from(fileBuffer));
        textoBruto = data.text || '';
        console.log('[/api/ia/classificar] PDF parseado: %d caracteres extraídos', textoBruto.length);
      } else if (['csv', 'ofx'].includes(ext)) {
        textoBruto = fileBuffer.toString('utf-8');
      } else if (['xlsx', 'xls'].includes(ext)) {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(fileBuffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        transacoes = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
      }
    }

    let prompt = `Você é um assistente financeiro especialista em análise de dados.`;

    if (textoBruto) {
      const textoLimitado = textoBruto.substring(0, 3000);
      prompt += `\nAbaixo está o texto extraído de um extrato ou nota fiscal. Extraia cada transação financeira e classifique-a.\nTexto:\n"""\n${textoLimitado}\n"""\n`;
    } else if (transacoes) {
      const transacoesLimitadas = JSON.stringify(transacoes.slice(0, 50));
      prompt += `\nAbaixo está uma lista de transações em JSON. Classifique-as e identifique recorrência e origem.\nTransações:\n${transacoesLimitadas}\n`;
    } else {
      return res.status(400).json({ error: 'Nenhum dado fornecido' });
    }

    prompt += `\nInstrução estrita:\nResponda APENAS com um JSON válido, sem texto adicional, sem markdown, sem explicações.\nO JSON deve conter obrigatoriamente um objeto com a chave "transacoes", cujo valor é uma lista/array de objetos.\nCada objeto DEVE conter:\n- descricao: nome legível\n- valor: número (positivo=receita, negativo=despesa)\n- data: formato YYYY-MM-DD\n- categoria: EXATAMENTE UMA destas: Alimentação, Transporte, Moradia, Saúde, Lazer, Assinatura, Investimento, Salário, Venda, Fornecedor, Imposto, Outros\n- tipo: "receita" ou "despesa"\n- recorrente: boolean\n\nFormato esperado: { "transacoes": [...] }`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const aiResponse = chatCompletion.choices[0]?.message?.content;
    if (aiResponse) {
      try {
        const parsed = JSON.parse(aiResponse);
        return res.json({ transacoes: parsed.transacoes || [] });
      } catch {
        return res.status(500).json({ error: 'Erro ao analisar a resposta da IA como JSON válido.' });
      }
    }
    return res.status(500).json({ error: 'Sem resposta da IA' });
  } catch (err: any) {
    console.error('[/api/ia/classificar]', err);
    res.status(500).json({ error: 'Erro na classificação via IA: ' + err.message });
  }
});

// ── Rota: Alertas Inteligentes ───────────────────────────────────────────────
app.post('/api/cron/alertas', async (req, res) => {
  try {
    const { transacoes = [], metas = [] } = req.body;
    const prompt = `Analise estas transações financeiras e gere de 1 a 3 alertas úteis e personalizados em português.\nTransações recentes: ${JSON.stringify(transacoes.slice(0, 20))}\nMetas ativas: ${JSON.stringify(metas.slice(0, 5))}\nResponda APENAS em JSON contendo um array de strings chamado 'alertas'.\nExemplo: { "alertas": ["Você gastou 40% a mais com alimentação essa semana.", "Risco de saldo negativo em 5 dias."] }`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const response = JSON.parse(chatCompletion.choices[0]?.message?.content || '{"alertas":[]}');
    res.json(response);
  } catch (error) {
    console.error('[/api/cron/alertas]', error);
    res.status(500).json({ error: 'Erro analisando alertas' });
  }
});

// ── Rota: Health check ───────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    groqKey: !!process.env.GROQ_API_KEY,
    firebaseAdmin: admin.apps.length > 0,
    timestamp: new Date().toISOString(),
  });
});

// ── Export para Vercel (sem app.listen) ─────────────────────────────────────
export default app;
