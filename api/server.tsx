// Leitura robusta de arquivos usando libs dedicadas no Node.js

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import { Groq } from 'groq-sdk';
import PDFParser from 'pdf2json';
// pdf-parse import removido daqui para evitar problemas no serverless
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import admin, { type ServiceAccount } from 'firebase-admin';
import multer from 'multer';
import React from 'react';
import * as ReactPDF from '@react-pdf/renderer';
const { Document, Page, Text, View, StyleSheet } = ReactPDF as any;

declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken | { uid: string };
    }
  }
}

const pdfStyles = StyleSheet.create({
  page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 30 },
  header: { fontSize: 24, textAlign: 'center', marginBottom: 20, fontWeight: 'bold' },
  section: { margin: 10, padding: 10, flexGrow: 1 },
  title: { fontSize: 18, marginBottom: 10, fontWeight: 'bold', color: '#4f46e5' },
  text: { fontSize: 12, marginBottom: 5, color: '#333333' },
  alertItem: { fontSize: 12, marginBottom: 5, color: '#eab308' },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  card: { padding: 10, backgroundColor: '#f3f4f6', borderRadius: 5, width: '30%' },
});

const ReportPDF = ({ data }: { data: any }) => {
  const safeData = data || {};
  const metas = safeData.metas || [];
  const alertas = safeData.alertas || [];

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: pdfStyles.page },
      React.createElement(Text, { style: pdfStyles.header },
        'Relatório Inteligente - FinanceAI'),
      React.createElement(View, { style: pdfStyles.grid },
        React.createElement(View, { style: pdfStyles.card },
          React.createElement(Text, { style: { fontSize: 10, color: '#6b7280' } }, 'Total Receitas'),
          React.createElement(Text, { style: { fontSize: 14, color: '#10b981', fontWeight: 'bold' } },
            'R$ ' + (safeData.receitas || '0.00'))
        ),
        React.createElement(View, { style: pdfStyles.card },
          React.createElement(Text, { style: { fontSize: 10, color: '#6b7280' } }, 'Total Despesas'),
          React.createElement(Text, { style: { fontSize: 14, color: '#ef4444', fontWeight: 'bold' } },
            'R$ ' + (safeData.despesas || '0.00'))
        ),
        React.createElement(View, { style: pdfStyles.card },
          React.createElement(Text, { style: { fontSize: 10, color: '#6b7280' } }, 'Balanço do Mês'),
          React.createElement(Text, { style: { fontSize: 14, color: '#4f46e5', fontWeight: 'bold' } },
            'R$ ' + (safeData.balanco || '0.00'))
        )
      ),
      React.createElement(View, { style: pdfStyles.section },
        React.createElement(Text, { style: pdfStyles.title }, 'Metas Alcançadas'),
        ...(metas.length > 0
          ? metas.map((m: any, i: number) =>
              React.createElement(Text, { key: i, style: pdfStyles.text },
                '- ' + m.titulo + ': Concluido em ' + (m.concluidoEm || 'Breve'))
            )
          : [React.createElement(Text, { style: pdfStyles.text },
              'Nenhuma meta concluida neste periodo.')]
        )
      ),
      React.createElement(View, { style: pdfStyles.section },
        React.createElement(Text, { style: pdfStyles.title }, 'Alertas da IA'),
        ...(alertas.length > 0
          ? alertas.map((a: string, i: number) =>
              React.createElement(Text, { key: i, style: pdfStyles.alertItem },
                '* ' + a)
            )
          : [React.createElement(Text, { style: pdfStyles.text },
              'Tudo sob controle! Nenhum alerta grave.')]
        )
      ),
      React.createElement(Text,
        { style: { fontSize: 10, textAlign: 'center', marginTop: 20, color: '#9ca3af' } },
        'Gerado via FinanceAI Pro')
    )
  );
};

