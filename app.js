/* =========================================
   EDRAK AI - APP.JS
   Frontend Chat System
   GitHub Pages + Vercel Backend
========================================= */

(() => {
    "use strict";

    /* ===============================
       CONFIG
    =============================== */

    const API_BASE_URL =
        window.EDRAK_CONFIG?.API_BASE_URL || "";

    const TOKEN_KEY = "edrak_token";
    const USER_KEY = "edrak_user";
    const CURRENT_CHAT_KEY = "edrak_current_chat";

    /* ===============================
       DOM
    =============================== */

    const chatMessages =
        document.getElementById("chatMessages");

    const messageInput =
        document.getElementById("messageInput");

    const sendButton =
        document.getElementById("sendButton");

    const chatsList =
        document.getElementById("chatsList");

    const newChatButton =
        document.getElementById("newChatBtn");

    const userName =
        document.getElementById("userName");

    const userEmail =
        document.getElementById("userEmail");

    const logoutButton =
        document.getElementById("logoutBtn");

    /* ===============================
       HELPERS
    =============================== */

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function getUser() {
        try {
            return JSON.parse(
                localStorage.getItem(USER_KEY) || "null"
            );
        } catch {
            return null;
        }
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showError(message) {
        alert(message);
    }

    function getCurrentChatId() {
        return localStorage.getItem(CURRENT_CHAT_KEY);
    }

    function setCurrentChatId(id) {
        if (id) {
            localStorage.setItem(
                CURRENT_CHAT_KEY,
                String(id)
            );
        } else {
            localStorage.removeItem(
                CURRENT_CHAT_KEY
            );
        }
    }

    /* ===============================
       API REQUEST
    =============================== */

    async function apiRequest(endpoint, options = {}) {

        if (!API_BASE_URL) {
            throw new Error(
                "رابط Vercel غير موجود في config.js"
            );
        }

        const url =
            API_BASE_URL.replace(/\/+$/, "") +
            endpoint;

        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };

        const token = getToken();

        if (token) {
            headers.Authorization =
                `Bearer ${token}`;
        }

        let response;

        try {

            response = await fetch(url, {
                ...options,
                headers
            });

        } catch (error) {

            throw new Error(
                "تعذر الاتصال بالسيرفر. تأكد أن رابط Vercel صحيح وأن الـBackend يعمل."
            );
        }

        const contentType =
            response.headers.get("content-type") || "";

        let data = null;

        if (contentType.includes("application/json")) {

            try {
                data = await response.json();
            } catch {
                data = null;
            }

        } else {

            const text =
                await response.text();

            if (text.trim().startsWith("<")) {
                throw new Error(
                    "السيرفر رجّع HTML بدل JSON. راجع رابط Vercel الموجود في config.js"
                );
            }

            try {
                data = JSON.parse(text);
            } catch {
                data = {
                    error: text
                };
            }
        }

        if (!response.ok) {

            if (response.status === 401) {

                localStorage.removeItem(
                    TOKEN_KEY
                );

                localStorage.removeItem(
                    USER_KEY
                );
            }

            throw new Error(
                data?.error ||
                `حدث خطأ (${response.status})`
            );
        }

        return data;
    }

    /* ===============================
       AUTH CHECK
    =============================== */

    async function checkAuth() {

        const token = getToken();

        if (!token) {
            window.location.href =
                "login.html";
            return null;
        }

        try {

            const data =
                await apiRequest("/api/me");

            if (data?.user) {

                localStorage.setItem(
                    USER_KEY,
                    JSON.stringify(data.user)
                );

                return data.user;
            }

            return getUser();

        } catch (error) {

            console.error(
                "Auth error:",
                error
            );

            localStorage.removeItem(
                TOKEN_KEY
            );

            localStorage.removeItem(
                USER_KEY
            );

            window.location.href =
                "login.html";

            return null;
        }
    }

    /* ===============================
       USER UI
    =============================== */

    function renderUser(user) {

        if (!user) return;

        if (userName) {
            userName.textContent =
                user.name ||
                user.username ||
                "مستخدم";
        }

        if (userEmail) {
            userEmail.textContent =
                user.email || "";
        }

        const initials =
            document.getElementById(
                "userInitials"
            );

        if (initials) {

            const name =
                user.name ||
                user.username ||
                "E";

            initials.textContent =
                name
                    .trim()
                    .charAt(0)
                    .toUpperCase();
        }
    }

    /* ===============================
       LOAD CHATS
    =============================== */

    async function loadChats() {

        if (!chatsList) return;

        try {

            const data =
                await apiRequest(
                    "/api/chats"
                );

            const chats =
                data?.chats || [];

            chatsList.innerHTML = "";

            if (!chats.length) {

                chatsList.innerHTML = `
                    <div class="empty-chats">
                        لا توجد محادثات بعد
                    </div>
                `;

                return;
            }

            chats.forEach(chat => {

                const item =
                    document.createElement("div");

                item.className =
                    "chat-item";

                if (
                    String(chat.id) ===
                    String(getCurrentChatId())
                ) {
                    item.classList.add(
                        "active"
                    );
                }

                item.innerHTML = `
                    <div class="chat-item-title">
                        ${escapeHTML(
                            chat.title ||
                            "محادثة جديدة"
                        )}
                    </div>

                    <button
                        class="delete-chat"
                        data-id="${chat.id}"
                        title="حذف المحادثة"
                    >
                        ×
                    </button>
                `;

                item.addEventListener(
                    "click",
                    event => {

                        if (
                            event.target.closest(
                                ".delete-chat"
                            )
                        ) {
                            return;
                        }

                        openChat(chat.id);
                    }
                );

                const deleteButton =
                    item.querySelector(
                        ".delete-chat"
                    );

                if (deleteButton) {

                    deleteButton.addEventListener(
                        "click",
                        async event => {

                            event.stopPropagation();

                            const id =
                                deleteButton.dataset.id;

                            await deleteChat(id);
                        }
                    );
                }

                chatsList.appendChild(item);
            });

        } catch (error) {

            console.error(
                "Load chats error:",
                error
            );
        }
    }

    /* ===============================
       CREATE CHAT
    =============================== */

    async function createChat(
        title = "محادثة جديدة"
    ) {

        const data =
            await apiRequest(
                "/api/chats",
                {
                    method: "POST",
                    body: JSON.stringify({
                        title
                    })
                }
            );

        const chat =
            data?.chat;

        if (!chat?.id) {
            throw new Error(
                "لم يتم إنشاء المحادثة"
            );
        }

        setCurrentChatId(chat.id);

        await loadChats();

        return chat;
    }

    /* ===============================
       OPEN CHAT
    =============================== */

    async function openChat(chatId) {

        try {

            const data =
                await apiRequest(
                    `/api/chats/${chatId}`
                );

            setCurrentChatId(chatId);

            renderMessages(
                data?.messages || []
            );

            await loadChats();

        } catch (error) {

            console.error(
                "Open chat error:",
                error
            );

            showError(
                error.message ||
                "تعذر فتح المحادثة"
            );
        }
    }

    /* ===============================
       DELETE CHAT
    =============================== */

    async function deleteChat(chatId) {

        const confirmed =
            confirm(
                "هل تريد حذف هذه المحادثة؟"
            );

        if (!confirmed) return;

        try {

            await apiRequest(
                `/api/chats/${chatId}`,
                {
                    method: "DELETE"
                }
            );

            if (
                String(chatId) ===
                String(getCurrentChatId())
            ) {
                setCurrentChatId(null);
                renderWelcome();
            }

            await loadChats();

        } catch (error) {

            showError(
                error.message ||
                "تعذر حذف المحادثة"
            );
        }
    }

    /* ===============================
       RENDER MESSAGES
    =============================== */

    function renderMessages(messages) {

        if (!chatMessages) return;

        chatMessages.innerHTML = "";

        if (!messages.length) {
            renderWelcome();
            return;
        }

        messages.forEach(message => {

            renderMessage(
                message.role,
                message.content
            );
        });

        scrollToBottom();
    }

    function renderMessage(
        role,
        content
    ) {

        if (!chatMessages) return;

        const wrapper =
            document.createElement("div");

        wrapper.className =
            `message-row ${role}`;

        const bubble =
            document.createElement("div");

        bubble.className =
            "message-bubble";

        bubble.innerHTML =
            escapeHTML(content)
                .replace(/\n/g, "<br>");

        wrapper.appendChild(bubble);

        chatMessages.appendChild(
            wrapper
        );
    }

    /* ===============================
       WELCOME
    =============================== */

    function renderWelcome() {

        if (!chatMessages) return;

        chatMessages.innerHTML = `
            <div class="welcome-screen">

                <div class="welcome-icon">
                    E
                </div>

                <h1>
                    أهلاً بيك في Edrak AI
                </h1>

                <p>
                    أنا جاهز أساعدك في أي سؤال.
                </p>

            </div>
        `;
    }

    /* ===============================
       TYPING
    =============================== */

    function showTyping() {

        if (!chatMessages) return;

        const wrapper =
            document.createElement("div");

        wrapper.id =
            "edrakTyping";

        wrapper.className =
            "message-row assistant";

        wrapper.innerHTML = `
            <div class="message-bubble typing">
                <span></span>
                <span></span>
                <span></span>
                <small>إدراك بيكتب...</small>
            </div>
        `;

        chatMessages.appendChild(
            wrapper
        );

        scrollToBottom();
    }

    function hideTyping() {

        document
            .getElementById(
                "edrakTyping"
            )
            ?.remove();
    }

    /* ===============================
       SEND MESSAGE
    =============================== */

    async function sendMessage() {

        if (!messageInput) return;

        const text =
            messageInput.value.trim();

        if (!text) return;

        const user = getUser();

        if (!user || !getToken()) {

            window.location.href =
                "login.html";

            return;
        }

        messageInput.value = "";

        let chatId =
            getCurrentChatId();

        try {

            if (!chatId) {

                const chat =
                    await createChat(
                        text.slice(0, 45)
                    );

                chatId = chat.id;
            }

            renderMessage(
                "user",
                text
            );

            scrollToBottom();

            showTyping();

            /* حفظ رسالة المستخدم */

            await apiRequest(
                `/api/chats/${chatId}/messages`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        role: "user",
                        content: text
                    })
                }
            );

            /* طلب إجابة الذكاء الاصطناعي */

            const data =
                await apiRequest(
                    "/api/chat",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            message: text,
                            chatId
                        })
                    }
                );

            hideTyping();

            const answer =
                data?.answer ||
                "مش قادر أطلع إجابة دلوقتي.";

            renderMessage(
                "assistant",
                answer
            );

            /* حفظ إجابة Edrak */

            await apiRequest(
                `/api/chats/${chatId}/messages`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        role: "assistant",
                        content: answer
                    })
                }
            );

            await loadChats();

            scrollToBottom();

        } catch (error) {

            hideTyping();

            console.error(
                "Send message error:",
                error
            );

            renderMessage(
                "assistant",
                `حصل خطأ: ${error.message}`
            );

            scrollToBottom();
        }
    }

    /* ===============================
       SCROLL
    =============================== */

    function scrollToBottom() {

        if (!chatMessages) return;

        setTimeout(() => {

            chatMessages.scrollTop =
                chatMessages.scrollHeight;

        }, 50);
    }

    /* ===============================
       NEW CHAT
    =============================== */

    function newChat() {

        setCurrentChatId(null);

        renderWelcome();

        document
            .querySelectorAll(
                ".chat-item"
            )
            .forEach(item => {
                item.classList.remove(
                    "active"
                );
            });

        if (messageInput) {
            messageInput.focus();
        }
    }

    /* ===============================
       LOGOUT
    =============================== */

    function logout() {

        localStorage.removeItem(
            TOKEN_KEY
        );

        localStorage.removeItem(
            USER_KEY
        );

        localStorage.removeItem(
            CURRENT_CHAT_KEY
        );

        window.location.href =
            "login.html";
    }

    /* ===============================
       ENTER TO SEND
    =============================== */

    function setupInput() {

        if (!messageInput) return;

        messageInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    sendMessage();
                }
            }
        );
    }

    /* ===============================
       SEND BUTTON
    =============================== */

    function setupSendButton() {

        if (!sendButton) return;

        sendButton.addEventListener(
            "click",
            sendMessage
        );
    }

    /* ===============================
       NEW CHAT BUTTON
    =============================== */

    function setupNewChat() {

        if (!newChatButton) return;

        newChatButton.addEventListener(
            "click",
            newChat
        );
    }

    /* ===============================
       LOGOUT BUTTON
    =============================== */

    function setupLogout() {

        if (!logoutButton) return;

        logoutButton.addEventListener(
            "click",
            logout
        );
    }

    /* ===============================
       QUICK PROMPTS
    =============================== */

    function setupQuickPrompts() {

        document.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-prompt]"
                    );

                if (!button) return;

                const prompt =
                    button.dataset.prompt;

                if (!messageInput) return;

                messageInput.value =
                    prompt;

                messageInput.focus();

                sendMessage();
            }
        );
    }

    /* ===============================
       SIDEBAR MOBILE
    =============================== */

    function setupSidebar() {

        const menuButton =
            document.getElementById(
                "menuBtn"
            );

        const sidebar =
            document.getElementById(
                "sidebar"
            );

        if (!menuButton || !sidebar) {
            return;
        }

        menuButton.addEventListener(
            "click",
            () => {

                sidebar.classList.toggle(
                    "open"
                );
            }
        );
    }

    /* ===============================
       API TEST
    =============================== */

    async function testBackend() {

        try {

            const data =
                await apiRequest(
                    "/health"
                );

            console.log(
                "Edrak Backend:",
                data
            );

            return true;

        } catch (error) {

            console.error(
                "Backend test failed:",
                error
            );

            return false;
        }
    }

    /* ===============================
       INITIALIZE
    =============================== */

    async function init() {

        /*
         * لو الصفحة مش صفحة الشات
         * مش محتاج نشغل كل حاجة
         */

        const isChatPage =
            !!chatMessages ||
            !!messageInput;

        if (!isChatPage) {
            return;
        }

        const user =
            await checkAuth();

        if (!user) return;

        renderUser(user);

        setupInput();
        setupSendButton();
        setupNewChat();
        setupLogout();
        setupQuickPrompts();
        setupSidebar();

        renderWelcome();

        await loadChats();

        console.log(
            "Edrak AI started successfully."
        );
    }

    /* ===============================
       GLOBAL ACCESS
    =============================== */

    window.Edrak = {
        sendMessage,
        newChat,
        openChat,
        deleteChat,
        logout,
        loadChats,
        testBackend
    };

    /* ===============================
       START
    =============================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    } else {

        init();
    }

})();
