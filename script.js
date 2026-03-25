function enviarWhats(event) {
  event.preventDefault();

  let nome = document.getElementById("nome").value;
  let servico = document.getElementById("servico").value;

  let mensagem = `Olá, meu nome é ${nome}
Quero orçamento

📍 Londrina e região

Serviço: ${servico}`;

  window.open(`https://wa.me/5543984046323?text=${encodeURIComponent(mensagem)}`);
}