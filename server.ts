// ─── Polyfills para APIs Web usadas pelo pdfjs-dist em ambiente Node/Serverless ───
if (typeof globalThis.DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix { constructor() {} };
}
if (typeof globalThis.DOMPoint === 'undefined') {
  (globalThis as any).DOMPoint = class DOMPoint { constructor() {} };
}
if (typeof globalThis.Path2D === 'undefined') {
  (globalThis as any).Path2D = class Path2D { constructor() {} };
}

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import { Groq } from 'groq-sdk';
// pdf-parse import removido daqui para evitar problemas no serverless
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';
import multer from 'multer';
import { generatePdfStream } from './serverReportGenerator';

declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken | { uid: string };
    }
  }
}

const upload = multer({ storage: multer.memoryStorage() });

console.log('GROQ KEY:', process.env.GROQ_API_KEY ? 'carregada' : 'AUSENTE');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.warn("Failed to initialize Firebase Admin", e);
  }
}

const requireAuth = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split('Bearer ')[1];
  
  if (!admin.apps.length) {
    req.user = { uid: 'mock_dev_uid' };
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200, 
  message: { error: 'Limite de requisições de IA atingido. Faça upgrade do plano.' }
});

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://*"],
        connectSrc: ["'self'", "https://*"],
      }
    } : false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors());
  app.use(express.json());

  // API Route for Relatório PDF
  app.post('/api/relatorio', requireAuth, async (req, res) => {
    try {
      const data = req.body;
      const stream = await generatePdfStream(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio.pdf');
      stream.pipe(res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro gerando relatorio' });
    }
  });

  // API Route for Diagnostic Score & Recommendations
  app.post('/api/diagnostico', async (req, res) => {
    try {
      const data = req.body;
      const { modo } = data;

      let score = 500; // Base score
      let promptContext = '';

      if (modo === 'pessoal') {
        const { rendaVenda, dividasValor, temReserva, poupancaMensal, objetivoDificuldade, usaCartao } = data;
        
        if (temReserva) score += 150;
        
        if (dividasValor > 0 && rendaVenda > 0) {
          const ratio = dividasValor / rendaVenda;
          if (ratio > 0.3) score -= 200;
          else score -= 50;
        }

        if (poupancaMensal > 0 && rendaVenda > 0) {
          const poupancaRatio = poupancaMensal / rendaVenda;
          if (poupancaRatio > 0.15) score += 120;
          else if (poupancaRatio > 0.05) score += 50;
        }

        promptContext = `Perfil Pessoal. Renda mensal: R$${rendaVenda}. Dívidas: R$${dividasValor}. Tem reserva: ${temReserva ? 'Sim' : 'Não'}. Quer poupar/mês: R$${poupancaMensal}. Objetivo: ${objetivoDificuldade}. Usa cartão com frequência: ${usaCartao ? 'Sim' : 'Não'}. Score calculado: ${score} (0-1000). Forneça 3 recomendações claras e curtas para melhorar as finanças, devolva apenas um JSON com um array de strings chamado 'recomendacoes' e nada mais.`;
      } else if (modo === 'empresarial') {
        const { faturamentoMensal, numFuncionarios, temCapitalGiro, dividasEmpresariais, margemLucroEstimada, maiorDificuldade, usaSistemaContabil } = data;

        if (margemLucroEstimada > 20) score += 150;
        if (dividasEmpresariais === 0) score += 100;
        else score -= 100;

        if (temCapitalGiro) score += 80;

        promptContext = `Perfil Empresarial. Faturamento: R$${faturamentoMensal}. Nº Funcionários: ${numFuncionarios}. Tem capital de giro: ${temCapitalGiro ? 'Sim' : 'Não'}. Dívidas empresariais: R$${dividasEmpresariais}. Margem lucro estimada: ${margemLucroEstimada}%. Maior dificuldade: ${maiorDificuldade}. Usa sistema contábil: ${usaSistemaContabil ? 'Sim' : 'Não'}. Score calculado: ${score} (0-1000). Forneça 3 recomendações organizacionais claras e curtas para melhorar o negócio, devolva apenas um JSON com um array de strings chamado 'recomendacoes' e nada mais.`;
      } else {
        return res.status(400).json({ error: 'Modo inválido' });
      }

      // Ensure score binds to 0-1000
      score = Math.max(0, Math.min(1000, score));

      // Call Groq AI for recommendations
      let recomendacoes = ["Organize seu orçamento.", "Corte gastos desnecessários.", "Invista em conhecimento."]; // fallbacks
      
      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: promptContext }],
          model: 'llama3-8b-8192',
          temperature: 0.5,
          response_format: { type: "json_object" },
        });

        const aiResponse = chatCompletion.choices[0]?.message?.content;
        if (aiResponse) {
          const parsed = JSON.parse(aiResponse);
          if (parsed.recomendacoes && Array.isArray(parsed.recomendacoes)) {
            recomendacoes = parsed.recomendacoes;
          }
        }
      } catch (aiError) {
        console.error("Groq AI Engine error, using fallbacks:", aiError);
      }

      res.json({ score, recomendacoes });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro no servidor' });
    }
  });

  // API Route to parse PDF from a URL (e.g. Firebase Storage public URL)
  app.post('/api/parse-pdf', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL required' });

      const fetch = (await import('node-fetch')).default || globalThis.fetch;
      const pdfResponse = await fetch(url);
      const arrayBuffer = await pdfResponse.arrayBuffer();
      
      // @ts-ignore
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const data = await pdfParse(Buffer.from(arrayBuffer));
      
      res.json({ text: data.text });
    } catch (err: any) {
      console.error('Error parsing PDF:', err);
      res.status(500).json({ error: 'Erro ao extrair PDF' });
    }
  });

  // API Route to classify transactions using Groq
  app.post('/api/ia/classificar', requireAuth, aiLimiter, upload.single('file'), async (req: any, res: any) => {
    console.log('BODY recebido:', JSON.stringify(req.body).slice(0, 200));
    console.log('GROQ KEY presente:', !!process.env.GROQ_API_KEY);
    try {
      let textoBruto = req.body.textoBruto || ''; 
      let transacoes = req.body.transacoes ? JSON.parse(req.body.transacoes) : null;
      
      const fileBuffer = req.file?.buffer;
      if (fileBuffer) {
        const ext = req.file.originalname.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') {
          try {
            const pdfParseModule = await import('pdf-parse');
            const pdfParse = (pdfParseModule as any).default || pdfParseModule;
            const data = await pdfParse(Buffer.from(fileBuffer));
            textoBruto = data.text;
          } catch (pdfErr: any) {
            console.warn('[pdf-parse] Falha ao parsear PDF, usando fallback de texto bruto:', pdfErr.message);
            textoBruto = fileBuffer.toString('latin1').replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
          }
        } else if (['csv', 'ofx'].includes(ext || '')) {
          textoBruto = fileBuffer.toString('utf-8');
        } else if (['xlsx', 'xls'].includes(ext || '')) {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(fileBuffer);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          transacoes = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        }
      }

      let prompt = `Você é um assistente financeiro especialista em análise de dados.`;
      
      if (textoBruto) {
        // Limita o texto ANTES de interpolar na string — evita enviar comentários acidentalmente ao LLM
        console.log(`[Importação] textoBruto extraído. Tamanho original: ${textoBruto.length} caracteres.`);
        const textoLimitado = textoBruto.substring(0, 3000);
        console.log(`[Importação] textoLimitado que será enviado à IA: ${textoLimitado.length} caracteres.`);
        prompt += `
Abaixo está o texto extraído de um extrato ou nota fiscal. Extraia cada transação financeira e classifique-a.
Texto:
"""
${textoLimitado}
"""
`;
      } else if (transacoes) {
        // Limita a lista de transações ANTES de interpolar
        const transacoesLimitadas = JSON.stringify(transacoes.slice(0, 50));
        prompt += `
Abaixo está uma lista de transações em JSON. Classifique-as e identifique recorrência e origem.
Transações:
${transacoesLimitadas}
`;
      } else {
        return res.status(400).json({ error: 'Nenhum dado fornecido' });
      }

      prompt += `
Instrução estrita:
Responda APENAS com um JSON válido, sem texto adicional, sem markdown, sem explicações.
O JSON deve conter obrigatoriamente um objeto com a chave "transacoes", cujo valor é uma lista/array de objetos.
Cada objeto da lista DEVE conter:
- descricao: nome legível da transação
- valor: número (positivo para receita, negativo para despesa). Formate como número.
- data: formato YYYY-MM-DD
- categoria: escolha EXATAMENTE UMA destas: Alimentação, Transporte, Moradia, Saúde, Lazer, Assinatura, Investimento, Salário, Venda, Fornecedor, Imposto, Outros
- tipo: "receita" ou "despesa"
- recorrente: boolean (true se parecer ser uma assinatura ou parcela recorrente)

Formato esperado: { "transacoes": [...] }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3-8b-8192',
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const aiResponse = chatCompletion.choices[0]?.message?.content;
      console.log('Resposta bruta do modelo Groq em /api/ia/classificar:', aiResponse);

      if (aiResponse) {
        try {
          const parsed = JSON.parse(aiResponse);
          return res.json({ transacoes: parsed.transacoes || [] });
        } catch (parseError) {
          console.error('Erro no JSON.parse da resposta do Groq:', parseError, 'Texto retornado:', aiResponse);
          return res.status(500).json({ error: 'Erro ao analisar a resposta da IA como JSON válido.' });
        }
      } else {
        return res.status(500).json({ error: 'Sem resposta da IA' });
      }
    } catch (err: any) {
      console.error('Error classifying with Groq in /api/ia/classificar:', err);
      res.status(500).json({ error: 'Erro na classificação via IA: ' + err.message });
    }
  });

  // API Route for AI Chat Streaming
  app.post('/api/groq/chat', requireAuth, aiLimiter, async (req, res) => {
    console.log('BODY recebido:', JSON.stringify(req.body).slice(0, 200));
    const keyPresent = !!process.env.GROQ_API_KEY;
    console.log("[/api/groq/chat] GROQ_API_KEY presente:", keyPresent);
    if (!keyPresent) {
      console.error("[/api/groq/chat] GROQ_API_KEY não encontrada. Verifique o arquivo .env.");
      return res.status(500).json({ error: 'GROQ_API_KEY não configurada no servidor.' });
    }

    const { messages, context = {} } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Nenhuma mensagem fornecida.' });
    }

    // Define headers SSE imediatamente para garantir que o stream seja estabelecido
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Desabilita buffering em proxies Nginx
    res.flushHeaders(); // Força envio dos headers ao cliente antes do stream começar

    const systemPrompt = `Você é um consultor financeiro pessoal. O usuário tem score ${context.score ?? 'N/A'}, renda R$${context.renda ?? 0}, dívidas de R$${context.dividas ?? 0}, economias de R$${context.economias ?? 0}. Responda em português, de forma direta e prática. Seja objetivo e use formatação simples.`;

    try {
      console.log("[/api/groq/chat] Iniciando chamada ao Groq com", messages?.length, "mensagens");
      const stream = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        model: 'llama3-8b-8192',
        temperature: 0.5,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error('[/api/groq/chat] ERRO COMPLETO:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        type: error?.type,
        name: error?.name,
        stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
      });
      // Headers SSE já foram enviados via flushHeaders(); usar write para comunicar erro ao cliente
      res.write(`data: ${JSON.stringify({ error: 'Erro no assistente IA: ' + (error instanceof Error ? error.message : String(error)) })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });

  // AI Suggest Goal
  app.post('/api/groq/sugerir-meta', requireAuth, aiLimiter, async (req, res) => {
    try {
      const { diagnostico } = req.body;
      const prompt = `Você é um consultor financeiro criativo. Baseado no perfil deste usuário (se houver diagnóstico: ${JSON.stringify(diagnostico)}), sugira UMA meta financeira curta e atingível (Ex: Quitar dívida com desconto, Guardar 10% do salário, Reduzir pedir delivery em 50%).
Formato OBRIGATÓRIO de saída (apenas JSON válido):
{ "titulo": "Nome Curto da Meta", "valorAlvo": 1500, "motivo": "frase motivacional" }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3-8b-8192',
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const aiResponse = chatCompletion.choices[0]?.message?.content || '{}';
      res.json(JSON.parse(aiResponse));
    } catch (err: any) {
      console.error('Error suggesting goal with Groq:', err);
      res.status(500).json({ error: 'Erro na sugestão de meta via IA' });
    }
  });

  // API Route for Simulator Explanation
  app.post('/api/groq/simulador', requireAuth, aiLimiter, async (req, res) => {
    try {
      const { scenario, variables, results } = req.body;
      const prompt = `Você é um consultor financeiro. O usuário está simulando: "${scenario}". 
Variáveis: ${JSON.stringify(variables)}. 
Resultados do cálculo: ${JSON.stringify(results)}.
Forneça uma explicação curta (máximo 3 parágrafos) sobre esse cenário, com dicas práticas de como atingir esse objetivo e os riscos envolvidos.`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3-8b-8192',
        temperature: 0.5,
      });

      res.json({ explicacao: chatCompletion.choices[0]?.message?.content });
    } catch (error) {
      console.error('Simulador error:', error);
      res.status(500).json({ error: 'Erro gerando explicação do simulador' });
    }
  });

  // Simulação de Cloud Function (Pode ser chamada via Cron Job)
  app.post('/api/cron/alertas', async (req, res) => {
    try {
      const { transacoes, userId, metas } = req.body;
      
      const prompt = `Analise as transações recentes e metas financeiras deste usuário.
Transações: ${JSON.stringify(transacoes.slice(0, 30))}
Metas: ${JSON.stringify(metas)}
Identifique anomalias como: gastos muito acima da média, novas assinaturas detectadas, risco de saldo negativo, ou metas próximas do prazo.
Gere DE 1 A 3 alertas inteligentes caso identifique algo importante, senão retorne vazio.
Responda APENAS em JSON contendo um array de strings chamado 'alertas'.
Exemplo: { "alertas": ["Você gastou 40% a mais com alimentação essa semana.", "Risco de saldo negativo em 5 dias."] }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3-8b-8192',
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const response = JSON.parse(chatCompletion.choices[0]?.message?.content || '{"alertas":[]}');
      res.json(response);
    } catch (error) {
      console.error('Alertas error:', error);
      res.status(500).json({ error: 'Erro analisando alertas' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    async function startDevServer() {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    }
    startDevServer();
  } else {
    // Para produção local rodando com Node (npm start)
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // API Proxy para Plataforma Antigravity
  app.post('/api/antigravity/action', requireAuth, aiLimiter, async (req, res) => {
    try {
      const payload = req.body;
      const apiUrl = process.env.ANTIGRAVITY_API_URL || 'https://api.antigravity.dev/v1';
      const apiKey = process.env.ANTIGRAVITY_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: 'Chave do Antigravity não configurada no servidor.' });
      }

      const requestPayload = { ...payload, firebaseUid: req.user?.uid };
      const fetch = (await import('node-fetch')).default || globalThis.fetch;
      
      const response = await fetch(`${apiUrl}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestPayload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status).json({ error: data.error || 'Erro na API Antigravity' });
      }
      res.json(data);
    } catch (err: any) {
      console.error('Erro no proxy Antigravity:', err);
      res.status(500).json({ error: 'Falha interna ao conectar com Antigravity' });
    }
  });

  // Global Error Handler para capturar 500s e retornar como JSON
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Erro interno:', err);
    res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  });

export default app;
