/* ==========================================================================
   RAÍZES DO AMANHÃ - main.js
   JavaScript puro (vanilla), sem bibliotecas.

   SUMÁRIO
   1. Inicialização
   2. Menu mobile
   3. Funções de máscara (CPF, telefone, CEP)
   4. Validação de CPF
   5. Busca de endereço pelo CEP (API ViaCEP)
   6. Contadores animados (página de projetos)
   7. Formulário de cadastro
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   1. INICIALIZAÇÃO
   O script usa "defer" no HTML, então roda depois que o HTML foi lido.
   O DOMContentLoaded garante isso mesmo se o "defer" for removido.
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // A classe "js" ativa no CSS o menu retrátil e o botão "Menu"
  document.documentElement.classList.add('js');

  iniciarMenuMobile();
  iniciarMascaras();
  iniciarBuscaCep();
  iniciarContadores();
  iniciarFormularioCadastro();
});


/* --------------------------------------------------------------------------
   2. MENU MOBILE
   Alterna a classe .is-open e o atributo aria-expanded (acessibilidade).
   -------------------------------------------------------------------------- */
function iniciarMenuMobile() {
  const botao = document.getElementById('menu-toggle');
  const menu = document.getElementById('menu-principal');
  if (!botao || !menu) return; // a página pode não ter menu

  const alternarMenu = (abrir) => {
    menu.classList.toggle('is-open', abrir);
    botao.setAttribute('aria-expanded', String(abrir));
  };

  botao.addEventListener('click', () => {
    const estaAberto = botao.getAttribute('aria-expanded') === 'true';
    alternarMenu(!estaAberto);
  });

  // Tecla Esc fecha o menu e devolve o foco ao botão (boa prática de acessibilidade)
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && menu.classList.contains('is-open')) {
      alternarMenu(false);
      botao.focus();
    }
  });

  // Clicar em um link do menu fecha o menu (útil nas âncoras da mesma página)
  menu.addEventListener('click', (evento) => {
    if (evento.target.closest('a')) alternarMenu(false);
  });
}


/* --------------------------------------------------------------------------
   3. MÁSCARAS
   Cada função recebe o texto digitado e devolve o texto formatado.
   Primeiro removemos tudo que não é número (\D), depois montamos o formato.
   -------------------------------------------------------------------------- */

/** Mantém só os dígitos: "123.456" -> "123456" */
function somenteNumeros(valor) {
  return valor.replace(/\D/g, '');
}

