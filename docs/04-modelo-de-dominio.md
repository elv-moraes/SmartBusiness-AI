# Modelo de Domínio

## Objetivo

O modelo de domínio descreve as principais entidades do SmartBusiness AI e como elas se relacionam.

Este documento servirá como base para a modelagem do banco de dados e para o desenvolvimento da aplicação.

---

# Princípio

O SmartBusiness AI não é apenas um sistema de gestão.

Seu objetivo é compreender o funcionamento da empresa para oferecer recomendações inteligentes ao empreendedor.

Por esse motivo, todas as entidades foram projetadas pensando na geração de conhecimento para a Inteligência Artificial.

---

# Principais Entidades

## Empresa

Representa a empresa que utiliza o sistema.

Cada empresa possui seus próprios usuários, clientes, produtos, vendas e informações financeiras.

Os dados de uma empresa nunca poderão ser acessados por outra.

---

## Usuário

Pessoa autorizada a utilizar o sistema.

Exemplos:

- Proprietário
- Gerente
- Funcionário

No futuro existirão diferentes níveis de permissão.

---

## Cliente

Pessoa ou empresa que realiza compras.

O sistema armazenará seu histórico para permitir análises inteligentes da IA.

---

## Fornecedor

Empresa responsável pelo fornecimento de produtos.

Será utilizado em compras futuras e na reposição automática de estoque.

---

## Categoria

Organiza os produtos em grupos.

Exemplo:

- Bebidas
- Limpeza
- Padaria
- Higiene

---

## Produto

Representa um item comercializado.

Cada produto possuirá informações como:

- preço de compra
- preço de venda
- margem de lucro
- estoque atual
- estoque mínimo

---

## Venda

Representa uma venda realizada.

Uma venda poderá possuir vários produtos.

---

## Item da Venda

Cada produto vendido será registrado individualmente.

Isso permitirá estatísticas detalhadas e análises da IA.

---

## Pagamento

Representa a forma como uma venda foi paga.

Exemplos:

- PIX
- Dinheiro
- Cartão
- Transferência

No futuro uma venda poderá possuir mais de um pagamento.

---

## Movimentação de Estoque

Todo movimento de estoque será registrado.

Exemplos:

- Compra
- Venda
- Ajuste
- Perda
- Devolução

O estoque nunca será alterado sem gerar uma movimentação.

---

## Movimentação Financeira

Toda entrada e saída financeira será registrada.

Isso permitirá rastreabilidade e geração de relatórios completos.

---

## Conta a Pagar

Representa despesas futuras da empresa.

---

## Conta a Receber

Representa valores que ainda serão recebidos.

---

## Alerta da IA

Representa recomendações geradas automaticamente pela Inteligência Artificial.

Exemplos:

- Estoque baixo
- Queda nas vendas
- Cliente inativo
- Aumento nas despesas
- Oportunidade de promoção

---

# Filosofia

Cada entidade existe para cumprir dois objetivos.

1. Registrar corretamente a operação da empresa.

2. Produzir informações que permitam à Inteligência Artificial ajudar o empreendedor na tomada de decisões.