# PROJETO_STATUS.md - FinanceAI App

Este documento apresenta a fotografia arquitetural e operacional completa da aplicação **FinanceAI**, englobando a stack tecnológica, mapeamento da árvore de arquivos, status de todas as funcionalidades, integrações ativas, matriz de erros conhecidos e o roadmap prioritário para as próximas sessões de desenvolvimento.

---

## 1. STACK TECNOLÓGICA

A aplicação foi construída sob o ecossistema moderno do React com TypeScript e empacotamento híbrido (Web + Mobile Android).

### 🛠️ Core & Frameworks
- **React (`^19.0.1`)** & **React DOM (`^19.0.1`)**: Biblioteca base de renderização UI com suporte a hooks e concorrência avançada.
- **Vite (`^6.2.3`)**: Ferramenta de compilação ultrarrápida e bundler de frontend.
- **TypeScript (`~5.8.2`)**: Tipagem estática rigorosa para segurança e previsibilidade do código.
- **React Router DOM (`^7.15.1`)**: Gerenciamento de rotas e navegação client-side em modo Single Page Application (SPA).
- **Express (`^4.21.2`)** & **Node.js / TSX (`^4.21.0`)**: Backend embarcado para servir rotas de API REST, geração de PDF e processamento de IA.
- **Capacitor (`^8.3.4`)**: Runtime de encapsulamento para geração do aplicativo nativo Android (`APK`).

### 🎨 Estilização & UI
- **Tailwind CSS (`^4.1.14` via `@tailwindcss/vite`)**: Estilização baseada em utilitários e tokens de design customizados.
- **Lucide React (`^0.546.0`)**: Biblioteca iconográfica vetorial de alta definição.
- **Motion (`^12.23.24`)**: Mecanismo de animações fluidas e micro-interações.
- **Canvas Confetti (`^1.9.4`)** / **React Confetti (`^6.4.0`)**: Gamificação visual para comemoração de metas e conquistas.

### 📊 Gráficos & Processamento de Dados
- **Recharts (`^3.8.1`)**: Biblioteca de visualização de gráficos de fluxo de caixa e balanço financeiro.
- **XLSX (`^0.18.5`)**: Parser avançado para leitura de planilhas Excel e arquivos CSV.
- **Tesseract.js (`^7.0.0`)**: Engine de OCR em WebAssembly para reconhecimento de texto em fotos de notas fiscais.
- **PDF-Parse (`^2.4.5`)** & **@react-pdf/renderer (`^4.5.1`)**: Ferramentas para extração textual e renderização de relatórios em PDF.

### ☁️ Integrações Nuvem & IA
- **Firebase SDK (`^12.13.0`)**: Serviços de Autenticação (`Auth`), Banco de Dados NoSQL em tempo real (`Firestore`) e Armazenamento (`Storage`).
- **Firebase Admin (`^13.10.0`)**: SDK de administração backend para verificação segura de tokens JWT.
- **Groq SDK (`^1.2.0`)**: Integração de altíssimo desempenho com LLMs open-source (Llama 3 8B) para análise preditiva, diagnóstico e chat IA em streaming.

---

## 2. ESTRUTURA DE ARQUIVOS

