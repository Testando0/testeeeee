// app.js

const SUPABASE_URL = 'https://kaczuuycmrpfzpzlhjkx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthY3p1dXljbXJwZnpwemxoamt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MjkyMzcsImV4cCI6MjA3NjEwNTIzN30.5LcsTUihIg_evClHFUdms_JCgRtc-BM4YPt_c3TarVU';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Adiciona ids aos formulários se ainda não tiverem
document.querySelector('form[action="chat.html"]')?.setAttribute('id', 'form-login');
document.querySelector('form[action="index.html"]')?.setAttribute('id', 'form-registro');


// --- LÓGICA DE LOGIN E REGISTRO ---

const formRegistro = document.querySelector('#form-registro');
if (formRegistro) {
    formRegistro.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = formRegistro.username.value.trim();
        const password = formRegistro.password.value;
        const confirmPassword = formRegistro['confirm-password'].value;
        const email = `${username}@redchat.com`; // Usamos um email falso para o Supabase Auth

        if (password !== confirmPassword) {
            alert('As senhas não coincidem!');
            return;
        }
        if (username.length < 3) {
            alert('O nome de usuário deve ter pelo menos 3 caracteres.');
            return;
        }

        // 1. Criar o usuário no Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) {
            alert('Erro no registro: ' + authError.message);
            return;
        }

        // 2. Inserir o perfil público na tabela 'profiles'
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({ id: authData.user.id, username: username, last_seen: new Date().toISOString() });
        
        if (profileError) {
            alert('Erro ao criar perfil: ' + profileError.message);
        } else {
            alert('Registro bem-sucedido! Faça o login.');
            window.location.href = 'index.html';
        }
    });
}

const formLogin = document.querySelector('#form-login');
if (formLogin) {
    formLogin.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = formLogin.username.value.trim();
        const password = formLogin.password.value;
        const email = `${username}@redchat.com`;

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert('Usuário ou senha inválidos.');
        } else {
            window.location.href = 'chat.html';
        }
    });
}


// --- LÓGICA DA PÁGINA DE CHAT ---

