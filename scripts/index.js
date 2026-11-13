// ============================================================
// Catálogo e carrinho do consumidor
// ============================================================

// ---------- Estado ----------
let usuario = null;
let produtos = [];
let carrinho = {};            // { idDoProduto: quantidade }
let compraPendente = null;    // itens aguardando confirmação no modal
const filtro = { busca: "", categoria: "Todas" };

// ---------- Elementos ----------
const grade = document.getElementById("grade");
const listaCarrinho = document.getElementById("lista-carrinho");
const contadorNav = document.getElementById("contador-nav");
const contadorProdutos = document.getElementById("contador-produtos");
const contadorCarrinho = document.getElementById("contador-carrinho");
const subtotalEl = document.getElementById("subtotal");
const totalEl = document.getElementById("total");
const btnFinalizar = document.getElementById("btn-finalizar");
const campoBusca = document.getElementById("busca");
const categoriasEl = document.getElementById("categorias");
const modalCompra = document.getElementById("modal-compra");
const resumoCompra = document.getElementById("resumo-compra");
const btnConfirmar = document.getElementById("btn-confirmar-compra");
const modalPedidos = document.getElementById("modal-pedidos");
const listaPedidos = document.getElementById("lista-pedidos");

// ---------- Carrinho salvo no navegador (um por usuário) ----------
function chaveCarrinho() {
  return "lojinhadev:carrinho:" + usuario.id;
}

function salvarCarrinho() {
  try { localStorage.setItem(chaveCarrinho(), JSON.stringify(carrinho)); } catch (e) { /* sem storage */ }
}

function carregarCarrinho() {
  try { carrinho = JSON.parse(localStorage.getItem(chaveCarrinho())) || {}; } catch (e) { carrinho = {}; }
}

// Remove do carrinho produtos que sumiram e ajusta ao estoque atual
function ajustarCarrinhoAoEstoque() {
  let mudou = false;
  Object.keys(carrinho).forEach((id) => {
    const p = achar(id);
    const maximo = p ? p.estoque : 0;
    if (carrinho[id] > maximo) {
      mudou = true;
      if (maximo > 0) carrinho[id] = maximo;
      else delete carrinho[id];
    }
  });
  if (mudou) {
    salvarCarrinho();
    mostrarAviso("Seu carrinho foi ajustado ao estoque atual.", true);
  }
}

// ---------- Auxiliares ----------
function achar(id) {
  return produtos.find((p) => p.id === Number(id));
}

// Quanto ainda dá para adicionar (estoque - o que já está no carrinho)
function disponivel(produto) {
  return produto.estoque - (carrinho[produto.id] || 0);
}

function itensDoCarrinho() {
  return Object.keys(carrinho).map((id) => ({ produto: achar(id), quantidade: carrinho[id] }));
}

function somar(itens) {
  return itens.reduce((total, i) => total + i.produto.preco * i.quantidade, 0);
}

// ---------- Carregar dados do servidor ----------
async function carregarProdutos() {
  const dados = await api("/api/produtos");
  produtos = dados.produtos;
  ajustarCarrinhoAoEstoque();
  mostrarCategorias();
  atualizarTela();
}

// ---------- Filtros ----------
function mostrarCategorias() {
  const categorias = ["Todas", ...new Set(produtos.map((p) => p.categoria))];
  if (!categorias.includes(filtro.categoria)) filtro.categoria = "Todas";
  categoriasEl.innerHTML = categorias.map((c) => `
    <button type="button" class="chip ${c === filtro.categoria ? "ativo" : ""}" data-categoria="${escapar(c)}">
      ${escapar(c)}
    </button>
  `).join("");
}

function produtosFiltrados() {
  const busca = filtro.busca.toLowerCase();
  return produtos.filter((p) =>
    (filtro.categoria === "Todas" || p.categoria === filtro.categoria) &&
    (p.nome + " " + p.descricao).toLowerCase().includes(busca)
  );
}

// ---------- Mostrar produtos ----------
function seloEstoque(p) {
  if (p.estoque === 0) return '<span class="selo selo-esgotado">Esgotado</span>';
  const classe = p.estoque <= 3 ? "selo-baixo" : "selo-ok";
  return `<span class="selo ${classe}">${p.estoque} em estoque</span>`;
}

