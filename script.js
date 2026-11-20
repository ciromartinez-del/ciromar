// REFERENCIAS AL DOM
const form = document.getElementById("assistantForm");
const apiKeyInput = document.getElementById("apiKeyInput");
const ingredientsInput = document.getElementById("ingredientsInput");
const mealTypeSelect = document.getElementById("mealTypeSelect");
const timeSelect = document.getElementById("timeSelect");
const extraNotesInput = document.getElementById("extraNotesInput");
const ingredientsError = document.getElementById("ingredientsError");

const submitBtn = document.getElementById("submitBtn");
const loader = document.getElementById("loader");
const responseOutput = document.getElementById("responseOutput");
const extraActions = document.getElementById("extraActions");
const historyList = document.getElementById("historyList");

// ESTADO DE LA SESIÓN
let sessionHistory = [];
let currentResponseText = "";

// 1. VALIDACIÓN DEL FORMULARIO
function validateForm() {
    let isValid = true;
    const apiKey = apiKeyInput.value.trim();
    const ingredients = ingredientsInput.value.trim();

    // Validar API Key
    if (!apiKey) {
        apiKeyInput.classList.add("invalid");
        alert("Por favor, ingresa tu API Key de Google Gemini en el campo superior.");
        apiKeyInput.focus();
        return false;
    } else {
        apiKeyInput.classList.remove("invalid");
    }

    // Validar campo de ingredientes (mínimo 4 caracteres)
    if (ingredients.length < 4) {
        ingredientsInput.classList.add("invalid");
        ingredientsError.textContent = "Por favor, escribe al menos un ingrediente (mínimo 4 caracteres).";
        isValid = false;
    } else {
        ingredientsInput.classList.remove("invalid");
        ingredientsError.textContent = "";
    }

    return isValid;
}

// 2. FUNCIÓN PARA CONSULTAR A LA API DE GOOGLE GEMINI
async function callGeminiAPI(promptText) {
    const apiKey = apiKeyInput.value.trim();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: promptText }]
            }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Error al conectar con la API de Gemini.");
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// 3. FORMATEAR TEXTO SIMPLE (Negritas de Markdown a HTML seguro)
function formatTextToHTML(text) {
    const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    return escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

// 4. MANEJO DEL ENVÍO DEL FORMULARIO
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const ingredients = ingredientsInput.value.trim();
    const mealType = mealTypeSelect.value;
    const maxTime = timeSelect.value;
    const extraNotes = extraNotesInput.value.trim();

    // Construcción del Prompt especializado (Ingeniería de Prompts)
    const prompt = `Actúa como un chef experto y creativo. El usuario tiene los siguientes ingredientes disponibles: "${ingredients}".
    Requisitos de la receta:
    - Tipo de comida: ${mealType}.
    - Tiempo máximo de preparación: ${maxTime}.
    - Restricciones o notas adicionales: ${extraNotes || "Ninguna"}.

    Responde en español con una estructura clara y directa:
    1. Nombre creativo del plato.
    2. Lista de ingredientes necesarios (priorizando los que ya tiene).
    3. Paso a paso numerado y fácil de seguir.
    4. Un consejo rápido del chef.`;

    // Mostrar estado de carga
    submitBtn.disabled = true;
    loader.style.display = "flex";
    responseOutput.style.display = "none";
    extraActions.style.display = "none";

    try {
        const aiReply = await callGeminiAPI(prompt);
        currentResponseText = aiReply;

        // Mostrar respuesta en pantalla
        responseOutput.classList.remove("empty-state");
        responseOutput.innerHTML = formatTextToHTML(aiReply);
        extraActions.style.display = "flex";

        // Guardar en el historial de la sesión
        addToHistory({
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            query: `${ingredients} (${mealType}, ${maxTime})`,
            answer: aiReply
        });

    } catch (error) {
        responseOutput.classList.remove("empty-state");
        responseOutput.innerHTML = `<span style="color: var(--error);">❌ Ocurrió un error: ${error.message}. Verifica que tu API Key sea correcta.</span>`;
    } finally {
        submitBtn.disabled = false;
        loader.style.display = "none";
        responseOutput.style.display = "block";
    }
});

// 5. FUNCIONES OPCIONALES: RESUMIR Y TRADUCIR LA RESPUESTA ACTUAL
document.getElementById("summarizeBtn").addEventListener("click", async () => {
    if (!currentResponseText) return;
    loader.style.display = "flex";
    responseOutput.style.display = "none";

    try {
        const summary = await callGeminiAPI(`Resume esta receta en exactamente 3 puntos muy cortos y directos:\n\n${currentResponseText}`);
        currentResponseText = summary;
        responseOutput.innerHTML = formatTextToHTML(summary);
    } catch (error) {
        alert("Error al resumir: " + error.message);
    } finally {
        loader.style.display = "none";
        responseOutput.style.display = "block";
    }
});

document.getElementById("translateBtn").addEventListener("click", async () => {
    if (!currentResponseText) return;
    loader.style.display = "flex";
    responseOutput.style.display = "none";

    try {
        const translated = await callGeminiAPI(`Traduce fielmente esta receta al inglés manteniendo el formato:\n\n${currentResponseText}`);
        currentResponseText = translated;
        responseOutput.innerHTML = formatTextToHTML(translated);
    } catch (error) {
        alert("Error al traducir: " + error.message);
    } finally {
        loader.style.display = "none";
        responseOutput.style.display = "block";
    }
});

// 6. GESTIÓN DEL HISTORIAL DE LA SESIÓN
function addToHistory(item) {
    sessionHistory.unshift(item); // Agrega al principio
    renderHistory();
}

function renderHistory() {
    if (sessionHistory.length === 0) {
        historyList.innerHTML = `<p class="empty-history">Todavía no realizaste consultas en esta sesión.</p>`;
        return;
    }

    historyList.innerHTML = sessionHistory.map(item => `
        <div class="history-item">
            <div class="history-meta">
                <span>Consulta de sesión</span>
                <span>${item.time}</span>
            </div>
            <div class="history-question">Ingredientes: ${item.query}</div>
            <div class="history-answer">${formatTextToHTML(item.answer)}</div>
        </div>
    `).join("");
}

document.getElementById("clearHistoryBtn").addEventListener("click", () => {
    sessionHistory = [];
    renderHistory();
});

// 7. EXTRAS DE INTERFAZ (Mostrar/ocultar clave y Modo Oscuro)
document.getElementById("toggleKeyBtn").addEventListener("click", () => {
    apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
});

const themeToggle = document.getElementById("themeToggle");
if (localStorage.getItem("chefia_theme") === "dark") {
    document.body.classList.add("dark-mode");
    themeToggle.textContent = "☀️ Modo Claro";
}

themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    themeToggle.textContent = isDark ? "☀️ Modo Claro" : "🌙 Modo Oscuro";
    localStorage.setItem("chefia_theme", isDark ? "dark" : "light");
});
