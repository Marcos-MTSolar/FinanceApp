# FinanceAI

Uma aplicação financeira completa com modo pessoal e empresarial, suporte a gamificação e assistência de Inteligência Artificial usando a API da Groq.

## Setup Local

1. Clone o repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Copie o arquivo de exemplo de variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```
4. Preencha as variáveis no arquivo `.env` com suas chaves do Firebase e da Groq.
5. Inicie o servidor de desenvolvimento (que já inclui frontend e backend na mesma porta 3000 em dev):
   ```bash
   npm run dev
   ```

## Deploy via Cloud Run ou Docker

A aplicação utiliza Express para servir tanto a API quanto os assets estáticos gerados pelo Vite.
Para o build de produção:
```bash
npm run build
```
Para rodar a produção localmente:
```bash
npm run start
```

## Arquitetura
- **Frontend**: React + Vite + TailwindCSS.
- **Backend**: Express + Firebase Admin (para validação segura de tokens JWT).
- **Banco de Dados**: Firestore com regras de segurança isolando tenants (`userid`).
- **Storage**: Firebase Storage para upload de PDFs antes do processamento OCR/IA.
- **IA**: Groq SDK configurado no back-end para preservar a integridade das API keys.

## Firebase Rules
O projeto já conta com regras robustas (`firestore.rules` e `storage.rules`) para garantir o isolamento e a segurança dos dados dos usuários. Certifique-se de realizar o deploy das regras via Firebase CLI.