const generatePdfStream = async (data: any) => {
  try {
    const dados = data || {};

    console.log('[generatePdfStream] ReactPDF keys:',
      Object.keys(ReactPDF));

    const renderFn = (ReactPDF as any).renderToStream;
    if (!renderFn) {
      throw new Error(
        'renderToStream não encontrado. Keys: ' +
        Object.keys(ReactPDF).join(', ')
      );
    }

    const elemento = React.createElement(ReportPDF, {
      data: {
        receitas: dados.receitas ?? '0.00',
        despesas: dados.despesas ?? '0.00',
        balanco: dados.balanco ?? '0.00',
        metas: dados.metas ?? [],
        alertas: dados.alertas ?? []
      }
    });

    return await renderFn(elemento);
  } catch (err) {
    console.error('[generatePdfStream] Erro:', err);
    throw err;
  }
};


const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

console.log('GROQ KEY:', process.env.GROQ_API_KEY ? 'carregada' : 'AUSENTE');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('[Firebase Admin] Inicializado com sucesso.');
  } catch (e) {
    console.warn('[Firebase Admin] Falha ao inicializar:', e);
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
app.set('trust proxy', 1);
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
    if (!req.user?.uid) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }
    try {
      const data = req.body;
      console.log('[/api/relatorio] userId:', req.user?.uid);
      console.log('[/api/relatorio] body keys:', Object.keys(data));
      console.log('[/api/relatorio] ReactPDF exports:', Object.keys(ReactPDF));
      const stream = await generatePdfStream(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio-financeai.pdf"');
      stream.pipe(res);
    } catch (error) {
      console.error('[/api/relatorio] Erro:', error);
      return res.status(500).json({ 
        error: 'Falha ao gerar PDF', 
        detalhe: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // API Route for Diagnostic Score & Recommendations
  app.post('/api/diagnostico', requireAuth, aiLimiter, async (req, res) => {
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
          model: 'llama-3.1-8b-instant',
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
      } catch (aiError: any) {
        if (aiError?.status === 429) {
          return res.status(429).json({ error: 'Limite de requisições atingido. Aguarde alguns instantes e tente novamente.' });
        }
        console.error("Groq AI Engine error, using fallbacks:", aiError);
      }

      res.json({ score, recomendacoes });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro no servidor' });
    }
  });

  // API Route to parse PDF from a URL (e.g. Firebase Storage public URL)
  app.post('/api/parse-pdf', requireAuth, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL required' });

      const fetch = (await import('node-fetch')).default || globalThis.fetch;
      const pdfResponse = await fetch(url);
      const arrayBuffer = await pdfResponse.arrayBuffer();
      
      const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js');
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
            const textoExtraido = await new Promise<string>((resolve, reject) => {
              const pdfParser = new PDFParser(null, true);
              
              pdfParser.on('pdfParser_dataReady', () => {
                const texto = (pdfParser as any).getRawTextContent();
                resolve(texto);
              });
              
              pdfParser.on('pdfParser_dataError', (errData: any) => {
                reject(new Error(errData?.parserError || 'Erro no pdf2json'));
              });
              
              pdfParser.parseBuffer(fileBuffer);
            });

            console.log('[pdf2json] Chars extraídos:', textoExtraido.length);
            console.log('[pdf2json] Amostra:', textoExtraido.substring(0, 400));

            if (!textoExtraido || textoExtraido.trim().length < 50) {
              return res.status(400).json({ 
                error: 'PDF sem texto extraível. Tente converter para CSV.' 
              });
            }

            textoBruto = textoExtraido;

          } catch (pdfErr: any) {
            console.error('[pdf2json] Erro:', pdfErr.message);
            return res.status(400).json({ 
              error: 'Erro ao processar PDF: ' + pdfErr.message 
            });
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

      // Monta o texto de entrada para o LLM
      let textoExtraido = '';
      if (textoBruto) {
        console.log(`[Importação] textoBruto extraído. Tamanho original: ${textoBruto.length} caracteres.`);
        textoExtraido = textoBruto.substring(0, 8000);
        console.log(`[Importação] textoExtraido que será enviado à IA: ${textoExtraido.length} caracteres.`);
        
        console.log('=== AMOSTRA TEXTO PARA GROQ ===');
        console.log(textoExtraido.substring(0, 800));
        console.log('================================');

        const temPadraoExtrato = 
          textoExtraido.includes('Pix') || 
          textoExtraido.includes('PIX') ||
          textoExtraido.includes('Débito') ||
          textoExtraido.includes('Crédito') ||
          textoExtraido.includes('TED') ||
          textoExtraido.includes('Data') ||
          textoExtraido.includes('/202');

        console.log('[Validação] Tem padrão de extrato:', temPadraoExtrato);
        console.log('[Validação] Amostra do texto:', textoExtraido.substring(0, 300));

        if (!temPadraoExtrato) {
          return res.status(400).json({ 
            error: 'O arquivo não parece ser um extrato bancário válido.' 
          });
        }
      } else if (transacoes) {
        textoExtraido = JSON.stringify(transacoes.slice(0, 80));
      } else {
        return res.status(400).json({ error: 'Nenhum dado fornecido' });
      }

      const prompt = `
Você é um classificador de extratos bancários brasileiros.
Analise o texto abaixo extraído de um PDF de extrato bancário.

REGRA PRINCIPAL DE TIPO:
- Se o valor no texto aparecer com sinal NEGATIVO (ex: -48,90 ou -1.860,32) = DESPESA
- Se o valor no texto aparecer SEM sinal negativo ou com valor positivo = RECEITA
- Coluna "Débito" sempre = DESPESA (independente do sinal)
- Coluna "Crédito" sempre = RECEITA

EXEMPLOS DO EXTRATO SANTANDER INTERNET BANKING:
- "PIX ENVIADO Sandra Feliciano da Silva 000000 -60,00" → DESPESA, valor 60.00
- "PIX RECEBIDO MT SOLUCOES EM ENERGIA E 325197 3.000,00" → RECEITA, valor 3000.00
- "OPERACOES CREDITO IMOBILIARIO -1.860,32" → DESPESA, categoria Moradia, valor 1860.32
- "MENSALIDADE DE SEGURO TOKIO MARINE 000000 -283,77" → DESPESA, categoria Saúde
- "PAGAMENTO CONTA CELULAR VIVO-PE -49,00" → DESPESA, categoria Telecomunicações
- "PIX AGENDADO Condominio -220,00" → DESPESA, categoria Moradia
- "REMUNERACAO APLICACAO AUTOMATICA 0,01" → IGNORAR
- "IOF" → IGNORAR

REGRAS GERAIS:
1. IGNORE completamente: IOF, REMUNERACAO APLICACAO AUTOMATICA
2. PIX ENVIADO = sempre DESPESA
3. PIX RECEBIDO = sempre RECEITA  
4. TED RECEBIDA = sempre RECEITA
5. Data DD/MM/AAAA → converter para AAAA-MM-DD
6. Use valor absoluto (sem sinal negativo) no campo "valor"
7. Vírgula como decimal: 1.860,32 → 1860.32
8. Ponto como separador de milhar: 1.860,32 → 1860.32

CATEGORIAS para DESPESA:
- Transporte: Uber, 99 Food, posto, combustível, parking
- Alimentação: mercado, hortifruti, restaurante, padaria, lanchonete
- Moradia: condomínio, OPERACOES CREDITO IMOBILIARIO, aluguel
- Saúde: farmácia, médico, seguro saúde, TOKIO MARINE, plano de saúde
- Energia: Companhia Energetica, CELPE, NEOENERGIA, COPEL
- Telecomunicações: VIVO, Claro, TIM, OI, BRASIL REDES
- Serviços: ZOOP, PAGALEVE, DELTAPAG, contabilidade
- Pessoal: PIX ENVIADO para nome de pessoa física
- Outros: qualquer outro não classificado acima

CATEGORIAS para RECEITA:
- Receita Operacional: PIX RECEBIDO, TED RECEBIDA, transferência recebida
- Outros: qualquer outro crédito

Retorne SOMENTE JSON válido, sem markdown, sem explicação:

{
  "transacoes": [
    {
      "descricao": "descrição limpa sem números de documento",
      "valor": 60.00,
      "tipo": "despesa",
      "categoria": "Pessoal",
      "data": "2026-05-04"
    }
  ]
}

TEXTO DO EXTRATO:
${textoExtraido.substring(0, 8000)}
`;

      console.log('=== PROMPT ENVIADO AO GROQ (primeiros 1000 chars) ===');
      console.log(prompt.substring(0, 1000));
      console.log('=== FIM DO PROMPT ===');

      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',  // 70B para máxima precisão na classificação
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
      } catch (groqErr: any) {
        if (groqErr?.status === 429) {
          return res.status(429).json({ error: 'Limite de requisições atingido. Aguarde alguns instantes e tente novamente.' });
        }
        throw groqErr;
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

    // Limita o histórico a 10 mensagens para reduzir consumo de tokens
    const mensagensLimitadas = messages.slice(-10);

    // Define headers SSE imediatamente para garantir que o stream seja estabelecido
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let userData: any = {};
    let totalReceitas = 0;
    let totalDespesas = 0;
    let transacoes: any[] = [];
    let metas: any[] = [];
    let rendasExtras: any[] = [];
    let totalRendaExtra = 0;

    try {
      if (admin.apps.length && req.user?.uid) {
        const adminDb = admin.firestore();

        // 1. Buscar dados do usuário
        const userDoc = await adminDb.doc(`users/${req.user.uid}`).get();
        userData = userDoc.data() || {};

        // 2. Buscar transações do mês atual
        const agora = new Date();
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

        const transacoesSnap = await adminDb
          .collection(`transacoes/${req.user.uid}/items`)
          .where('data', '>=', inicioMes.toISOString().split('T')[0])
          .orderBy('data', 'desc')
          .limit(20)
          .get();

        transacoes = transacoesSnap.docs.map(d => d.data());
        const receitas = transacoes.filter(t => t.tipo === 'receita');
        const despesas = transacoes.filter(t => t.tipo === 'despesa');
        totalReceitas = receitas.reduce((s, t) => s + (Number(t.valor) || 0), 0);
        totalDespesas = despesas.reduce((s, t) => s + (Number(t.valor) || 0), 0);

        // 3. Buscar metas ativas
        const metasSnap = await adminDb
          .collection(`metas/${req.user.uid}/items`)
          .where('status', '==', 'ativa')
          .get();

        metas = metasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 4. Buscar rendas extras
        const rendaExtraSnap = await adminDb
          .collection(`rendaExtra/${req.user.uid}/items`)
          .where('data', '>=', inicioMes.toISOString().split('T')[0])
          .get();

        rendasExtras = rendaExtraSnap.docs.map(d => d.data());
        totalRendaExtra = rendasExtras.reduce((s, r) => s + Number(r.valor), 0);

        console.log('[Chat] Metas encontradas:', metas.length);
        console.log('[Chat] Dados das metas:', JSON.stringify(metas));
        console.log('[Chat] Metas no prompt:', metas.map(m => m.titulo));
        console.log('[Chat] Transações encontradas:', transacoes.length);
        console.log('[Chat] Receitas:', totalReceitas, '| Despesas:', totalDespesas);
      } else {
        // Fallback mock
        userData = { nome: 'Usuário Dev', nivel: 1, xp: 50, renda: 4500 };
        totalReceitas = 3000;
        totalDespesas = 1500;
        transacoes = [
          { data: '2026-05-18', tipo: 'receita', valor: 3000, descricao: 'Salário', categoria: 'Salário' },
          { data: '2026-05-19', tipo: 'despesa', valor: 1500, descricao: 'Aluguel', categoria: 'Moradia' }
        ];
        metas = [];
        rendasExtras = [];
        totalRendaExtra = 0;
      }
    } catch (dbErr) {
      console.error('[/api/groq/chat] Erro ao buscar dados do Firestore:', dbErr);
      userData = { nome: 'Usuário', nivel: 1, xp: 0, renda: 0 };
    }

    // Calcular gastos por categoria
    const gastosPorCategoria = transacoes
      .filter(t => t.tipo === 'despesa')
      .reduce((acc, t) => {
        const cat = t.categoria || 'Outros';
        acc[cat] = (acc[cat] || 0) + Number(t.valor);
        return acc;
      }, {} as Record<string, number>);

    const categoriaOrdenada = Object.entries(gastosPorCategoria)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .map(([cat, val]) => `${cat}: R$${(val as number).toFixed(2)}`)
      .join(', ');

    const systemPrompt = `
INSTRUÇÃO CRÍTICA: Responda em NO MÁXIMO 2 frases.
Sem listas. Sem títulos. Sem introduções.
Use os valores exatos dos dados fornecidos.
Se não tiver o dado, diga: "Não encontrei essa informação."

Você é um assistente financeiro do FinanceAI.
Use APENAS os dados abaixo para responder.

DADOS DO USUÁRIO:
- Receitas do mês: R$ ${totalReceitas.toFixed(2)}
- Despesas do mês: R$ ${totalDespesas.toFixed(2)}
- Saldo atual: R$ ${(totalReceitas - totalDespesas).toFixed(2)}
- Renda declarada: R$ ${userData.renda || 'não informada'}

RENDA EXTRA DO MÊS:
- Total: R$ ${totalRendaExtra.toFixed(2)}
- Fontes: ${rendasExtras.map(r => `${r.descricao} R$${r.valor}`).join(', ') || 'Nenhuma'}

GASTOS POR CATEGORIA ESTE MÊS:
${categoriaOrdenada || 'Nenhum gasto registrado'}

TRANSAÇÕES RECENTES:
${transacoes.slice(0, 8).map(t => {
  const data = t.data?.split('T')[0] || t.data;
  return `${data} ${t.tipo === 'receita' ? 'ENTRADA' : 'SAÍDA'} R$${t.valor} ${t.descricao} (${t.categoria})`;
}).join('\n') || 'Nenhuma transação registrada'}

METAS ATIVAS:
${metas.length > 0
  ? metas.map(m => {
      const falta = Number(m.valorAlvo) - Number(m.progressoAtual || 0);
      return `"${m.titulo}": meta R$${m.valorAlvo}, acumulado R$${m.progressoAtual || 0}, falta R$${falta.toFixed(2)}, prazo ${m.prazo || 'sem prazo'}`;
    }).join('\n')
  : 'Nenhuma meta cadastrada'}
`;

    console.log('=== SYSTEM PROMPT ENVIADO ===');
    console.log(systemPrompt.substring(0, 500));
    console.log('=============================');

    try {
      console.log("[/api/groq/chat] Iniciando chamada ao Groq com", mensagensLimitadas.length, "mensagens (limitado de", messages.length, ")");
      const stream = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...mensagensLimitadas
        ],
        temperature: 0.3,
        max_tokens: 150,  // limita a resposta a ~4 linhas
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
      });
      // Trata rate limit (429) com mensagem amigável
      if (error?.status === 429) {
        res.write(`data: ${JSON.stringify({ error: 'Limite de requisições atingido. Aguarde alguns instantes e tente novamente.' })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Erro no assistente IA: ' + (error instanceof Error ? error.message : String(error)) })}\n\n`);
      }
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
        model: 'llama-3.1-8b-instant',
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const aiResponse = chatCompletion.choices[0]?.message?.content || '{}';
      res.json(JSON.parse(aiResponse));
    } catch (err: any) {
      if (err?.status === 429) {
        return res.status(429).json({ error: 'Limite de requisições atingido. Aguarde alguns instantes e tente novamente.' });
      }
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
        model: 'llama-3.1-8b-instant',
        temperature: 0.5,
      });

      res.json({ explicacao: chatCompletion.choices[0]?.message?.content });
    } catch (error: any) {
      if (error?.status === 429) {
        return res.status(429).json({ error: 'Limite de requisições atingido. Aguarde alguns instantes e tente novamente.' });
      }
      console.error('Simulador error:', error);
      res.status(500).json({ error: 'Erro gerando explicação do simulador' });
    }
  });

  // API Route for Smart Corporate Alerts
  app.post('/api/empresa/alertas', requireAuth, aiLimiter, async (req, res) => {
    try {
      const {
        faturamentoMes,
        totalDespesas,
        totalFolha,
        saldoAtual,
        diasParaFimMes,
        totalImpostos,
        reservaTrabalhista,
        totalFuncionarios
      } = req.body;

      const prompt = `
Você é um consultor financeiro corporativo especialista em PMEs.
Analise os seguintes indicadores financeiros da empresa para o mês corrente:
- Faturamento do Mês: R$ ${faturamentoMes}
- Total Despesas do Mês: R$ ${totalDespesas}
- Total da Folha de Pagamento: R$ ${totalFolha}
- Saldo de Caixa Atual: R$ ${saldoAtual}
- Dias Restantes para o Fim do Mês: ${diasParaFimMes} dias
- Total de Impostos do Mês: R$ ${totalImpostos}
- Reserva Trabalhista Acumulada: R$ ${reservaTrabalhista}
- Total de Funcionários Cadastrados: ${totalFuncionarios} funcionários

Gere no máximo 5 alertas empresariais altamente direcionados com base nas seguintes análises de riscos:
1. Caixa negativo / Insolvência: se o saldo de caixa atual for insuficiente para cobrir o burn rate diário estimado (despesas/30) nos dias restantes.
2. Comprometimento da folha: se o total da folha for maior que 50% do faturamento do mês.
3. Insuficiência de reservas: se a reserva trabalhista for nula ou inferior a 5% da folha de pagamento total anualizada estimada.
4. Alta carga tributária: se os impostos representarem mais de 15% do faturamento bruto.
5. Capital de Giro vulnerável: se o saldo de caixa atual for inferior a 10% do faturamento mensal.

Retorne APENAS um objeto JSON com um array chamado 'alertas'. Cada item do array deve ter o formato exato:
{
  "tipo": "perigo" | "atencao" | "info",
  "titulo": "Título Curto do Alerta",
  "mensagem": "Texto explicativo curto com no máximo 2 frases."
}
Não adicione explicações, comentários ou markdown fora do JSON.
`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.4,
        response_format: { type: "json_object" },
      });

      const response = JSON.parse(chatCompletion.choices[0]?.message?.content || '{"alertas":[]}');
      res.json(response);
    } catch (error: any) {
      if (error?.status === 429) {
        return res.status(429).json({ error: 'Limite de requisições de IA atingido. Tente novamente mais tarde.' });
      }
      console.error('Corporate Alerts error:', error);
      res.status(500).json({ error: 'Erro gerando alertas inteligentes corporativos' });
    }
  });

  // Simulação de Cloud Function (Pode ser chamada via Cron Job)
  app.post('/api/cron/alertas', requireAuth, aiLimiter, async (req, res) => {
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
        model: 'llama-3.1-8b-instant',
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const response = JSON.parse(chatCompletion.choices[0]?.message?.content || '{"alertas":[]}');
      res.json(response);
    } catch (error: any) {
      if (error?.status === 429) {
        return res.status(429).json({ error: 'Limite de requisições atingido. Aguarde alguns instantes e tente novamente.' });
      }
      console.error('Alertas error:', error);
      res.status(500).json({ error: 'Erro analisando alertas' });
    }
  });

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
