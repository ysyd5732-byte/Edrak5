"use strict";

const API =
    window.EDRAK_CONFIG?.API_BASE_URL || "";

async function request(
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
            "السيرفر رجّع HTML بدل JSON. تأكد من رابط Vercel."
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

/* تسجيل الدخول */

const loginForm =
    document.querySelector(
        "#loginForm"
    );

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const email =
                loginForm.querySelector(
                    "input[name='email']"
                )?.value || "";

            const password =
                loginForm.querySelector(
                    "input[name='password']"
                )?.value || "";

            try {

                const data =
                    await request(
                        "/api/login",
                        {
                            method: "POST",
                            body:
                                JSON.stringify({
                                    email,
                                    password
                                })
                        }
                    );

                localStorage.setItem(
                    "edrak_token",
                    data.token
                );

                localStorage.setItem(
                    "edrak_user",
                    JSON.stringify(
                        data.user
                    )
                );

                location.href =
                    "index.html";

            } catch (error) {

                alert(
                    error.message
                );
            }
        }
    );
}

/* إنشاء الحساب */

const registerForm =
    document.querySelector(
        "#registerForm"
    );

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const name =
                registerForm.querySelector(
                    "input[name='name']"
                )?.value || "";

            const email =
                registerForm.querySelector(
                    "input[name='email']"
                )?.value || "";

            const password =
                registerForm.querySelector(
                    "input[name='password']"
                )?.value || "";

            try {

                const data =
                    await request(
                        "/api/register",
                        {
                            method: "POST",
                            body:
                                JSON.stringify({
                                    name,
                                    email,
                                    password
                                })
                        }
                    );

                localStorage.setItem(
                    "edrak_token",
                    data.token
                );

                localStorage.setItem(
                    "edrak_user",
                    JSON.stringify(
                        data.user
                    )
                );

                location.href =
                    "index.html";

            } catch (error) {

                alert(
                    error.message
                );
            }
        }
    );
}