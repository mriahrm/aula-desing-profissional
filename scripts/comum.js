// ============================================================
// Funções compartilhadas por todas as páginas
// ============================================================

// Chama a API do servidor Python e devolve o JSON.
// Em caso de erro, lança um Error com a mensagem vinda do servidor.
async function api(caminho, opcoes = {}) {
  const config = { method: opcoes.method || "GET", headers: {}, credentials: "same-origin" };
  if (opcoes.body !== undefined) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(opcoes.body);
  }

  let resposta;
  try {
    resposta = await fetch(caminho, config);
  } catch (e) {
    throw new Error("Não foi possível falar com o servidor. Ele está rodando?");
  }

  // Sessão expirou: volta para o login (exceto na própria tela de login)
  if (resposta.status === 401 && location.pathname !== "/") {
    location.href = "/";
    throw new Error("Sessão expirada.");
  }

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro inesperado (" + resposta.status + ").");
  }
  return dados;
}

function formatar(valor) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Evita que textos cadastrados (nome, descrição...) virem HTML na página.
function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function formatarData(texto) {
  // "2026-11-13 18:30:00" -> "13/11/2026 18:30"
  const [data, hora = ""] = String(texto).split(" ");
  const [a, m, d] = data.split("-");
  return d + "/" + m + "/" + a + " " + hora.slice(0, 5);
}

let timerAviso;
function mostrarAviso(texto, erro = false) {
  const aviso = document.getElementById("aviso");
  if (!aviso) return;
  aviso.textContent = texto;
  aviso.className = "aviso mostrar" + (erro ? " erro" : "");
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => aviso.classList.remove("mostrar"), 3200);
}

async function sair() {
  try { await api("/api/logout", { method: "POST" }); } catch (e) { /* ignora */ }
  location.href = "/";
}

// Modais: qualquer elemento com [data-fechar-modal] fecha o modal em volta.
document.addEventListener("click", (evento) => {
  const alvo = evento.target;
  if (alvo.matches("[data-fechar-modal]") || alvo.classList.contains("modal-fundo")) {
    alvo.closest(".modal-fundo").hidden = true;
  }
});
document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") {
    document.querySelectorAll(".modal-fundo").forEach((m) => (m.hidden = true));
  }
});

const botaoSair = document.getElementById("btn-sair");
if (botaoSair) botaoSair.addEventListener("click", sair);
