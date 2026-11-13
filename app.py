"""LojinhaDev - servidor da loja de periféricos.

Execute com:  python app.py   (dentro da .venv)
Acesse:       http://localhost:8080
"""
import os
import re
import secrets
from functools import wraps
from pathlib import Path

import click
from flask import Flask, jsonify, redirect, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash

import database

RAIZ = Path(__file__).resolve().parent
PASTA_INSTANCIA = RAIZ / "instance"
EMAIL_VALIDO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------- configuração
def carregar_chave_secreta() -> str:
    """Usa SECRET_KEY do ambiente ou gera uma e guarda em instance/.secret_key,
    para que o login continue válido depois de reiniciar o servidor."""
    if os.environ.get("SECRET_KEY"):
        return os.environ["SECRET_KEY"]
    arquivo = PASTA_INSTANCIA / ".secret_key"
    if not arquivo.exists():
        arquivo.write_text(secrets.token_hex(32), encoding="utf-8")
    return arquivo.read_text(encoding="utf-8").strip()


PASTA_INSTANCIA.mkdir(exist_ok=True)

# static_folder=None: só servimos explicitamente as pastas públicas,
# assim o banco e o código Python nunca ficam acessíveis pelo navegador.
app = Flask(__name__, static_folder=None, instance_path=str(PASTA_INSTANCIA))
app.config.update(
    SECRET_KEY=carregar_chave_secreta(),
    DATABASE=str(PASTA_INSTANCIA / "loja.db"),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)
app.json.ensure_ascii = False
app.json.sort_keys = False
app.teardown_appcontext(database.fechar)
database.inicializar(Path(app.config["DATABASE"]))


# ---------------------------------------------------------------- utilidades
class ErroApi(Exception):
    def __init__(self, mensagem: str, status: int = 400):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.status = status


@app.errorhandler(ErroApi)
def tratar_erro_api(erro: ErroApi):
    return jsonify(erro=erro.mensagem), erro.status


def corpo_json() -> dict:
    # Exigir JSON também protege contra CSRF via formulário de outro site.
    if not request.is_json:
        raise ErroApi("Envie os dados em JSON.", 415)
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        raise ErroApi("JSON inválido.")
    return dados


def texto(dados: dict, campo: str, rotulo: str, maximo: int, obrigatorio=True) -> str:
    valor = str(dados.get(campo) or "").strip()
    if obrigatorio and not valor:
        raise ErroApi(f"Informe {rotulo}.")
    if len(valor) > maximo:
        raise ErroApi(f"{rotulo.capitalize()} pode ter no máximo {maximo} caracteres.")
    return valor


def inteiro(valor, rotulo: str, minimo: int, maximo: int) -> int:
    try:
        numero = int(str(valor).strip())
    except (TypeError, ValueError):
        raise ErroApi(f"{rotulo} deve ser um número inteiro.")
    if not minimo <= numero <= maximo:
        raise ErroApi(f"{rotulo} deve estar entre {minimo} e {maximo}.")
    return numero


def preco_em_centavos(valor) -> int:
    """Aceita 12.5, "12.50" ou "12,50"."""
    try:
        reais = float(str(valor).replace("R$", "").replace(",", ".").strip())
    except (TypeError, ValueError):
        raise ErroApi("Preço inválido.")
    if not 0 <= reais <= 1_000_000:
        raise ErroApi("Preço deve estar entre R$ 0 e R$ 1.000.000.")
    return round(reais * 100)


def produto_para_json(linha) -> dict:
    return {
        "id": linha["id"],
        "nome": linha["nome"],
        "categoria": linha["categoria"],
        "descricao": linha["descricao"],
        "icone": linha["icone"],
        "preco": linha["preco_centavos"] / 100,
        "estoque": linha["estoque"],
    }


def usuario_atual():
    uid = session.get("usuario_id")
    if uid is None:
        return None
    return database.conectar().execute(
        "SELECT id, nome, email, papel FROM usuarios WHERE id = ?", (uid,)
    ).fetchone()


