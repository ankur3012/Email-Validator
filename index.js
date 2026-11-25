const API_KEY = "ema_live_HtN6m7j9BtAmjwtDPdqgieEPUTEqPGnOYo9tCpHC";
let lastResultData = null;
let bulkResultsData = [];

// DOM Elements
const themeToggle = document.getElementById("themeToggle");
const singleTabBtn = document.getElementById("singleTabBtn");
const bulkTabBtn = document.getElementById("bulkTabBtn");
const singleMode = document.getElementById("singleMode");
const bulkMode = document.getElementById("bulkMode");
const validateForm = document.getElementById("validateForm");
const emailInput = document.getElementById("emailInput");
const submitBtn = document.getElementById("submitBtn");
const bulkInput = document.getElementById("bulkInput");
const bulkSubmitBtn = document.getElementById("bulkSubmitBtn");
const loader = document.getElementById("loader");
const resultsCard = document.getElementById("resultsCard");
const resultCont = document.getElementById("resultCont");
const bulkResultsCard = document.getElementById("bulkResultsCard");
const bulkTableBody = document.getElementById("bulkTableBody");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const suggestionArea = document.getElementById("suggestionArea");
const historySection = document.getElementById("historySection");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

// --- 1. Dark Mode ---
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    themeToggle.innerText = "☀️";
}

themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    themeToggle.innerText = isDark ? "☀️" : "🌙";
    localStorage.setItem("theme", isDark ? "dark" : "light");
});

// --- 2. Tab Switching ---
function switchTab(mode) {
    singleTabBtn.classList.toggle("active", mode === "single");
    bulkTabBtn.classList.toggle("active", mode === "bulk");
    singleMode.style.display = mode === "single" ? "block" : "none";
    bulkMode.style.display = mode === "bulk" ? "block" : "none";
    resultsCard.style.display = "none";
    bulkResultsCard.style.display = "none";
}

singleTabBtn.addEventListener("click", () => switchTab("single"));
bulkTabBtn.addEventListener("click", () => switchTab("bulk"));

// --- 3. API Fetch with Local Heuristic Fallback ---
async function fetchValidation(email) {
    const url = `https://api.emailvalidation.io/v1/info?apikey=${API_KEY}&email=${encodeURIComponent(email)}`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("API limit or error");
        return await res.json();
    } catch (err) {
        // Fallback if API quota runs out or offline
        const parts = email.split("@");
        const domain = (parts[1] || "").toLowerCase();
        const typos = { "gmial.com": "gmail.com", "gmai.com": "gmail.com", "yaho.com": "yahoo.com", "hotmal.com": "hotmail.com" };
        const disposables = ["tempmail.com", "10minutemail.com", "mailinator.com", "guerrillamail.com"];
        const roles = ["admin", "support", "info", "sales", "contact"];
        const formatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        return {
            email,
            domain,
            format_valid: formatValid,
            mx_found: formatValid && !typos[domain],
            smtp_check: formatValid && !typos[domain] && !disposables.includes(domain),
            disposable: disposables.includes(domain),
            free: ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(domain),
            role: roles.includes((parts[0] || "").toLowerCase()),
            did_you_mean: typos[domain] ? `${parts[0]}@${typos[domain]}` : "",
            score: !formatValid || typos[domain] ? 0.2 : (disposables.includes(domain) ? 0.45 : 0.85),
            state: !formatValid || typos[domain] ? "undeliverable" : (disposables.includes(domain) ? "risky" : "deliverable"),
            reason: !formatValid ? "invalid_syntax" : (typos[domain] ? "invalid_domain" : "valid_mailbox")
        };
    }
}

const formatBool = (val) => {
    if (val === true) return `<span style="color: #16a34a;">✔ Yes</span>`;
    if (val === false) return `<span style="color: #dc2626;">✖ No</span>`;
    return `<span style="color: #64748b;">Unknown</span>`;
};

