# Produtos — contrato implementado

Módulo NestJS Products implementado e validado no PostgreSQL local. Não inclui Movimentações de Estoque.

## Modelo

| Campo | Tipo / regra |
| --- | --- |
| id | UUID v4 gerado pelo Prisma |
| companyId | UUID obrigatório, obtido do JWT |
| categoryId | UUID obrigatório; categoria da mesma empresa |
| name | Texto com trim, 2–120 caracteres |
| internalCode | Texto opcional/null, trim, 1–64 caracteres quando informado |
| purchasePrice | Decimal(12,2) opcional/null, não negativo |
| salePrice | Decimal(12,2) obrigatório, não negativo |
| stockQuantity | Inteiro não negativo, criado como zero, somente leitura na API |
| minimumStock | Inteiro de 0 a 2147483647, default 0 |
| isActive | Boolean, default true |
| version | Inteiro, default 1; edição exige versão lida |
| createdAt / updatedAt | Timestamps administrados pelo backend |

`internalCode` é único por empresa, com comparação sensível a maiúsculas/minúsculas. Empresas diferentes podem repetir códigos; vários produtos sem código são permitidos. Null limpa o código ou purchasePrice em PATCH. Null é rejeitado para os demais campos editáveis. Nome não é único.

## Dinheiro

Entradas monetárias são strings, por exemplo `"0"`, `"0.1"`, `"12.30"`. Faixa: 0 a 9999999999.99, até duas casas. Números JSON, negativos, notação exponencial, vírgulas e casas excedentes são rejeitados, sem arredondamento silencioso na API. Saídas são strings de duas casas (`"0.10"`, `"12.30"`); purchasePrice ausente é null. Nenhuma conversão para ponto flutuante é feita no service.

## Rotas e permissões

| Rota | OWNER | MANAGER | EMPLOYEE |
| --- | --- | --- | --- |
| POST /products | Sim | Sim | Não |
| GET /products | Sim | Sim | Sim |
| GET /products/:id | Sim | Sim | Sim |
| PATCH /products/:id | Sim | Sim | Não |

Todas exigem autenticação. Não existe DELETE /products. Desativação usa PATCH com `isActive: false` e `version`. Produtos inativos continuam consultáveis; usar filtro para restringir a listagem.

Criação:

```json
{
  "categoryId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Café",
  "internalCode": "CAFE-01",
  "purchasePrice": "8.10",
  "salePrice": "12.30",
  "minimumStock": 5
}
```

Edição:

```json
{ "version": 1, "salePrice": "13.00", "isActive": false }
```

A resposta expõe todos os campos do modelo, inclusive `version` e `stockQuantity`. O ValidationPipe global proíbe `companyId`, `stockQuantity`, `createdAt`, `updatedAt` e outros campos desconhecidos no body. `version` também é proibido na criação. O service seleciona explicitamente os campos graváveis; não espalha o body nos dados Prisma.

## Paginação

GET /products aceita `page` (default 1, máximo 21474836 para limitar offset), `limit` (default 20, 1–100), `search` (até 120 caracteres; nome ou código, sem distinguir maiúsculas), `categoryId` (UUID v4) e `isActive` (`true`/`false`). O filtro falso não é convertido para verdadeiro por coerção. Ordenação: name ASC e id ASC.

Resposta: `{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 } }`. Sem resultados, totalPages é zero. Queries da página e contagem usam o mesmo TransactionClient com filtros explícitos por empresa. Paginação por offset não congela um catálogo que esteja sendo alterado entre requisições.

## Concorrência e erros

PATCH exige versão inteira positiva (até 2147483646, permitindo o incremento). UPDATE usa simultaneamente id, companyId e version no WHERE e incrementa version atomicamente. Duas edições da mesma versão não sobrescrevem silenciosamente uma à outra: uma vence e a outra recebe 409. Até PATCH somente com version incrementa a versão. A transação mantém a gravação e a leitura da resposta juntas.

- 400: DTO, query ou UUID inválido; campos proibidos; valores negativos/inválidos.
- 401: autenticação ausente/inválida.
- 403: EMPLOYEE tentando escrever.
- 404: produto/categoria ausente ou de outra empresa.
- 409: versão desatualizada, código duplicado ou categoria removida concorrentemente entre validação e FK.

Excluir categoria referenciada por produtos retorna 409 amigável; inclusive produtos inativos preservam a referência. A FK impede exclusão física da categoria. Detalhes internos de Prisma/PostgreSQL não são expostos nas mensagens desses conflitos.

## Estoque e integridade

Saldo é zero na criação e não é editável por este CRUD. Não há endpoint de set stock ou venda. Quantidades fracionárias não fazem parte deste contrato. O módulo separado de [Movimentações de Estoque](03-movimentacoes-de-estoque.md) atualiza o saldo por operações transacionais e auditáveis, sem incrementar version dos metadados. A constraint não negativa continua como proteção adicional.

FK composta, unicidade, CHECKs e RLS estão descritos em [Banco e RLS de Products](../banco-de-dados/03-rls-products.md).

## Verificação

118 testes unitários em 16 suítes e 35 E2E/integração em 3 suítes: 153 aprovados. Incluem testes existentes de Categories/RLS, ProductsService/Controller, DTOs e cenários A–O no PostgreSQL real. E2E também passou com ordem aleatória (seed 20261101). Lint sem erros/avisos e build aprovado.

Os resultados acima registram o rollout original de Products. Movimentações manuais de Estoque foram implementadas posteriormente (Issue #3). RLS de users/login pré-tenant, Vendas e idempotência global continuam pendentes.