```text
c:\Users\aurel\Documents\financeai\AppFinance\
├── .env                                # Definição de todas as variáveis de ambiente (Firebase, Groq, Segurança).
├── capacitor.config.ts                 # Configuração de compilação nativa mobile para o Capacitor 6+.
├── firestore.rules                     # Regras de segurança de acesso NoSQL por usuário autenticado.
├── package.json                        # Manifesto do projeto, dependências e scripts de execução de build/dev.
├── server.ts                           # Servidor Express de produção e dev contendo as rotas de IA, PDF e Cron.
├── serverReportGenerator.tsx           # Mecanismo de renderização de streams PDF via React PDF Renderer.
├── vite.config.ts                      # Configuração do Vite, plugins React, Tailwind e proxy HMR.
├── android/                            # Projeto nativo gerado pelo Capacitor para compilação Android/APK.
├── dist/                               # Pacote compilado e otimizado para deploy web e estático.
└── src/                                # Código-fonte da aplicação React.
    ├── App.tsx                         # Orquestrador de rotas (React Router) e provedores de contexto (Auth/Plan).
    ├── index.css                       # Folha de estilo global com importação do Tailwind e variáveis CSS base.
    ├── main.tsx                        # Ponto de entrada de montagem da raiz do React no DOM.
    ├── hooks/
    │   ├── useAuth.tsx                 # Hook de contexto de autenticação, persistência de sessão e perfil de usuário.
    │   └── usePlan.tsx                 # Hook de controle de planos de assinatura (Free, Premium, Enterprise) e limites.
    ├── lib/
    │   ├── firebaseConfig.ts           # Inicialização limpa do Firebase consumindo as variáveis import.meta.env.
    │   ├── gamification.ts             # Sistema de XP, cálculo de níveis e registro de conquistas no Firestore.
    │   └── seed.ts                     # Utilitário para injeção de dados simulados para testes e apresentações.
    ├── pages/
    │   ├── ChatPage.tsx                # Página de tela cheia do Assistente Financeiro IA Groq.
    │   ├── Dashboard.tsx               # Dashboard principal, gráficos, cards, alternância Pessoal/Empresarial e alertas.
    │   ├── ImportPage.tsx              # Página wrapper integrada para o módulo de importação de arquivos.
    │   ├── Login.tsx                   # Página de autenticação (Login, Cadastro, Google Sign-in e Recuperação).
    │   ├── MetasPage.tsx               # Página de acompanhamento de metas, progresso e sugestão gerada por IA.
    │   └── Transacoes.tsx              # Página com histórico completo, filtros de busca por período/tipo e tabela.
    └── components/
        ├── Dashboard.tsx               # Subcomponentes do dashboard (ScoreGauge, AlertasInteligentes, Gráficos).
        ├── FinanceChat.tsx             # Componente de interface de chat com suporte a streaming de IA.
        ├── HeaderXPBar.tsx             # Componente visual da barra de experiência (XP) e nível do usuário.
        ├── ImportData.tsx              # Lógica de processamento de arquivos (CSV, XLSX, OCR e PDF via Storage).
        ├── Login.tsx                   # Subcomponente de formulários de acesso.
        ├── Metas.tsx                   # Subcomponente de listagem e interação de metas financeiras.
        ├── NewTransactionModal.tsx     # Janela modal para registro de novas despesas ou receitas.
        ├── OnboardingWizard.tsx        # Questionário de diagnóstico financeiro na primeira inicialização.
        ├── ProtectedRoute.tsx          # Componente de blindagem de rotas privadas que exige autenticação.
        ├── ReportPDF.tsx               # Componente visual de template de relatório financeiro em PDF.
        └── Simulador.tsx               # Simulador de cenários de investimento e aposentadoria com explicação IA.
```

---

## 3. FUNCIONALIDADES IMPLEMENTADAS

| Módulo | Funcionalidade | Status | Arquivo Responsável | Observações Técnicas |
| :--- | :--- | :---: | :--- | :--- |
| **Autenticação** | Login / Cadastro / Google | ✅ | `src/pages/Login.tsx` | Sessão persistida via Firebase Auth e redirecionamento de onboarding. |
| **Navegação** | Rotas Protegidas e Sidebar | ✅ | `src/App.tsx` | Estrutura SPA com validação de token e layout unificado no menu lateral. |
| **Dashboard** | Resumo Financeiro e Gráfico | ✅ | `src/pages/Dashboard.tsx` | Dados calculados dinamicamente em tempo real via Firestore com fallback. |
| **Transações** | Cadastro e Histórico | ✅ | `src/pages/Transacoes.tsx` | Tabela paginada com filtros por mês, categoria e tipo de receita/despesa. |
| **Janela Modal** | Inserção de Nova Transação | ✅ | `NewTransactionModal.tsx` | Formulário completo com validação rigorosa e data fixada para evitar fuso. |
| **Metas** | CRUD e Gamificação | ✅ | `src/pages/MetasPage.tsx` | Cálculo de progresso percentual, botão de aporte e sugestão de IA. |
| **Importação** | OCR, Excel, CSV e PDF | ✅ | `src/components/ImportData.tsx`| Parseamento híbrido com envio seguro e classificação automatizada via Groq. |
| **Assistente IA**| Chat Streaming Financeiro | ✅ | `src/components/FinanceChat.tsx`| Conexão com Express `/api/groq/chat` retornando streams de alta velocidade. |
| **Gamificação** | Barra de XP e Conquistas | ✅ | `src/lib/gamification.ts` | Incremento de pontos a cada transação e importação concluída. |
| **Alternância** | Modo Pessoal e Empresarial| ✅ | `src/pages/Dashboard.tsx` | Toggle segmentado persistido no Firestore com alteração instantânea de métricas. |