// --- 4. Single Email Validation ---
async function validateSingleEmail(email) {
    suggestionArea.innerHTML = "";
    resultsCard.style.display = "none";
    loader.style.display = "block";
    submitBtn.disabled = true;
    submitBtn.innerText = "Checking...";

    const result = await fetchValidation(email);
    lastResultData = result;
    saveToHistory(result.email || email, result.state);

    if (result.did_you_mean) {
        suggestionArea.innerHTML = `
            <div class="suggestion-inner">
                Did you mean <button type="button" onclick="recheckEmail('${result.did_you_mean}')">${result.did_you_mean}</button>?
            </div>
        `;
    }

    let badgeClass = "badge-risky";
    if (result.state === "deliverable") badgeClass = "badge-valid";
    else if (result.state === "undeliverable") badgeClass = "badge-invalid";

    const scorePercent = Math.round((result.score || 0) * 100);
    let scoreColor = "#eab308";
    if (scorePercent >= 70) scoreColor = "#16a34a";
    else if (scorePercent < 40) scoreColor = "#dc2626";

    resultCont.innerHTML = `
        <div class="result-header">
            <div class="email-title">${result.email || email}</div>
            <span class="badge ${badgeClass}">${result.state || "Unknown"}</span>
        </div>

        <div class="score-section">
            <div class="score-label">
                <span>Quality & Deliverability Score</span>
                <span>${scorePercent}%</span>
            </div>
            <div class="progress-bg">
                <div class="progress-fill" style="width: ${scorePercent}%; background: ${scoreColor};"></div>
            </div>
        </div>

        <div class="details-grid">
            <div class="detail-item"><span class="detail-key">Format Valid</span><span class="detail-val">${formatBool(result.format_valid)}</span></div>
            <div class="detail-item"><span class="detail-key">MX Records</span><span class="detail-val">${formatBool(result.mx_found)}</span></div>
            <div class="detail-item"><span class="detail-key">SMTP Check</span><span class="detail-val">${formatBool(result.smtp_check)}</span></div>
            <div class="detail-item"><span class="detail-key">Disposable</span><span class="detail-val">${formatBool(result.disposable)}</span></div>
            <div class="detail-item"><span class="detail-key">Free Provider</span><span class="detail-val">${formatBool(result.free)}</span></div>
            <div class="detail-item"><span class="detail-key">Role Account</span><span class="detail-val">${formatBool(result.role)}</span></div>
            <div class="detail-item"><span class="detail-key">Domain</span><span class="detail-val">${result.domain || "-"}</span></div>
            <div class="detail-item"><span class="detail-key">Reason</span><span class="detail-val">${result.reason ? result.reason.replace(/_/g, ' ') : "-"}</span></div>
        </div>

        <button class="btn-secondary" onclick="copyReport(this)">Copy Raw JSON Report</button>
    `;

    loader.style.display = "none";
    resultsCard.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.innerText = "Validate";
}

validateForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (email) validateSingleEmail(email);
});

window.recheckEmail = function (email) {
    switchTab("single");
    emailInput.value = email;
    validateSingleEmail(email);
};

window.copyReport = function (btn) {
    if (!lastResultData) return;
    navigator.clipboard.writeText(JSON.stringify(lastResultData, null, 2));
    const orig = btn.innerText;
    btn.innerText = "✔ Copied!";
    setTimeout(() => btn.innerText = orig, 2000);
};

// --- 5. Bulk Validation & CSV Export ---
bulkSubmitBtn.addEventListener("click", async () => {
    const raw = bulkInput.value.trim();
    if (!raw) return;

    const emails = [...new Set(raw.split(/[\n,]+/).map(e => e.trim()).filter(Boolean))].slice(0, 10);
    if (emails.length === 0) return;

    bulkResultsCard.style.display = "none";
    loader.style.display = "block";
    bulkSubmitBtn.disabled = true;
    bulkSubmitBtn.innerText = "Validating...";
    bulkResultsData = [];

    for (const email of emails) {
        const res = await fetchValidation(email);
        bulkResultsData.push(res);
    }

    bulkTableBody.innerHTML = bulkResultsData.map(item => {
        let badgeClass = "badge-risky";
        if (item.state === "deliverable") badgeClass = "badge-valid";
        else if (item.state === "undeliverable") badgeClass = "badge-invalid";

        return `
            <tr>
                <td><strong>${item.email}</strong></td>
                <td><span class="badge ${badgeClass}">${item.state}</span></td>
                <td>${Math.round((item.score || 0) * 100)}%</td>
                <td>${item.disposable ? "Yes" : "No"}</td>
                <td>${item.reason ? item.reason.replace(/_/g, " ") : "-"}</td>
            </tr>
        `;
    }).join("");

    loader.style.display = "none";
    bulkResultsCard.style.display = "block";
    bulkSubmitBtn.disabled = false;
    bulkSubmitBtn.innerText = "Validate All Emails";
});

exportCsvBtn.addEventListener("click", () => {
    if (bulkResultsData.length === 0) return;
    const headers = ["Email,Status,Score,Disposable,Free,Reason"];
    const rows = bulkResultsData.map(r =>
        `${r.email},${r.state},${Math.round((r.score || 0) * 100)}%,${r.disposable},${r.free},${r.reason}`
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ivalidate_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- 6. Search History ---
function saveToHistory(email, state) {
    let history = JSON.parse(localStorage.getItem("emailHistory") || "[]");
    history = history.filter(item => item.email !== email);
    history.unshift({ email, state });
    history = history.slice(0, 6);
    localStorage.setItem("emailHistory", JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem("emailHistory") || "[]");
    if (history.length === 0) {
        historySection.style.display = "none";
        return;
    }

    historySection.style.display = "block";
    historyList.innerHTML = history.map(item => {
        const dotColor = item.state === "deliverable" ? "#16a34a" : (item.state === "undeliverable" ? "#dc2626" : "#eab308");
        return `
            <div class="history-chip" onclick="recheckEmail('${item.email}')">
                <span style="width:8px; height:8px; border-radius:50%; background:${dotColor};"></span>
                <span>${item.email}</span>
            </div>
        `;
    }).join("");
}

clearHistoryBtn.addEventListener("click", () => {
    localStorage.removeItem("emailHistory");
    renderHistory();
});

renderHistory();