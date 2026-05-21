# RESUMO MESTRE: Projeto AppFinance

Este documento é a fonte única de verdade (Single Source of Truth) para o projeto **AppFinance**. Ele sintetiza a arquitetura do sistema, regras de negócio, banco de dados, stack tecnológica, integração com APIs e o fluxo completo de desenvolvimento e deploy.

---

## 1. Visão Geral do Sistema

### O que o sistema faz
O **AppFinance** é um assistente financeiro inteligente completo (PWA/Web/APK) projetado para simplificar e revolucionar a gestão de finanças pessoais e empresariais. Através de um sistema híbrido de inteligência artificial (Groq LLM) e gamificação estruturada (XP/Níveis), o sistema estimula comportamentos de saúde financeira saudáveis enquanto penaliza hábitos de risco. 

O usuário pode gerenciar receitas comuns, rendas extras, criar metas com prazos e aportes, importar extratos bancários de forma totalmente automatizada (PDF/CSV/OFX/Excel) via IA e interagir com um chat financeiro inteligente com contexto em tempo real do banco de dados do próprio usuário.

### Para quem é
*   **Pessoal (B2C):** Indivíduos buscando organizar finanças pessoais, quitar dívidas, criar reserva de emergência e controlar gastos supérfluos de luxo.
*   **Empresarial (B2B/Microempresas):** Microempreendedores individuais (MEIs) e pequenas empresas gerenciando fluxo de caixa, margem de lucro estimada, capital de giro e transações de faturamento.

### Como está Hospedado e Deployado
*   **Web Frontend & Backend Proxy:** O sistema é integrado para deploy automático na plataforma **Vercel** através da configuração descrita em `vercel.json`. O backend express roda como Vercel Serverless Functions (`api/index.ts`) e o frontend React é servido estaticamente do diretório `/dist`.
*   **Aplicativo Mobile (APK/Capacitor):** Configurado via **Capacitor** (`capacitor.config.ts`) para compilar como um aplicativo nativo Android. O aplicativo móvel é gerado a partir do build estático do React (`/dist`) e empacotado localmente ou em pipelines de CI/CD para gerar arquivos `.apk`.

---

## 2. Tecnologias Utilizadas

### Frontend
*   **React 19 & Vite:** Biblioteca principal para renderização de componentes e bundle rápido de desenvolvimento.
*   **Tailwind CSS (V4):** Utilitários de CSS para desenvolvimento rápido de interfaces modernas.
*   **Lucide React:** Biblioteca de ícones vetoriais modernos.
*   **Framer Motion (motion):** Biblioteca de animações fluidas e micro-interações.
*   **Recharts:** Biblioteca para exibição de gráficos financeiros dinâmicos e responsivos.
*   **React Hot Toast:** Sistema de notificações de UI limpas e elegantes.

### Backend
*   **Express (Node.js):** Utilizado como servidor proxy intermediário seguro para realizar chamadas a APIs restritas, parser de arquivos e geração de relatórios PDF.
*   **Multer:** Middleware para tratamento e armazenamento em memória de uploads de arquivos.
*   **PDF2JSON & PDF-Parse:** Bibliotecas dedicadas no backend para extração de texto a partir de arquivos PDF enviados pelos usuários (extratos e notas).
*   **React-PDF Renderer (`@react-pdf/renderer`):** Utilizado no backend para gerar PDFs de relatórios financeiros de forma estruturada.

### Banco de Dados & Serviços Cloud
*   **Firebase Authentication:** Autenticação segura via e-mail e senha.
*   **Firebase Firestore:** Banco de dados NoSQL em tempo real para armazenamento de transações, metas, perfis, conquistas e dados de diagnósticos.
*   **Firebase Admin SDK:** Utilizado no backend proxy Express para validação de JWT tokens e segurança em queries administrativas.

### APIs Externas Integradas
*   **API Groq (Modelos Llama):**
    *   `llama-3.3-70b-versatile`: Modelo robusto de 70 bilhões de parâmetros utilizado para a classificação detalhada de extratos no endpoint `/api/ia/classificar` e no chat de conversação em tempo real `/api/groq/chat`.
    *   `llama-3.1-8b-instant`: Modelo rápido de 8 bilhões de parâmetros utilizado para tarefas mais leves, como simulação de cenários (`/api/groq/simulador`), sugestão de metas financeiras (`/api/groq/sugerir-meta`), alertas de cron (`/api/cron/alertas`) e diagnósticos iniciais (`/api/diagnostico`).