---

## 4. INTEGRAÇÕES ATIVAS

### 🔐 Firebase Authentication
- **Provedores Ativos**: E-mail e Senha tradicional e Autenticação federada com o Google (`GoogleAuthProvider`).
- **Segurança**: Gerenciamento automático de ciclo de vida do token JWT via `onAuthStateChanged`.

### 🗄️ Firestore (NoSQL Database)
As regras (`firestore.rules`) garantem que cada usuário acesse estritamente os documentos da sua subcoleção ou que contenham a chave `userId === auth.uid`.
- **`users/{userId}`**: Armazena metadados do usuário, preferências de sistema e o modo atual (`{ modo: 'pessoal' | 'empresarial' }`).
- **`transacoes/{userId}/items/{itemId}`**: Contém as transações individuais (`descricao`, `valor`, `tipo`, `categoria`, `data`, `criadoEm`).
- **`metas/{userId}/items/{itemId}`**: Contém as metas de poupança (`titulo`, `valorAlvo`, `valorAtual`, `prazo`, `categoria`).
- **`diagnostico/{userId}`**: Armazena as respostas do onboarding inicial e a pontuação do score financeiro (`score`).
- **`conquistas/{userId}/items`**: Registra medalhas e marcos atingidos no sistema de gamificação.

### 📂 Firebase Storage
- **Configuração**: Balde (bucket) estruturado em `imports/{userId}/{timestamp}_{filename}`.
- **Utilização**: Armazena arquivos PDF brutos de extratos bancários para que o backend os acesse e processe via PDF-Parse de forma protegida.

### 🧠 Groq AI API
O servidor consome o modelo `llama3-8b-8192` através da SDK oficial com respostas tipadas em formato JSON e streaming SSE:
- `/api/diagnostico`: Gera score e 3 recomendações financeiras personalizadas.
- `/api/ia/classificar`: Analisa blocos de texto ou JSON e categoriza despesas automaticamente.
- `/api/groq/chat`: Canal de consultoria financeira interativa em tempo real.
- `/api/groq/sugerir-meta`: Sugere novos objetivos de economia adaptados ao perfil do usuário.
- `/api/groq/simulador`: Cria relatórios discursivos sobre cenários de juros compostos.

### 🚀 Vercel / Deploy de Produção
- **Build Output**: Configurado para servir a pasta `dist/` estática.
- **Serverless Backend**: O Express atua na mesma origem, exigindo que as variáveis de ambiente (VITE_FIREBASE_* e GROQ_API_KEY) estejam cadastradas no painel da Vercel.

### 📱 Capacitor & Android nativo
- **Versão**: Capacitor v8.3.4 com suporte nativo ao Android SDK 34+.
- **Sincronização**: O comando `npx cap sync android` espelha o build de produção web para o diretório nativo `android/app/src/main/assets/public`.

---

## 5. ERROS CONHECIDOS E PENDÊNCIAS

Abaixo estão detalhados os problemas e pontos de atenção arquitetural solicitados na auditoria do sistema:

### 1. CORS do Firebase Storage bloqueando upload de arquivos
- **Descrição do Erro**: Ao tentar realizar o upload de arquivos PDF no módulo de Importação, o navegador aborta a requisição com erro de política de mesma origem (CORS).
- **Arquivo**: `src/components/ImportData.tsx` (na chamada `uploadBytes` ou `getDownloadURL`).
- **Causa Identificada**: O bucket do Firebase Storage por padrão não possui cabeçalhos CORS liberados para origens externas (como localhost ou domínio da Vercel).
- **Solução Necessária**: Executar o utilitário `gsutil` via terminal da Google Cloud ou CLI para configurar o arquivo `cors.json` no bucket:
  ```json
  [{"origin": ["*"], "method": ["GET", "PUT", "POST", "DELETE", "HEAD"], "maxAgeSeconds": 3600}]
  ```

