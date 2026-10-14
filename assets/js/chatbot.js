let historicoMensagens = [];
let userRole = null; 
let filtroAtual = 'todos'; 

// Sessão e banco de dados
const API_BASE = 'http://localhost:3000/api';
let tokenSessao = null;
let bancoDeDadosItens = []; // agora vem do banco de dados (veja carregarItens)

function cabecalhosApi() {
    const cabecalhos = { 'Content-Type': 'application/json' };
    if (tokenSessao) cabecalhos['Authorization'] = `Bearer ${tokenSessao}`;
    return cabecalhos;
}

// Se o servidor reiniciou (ou a sessão venceu), volta para a tela de login
function sessaoExpirou(resposta) {
    if (resposta.status !== 401) return false;
    alert('Sua sessão expirou. Entre novamente.');
    fazerLogout();
    return true;
}

// Protege a tabela: texto digitado nunca vira HTML
function escaparHtml(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[caractere]));
}

async function carregarItens() {
    try {
        const resposta = await fetch(`${API_BASE}/itens`, { headers: cabecalhosApi() });
        if (!resposta.ok) throw new Error('Falha ao carregar itens');
        bancoDeDadosItens = await resposta.json();
    } catch (error) {
        console.error('Erro ao carregar itens do banco:', error);
        alert('Não foi possível carregar os itens do banco de dados.');
    }
    renderizarTabela();
}

window.addEventListener('DOMContentLoaded', () => {
    renderizarTabela();
});

// Entra no sistema com os dados que o servidor devolveu ({ role, token }).
// É usada tanto pelo login quanto pelo cadastro de conta nova.
async function entrarNoSistema(dados) {
    userRole = dados.role;
    tokenSessao = dados.token;   // guarda a sessão
    await carregarItens();       // busca os itens no banco de dados
    aplicarPermissoesDeAcesso();

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    document.getElementById('form-login').reset();
}

// FUNÇÃO DE LOGIN ADAPTADA PARA LOCALHOST
async function autenticarUsuario(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const dados = await response.json();

        if (response.ok) {
            await entrarNoSistema(dados);
        } else {
            alert(dados.erro || 'Falha ao autenticar.');
        }

    } catch (error) {
        console.error("Erro interno detalhado capturado:", error);
        alert("Erro de Inicialização: O site não encontrou o servidor na porta 3000. Certifique-se de usar o mesmo domínio na barra de endereço.");
    }
}

function aplicarPermissoesDeAcesso() {
    const botaoCadastrarMenu = document.getElementById('aba-menu-cadastrar');
    const badgeUsuario = document.getElementById('user-badge');

    if (userRole === 'admin') {
        if (botaoCadastrarMenu) botaoCadastrarMenu.style.display = 'flex';
        if (badgeUsuario) {
            badgeUsuario.innerText = '🛡️ Administrador';
            badgeUsuario.style.color = '#7209B7';
        }
    } else {
        if (botaoCadastrarMenu) botaoCadastrarMenu.style.display = 'none';
        if (badgeUsuario) {
            badgeUsuario.innerText = '🎓 Aluno / Usuário';
            badgeUsuario.style.color = '#A0A0AB';
        }
        mudarAbaPadrao('inicio');
    }
    
    renderizarTabela();
}

function fazerLogout() {
    userRole = null;
    tokenSessao = null;
    bancoDeDadosItens = [];
    historicoMensagens = [];
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
}

// FLUXO DO ASSISTENTE VIRTUAL
async function enviarMensagem() {
    const input = document.getElementById('input-message');
    const texto = input.value.trim();
    if (!texto) return;

    input.value = '';
    adicionarMensagemNaTela(texto, 'user');
    historicoMensagens.push({ role: 'user', content: texto });

    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: cabecalhosApi(),
            body: JSON.stringify({ historicoMensagens: historicoMensagens })
        });

        if (sessaoExpirou(response)) return;
        const dados = await response.json();

        if (!response.ok) {
            adicionarMensagemNaTela(dados.erro || "Não consegui responder agora. Tente de novo.", 'assistant');
            historicoMensagens.pop(); // tira a pergunta que falhou para não atrapalhar as próximas
            return;
        }

        const respostaIA = dados.respostaDaIA;

        adicionarMensagemNaTela(respostaIA, 'assistant');
        historicoMensagens.push({ role: 'assistant', content: respostaIA });

        if (dados.itemRegistrado) {
            bancoDeDadosItens.unshift(dados.itemRegistrado);
            renderizarTabela();
        }

    } catch (error) {
        console.error("Erro ao falar com a IA:", error);
        adicionarMensagemNaTela("Erro de conexão com o servidor do CEEP.", 'assistant');
    }
}

