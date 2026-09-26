"use strict";

const API_BASE_URL =
    window.EDRAK_CONFIG?.API_BASE_URL || "";

const TOKEN_KEY = "edrak_token";
const USER_KEY = "edrak_user";
const CHAT_KEY = "edrak_current_chat";

let currentUser = null;
let chats = [];
let currentChatId = null;
let currentMessages = [];
let isSending = false;

function $(...selectors) {
    for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) return el;
    }
    return null;
}

function $all(...selectors) {
    for (const selector of selectors) {
        const els = document.querySelectorAll(selector);
        if (els.length) return [...els];
    }
    return [];
}

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function getApiUrl() {
    return String(API_BASE_URL)
        .trim()
        .replace(/\/+$/, "");
}

async function apiFetch(endpoint, options = {}) {
    const base = getApiUrl();

    if (!base || base.includes("YOUR-RENDER")) {
        throw new Error(
            "ضع رابط Render الحقيقي داخل config.js"
        );
    }

    const headers = {
        ...(options.headers || {})
    };

    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] =
            "application/json";
    }

    const token = getToken();

    if (token) {
        headers.Authorization =
            `Bearer ${token}`;
    }

    let response;

    try {
        response = await fetch(
            `${base}${endpoint}`,
            {
                ...options,
                headers
            }
        );
    } catch {
        throw new Error(
            "مش قادر أوصل للسيرفر. تأكد إن Render شغال."
        );
    }

    const text = await response.text();

    let data;

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(
            "السيرفر رجّع HTML بدل JSON. راجع رابط Render الموجود في config.js"
        );
    }

    if (!response.ok) {
        if (response.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        }

        throw new Error(
            data?.error ||
            `حدث خطأ (${response.status})`
        );
    }

    return data;
}

/* ================= USER ================= */

async function loadUser() {
    if (!getToken()) return null;

    const data =
        await apiFetch("/api/me");

    currentUser =
        data.user || null;

    if (currentUser) {
        localStorage.setItem(
            USER_KEY,
            JSON.stringify(currentUser)
        );

        updateUserUI();
    }

    return currentUser;
}

function loadCachedUser() {
    try {
        const data =
            localStorage.getItem(USER_KEY);

        if (!data) return;

        currentUser =
            JSON.parse(data);

        updateUserUI();
    } catch {}
}

function updateUserUI() {
    if (!currentUser) return;

    const name =
        currentUser.name ||
        currentUser.username ||
        "مستخدم";

    const email =
        currentUser.email || "";

    $all(
        "#userName",
        "#profileName",
        ".user-name",
        ".profile-name"
    ).forEach(el => {
        el.textContent = name;
    });

    $all(
        "#userEmail",
        "#profileEmail",
        ".user-email",
        ".profile-email"
    ).forEach(el => {
        el.textContent = email;
    });
}

/* ================= CHATS ================= */

async function loadChats() {
    const data =
        await apiFetch("/api/chats");

    chats =
        Array.isArray(data.chats)
            ? data.chats
            : [];

    renderChats();

    return chats;
}

function renderChats() {
    const containers =
        $all(
            "#chatList",
            "#conversationList",
            "#conversations",
            ".chat-list",
            ".conversation-list"
        );

    containers.forEach(container => {
        container.innerHTML = "";

        if (!chats.length) {
            container.innerHTML = `
                <div class="empty-chats">
                    💬 مفيش محادثات لسه
                </div>
            `;
            return;
        }

        chats.forEach(chat => {
            const item =
                document.createElement("div");

            item.className = "chat-item";

            if (
                Number(chat.id) ===
                Number(currentChatId)
            ) {
                item.classList.add("active");
            }

            item.innerHTML = `
                <div class="chat-item-main">
                    <span>💬</span>
                    <span class="chat-item-title">
                        ${escapeHTML(
                            chat.title ||
                            "محادثة جديدة"
                        )}
                    </span>
                </div>

                <button
                    type="button"
                    class="chat-delete"
                    data-delete-chat="${chat.id}"
                >
                    ×
                </button>
            `;

            item.addEventListener(
                "click",
                event => {
                    if (
                        event.target.closest(
                            "[data-delete-chat]"
                        )
                    ) return;

                    openChat(chat.id);
                }
            );

            item.querySelector(
                "[data-delete-chat]"
            )?.addEventListener(
                "click",
                async event => {
                    event.stopPropagation();
                    await deleteChat(chat.id);
                }
            );

            container.appendChild(item);
        });
    });
}