const bodyChat = document.querySelector('#chat-body');
if (bodyChat) {
    let currentUser = null;
    let currentChatPartner = null;
    let messageSubscription = null;

    const chatHeader = document.getElementById('chat-header');
    const chatForm = document.getElementById('chat-form');
    const contactListEl = document.getElementById('contact-list');
    const messageAreaEl = document.getElementById('message-area');
    const searchInput = document.getElementById('search-input');
    const logoutButton = document.getElementById('logout-button');
    const messageInput = document.getElementById('message-input');
    
    // Função principal que inicia a página de chat
    const initializeChat = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'index.html'; // Se não está logado, volta para o login
            return;
        }
        currentUser = session.user;
        
        await loadUsers();
        listenToMessages();
        updateLastSeen();
        setInterval(updateLastSeen, 30000); // Atualiza o "visto por último" a cada 30 segundos
    };

    // Atualiza o status "visto por último" do usuário
    const updateLastSeen = async () => {
        await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.id);
    };

    // Carrega usuários para a lista de contatos
    const loadUsers = async (searchTerm = '') => {
        let query = supabase.from('profiles').select('id, username, last_seen').neq('id', currentUser.id);
        if (searchTerm) {
            query = query.ilike('username', `%${searchTerm}%`);
        }
        
        const { data, error } = await query;
        if (error) { console.error('Erro ao carregar usuários:', error); return; }

        contactListEl.innerHTML = '';
        if (data.length === 0) {
            contactListEl.innerHTML = '<p style="text-align: center; padding: 20px; color: #aaa;">Nenhum usuário encontrado.</p>';
        } else {
            data.forEach(profile => {
                const lastSeenDate = new Date(profile.last_seen);
                const now = new Date();
                const diffSeconds = Math.round((now - lastSeenDate) / 1000);
                const status = diffSeconds < 60 ? '<span class="status online">Online</span>' : `<span class="status">Visto por último: ${lastSeenDate.toLocaleDateString()}</span>`;

                contactListEl.innerHTML += `
                    <div class="contact" data-id="${profile.id}" data-username="${profile.username}">
                        <div class="contact-avatar">${profile.username.charAt(0).toUpperCase()}</div>
                        <div class="contact-info">
                            <div class="name">${profile.username}</div>
                            ${status}
                        </div>
                    </div>
                `;
            });
        }
    };
    
    // Carrega mensagens de uma conversa específica
    const loadMessages = async (partnerId) => {
        messageAreaEl.innerHTML = '<p style="text-align: center; color: #aaa;">Carregando...</p>';

        const { data, error } = await supabase
            .from('messages')
            .select('id, content, created_at, sender_id')
            .or(`(sender_id.eq.${currentUser.id},receiver_id.eq.${partnerId}),(sender_id.eq.${partnerId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

        if (error) { console.error('Erro ao carregar mensagens:', error); return; }

        messageAreaEl.innerHTML = '';
        data.forEach(renderMessage);
        messageAreaEl.scrollTop = messageAreaEl.scrollHeight;
    };

    // Renderiza uma única mensagem na tela
    const renderMessage = (msg) => {
        const messageClass = msg.sender_id === currentUser.id ? 'sent' : 'received';
        const deleteIcon = msg.sender_id === currentUser.id 
            ? `<span class="delete-msg" title="Apagar mensagem" data-message-id="${msg.id}">×</span>` 
            : '';

        messageAreaEl.innerHTML += `
            <div class="message ${messageClass}" id="msg-${msg.id}">
                ${deleteIcon}
                ${msg.content}
                <span class="timestamp">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `;
        messageAreaEl.scrollTop = messageAreaEl.scrollHeight;
    };
    
    // Escuta por novas mensagens em tempo real
    const listenToMessages = () => {
        messageSubscription = supabase.channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                const newMessage = payload.new;
                // Adiciona a mensagem apenas se ela pertence à conversa ativa
                if (currentChatPartner && (newMessage.sender_id === currentChatPartner.id || newMessage.receiver_id === currentChatPartner.id)) {
                    renderMessage(newMessage);
                }
            })
            .subscribe();
    };

    // --- EVENT LISTENERS ---
    
    // Pesquisa de usuário
    searchInput.addEventListener('keyup', (e) => loadUsers(e.target.value.trim()));
    
    // Logout
    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });

    // Clicar em um contato para abrir a conversa
    contactListEl.addEventListener('click', (event) => {
        const contactDiv = event.target.closest('.contact');
        if (contactDiv) {
            currentChatPartner = { id: contactDiv.dataset.id, username: contactDiv.dataset.username };
            
            // Ativa visualmente o contato selecionado
            document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
            contactDiv.classList.add('active');

            // Atualiza e mostra o header e o form do chat
            chatHeader.querySelector('.name').textContent = currentChatPartner.username;
            chatHeader.querySelector('.contact-avatar').textContent = currentChatPartner.username.charAt(0).toUpperCase();
            chatHeader.style.display = 'flex';
            chatForm.style.display = 'flex';

            loadMessages(currentChatPartner.id);
            messageInput.focus();
        }
    });

    // Enviar mensagem
    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const content = messageInput.value.trim();
        if (content === '' || !currentChatPartner) return;

        const { error } = await supabase.from('messages').insert({
            sender_id: currentUser.id,
            receiver_id: currentChatPartner.id,
            content: content
        });

        if (error) { console.error('Erro ao enviar mensagem:', error); } 
        else { messageInput.value = ''; }
    });

    // Apagar mensagem
    messageAreaEl.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-msg')) {
            const messageId = event.target.dataset.messageId;
            if (confirm('Tem certeza que deseja apagar esta mensagem?')) {
                const { error } = await supabase.from('messages').delete().eq('id', messageId);
                if (error) {
                    alert('Erro ao apagar mensagem: ' + error.message);
                } else {
                    // Remove a mensagem da tela
                    document.getElementById(`msg-${messageId}`).remove();
                }
            }
        }
    });

    // Inicia tudo
    initializeChat();
}

