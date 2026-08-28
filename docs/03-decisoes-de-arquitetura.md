# Decisões de Arquitetura

Este documento registra as principais decisões arquiteturais do Business AI. Todas as decisões aqui descritas servirão como base para o desenvolvimento do sistema.

---

# 1. Plataforma

O Business AI será uma aplicação 100% web.

O sistema será acessado através do navegador, sem necessidade de instalação.

Objetivos:

- Acesso em qualquer dispositivo.
- Atualizações centralizadas.
- Facilidade de manutenção.
- Escalabilidade.

---

# 2. Público-alvo

A primeira versão será desenvolvida para pequenos comércios.

Exemplos:

- Mercadinhos
- Lojas de bairro
- Pequenos varejistas

Após a versão 1.0, novos segmentos poderão ser atendidos através de módulos específicos.

---

# 3. Principal diferencial

A Inteligência Artificial será o núcleo do sistema.

O objetivo não será apenas armazenar informações, mas interpretar os dados da empresa para auxiliar o empreendedor na tomada de decisões.

---

# 4. Arquitetura

O sistema será dividido em quatro camadas principais:

- Frontend
- Backend
- Banco de Dados
- Serviço de Inteligência Artificial

Cada camada possuirá responsabilidades bem definidas.

---

# 5. Multiempresa

Desde a primeira versão, o sistema será preparado para múltiplas empresas.

Cada empresa terá seus próprios dados totalmente isolados.

Nenhuma empresa poderá visualizar informações pertencentes a outra.

---

# 6. Ecossistema de Integrações

O sistema será preparado para futuras integrações com serviços externos.

Exemplos:

- WhatsApp
- Bancos
- PIX
- Emissão de Nota Fiscal
- Marketplaces
- Sistemas Contábeis

---

# 7. Escalabilidade

Toda a arquitetura deverá permitir crescimento sem necessidade de reconstrução do sistema.

As decisões técnicas deverão priorizar organização, manutenção e expansão futura.

---

# 8. Filosofia do Produto

O Business AI não será apenas um ERP.

Seu objetivo será atuar como um consultor inteligente para pequenos empreendedores.

Cada funcionalidade deverá responder à seguinte pergunta:

"Como isso ajuda o empreendedor a tomar uma decisão melhor?"

---

# 9. Segurança em camadas

A segurança do sistema será tratada em camadas complementares.

Decisões:

- Proteger endpoints autenticados com autenticação e autorização.
- Manter senhas protegidas com Argon2.
- Aplicar rate limiting, especialmente nos fluxos de autenticação.
- Configurar security headers.
- Configurar CORS explicitamente.
- Proteger secrets e variáveis de ambiente.
- Tratar HTTPS/TLS e criptografia de infraestrutura como requisitos de produção.
- Usar criptografia em nível de aplicação somente para dados realmente sensíveis quando necessário.

---

# 10. Isolamento multiempresa e RLS

O isolamento multiempresa continuará sendo uma regra central do sistema.

Decisões:

- `companyId` continua vindo do usuário autenticado.
- Services continuam filtrando dados por `companyId`.
- RLS será uma segunda barreira de proteção no PostgreSQL.
- A implementação deve considerar corretamente Prisma, transações e pool de conexões.
- Não implementar uma solução de RLS insegura apenas para cumprir a decisão.

---

# 11. Concorrência e integridade

Operações críticas devem preservar integridade mesmo com acessos concorrentes.

Decisões:

- Usar optimistic locking para edições concorrentes quando aplicável.
- Usar transações curtas para operações críticas.
- Usar atualizações atômicas de estoque.
- Usar bloqueio pessimista somente quando necessário.
- Conflitos detectados devem resultar em resposta apropriada, como 409 quando aplicável.

---

# 12. Estoque auditável

O estoque deve ser tratado como uma operação de domínio auditável.

Decisões:

- Estoque não deve ser alterado por simples substituição do saldo.
- Entrada, venda, ajuste, perda, devolução e cancelamento devem gerar movimentações.
- Manter histórico suficiente para auditoria.
- A quantidade atual pode existir para leitura rápida, mas deve permanecer consistente com as operações registradas.

---

# 13. Idempotência

Operações críticas reenviadas não devem gerar efeitos duplicados.

Decisões:

- Operações críticas que possam ser reenviadas não devem ser processadas duas vezes.
- A regra se aplica especialmente a vendas, pagamentos, webhooks e integrações futuras.

---

# 14. Inteligência Artificial

A IA deve respeitar as mesmas regras de domínio do restante do sistema.

Decisões:

- IA não acessa nem modifica diretamente o banco.
- IA deve utilizar os mesmos serviços de domínio, permissões e validações usados pelos demais fluxos do sistema.