*   **Proxy Antigravity:** Integração de chamadas seguras para a API do Antigravity Platform através de `/api/antigravity/action`, repassando o UID do Firebase validado pelo backend proxy.

### Autenticação e Segurança
*   **JWT Token (Bearer):** O frontend envia o ID token do Firebase em cada requisição para o backend (`Authorization: Bearer <TOKEN>`), validado pelo middleware `requireAuth` que injeta o UID correspondente em `req.user`.
*   **Helmet:** Configuração de cabeçalhos HTTP de segurança de forma restrita para produção.
*   **Express Rate Limit:** Limitação de chamadas para APIs de IA (`aiLimiter` de max 200 requisições por hora) para evitar abusos de cota.
*   **Firestore Security Rules (`firestore.rules`):** Regras restritas para que os usuários leiam/escrevam exclusivamente nos caminhos pertencentes ao seu próprio UID (Tenant Isolation).

---

## 3. Estrutura de Arquivos

Abaixo está o mapa completo de pastas e arquivos principais do projeto, acompanhado de suas respectivas responsabilidades:

```
AppFinance/
├── api/
│   └── index.ts                 # Ponto de entrada do backend serverless (Vercel) contendo todas as rotas e validações.
├── src/
│   ├── components/              # Componentes React reutilizáveis de UI.
│   │   ├── Dashboard.tsx        # Blocos visuais principais, gráficos e painel de controle financeiro.
│   │   ├── FinanceChat.tsx      # Interface de chat com o assistente IA.
│   │   ├── HeaderXPBar.tsx      # Barra superior persistente mostrando Nível e Barra de XP do usuário.
│   │   ├── ImportData.tsx       # Componente de upload e visualização da classificação de extratos.
│   │   ├── Login.tsx            # Componente de login / criação de conta no Firebase Auth.
│   │   ├── Metas.tsx            # Lista e formulários para criação e aporte em metas.
│   │   ├── NewTransactionModal.tsx # Modal de inserção manual de despesas/receitas (chama regras de XP).
│   │   ├── NotificacoesDropdown.tsx # Dropdown no cabeçalho contendo alertas gerados pelo sistema.
│   │   ├── OnboardingWizard.tsx # Questionário interativo (Diagnóstico) para definir o perfil do usuário.
│   │   ├── ProtectedRoute.tsx   # HOC de segurança para rotas restritas a usuários logados.
│   │   └── Simulador.tsx        # Simulador de cenários financeiros com projeções de investimento/empréstimo.
│   ├── hooks/                   # Custom Hooks para compartilhamento de estado.
│   │   ├── useAuth.tsx          # Gerencia autenticação Firebase, dados do perfil do usuário e sincronização real-time.
│   │   └── usePlan.tsx          # Gerencia controle de acesso a features Pro/Empresarial e modais de Upgrade.
│   ├── lib/                     # Configurações do sistema e regras centrais.
│   │   ├── antigravityConfig.ts # Utilitários para comunicação com o proxy Antigravity.
│   │   ├── firebaseConfig.ts    # Inicialização do Firebase Client SDK.
│   │   ├── gamification.ts      # Catálogo único de regras de XP, cálculo de níveis e verificação de penalidades.
│   │   └── seed.ts              # Script para popular banco de dados com dados de teste.
│   ├── pages/                   # Páginas da aplicação estruturando os layouts.
│   │   ├── ChatPage.tsx         # Página inteira dedicada ao chat da IA.
│   │   ├── Dashboard.tsx        # Página principal com métricas, gráficos e resumo.
│   │   ├── ImportPage.tsx       # Página dedicada à importação de documentos bancários.
│   │   ├── Login.tsx            # Página de autenticação / entrada do usuário.
│   │   ├── MetasPage.tsx        # Página de metas com painel informativo de aportes.
│   │   ├── NiveisPage.tsx       # Detalhes de ganhos/perdas de XP e tabela de níveis.
│   │   ├── RendaExtra.tsx       # Gerenciamento de receitas adicionais recorrentes/únicas.
│   │   └── Transacoes.tsx       # Tabela completa de histórico de transações com filtros avançados.
│   ├── App.tsx                  # Arquivo principal do Frontend, configurando roteamento e Providers.
│   ├── index.css                # Estilização global da aplicação (Tailwind).
│   └── main.tsx                 # Arquivo de inicialização e montagem do React 19.
├── server.ts                    # Servidor Express utilizado para desenvolvimento local e empacotamento.
├── serverReportGenerator.tsx    # Gerador de layout PDF estruturado para relatórios do backend.
├── capacitor.config.ts          # Arquivo de configuração de empacotamento do Capacitor (Android/APK).
├── firebase.json                # Configurações do Firebase CLI para Hosting e local rules.
├── firestore.rules              # Regras de segurança de escrita e leitura do banco Firestore.
├── package.json                 # Declaração de scripts e dependências npm.
├── vercel.json                  # Regras de roteamento e configurações de execução na Vercel.
└── tsconfig.json                # Configurações de compilação do TypeScript.
```

