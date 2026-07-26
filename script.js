const STORAGE_KEY = "blackHoldDataV1";

const defaultData = {
  profile: {
    name: "Nahiara",
    dailyGoal: 120,
    darkMode: false
  },

  subjects: [
    {
      id: crypto.randomUUID(),
      name: "Matemática",
      weeklyGoal: 300
    },
    {
      id: crypto.randomUUID(),
      name: "Física",
      weeklyGoal: 240
    },
    {
      id: crypto.randomUUID(),
      name: "Economía",
      weeklyGoal: 180
    },
    {
      id: crypto.randomUUID(),
      name: "Comprensión Lectora",
      weeklyGoal: 180
    }
  ],

  tasks: [],
  exams: [],
  reviews: [],

  habits: [
    {
      id: crypto.randomUUID(),
      name: "Estudiar",
      dates: []
    },
    {
      id: crypto.randomUUID(),
      name: "Tomar agua",
      dates: []
    },
    {
      id: crypto.randomUUID(),
      name: "Leer",
      dates: []
    }
  ],

  sessions: []
};

let data = loadData();

let stopwatchSeconds = 0;
let stopwatchInterval = null;

let pomodoroInterval = null;
let pomodoroSeconds = 25 * 60;
let pomodoroWorkMinutes = 25;
let pomodoroBreakMinutes = 5;
let pomodoroIsBreak = false;
let pomodoroRunning = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return structuredClone(defaultData);
  }

  try {
    const parsed = JSON.parse(saved);

    return {
      ...structuredClone(defaultData),
      ...parsed,
      profile: {
        ...defaultData.profile,
        ...(parsed.profile || {})
      }
    };
  } catch (error) {
    console.error("No se pudieron cargar los datos:", error);
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  renderAll();
}

