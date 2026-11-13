// ============================================================
// Tela de login / cadastro
// ============================================================
const formEntrar = document.getElementById("form-entrar");
const formCadastrar = document.getElementById("form-cadastrar");
const erroEl = document.getElementById("login-erro");

function mostrarErro(texto) {
  erroEl.textContent = texto;
  erroEl.hidden = !texto;
}

function irParaInicio(usuario) {
  location.href = usuario.papel === "admin" ? "/admin" : "/loja";
}

// Troca entre as abas "Entrar" e "Criar conta"
document.querySelectorAll("[data-aba]").forEach((aba) => {
  aba.addEventListener("click", () => {
    document.querySelectorAll("[data-aba]").forEach((a) => a.classList.toggle("ativa", a === aba));
    formEntrar.hidden = aba.dataset.aba !== "entrar";
    formCadastrar.hidden = aba.dataset.aba !== "cadastrar";
    mostrarErro("");
  });
});

// Envia um formulário para a API, travando o botão enquanto espera
async function enviar(form, caminho) {
  const botao = form.querySelector("button[type=submit]");
  const dados = Object.fromEntries(new FormData(form));
  mostrarErro("");
  botao.disabled = true;
  try {
    const resposta = await api(caminho, { method: "POST", body: dados });
    irParaInicio(resposta.usuario);
  } catch (e) {
    mostrarErro(e.message);
    botao.disabled = false;
  }
}

formEntrar.addEventListener("submit", (evento) => {
  evento.preventDefault();
  enviar(formEntrar, "/api/login");
});

formCadastrar.addEventListener("submit", (evento) => {
  evento.preventDefault();
  enviar(formCadastrar, "/api/cadastro");
});

// Atalho das contas de demonstração: preenche o formulário de login
document.querySelectorAll(".demo").forEach((botao) => {
  botao.addEventListener("click", () => {
    document.querySelector('[data-aba="entrar"]').click();
    formEntrar.email.value = botao.dataset.email;
    formEntrar.senha.value = botao.dataset.senha;
    formEntrar.querySelector("button[type=submit]").focus();
  });
});