async function createChat(
    title = "محادثة جديدة"
) {
    const data =
        await apiFetch(
            "/api/chats",
            {
                method: "POST",
                body: JSON.stringify({
                    title
                })
            }
        );

    currentChatId =
        Number(data.chat.id);

    localStorage.setItem(
        CHAT_KEY,
        String(currentChatId)
    );

    chats.unshift(data.chat);

    renderChats();

    return data.chat;
}

async function openChat(chatId) {
    try {
        currentChatId =
            Number(chatId);

        localStorage.setItem(
            CHAT_KEY,
            String(currentChatId)
        );

        const data =
            await apiFetch(
                `/api/chats/${currentChatId}`
            );

        currentMessages =
            data.messages || [];

        updateChatTitle(
            data.chat?.title ||
            "محادثة جديدة"
        );

        renderMessages();
        renderChats();

    } catch (error) {
        showError(error.message);
    }
}

async function deleteChat(chatId) {
    if (
        !confirm(
            "متأكد إنك عايز تحذف المحادثة؟"
        )
    ) {
        return;
    }

    try {
        await apiFetch(
            `/api/chats/${chatId}`,
            {
                method: "DELETE"
            }
        );

        chats =
            chats.filter(
                chat =>
                    Number(chat.id) !==
                    Number(chatId)
            );

        if (
            Number(currentChatId) ===
            Number(chatId)
        ) {
            currentChatId = null;
            currentMessages = [];

            localStorage.removeItem(
                CHAT_KEY
            );

            renderEmptyState();
        }

        renderChats();

    } catch (error) {
        showError(error.message);
    }
}

/* ================= MESSAGES ================= */

function renderMessages() {
    const containers =
        $all(
            "#messages",
            "#messageList",
            ".messages",
            ".chat-messages"
        );

    containers.forEach(container => {
        container.innerHTML = "";

        if (!currentMessages.length) {
            return;
        }

        currentMessages.forEach(message => {
            renderMessage(
                message.role,
                message.content,
                container
            );
        });

        scrollMessages(container);
    });
}

function renderMessage(
    role,
    content,
    container
) {
    const row =
        document.createElement("div");

    row.className =
        `message-row ${role}`;

    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";

    bubble.innerHTML =
        formatMessage(content);

    row.appendChild(bubble);
    container.appendChild(row);
}

function showTyping() {
    const container =
        $(
            "#messages",
            "#messageList",
            ".messages",
            ".chat-messages"
        );

    if (!container) return;

    removeTyping();

    const row =
        document.createElement("div");

    row.id = "edrakTyping";
    row.className =
        "message-row assistant";

    row.innerHTML = `
        <div class="message-bubble">
            Edrak بيكتب
            <span class="typing-dots">
                • • •
            </span>
        </div>
    `;

    container.appendChild(row);

    scrollMessages(container);
}

function removeTyping() {
    document
        .getElementById("edrakTyping")
        ?.remove();
}

async function saveMessage(
    role,
    content
) {
    if (!currentChatId) return;

    return apiFetch(
        `/api/chats/${currentChatId}/messages`,
        {
            method: "POST",
            body: JSON.stringify({
                role,
                content
            })
        }
    );
}

/* ================= SEND ================= */

