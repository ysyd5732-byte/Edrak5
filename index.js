require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json({ limit: "10mb" }));

/* ================= CORS ================= */

app.use((req, res, next) => {
    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,DELETE,OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

/* ================= MEMORY DATABASE ================= */
/*
   مؤقتة أثناء تشغيل الـ Function.
   للتخزين الدائم هنضيف Database لاحقًا.
*/

const db = {
    users: [],
    chats: [],
    messages: [],
    nextIds: {
        user: 1,
        chat: 1,
        message: 1
    }
};

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "edrak-secret-2026";

const GROQ_API_KEY =
    process.env.GROQ_API_KEY || "";

const GROQ_MODEL =
    process.env.GROQ_MODEL ||
    "openai/gpt-oss-20b";

const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL ||
    "admin@edrak.local";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD ||
    "Edrak@123";

/* ================= HELPERS ================= */

function text(value) {
    return String(value || "").trim();
}

function email(value) {
    return text(value).toLowerCase();
}

function nextId(type) {
    return db.nextIds[type]++;
}

function findUser(id) {
    return db.users.find(
        user =>
            Number(user.id) ===
            Number(id)
    );
}

function findUserEmail(value) {
    const target = email(value);

    return db.users.find(
        user =>
            email(user.email) ===
            target
    );
}

function findChat(id) {
    return db.chats.find(
        chat =>
            Number(chat.id) ===
            Number(id)
    );
}

function publicUser(user) {
    if (!user) return null;

    return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        created_at: user.created_at
    };
}

function getMessages(chatId) {
    return db.messages
        .filter(
            message =>
                Number(message.chat_id) ===
                Number(chatId)
        )
        .sort(
            (a, b) =>
                Number(a.id) -
                Number(b.id)
        );
}

/* ================= USER AUTH ================= */

function userAuth(req, res, next) {

    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "يجب تسجيل الدخول"
        });
    }

    try {

        const token =
            header.substring(7);

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );

        if (decoded.type !== "user") {
            throw new Error();
        }

        const user =
            findUser(decoded.id);

        if (!user) {
            return res.status(401).json({
                error: "الحساب غير موجود"
            });
        }

        req.user = user;

        next();

    } catch {

        res.status(401).json({
            error:
                "جلسة الدخول غير صالحة"
        });
    }
}

/* ================= ADMIN AUTH ================= */

function adminAuth(req, res, next) {

    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "غير مصرح لك"
        });
    }

    try {

        const token =
            header.substring(7);

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );

        if (decoded.type !== "admin") {
            throw new Error();
        }

        next();

    } catch {

        res.status(401).json({
            error:
                "جلسة الأدمن غير صالحة"
        });
    }
}

/* ================= HEALTH ================= */

app.get("/health", (req, res) => {
    res.json({
        success: true,
        service: "Edrak AI",
        status: "online"
    });
});

/* ================= REGISTER ================= */

app.post("/api/register", async (req, res) => {

    try {

        const name =
            text(req.body.name);

        const userEmail =
            email(req.body.email);

        const password =
            String(
                req.body.password || ""
            );

        if (!name) {
            return res.status(400).json({
                error: "اكتب اسمك"
            });
        }

        if (!userEmail) {
            return res.status(400).json({
                error:
                    "اكتب البريد الإلكتروني"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error:
                    "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
            });
        }

        if (findUserEmail(userEmail)) {
            return res.status(409).json({
                error:
                    "البريد الإلكتروني مستخدم بالفعل"
            });
        }

        const passwordHash =
            await bcrypt.hash(
                password,
                10
            );

        const user = {
            id: nextId("user"),
            name,
            username: name,
            email: userEmail,
            password: passwordHash,
            created_at:
                new Date().toISOString()
        };

        db.users.push(user);

        const token =
            jwt.sign(
                {
                    id: user.id,
                    type: "user",
                    email: user.email
                },
                JWT_SECRET,
                {
                    expiresIn: "30d"
                }
            );

        res.status(201).json({
            success: true,
            token,
            user: publicUser(user)
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error:
                "حدث خطأ أثناء إنشاء الحساب"
        });
    }
});

/* ================= LOGIN ================= */

app.post("/api/login", async (req, res) => {

    try {

        const userEmail =
            email(req.body.email);

        const password =
            String(
                req.body.password || ""
            );

        const user =
            findUserEmail(
                userEmail
            );

        if (!user) {
            return res.status(401).json({
                error:
                    "البريد أو كلمة المرور غير صحيحة"
            });
        }

        const valid =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!valid) {
            return res.status(401).json({
                error:
                    "البريد أو كلمة المرور غير صحيحة"
            });
        }

        const token =
            jwt.sign(
                {
                    id: user.id,
                    type: "user",
                    email: user.email
                },
                JWT_SECRET,
                {
                    expiresIn: "30d"
                }
            );

        res.json({
            success: true,
            token,
            user: publicUser(user)
        });

    } catch (error) {

        res.status(500).json({
            error:
                "حدث خطأ أثناء تسجيل الدخول"
        });
    }
});

