# Movimentações manuais de estoque — Issue #3

Implementação sobre a main `266c874`, validada no PostgreSQL local. Não inclui Vendas, SALE ou alertas.

## Modelo e regras

StockMovement contém id UUID, companyId UUID, productId UUID, type enum, quantity INTEGER positivo, previousQuantity/newQuantity INTEGER não negativos, note opcional até 500 caracteres, idempotencyKey até 128, createdByUserId UUID e createdAt. Relações explícitas com Company e FK composta `(companyId, productId)` para Product. Não há updatedAt: o registro não é editável.

| Tipo | Efeito |
| --- | --- |
| ENTRY | Soma quantity |
| ADJUSTMENT_IN | Soma quantity |
| ADJUSTMENT_OUT | Subtrai quantity |
| LOSS | Subtrai quantity |
| RETURN | Devolução de cliente, soma quantity |

Quantidade da requisição é sempre inteiro entre 1 e 2147483647. Tipo determina o sinal. Saldo não pode ficar negativo nem ultrapassar INTEGER. Note recebe trim; vazio, ausente e null representam ausência de nota.

## API

| Rota | OWNER/MANAGER | EMPLOYEE |
| --- | --- | --- |
| POST /stock-movements | Criar | Proibido (403) |
| GET /stock-movements | Ler | Ler |
| GET /stock-movements/:id | Ler | Ler |

Autenticação obrigatória. Não existem PATCH/DELETE HTTP. `companyId` e `createdByUserId` vêm exclusivamente de request.user.companyId/sub. Body não aceita esses campos, saldos, createdAt ou idempotencyKey. CORS existente continua permitindo Idempotency-Key.

Exemplo, com header `Idempotency-Key: recebimento-2026-001`:

```json
{
  "productId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "ENTRY",
  "quantity": 10,
  "note": "Recebimento conferido"
}
```

POST retorna 201 e todos os campos da movimentação, inclusive saldos anterior/novo e autor. Replay bem-sucedido mantém 201 e retorna o registro original, sem um novo efeito. O header é validado explicitamente no controller, pois @Headers do NestJS instalado não recebe pipes de parâmetros. São aceitos 1–128 caracteres ASCII imprimíveis sem espaços; a chave é opaca e sensível a maiúsculas.

## Idempotência e concorrência

Chaves têm unicidade por empresa. Depois de adquirir trava advisory transacional sobre empresa/chave, o service procura a movimentação anterior usando o TransactionClient e companyId explícito. Compara produto (UUID sem diferença de caixa), tipo, quantidade e nota normalizada. Diferença: 409. Mesmo comando: retorna original, preservando autor/data, mesmo se outro usuário autorizado reenviar.

Empresas diferentes podem reutilizar a mesma chave. A trava transacional não deixa estado de sessão após commit/rollback; colisões de hash podem causar espera extra, sem permitir acesso cruzado. A constraint única permanece como defesa adicional.

O saldo é alterado por UPDATE atômico com incremento/decremento e condições de saldo/capacidade, nunca por set de valor lido antes. RETURNING determina o novo saldo protegido pela escrita; previousQuantity deriva do delta. A mesma transação insere o ledger. Falha no INSERT reverte saldo e updatedAt. Falhas não consomem a chave. Product.version não muda; é exclusivo do optimistic locking de metadados. O teste concorrente de metadados e estoque verifica preservação de ambos.

Produto inativo não ganha bloqueio adicional para correções manuais. Autoria é registrada como UUID do JWT, sem FK para users; não altera autenticação e permite preservar histórico independentemente do ciclo de vida do usuário.

## Consulta e erros

Filtros: productId UUID v4, type, startDate/endDate ISO 8601 com horário e timezone explícitos, inclusivos. Data inicial posterior à final retorna 400. page default 1 (máximo 21474836), limit default 20, máximo 100. Ordenação determinística: createdAt DESC, id DESC. Resposta data/meta com page, limit, total, totalPages (zero se vazio). O timestamp segue o padrão transacional do banco; o par de saldos registra a sequência de alterações, não se deve inferir a ordem de bloqueios apenas do timestamp.

- 400: corpo/header/query inválido ou campo protegido.
- 401/403: autenticação/autorização.
- 404: produto ou movimento ausente/estrangeiro.
- 409: saldo insuficiente, capacidade INTEGER excedida ou chave usada com outro comando.

As mensagens de domínio não expõem SQL/Prisma. Paginação por offset não congela o catálogo entre requisições. Queries de página/contagem compartilham transação e filtros por empresa; em READ COMMITTED, escritas concorrentes podem alterar a contagem entre statements.

## Validação

244 testes aprovados: 180 unitários em 19 suítes e 64 E2E/integração em quatro suítes. Regressão inclui Categories, Products e seus RLS. E2E também aprovado em ordem aleatória, seed 20261102. Lint sem erros/avisos, build aprovado; somente o aviso conhecido de VM Modules.

| Item da Issue | Evidência |
| --- | --- |
| 1–3 | Sem contexto fail closed; conexão nova/vazia; apenas tenant correto vê registros |
| 4–5 | INSERT cruzado 42501; UPDATE/DELETE negados mesmo em registro próprio; grants auditados |
| 6–10 | Os cinco tipos alteram saldo e registram histórico correto; version preservada |
| 11–12 | Insuficiência 409 sem efeito; produto estrangeiro/ausente 404; FK composta 23503 |
| 13–14 | Falha real do INSERT após UPDATE e rollback após ambas as escritas restauram o estado |
| 15–16 | Replay normalizado tem um efeito; alterações de produto/tipo/quantidade/nota retornam 409 |
| 17 | Seis saídas simultâneas com mesma chave: um registro/efeito; payloads divergentes: um 201 e um 409 |
| 18 | Oito saídas de 3, saldo inicial 10: três sucessos, cinco conflitos, saldo final 1 e cadeia 10→7→4→1 |
| 19–20 | Roles, ausência de PATCH/DELETE, paginação e filtros inclusive limites de data |
| 21 | Tenants concorrentes compartilham chave sem colisão lógica; sobreposição real de transações e ausência de vazamento |
| 22–23 | Products continua rejeitando stockQuantity; metadata/stock concorrentes preservados; regressão anterior aprovada |

Também há testes de constraints, limite INTEGER, header ausente, campos forjados e limpeza. [Migrations, RLS e reprodução](../banco-de-dados/04-rls-stock-movements.md).

Pendentes: Vendas/SALE, alertas, RLS de users/login pré-tenant e idempotência/concorrência globais. O serviço de estoque está exportado pelo módulo para futura integração autorizada; nenhum fluxo de Vendas foi implementado.