async function sendMessage(
    customMessage = null
) {
    if (isSending) return;

    const input =
        $(
            "#messageInput",
            "#promptInput",
            "#chatInput",
            "textarea[name='message']"
        );

    const sendButton =
        $(
            "#sendBtn",
            "#sendButton",
            ".send-btn",
            "[data-send]"
        );

    const message =
        customMessage !== null
            ? String(customMessage).trim()
            : String(
                input?.value || ""
            ).trim();

    if (!message) return;

    isSending = true;

    if (input) {
        input.value = "";
        autoResizeTextarea(input);
    }

    if (sendButton) {
        sendButton.disabled = true;
    }

    try {
        if (!currentChatId) {
            const title =
                message.length > 45
                    ? message.slice(0, 45) + "..."
                    : message;

            await createChat(title);
        }

        currentMessages.push({
            role: "user",
            content: message
        });

        renderMessages();

        await saveMessage(
            "user",
            message
        );

        showTyping();

        const history =
            currentMessages
                .slice(-20)
                .map(item => ({
                    role: item.role,
                    content: item.content
                }));

        const data =
            await apiFetch(
                "/api/chat",
                {
                    method: "POST",
                    body: JSON.stringify({
                        message,
                        history
                    })
                }
            );

        removeTyping();

        const answer =
            data.answer ||
            "مقدرتش أطلع إجابة.";

        currentMessages.push({
            role: "assistant",
            content: answer
        });

        renderMessages();

        await saveMessage(
            "assistant",
            answer
        );

        await loadChats();

    } catch (error) {
        removeTyping();

        if (input) {
            input.value = message;
        }

        showError(error.message);

    } finally {
        isSending = false;

        if (sendButton) {
            sendButton.disabled = false;
        }

        input?.focus();
    }
}

/* ================= NEW CHAT ================= */

function startNewChat() {
    currentChatId = null;
    currentMessages = [];

    localStorage.removeItem(
        CHAT_KEY
    );

    renderEmptyState();

    const input =
        $(
            "#messageInput",
            "#promptInput",
            "#chatInput"
        );

    if (input) {
        input.value = "";
        input.focus();
    }
}

function renderEmptyState() {
    const containers =
        $all(
            "#messages",
            "#messageList",
            ".messages",
            ".chat-messages"
        );

    containers.forEach(container => {
        container.innerHTML = `
            <div class="empty-chat-state">
                <div class="empty-logo">E</div>
                <h2>أهلاً بيك في Edrak AI</h2>
                <p>
                    اكتب أي سؤال وابدأ المحادثة.
                </p>
            </div>
        `;
    });

    updateChatTitle(
        "محادثة جديدة"
    );

    renderChats();
}

/* ================= UI ================= */

function updateChatTitle(title) {
    $all(
        "#chatTitle",
        ".chat-title",
        "[data-chat-title]"
    ).forEach(el => {
        el.textContent =
            title || "محادثة جديدة";
    });
}

