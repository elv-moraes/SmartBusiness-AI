# Entidade: Empresa

## Objetivo

Representa a empresa que utiliza o SmartBusiness AI.

Toda informação cadastrada no sistema pertence obrigatoriamente a uma empresa.

A entidade Empresa é a base da arquitetura multiempresa (multi-tenant).

---

# Campos

| Campo | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| id | UUID | Sim | Identificador único da empresa |
| nome_fantasia | Texto | Sim | Nome comercial |
| razao_social | Texto | Não | Razão social |
| cnpj | Texto | Não | Cadastro Nacional da Pessoa Jurídica |
| segmento | Texto | Sim | Segmento da empresa |
| email | Texto | Sim | E-mail principal |
| telefone | Texto | Não | Telefone |
| horario_abertura | Hora | Sim | Início do expediente |
| horario_fechamento | Hora | Sim | Encerramento do expediente |
| fuso_horario | Texto | Sim | Fuso utilizado |
| plano | Texto | Sim | Gratuito, Pro ou Premium |
| ativo | Boolean | Sim | Situação da empresa |
| criado_em | Data/Hora | Sim | Data de criação |
| atualizado_em | Data/Hora | Sim | Última atualização |

---

# Relacionamentos

Uma empresa possui:

- vários usuários;
- vários clientes;
- vários produtos;
- vários fornecedores;
- várias vendas;
- várias movimentações financeiras;
- várias movimentações de estoque;
- vários alertas da IA.

---

# Regras de Negócio

- Nenhum dado poderá existir sem estar vinculado a uma empresa.
- Usuários pertencem a apenas uma empresa.
- Todos os horários utilizarão o fuso horário configurado.
- Empresas inativas não poderão acessar o sistema.

---

# Observações

No futuro poderão existir recursos específicos conforme o plano contratado.

A arquitetura deverá permitir expansão sem alterações estruturais.