---

## 4. Módulos e Funcionalidades

### A. Autenticação & Onboarding
*   **Login / Registro (`src/pages/Login.tsx`):** Criação de conta e autenticação via Firebase Auth.
*   **Diagnóstico Inicial (`src/components/OnboardingWizard.tsx`):** Questionário interativo contendo fluxos diferenciados para perfis **Pessoal** (renda, dívidas, poupança, cartão) e **Empresarial** (faturamento, funcionários, capital de giro, lucro). A chamada calcula um score (0-1000) e consome a API do Groq para sugerir 3 recomendações personalizadas. Completar o diagnóstico concede **+30 XP** (e de forma hardcoded adiciona `+100 XP` no wizard do client).

### B. Dashboard Dinâmico (`src/pages/Dashboard.tsx`)
*   Painel centralizado mostrando saldo atual, total de receitas, despesas e rendas extras.
*   Alternador de modo ("Pessoal" / "Empresarial") que altera a visão inteira do dashboard de forma instantânea.
*   Gráficos dinâmicos de faturamento e despesas via `Recharts`.
*   Painel de nível atual e alertas de inteligência artificial gerados dinamicamente.

### C. Importação Automatizada de Extratos (`src/pages/ImportPage.tsx`)
*   Upload de extratos no frontend via `src/components/ImportData.tsx`.
*   O backend lê o arquivo bruto através de `PDFParser` e o envia estruturado ao modelo `llama-3.3-70b-versatile` no endpoint `/api/ia/classificar`.
*   A IA extrai a descrição, valor, tipo (receita/despesa) e classifica a categoria (Transporte, Alimentação, Moradia, Saúde, Energia, Telecomunicações, Serviços, Pessoal, Outros) retornando um JSON limpo inserido diretamente no Firestore do usuário.
*   Cada importação bem-sucedida concede **+20 XP** ao usuário.

### D. Histórico e Filtro de Transações (`src/pages/Transacoes.tsx`)
*   Lista completa de transações estruturada em tabela.
*   Filtros dinâmicos por tipo (todos, receita, despesa), categoria, período (este mês, último mês, 3 meses, todo o histórico) e origem (manual, importação, renda extra, meta).
*   Campo de pesquisa por texto na descrição e categoria.

### E. Gestão de Metas Financeiras (`src/pages/MetasPage.tsx`)
*   Definição de metas com valor alvo, prazo final e acompanhamento de aportes acumulados.
*   Painel retrátil explicativo ensinando a calcular aportes mensais (`Valor alvo ÷ número de meses`).
*   Cadastro de meta concede **+15 XP** e concluir a meta concede **+50 XP** de recompensa.

### F. Renda Extra (`src/pages/RendaExtra.tsx`)
*   Gerenciamento específico de fontes de renda não recorrente (freelance, vendas, comissões).
*   Possibilidade de registrar rendas de forma recorrente (semanal/mensal) ou única.
*   O registro de renda extra insere automaticamente um registro no histórico de transações como receita de categoria correspondente.
*   Cadastro de renda extra única concede **+15 XP** e recorrente concede **+20 XP**.

