(() => {
  const KEY = "ajf_project_metrics";
  const DEFAULTS = {
    startedAt: "",
    jobsSeen: {},
    reviewedJobs: {},
    openedJobs: {},
    interviewReached: {},
    offersReached: {},
    refreshRequests: 0,
    refreshCompleted: 0,
    hoursBefore: "",
    hoursNow: ""
  };

  function readMetrics() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
      return {};
    }
  }

  let metrics = { ...DEFAULTS, ...readMetrics() };
  for (const key of ["jobsSeen", "reviewedJobs", "openedJobs", "interviewReached", "offersReached"]) {
    metrics[key] = { ...(metrics[key] || {}) };
  }
  if (!metrics.startedAt) metrics.startedAt = new Date().toISOString();

  function save() {
    localStorage.setItem(KEY, JSON.stringify(metrics));
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function mark(mapName, id) {
    if (!id || metrics[mapName][id]) return false;
    metrics[mapName][id] = nowISO();
    return true;
  }

  function bootstrapExistingData() {
    let changed = false;
    try {
      (jobs || []).forEach(job => {
        if (job && job.id) changed = mark("jobsSeen", job.id) || changed;
      });
    } catch {}

    try {
      Object.entries(statuses || {}).forEach(([id, status]) => {
        if (status) changed = mark("reviewedJobs", id) || changed;
      });
    } catch {}

    try {
      Object.entries(applicationDetails || {}).forEach(([id, detail]) => {
        const stage = detail && detail.stage ? detail.stage : "";
        if (["Phone Screen", "Recruiter Screen", "Hiring Manager", "Interview", "Final Interview", "Offer"].includes(stage)) {
          changed = mark("interviewReached", id) || changed;
        }
        if (stage === "Offer") changed = mark("offersReached", id) || changed;
      });
    } catch {}

    if (changed) save();
  }

  function markCurrentJobsSeen() {
    let changed = false;
    try {
      (jobs || []).forEach(job => {
        if (job && job.id) changed = mark("jobsSeen", job.id) || changed;
      });
    } catch {}
    if (changed) save();
  }

  function applicationCount() {
    try {
      return Object.keys(applicationDetails || {}).length;
    } catch {
      return 0;
    }
  }

  function counts() {
    const seen = Object.keys(metrics.jobsSeen).length;
    const applications = applicationCount();
    return {
      seen,
      reviewed: Object.keys(metrics.reviewedJobs).length,
      opened: Object.keys(metrics.openedJobs).length,
      applications,
      interviews: Object.keys(metrics.interviewReached).length,
      offers: Object.keys(metrics.offersReached).length,
      refreshRequests: Number(metrics.refreshRequests || 0),
      refreshCompleted: Number(metrics.refreshCompleted || 0),
      applicationRate: seen ? Math.round((applications / seen) * 100) : 0
    };
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function render() {
    const c = counts();
    setText("metricJobsSeen", c.seen);
    setText("metricReviewed", c.reviewed);
    setText("metricOpened", c.opened);
    setText("metricApplications", c.applications);
    setText("metricInterviews", c.interviews);
    setText("metricOffers", c.offers);
    setText("metricRefreshes", c.refreshCompleted);
    setText("metricApplyRate", c.applicationRate + "%");

    const started = document.getElementById("metricsStarted");
    if (started) {
      const d = new Date(metrics.startedAt);
      started.textContent = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }

    const before = document.getElementById("metricsHoursBefore");
    const current = document.getElementById("metricsHoursNow");
    if (before && document.activeElement !== before) before.value = metrics.hoursBefore;
    if (current && document.activeElement !== current) current.value = metrics.hoursNow;

    const timeSaved = document.getElementById("metricsTimeSaved");
    if (timeSaved) {
      const beforeHours = Number(metrics.hoursBefore);
      const currentHours = Number(metrics.hoursNow);
      if (metrics.hoursBefore !== "" && metrics.hoursNow !== "" && beforeHours >= 0 && currentHours >= 0) {
        const hours = Math.max(0, beforeHours - currentHours);
        const pct = beforeHours > 0 ? Math.round((hours / beforeHours) * 100) : 0;
        timeSaved.textContent = "Measured time saved: " + hours.toFixed(1) + " hours/week (" + pct + "% reduction).";
      } else {
        timeSaved.textContent = "Add your before/after weekly job-search time to calculate a measured time-saved metric.";
      }
    }
  }

  function record(type, id, stage) {
    let changed = false;
    if (type === "reviewed") changed = mark("reviewedJobs", id);
    if (type === "opened") changed = mark("openedJobs", id);
    if (type === "stage") {
      if (["Phone Screen", "Recruiter Screen", "Hiring Manager", "Interview", "Final Interview", "Offer"].includes(stage)) {
        changed = mark("interviewReached", id) || changed;
      }
      if (stage === "Offer") changed = mark("offersReached", id) || changed;
    }
    if (type === "refreshRequested") {
      metrics.refreshRequests = Number(metrics.refreshRequests || 0) + 1;
      changed = true;
    }
    if (type === "refreshCompleted") {
      metrics.refreshCompleted = Number(metrics.refreshCompleted || 0) + 1;
      changed = true;
    }
    if (changed) save();
    render();
  }

  function showMetrics() {
    document.querySelectorAll("main .view").forEach(view => view.classList.add("hidden"));
    const view = document.getElementById("metricsView");
    if (view) view.classList.remove("hidden");
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === "metrics");
    });
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const metricsNav = document.querySelector('.nav-item[data-view="metrics"]');
  if (metricsNav) {
    metricsNav.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showMetrics();
    }, true);
  }

  document.addEventListener("click", event => {
    const statusButton = event.target.closest(".action-btn[data-job][data-status]");
    if (statusButton) record("reviewed", statusButton.dataset.job);

    const jobLink = event.target.closest("a.action-btn");
    if (jobLink) {
      const card = jobLink.closest(".job-card");
      if (card) {
        const id = card.dataset.applicationId || card.querySelector("[data-job]")?.dataset.job || "";
        if (id) record("opened", id);
      }
    }
  });

  document.addEventListener("change", event => {
    if (event.target.matches(".application-stage")) {
      const card = event.target.closest(".application-card");
      if (card) record("stage", card.dataset.applicationId, event.target.value);
    }

    if (event.target.id === "metricsHoursBefore" || event.target.id === "metricsHoursNow") {
      metrics.hoursBefore = document.getElementById("metricsHoursBefore")?.value || "";
      metrics.hoursNow = document.getElementById("metricsHoursNow")?.value || "";
      save();
      render();
    }
  });

  document.getElementById("exportMetrics")?.addEventListener("click", () => {
    const c = counts();
    const rows = [
      ["Metric", "Value"],
      ["Tracking started", metrics.startedAt],
      ["Unique jobs surfaced", c.seen],
      ["Jobs reviewed", c.reviewed],
      ["Job postings opened", c.opened],
      ["Applications tracked", c.applications],
      ["Interview stages reached", c.interviews],
      ["Offers reached", c.offers],
      ["Refresh requests", c.refreshRequests],
      ["Refreshes completed", c.refreshCompleted],
      ["Application rate", c.applicationRate + "%"],
      ["Weekly hours before", metrics.hoursBefore],
      ["Weekly hours now", metrics.hoursNow]
    ];
    const csv = rows.map(row => row.map(value => '"' + String(value ?? "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audrey-job-feed-metrics-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  });

  const jobsListEl = document.getElementById("jobsList");
  if (jobsListEl) {
    const observer = new MutationObserver(() => {
      markCurrentJobsSeen();
      render();
    });
    observer.observe(jobsListEl, { childList: true, subtree: true });
  }

  bootstrapExistingData();
  markCurrentJobsSeen();
  save();
  render();

  window.AudreyMetrics = { record, render, counts };
})();