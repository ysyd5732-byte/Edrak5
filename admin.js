"use strict";

const API =
    window.EDRAK_CONFIG?.API_BASE_URL || "";

let adminToken =
    localStorage.getItem(
        "edrak_admin_token"
    );

async function adminRequest(
    endpoint,
    options = {}
) {

    const response =
        await fetch(
            `${API}${endpoint}`,
            {
                ...options,

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${adminToken}`,

                    ...(options.headers || {})
                }
            }
        );

    const text =
        await response.text();

    let data;

    try {
        data =
            JSON.parse(text);
    } catch {
        throw new Error(
            "السيرفر رجّع HTML بدل JSON."
        );
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            "حدث خطأ"
        );
    }

    return data;
}

/* دخول الأدمن */

const form =
    document.querySelector(
        "#adminLoginForm"
    );

if (form) {

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const email =
                document.querySelector(
                    "#adminEmail"
                )?.value || "";

            const password =
                document.querySelector(
                    "#adminPassword"
                )?.value || "";

            try {

                const data =
                    await fetch(
                        `${API}/api/admin/login`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    email,
                                    password
                                })
                        }
                    );

                const result =
                    await data.json();

                if (!data.ok) {
                    throw new Error(
                        result.error
                    );
                }

                adminToken =
                    result.token;

                localStorage.setItem(
                    "edrak_admin_token",
                    adminToken
                );

                location.reload();

            } catch (error) {

                alert(
                    error.message
                );
            }
        }
    );
}

/* تحميل الإحصائيات */

async function loadStats() {

    const data =
        await adminRequest(
            "/api/admin/stats"
        );

    document.querySelector(
        "#statUsers"
    )?.replaceChildren(
        document.createTextNode(
            data.users
        )
    );

    document.querySelector(
        "#statChats"
    )?.replaceChildren(
        document.createTextNode(
            data.chats
        )
    );

    document.querySelector(
        "#statMessages"
    )?.replaceChildren(
        document.createTextNode(
            data.messages
        )
    );
}

/* المستخدمين */

async function loadUsers() {

    const data =
        await adminRequest(
            "/api/admin/users"
        );

    const tbody =
        document.querySelector(
            "#usersTableBody"
        );

    if (!tbody) return;

    tbody.innerHTML = "";

    data.users.forEach(
        user => {

            const row =
                document.createElement(
                    "tr"
                );

            row.innerHTML = `
                <td>${user.id}</td>
                <td>${escapeHTML(user.name)}</td>
                <td>${escapeHTML(user.email)}</td>
                <td>
                    <button
                        class="danger-btn"
                        onclick="deleteUser(${user.id})"
                    >
                        حذف
                    </button>
                </td>
            `;

            tbody.appendChild(
                row
            );
        }
    );
}

async function deleteUser(id) {

    if (
        !confirm(
            "متأكد من حذف الحساب؟"
        )
    ) return;

    await adminRequest(
        `/api/admin/users/${id}`,
        {
            method: "DELETE"
        }
    );

    await loadDashboard();
}

/* المحادثات */

async function loadChats() {

    const data =
        await adminRequest(
            "/api/admin/chats"
        );

    const container =
        document.querySelector(
            "#chatsContainer"
        );

    if (!container) return;

    container.innerHTML = "";

    data.chats.forEach(
        chat => {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "admin-chat-card";

            card.innerHTML = `
                <h3>
                    ${escapeHTML(
                        chat.title
                    )}
                </h3>

                <p>
                    المستخدم:
                    ${escapeHTML(
                        chat.user_name
                    )}
                </p>

                <p>
                    ${escapeHTML(
                        chat.user_email
                    )}
                </p>

                <button
                    onclick="viewChat(${chat.id})"
                >
                    عرض الرسائل
                </button>

                <button
                    class="danger-btn"
                    onclick="deleteChat(${chat.id})"
                >
                    حذف
                </button>
            `;

            container.appendChild(
                card
            );
        }
    );
}

async function viewChat(id) {

    const data =
        await adminRequest(
            `/api/admin/chats/${id}/messages`
        );

    const body =
        document.querySelector(
            "#messagesModalBody"
        );

    if (!body) return;

    body.innerHTML = `
        <h3>
            ${escapeHTML(
                data.chat.user_name
            )}
        </h3>

        <p>
            ${escapeHTML(
                data.chat.user_email
            )}
        </p>
    `;

    data.messages.forEach(
        message => {

            const div =
                document.createElement(
                    "div"
                );

            div.className =
                "admin-message";

            div.innerHTML = `
                <strong>
                    ${
                        message.role ===
                        "assistant"
                            ? "Edrak"
                            : "المستخدم"
                    }
                </strong>

                <p>
                    ${escapeHTML(
                        message.content
                    )}
                </p>
            `;

            body.appendChild(
                div
            );
        }
    );

    document.querySelector(
        "#messagesModal"
    )?.classList.add(
        "active"
    );
}

async function deleteChat(id) {

    if (
        !confirm(
            "متأكد من حذف المحادثة؟"
        )
    ) return;

    await adminRequest(
        `/api/admin/chats/${id}`,
        {
            method: "DELETE"
        }
    );

    await loadDashboard();
}

async function loadDashboard() {

    try {

        await loadStats();
        await loadUsers();
        await loadChats();

    } catch (error) {

        alert(
            error.message
        );
    }
}

function logoutAdmin() {

    localStorage.removeItem(
        "edrak_admin_token"
    );

    location.reload();
}

function escapeHTML(value) {

    return String(
        value || ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

window.deleteUser =
    deleteUser;

window.deleteChat =
    deleteChat;

window.viewChat =
    viewChat;

window.logoutAdmin =
    logoutAdmin;

document.addEventListener(
    "DOMContentLoaded",
    () => {

        if (
            location.pathname.endsWith(
                "admin.html"
            ) &&
            adminToken
        ) {
            loadDashboard();
        }
    }
);