### 2. Gráfico Recharts com width/height -1 (branco)
- **Descrição do Erro**: Ocasionalmente, ao carregar o Dashboard em resoluções mobile ou durante redimensionamentos de tela, o gráfico de fluxo de caixa desaparece ou renderiza um canvas em branco.
- **Arquivo**: `src/components/Dashboard.tsx` (Componente `<ResponsiveContainer>`).
- **Causa Identificada**: O componente `<ResponsiveContainer>` do Recharts calcula as dimensões baseadas no elemento pai. Se o pai tiver display flexível sem largura explícita ou estiver oculto durante a montagem inicial, as dimensões internas colapsam para `0` ou `-1`.
- **Solução Necessária**: Definir uma altura ou largura mínima e absoluta no container pai (ex: `min-h-[300px] w-full overflow-hidden`) ou fixar `width="99%"` no `<ResponsiveContainer>` para forçar o recálculo de layout.

### 3. Chat IA retornando respostas simuladas em vez de usar a Groq API real
- **Descrição do Erro**: As mensagens enviadas no chat financeiro retornam conselhos genéricos estáticos ou falham na conexão.
- **Arquivo**: `src/components/FinanceChat.tsx` e `server.ts`.
- **Causa Identificada**: Se a variável de ambiente `GROQ_API_KEY` não for carregada no servidor ou o limite de taxa do Express (`aiLimiter`) for atingido, o endpoint executa um bloco `catch` de fallback que devolve strings pré-programadas.
- **Solução Necessária**: Garantir que o processo Node tenha acesso irrestrito à chave válida da Groq e monitorar o cabeçalho de resposta da API para evitar bloqueios por *Rate Limit* (429).

### 4. Dashboard travado em "Carregando..." sem timeout
- **Descrição do Erro**: Em cenários de queda de conexão ou latência extrema no Firestore, a página ficava exibindo um *spinner* ou mensagem de carregamento indefinidamente.
- **Arquivo**: `src/pages/Dashboard.tsx`.
- **Causa Identificada**: A escuta assíncrona (`onSnapshot`) não possuía mecanismo de aborto ou temporizador caso os pacotes de rede fossem descartados pela operadora.
- **Solução Aplicada/Necessária**: Foi implementado um temporizador de segurança (`setTimeout`) de 5 segundos. Se os dados não chegarem, o estado de loading é desligado e o sistema exibe os valores zerados ou cacheados (R$ 0,00). *Requer teste contínuo em redes móveis de baixa velocidade*.

### 5. Metas: não consegue adicionar nova meta
- **Descrição do Erro**: Ao submeter o formulário de criação de meta, a lista de metas não atualizava ou gerava um erro de permissão negada.
- **Arquivo**: `src/pages/MetasPage.tsx`.
- **Causa Identificada**: Falta da propriedade `userId` obrigatória no documento da meta ou tentativa de gravação antes da resolução da promessa de autenticação do Firebase.
- **Solução Necessária**: Envolver a chamada `addDoc` em um bloco `try/catch` robusto e verificar a presença de `user.uid` explícito antes da submissão para a coleção `metas/${user.uid}/items`.

### 6. Transações: não consegue adicionar nova transação
- **Descrição do Erro**: O clique no botão "+ Nova Transação" não abria a janela modal ou ao salvar não refletia na tabela.
- **Arquivo**: `src/pages/Dashboard.tsx` e `src/pages/Transacoes.tsx`.
- **Causa Identificada**: O estado de abertura do modal (`isModalOpen`) estava atrelado a lógicas de renderização de carregamento inicial, ou o caminho da coleção divergia entre as telas.
- **Solução Aplicada/Necessária**: Sincronização completa implementada nesta sessão: o modal agora é renderizado condicionalmente de forma pura (`{isModalOpen && <NewTransactionModal ... />}`) em ambas as telas, gravando no caminho padronizado.

### 7. Modo Empresarial: toggle não está salvando/funcionando
- **Descrição do Erro**: O botão de modo trocava a interface localmente, mas ao recarregar a página o usuário voltava para o modo "Pessoal".
- **Arquivo**: `src/pages/Dashboard.tsx`.
- **Causa Identificada**: O toggle não estava conectado a uma chamada de persistência no documento do usuário (`users/{userId}`) ou tentava sobrescrever o documento inteiro sem a flag de mesclagem.
- **Solução Aplicada/Necessária**: O toggle segmentado agora aciona um `setDoc` com a opção `{ merge: true }`, garantindo a alteração permanente do campo `"modo"` no banco de dados e refletindo instantaneamente nos cards.