function adicionarMensagemNaTela(texto, remetente) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    const div = document.createElement('div');
    div.classList.add('message', remetente);
    div.innerText = texto;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// CADASTRO MANUAL (grava no banco de dados)
async function cadastrarItemManual(event) {
    event.preventDefault();
    const novoItem = {
        tipo: document.getElementById('form-tipo').value,
        item: document.getElementById('form-item').value,
        local: document.getElementById('form-local').value,
        descricao: document.getElementById('form-desc').value
    };

    try {
        const resposta = await fetch(`${API_BASE}/itens`, {
            method: 'POST',
            headers: cabecalhosApi(),
            body: JSON.stringify(novoItem)
        });

        if (sessaoExpirou(resposta)) return;
        const dados = await resposta.json();

        if (!resposta.ok) {
            alert(dados.erro || 'Não foi possível registrar o objeto.');
            return;
        }

        bancoDeDadosItens.unshift(dados);
        renderizarTabela();
        document.getElementById('form-cadastro').reset();
        alert(`Sucesso! Objeto registrado sob o protocolo #${dados.id}`);
    } catch (error) {
        console.error('Erro ao cadastrar item:', error);
        alert('Erro de conexão com o servidor.');
    }
}

// RENDERIZAR TABELA COM SUPORTE A FILTROS, REMOÇÃO E MUDANÇA DE STATUS
function renderizarTabela() {
    const corpoTabela = document.getElementById('lista-itens-corpo');
    if (!corpoTabela) return;
    corpoTabela.innerHTML = '';

    const itensFiltrados = bancoDeDadosItens.filter(item => {
        if (filtroAtual === 'todos') return true;
        return item.tipo === filtroAtual;
    });

    itensFiltrados.forEach(registro => {
        const tr = document.createElement('tr');
        
        // Ajusta dinamicamente o texto do botão com base no status do item
        const textoBotaoStatus = registro.tipo === 'perdido' ? '🔄 Marcar como Achado' : '🔄 Marcar como Perdido';
        const idSeguro = Number(registro.id);

        tr.innerHTML = `
            <td>#${idSeguro}</td>
            <td><span class="badge ${escaparHtml(registro.tipo)}">${escaparHtml(registro.tipo)}</span></td>
            <td><strong>${escaparHtml(registro.item)}</strong></td>
            <td>${escaparHtml(registro.local)}</td>
            <td style="color: var(--text-muted); font-size: 0.9rem;">${escaparHtml(registro.desc)}</td>
            <td class="coluna-acao-item">
                <div class="acoes-admin-container" style="display: ${userRole === 'admin' ? 'flex' : 'none'};">
                    <button class="btn-status" onclick="alternarStatusObjeto(${idSeguro})">${textoBotaoStatus}</button>
                    <button class="btn-remover" onclick="removerObjeto(${idSeguro})">Remover</button>
                </div>
            </td>
        `;
        corpoTabela.appendChild(tr);
    });

    const cabecalhoAcao = document.querySelector('.coluna-acao-admin');
    if (cabecalhoAcao) {
        if (userRole === 'admin') {
            cabecalhoAcao.classList.remove('ocultar-coluna');
        } else {
            cabecalhoAcao.classList.add('ocultar-coluna');
            document.querySelectorAll('.coluna-acao-item').forEach(td => td.classList.add('ocultar-coluna'));
        }
    }
}

// CLASSIFICAÇÃO / FILTROS
function filtrarItens(tipoFiltro, evento) {
    filtroAtual = tipoFiltro;
    document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('active'));
    evento.target.classList.add('active');
    renderizarTabela();
}

// ALTERNAR STATUS DO PROTOCOLO (Perdido <-> Achado) - grava no banco de dados
async function alternarStatusObjeto(idProtocolo) {
    if (userRole !== 'admin') {
        alert("Ação não autorizada!");
        return;
    }

    try {
        const resposta = await fetch(`${API_BASE}/itens/${idProtocolo}/status`, {
            method: 'PUT',
            headers: cabecalhosApi()
        });

        if (sessaoExpirou(resposta)) return;
        const dados = await resposta.json();

        if (!resposta.ok) {
            alert(dados.erro || 'Não foi possível alterar o status.');
            return;
        }

        const posicao = bancoDeDadosItens.findIndex(item => item.id === idProtocolo);
        const statusAntigo = posicao >= 0 ? bancoDeDadosItens[posicao].tipo : '?';
        if (posicao >= 0) bancoDeDadosItens[posicao] = dados;

        renderizarTabela();
        alert(`O protocolo #${idProtocolo} foi alterado de "${statusAntigo}" para "${dados.tipo}" com sucesso.`);
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        alert('Erro de conexão com o servidor.');
    }
}

