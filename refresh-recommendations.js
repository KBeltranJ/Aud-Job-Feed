(() => {
  const btn = document.getElementById("refreshJobs");
  const status = document.getElementById("feedStatus");
  if (!btn) return;

  const LABEL = "Refresh recommendations";
  const POLL_MS = 15000;
  const MAX_POLLS = 20;

  btn.textContent = LABEL;
  btn.setAttribute("aria-label", "Request fresh Audrey job recommendations");

  const setStatus = message => {
    if (status) status.textContent = message;
  };

  async function getActiveRequest(cloud, userId) {
    const { data, error } = await cloud
      .from("refresh_requests")
      .select("id,status,requested_at,processed_at,last_error")
      .eq("user_id", userId)
      .in("status", ["pending", "processing"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function waitForCompletion(cloud, requestId) {
    for (let i = 0; i < MAX_POLLS; i += 1) {
      await new Promise(resolve => setTimeout(resolve, POLL_MS));
      const { data, error } = await cloud
        .from("refresh_requests")
        .select("status,processed_at,last_error")
        .eq("id", requestId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return;
      if (data.status === "completed") {
        btn.textContent = "Loading new matches…";
        await loadJobs();
        const feedDate = typeof formatFeedDate === "function" ? formatFeedDate(feedUpdatedAt) : "";
        setStatus(feedDate
          ? `Fresh recommendations loaded. Feed updated ${feedDate}.`
          : "Fresh recommendations loaded.");
        return;
      }
      if (data.status === "error") {
        setStatus(data.last_error
          ? `Fresh search could not complete: ${data.last_error}`
          : "Fresh search could not complete. Your current recommendations are still available.");
        return;
      }
      setStatus(data.status === "processing"
        ? "Audrey's fresh job search is running…"
        : "Fresh job search requested. Waiting for new recommendations…");
    }
    setStatus("Fresh search is queued. You can close the app; the new feed will be available when processing finishes.");
  }

  btn.addEventListener("click", async event => {
    event.stopImmediatePropagation();
    btn.disabled = true;
    btn.textContent = "Requesting search…";

    try {
      const cloud = window.audreySupabase;
      if (!cloud) {
        setStatus("Cloud connection is unavailable. Open Criteria and make sure Audrey's account is connected.");
        return;
      }

      const { data: sessionData, error: sessionError } = await cloud.auth.getSession();
      if (sessionError) throw sessionError;
      const session = sessionData?.session;
      const user = session?.user;
      if (!user) {
        setStatus("Sign in under Criteria first, then tap Refresh recommendations again.");
        return;
      }

      let request = await getActiveRequest(cloud, user.id);
      if (!request) {
        const { data, error } = await cloud
          .from("refresh_requests")
          .insert({ user_id: user.id, status: "pending" })
          .select("id,status,requested_at")
          .single();
        if (error) {
          if (error.code === "23505") request = await getActiveRequest(cloud, user.id);
          else throw error;
        } else {
          request = data;
        }
      }

      if (!request?.id) throw new Error("Could not create a refresh request.");
      setStatus(request.status === "processing"
        ? "Audrey's fresh job search is already running…"
        : "Fresh job search requested. New recommendations will replace the current feed when ready; daily updates remain active.");
      await waitForCompletion(cloud, request.id);
    } catch (err) {
      console.error("Audrey recommendation request failed", err);
      setStatus("Could not request a fresh search right now. Your existing recommendations are unchanged.");
    } finally {
      btn.disabled = false;
      btn.textContent = LABEL;
    }
  }, { capture: true });
})();
