(() => {
  const btn = document.getElementById("refreshJobs");
  const status = document.getElementById("feedStatus");
  if (!btn) return;

  const LABEL = "Refresh recommendations";
  btn.textContent = LABEL;
  btn.setAttribute("aria-label", "Refresh Audrey's latest job recommendations");

  btn.addEventListener("click", async event => {
    event.stopImmediatePropagation();
    btn.disabled = true;
    btn.textContent = "Checking…";
    if (status) status.textContent = "Checking for Audrey's latest published recommendations…";

    try {
      await loadJobs();
      const feedDate = typeof formatFeedDate === "function" ? formatFeedDate(feedUpdatedAt) : "";
      if (status) status.textContent = feedDate
        ? `Recommendations refreshed. Latest feed: ${feedDate}.`
        : "Recommendations refreshed.";
    } catch (err) {
      console.warn("Recommendation refresh failed", err);
      if (status) status.textContent = "Could not refresh right now. Showing Audrey's cached recommendations.";
    } finally {
      btn.disabled = false;
      btn.textContent = LABEL;
    }
  }, { capture: true });
})();