// REMOVER REGISTRO - apaga do banco de dados
async function removerObjeto(idProtocolo) {
    if (userRole !== 'admin') {
        alert("Ação não autorizada!");
        return;
    }

    const confirmar = confirm(`Tem certeza que deseja remover permanentemente o objeto #${idProtocolo}?`);
    if (!confirmar) return;

    try {
        const resposta = await fetch(`${API_BASE}/itens/${idProtocolo}`, {
            method: 'DELETE',
            headers: cabecalhosApi()
        });

        if (sessaoExpirou(resposta)) return;
        const dados = await resposta.json();

        if (!resposta.ok) {
            alert(dados.erro || 'Não foi possível remover o item.');
            return;
        }

        bancoDeDadosItens = bancoDeDadosItens.filter(item => item.id !== idProtocolo);
        renderizarTabela();
        alert(`O item #${idProtocolo} foi excluído do sistema.`);
    } catch (error) {
        console.error('Erro ao remover item:', error);
        alert('Erro de conexão com o servidor.');
    }
}

function mudarAba(nomeAba, evento) {
    document.querySelectorAll('.btn-aba').forEach(btn => btn.classList.remove('active'));
    const botaoClicado = evento.target.closest('.btn-aba');
    if (botaoClicado) botaoClicado.classList.add('active');

    document.querySelectorAll('.aba-conteudo').forEach(aba => aba.classList.remove('active'));
    const abaAlvo = document.getElementById(`aba-${nomeAba}`);
    if (abaAlvo) abaAlvo.classList.add('active');
}

function mudarAbaPadrao(nomeAba) {
    document.querySelectorAll('.btn-aba').forEach(btn => btn.classList.remove('active'));
    const primeiroBotao = document.querySelector('.btn-aba:nth-child(1)');
    if (primeiroBotao) primeiroBotao.classList.add('active');
    
    document.querySelectorAll('.aba-conteudo').forEach(aba => aba.classList.remove('active'));
    const abaAlvo = document.getElementById(`aba-${nomeAba}`);
    if (abaAlvo) abaAlvo.classList.add('active');
}