def exige_login(admin=False, pagina=False):
    """Decorador: protege rotas da API (401/403) e páginas (redireciona)."""
    def decorador(funcao):
        @wraps(funcao)
        def envoltorio(*args, **kwargs):
            usuario = usuario_atual()
            if usuario is None:
                session.clear()
                if pagina:
                    return redirect("/")
                raise ErroApi("Faça login para continuar.", 401)
            if admin and usuario["papel"] != "admin":
                if pagina:
                    return redirect("/loja")
                raise ErroApi("Acesso restrito à área do profissional.", 403)
            return funcao(*args, usuario=usuario, **kwargs)
        return envoltorio
    return decorador


# ---------------------------------------------------------------- páginas
@app.get("/")
def pagina_login():
    usuario = usuario_atual()
    if usuario:
        return redirect("/admin" if usuario["papel"] == "admin" else "/loja")
    return send_from_directory(RAIZ, "login.html")


@app.get("/loja")
@exige_login(pagina=True)
def pagina_loja(usuario):
    return send_from_directory(RAIZ, "index.html")


@app.get("/admin")
@exige_login(admin=True, pagina=True)
def pagina_admin(usuario):
    return send_from_directory(RAIZ, "admin.html")


@app.get("/style/<path:arquivo>")
def arquivos_css(arquivo):
    return send_from_directory(RAIZ / "style", arquivo)


@app.get("/scripts/<path:arquivo>")
def arquivos_js(arquivo):
    return send_from_directory(RAIZ / "scripts", arquivo)


# ---------------------------------------------------------------- autenticação
def iniciar_sessao(usuario) -> dict:
    session.clear()
    session["usuario_id"] = usuario["id"]
    return {
        "id": usuario["id"],
        "nome": usuario["nome"],
        "email": usuario["email"],
        "papel": usuario["papel"],
    }


@app.post("/api/login")
def api_login():
    dados = corpo_json()
    email = texto(dados, "email", "o e-mail", 120)
    senha = str(dados.get("senha") or "")
    usuario = database.conectar().execute(
        "SELECT * FROM usuarios WHERE email = ?", (email,)
    ).fetchone()
    if usuario is None or not check_password_hash(usuario["senha_hash"], senha):
        raise ErroApi("E-mail ou senha incorretos.", 401)
    return jsonify(usuario=iniciar_sessao(usuario))


