// ============================================================
// Área do profissional: cadastro de produtos e controle de estoque
// ============================================================

let produtos = [];
let editandoId = null;   // id do produto em edição (null = cadastrando novo)
let excluindoId = null;

const form = document.getElementById("form-produto");
const tituloForm = document.getElementById("titulo-form");
const btnSalvar = document.getElementById("btn-salvar");
const btnCancelarEdicao = document.getElementById("btn-cancelar-edicao");
const tabela = document.getElementById("tabela-produtos");
const buscaAdmin = document.getElementById("busca-admin");
const estatisticas = document.getElementById("estatisticas");
const listaPedidos = document.getElementById("lista-pedidos");
const modalExcluir = document.getElementById("modal-excluir");

// ---------- Resumo ----------
async function carregarResumo() {
  const r = await api("/api/admin/resumo");
  const cartoes = [
    ["Produtos", r.produtos],
    ["Unidades em estoque", r.unidades],
    ["Esgotados", r.esgotados, r.esgotados > 0 ? "alerta" : ""],
    ["Pedidos", r.pedidos],
    ["Faturamento", formatar(r.faturamento)],
  ];
  estatisticas.innerHTML = cartoes.map(([rotulo, valor, classe = ""]) => `
    <div class="estatistica ${classe}">
      <small>${rotulo}</small>
      <strong>${valor}</strong>
    </div>
  `).join("");
}

// ---------- Tabela de estoque ----------
async function carregarProdutos() {
  produtos = (await api("/api/produtos")).produtos;
  const categorias = [...new Set(produtos.map((p) => p.categoria))];
  document.getElementById("lista-categorias").innerHTML =
    categorias.map((c) => `<option value="${escapar(c)}">`).join("");
  mostrarTabela();
}

