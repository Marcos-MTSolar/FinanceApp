import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';
// @ts-ignore
import * as pdfParseModule from 'pdf-parse';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';
import { generatePdfStream } from './serverReportGenerator';

dotenv.config();

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
  max: 20, 
  message: { error: 'Limite de requisições de IA atingido. Faça upgrade do plano.' }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

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
  app.post('/api/ia/classificar', requireAuth, aiLimiter, async (req, res) => {
    try {
      // payload pode ser um array de transações brutas ou um texto OCR/PDF
      const { transacoes, textoBruto } = req.body; 

      let prompt = `Você é um assistente financeiro especialista em análise de dados.`;
      
      if (textoBruto) {
        prompt += `
Abaixo está o texto extraído de um extrato ou nota fiscal. Extraia cada transação financeira e classifique-a.
Texto:
"""
${textoBruto.substring(0, 3000)} // limiter para evitar tokens excessivos
"""
`;
      } else if (transacoes) {
        prompt += `
Abaixo está uma lista de transações em JSON. Classifique-as e identifique recorrência e origem.
Transações:
${JSON.stringify(transacoes.slice(0, 50))} // limiter
`;
      } else {
        return res.status(400).json({ error: 'Nenhum dado fornecido' });
      }

      prompt += `
Instrução estrita:
Retorne APENAS um JSON válido contendo um objeto com a chave "transacoes", cujo valor é uma lista/array de objetos.
Cada objeto da lista DEVE conter:
- descricao: nome legível da transação
- valor: número (positivo para receita, negativo para despesa). Tente formatar corretamente baseado no texto.
- data: formato YYYY-MM-DD
- categoria: escolha EXATAMENTE UMA destas: Alimentação, Transporte, Moradia, Saúde, Lazer, Assinatura, Investimento, Salário, Venda, Fornecedor, Imposto, Outros
- tipo: "receita" ou "despesa"
- recorrente: boolean (true se parecer ser uma assinatura ou parcela recorrente)

Formato esperado: { "transacoes": [...] }
Não adicione markdown ou blocos de texto antes ou depois do JSON.`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3-8b-8192',
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const aiResponse = chatCompletion.choices[0]?.message?.content;
      if (aiResponse) {
        const parsed = JSON.parse(aiResponse);
        return res.json({ transacoes: parsed.transacoes || [] });
      } else {
        return res.status(500).json({ error: 'Sem resposta da IA' });
      }
    } catch (err: any) {
      console.error('Error classifying with Groq:', err);
      res.status(500).json({ error: 'Erro na classificação via IA' });
    }
  });

  // API Route for AI Chat Streaming
  app.post('/api/groq/chat', requireAuth, aiLimiter, async (req, res) => {
    const { messages, context } = req.body;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const systemPrompt = `Você é um consultor financeiro pessoal. O usuário tem score ${context.score || 'N/A'}, renda ${context.renda || 0}, dívidas de ${context.dividas || 0}, economias de ${context.economias || 0}. Responda em português, de forma direta e prática.`;

    try {
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
    } catch (error) {
      console.error('Chat error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`);
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