/* ================= ME ================= */

app.get(
    "/api/me",
    userAuth,
    (req, res) => {

        res.json({
            user:
                publicUser(req.user)
        });
    }
);

/* ================= CHATS ================= */

app.post(
    "/api/chats",
    userAuth,
    (req, res) => {

        const chat = {
            id: nextId("chat"),
            user_id: req.user.id,
            title:
                text(req.body.title) ||
                "محادثة جديدة",
            created_at:
                new Date().toISOString(),
            updated_at:
                new Date().toISOString()
        };

        db.chats.push(chat);

        res.status(201).json({
            chat
        });
    }
);

app.get(
    "/api/chats",
    userAuth,
    (req, res) => {

        const chats =
            db.chats
                .filter(
                    chat =>
                        Number(chat.user_id) ===
                        Number(req.user.id)
                )
                .sort(
                    (a, b) =>
                        new Date(
                            b.updated_at
                        ) -
                        new Date(
                            a.updated_at
                        )
                );

        res.json({
            chats
        });
    }
);

app.get(
    "/api/chats/:id",
    userAuth,
    (req, res) => {

        const chat =
            findChat(req.params.id);

        if (!chat) {
            return res.status(404).json({
                error:
                    "المحادثة غير موجودة"
            });
        }

        if (
            Number(chat.user_id) !==
            Number(req.user.id)
        ) {
            return res.status(403).json({
                error:
                    "غير مصرح لك"
            });
        }

        res.json({
            chat,
            messages:
                getMessages(chat.id)
        });
    }
);

app.delete(
    "/api/chats/:id",
    userAuth,
    (req, res) => {

        const chat =
            findChat(req.params.id);

        if (!chat) {
            return res.status(404).json({
                error:
                    "المحادثة غير موجودة"
            });
        }

        if (
            Number(chat.user_id) !==
            Number(req.user.id)
        ) {
            return res.status(403).json({
                error:
                    "غير مصرح لك"
            });
        }

        const chatId =
            Number(chat.id);

        db.messages =
            db.messages.filter(
                message =>
                    Number(
                        message.chat_id
                    ) !== chatId
            );

        db.chats =
            db.chats.filter(
                item =>
                    Number(item.id) !==
                    chatId
            );

        res.json({
            success: true
        });
    }
);

/* ================= SAVE MESSAGE ================= */

app.post(
    "/api/chats/:id/messages",
    userAuth,
    (req, res) => {

        const chat =
            findChat(req.params.id);

        if (!chat) {
            return res.status(404).json({
                error:
                    "المحادثة غير موجودة"
            });
        }

        if (
            Number(chat.user_id) !==
            Number(req.user.id)
        ) {
            return res.status(403).json({
                error:
                    "غير مصرح لك"
            });
        }

        const role =
            req.body.role ===
            "assistant"
                ? "assistant"
                : "user";

        const content =
            text(req.body.content);

        if (!content) {
            return res.status(400).json({
                error:
                    "الرسالة فارغة"
            });
        }

        const message = {
            id:
                nextId("message"),
            chat_id:
                chat.id,
            role,
            content,
            created_at:
                new Date().toISOString()
        };

        db.messages.push(
            message
        );

        chat.updated_at =
            new Date().toISOString();

        res.status(201).json({
            success: true,
            message
        });
    }
);

/* ================= GROQ ================= */

const creatorAnswer =
    "أنا Edrak AI، وتم تطويري بواسطة ياسين من دولة مصر 🇪🇬.";

function isCreatorQuestion(message) {

    const value =
        text(message).toLowerCase();

    return [
        "مين صنعك",
        "من صنعك",
        "مين عملك",
        "مين طورك",
        "من طورك",
        "مين المطور",
        "مين صاحب edrak",
        "مين صاحب إدراك",
        "مين مطور edrak",
        "مين مطور إدراك"
    ].some(
        phrase =>
            value.includes(
                phrase
            )
    );
}