function mostrarProdutos() {
  const lista = produtosFiltrados();
  contadorProdutos.textContent = lista.length + (lista.length === 1 ? " item" : " itens");

  if (lista.length === 0) {
    grade.innerHTML = '<div class="vazio grade-vazia"><div class="vazio-icone">🔎</div><p>Nenhum produto encontrado.</p></div>';
    return;
  }

  grade.innerHTML = lista.map((p) => {
    const disp = disponivel(p);
    const bloqueado = disp === 0 ? "disabled" : "";
    const noCarrinho = carrinho[p.id]
      ? `<small class="no-carrinho">${carrinho[p.id]} no carrinho</small>` : "";
    let textoBotao = "Adicionar";
    if (p.estoque === 0) textoBotao = "Esgotado";
    else if (disp === 0) textoBotao = "Tudo no carrinho";

    return `
      <article class="produto">
        <div class="produto-imagem">${escapar(p.icone)}</div>
        <div class="produto-info">
          <div>
            <small class="produto-categoria">${escapar(p.categoria)}</small>
            <h3>${escapar(p.nome)}</h3>
          </div>
          ${seloEstoque(p)}
        </div>
        ${p.descricao ? `<p class="produto-descricao">${escapar(p.descricao)}</p>` : ""}
        <div class="produto-preco">${formatar(p.preco)} ${noCarrinho}</div>
        <div class="produto-acoes">
          <input type="number" value="1" min="1" max="${disp}" ${bloqueado} aria-label="Quantidade de ${escapar(p.nome)}">
          <button class="btn btn-secundario" type="button" data-adicionar="${p.id}" ${bloqueado}>${textoBotao}</button>
        </div>
        <button class="btn" type="button" data-comprar="${p.id}" ${p.estoque === 0 ? "disabled" : ""}>Comprar agora</button>
      </article>
    `;
  }).join("");
}

// ---------- Mostrar carrinho ----------
function mostrarCarrinho() {
  const itens = itensDoCarrinho();
  const quantidadeTotal = itens.reduce((soma, i) => soma + i.quantidade, 0);
  const total = somar(itens);

  if (itens.length === 0) {
    listaCarrinho.innerHTML = `
      <div class="vazio">
        <div class="vazio-icone">🛒</div>
        <p>O carrinho está vazio.</p>
        <small>Adicione produtos para começar.</small>
      </div>
    `;
  } else {
    listaCarrinho.innerHTML = itens.map(({ produto: p, quantidade }) => `
      <div class="item-carrinho">
        <div class="item-info">
          <strong>${escapar(p.icone)} ${escapar(p.nome)}</strong>
          <small>${formatar(p.preco)} cada</small>
          <div class="quantidade">
            <button type="button" data-diminuir="${p.id}" aria-label="Diminuir">−</button>
            <span>${quantidade}</span>
            <button type="button" data-aumentar="${p.id}" aria-label="Aumentar" ${disponivel(p) === 0 ? "disabled" : ""}>+</button>
          </div>
        </div>
        <div class="item-direita">
          <span>${formatar(p.preco * quantidade)}</span>
          <button class="btn-remover" type="button" data-remover="${p.id}">Remover</button>
        </div>
      </div>
    `).join("");
  }

  contadorNav.textContent = quantidadeTotal;
  contadorCarrinho.textContent = quantidadeTotal + (quantidadeTotal === 1 ? " item" : " itens");
  subtotalEl.textContent = formatar(total);
  totalEl.textContent = formatar(total);
  btnFinalizar.disabled = itens.length === 0;
}

function atualizarTela() {
  mostrarProdutos();
  mostrarCarrinho();
}

// ---------- Ações no catálogo ----------
function lerQuantidade(botao, maximo, produto) {
  const campo = botao.closest(".produto").querySelector("input");
  const qtd = parseInt(campo.value, 10);
  if (isNaN(qtd) || qtd < 1) {
    mostrarAviso("Digite uma quantidade válida.", true);
    return null;
  }
  if (qtd > maximo) {
    mostrarAviso("Só tem " + maximo + " unidade(s) disponível(is) de " + produto.nome + ".", true);
    return null;
  }
  return qtd;
}

grade.addEventListener("click", (evento) => {
  const botaoAdicionar = evento.target.closest("[data-adicionar]");
  const botaoComprar = evento.target.closest("[data-comprar]");

  if (botaoAdicionar) {
    const produto = achar(botaoAdicionar.dataset.adicionar);
    const qtd = lerQuantidade(botaoAdicionar, disponivel(produto), produto);
    if (qtd === null) return;
    carrinho[produto.id] = (carrinho[produto.id] || 0) + qtd;
    salvarCarrinho();
    atualizarTela();
    mostrarAviso(qtd + "x " + produto.nome + " adicionado ao carrinho.");
  }

  if (botaoComprar) {
    // "Comprar agora" compra só este produto, sem mexer no carrinho
    const produto = achar(botaoComprar.dataset.comprar);
    const qtd = lerQuantidade(botaoComprar, produto.estoque, produto);
    if (qtd === null) return;
    abrirConfirmacao([{ produto, quantidade: qtd }], false);
  }
});

