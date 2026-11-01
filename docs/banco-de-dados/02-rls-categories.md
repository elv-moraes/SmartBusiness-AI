# Rollout local de RLS em categories

Validado em 31/10/2026. Escopo exclusivo: `public.categories`.

## Estado instalado

Migration: `20261031000000_enable_categories_rls`. Aplicada com `prisma migrate deploy`, usando `MIGRATION_DATABASE_URL`; registrada como concluída em `_prisma_migrations`. As migrations anteriores foram preservadas.

- Owner: `smartbusiness_migrate`.
- RLS habilitado; FORCE RLS desabilitado.
- Runtime: `smartbusiness_app`, via `DATABASE_URL`, sem superuser, sem BYPASSRLS e sem acesso a `_prisma_migrations`.
- Runtime possui SELECT, INSERT, UPDATE e DELETE em categories, sem TRUNCATE, REFERENCES ou TRIGGER.
- Nenhuma policy para PUBLIC, SECURITY DEFINER ou bypass foi introduzido.

| Policy | Operação | Predicados |
| --- | --- | --- |
| `categories_select` | SELECT | USING |
| `categories_insert` | INSERT | WITH CHECK |
| `categories_update` | UPDATE | USING e WITH CHECK |
| `categories_delete` | DELETE | USING |

Todas se destinam exclusivamente a `smartbusiness_app`, com o predicado:

```sql
company_id = NULLIF(current_setting('app.company_id', true), '')::uuid
```

Ausência de contexto e string vazia são fail closed. O owner continua fora do RLS porque FORCE não foi habilitado; sua conexão é exclusiva das migrations, nunca do runtime HTTP.

## Integração preservada

O controller obtém `companyId` do JWT. O service mantém os filtros explícitos e usa `withCompanyContext(companyId, callback)`: `set_config('app.company_id', ..., true)` dentro da transação e queries no mesmo TransactionClient. Nenhuma alteração no fluxo de login/users foi necessária.

## Evidências automatizadas

`backend/test/categories-rls.e2e-spec.ts` usa o PostgreSQL real com a role runtime, sem simular RLS. As consultas SQL dos testes de isolamento não adicionam filtro por empresa, comprovando a barreira do banco.

| Cenário | Resultado |
| --- | --- |
| A — sem contexto | Zero linhas, inclusive conexão nova e contexto vazio |
| B — empresa correta | A vê sua categoria |
| C — empresa errada | B não vê a categoria de A |
| D — INSERT correto | Permitido |
| E — INSERT cruzado | Bloqueado, SQLSTATE 42501 |
| F — UPDATE cruzado | Zero linhas alteradas |
| G — alteração de tenant | Bloqueada por WITH CHECK, SQLSTATE 42501 |
| H — DELETE cruzado | Zero linhas excluídas |
| I — API normal | CRUD HTTP autenticado, 400 para companyId no body, 401 sem token, 403 para escrita de EMPLOYEE, 404 entre empresas e 409 para duplicidade |
| J — concorrência | 20 transações Prisma concorrentes entre A/B; rollback e operações alternadas em conexão reutilizada sem vazamento |

Também são verificados owner, flags de RLS, quatro policies e bloqueio de acesso à tabela de migrations. JWTs dos testes são emitidos em memória pelo JwtService real; o teste não altera usuários, senhas nem o fluxo de login.

Fixtures usam UUIDs novos para duas empresas. Escritas SQL de teste são revertidas; fixtures necessárias ao HTTP são removidas no teardown por seus IDs de empresa. O teardown confirma a remoção das empresas. Nenhum dado estável é alvo da limpeza. Interrupção abrupta do processo pode impedir teardown; nesse caso, identificar explicitamente os IDs da execução antes de qualquer limpeza manual.

## Reprodução e verificações

Em `backend`, com as variáveis locais já configuradas (não imprimir seus valores):

```text
npx.cmd prisma validate
npx.cmd prisma migrate deploy
npx.cmd prisma migrate status
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
npm.cmd run build
```

Em outros shells, `npm`/`npx` podem substituir `npm.cmd`/`npx.cmd`. Os testes RLS recusam URLs fora de localhost/loopback e exigem o runtime `smartbusiness_app`; não são silenciosamente ignorados sem banco.

Resultados: schema válido; quatro migrations aplicadas e banco atualizado; lint sem erros; 58 testes unitários em 13 suítes e 12 testes E2E/integração em duas suítes aprovados (70 testes no total); build aprovado.

O script E2E habilita `--experimental-vm-modules`, necessário para os imports dinâmicos do Prisma instalado no Jest. O Node emite o aviso experimental correspondente. O teste E2E antigo da raiz foi atualizado para o contrato JSON já existente; o endpoint não foi alterado.

## Pendências

RLS global não está concluído. `users` permanece pendente porque login ocorre antes de existir companyId autenticado. Nenhuma expansão para Products, mudança de arquitetura de autenticação ou alteração de produção faz parte deste rollout.
