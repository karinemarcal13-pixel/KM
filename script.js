// CONFIGURA SEU NÚMERO AQUI
const numeroWhats = "5543984046323";

// BOTÃO COM MENSAGEM AUTOMÁTICA
function enviarWhats(tipo = "") {
  let mensagem = "Olá, vim pelo site e quero um orçamento";

  if (tipo === "cozinha") {
    mensagem = "Olá, quero reformar minha cozinha com adesivo";
  } 
  else if (tipo === "geladeira") {
    mensagem = "Olá, quero envelopar minha geladeira";
  } 
  else if (tipo === "moveis") {
    mensagem = "Olá, quero renovar meus móveis";
  }

  const link = `https://wa.me/${numeroWhats}?text=${encodeURIComponent(mensagem)}`;
  window.open(link, "_blank");
}

// ANIMAÇÃO AO ROLAR
const elementos = document.querySelectorAll("section, .card");

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
    }
  });
}, { threshold: 0.2 });

elementos.forEach((el) => {
  el.style.opacity = "0";
  el.style.transform = "translateY(40px)";
  el.style.transition = "0.6s";
  observer.observe(el);
});

// BOTÃO WHATS FLUTUANTE COM TEXTO PERSONALIZADO
const botaoWhats = document.querySelector(".whatsapp");

if (botaoWhats) {
  botaoWhats.addEventListener("click", (e) => {
    e.preventDefault();
    enviarWhats();
  });
}

// CLICK NOS CARDS (CONVERTE MAIS)
document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("click", () => {
    const texto = card.innerText.toLowerCase();

    if (texto.includes("cozinha")) enviarWhats("cozinha");
    else if (texto.includes("geladeira")) enviarWhats("geladeira");
    else enviarWhats("moveis");
  });
});