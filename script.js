const API_BASE = "http://127.0.0.1:8000/api";

// ---------------- Auth helpers ----------------
function getAccessToken() { return localStorage.getItem("access"); }
function getRefreshToken() { return localStorage.getItem("refresh"); }
function setTokens(access, refresh) {
  localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);
}
function clearTokens() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("username");
}
function isLoggedIn() { return !!getAccessToken(); }

async function authFetch(url, options = {}) {
  options.headers = options.headers || {};
  options.headers["Authorization"] = "Bearer " + getAccessToken();
  let res = await fetch(url, options);
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      options.headers["Authorization"] = "Bearer " + getAccessToken();
      res = await fetch(url, options);
    } else {
      logout();
    }
  }
  return res;
}

async function tryRefreshToken() {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access, data.refresh);
    return true;
  } catch {
    return false;
  }
}

function logout() {
  clearTokens();
  showAuthScreen();
}

// ---------------- Auth screen wiring ----------------
const authScreen = document.getElementById("auth-screen");
const app = document.getElementById("app");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
});
tabRegister.addEventListener("click", () => {
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";
  try {
    const res = await fetch(`${API_BASE}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.detail || "Invalid username or password.";
      return;
    }
    setTokens(data.access, data.refresh);
    localStorage.setItem("username", username);
    showApp();
  } catch (err) {
    errEl.textContent = "Could not reach the server. Is the backend running?";
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;
  const errEl = document.getElementById("register-error");
  const okEl = document.getElementById("register-success");
  errEl.textContent = "";
  okEl.textContent = "";
  try {
    const res = await fetch(`${API_BASE}/auth/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = Object.values(data).flat().join(" ") || "Registration failed.";
      return;
    }
    okEl.textContent = "Account created! You can now log in.";
    registerForm.reset();
    setTimeout(() => tabLogin.click(), 1200);
  } catch (err) {
    errEl.textContent = "Could not reach the server. Is the backend running?";
  }
});

document.getElementById("logout-btn").addEventListener("click", logout);

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  app.classList.add("hidden");
}
function showApp() {
  authScreen.classList.add("hidden");
  app.classList.remove("hidden");
  document.getElementById("whoami").textContent = "👤 " + (localStorage.getItem("username") || "");
  loadDashboard();
  loadStudents();
}

// ---------------- Tab switching (Dashboard / Students) ----------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
    if (btn.dataset.tab === "dashboard-tab") loadDashboard();
  });
});

// ---------------- Dashboard ----------------
let courseChartInstance, yearChartInstance;

async function loadDashboard() {
  try {
    const res = await authFetch(`${API_BASE}/students/stats/`);
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById("stat-total").textContent = data.total_students;
    document.getElementById("stat-avg").textContent = data.average_marks;
    document.getElementById("stat-top").textContent = data.top_student
      ? `${data.top_student.name} (${data.top_student.marks})`
      : "—";

    const courseLabels = data.course_distribution.map((c) => c.course);
    const courseCounts = data.course_distribution.map((c) => c.count);
    const yearLabels = data.year_distribution.map((y) => "Year " + y.year);
    const yearCounts = data.year_distribution.map((y) => y.count);

    if (courseChartInstance) courseChartInstance.destroy();
    if (yearChartInstance) yearChartInstance.destroy();

    courseChartInstance = new Chart(document.getElementById("courseChart"), {
      type: "bar",
      data: { labels: courseLabels, datasets: [{ label: "Students", data: courseCounts, backgroundColor: "#4f46e5" }] },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });

    yearChartInstance = new Chart(document.getElementById("yearChart"), {
      type: "doughnut",
      data: {
        labels: yearLabels,
        datasets: [{ data: yearCounts, backgroundColor: ["#4f46e5", "#7c3aed", "#a855f7", "#ec4899", "#f59e0b"] }],
      },
      options: { responsive: true },
    });
  } catch (err) {
    console.error("Dashboard load failed", err);
  }
}

// ---------------- Students CRUD ----------------
const studentForm = document.getElementById("student-form");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit");
const formMsg = document.getElementById("form-msg");
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photo-preview");

let currentPageUrl = null;
let searchTimer = null;

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (file) {
    photoPreview.src = URL.createObjectURL(file);
    photoPreview.classList.remove("hidden");
  }
});

function fieldIds() { return ["name", "email", "phone", "course", "year", "marks"]; }

function clearErrors() {
  fieldIds().forEach((f) => (document.getElementById("err-" + f).textContent = ""));
  formMsg.textContent = "";
  formMsg.className = "form-msg";
}

function resetForm() {
  studentForm.reset();
  document.getElementById("student-id").value = "";
  document.getElementById("form-title").textContent = "Add New Student";
  submitBtn.textContent = "Add Student";
  cancelEditBtn.classList.add("hidden");
  photoPreview.classList.add("hidden");
  clearErrors();
}

cancelEditBtn.addEventListener("click", resetForm);

function validateClientSide() {
  let valid = true;
  clearErrors();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const course = document.getElementById("course").value.trim();
  const year = document.getElementById("year").value;
  const marks = document.getElementById("marks").value;

  if (!name) { document.getElementById("err-name").textContent = "Name is required."; valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById("err-email").textContent = "Enter a valid email."; valid = false;
  }
  if (!phone || !/^\d{10,15}$/.test(phone)) {
    document.getElementById("err-phone").textContent = "Phone must be 10-15 digits."; valid = false;
  }
  if (!course) { document.getElementById("err-course").textContent = "Course is required."; valid = false; }
  if (!year) { document.getElementById("err-year").textContent = "Select a year."; valid = false; }
  if (marks === "" || marks < 0 || marks > 100) {
    document.getElementById("err-marks").textContent = "Marks must be 0-100."; valid = false;
  }
  return valid;
}

studentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateClientSide()) return;

  const id = document.getElementById("student-id").value;
  const fd = new FormData();
  fd.append("name", document.getElementById("name").value.trim());
  fd.append("email", document.getElementById("email").value.trim());
  fd.append("phone", document.getElementById("phone").value.trim());
  fd.append("course", document.getElementById("course").value.trim());
  fd.append("year", document.getElementById("year").value);
  fd.append("marks", document.getElementById("marks").value);
  if (photoInput.files[0]) fd.append("photo", photoInput.files[0]);

  const url = id ? `${API_BASE}/students/${id}/` : `${API_BASE}/students/`;
  const method = id ? "PATCH" : "POST";

  try {
    const res = await authFetch(url, { method, body: fd });
    const data = await res.json();
    if (!res.ok) {
      Object.keys(data).forEach((key) => {
        const el = document.getElementById("err-" + key);
        if (el) el.textContent = Array.isArray(data[key]) ? data[key][0] : data[key];
      });
      formMsg.textContent = "Please fix the errors above.";
      formMsg.className = "form-msg error";
      return;
    }
    formMsg.textContent = id ? "Student updated successfully." : "Student added successfully.";
    formMsg.className = "form-msg success";
    resetForm();
    loadStudents(currentPageUrl);
    loadDashboard();
  } catch (err) {
    formMsg.textContent = "Network error — is the backend server running?";
    formMsg.className = "form-msg error";
  }
});

function editStudent(s) {
  document.getElementById("student-id").value = s.id;
  document.getElementById("name").value = s.name;
  document.getElementById("email").value = s.email;
  document.getElementById("phone").value = s.phone;
  document.getElementById("course").value = s.course;
  document.getElementById("year").value = s.year;
  document.getElementById("marks").value = s.marks;
  if (s.photo) {
    photoPreview.src = s.photo;
    photoPreview.classList.remove("hidden");
  } else {
    photoPreview.classList.add("hidden");
  }
  document.getElementById("form-title").textContent = "Edit Student";
  submitBtn.textContent = "Update Student";
  cancelEditBtn.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteStudent(id) {
  if (!confirm("Delete this student record? This cannot be undone.")) return;
  try {
    const res = await authFetch(`${API_BASE}/students/${id}/`, { method: "DELETE" });
    if (res.ok) {
      loadStudents(currentPageUrl);
      loadDashboard();
    } else {
      alert("Failed to delete student.");
    }
  } catch {
    alert("Network error while deleting.");
  }
}

function buildListUrl() {
  const search = document.getElementById("search-box").value.trim();
  const year = document.getElementById("filter-year").value.trim();
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (year) params.append("year", year);
  const qs = params.toString();
  return `${API_BASE}/students/${qs ? "?" + qs : ""}`;
}

async function loadStudents(url) {
  url = url || buildListUrl();
  currentPageUrl = url;
  const tbody = document.getElementById("student-tbody");
  const emptyMsg = document.getElementById("empty-msg");
  try {
    const res = await authFetch(url);
    if (!res.ok) throw new Error("Failed to load");
    const data = await res.json();
    const results = data.results !== undefined ? data.results : data;
    tbody.innerHTML = "";

    if (!results.length) {
      emptyMsg.classList.remove("hidden");
    } else {
      emptyMsg.classList.add("hidden");
      results.forEach((s) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${s.photo ? `<img class="thumb" src="${s.photo}">` : `<div class="thumb"></div>`}</td>
          <td>${escapeHtml(s.name)}</td>
          <td>${escapeHtml(s.email)}</td>
          <td>${escapeHtml(s.phone)}</td>
          <td>${escapeHtml(s.course)}</td>
          <td>${s.year}</td>
          <td>${s.marks}</td>
          <td>
            <button class="btn small ghost" data-edit="${s.id}">Edit</button>
            <button class="btn small danger" data-del="${s.id}">Delete</button>
          </td>`;
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const s = results.find((r) => r.id == btn.dataset.edit);
          if (s) editStudent(s);
        });
      });
      tbody.querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", () => deleteStudent(btn.dataset.del));
      });
    }

    renderPagination(data);
  } catch (err) {
    tbody.innerHTML = "";
    emptyMsg.textContent = "Could not load students — is the backend server running?";
    emptyMsg.classList.remove("hidden");
  }
}

function renderPagination(data) {
  const pag = document.getElementById("pagination");
  pag.innerHTML = "";
  if (data.results === undefined) return; // not paginated response
  if (data.previous) {
    const b = document.createElement("button");
    b.textContent = "← Prev";
    b.addEventListener("click", () => loadStudents(data.previous));
    pag.appendChild(b);
  }
  if (data.next) {
    const b = document.createElement("button");
    b.textContent = "Next →";
    b.addEventListener("click", () => loadStudents(data.next));
    pag.appendChild(b);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

document.getElementById("search-box").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadStudents(), 350);
});
document.getElementById("filter-year").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadStudents(), 350);
});

document.getElementById("export-btn").addEventListener("click", async () => {
  try {
    const res = await authFetch(`${API_BASE}/students/export/`);
    if (!res.ok) { alert("Export failed."); return; }
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "students_export.csv";
    link.click();
  } catch {
    alert("Network error during export.");
  }
});

// ---------------- Init ----------------
if (isLoggedIn()) {
  showApp();
} else {
  showAuthScreen();
}