### 8. Importação de extrato: não analisa o arquivo com IA real
- **Descrição do Erro**: Arquivos enviados exibiam sucesso na leitura, mas as descrições e categorias das transações vinham genéricas ou vazias.
- **Arquivo**: `src/components/ImportData.tsx` e `server.ts`.
- **Causa Identificada**: A rota `/api/ia/classificar` recebia o texto bruto mas não conseguia estruturar o prompt ou a engine de LLM falhava ao retornar um JSON estritamente válido, caindo no fallback.
- **Solução Necessária**: Reforçar o prompt no backend com a diretiva obrigatória `response_format: { type: "json_object" }` (já configurada no Llama 3) e garantir o envio de cabeçalho JWT válido para autorização na API.

---

## 6. VARIÁVEIS DE AMBIENTE NECESSÁRIAS

O arquivo `.env` deve conter rigorosamente as chaves listadas na tabela abaixo para o correto funcionamento do ambiente de desenvolvimento e produção:

| Nome da Variável | Finalidade | Onde e Como Obter |
| :--- | :--- | :--- |
| **`VITE_FIREBASE_API_KEY`** | Chave pública de API do Firebase para comunicação client-side. | Painel do Firebase Console > Configurações do Projeto > Geral > Web App. |
| **`VITE_FIREBASE_AUTH_DOMAIN`** | Domínio de autenticação autorizado para redirecionamentos OAuth. | Firebase Console > Authentication > Configurações > Domínios Autorizados. |
| **`VITE_FIREBASE_PROJECT_ID`** | Identificador único do projeto no Google Cloud / Firestore. | Firebase Console > Configurações do Projeto > ID do Projeto. |
| **`VITE_FIREBASE_STORAGE_BUCKET`** | URL base do balde de armazenamento para upload de extratos e PDFs. | Firebase Console > Storage > Arquivos (ex: `app-nome.firebasestorage.app`). |
| **`VITE_FIREBASE_MESSAGING_SENDER_ID`** | Número identificador do remetente de mensageria da nuvem. | Firebase Console > Configurações do Projeto > Cloud Messaging. |
| **`VITE_FIREBASE_APP_ID`** | ID do aplicativo cliente Web gerado pelo Firebase. | Firebase Console > Configurações do Projeto > Geral > App ID. |
| **`GROQ_API_KEY`** | Chave secreta de autenticação para as requisições de Inteligência Artificial. | Painel de Desenvolvedores da Groq Cloud (`console.groq.com/keys`). |
| **`FIREBASE_SERVICE_ACCOUNT_JSON`** | Credenciais administrativas (JSON) para validação de tokens no backend. | Firebase Console > Contas de Serviço > Gerar nova chave privada. |
| **`DISABLE_HMR`** | Flag booleana de otimização de CPU para ambientes de IDE na nuvem. | Preenchida internamente (`true` ou `false`). |

---

## 7. PRÓXIMOS PASSOS PRIORITÁRIOS

Para garantir que a aplicação atinja estabilidade total em ambiente de produção (Web e APK), a equipe de engenharia deve seguir a seguinte esteira de execução na próxima sessão:

1. **🔒 Liberação de CORS no Bucket do Firebase Storage**:
   - Criar o arquivo de configuração CORS e aplicar no Storage via CLI (`gsutil cors set cors.json gs://<STORAGE_BUCKET>`), eliminando imediatamente a trava de upload de extratos.
2. **🧪 Teste Fim-a-Fim (E2E) do Fluxo de Transações e Metas**:
   - Validar em múltiplos navegadores a abertura do modal de transação e a adição de novas metas com cálculo dinâmico de XP na barra superior.
3. **📈 Blindagem de Layout do Recharts**:
   - Inspecionar e fixar as dimensões dos gráficos em telas com menos de 380px de largura (mobile) para impedir o recálculo negativo do SVG.
4. **🔌 Monitoramento de Logs do Servidor Express e Groq**:
   - Realizar disparos simultâneos de classificação no módulo de Importação e verificar o tempo de resposta da API do Llama 3 para assegurar o funcionamento sem quedas para o fallback simulado.
5. **🚀 Geração de Release e Deploy APK**:
   - Executar a bateria de compilação final (`npm run build:android`) e gerar o binário de distribuição nativo (`.apk` / `.aab`) no Android Studio.