campoBusca.addEventListener("input", () => {
  filtro.busca = campoBusca.value.trim();
  mostrarProdutos();
});

categoriasEl.addEventListener("click", (evento) => {
  const chip = evento.target.closest("[data-categoria]");
  if (!chip) return;
  filtro.categoria = chip.dataset.categoria;
  mostrarCategorias();
  mostrarProdutos();
});

// ---------- Ações no carrinho ----------
listaCarrinho.addEventListener("click", (evento) => {
  const alvo = evento.target.closest("button");
  if (!alvo) return;
  const { remover, aumentar, diminuir } = alvo.dataset;

  if (remover) delete carrinho[remover];
  if (aumentar && disponivel(achar(aumentar)) > 0) carrinho[aumentar] += 1;
  if (diminuir) {
    carrinho[diminuir] -= 1;
    if (carrinho[diminuir] <= 0) delete carrinho[diminuir];
  }
  salvarCarrinho();
  atualizarTela();
});

btnFinalizar.addEventListener("click", () => {
  const itens = itensDoCarrinho();
  if (itens.length === 0) {
    mostrarAviso("O carrinho está vazio.", true);
    return;
  }
  abrirConfirmacao(itens, true);
});

// ---------- Confirmação e envio da compra ----------
function abrirConfirmacao(itens, doCarrinho) {
  compraPendente = { itens, doCarrinho };
  resumoCompra.innerHTML = `
    <ul class="resumo-itens">
      ${itens.map(({ produto: p, quantidade }) => `
        <li>
          <span>${escapar(p.icone)} ${quantidade}x ${escapar(p.nome)}</span>
          <strong>${formatar(p.preco * quantidade)}</strong>
        </li>
      `).join("")}
    </ul>
    <div class="resumo-linha resumo-total">
      <span>Total</span>
      <span>${formatar(somar(itens))}</span>
    </div>
  `;
  btnConfirmar.disabled = false;
  modalCompra.hidden = false;
  btnConfirmar.focus();
}

btnConfirmar.addEventListener("click", async () => {
  if (!compraPendente) return;
  btnConfirmar.disabled = true;
  const { itens, doCarrinho } = compraPendente;

  try {
    const { pedido } = await api("/api/pedidos", {
      method: "POST",
      body: { itens: itens.map((i) => ({ produto_id: i.produto.id, quantidade: i.quantidade })) },
    });
    if (doCarrinho) {
      carrinho = {};
      salvarCarrinho();
    }
    modalCompra.hidden = true;
    mostrarAviso("Pedido #" + pedido.id + " confirmado! Total: " + formatar(pedido.total));
  } catch (e) {
    modalCompra.hidden = true;
    mostrarAviso(e.message, true);
  } finally {
    compraPendente = null;
    // Recarrega o estoque real do servidor (outra pessoa pode ter comprado)
    carregarProdutos().catch((e) => mostrarAviso(e.message, true));
  }
});

// ---------- Meus pedidos ----------
document.getElementById("btn-meus-pedidos").addEventListener("click", async () => {
  listaPedidos.innerHTML = "<p class='texto-suave'>Carregando…</p>";
  modalPedidos.hidden = false;
  try {
    const { pedidos } = await api("/api/pedidos");
    listaPedidos.innerHTML = pedidos.length === 0
      ? "<div class='vazio'><div class='vazio-icone'>📦</div><p>Você ainda não fez nenhum pedido.</p></div>"
      : pedidos.map(cartaoPedido).join("");
  } catch (e) {
    listaPedidos.innerHTML = `<p class="login-erro">${escapar(e.message)}</p>`;
  }
});

function cartaoPedido(pedido) {
  return `
    <div class="pedido">
      <div class="pedido-topo">
        <strong>Pedido #${pedido.id}</strong>
        <small>${formatarData(pedido.data)}</small>
      </div>
      <ul>
        ${pedido.itens.map((i) => `
          <li>${escapar(i.icone)} ${i.quantidade}x ${escapar(i.nome)} <span>${formatar(i.preco * i.quantidade)}</span></li>
        `).join("")}
      </ul>
      <div class="pedido-total">Total <strong>${formatar(pedido.total)}</strong></div>
    </div>
  `;
}

// ---------- Início ----------
async function iniciar() {
  try {
    usuario = (await api("/api/me")).usuario;
    document.getElementById("nome-usuario").textContent = usuario.nome.split(" ")[0];
    document.getElementById("link-admin").hidden = usuario.papel !== "admin";
    carregarCarrinho();
    await carregarProdutos();
  } catch (e) {
    grade.innerHTML = `<p class="login-erro">${escapar(e.message)}</p>`;
  }
}

iniciar();