/** CPF: 000.000.000-00 */
function mascaraCpf(valor) {
  return somenteNumeros(valor)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Telefone: (00) 0000-0000 ou (00) 00000-0000 (com o 9 do celular) */
function mascaraTelefone(valor) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  if (numeros.length <= 2) return numeros.replace(/^(\d{0,2})/, '($1');
  if (numeros.length <= 6) return numeros.replace(/^(\d{2})(\d+)/, '($1) $2');
  if (numeros.length <= 10) return numeros.replace(/^(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
  return numeros.replace(/^(\d{2})(\d{5})(\d+)/, '($1) $2-$3');
}

/** CEP: 00000-000 */
function mascaraCep(valor) {
  return somenteNumeros(valor)
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, '$1-$2');
}

// Tabela que liga o valor de data-mask="..." à função correspondente
const MASCARAS = {
  cpf: mascaraCpf,
  telefone: mascaraTelefone,
  cep: mascaraCep,
};

/** Procura todo input com data-mask e aplica a máscara enquanto a pessoa digita */
function iniciarMascaras() {
  const campos = document.querySelectorAll('[data-mask]');

  campos.forEach((campo) => {
    const funcaoMascara = MASCARAS[campo.dataset.mask];
    if (!funcaoMascara) return;

    campo.addEventListener('input', () => {
      campo.value = funcaoMascara(campo.value);
    });

    // Formata também caso o navegador preencha o campo automaticamente
    if (campo.value) campo.value = funcaoMascara(campo.value);
  });
}


/* --------------------------------------------------------------------------
   4. VALIDAÇÃO DE CPF
   O "pattern" do HTML só confere o formato. Aqui conferimos os dois dígitos
   verificadores (algoritmo oficial da Receita Federal).
   -------------------------------------------------------------------------- */
function cpfEhValido(cpf) {
  const numeros = somenteNumeros(cpf);

  // Precisa ter 11 dígitos e não pode ser sequência repetida (111.111.111-11 etc.)
  if (numeros.length !== 11 || /^(\d)\1{10}$/.test(numeros)) return false;

  // Calcula um dígito verificador: soma os produtos e aplica a regra do resto
  const calcularDigito = (quantidade) => {
    let soma = 0;
    for (let i = 0; i < quantidade; i++) {
      soma += Number(numeros[i]) * (quantidade + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return (
    calcularDigito(9) === Number(numeros[9]) &&
    calcularDigito(10) === Number(numeros[10])
  );
}

/** Marca o campo como inválido com uma mensagem nativa do navegador */
function validarCampoCpf(campo) {
  if (!campo.value) {
    campo.setCustomValidity(''); // o "required" cuida do campo vazio
    return;
  }
  const mensagem = cpfEhValido(campo.value) ? '' : 'CPF inválido. Confira os números digitados.';
  campo.setCustomValidity(mensagem);
}


/* --------------------------------------------------------------------------
   5. BUSCA DE ENDEREÇO PELO CEP (API ViaCEP)
   Documentação: https://viacep.com.br
   fetch() faz a requisição; "async/await" deixa o código mais legível.
   -------------------------------------------------------------------------- */
async function buscarEnderecoPorCep(cep) {
  const numeros = somenteNumeros(cep);
  if (numeros.length !== 8) return null;

  const resposta = await fetch(`https://viacep.com.br/ws/${numeros}/json/`);
  if (!resposta.ok) throw new Error('Falha ao consultar o CEP.');

  const dados = await resposta.json();
  if (dados.erro) return null; // CEP com formato correto, mas inexistente

  return dados;
}

function iniciarBuscaCep() {
  const campoCep = document.getElementById('cep');
  if (!campoCep) return;

  const campoEndereco = document.getElementById('endereco');
  const campoCidade = document.getElementById('cidade');
  const campoEstado = document.getElementById('estado');
  const ajuda = document.getElementById('cep-ajuda');
  const textoOriginal = ajuda ? ajuda.textContent : '';

  const avisar = (texto) => { if (ajuda) ajuda.textContent = texto; };

  // "blur" = quando a pessoa sai do campo
  campoCep.addEventListener('blur', async () => {
    campoCep.setCustomValidity('');
    if (somenteNumeros(campoCep.value).length !== 8) return;

    avisar('Buscando endereço...');

    try {
      const dados = await buscarEnderecoPorCep(campoCep.value);

      if (!dados) {
        campoCep.setCustomValidity('CEP não encontrado.');
        campoCep.reportValidity();
        avisar('CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }

      // Preenche só o que veio da API (alguns CEPs não têm rua ou bairro)
      const partesEndereco = [dados.logradouro, dados.bairro].filter(Boolean);
      if (campoEndereco && partesEndereco.length) {
        campoEndereco.value = partesEndereco.join(' - ');
      }
      if (campoCidade) campoCidade.value = dados.localidade || '';
      if (campoEstado) campoEstado.value = dados.uf || '';

      avisar('Endereço preenchido. Complete com o número e o complemento.');
      if (campoEndereco) campoEndereco.focus();
    } catch (erro) {
      // Sem internet ou API fora do ar: o formulário continua funcionando manualmente
      avisar('Não foi possível buscar o CEP agora. Preencha o endereço manualmente.');
    }
  });

  // Ao voltar a editar o CEP, restaura o texto de ajuda original
  campoCep.addEventListener('input', () => {
    campoCep.setCustomValidity('');
    avisar(textoOriginal);
  });
}


/* --------------------------------------------------------------------------
   6. CONTADORES ANIMADOS (projetos.html)
   Usa os atributos data-contador e data-valor-final do HTML.
   IntersectionObserver dispara a animação só quando o número aparece na tela.
   -------------------------------------------------------------------------- */
function iniciarContadores() {
  const contadores = document.querySelectorAll('[data-contador]');
  if (!contadores.length) return;

  // Quem prefere menos movimento vê o número final direto
  const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduzirMovimento || !('IntersectionObserver' in window)) return;

  const animar = (elemento) => {
    const valorFinal = Number(elemento.dataset.valorFinal);
    const duracao = 1500; // milissegundos
    const inicio = performance.now();

    // Esconde dos leitores de tela enquanto anima; evita ler "1, 2, 3..."
    elemento.setAttribute('aria-hidden', 'true');

    const passo = (agora) => {
      const progresso = Math.min((agora - inicio) / duracao, 1);
      const valorAtual = Math.floor(progresso * valorFinal);
      elemento.textContent = valorAtual.toLocaleString('pt-BR');

      if (progresso < 1) {
        requestAnimationFrame(passo);
      } else {
        elemento.textContent = valorFinal.toLocaleString('pt-BR');
        elemento.removeAttribute('aria-hidden');
      }
    };

    requestAnimationFrame(passo);
  };

  const observador = new IntersectionObserver((entradas, obs) => {
    entradas.forEach((entrada) => {
      if (entrada.isIntersecting) {
        animar(entrada.target);
        obs.unobserve(entrada.target); // anima uma vez só
      }
    });
  }, { threshold: 0.5 });

  contadores.forEach((contador) => observador.observe(contador));
}


/* --------------------------------------------------------------------------
   7. FORMULÁRIO DE CADASTRO
   -------------------------------------------------------------------------- */

/** Calcula a data máxima de nascimento para ser maior de 18 anos (hoje - 18 anos) */
function definirDataMaximaNascimento(campo) {
  const hoje = new Date();
  hoje.setFullYear(hoje.getFullYear() - 18);
  // toISOString devolve "2008-10-09T..."; cortamos nos 10 primeiros caracteres
  campo.max = hoje.toISOString().slice(0, 10);
}

/** Mostra uma mensagem na área aria-live (leitores de tela anunciam sozinhos) */
function mostrarMensagem(area, texto, tipo) {
  area.className = `form__mensagem form__mensagem--${tipo}`;
  area.textContent = texto;
}

function iniciarFormularioCadastro() {
  const formulario = document.getElementById('form-cadastro');
  if (!formulario) return;

  const campoCpf = document.getElementById('cpf');
  const campoNascimento = document.getElementById('nascimento');
  const areaMensagem = document.getElementById('form-mensagem');

  if (campoNascimento) definirDataMaximaNascimento(campoNascimento);

  // Valida o CPF enquanto a pessoa digita e ao sair do campo
  if (campoCpf) {
    campoCpf.addEventListener('input', () => validarCampoCpf(campoCpf));
    campoCpf.addEventListener('blur', () => validarCampoCpf(campoCpf));
  }

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault(); // impede o envio real (ainda não temos servidor)

    if (campoCpf) validarCampoCpf(campoCpf);

    // checkValidity() usa todas as regras do HTML (required, pattern, minlength...)
    if (!formulario.checkValidity()) {
      mostrarMensagem(areaMensagem, 'Há campos com erro. Corrija-os e tente novamente.', 'erro');
      formulario.reportValidity(); // mostra a mensagem do navegador e foca o 1º campo inválido
      return;
    }

    // FormData lê todos os campos pelo atributo "name"
    const dados = new FormData(formulario);
    const cadastro = Object.fromEntries(dados.entries());
    cadastro.interesses = dados.getAll('interesses'); // checkboxes: lista de valores

    console.log('Cadastro pronto para envio:', cadastro);

    mostrarMensagem(
      areaMensagem,
      `Obrigado, ${cadastro.nome.split(' ')[0]}! Seu cadastro foi recebido. Entraremos em contato em até 5 dias úteis.`,
      'sucesso'
    );
    formulario.reset();
    areaMensagem.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Ao limpar o formulário, limpa também a mensagem exibida
  formulario.addEventListener('reset', () => {
    areaMensagem.textContent = '';
    areaMensagem.className = 'form__mensagem';
  });
}
