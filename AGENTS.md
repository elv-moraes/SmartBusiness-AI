# AGENTS.md

## Contexto do Projeto

- O produto atual se chama Business AI.
- O repositório/pasta ainda pode se chamar SmartBusiness-AI.
- O sistema é um SaaS multiempresa de gestão para empreendedores.
- O backend usa NestJS + TypeScript.
- O banco de dados usa PostgreSQL + Prisma.
- O frontend planejado usa React + TypeScript + Vite + Tailwind CSS.
- A etapa atual do roadmap é a Fase 3: Catálogo e Estoque.
- O próximo objetivo técnico indicado pelo roadmap é implementar o módulo de categorias.

## Regras de Arquitetura e Segurança

- Todo dado pertencente a uma empresa deve respeitar isolamento multiempresa.
- Nunca confiar em `companyId` enviado pelo cliente quando a empresa puder ser obtida do usuário autenticado.
- Nas rotas autenticadas, `companyId` deve ser derivado do JWT/request.user.
- Os papéis atuais são `OWNER`, `MANAGER` e `EMPLOYEE`.
- Aplicar autorização de forma explícita e evitar escalada de privilégios.
- Senhas devem permanecer protegidas com Argon2 e nunca ser retornadas pela API.
- Segredos e variáveis de ambiente nunca devem ser exibidos, commitados ou adicionados ao código.
- Preservar o `ValidationPipe` global e as validações por DTO.

## Prisma e Banco de Dados

- Para alterações do Prisma, primeiro validar e formatar o schema antes de criar migrations.
- Não executar migrations destrutivas sem autorização explícita.
- Manter relações multiempresa explícitas nos modelos que pertencem a uma empresa.
- Preferir índices e restrições que reforcem isolamento, unicidade e integridade dos dados.

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