function mostrarTabela() {
  const busca = buscaAdmin.value.trim().toLowerCase();
  const lista = produtos.filter((p) => (p.nome + " " + p.categoria).toLowerCase().includes(busca));

  if (lista.length === 0) {
    tabela.innerHTML = '<tr><td colspan="4" class="texto-suave centro">Nenhum produto.</td></tr>';
    return;
  }

  tabela.innerHTML = lista.map((p) => {
    let classe = "selo-ok";
    if (p.estoque === 0) classe = "selo-esgotado";
    else if (p.estoque <= 3) classe = "selo-baixo";
    return `
      <tr class="${editandoId === p.id ? "linha-editando" : ""}">
        <td>
          <div class="celula-produto">
            <span class="icone-tabela">${escapar(p.icone)}</span>
            <div>
              <strong>${escapar(p.nome)}</strong>
              <small>${escapar(p.categoria)}</small>
            </div>
          </div>
        </td>
        <td class="sem-quebra">${formatar(p.preco)}</td>
        <td>
          <div class="quantidade">
            <button type="button" data-ajuste="-1" data-id="${p.id}" ${p.estoque === 0 ? "disabled" : ""} aria-label="Remover uma unidade">−</button>
            <span class="selo ${classe}">${p.estoque}</span>
            <button type="button" data-ajuste="1" data-id="${p.id}" aria-label="Adicionar uma unidade">+</button>
            <button type="button" data-ajuste="10" data-id="${p.id}" class="repor" title="Repor 10 unidades">+10</button>
          </div>
        </td>
        <td class="acoes-tabela">
          <button class="link-nav" type="button" data-editar="${p.id}">Editar</button>
          <button class="btn-remover" type="button" data-excluir="${p.id}">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");
}

buscaAdmin.addEventListener("input", mostrarTabela);

tabela.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("button");
  if (!botao) return;
  const { ajuste, id, editar, excluir } = botao.dataset;

  if (ajuste) {
    botao.disabled = true;
    try {
      await api("/api/produtos/" + id, { method: "PATCH", body: { ajuste_estoque: Number(ajuste) } });
      await Promise.all([carregarProdutos(), carregarResumo()]);
    } catch (e) {
      mostrarAviso(e.message, true);
      botao.disabled = false;
    }
  }
  if (editar) iniciarEdicao(Number(editar));
  if (excluir) {
    const p = produtos.find((x) => x.id === Number(excluir));
    excluindoId = p.id;
    document.getElementById("texto-excluir").textContent =
      "Tem certeza que deseja excluir \"" + p.nome + "\"? Ele deixará de aparecer na loja.";
    modalExcluir.hidden = false;
  }
});

document.getElementById("btn-confirmar-excluir").addEventListener("click", async () => {
  try {
    await api("/api/produtos/" + excluindoId, { method: "DELETE" });
    if (editandoId === excluindoId) cancelarEdicao();
    modalExcluir.hidden = true;
    mostrarAviso("Produto excluído.");
    await Promise.all([carregarProdutos(), carregarResumo()]);
  } catch (e) {
    mostrarAviso(e.message, true);
  }
});

// ---------- Formulário (cadastrar / editar) ----------
function iniciarEdicao(id) {
  const p = produtos.find((x) => x.id === id);
  if (!p) return;
  editandoId = id;
  form.nome.value = p.nome;
  form.categoria.value = p.categoria;
  form.descricao.value = p.descricao;
  form.icone.value = p.icone;
  form.preco.value = p.preco.toFixed(2);
  form.estoque.value = p.estoque;
  tituloForm.textContent = "Editar: " + p.nome;
  btnSalvar.textContent = "Salvar alterações";
  btnCancelarEdicao.hidden = false;
  mostrarTabela();
  form.nome.focus();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarEdicao() {
  editandoId = null;
  form.reset();
  tituloForm.textContent = "Cadastrar produto";
  btnSalvar.textContent = "Cadastrar produto";
  btnCancelarEdicao.hidden = true;
  mostrarTabela();
}

btnCancelarEdicao.addEventListener("click", cancelarEdicao);

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(form));

  if (!dados.nome.trim()) return mostrarAviso("Informe o nome do produto.", true);
  if (dados.preco === "" || Number(dados.preco) < 0) return mostrarAviso("Informe um preço válido.", true);
  if (dados.estoque === "" || !Number.isInteger(Number(dados.estoque)) || Number(dados.estoque) < 0) {
    return mostrarAviso("A quantidade em estoque deve ser um número inteiro (0 ou mais).", true);
  }

  btnSalvar.disabled = true;
  try {
    if (editandoId) {
      await api("/api/produtos/" + editandoId, { method: "PATCH", body: dados });
      mostrarAviso("Produto atualizado.");
    } else {
      const { produto } = await api("/api/produtos", { method: "POST", body: dados });
      mostrarAviso(produto.nome + " cadastrado com " + produto.estoque + " unidade(s).");
    }
    cancelarEdicao();
    await Promise.all([carregarProdutos(), carregarResumo()]);
  } catch (e) {
    mostrarAviso(e.message, true);
  } finally {
    btnSalvar.disabled = false;
  }
});

// ---------- Pedidos ----------
async function carregarPedidos() {
  const { pedidos } = await api("/api/pedidos");
  listaPedidos.innerHTML = pedidos.length === 0
    ? "<p class='texto-suave'>Nenhum pedido ainda.</p>"
    : pedidos.map((p) => `
      <div class="pedido">
        <div class="pedido-topo">
          <strong>#${p.id} • ${escapar(p.cliente)}</strong>
          <small>${formatarData(p.data)}</small>
        </div>
        <ul>
          ${p.itens.map((i) => `
            <li>${escapar(i.icone)} ${i.quantidade}x ${escapar(i.nome)} <span>${formatar(i.preco * i.quantidade)}</span></li>
          `).join("")}
        </ul>
        <div class="pedido-total">Total <strong>${formatar(p.total)}</strong></div>
      </div>
    `).join("");
}

document.getElementById("btn-atualizar-pedidos").addEventListener("click", () => {
  Promise.all([carregarPedidos(), carregarProdutos(), carregarResumo()])
    .catch((e) => mostrarAviso(e.message, true));
});

// ---------- Início ----------
async function iniciar() {
  try {
    const { usuario } = await api("/api/me");
    document.getElementById("nome-usuario").textContent = usuario.nome.split(" ")[0];
    await Promise.all([carregarProdutos(), carregarResumo(), carregarPedidos()]);
  } catch (e) {
    mostrarAviso(e.message, true);
  }
}

iniciar();