function setupComposer() {
    const input =
        $(
            "#messageInput",
            "#promptInput",
            "#chatInput",
            "textarea[name='message']"
        );

    const button =
        $(
            "#sendBtn",
            "#sendButton",
            ".send-btn",
            "[data-send]"
        );

    input?.addEventListener(
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

    input?.addEventListener(
        "input",
        () => autoResizeTextarea(input)
    );

    button?.addEventListener(
        "click",
        event => {
            event.preventDefault();
            sendMessage();
        }
    );
}

function setupButtons() {
    $all(
        "#newChatBtn",
        "#newChat",
        ".new-chat-btn",
        "[data-new-chat]"
    ).forEach(button => {
        button.addEventListener(
            "click",
            event => {
                event.preventDefault();
                startNewChat();
            }
        );
    });

    $all(
        "#logoutBtn",
        ".logout-btn",
        "[data-logout]"
    ).forEach(button => {
        button.addEventListener(
            "click",
            event => {
                event.preventDefault();

                localStorage.removeItem(
                    TOKEN_KEY
                );

                localStorage.removeItem(
                    USER_KEY
                );

                localStorage.removeItem(
                    CHAT_KEY
                );

                location.href =
                    "login.html";
            }
        );
    });

    $all(
        ".quick-prompt",
        ".prompt-card",
        "[data-prompt]"
    ).forEach(button => {
        button.addEventListener(
            "click",
            event => {
                event.preventDefault();

                const text =
                    button.dataset.prompt ||
                    button.textContent.trim();

                if (text) {
                    sendMessage(text);
                }
            }
        );
    });
}

/* ================= PRO ================= */

function setupPro() {
    $all(
        "#proBtn",
        ".pro-btn",
        "[data-pro]"
    ).forEach(button => {
        button.addEventListener(
            "click",
            event => {
                event.preventDefault();

                const modal =
                    $(
                        "#proModal",
                        ".pro-modal",
                        "[data-pro-modal]"
                    );

                if (modal) {
                    modal.classList.add(
                        "active"
                    );

                    modal.style.display =
                        "flex";
                }
            }
        );
    });

    $all(
        "[data-close-modal]",
        ".modal-close",
        ".close-modal"
    ).forEach(button => {
        button.addEventListener(
            "click",
            () => {
                const modal =
                    $(
                        "#proModal",
                        ".pro-modal",
                        "[data-pro-modal]"
                    );

                if (modal) {
                    modal.classList.remove(
                        "active"
                    );

                    modal.style.display =
                        "";
                }
            }
        );
    });
}

/* ================= VOICE ================= */

function setupVoice() {
    const buttons =
        $all(
            "#voiceBtn",
            ".voice-btn",
            "[data-voice]"
        );

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    buttons.forEach(button => {
        button.addEventListener(
            "click",
            () => {
                const recognition =
                    new SpeechRecognition();

                recognition.lang =
                    "ar-EG";

                recognition.onstart =
                    () => {
                        button.classList.add(
                            "recording"
                        );
                    };

                recognition.onend =
                    () => {
                        button.classList.remove(
                            "recording"
                        );
                    };

                recognition.onresult =
                    event => {
                        const text =
                            event
                                .results[0][0]
                                .transcript;

                        const input =
                            $(
                                "#messageInput",
                                "#promptInput",
                                "#chatInput"
                            );

                        if (input) {
                            input.value =
                                text;

                            input.focus();
                        }
                    };

                recognition.start();
            }
        );
    });
}

/* ================= HELPERS ================= */

function autoResizeTextarea(textarea) {
    if (!textarea) return;

    textarea.style.height = "auto";

    textarea.style.height =
        Math.min(
            textarea.scrollHeight,
            180
        ) + "px";
}

function scrollMessages(container) {
    requestAnimationFrame(() => {
        container.scrollTop =
            container.scrollHeight;
    });
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatMessage(text) {
    let result =
        escapeHTML(text);

    result =
        result.replace(
            /```([\s\S]*?)```/g,
            "<pre><code>$1</code></pre>"
        );

    result =
        result.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        );

    result =
        result.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );

    result =
        result.replace(
            /\n/g,
            "<br>"
        );

    return result;
}

function showError(message) {
    console.error(message);

    alert(message);
}

/* ================= START ================= */

async function initApp() {
    if (
        !location.pathname.endsWith(
            "index.html"
        ) &&
        !location.pathname.endsWith(
            "/Edrak7/"
        ) &&
        location.pathname !== "/"
    ) {
        return;
    }

    if (!getToken()) {
        location.href = "login.html";
        return;
    }

    loadCachedUser();
    setupComposer();
    setupButtons();
    setupPro();
    setupVoice();

    try {
        await loadUser();
        await loadChats();

        const savedChat =
            localStorage.getItem(
                CHAT_KEY
            );

        if (savedChat) {
            await openChat(
                Number(savedChat)
            );
        } else {
            renderEmptyState();
        }

    } catch (error) {
        showError(
            error.message
        );
    }
}

document.addEventListener(
    "DOMContentLoaded",
    initApp
);

window.Edrak = {
    sendMessage,
    openChat,
    startNewChat,
    deleteChat
};