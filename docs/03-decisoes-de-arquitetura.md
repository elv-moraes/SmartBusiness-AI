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
- RLS será uma segunda barreira de proteção no PostgreSQL, não um substituto dos filtros da aplicação.
- O primeiro rollout de RLS foi habilitado e validado no PostgreSQL local somente em `public.categories`.
- As quatro policies (`categories_select`, `categories_insert`, `categories_update`, `categories_delete`) são direcionadas exclusivamente a `smartbusiness_app`.
- `ENABLE ROW LEVEL SECURITY` está ativo; `FORCE ROW LEVEL SECURITY` permanece desabilitado. O runtime, que não é owner e não possui bypass, está submetido ao RLS.
- O runtime da API não deve ser owner das tabelas protegidas e deve permanecer com `BYPASSRLS=false`.
- O contexto de empresa para RLS será obtido de `app.company_id`, definido dentro da transação.
- As policies devem usar a forma defensiva `NULLIF(current_setting('app.company_id', true), '')::uuid`.
- A ausência de contexto deve resultar em comportamento fail closed.
- A implementação deve considerar corretamente Prisma, transações e pool de conexões.
- `users` exige tratamento especial, porque o login ocorre antes de existir `companyId` autenticado.
- A solução definitiva de login pré-tenant será implementada antes de habilitar RLS em `users`.
- Não implementar uma solução de RLS insegura apenas para cumprir a decisão.

## 10.1. Contexto transacional multiempresa

O `PrismaService` possui o helper `withCompanyContext(companyId, callback)` para executar operações com contexto de empresa usado pelo RLS de `categories`.

Decisões:

- O contexto da empresa é definido dentro de uma transação Prisma interativa.
- O PostgreSQL recebe o contexto por `set_config('app.company_id', ..., true)`.
- O terceiro argumento `true` torna o valor LOCAL à transação.
- Nunca usar `SET` de sessão global para `companyId`.
- Todas as queries protegidas por esse padrão devem usar o mesmo `TransactionClient` recebido no callback.
- O `companyId` não deve ser armazenado como estado mutável no `PrismaService`.
- Os filtros explícitos por `companyId` continuam existindo na aplicação.
- RLS em `categories` é uma segunda barreira, não substituto dos filtros da aplicação.

O rollout local e os testes automatizados estão registrados em [RLS de categorias](banco-de-dados/02-rls-categories.md). Ausência de contexto (inclusive valor vazio após reutilização de conexão) é fail closed. RLS em `users` continua pendente do fluxo seguro de login pré-tenant.

## 10.2. Separação entre runtime e migrations

Os privilégios do PostgreSQL foram separados entre runtime HTTP e execução de migrations.

`smartbusiness_app`:

- Usado pelo NestJS/runtime.
- Possui `LOGIN`.
- Não é owner do banco nem das tabelas.
- Usa `NOCREATEDB`.
- Usa `NOCREATEROLE`.
- Usa `NOBYPASSRLS`.
- Não possui `CREATE` no schema `public`.
- Não possui `TRUNCATE`, `REFERENCES` ou `TRIGGER`.
- Possui `SELECT`, `INSERT`, `UPDATE` e `DELETE` somente nas tabelas de aplicação necessárias.
- Não possui acesso a `_prisma_migrations`.

`smartbusiness_migrate`:

- Usado somente pelo Prisma CLI/migrations.
- É owner do banco e dos objetos gerenciados pelo Prisma.
- Controla `_prisma_migrations`.
- Possui `CREATEDB` permitido no ambiente local/dev por causa de eventual shadow database.
- Sua credencial não é usada pelo backend HTTP.

## 10.3. Variáveis de conexão

As conexões de runtime e migrations são separadas por variáveis diferentes.

Decisões:

- `DATABASE_URL` é usada pelo runtime `smartbusiness_app` no NestJS.
- `MIGRATION_DATABASE_URL` é usada pelo `smartbusiness_migrate` no Prisma CLI.
- O Prisma CLI deve falhar se `MIGRATION_DATABASE_URL` não existir.
- Não há fallback para `DATABASE_URL`.
- Valores reais de conexão permanecem fora do Git.

## 10.4. Default privileges

Objetos futuros criados por `smartbusiness_migrate` no schema `public` devem receber privilégios mínimos para o runtime.

Decisões:

- Tabelas futuras recebem `SELECT`, `INSERT`, `UPDATE` e `DELETE` para `smartbusiness_app`.
- Sequences futuras recebem `USAGE` e `SELECT` para `smartbusiness_app`.
- Não conceder `CREATE`, `TRUNCATE`, `REFERENCES` ou `TRIGGER` por default ao runtime.

## 10.5. Products

Products está protegido por RLS com o mesmo contexto transacional de Categories, quatro policies exclusivas de `smartbusiness_app` e ausência de contexto fail closed. FORCE continua desabilitado. A FK `(company_id, category_id)` referencia `categories(company_id, id)` com DELETE/UPDATE RESTRICT, impedindo categoria de outra empresa também no banco.

O rollout usa duas migrations. A estrutural revoga DML do runtime na nova tabela; a seguinte instala RLS/policies e concede apenas SELECT/INSERT/UPDATE/DELETE na mesma transação. Assim, falhar entre migrations não expõe a tabela sem RLS. Atributos Git preservam os bytes dos arquivos SQL para evitar divergência de checksum causada por `core.autocrlf`.

RLS global permanece incompleto; `users` e login pré-tenant continuam pendentes. Detalhes: [RLS de produtos](banco-de-dados/03-rls-products.md).

---

# 11. Concorrência e integridade

Operações críticas devem preservar integridade mesmo com acessos concorrentes.

Decisões:

- Usar optimistic locking para edições concorrentes quando aplicável.
- Usar transações curtas para operações críticas.
- Usar atualizações atômicas de estoque.
- Usar bloqueio pessimista somente quando necessário.
- Conflitos detectados devem resultar em resposta apropriada, como 409 quando aplicável.

Implementado em Products: PATCH exige `version`; UPDATE condiciona atomicamente `id`, `companyId` e `version`, incrementando a versão em um. Retorna 409 se a versão ficou desatualizada e 404 se o produto não pertence ao tenant ou não existe. Não há locking pessimista explícito no CRUD. Categoria é validada no mesmo TransactionClient. Essa implementação não conclui concorrência de estoque/vendas.

---

# 12. Estoque auditável

O estoque deve ser tratado como uma operação de domínio auditável.

Decisões:

- Estoque não deve ser alterado por simples substituição do saldo.
- Entrada, venda, ajuste, perda, devolução e cancelamento devem gerar movimentações.
- Manter histórico suficiente para auditoria.
- A quantidade atual pode existir para leitura rápida, mas deve permanecer consistente com as operações registradas.

No CRUD de Products, `stockQuantity` inicia em zero, não pertence aos DTOs de criação/edição e campos proibidos retornam 400. `minimumStock` é configuração editável. As quantidades deste contrato são inteiros não negativos. Não há endpoint de saldo nem movimentações neste bloco. Produtos são desativados via `isActive`, sem DELETE HTTP.

Preços de Products são persistidos em Decimal(12,2). Entrada monetária aceita somente strings decimais não negativas com até duas casas; saída sempre usa duas casas. Não há conversão para Number nem cálculos financeiros em ponto flutuante. [Contrato completo](especificacoes/02-produtos.md).

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
