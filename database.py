"""Camada de banco de dados (SQLite).

Valores em dinheiro são guardados em centavos (inteiro) para evitar
erros de arredondamento com ponto flutuante.
"""
import sqlite3
from pathlib import Path

from flask import current_app, g
from werkzeug.security import generate_password_hash

ESQUEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash  TEXT    NOT NULL,
    papel       TEXT    NOT NULL DEFAULT 'cliente' CHECK (papel IN ('cliente', 'admin')),
    criado_em   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS produtos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT    NOT NULL,
    categoria       TEXT    NOT NULL DEFAULT 'Outros',
    descricao       TEXT    NOT NULL DEFAULT '',
    icone           TEXT    NOT NULL DEFAULT '📦',
    preco_centavos  INTEGER NOT NULL CHECK (preco_centavos >= 0),
    estoque         INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
    ativo           INTEGER NOT NULL DEFAULT 1,
    criado_em       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS pedidos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    total_centavos  INTEGER NOT NULL,
    criado_em       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- nome e preço são copiados no momento da compra: se o produto mudar
-- depois, o histórico do pedido continua correto.
CREATE TABLE IF NOT EXISTS itens_pedido (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id       INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id      INTEGER NOT NULL REFERENCES produtos(id),
    nome            TEXT    NOT NULL,
    icone           TEXT    NOT NULL,
    preco_centavos  INTEGER NOT NULL,
    quantidade      INTEGER NOT NULL CHECK (quantidade > 0)
);
"""

PRODUTOS_INICIAIS = [
    # (nome, categoria, descrição, ícone, preço em centavos, estoque)
    ("Teclado Mecânico", "Teclados", "Switch blue, ABNT2, iluminação RGB.", "⌨️", 12000, 5),
    ("Mouse Gamer", "Mouses", "Sensor óptico 12.000 DPI, 6 botões.", "🖱️", 6000, 8),
    ("Microfone USB", "Áudio", "Condensador cardioide com tripé.", "🎙️", 25000, 3),
    ("Headset 7.1", "Áudio", "Som surround virtual e microfone removível.", "🎧", 18000, 4),
    ("Webcam Full HD", "Vídeo", "1080p a 30 fps com foco automático.", "📷", 20000, 2),
    ("Monitor 24\"", "Vídeo", "IPS, 75 Hz, bordas finas.", "🖥️", 89900, 6),
    ("Mousepad XL", "Mouses", "90 x 40 cm, base antiderrapante.", "🟪", 7990, 12),
    ("Hub USB-C", "Acessórios", "4 portas USB 3.0 + HDMI.", "🔌", 14990, 0),
]


def conectar() -> sqlite3.Connection:
    """Retorna a conexão da requisição atual (uma por requisição)."""
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def fechar(_erro=None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def inicializar(caminho: Path) -> None:
    """Cria as tabelas e, se o banco estiver vazio, insere dados de exemplo."""
    novo = not caminho.exists()
    con = sqlite3.connect(caminho)
    try:
        con.executescript(ESQUEMA)
        if novo:
            con.executemany(
                "INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, ?)",
                [
                    ("Profissional", "admin@loja.com", generate_password_hash("admin123"), "admin"),
                    ("Cliente Teste", "cliente@loja.com", generate_password_hash("cliente123"), "cliente"),
                ],
            )
            con.executemany(
                "INSERT INTO produtos (nome, categoria, descricao, icone, preco_centavos, estoque)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                PRODUTOS_INICIAIS,
            )
        con.commit()
    finally:
        con.close()