### G. Assistente Financeiro IA (`src/pages/ChatPage.tsx`)
*   Chat inteligente com interface baseada em chat bubbles.
*   No backend, as últimas 10 mensagens são enviadas ao Groq (`llama-3.3-70b-versatile`) enriquecidas com o contexto financeiro em tempo real do usuário (receitas, despesas, metas ativas, rendas extras, transações recentes e gastos categorizados).
*   As respostas são transmitidas via Server-Sent Events (SSE) para uma experiência de chat rápida e fluida.

---

## 5. Banco de Dados & Regras de Acesso

O banco de dados Firestore é estruturado sob o conceito de **Tenant Isolation** através de subcoleções de nível de usuário. 

### Coleções Identificadas

1.  **`users/{userId}`**
    *   Armazena o perfil básico e estatísticas de gamificação do usuário.
    *   *Campos:* `nome` (string), `email` (string), `modo` (string), `plano` (string), `xp` (number), `nivel` (number), `criadoEm` (string), `ultimoAcesso` (string), `lastPenalidadeDia` (string), `ultimaAvaliacaoSaldo` (string), `ultimaAvaliacaoLuxo` (string).
2.  **`transacoes/{userId}/items/{documentId}`**
    *   Contém todas as movimentações financeiras de entrada ou saída.
    *   *Campos:* `descricao` (string), `valor` (number), `tipo` (string: `'receita' | 'despesa'`), `categoria` (string), `data` (string: `'YYYY-MM-DD'`), `origem` (string: `'manual' | 'importacao' | 'renda_extra' | 'meta'`), `rendaExtraId` (string, opcional), `modo` (string: `'pessoal' | 'empresarial'`), `criadoEm` (Timestamp).
3.  **`metas/{userId}/items/{documentId}`** (ou subcoleção `/lista` em seeds)
    *   Representa os objetivos financeiros cadastrados.
    *   *Campos:* `titulo` (string), `valorAlvo` (number), `progressoAtual` (number), `prazo` (string), `status` (string: `'ativa' | 'concluida'`), `tipo` (string), `userId` (string).
4.  **`rendaExtra/{userId}/items/{documentId}`**
    *   Detalhamento de fontes de receita adicionais.
    *   *Campos:* `descricao` (string), `valor` (number), `data` (string), `categoria` (string), `recorrente` (boolean), `frequencia` (string), `userId` (string), `criadoEm` (Timestamp).
5.  **`diagnostico/{userId}`**
    *   Salva o último diagnóstico efetuado pelo usuário.
    *   *Campos:* `respostas` (map/JSON), `score` (number), `recomendacoes` (array of strings), `criadoEm` (string), `atualizadoEm` (string).
6.  **`alertas/{userId}`**
    *   Mensagens de notificação e anomalias de custos geradas via backend.
    *   *Regra de escrita:* Apenas modificada internamente via backend.
7.  **`chats/{userId}/messages`**, **`conquistas/{userId}/items`**, **`notificacoes/{userId}/items`**
    *   Histórico de conversas, conquistas destravadas e notificações locais.

### Regras do Firestore (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Garante que o usuário autenticado acesse exclusivamente os documentos com seu UID
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /transacoes/{userId}/items/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /metas/{userId}/items/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /chats/{userId}/messages/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /alertas/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Apenas alterado via Admin SDK no Backend
    }
    match /notificacoes/{userId}/items/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /diagnostico/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /conquistas/{userId}/items/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 6. Gamificação

### Catálogo de Eventos de XP
As pontuações são baseadas em comportamentos catalogados e monitorados em tempo real (`src/lib/gamification.ts`):

#### Ganhos de XP (Eventos Positivos)
| Chave do Evento | XP Concedido | Ação correspondente |
| :--- | :--- | :--- |
| `IMPORTAR_EXTRATO` | `+20 XP` | Importação automática de extratos e NFs |
| `CADASTRAR_META` | `+15 XP` | Cadastro de novas metas financeiras no painel |
| `META_CONCLUIDA` | `+50 XP` | Atingir o valor total aportado na meta |
| `ADICIONAR_RECEITA` | `+10 XP` | Registro manual de receita no histórico |
| `DIAGNOSTICO_INICIAL` | `+30 XP` | Responder completamente o onboarding wizard |
| `SALDO_POSITIVO_MES` | `+25 XP` | Terminar o mês com saldo total no positivo |
| `RENDA_EXTRA_UNICA` | `+15 XP` | Cadastrar uma receita de renda extra pontual |
| `RENDA_EXTRA_RECORRENTE` | `+20 XP` | Configurar renda recorrente adicional |