@app.post("/api/cadastro")
def api_cadastro():
    dados = corpo_json()
    nome = texto(dados, "nome", "o nome", 80)
    email = texto(dados, "email", "o e-mail", 120).lower()
    senha = str(dados.get("senha") or "")
    if not EMAIL_VALIDO.match(email):
        raise ErroApi("E-mail inválido.")
    if len(senha) < 6:
        raise ErroApi("A senha precisa ter pelo menos 6 caracteres.")

    con = database.conectar()
    if con.execute("SELECT 1 FROM usuarios WHERE email = ?", (email,)).fetchone():
        raise ErroApi("Já existe uma conta com esse e-mail.", 409)
    cursor = con.execute(
        "INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, 'cliente')",
        (nome, email, generate_password_hash(senha)),
    )
    con.commit()
    usuario = con.execute("SELECT * FROM usuarios WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify(usuario=iniciar_sessao(usuario)), 201


@app.post("/api/logout")
def api_logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")
@exige_login()
def api_me(usuario):
    return jsonify(usuario=dict(usuario))


# ---------------------------------------------------------------- produtos
@app.get("/api/produtos")
@exige_login()
def listar_produtos(usuario):
    linhas = database.conectar().execute(
        "SELECT * FROM produtos WHERE ativo = 1 ORDER BY categoria, nome"
    ).fetchall()
    return jsonify(produtos=[produto_para_json(l) for l in linhas])


def buscar_produto(con, produto_id: int):
    linha = con.execute(
        "SELECT * FROM produtos WHERE id = ? AND ativo = 1", (produto_id,)
    ).fetchone()
    if linha is None:
        raise ErroApi("Produto não encontrado.", 404)
    return linha


def ler_campos_produto(dados: dict, parcial: bool) -> dict:
    """Valida os campos enviados. Em edição (parcial) só valida o que veio."""
    campos = {}
    if not parcial or "nome" in dados:
        campos["nome"] = texto(dados, "nome", "o nome do produto", 80)
    if not parcial or "categoria" in dados:
        campos["categoria"] = texto(dados, "categoria", "a categoria", 40, obrigatorio=False) or "Outros"
    if not parcial or "descricao" in dados:
        campos["descricao"] = texto(dados, "descricao", "a descrição", 300, obrigatorio=False)
    if not parcial or "icone" in dados:
        campos["icone"] = texto(dados, "icone", "o ícone", 8, obrigatorio=False) or "📦"
    if not parcial or "preco" in dados:
        campos["preco_centavos"] = preco_em_centavos(dados.get("preco"))
    if not parcial or "estoque" in dados:
        campos["estoque"] = inteiro(dados.get("estoque", 0), "Estoque", 0, 100_000)
    return campos


@app.post("/api/produtos")
@exige_login(admin=True)
def criar_produto(usuario):
    campos = ler_campos_produto(corpo_json(), parcial=False)
    con = database.conectar()
    cursor = con.execute(
        f"INSERT INTO produtos ({', '.join(campos)}) VALUES ({', '.join('?' * len(campos))})",
        tuple(campos.values()),
    )
    con.commit()
    return jsonify(produto=produto_para_json(buscar_produto(con, cursor.lastrowid))), 201


@app.patch("/api/produtos/<int:produto_id>")
@exige_login(admin=True)
def editar_produto(produto_id, usuario):
    dados = corpo_json()
    con = database.conectar()
    buscar_produto(con, produto_id)

    campos = ler_campos_produto(dados, parcial=True)
    if campos:
        atribuicoes = ", ".join(f"{c} = ?" for c in campos)  # nomes vêm da lista fixa acima
        con.execute(f"UPDATE produtos SET {atribuicoes} WHERE id = ?", (*campos.values(), produto_id))

    # Ajuste relativo (+5 / -1) é atômico: não sobrescreve vendas que
    # aconteceram enquanto o profissional estava com a tela aberta.
    if "ajuste_estoque" in dados:
        ajuste = inteiro(dados["ajuste_estoque"], "Ajuste de estoque", -100_000, 100_000)
        cursor = con.execute(
            "UPDATE produtos SET estoque = estoque + ? WHERE id = ? AND estoque + ? BETWEEN 0 AND 100000",
            (ajuste, produto_id, ajuste),
        )
        if cursor.rowcount == 0:
            con.rollback()
            raise ErroApi("O estoque não pode ficar negativo.")

    con.commit()
    return jsonify(produto=produto_para_json(buscar_produto(con, produto_id)))


@app.delete("/api/produtos/<int:produto_id>")
@exige_login(admin=True)
def excluir_produto(produto_id, usuario):
    con = database.conectar()
    buscar_produto(con, produto_id)
    # Exclusão lógica: pedidos antigos continuam apontando para o produto.
    con.execute("UPDATE produtos SET ativo = 0 WHERE id = ?", (produto_id,))
    con.commit()
    return jsonify(ok=True)


# ---------------------------------------------------------------- pedidos
@app.post("/api/pedidos")
@exige_login()
def criar_pedido(usuario):
    itens = corpo_json().get("itens")
    if not isinstance(itens, list) or not itens:
        raise ErroApi("O carrinho está vazio.")

    quantidades: dict[int, int] = {}
    for item in itens:
        if not isinstance(item, dict):
            raise ErroApi("Item inválido no carrinho.")
        pid = inteiro(item.get("produto_id"), "Produto", 1, 10**9)
        qtd = inteiro(item.get("quantidade"), "Quantidade", 1, 1000)
        quantidades[pid] = quantidades.get(pid, 0) + qtd

    con = database.conectar()
    # BEGIN IMMEDIATE trava a escrita: duas compras simultâneas não
    # conseguem vender a mesma última unidade.
    con.execute("BEGIN IMMEDIATE")
    try:
        total = 0
        linhas_itens = []
        for pid, qtd in quantidades.items():
            produto = con.execute(
                "SELECT * FROM produtos WHERE id = ? AND ativo = 1", (pid,)
            ).fetchone()
            if produto is None:
                raise ErroApi("Um dos produtos do carrinho não está mais disponível.", 409)
            if produto["estoque"] < qtd:
                raise ErroApi(
                    f"Estoque insuficiente de {produto['nome']}: restam {produto['estoque']}.", 409
                )
            con.execute("UPDATE produtos SET estoque = estoque - ? WHERE id = ?", (qtd, pid))
            # O preço vem do banco, nunca do navegador.
            total += produto["preco_centavos"] * qtd
            linhas_itens.append((pid, produto["nome"], produto["icone"], produto["preco_centavos"], qtd))

        pedido_id = con.execute(
            "INSERT INTO pedidos (usuario_id, total_centavos) VALUES (?, ?)", (usuario["id"], total)
        ).lastrowid
        con.executemany(
            "INSERT INTO itens_pedido (pedido_id, produto_id, nome, icone, preco_centavos, quantidade)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            [(pedido_id, *linha) for linha in linhas_itens],
        )
        con.commit()
    except Exception:
        con.rollback()
        raise

    return jsonify(pedido={"id": pedido_id, "total": total / 100}), 201


@app.get("/api/pedidos")
@exige_login()
def listar_pedidos(usuario):
    con = database.conectar()
    sql = """
        SELECT p.id, p.total_centavos, p.criado_em, u.nome AS cliente, u.email
        FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id
    """
    if usuario["papel"] == "admin":
        pedidos = con.execute(sql + " ORDER BY p.id DESC LIMIT 100").fetchall()
    else:
        pedidos = con.execute(
            sql + " WHERE p.usuario_id = ? ORDER BY p.id DESC LIMIT 100", (usuario["id"],)
        ).fetchall()

    resultado = []
    for p in pedidos:
        itens = con.execute(
            "SELECT nome, icone, preco_centavos, quantidade FROM itens_pedido WHERE pedido_id = ?",
            (p["id"],),
        ).fetchall()
        resultado.append({
            "id": p["id"],
            "cliente": p["cliente"],
            "email": p["email"],
            "data": p["criado_em"],
            "total": p["total_centavos"] / 100,
            "itens": [
                {"nome": i["nome"], "icone": i["icone"], "preco": i["preco_centavos"] / 100,
                 "quantidade": i["quantidade"]}
                for i in itens
            ],
        })
    return jsonify(pedidos=resultado)


@app.get("/api/admin/resumo")
@exige_login(admin=True)
def resumo_admin(usuario):
    con = database.conectar()
    estoque = con.execute(
        "SELECT COUNT(*) AS produtos, COALESCE(SUM(estoque), 0) AS unidades,"
        " COALESCE(SUM(estoque = 0), 0) AS esgotados FROM produtos WHERE ativo = 1"
    ).fetchone()
    vendas = con.execute(
        "SELECT COUNT(*) AS pedidos, COALESCE(SUM(total_centavos), 0) AS faturamento FROM pedidos"
    ).fetchone()
    return jsonify(
        produtos=estoque["produtos"],
        unidades=estoque["unidades"],
        esgotados=estoque["esgotados"],
        pedidos=vendas["pedidos"],
        faturamento=vendas["faturamento"] / 100,
    )


# ---------------------------------------------------------------- linha de comando
@app.cli.command("criar-admin")
@click.option("--nome", prompt="Nome")
@click.option("--email", prompt="E-mail")
@click.password_option("--senha", prompt="Senha")
def criar_admin(nome, email, senha):
    """Cria (ou promove) uma conta de profissional."""
    with app.app_context():
        con = database.conectar()
        existente = con.execute("SELECT id FROM usuarios WHERE email = ?", (email,)).fetchone()
        if existente:
            con.execute(
                "UPDATE usuarios SET papel = 'admin', senha_hash = ? WHERE id = ?",
                (generate_password_hash(senha), existente["id"]),
            )
        else:
            con.execute(
                "INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, 'admin')",
                (nome, email.lower(), generate_password_hash(senha)),
            )
        con.commit()
    click.echo(f"Profissional {email} pronto para entrar.")


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG") == "1"
    print("\n  LojinhaDev rodando em http://localhost:8080\n")
    app.run(host="127.0.0.1", port=8080, debug=debug)