// ===== CRIAR CONTA / ENTRAR =====
// Usa a tela de login que você já tem e adiciona o modo "Criar conta".
(function () {
    const API_REGISTRO = 'http://localhost:3000/api/registrar';

    // Regras da senha (o servidor confere as mesmas regras)
    const REGRAS_SENHA = [
        { texto: 'Pelo menos 8 caracteres', ok: (s) => s.length >= 8 },
        { texto: 'Uma letra minúscula',     ok: (s) => /\p{Ll}/u.test(s) },
        { texto: 'Uma letra maiúscula',     ok: (s) => /\p{Lu}/u.test(s) },
        { texto: 'Um número',               ok: (s) => /[0-9]/.test(s) }
    ];

    // Confere o formato do e-mail (o servidor também confere se o domínio existe)
    function emailTemFormatoValido(email) {
        const texto = String(email).trim().toLowerCase();
        const partes = texto.split('@');
        if (partes.length !== 2 || texto.length > 254 || partes[0].length > 64) return false;
        return /^[a-z0-9]+([._%+-][a-z0-9]+)*$/.test(partes[0])
            && /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(partes[1]);
    }

    function iniciarCadastroLogin() {
        const form = document.getElementById('form-login');
        const inputEmail = document.getElementById('login-email');
        const inputSenha = document.getElementById('login-senha');
        if (!form || !inputEmail || !inputSenha) return;

        const botaoEnviar = form.querySelector('button[type="submit"], button:not([type])');
        const titulo = document.querySelector('#login-screen h2');
        const textoBotaoOriginal = botaoEnviar ? botaoEnviar.textContent : 'Entrar';
        const tituloOriginal = titulo ? titulo.textContent : '';
        let modoCadastro = false;

        // Campo "Confirmar senha": copia o visual do campo de senha que já existe
        const blocoSenha = inputSenha.parentElement === form ? inputSenha : inputSenha.parentElement;
        const blocoConfirma = blocoSenha.cloneNode(true);
        const inputConfirma = blocoConfirma.tagName === 'INPUT' ? blocoConfirma : blocoConfirma.querySelector('input');
        inputConfirma.id = 'login-confirma-senha';
        inputConfirma.value = '';
        inputConfirma.placeholder = 'Repita a senha';
        const rotulo = blocoConfirma.querySelector ? blocoConfirma.querySelector('label') : null;
        if (rotulo) { rotulo.textContent = 'Confirmar senha'; rotulo.htmlFor = inputConfirma.id; }
        blocoConfirma.style.display = 'none';
        blocoSenha.insertAdjacentElement('afterend', blocoConfirma);

        // Lista que mostra, enquanto a pessoa digita, quais regras da senha já foram atendidas
        const listaRegras = document.createElement('div');
        listaRegras.style.cssText = 'display:none; text-align:left; font-size:0.8rem; line-height:1.6; margin:-4px 0 10px;';
        blocoSenha.insertAdjacentElement('afterend', listaRegras);

        function atualizarRegras() {
            listaRegras.textContent = '';
            REGRAS_SENHA.forEach((regra) => {
                const atendida = regra.ok(inputSenha.value);
                const linha = document.createElement('div');
                linha.textContent = `${atendida ? '✓' : '✗'} ${regra.texto}`;
                linha.style.color = atendida ? '#66BB6A' : '#A0A0AB';
                listaRegras.appendChild(linha);
            });
        }
        inputSenha.addEventListener('input', () => { if (modoCadastro) atualizarRegras(); });

        // Mensagem de aviso e botão que alterna entre "Entrar" e "Criar conta"
        const aviso = document.createElement('div');
        aviso.style.cssText = 'min-height:1.2em; margin-top:12px; font-size:0.85rem; color:#EF5350;';
        const alternar = document.createElement('button');
        alternar.type = 'button';
        alternar.style.cssText = 'background:none; border:none; margin-top:14px; color:var(--bright-purple); cursor:pointer; font-size:0.9rem; text-decoration:underline;';
        form.appendChild(aviso);
        form.appendChild(alternar);

        function definirModo(cadastro) {
            modoCadastro = cadastro;
            blocoConfirma.style.display = cadastro ? '' : 'none';
            listaRegras.style.display = cadastro ? 'block' : 'none';
            inputConfirma.required = cadastro; // campo escondido nunca pode bloquear o login
            inputConfirma.value = '';
            inputSenha.autocomplete = cadastro ? 'new-password' : 'current-password';
            if (botaoEnviar) botaoEnviar.textContent = cadastro ? 'Criar conta' : textoBotaoOriginal;
            if (titulo) titulo.textContent = cadastro ? 'Criar conta' : tituloOriginal;
            alternar.textContent = cadastro ? 'Já tenho conta. Entrar' : 'Não tem conta? Criar agora';
            aviso.textContent = '';
            if (cadastro) atualizarRegras();
        }

        alternar.addEventListener('click', () => definirModo(!modoCadastro));

        // Fase de captura: no modo "Criar conta" interceptamos o envio antes do login original.
        // No modo "Entrar" não fazemos nada e o seu autenticarUsuario() roda normalmente.
        document.addEventListener('submit', async (event) => {
            if (event.target !== form || !modoCadastro) return;
            event.preventDefault();
            event.stopPropagation();

            const email = inputEmail.value.trim();
            const senha = inputSenha.value;

            if (!emailTemFormatoValido(email)) {
                aviso.textContent = 'Digite um e-mail válido, por exemplo nome@dominio.com.';
                return;
            }

            const faltando = REGRAS_SENHA.filter((regra) => !regra.ok(senha));
            if (faltando.length > 0) {
                aviso.textContent = 'A senha precisa ter: ' + faltando.map((regra) => regra.texto.toLowerCase()).join(', ') + '.';
                return;
            }

            if (senha !== inputConfirma.value) { aviso.textContent = 'As senhas não conferem.'; return; }

            aviso.textContent = 'Criando conta...';
            try {
                const resposta = await fetch(API_REGISTRO, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, senha })
                });
                const dados = await resposta.json();

                if (!resposta.ok) {
                    aviso.textContent = dados.erro || 'Não foi possível criar a conta.';
                    return;
                }

                await entrarNoSistema(dados); // conta criada: entra direto, sem passar pela tela de login
                definirModo(false);           // deixa a tela de login pronta para o próximo uso
            } catch (error) {
                console.error('Erro ao criar conta:', error);
                aviso.textContent = 'Não foi possível falar com o servidor (porta 3000).';
            }
        }, true);

        definirModo(false);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarCadastroLogin);
    } else {
        iniciarCadastroLogin();
    }
})();