async function askGroq(messages) {

    if (!GROQ_API_KEY) {
        throw new Error(
            "GROQ_API_KEY غير موجود"
        );
    }

    const response =
        await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${GROQ_API_KEY}`
                },

                body:
                    JSON.stringify({
                        model:
                            GROQ_MODEL,

                        messages: [
                            {
                                role:
                                    "system",

                                content:
                                    `
أنت Edrak AI.
أجب باللغة التي يستخدمها المستخدم.
كن مفيدًا وواضحًا ومباشرًا.
إذا سألك المستخدم عن مطورك فقل:
${creatorAnswer}
                                    `.trim()
                            },
                            ...messages
                        ],

                        temperature: 0.7,

                        max_tokens:
                            2048
                    })
            }
        );

    const data =
        await response.json();

    if (!response.ok) {
        throw new Error(
            data?.error?.message ||
            "خطأ من Groq"
        );
    }

    return (
        data?.choices?.[0]
            ?.message?.content ||
        "لم أستطع إنشاء إجابة."
    );
}

app.post(
    "/api/chat",
    userAuth,
    async (req, res) => {

        try {

            const message =
                text(
                    req.body.message
                );

            if (!message) {
                return res.status(400).json({
                    error:
                        "الرسالة فارغة"
                });
            }

            if (
                isCreatorQuestion(
                    message
                )
            ) {
                return res.json({
                    success: true,
                    answer:
                        creatorAnswer
                });
            }

            const history =
                Array.isArray(
                    req.body.history
                )
                    ? req.body.history
                    : [];

            const safeHistory =
                history
                    .slice(-20)
                    .map(item => ({
                        role:
                            item.role ===
                            "assistant"
                                ? "assistant"
                                : "user",

                        content:
                            text(
                                item.content
                            )
                    }))
                    .filter(
                        item =>
                            item.content
                    );

            safeHistory.push({
                role: "user",
                content: message
            });

            const answer =
                await askGroq(
                    safeHistory
                );

            res.json({
                success: true,
                answer
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    error.message ||
                    "حدث خطأ في الذكاء الاصطناعي"
            });
        }
    }
);

/* ================= ADMIN LOGIN ================= */

app.post(
    "/api/admin/login",
    (req, res) => {

        const userEmail =
            email(req.body.email);

        const password =
            String(
                req.body.password || ""
            );

        if (
            userEmail !==
                email(ADMIN_EMAIL) ||
            password !==
                ADMIN_PASSWORD
        ) {
            return res.status(401).json({
                error:
                    "بيانات الأدمن غير صحيحة"
            });
        }

        const token =
            jwt.sign(
                {
                    type: "admin",
                    email: userEmail
                },
                JWT_SECRET,
                {
                    expiresIn: "12h"
                }
            );

        res.json({
            success: true,
            token
        });
    }
);

/* ================= ADMIN STATS ================= */

app.get(
    "/api/admin/stats",
    adminAuth,
    (req, res) => {

        res.json({
            users:
                db.users.length,

            chats:
                db.chats.length,

            messages:
                db.messages.length
        });
    }
);

/* ================= ADMIN USERS ================= */

app.get(
    "/api/admin/users",
    adminAuth,
    (req, res) => {

        res.json({
            users:
                db.users
                    .slice()
                    .reverse()
                    .map(
                        publicUser
                    )
        });
    }
);

/* ================= DELETE USER ================= */

app.delete(
    "/api/admin/users/:id",
    adminAuth,
    (req, res) => {

        const userId =
            Number(
                req.params.id
            );

        const user =
            findUser(userId);

        if (!user) {
            return res.status(404).json({
                error:
                    "المستخدم غير موجود"
            });
        }

        const chatIds =
            new Set(
                db.chats
                    .filter(
                        chat =>
                            Number(
                                chat.user_id
                            ) === userId
                    )
                    .map(
                        chat =>
                            Number(
                                chat.id
                            )
                    )
            );

        db.messages =
            db.messages.filter(
                message =>
                    !chatIds.has(
                        Number(
                            message.chat_id
                        )
                    )
            );

        db.chats =
            db.chats.filter(
                chat =>
                    Number(
                        chat.user_id
                    ) !== userId
            );

        db.users =
            db.users.filter(
                item =>
                    Number(item.id) !==
                    userId
            );

        res.json({
            success: true
        });
    }
);

/* ================= ADMIN CHATS ================= */

app.get(
    "/api/admin/chats",
    adminAuth,
    (req, res) => {

        const chats =
            db.chats
                .slice()
                .reverse()
                .map(chat => {

                    const user =
                        findUser(
                            chat.user_id
                        );

                    return {
                        ...chat,

                        user_name:
                            user?.name ||
                            "مستخدم",

                        user_email:
                            user?.email ||
                            "غير معروف"
                    };
                });

        res.json({
            chats
        });
    }
);

/* ================= ADMIN MESSAGES ================= */

app.get(
    "/api/admin/chats/:id/messages",
    adminAuth,
    (req, res) => {

        const chat =
            findChat(
                req.params.id
            );

        if (!chat) {
            return res.status(404).json({
                error:
                    "المحادثة غير موجودة"
            });
        }

        const user =
            findUser(
                chat.user_id
            );

        res.json({
            chat: {
                ...chat,

                user_name:
                    user?.name ||
                    "مستخدم",

                user_email:
                    user?.email ||
                    "غير معروف"
            },

            messages:
                getMessages(
                    chat.id
                )
        });
    }
);

/* ================= ADMIN DELETE CHAT ================= */

app.delete(
    "/api/admin/chats/:id",
    adminAuth,
    (req, res) => {

        const chatId =
            Number(
                req.params.id
            );

        db.messages =
            db.messages.filter(
                message =>
                    Number(
                        message.chat_id
                    ) !== chatId
            );

        db.chats =
            db.chats.filter(
                chat =>
                    Number(chat.id) !==
                    chatId
            );

        res.json({
            success: true
        });
    }
);

module.exports = app;