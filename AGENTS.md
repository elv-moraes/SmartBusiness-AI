# AGENTS.md

## Contexto do Projeto

- O produto atual se chama Business AI.
- O repositório/pasta ainda pode se chamar SmartBusiness-AI.
- O sistema é um SaaS multiempresa de gestão para empreendedores.
- O backend usa NestJS + TypeScript.
- O banco de dados usa PostgreSQL + Prisma.
- O frontend planejado usa React + TypeScript + Vite + Tailwind CSS.
- A etapa atual do roadmap é a Fase 3: Catálogo e Estoque.
- O módulo de categorias está concluído.
- O próximo objetivo técnico indicado pelo roadmap é realizar uma etapa curta de hardening de segurança e definição das regras de integridade/concorrência antes de iniciar o módulo de produtos.

## Regras de Arquitetura e Segurança

- Todo dado pertencente a uma empresa deve respeitar isolamento multiempresa.
- Nunca confiar em `companyId` enviado pelo cliente quando a empresa puder ser obtida do usuário autenticado.
- Nas rotas autenticadas, `companyId` deve ser derivado do JWT/request.user.
- Os papéis atuais são `OWNER`, `MANAGER` e `EMPLOYEE`.
- Proteger endpoints autenticados com autenticação e autorização.
- Aplicar autorização de forma explícita e evitar escalada de privilégios.
- Senhas devem permanecer protegidas com Argon2 e nunca ser retornadas pela API.
- Aplicar rate limiting, especialmente em autenticação.
- Configurar security headers e CORS explicitamente.
- Estudar/implementar RLS no PostgreSQL de forma compatível e segura com Prisma e pool de conexões.
- Nunca confiar apenas em filtros da aplicação para isolamento multiempresa quando houver uma proteção adicional viável no banco.
- Segredos e variáveis de ambiente nunca devem ser exibidos, commitados ou adicionados ao código.
- Preservar o `ValidationPipe` global e as validações por DTO.
- IA, integrações e automações nunca devem alterar o banco diretamente: devem passar pelos mesmos services, regras de negócio, autorização e validações das operações humanas.

## Prisma e Banco de Dados

- Para alterações do Prisma, primeiro validar e formatar o schema antes de criar migrations.
- Não executar migrations destrutivas sem autorização explícita.
- Manter relações multiempresa explícitas nos modelos que pertencem a uma empresa.
- Preferir índices e restrições que reforcem isolamento, unicidade e integridade dos dados.
- Alterações de estoque nunca devem ser feitas por simples sobrescrita da quantidade atual.
- Alterações de estoque devem ocorrer através de operações de domínio transacionais e gerar movimentação auditável.
- Vendas e operações que alteram estoque devem usar transações e atualizações atômicas.
- Usar optimistic locking/versionamento onde houver risco de sobrescrita concorrente de edições.
- Operações repetíveis críticas devem suportar idempotência quando aplicável.

## Git e Operações Sensíveis

- Não fazer `git commit`, `git push`, `git reset`, `git rebase` ou outras operações Git que alterem histórico/remoto sem autorização explícita.
- Não executar comandos destrutivos sem autorização explícita.
- Antes de editar, verificar o estado atual do Git quando a tarefa envolver mudanças em arquivos.
- Preservar alterações existentes que não foram feitas pelo Codex.

## Qualidade

- Preferir mudanças pequenas, verificáveis e compatíveis com a arquitetura existente.
- Antes de considerar uma implementação concluída, executar conforme aplicável:
  - lint;
  - testes;
  - build.
- Criar ou atualizar testes quando a mudança alterar regras de negócio, permissões, isolamento multiempresa ou contratos da API.
- Manter DTOs, services, controllers e modules seguindo os padrões já existentes no backend.

## Relatório ao Final de Cada Tarefa

Ao terminar uma tarefa, apresentar:

- arquivos criados;
- arquivos modificados;
- decisões tomadas;
- comandos executados;
- resultados dos testes;
- riscos ou pendências.
