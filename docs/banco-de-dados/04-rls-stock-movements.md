# Banco e RLS do ledger de estoque

## Migrations locais

- `20261101030000_add_stock_movements`: enum manual, índice único products(company_id,id), tabela stock_movements, constraints, FKs, índices e revogação de todos os privilégios do runtime na nova tabela.
- `20261101030001_enable_stock_movements_rls`: ENABLE RLS, policies e concessão somente de SELECT/INSERT.

Oito migrations registradas como concluídas, com checksums conferidos. Nenhuma migration anterior alterada. Prisma format/validate aprovados; migrate status atualizado; diff estrutural banco/schema vazio. Policies/CHECKs foram auditados no catálogo separadamente.

## Integridade

PK UUID; FK company_id para companies.id; FK composta (company_id,product_id) para products(company_id,id), ambas DELETE/UPDATE RESTRICT. Isso impede movimentos ligados a produto de outro tenant e preserva o produto referenciado.

Índice único (company_id,idempotency_key); índices de listagem (company_id,created_at,id) e (company_id,product_id,created_at,id). CHECKs exigem quantidade positiva, saldos não negativos, chave não vazia/sem espaços externos, nota opcional normalizada e coerência aritmética entre tipo, quantidade e saldos. O CHECK aritmético converte para bigint para evitar overflow durante a avaliação, mantendo armazenamento INTEGER.

## RLS e privilégios auditados

Owner: smartbusiness_migrate. Runtime: smartbusiness_app, sem superuser/BYPASSRLS, sem acesso a _prisma_migrations. RLS ativo, FORCE inativo.

| Policy | Operação | Predicado |
| --- | --- | --- |
| stock_movements_select | SELECT | USING |
| stock_movements_insert | INSERT | WITH CHECK |

Ambas exclusivamente para smartbusiness_app, usando `company_id = NULLIF(current_setting('app.company_id', true), '')::uuid`. Sem contexto ou string vazia: fail closed. Sem PUBLIC, SECURITY DEFINER, bypass ou fallback.

Runtime possui apenas SELECT e INSERT. UPDATE, DELETE, TRUNCATE, REFERENCES e TRIGGER são negados. A etapa estrutural revoga inclusive DML concedido por default privileges; acesso somente é concedido junto com RLS na segunda migration. Falha entre as migrations não expõe ledger desprotegido. Não há policy de UPDATE/DELETE nem endpoints correspondentes.

Imutabilidade é garantida contra o runtime; o owner continua privilegiado sem FORCE. INSERT permitido ao runtime exige que operações humanas/IA/integrações passem pelo serviço de domínio para garantir saldo + ledger. RLS/constraints não substituem esse contrato: acesso SQL direto privilegiado não implementa o domínio automaticamente.

## Testes e fixtures

Todos os testes de comportamento usam smartbusiness_app real, inclusive Prisma. A conexão MIGRATION_DATABASE_URL é utilizada somente no teardown para remover fixtures próprias, porque conceder DELETE ao runtime enfraqueceria o ledger. URLs de testes devem apontar ao mesmo banco local, roles são conferidas e nenhum segredo é impresso.

Cada teste cria duas empresas e produtos com UUIDs exclusivos. A limpeza owner usa somente esses IDs, dentro de transação, na ordem ledger → products → categories → companies. Não altera dados estáveis nem privilégios. SQL de tentativas negativas usa rollback. Zero fixtures remanescentes na auditoria. Encerramento abrupto do processo pode impedir teardown; identificar explicitamente os IDs antes de uma eventual limpeza manual.

Rollback de domínio é testado provocando falha real de tamanho de nota no INSERT, após a atualização do saldo, sem mock de banco/RLS. Outro teste insere o movimento e força rollback da transação completa. Idempotência e saídas concorrentes são verificadas por saldo final, número de registros e cadeia dos saldos. [Resultados dos 23 itens](../especificacoes/03-movimentacoes-de-estoque.md).

## Comandos de reprodução

Em backend, com ambiente local configurado:

```text
npx.cmd prisma format
npx.cmd prisma validate
npx.cmd prisma migrate deploy
npx.cmd prisma generate
npx.cmd prisma migrate status
npx.cmd prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
npm.cmd run build
```

Resultados: 180 unitários + 64 E2E/integração = 244 aprovados; lint sem erros/avisos; build aprovado. Apenas aviso experimental de VM Modules já existente.

RLS global, users/login pré-tenant, Vendas e idempotência/concorrência globais permanecem pendentes.