function formatDate(dateString) {
  if (!dateString) {
    return "Sin fecha";
  }

  return new Date(`${dateString}T12:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function minutesToText(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (rest > 0) {
    return `${hours} h ${rest} min`;
  }

  return `${hours} h`;
}

function showToast(message) {
  const toast = $("#toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2300);
}

function emptyState(text) {
  return `
    <div class="empty">
      ${text}
    </div>
  `;
}

function getSubjectName(subjectId) {
  const subject = data.subjects.find((item) => item.id === subjectId);
  return subject?.name || "Sin materia";
}

function getTodayMinutes() {
  const today = todayKey();

  return data.sessions
    .filter((session) => session.date === today)
    .reduce((sum, session) => sum + session.minutes, 0);
}

function getMinutesSince(days) {
  const limit = new Date();

  limit.setDate(limit.getDate() - days + 1);
  limit.setHours(0, 0, 0, 0);

  return data.sessions
    .filter((session) => {
      const sessionDate = new Date(`${session.date}T12:00:00`);
      return sessionDate >= limit;
    })
    .reduce((sum, session) => sum + session.minutes, 0);
}

function calculateStreak() {
  const activeDates = new Set(
    data.sessions
      .filter((session) => session.minutes > 0)
      .map((session) => session.date)
  );

  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = cursor.toISOString().slice(0, 10);

    if (activeDates.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      if (streak === 0) {
        cursor.setDate(cursor.getDate() - 1);

        const yesterday = cursor.toISOString().slice(0, 10);

        if (activeDates.has(yesterday)) {
          continue;
        }
      }

      break;
    }
  }

  return streak;
}

function navigateTo(sectionId) {
  $$(".page-section").forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  $$(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionId);
  });

  const titles = {
    dashboard: "Panel principal",
    planner: "Planificador",
    subjects: "Materias",
    study: "Centro de estudio",
    reviews: "Repasos",
    exams: "Exámenes",
    habits: "Hábitos",
    stats: "Estadísticas",
    settings: "Configuración"
  };

  if ($("#pageTitle")) {
    $("#pageTitle").textContent = titles[sectionId] || "Black Hold";
  }

  if ($("#sidebar")) {
    $("#sidebar").classList.remove("open");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function populateSubjectSelects() {
  const options = data.subjects
    .map((subject) => {
      return `
        <option value="${subject.id}">
          ${escapeHtml(subject.name)}
        </option>
      `;
    })
    .join("");

  const selectIds = [
    "#taskSubject",
    "#timerSubject",
    "#reviewSubject",
    "#examSubject"
  ];

  selectIds.forEach((id) => {
    const element = $(id);

    if (!element) {
      return;
    }

    const current = element.value;

    element.innerHTML =
      options ||
      `
        <option value="">
          Crea una materia primero
        </option>
      `;

    const exists = [...element.options].some(
      (option) => option.value === current
    );

    if (exists) {
      element.value = current;
    }
  });
}

function renderDashboard() {
  const todayMinutes = getTodayMinutes();

  const dailyGoal = Math.max(
    Number(data.profile.dailyGoal) || 120,
    1
  );

  const progress = Math.min(
    Math.round((todayMinutes / dailyGoal) * 100),
    100
  );

  const streak = calculateStreak();

  if ($("#welcomeTitle")) {
    $("#welcomeTitle").textContent =
      `Hola, ${data.profile.name || "Nahiara"} 👋`;
  }

  if ($("#todayMinutes")) {
    $("#todayMinutes").textContent = minutesToText(todayMinutes);
  }

  if ($("#completedTasks")) {
    $("#completedTasks").textContent =
      data.tasks.filter((task) => task.done).length;
  }

  if ($("#upcomingExamCount")) {
    $("#upcomingExamCount").textContent =
      data.exams.filter((exam) => {
        const examDate = new Date(`${exam.date}T23:59:59`);
        return examDate >= new Date();
      }).length;
  }

  if ($("#dashboardStreak")) {
    $("#dashboardStreak").textContent = `${streak} días`;
  }

  if ($("#streakText")) {
    $("#streakText").textContent = `🔥 Racha: ${streak} días`;
  }

  if ($("#dailyProgressValue")) {
    $("#dailyProgressValue").textContent = `${progress}%`;
  }

  if ($("#dailyProgressRing")) {
    $("#dailyProgressRing").style.background =
      `conic-gradient(
        var(--primary) ${progress * 3.6}deg,
        var(--surface-2) ${progress * 3.6}deg
      )`;
  }

  const motivations = [
    "Haz hoy lo que tu futuro agradecerá.",
    "La constancia vence a la motivación.",
    "Una sesión enfocada vale más que horas distraídas.",
    "Tu progreso se construye tema por tema.",
    "No necesitas hacerlo perfecto; necesitas avanzar."
  ];

  if ($("#motivationText")) {
    $("#motivationText").textContent =
      motivations[new Date().getDate() % motivations.length];
  }

  const pendingTasks = [...data.tasks]
    .filter((task) => !task.done)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  if ($("#dashboardTasks")) {
    if (pendingTasks.length > 0) {
      $("#dashboardTasks").innerHTML =
        pendingTasks
          .map((task) => {
            return `
              <div class="list-item">
                <div class="list-item-main">
                  <strong>${escapeHtml(task.title)}</strong>

                  <small>
                    ${getSubjectName(task.subjectId)}
                    ·
                    ${formatDate(task.date)}
                  </small>
                </div>

                <span class="badge ${task.priority}">
                  ${task.priority}
                </span>
              </div>
            `;
          })
          .join("");
    } else {
      $("#dashboardTasks").innerHTML =
        emptyState("No tienes tareas pendientes.");
    }
  }

  const nextExams = [...data.exams]
    .filter((exam) => {
      const examDate = new Date(`${exam.date}T23:59:59`);
      return examDate >= new Date();
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  if ($("#dashboardExams")) {
    if (nextExams.length > 0) {
      $("#dashboardExams").innerHTML =
        nextExams
          .map((exam) => {
            return `
              <div class="list-item">
                <div class="list-item-main">
                  <strong>${escapeHtml(exam.name)}</strong>

                  <small>
                    ${escapeHtml(exam.type)}
                    ·
                    ${formatDate(exam.date)}
                  </small>

                  <span class="badge">
                    ${exam.preparation}% preparado
                  </span>
                </div>
              </div>
            `;
          })
          .join("");
    } else {
      $("#dashboardExams").innerHTML =
        emptyState("No hay exámenes próximos.");
    }
  }

  renderSubjectBars("#dashboardSubjectBars", 7);
}

function renderTasks() {
  const filter = $("#taskFilter")?.value || "all";

  const filtered = data.tasks
    .filter((task) => {
      if (filter === "all") {
        return true;
      }

      if (filter === "done") {
        return task.done;
      }

      return !task.done;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!$("#taskList")) {
    return;
  }

  if (filtered.length === 0) {
    $("#taskList").innerHTML =
      emptyState("No hay tareas en esta categoría.");
    return;
  }

  $("#taskList").innerHTML =
    filtered
      .map((task) => {
        return `
          <div class="list-item ${task.done ? "done" : ""}">
            <div class="list-item-main">
              <strong>${escapeHtml(task.title)}</strong>

              <small>
                ${getSubjectName(task.subjectId)}
                ·
                ${formatDate(task.date)}
              </small>

              <span class="badge ${task.priority}">
                ${task.priority}
              </span>
            </div>

            <div class="item-actions">
              <button
                class="mini-btn"
                onclick="toggleTask('${task.id}')"
                aria-label="Cambiar estado"
              >
                ${task.done ? "↩" : "✓"}
              </button>

              <button
                class="mini-btn"
                onclick="deleteTask('${task.id}')"
                aria-label="Eliminar tarea"
              >
                🗑
              </button>
            </div>
          </div>
        `;
      })
      .join("");
}

function renderSubjects() {
  const weeklyBySubject = getMinutesBySubject(7);

  if (!$("#subjectGrid")) {
    return;
  }

  if (data.subjects.length === 0) {
    $("#subjectGrid").innerHTML =
      emptyState("Agrega tu primera materia.");
    return;
  }

  $("#subjectGrid").innerHTML =
    data.subjects
      .map((subject) => {
        const studied = weeklyBySubject[subject.id] || 0;
        const goal = Number(subject.weeklyGoal) || 1;

        const progress = Math.min(
          Math.round((studied / goal) * 100),
          100
        );

        return `
          <div class="subject-card">
            <h4>${escapeHtml(subject.name)}</h4>

            <p>${minutesToText(studied)} esta semana</p>

            <p>Meta: ${minutesToText(goal)}</p>

            <div class="progress-bar">
              <span style="width: ${progress}%"></span>
            </div>

            <div class="item-actions">
              <span class="badge">${progress}%</span>

              <button
                class="mini-btn"
                onclick="deleteSubject('${subject.id}')"
              >
                Eliminar
              </button>
            </div>
          </div>
        `;
      })
      .join("");
}

function renderSessions() {
  const sessions = [...data.sessions].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  if (!$("#sessionList")) {
    return;
  }

  if (sessions.length === 0) {
    $("#sessionList").innerHTML =
      emptyState("Aún no registras sesiones de estudio.");
    return;
  }

  $("#sessionList").innerHTML =
    sessions
      .map((session) => {
        return `
          <div class="list-item">
            <div class="list-item-main">
              <strong>
                ${escapeHtml(getSubjectName(session.subjectId))}
              </strong>

              <small>
                ${escapeHtml(session.topic || "Sesión de estudio")}
                ·
                ${formatDate(session.date)}
              </small>
            </div>

            <span class="badge">
              ${minutesToText(session.minutes)}
            </span>
          </div>
        `;
      })
      .join("");
}

function renderReviews() {
  const reviews = [...data.reviews].sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  if (!$("#reviewList")) {
    return;
  }

  if (reviews.length === 0) {
    $("#reviewList").innerHTML =
      emptyState("No tienes repasos programados.");
    return;
  }

  $("#reviewList").innerHTML =
    reviews
      .map((review) => {
        return `
          <div class="list-item">
            <div class="list-item-main">
              <strong>${escapeHtml(review.topic)}</strong>

              <small>
                ${getSubjectName(review.subjectId)}
                ·
                ${formatDate(review.date)}
              </small>

              <span class="badge">
                ${escapeHtml(review.difficulty)}
              </span>
            </div>

            <div class="item-actions">
              <button
                class="mini-btn"
                onclick="completeReview('${review.id}')"
              >
                Repasado
              </button>

              <button
                class="mini-btn"
                onclick="deleteReview('${review.id}')"
              >
                🗑
              </button>
            </div>
          </div>
        `;
      })
      .join("");
}

function renderExams() {
  const exams = [...data.exams].sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  if (!$("#examList")) {
    return;
  }

  if (exams.length === 0) {
    $("#examList").innerHTML =
      emptyState("No has agregado exámenes.");
    return;
  }

  $("#examList").innerHTML =
    exams
      .map((exam) => {
        const examDate = new Date(`${exam.date}T12:00:00`);

        const days = Math.ceil(
          (examDate - new Date()) / 86400000
        );

        const daysText =
          days >= 0
            ? `faltan ${days} días`
            : "finalizado";

        return `
          <div class="list-item">
            <div class="list-item-main">
              <strong>${escapeHtml(exam.name)}</strong>

              <small>
                ${escapeHtml(exam.type)}
                ·
                ${getSubjectName(exam.subjectId)}
                ·
                ${formatDate(exam.date)}
              </small>

              <small>
                ${escapeHtml(exam.topics || "Sin temario")}
                ·
                ${daysText}
              </small>

              <div class="progress-bar">
                <span style="width: ${exam.preparation}%"></span>
              </div>
            </div>

            <div class="item-actions">
              <button
                class="mini-btn"
                onclick="increaseExam('${exam.id}')"
              >
                +10%
              </button>

              <button
                class="mini-btn"
                onclick="deleteExam('${exam.id}')"
              >
                🗑
              </button>
            </div>
          </div>
        `;
      })
      .join("");
}

function renderHabits() {
  const today = todayKey();

  if (!$("#habitList")) {
    return;
  }

  if (data.habits.length === 0) {
    $("#habitList").innerHTML =
      emptyState("Agrega un hábito para comenzar.");
    return;
  }

  $("#habitList").innerHTML =
    data.habits
      .map((habit) => {
        const checked = habit.dates.includes(today);

        return `
          <div class="habit-item">
            <label class="habit-check">
              <input
                type="checkbox"
                ${checked ? "checked" : ""}
                onchange="toggleHabit('${habit.id}')"
              >

              <span>${escapeHtml(habit.name)}</span>
            </label>

            <button
              class="mini-btn"
              onclick="deleteHabit('${habit.id}')"
            >
              🗑
            </button>
          </div>
        `;
      })
      .join("");
}

function getMinutesBySubject(days = null) {
  let sessions = data.sessions;

  if (days) {
    const limit = new Date();

    limit.setDate(limit.getDate() - days + 1);
    limit.setHours(0, 0, 0, 0);

    sessions = sessions.filter((session) => {
      const sessionDate = new Date(`${session.date}T12:00:00`);
      return sessionDate >= limit;
    });
  }

  return sessions.reduce((accumulator, session) => {
    accumulator[session.subjectId] =
      (accumulator[session.subjectId] || 0) + session.minutes;

    return accumulator;
  }, {});
}

function renderSubjectBars(target, days = null) {
  const container = $(target);

  if (!container) {
    return;
  }

  const totals = getMinutesBySubject(days);
  const values = Object.values(totals);
  const max = Math.max(...values, 1);

  const rows = data.subjects
    .map((subject) => {
      const minutes = totals[subject.id] || 0;

      const width = Math.round(
        (minutes / max) * 100
      );

      return `
        <div class="bar-row">
          <strong>${escapeHtml(subject.name)}</strong>

          <div class="bar-track">
            <div
              class="bar-fill"
              style="width: ${width}%"
            ></div>
          </div>

          <span>${minutesToText(minutes)}</span>
        </div>
      `;
    })
    .join("");

  container.innerHTML =
    rows || emptyState("No hay datos todavía.");
}

function renderStats() {
  const total = data.sessions.reduce(
    (sum, session) => sum + session.minutes,
    0
  );

  const weekly = getMinutesSince(7);
  const totals = getMinutesBySubject();

  const bestId = Object.keys(totals).sort(
    (a, b) => totals[b] - totals[a]
  )[0];

  if ($("#totalStudyTime")) {
    $("#totalStudyTime").textContent = minutesToText(total);
  }

  if ($("#weeklyStudyTime")) {
    $("#weeklyStudyTime").textContent = minutesToText(weekly);
  }

  if ($("#bestSubject")) {
    $("#bestSubject").textContent =
      bestId ? getSubjectName(bestId) : "—";
  }

  if ($("#sessionCount")) {
    $("#sessionCount").textContent = data.sessions.length;
  }

  renderSubjectBars("#statsSubjectBars");
}

function renderSettings() {
  if ($("#profileName")) {
    $("#profileName").value = data.profile.name || "Nahiara";
  }

  if ($("#dailyGoal")) {
    $("#dailyGoal").value = data.profile.dailyGoal || 120;
  }

  document.body.classList.toggle(
    "dark",
    data.profile.darkMode
  );

  if ($("#themeToggle")) {
    $("#themeToggle").textContent =
      data.profile.darkMode
        ? "☀️ Modo claro"
        : "🌙 Modo oscuro";
  }
}

function renderAll() {
  populateSubjectSelects();
  renderDashboard();
  renderTasks();
  renderSubjects();
  renderSessions();
  renderReviews();
  renderExams();
  renderHabits();
  renderStats();
  renderSettings();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.toggleTask = function (id) {
  const task = data.tasks.find((item) => item.id === id);

  if (!task) {
    return;
  }

  task.done = !task.done;
  saveData();
};

window.deleteTask = function (id) {
  data.tasks = data.tasks.filter((task) => task.id !== id);
  saveData();
};

window.deleteSubject = function (id) {
  const used =
    data.tasks.some((item) => item.subjectId === id) ||
    data.exams.some((item) => item.subjectId === id) ||
    data.sessions.some((item) => item.subjectId === id);

  if (used) {
    showToast(
      "No puedes borrar una materia que ya tiene datos asociados."
    );
    return;
  }

  data.subjects = data.subjects.filter(
    (subject) => subject.id !== id
  );

  saveData();
};

window.completeReview = function (id) {
  const review = data.reviews.find((item) => item.id === id);

  if (!review) {
    return;
  }

  let days = 5;

  if (review.difficulty === "difícil") {
    days = 2;
  }

  if (review.difficulty === "fácil") {
    days = 10;
  }

  const next = new Date();
  next.setDate(next.getDate() + days);

  review.date = next.toISOString().slice(0, 10);

  saveData();

  showToast(`Próximo repaso programado en ${days} días.`);
};

window.deleteReview = function (id) {
  data.reviews = data.reviews.filter(
    (review) => review.id !== id
  );

  saveData();
};

window.increaseExam = function (id) {
  const exam = data.exams.find((item) => item.id === id);

  if (!exam) {
    return;
  }

  exam.preparation = Math.min(
    Number(exam.preparation) + 10,
    100
  );

  saveData();
};

window.deleteExam = function (id) {
  data.exams = data.exams.filter((exam) => exam.id !== id);
  saveData();
};

window.toggleHabit = function (id) {
  const habit = data.habits.find((item) => item.id === id);

  if (!habit) {
    return;
  }

  const today = todayKey();

  if (habit.dates.includes(today)) {
    habit.dates = habit.dates.filter((date) => date !== today);
  } else {
    habit.dates.push(today);
  }

  saveData();
};

window.deleteHabit = function (id) {
  data.habits = data.habits.filter((habit) => habit.id !== id);
  saveData();
};

function setupEvents() {
  $$(".nav-link").forEach((button) => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.section);
    });
  });

  $$("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.go);
    });
  });

  $("#menuBtn")?.addEventListener("click", () => {
    $("#sidebar")?.classList.toggle("open");
  });

  $("#quickStudyBtn")?.addEventListener("click", () => {
    navigateTo("study");
  });

  $("#taskForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = $("#taskTitle").value.trim();

    if (!title) {
      showToast("Escribe el nombre de la tarea.");
      return;
    }

    data.tasks.push({
      id: crypto.randomUUID(),
      title,
      subjectId: $("#taskSubject").value,
      date: $("#taskDate").value,
      priority: $("#taskPriority").value,
      done: false
    });

    event.target.reset();
    $("#taskDate").value = todayKey();

    saveData();
    showToast("Tarea agregada.");
  });

  $("#taskFilter")?.addEventListener("change", renderTasks);

  $("#subjectForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("#subjectName").value.trim();

    if (!name) {
      showToast("Escribe el nombre de la materia.");
      return;
    }

    data.subjects.push({
      id: crypto.randomUUID(),
      name,
      weeklyGoal: Number($("#subjectGoal").value) || 300
    });

    event.target.reset();
    $("#subjectGoal").value = 300;

    saveData();
    showToast("Materia agregada.");
  });

  $("#reviewForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const topic = $("#reviewTopic").value.trim();

    if (!topic) {
      showToast("Escribe el tema del repaso.");
      return;
    }

    data.reviews.push({
      id: crypto.randomUUID(),
      topic,
      subjectId: $("#reviewSubject").value,
      date: $("#reviewDate").value,
      difficulty: $("#reviewDifficulty").value
    });

    event.target.reset();
    $("#reviewDate").value = todayKey();

    saveData();
    showToast("Repaso programado.");
  });

  $("#examForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("#examName").value.trim();

    if (!name) {
      showToast("Escribe el nombre del examen.");
      return;
    }

    data.exams.push({
      id: crypto.randomUUID(),
      name,
      type: $("#examType").value,
      subjectId: $("#examSubject").value,
      date: $("#examDate").value,
      preparation: Number($("#examPreparation").value),
      topics: $("#examTopics").value.trim()
    });

    event.target.reset();

    $("#examDate").value = todayKey();
    $("#examPreparation").value = 0;

    saveData();
    showToast("Examen agregado.");
  });

  $("#habitForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("#habitName").value.trim();

    if (!name) {
      showToast("Escribe el nombre del hábito.");
      return;
    }

    data.habits.push({
      id: crypto.randomUUID(),
      name,
      dates: []
    });

    event.target.reset();

    saveData();
    showToast("Hábito agregado.");
  });

  $("#profileForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    data.profile.name =
      $("#profileName").value.trim() || "Nahiara";

    data.profile.dailyGoal =
      Number($("#dailyGoal").value) || 120;

    saveData();
    showToast("Configuración guardada.");
  });

  $("#themeToggle")?.addEventListener("click", () => {
    data.profile.darkMode = !data.profile.darkMode;
    saveData();
  });

  $("#startStopwatch")?.addEventListener("click", () => {
    if (stopwatchInterval) {
      return;
    }

    stopwatchInterval = setInterval(() => {
      stopwatchSeconds += 1;
      updateStopwatch();
    }, 1000);
  });

  $("#pauseStopwatch")?.addEventListener("click", () => {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
  });

  $("#finishStopwatch")?.addEventListener("click", () => {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;

    if (!$("#timerSubject").value) {
      showToast("Crea una materia antes de guardar.");
      return;
    }

    if (stopwatchSeconds < 5) {
      showToast("La sesión es demasiado corta.");
      return;
    }

    const minutes = Math.max(
      1,
      Math.round(stopwatchSeconds / 60)
    );

    data.sessions.push({
      id: crypto.randomUUID(),
      subjectId: $("#timerSubject").value,
      topic: $("#timerTopic").value.trim(),
      minutes,
      date: todayKey(),
      createdAt: Date.now()
    });

    stopwatchSeconds = 0;
    $("#timerTopic").value = "";

    updateStopwatch();
    saveData();

    showToast("Sesión guardada.");
  });

  $$(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$(".chip").forEach((item) => {
        item.classList.remove("active");
      });

      chip.classList.add("active");

      pomodoroWorkMinutes = Number(chip.dataset.work);
      pomodoroBreakMinutes = Number(chip.dataset.break);
      pomodoroIsBreak = false;
      pomodoroSeconds = pomodoroWorkMinutes * 60;

      updatePomodoro();
    });
  });

  $("#startPomodoro")?.addEventListener("click", startPomodoro);

  $("#pausePomodoro")?.addEventListener("click", () => {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
    pomodoroRunning = false;
  });

  $("#resetPomodoro")?.addEventListener("click", () => {
    clearInterval(pomodoroInterval);

    pomodoroInterval = null;
    pomodoroRunning = false;
    pomodoroIsBreak = false;
    pomodoroSeconds = pomodoroWorkMinutes * 60;

    updatePomodoro();
  });

  $("#clearSessions")?.addEventListener("click", () => {
    const confirmed = confirm(
      "¿Borrar todo el historial de estudio?"
    );

    if (!confirmed) {
      return;
    }

    data.sessions = [];
    saveData();
  });

  $("#exportData")?.addEventListener("click", () => {
    const content = JSON.stringify(data, null, 2);

    const blob = new Blob([content], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `black-hold-backup-${todayKey()}.json`;
    link.click();

    URL.revokeObjectURL(url);
  });

  $("#importData")?.addEventListener("change", async (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);

      data = parsed;

      saveData();
      showToast("Datos importados correctamente.");
    } catch (error) {
      console.error(error);
      showToast("El archivo no es válido.");
    }
  });

  $("#enableNotifications")?.addEventListener(
    "click",
    async () => {
      if (!("Notification" in window)) {
        showToast("Tu navegador no admite notificaciones.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        showToast("Notificaciones activadas.");
      } else {
        showToast("Permiso no concedido.");
      }
    }
  );

  $("#resetApp")?.addEventListener("click", () => {
    const confirmed = confirm(
      "Esto eliminará todos tus datos. ¿Continuar?"
    );

    if (!confirmed) {
      return;
    }

    data = structuredClone(defaultData);
    saveData();
  });
}

function updateStopwatch() {
  const display = $("#stopwatchDisplay");

  if (!display) {
    return;
  }

  const hours = String(
    Math.floor(stopwatchSeconds / 3600)
  ).padStart(2, "0");

  const minutes = String(
    Math.floor((stopwatchSeconds % 3600) / 60)
  ).padStart(2, "0");

  const seconds = String(
    stopwatchSeconds % 60
  ).padStart(2, "0");

  display.textContent = `${hours}:${minutes}:${seconds}`;
}

function startPomodoro() {
  if (pomodoroRunning) {
    return;
  }

  pomodoroRunning = true;

  pomodoroInterval = setInterval(() => {
    pomodoroSeconds -= 1;

    if (pomodoroSeconds <= 0) {
      clearInterval(pomodoroInterval);

      pomodoroInterval = null;
      pomodoroRunning = false;

      if (!pomodoroIsBreak && $("#timerSubject")?.value) {
        data.sessions.push({
          id: crypto.randomUUID(),
          subjectId: $("#timerSubject").value,
          topic: $("#timerTopic")?.value.trim() || "Pomodoro",
          minutes: pomodoroWorkMinutes,
          date: todayKey(),
          createdAt: Date.now()
        });

        saveData();
      }

      pomodoroIsBreak = !pomodoroIsBreak;

      pomodoroSeconds =
        (
          pomodoroIsBreak
            ? pomodoroBreakMinutes
            : pomodoroWorkMinutes
        ) * 60;

      updatePomodoro();
      notifyPomodoro();
    } else {
      updatePomodoro();
    }
  }, 1000);
}

function updatePomodoro() {
  const display = $("#pomodoroDisplay");
  const mode = $("#pomodoroMode");

  if (!display || !mode) {
    return;
  }

  const minutes = String(
    Math.floor(pomodoroSeconds / 60)
  ).padStart(2, "0");

  const seconds = String(
    pomodoroSeconds % 60
  ).padStart(2, "0");

  display.textContent = `${minutes}:${seconds}`;

  mode.textContent =
    pomodoroIsBreak
      ? "Tiempo de descanso"
      : "Tiempo de estudio";
}

function notifyPomodoro() {
  const message =
    pomodoroIsBreak
      ? "¡Sesión completada! Hora de descansar."
      : "Descanso terminado. Volvamos a estudiar.";

  showToast(message);

  if (
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification("Black Hold", {
      body: message
    });
  }
}

function setInitialDates() {
  if ($("#taskDate")) {
    $("#taskDate").value = todayKey();
  }

  if ($("#reviewDate")) {
    $("#reviewDate").value = todayKey();
  }

  if ($("#examDate")) {
    $("#examDate").value = todayKey();
  }
}

function initialize() {
  const now = new Date();

  if ($("#todayLabel")) {
    $("#todayLabel").textContent =
      now.toLocaleDateString("es-CL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
  }

  setInitialDates();
  setupEvents();
  renderAll();
  updateStopwatch();
  updatePomodoro();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .catch((error) => {
          console.error(
            "No se pudo registrar el Service Worker:",
            error
          );
        });
    });
  }
}

initialize();
