# LojinhaDev — loja de periféricos

Loja virtual de periféricos de informática com login, catálogo, carrinho e
uma área para o profissional cadastrar produtos e controlar o estoque.

## Funcionalidades

**Login** (`/`)
- Entrar com e-mail e senha, ou criar uma conta de cliente.
- Quem não está logado é mandado de volta para o login.

**Consumidor** (`/loja`)
- Catálogo com busca e filtro por categoria.
- Cada produto mostra **quantas unidades há em estoque** (verde, amarelo quando há poucas, vermelho quando está esgotado).
- **Adicionar ao carrinho** ou **Comprar agora** (compra só aquele produto).
- No carrinho dá para usar + / −, remover itens e ver o total. O carrinho fica salvo no navegador.
- Antes de fechar a compra aparece uma tela de confirmação. Em **Meus pedidos** fica o histórico.

**Profissional** (`/admin`)
- Resumo da loja: produtos, unidades em estoque, esgotados, pedidos e faturamento.
- Cadastro de produtos com ícone, nome, categoria, descrição, preço e quantidade.
- Ajuste rápido do estoque (−1, +1, +10), edição e exclusão de produtos.
- Lista dos últimos pedidos de todos os clientes.

## Contas de demonstração

| Perfil       | E-mail            | Senha      |
|--------------|-------------------|------------|
| Profissional | admin@loja.com    | admin123   |
| Cliente      | cliente@loja.com  | cliente123 |

Para criar outra conta de profissional:

```
.venv\Scripts\activate
flask --app app criar-admin
```

## Como executar

Atalho no Windows: dê dois cliques em **`iniciar.bat`**. Ele cria a `.venv`, instala as dependências e inicia o servidor.

Passo a passo manual:

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Depois, abra **http://localhost:8080** no navegador.

> As páginas precisam ser abertas pelo servidor Python. Se você abrir o `index.html` direto no navegador, o login e o estoque não funcionam.

Para zerar a loja (produtos, pedidos e usuários), pare o servidor e apague a pasta `instance/`. Ela é recriada com os dados de exemplo.

## Estrutura

```
app.py            Servidor Flask: páginas, API, login e regras de negócio
database.py       Banco SQLite (tabelas e dados iniciais)
login.html        Tela de login / cadastro
index.html        Catálogo e carrinho (consumidor)
admin.html        Área do profissional
scripts/          JavaScript de cada página (+ comum.js compartilhado)
style/global.css  Estilos (tema escuro)
instance/         Banco de dados e chave secreta, criados automaticamente (fora do git)
```

## Regras importantes no servidor

- **O preço e o estoque são validados no servidor.** O navegador só manda o id do produto e a quantidade, e o total é calculado com o preço do banco.
- **A compra é feita em uma transação.** Se um item não tiver estoque, nada é baixado. Duas pessoas comprando ao mesmo tempo não conseguem levar a mesma última unidade.
- As senhas são guardadas com hash e nunca em texto puro.
- O cliente não acessa a área do profissional, nem pela página nem pela API.
- Um produto excluído some da loja, mas continua aparecendo nos pedidos antigos.

## Tecnologias

HTML, CSS e JavaScript no front-end. Python (Flask) e SQLite no back-end.