#### Penalidades de XP (Eventos de Risco)
| Chave do Evento | XP Descontado | Ação correspondente |
| :--- | :--- | :--- |
| `EXCESSO_DESPESAS_DIA` | `-15 XP` | Cadastrar 3 ou mais despesas no mesmo dia |
| `SALDO_NEGATIVO_MES` | `-20 XP` | Encerrar o mês acumulado com saldo negativo |
| `EXCESSO_LUXO` | `-10 XP` | Lazer e Assinaturas superiores a 40% da renda declarada |
| `INATIVIDADE_COM_METAS` | `-5 XP` | Ficar 7+ dias sem abrir o app tendo metas ativas |

*Nota: O XP total acumulado do usuário nunca cai abaixo de zero (`Math.max(0, novoXp)`).*

### Tabela de Níveis e Progressão
| Nível | Título | XP Mínimo Requerido |
| :--- | :--- | :--- |
| Nível 1 | Desorganizado | `0 XP` |
| Nível 2 | Consciente | `100 XP` |
| Nível 3 | Planejador | `300 XP` |
| Nível 4 | Estrategista | `600 XP` |
| Nível 5 | Investidor | `1000 XP` |
| Nível 6 | Independente | `1500 XP` |
| Nível 7 | Visionário | `2100 XP` |
| Nível 8 | Mestre Financeiro | `2800 XP` |
| Nível 9 | Magnata | `3600 XP` |
| Nível 10 | Lenda | `4500 XP` |

---

## 7. Configurações e Deploy

### Variáveis de Ambiente Necessárias (.env)
*   `VITE_FIREBASE_API_KEY`: Chave da API Web do Firebase Client.
*   `VITE_FIREBASE_AUTH_DOMAIN`: Domínio de autenticação do Firebase.
*   `VITE_FIREBASE_PROJECT_ID`: ID do projeto no Firebase Console.
*   `VITE_FIREBASE_STORAGE_BUCKET`: Caminho do bucket de arquivos do Firebase.
*   `VITE_FIREBASE_MESSAGING_SENDER_ID`: ID de mensagens push.
*   `VITE_FIREBASE_APP_ID`: ID da aplicação registrada no painel web.
*   `FIREBASE_SERVICE_ACCOUNT_JSON`: String JSON compactada contendo as credenciais da Conta de Serviço do Firebase Admin.
*   `GROQ_API_KEY`: Chave secreta de autenticação na API do Groq LLM.
*   `ANTIGRAVITY_API_KEY`: Chave secreta para comunicação na plataforma proxy Antigravity.
*   `ANTIGRAVITY_API_URL`: URL base para as chamadas Antigravity.
*   `PORT`: Porta de escuta do servidor (padrão `3000`).

### Configurações de Deploy (Vercel)
O arquivo `vercel.json` gerencia o roteamento e execuções:
*   Redireciona todas as chamadas `/api/*` para a Vercel Function compilada a partir de `api/index.ts`.
*   Permite execução prolongada (`maxDuration: 30`) e memória estendida (`1024mb`) para evitar falhas ou estouros de limite no processamento pesado de arquivos PDF no endpoint `/api/ia/classificar`.
*   Inclui dinamicamente os pacotes internos do `pdf-parse` para correto empacotamento da biblioteca serverless.

### Empacotamento Android (Capacitor)
O arquivo `capacitor.config.ts` define o ecossistema móvel:
*   `appId`: `'com.financeai.app'`
*   `appName`: `'FinanceAI'`
*   `webDir`: `'dist'` (diretório de build compilado pelo Vite)
*   **Android Schemes & Cleartext:** Configurações otimizadas para navegação restrita de requisições de API a domínios autorizados, permitindo comunicações com a plataforma Antigravity.
*   **Comportamento:** Cor de fundo nativa configurada em `#030712` (bg-gray-950) e barra de status/overscroll desativada para visual nativo.

---
*Este documento é atualizado continuamente à medida que novas features, configurações ou integrações são adicionadas ao ecossistema do **AppFinance**.*
