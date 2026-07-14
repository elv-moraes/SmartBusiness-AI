# Arquitetura Geral do SmartBusiness AI

## Objetivo

Apresentar uma visão de alto nível da arquitetura do sistema.

---

## Diagrama

```text
                Usuário
                   │
                   ▼
        ┌─────────────────────┐
        │      Frontend       │
        │ React + TypeScript  │
        └──────────┬──────────┘
                   │ HTTPS
                   ▼
        ┌─────────────────────┐
        │      Backend        │
        │    NestJS + Node    │
        └──────────┬──────────┘
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
Autenticação   Regras de      Motor de IA
               Negócio

                   │
                   ▼
        ┌─────────────────────┐
        │     PostgreSQL      │
        └─────────────────────┘

                   │
                   ▼
        Integrações Futuras

• WhatsApp
• PIX
• Bancos
• Marketplaces
• Nota Fiscal
• API Pública
```

---

## Responsabilidades

### Frontend

Responsável pela interface utilizada pelo empreendedor.

---

### Backend

Responsável por toda a lógica do sistema.

Nenhuma regra de negócio ficará no Frontend.

---

### Banco de Dados

Responsável pelo armazenamento de todas as informações da empresa.

---

### Motor de IA

Responsável por:

- analisar dados;
- detectar padrões;
- gerar recomendações;
- criar alertas;
- automatizar tarefas mediante autorização do usuário.

---

## Princípios

- Separação clara de responsabilidades.
- Arquitetura preparada para crescimento.
- IA integrada ao sistema desde a primeira versão.
- Segurança em primeiro lugar.
- Escalabilidade como requisito desde o início.