# Banco e RLS de Products

## Migrations aplicadas localmente

1. `20261101000000_add_products`: tabela products, índice único `(company_id, internal_code)`, índices `(company_id, category_id)` e `(company_id, name, id)`, índice único adicional em categories `(company_id, id)`, FKs e CHECKs.
2. `20261101000001_enable_products_rls`: ENABLE ROW LEVEL SECURITY e quatro policies.

Não houve alteração SQL de migrations anteriores, reset ou remoção de dados estáveis. As seis migrations estão registradas como concluídas, com checksums conferidos. O diff estrutural Prisma entre banco e schema ficou vazio; CHECKs e policies também foram auditados diretamente no catálogo, pois não são representados integralmente pelo schema Prisma.

No checkout Windows, `core.autocrlf` havia convertido os bytes da migration antiga de categories. O arquivo foi restaurado exatamente a partir do commit original, após comparar seu hash com o registrado no banco. `.gitattributes` impede conversão automática dos arquivos SQL de migrations, preservando seus bytes versionados. Não houve alteração de seu SQL nem do registro Prisma.

## Integridade

- PK UUID em products.id.
- FK products.company_id → companies.id, DELETE/UPDATE RESTRICT.
- FK products.(company_id, category_id) → categories.(company_id, id), DELETE/UPDATE RESTRICT. Mesmo com erro na aplicação, uma categoria de outro tenant não satisfaz a FK.
- Código interno único por empresa (null permitido em múltiplos registros).
- CHECKs: nome não vazio (2–120 após trim); código opcional não vazio e sem espaços externos (1–64); preços não negativos e não NaN; estoque e mínimo não negativos; versão positiva.
- Preços Decimal(12,2); quantidades e versão INTEGER.

## Segurança e aplicação

Owner: `smartbusiness_migrate`. Runtime: `smartbusiness_app`, não owner, sem superuser/BYPASSRLS, sem acesso a `_prisma_migrations`. Runtime usa DATABASE_URL; Prisma CLI usa MIGRATION_DATABASE_URL, sem fallback.

RLS ativo, FORCE inativo. Policies exclusivas de smartbusiness_app:

| Policy | Operação | Predicados |
| --- | --- | --- |
| products_select | SELECT | USING |
| products_insert | INSERT | WITH CHECK |
| products_update | UPDATE | USING e WITH CHECK |
| products_delete | DELETE | USING |

Predicado em todas: `company_id = NULLIF(current_setting('app.company_id', true), '')::uuid`. Ausência de contexto ou valor vazio é fail closed. Sem PUBLIC, SECURITY DEFINER, bypass ou fallback.

Runtime possui apenas SELECT, INSERT, UPDATE e DELETE na tabela; não possui TRUNCATE, REFERENCES ou TRIGGER. A migration estrutural revoga o DML herdado dos default privileges até a migration seguinte instalar policies e conceder DML na mesma transação. Se o segundo passo falhar, a tabela permanece inacessível ao runtime. Não houve ampliação das classes de privilégios já previstas para tabelas de aplicação.

O service mantém filtros por companyId, usa withCompanyContext e executa inclusive a validação de categoria no mesmo TransactionClient. DELETE tem policy para operações administrativas controladas, mas não existe DELETE HTTP de produto.

## Evidências no PostgreSQL real

`backend/test/products.e2e-spec.ts` confirma a identidade runtime no pg e no Prisma, sem mocks de RLS. Fixtures novas por teste, UUIDs aleatórios e teardown restrito aos IDs criados; produtos são removidos antes de categorias e empresas. Operações SQL negativas usam rollback. Zero fixtures remanescentes após a regressão. Interrupção abrupta ainda pode impedir teardown; identificar os IDs da execução antes de limpeza manual.

| Cenário | Resultado |
| --- | --- |
| A | Sem contexto, conexão nova e contexto vazio: zero produtos visíveis |
| B | Empresa correta vê o próprio produto |
| C | Outra empresa não vê o produto |
| D | INSERT correto permitido, saldo default zero |
| E | INSERT cruzado bloqueado por RLS (42501) |
| F | UPDATE cruzado: zero linhas |
| G | Alteração de companyId bloqueada por WITH CHECK (42501) |
| H | DELETE cruzado: zero linhas |
| I | Categoria cruzada bloqueada pela FK em INSERT/UPDATE (23503), API retorna 404 |
| J | API autenticada cria, lê, edita, desativa e reativa; sem hard delete |
| K | EMPLOYEE somente leitura; MANAGER e OWNER podem escrever |
| L | Código duplicado no tenant: 409; mesmo código em outro tenant permitido |
| M | Dois PATCH concorrentes da mesma versão: exatamente um 200 e um 409 |
| N | Saldo zero na criação; campos proibidos no POST/PATCH: 400 |
| O | 20 transações concorrentes, sobreposição comprovada, sem vazamento após commit/rollback |

Outros testes verificam paginação/filtros, cinco constraints numéricas diretamente no banco, catálogo de policies, grants e conflito na exclusão de categoria referenciada.

## Reprodução

Em backend, com ambiente local configurado, sem imprimir credenciais:

```text
npx.cmd prisma format
npx.cmd prisma validate
npx.cmd prisma migrate deploy
npx.cmd prisma generate
npx.cmd prisma migrate status
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
npm.cmd run build
```

Resultados: format/validate aprovados, seis migrations aplicadas, lint sem erros/avisos, 118 testes unitários + 35 E2E/integração aprovados, build aprovado. O executor E2E mantém --experimental-vm-modules, com aviso experimental do Node já conhecido.

RLS global não concluído: users/login pré-tenant permanecem pendentes. Estoque auditável e movimentações não fazem parte deste bloco.
