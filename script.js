// script.js

// 🚨 SUBSTITUA COM SUAS CREDENCIAIS
const SUPABASE_URL = 'https://ebhdlaarjvthirpxktyi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViaGRsYWFyanZ0aGlycHhrdHlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NDk0MDUsImV4cCI6MjA3NjEyNTQwNX0.BhmIOM0qXwLCMyksbZl20tHkytRb_bg__IEm6qOL7aw';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------------------------------------------
// 1. AUTENTICAÇÃO (Login / Cadastro)
// ------------------------------------------------------------------

/**
 * Função para registrar um novo usuário com email/senha e o username.
 */
async function signUpUser(email, password, username) {
    // 1. Tentar registrar no Supabase Auth com email/senha
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
    });

    if (authError) {
        console.error('Erro no Cadastro de Auth:', authError);
        return { error: authError };
    }

    const userId = authData.user.id;

    // 2. Se o Auth for OK, inserir o username na tabela profiles
    const { error: profileError } = await supabase
        .from('profiles')
        .insert([{ id: userId, username: username }]);

    if (profileError) {
        // Se a inserção do perfil falhar (ex: username já existe),
        // idealmente você deve deletar o usuário criado em auth.users.
        console.error('Erro ao salvar Username:', profileError);
        // Exemplo: Username já existe.
        return { error: profileError };
    }

    return { success: true };
}

/**
 * Função para login com email e senha.
 */
async function signInUser(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        console.error('Erro no Login:', error);
        return { error: error };
    }
    
    // Redireciona após o login
    window.location.href = 'chat.html';
    return { success: true };
}

/**
 * Função para buscar o perfil do usuário logado.
 */
async function getProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('username, id')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Erro ao buscar perfil:', error);
        return null;
    }
    return data;
}


// ------------------------------------------------------------------
// 2. PESQUISA DE USUÁRIOS
// ------------------------------------------------------------------

/**
 * Pesquisa usuários por username
 */
async function searchUsers(query) {
    if (!query) return [];
    
    const { data, error } = await supabase
        .from('profiles')
        .select('username, id')
        // Usa 'ilike' para pesquisa não-sensível a maiúsculas/minúsculas
        .ilike('username', `%${query}%`) 
        .limit(10); 

    if (error) {
        console.error('Erro na pesquisa:', error);
        return [];
    }

    return data;
}

// ------------------------------------------------------------------
// 3. FUNÇÕES DE CHAT (Esboço)
// ------------------------------------------------------------------

// Estas funções exigem mais tabelas (conversations, messages), 
// mas mostram como o Supabase Realtime funciona.

async function subscribeToMessages(conversationId, callback) {
    // O canal escuta por INSERÇÕES (novas mensagens) na tabela 'messages'
    supabase
        .channel(`conversation_${conversationId}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
            (payload) => {
                // Chama a função de callback para renderizar a nova mensagem
                callback(payload.new);
            }
        )
        .subscribe();
}

async function sendMessage(conversationId, senderId, content) {
    const { error } = await supabase
        .from('messages')
        .insert([
            { conversation_id: conversationId, sender_id: senderId, content: content }
        ]);

    if (error) {
        console.error('Erro ao enviar mensagem:', error);
    }
}
