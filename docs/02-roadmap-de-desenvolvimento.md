# Roadmap de Desenvolvimento

## Objetivo

Este documento registra a ordem planejada para o desenvolvimento do SmartBusiness AI.

Ele serve para:

- indicar o que já foi concluído;
- mostrar a etapa atual;
- organizar as próximas funcionalidades;
- evitar que decisões importantes dependam apenas das conversas;
- manter o desenvolvimento alinhado à arquitetura do produto.

Este roadmap poderá ser atualizado conforme o projeto evoluir.

---

# Legenda

- ✅ Concluído
- 🚧 Em desenvolvimento
- ⏳ Planejado
- 🔮 Futuro

---

# Fase 1 — Fundação do Projeto

## 1. Visão e documentação inicial ✅

- Definição do produto
- Público-alvo
- Proposta de valor
- Decisões de arquitetura
- Modelo de domínio
- Jornada do usuário
- Criação do repositório GitHub

## 2. Estrutura inicial do backend ✅

- Criação do backend com NestJS
- Configuração do TypeScript
- Criação da rota principal
- Criação da rota de saúde da API
- Configuração de lint, build e testes

## 3. Banco de dados e Prisma ✅

- Instalação do PostgreSQL
- Criação do banco `smartbusiness_ai`
- Criação do usuário da aplicação
- Integração do Prisma com NestJS
- Configuração do Prisma Client
- Criação da primeira migration

---

# Fase 2 — Estrutura Multiempresa

## 4. Empresas ✅

- Modelo `Company`
- Migration da tabela de empresas
- DTOs de criação e atualização
- Validação dos dados recebidos
- CRUD completo de empresas
- Testes unitários
- Testes reais com PostgreSQL

## 5. Usuários e vínculo com empresas 🚧

- Criar modelo `User`
- Relacionar usuários e empresas
- Definir os papéis iniciais dos usuários
- Criar migration
- Criar módulo de usuários
- Criar DTOs
- Criar CRUD de usuários
- Garantir que cada usuário pertença a uma empresa
- Criar testes

Papéis iniciais previstos:

- Proprietário
- Gerente
- Funcionário

## 6. Autenticação e autorização ⏳

- Cadastro seguro de senha
- Criptografia de senha
- Login
- JWT
- Rotas protegidas
- Identificação do usuário autenticado
- Identificação da empresa do usuário
- Controle inicial de permissões
- Impedir acesso aos dados de outra empresa

---

# Fase 3 — Catálogo e Estoque

## 7. Categorias ⏳

- Cadastro de categorias
- Vinculação com a empresa
- CRUD de categorias
- Isolamento multiempresa
- Testes

## 8. Produtos ⏳

- Cadastro de produtos
- Preço de compra
- Preço de venda
- Categoria
- Código interno
- Estoque atual
- Estoque mínimo
- Status ativo ou inativo
- Isolamento multiempresa
- Testes

## 9. Movimentações de estoque ⏳

- Entrada de estoque
- Saída por venda
- Ajuste manual
- Perda
- Devolução
- Histórico de movimentações
- Proibição de alteração de estoque sem movimentação
- Alertas de estoque baixo

---

# Fase 4 — Relacionamentos Comerciais

## 10. Clientes ⏳

- Cadastro de clientes
- Histórico de compras
- Dados de contato
- Clientes ativos e inativos
- Análises futuras da IA

## 11. Fornecedores ⏳

- Cadastro de fornecedores
- Dados de contato
- Produtos fornecidos
- Base para compras e reposição de estoque

---

# Fase 5 — Vendas

## 12. Vendas e itens da venda ⏳

- Registro de vendas
- Inclusão de vários produtos
- Quantidade vendida
- Preço no momento da venda
- Descontos
- Total da venda
- Atualização automática do estoque
- Cancelamento controlado
- Histórico completo

## 13. Pagamentos ⏳

- Dinheiro
- PIX
- Cartão
- Transferência
- Mais de uma forma de pagamento por venda
- Situação do pagamento

---

# Fase 6 — Gestão Financeira

## 14. Movimentações financeiras ⏳

- Entradas
- Saídas
- Origem da movimentação
- Histórico financeiro
- Rastreabilidade

## 15. Contas a pagar e receber ⏳

- Cadastro de despesas futuras
- Cadastro de valores a receber
- Datas de vencimento
- Situação de pagamento
- Alertas de vencimento

## 16. Balanço e relatórios ⏳

- Resultado diário
- Resultado de períodos anteriores
- Receita
- Despesas
- Lucro estimado
- Produtos mais vendidos
- Estoque crítico

---

# Fase 7 — Inteligência Artificial

## 17. Serviço de Inteligência Artificial ⏳

- Criar uma camada isolada para provedores de IA
- Preparar integração com modelos externos
- Evitar dependência direta de um único fornecedor
- Controlar custos e consumo
- Proteger dados sensíveis

## 18. Alertas e recomendações da IA ⏳

- Estoque baixo
- Queda nas vendas
- Crescimento das despesas
- Produtos parados
- Clientes inativos
- Sugestões de promoção
- Recomendações de reposição
- Resumo inteligente do negócio

## 19. Notificações no final do expediente ⏳

- Identificar o horário de funcionamento da empresa
- Gerar resumo próximo ao encerramento
- Mostrar informações do dia
- Comparar com dias anteriores
- Evitar notificações desnecessárias

---

# Fase 8 — Frontend

## 20. Fundação do frontend ⏳

Tecnologias planejadas:

- React
- TypeScript
- Vite
- Tailwind CSS

Atividades:

- Criar estrutura do frontend
- Configurar comunicação com a API
- Criar sistema visual
- Criar navegação
- Criar tratamento de erros
- Criar estados de carregamento

## 21. Telas principais ⏳

- Cadastro
- Login
- Painel principal
- Empresas
- Usuários
- Categorias
- Produtos
- Estoque
- Clientes
- Vendas
- Financeiro
- Alertas da IA
- Configurações

---

# Fase 9 — Qualidade, Segurança e Publicação

## 22. Qualidade e segurança ⏳

- Ampliar testes unitários
- Criar testes de integração
- Criar testes de ponta a ponta
- Revisar validações
- Padronizar tratamento de erros
- Revisar permissões
- Revisar isolamento multiempresa
- Atualizar dependências de forma controlada
- Criar logs seguros
- Impedir exposição de dados confidenciais

## 23. Integração contínua ⏳

- Configurar GitHub Actions
- Executar lint automaticamente
- Executar testes automaticamente
- Executar build automaticamente
- Impedir integração de código com erros

## 24. Publicação ⏳

- Preparar ambiente de produção
- Hospedar banco de dados
- Hospedar backend
- Hospedar frontend
- Configurar domínio
- Configurar HTTPS
- Configurar variáveis de ambiente
- Criar backups
- Monitorar disponibilidade e erros

---

# Fase 10 — Expansões Futuras

## 25. Integrações externas 🔮

- WhatsApp
- PIX
- Bancos
- Emissão de notas fiscais
- Marketplaces
- Sistemas contábeis

## 26. Novos segmentos 🔮

- Restaurantes
- Prestadores de serviços
- Pequenas indústrias
- Outros tipos de negócios

---

# Etapa Atual

A etapa atual do SmartBusiness AI é:

> **Fase 2 — Usuários e vínculo com empresas**

O próximo objetivo técnico é criar o modelo `User` no Prisma e estabelecer sua relação com o modelo `Company`.