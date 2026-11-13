// ---------- Dados ----------
const produtos = [
  { id: 1, icone: "⌨️", nome: "Teclado",   preco: 120, estoque: 5 },
  { id: 2, icone: "🖱️", nome: "Mouse",     preco: 60,  estoque: 8 },
  { id: 3, icone: "🎙️", nome: "Microfone", preco: 250, estoque: 3 },
  { id: 4, icone: "🎧", nome: "Headset",   preco: 180, estoque: 4 },
  { id: 5, icone: "📷", nome: "Webcam",    preco: 200, estoque: 2 }
];

// carrinho guarda { idDoProduto: quantidade }
let carrinho = {};

// ---------- Elementos ----------
const grade = document.getElementById("grade");
const listaCarrinho = document.getElementById("lista-carrinho");
const contadorNav = document.getElementById("contador-nav");
const contadorCarrinho = document.getElementById("contador-carrinho");
const subtotalEl = document.getElementById("subtotal");
const totalEl = document.getElementById("total");
const btnFinalizar = document.getElementById("btn-finalizar");
const aviso = document.getElementById("aviso");

let timerAviso;

// ---------- Funções auxiliares ----------
function mostrarAviso(texto, erro) {
  aviso.textContent = texto;
  aviso.className = "aviso mostrar" + (erro ? " erro" : "");
  clearTimeout(timerAviso);
  timerAviso = setTimeout(function () {
    aviso.classList.remove("mostrar");
  }, 2800);
}

function formatar(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function achar(id) {
  return produtos.find(function (p) { return p.id === Number(id); });
}

// estoque que ainda pode ser adicionado (estoque - o que já está no carrinho)
function disponivel(produto) {
  return produto.estoque - (carrinho[produto.id] || 0);
}

// ---------- Mostrar produtos ----------
function mostrarProdutos() {
  grade.innerHTML = produtos.map(function (p) {
    const disp = disponivel(p);
    let selo;

    if (disp === 0) {
      selo = '<span class="selo selo-esgotado">Esgotado</span>';
    } else if (disp <= 3) {
      selo = '<span class="selo selo-baixo">' + disp + " em estoque</span>";
    } else {
      selo = '<span class="selo selo-ok">' + disp + " em estoque</span>";
    }

    return `
      <article class="produto">
        <div class="produto-imagem">${p.icone}</div>
        <div class="produto-info">
          <h3>${p.nome}</h3>
          ${selo}
        </div>
        <div class="produto-preco">${formatar(p.preco)}</div>
        <div class="produto-acoes">
          <input type="number" value="1" min="1" max="${disp}" ${disp === 0 ? "disabled" : ""}>
          <button class="btn" data-adicionar="${p.id}" ${disp === 0 ? "disabled" : ""}>
            ${disp === 0 ? "Esgotado" : "Adicionar"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

// ---------- Mostrar carrinho ----------
function mostrarCarrinho() {
  const ids = Object.keys(carrinho);
  let total = 0;
  let quantidadeTotal = 0;

  if (ids.length === 0) {
    listaCarrinho.innerHTML = `
      <div class="vazio">
        <div class="vazio-icone">🛒</div>
        <p>O carrinho está vazio.</p>
        <small>Adicione produtos para começar.</small>
      </div>
    `;
  } else {
    listaCarrinho.innerHTML = ids.map(function (id) {
      const p = achar(id);
      const qtd = carrinho[id];
      const subtotal = p.preco * qtd;
      total += subtotal;
      quantidadeTotal += qtd;

      return `
        <div class="item-carrinho">
          <div class="item-info">
            <strong>${p.icone} ${p.nome}</strong>
            <small>${qtd} x ${formatar(p.preco)}</small>
          </div>
          <div class="item-direita">
            <span>${formatar(subtotal)}</span>
            <button class="btn-remover" data-remover="${id}">Remover</button>
          </div>
        </div>
      `;
    }).join("");
  }

  contadorNav.textContent = quantidadeTotal;
  contadorCarrinho.textContent = quantidadeTotal + (quantidadeTotal === 1 ? " item" : " itens");
  subtotalEl.textContent = formatar(total);
  totalEl.textContent = formatar(total);
}

function atualizarTela() {
  mostrarProdutos();
  mostrarCarrinho();
}

// ---------- Adicionar ao carrinho ----------
grade.addEventListener("click", function (evento) {
  const botao = evento.target.closest("[data-adicionar]");
  if (!botao) return;

  const produto = achar(botao.dataset.adicionar);
  const campo = botao.parentElement.querySelector("input");
  const qtd = parseInt(campo.value, 10);
  const disp = disponivel(produto);

  if (isNaN(qtd) || qtd < 1) {
    mostrarAviso("Digite uma quantidade válida.", true);
    return;
  }
  if (qtd > disp) {
    mostrarAviso("Só tem " + disp + " unidade(s) de " + produto.nome + ".", true);
    return;
  }

  carrinho[produto.id] = (carrinho[produto.id] || 0) + qtd;
  atualizarTela();
  mostrarAviso(qtd + "x " + produto.nome + " adicionado ao carrinho.");
});

// ---------- Remover do carrinho ----------
listaCarrinho.addEventListener("click", function (evento) {
  const botao = evento.target.closest("[data-remover]");
  if (!botao) return;

  delete carrinho[botao.dataset.remover];
  atualizarTela();
});

// ---------- Finalizar compra ----------
btnFinalizar.addEventListener("click", function () {
  const ids = Object.keys(carrinho);

  if (ids.length === 0) {
    mostrarAviso("O carrinho está vazio.", true);
    return;
  }

  let total = 0;
  ids.forEach(function (id) {
    const p = achar(id);
    total += p.preco * carrinho[id];
    p.estoque -= carrinho[id]; // tira do estoque de verdade
  });

  carrinho = {};
  atualizarTela();
  mostrarAviso("Compra finalizada! Total: " + formatar(total));
});

// ---------- Início ----------
atualizarTela();