(() => {
  const cfg = window.AUDREY_SUPABASE;
  const lib = window.supabase;
  const mount = document.getElementById('syncPanelMount');

  if (!cfg || !lib?.createClient) {
    if (mount) mount.innerHTML = '<section class="panel sync-panel"><strong>Cloud unavailable</strong><p class="subtle">Audrey\'s local app still works on this device.</p></section>';
    return;
  }

  const cloud = lib.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.audreySupabase = cloud;

  let cloudSession = null;
  let syncBusy = false;

  const safeName = name => String(name || 'resume').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
  const currentLocalCriteria = () => ({
    min_salary: Number(criteria?.minSalary || 0),
    location_preference: criteria?.location || 'All locations',
    active_tracks: Array.isArray(criteria?.tracks) ? criteria.tracks : ['A','B','C']
  });

  function injectSyncPanel() {
    if (!mount) return;
    mount.innerHTML = `<section class="panel sync-panel">
      <div class="section-heading compact">
        <div><div class="eyebrow">CLOUD SYNC</div><h3>Phone + desktop sync</h3></div>
        <span id="syncDot" class="sync-dot"></span>
      </div>
      <p class="subtle">Sign in once on each device. Audrey's saved jobs, applications, criteria, notes, and Resume A/B/C sync through her private Supabase account.</p>
      <div id="syncSignedOut">
        <div class="form-grid sync-form">
          <label>Email<input id="syncEmail" type="email" autocomplete="email" placeholder="you@example.com"></label>
          <label>Password<input id="syncPassword" type="password" autocomplete="current-password" minlength="8" placeholder="8+ characters"></label>
        </div>
        <div class="sync-actions">
          <button id="syncSignIn" class="primary-btn">Sign in</button>
          <button id="syncSignUp" class="ghost-btn">Create account</button>
        </div>
      </div>
      <div id="syncSignedIn" class="hidden">
        <p class="sync-account">Signed in as <strong id="syncEmailDisplay"></strong></p>
        <div class="sync-actions">
          <button id="syncNow" class="primary-btn">Sync now</button>
          <button id="syncSignOut" class="ghost-btn">Sign out</button>
        </div>
      </div>
      <p id="syncMessage" class="save-message"></p>
    </section>`;

    document.getElementById('syncSignIn')?.addEventListener('click', signInCloud);
    document.getElementById('syncSignUp')?.addEventListener('click', signUpCloud);
    document.getElementById('syncSignOut')?.addEventListener('click', signOutCloud);
    document.getElementById('syncNow')?.addEventListener('click', () => fullSync({ manual: true }));
    renderCloudAuth();
  }

  function setSyncMessage(message, error = false) {
    const el = document.getElementById('syncMessage');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('error-message', !!error);
  }

  function renderCloudAuth() {
    const out = document.getElementById('syncSignedOut');
    const inside = document.getElementById('syncSignedIn');
    const dot = document.getElementById('syncDot');
    const email = document.getElementById('syncEmailDisplay');
    if (!out || !inside) return;
    const signedIn = !!cloudSession;
    out.classList.toggle('hidden', signedIn);
    inside.classList.toggle('hidden', !signedIn);
    dot?.classList.toggle('online', signedIn);
    if (email) email.textContent = cloudSession?.user?.email || '';
  }

  async function signUpCloud() {
    const email = document.getElementById('syncEmail')?.value.trim() || '';
    const password = document.getElementById('syncPassword')?.value || '';
    if (!email || password.length < 8) {
      setSyncMessage('Enter your email and a password of at least 8 characters.', true);
      return;
    }
    setSyncMessage('Creating account…');
    const { data, error } = await cloud.auth.signUp({ email, password });
    if (error) {
      setSyncMessage(error.message, true);
      return;
    }
    if (data.session) {
      cloudSession = data.session;
      renderCloudAuth();
      await fullSync({ firstLogin: true });
      setSyncMessage('Account created and synced.');
    } else {
      setSyncMessage('Account created. Check your email to confirm it, then come back and sign in.');
    }
  }

  async function signInCloud() {
    const email = document.getElementById('syncEmail')?.value.trim() || '';
    const password = document.getElementById('syncPassword')?.value || '';
    if (!email || !password) {
      setSyncMessage('Enter your email and password.', true);
      return;
    }
    setSyncMessage('Signing in…');
    const { data, error } = await cloud.auth.signInWithPassword({ email, password });
    if (error) {
      setSyncMessage(error.message, true);
      return;
    }
    cloudSession = data.session;
    renderCloudAuth();
    await fullSync({ firstLogin: true });
    setSyncMessage('Signed in and synced.');
  }

  async function signOutCloud() {
    await cloud.auth.signOut();
    cloudSession = null;
    renderCloudAuth();
    setSyncMessage('Signed out. Local Audrey data stays on this device.');
  }

  function currentUser() {
    return cloudSession?.user || null;
  }

  async function ensureProfile(user) {
    const { error } = await cloud.from('profiles').upsert({
      user_id: user.id,
      display_name: 'Audrey',
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }

  async function syncCriteria(user) {
    const { data: remote, error } = await cloud.from('search_criteria').select('*').eq('user_id', user.id).maybeSingle();
    if (error) throw error;

    if (!remote) {
      const { error: insertError } = await cloud.from('search_criteria').insert({ user_id: user.id, ...currentLocalCriteria() });
      if (insertError) throw insertError;
      return;
    }

    criteria = {
      minSalary: String(remote.min_salary ?? 0),
      location: remote.location_preference || 'All locations',
      tracks: Array.isArray(remote.active_tracks) ? remote.active_tracks : ['A','B','C']
    };
    saveJSON(PREFIX + 'criteria', criteria);
    applyCriteriaToUI();
    renderAll();
  }

  async function pushCriteria() {
    const user = currentUser();
    if (!user) return;
    const { error } = await cloud.from('search_criteria').upsert({
      user_id: user.id,
      ...currentLocalCriteria(),
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }

  async function syncJobStates(user) {
    const { data: remote, error } = await cloud.from('job_states').select('*').eq('user_id', user.id);
    if (error) throw error;

    if (!remote?.length) {
      const rows = Object.entries(statuses).filter(([, status]) => status).map(([jobId, status]) => ({
        user_id: user.id,
        job_id: jobId,
        status,
        job_snapshot: trackedJobs[jobId] || jobById(jobId) || {},
        updated_at: new Date().toISOString()
      }));
      if (rows.length) {
        const { error: upsertError } = await cloud.from('job_states').upsert(rows);
        if (upsertError) throw upsertError;
      }
      return;
    }

    for (const row of remote) {
      statuses[row.job_id] = row.status;
      if (row.job_snapshot && Object.keys(row.job_snapshot).length) trackedJobs[row.job_id] = row.job_snapshot;
    }
    saveJSON(PREFIX + 'statuses', statuses);
    saveJSON(PREFIX + 'tracked_jobs', trackedJobs);
    renderAll();
  }

  async function pushJobState(jobId) {
    const user = currentUser();
    if (!user) return;
    const status = statuses[jobId] || '';
    if (!status) {
      const { error } = await cloud.from('job_states').delete().eq('user_id', user.id).eq('job_id', jobId);
      if (error) throw error;
      return;
    }
    const snapshot = trackedJobs[jobId] || jobById(jobId) || {};
    const { error } = await cloud.from('job_states').upsert({
      user_id: user.id,
      job_id: jobId,
      status,
      job_snapshot: snapshot,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    if (status === 'applied') await pushApplication(jobId);
  }

  async function syncApplications(user) {
    const { data: remote, error } = await cloud.from('applications').select('*').eq('user_id', user.id);
    if (error) throw error;

    if (!remote?.length) {
      const rows = Object.entries(applicationDetails).map(([jobId, d]) => ({
        user_id: user.id,
        job_id: jobId,
        applied_at: d.appliedAt || todayISO(),
        stage: d.stage || 'Applied',
        notes: d.notes || '',
        resume_slot: (trackedJobs[jobId] || jobById(jobId) || {}).resume || null,
        job_snapshot: trackedJobs[jobId] || jobById(jobId) || {},
        updated_at: new Date().toISOString()
      }));
      if (rows.length) {
        const { error: upsertError } = await cloud.from('applications').upsert(rows);
        if (upsertError) throw upsertError;
      }
      return;
    }

    for (const row of remote) {
      applicationDetails[row.job_id] = {
        appliedAt: row.applied_at,
        stage: row.stage,
        notes: row.notes || ''
      };
      if (row.job_snapshot && Object.keys(row.job_snapshot).length) trackedJobs[row.job_id] = row.job_snapshot;
      statuses[row.job_id] = 'applied';
    }
    saveJSON(PREFIX + 'application_details', applicationDetails);
    saveJSON(PREFIX + 'tracked_jobs', trackedJobs);
    saveJSON(PREFIX + 'statuses', statuses);
    renderAll();
  }

  async function pushApplication(jobId) {
    const user = currentUser();
    if (!user) return;
    const d = applicationDetails[jobId];
    if (!d) return;
    const snapshot = trackedJobs[jobId] || jobById(jobId) || {};
    const { error } = await cloud.from('applications').upsert({
      user_id: user.id,
      job_id: jobId,
      applied_at: d.appliedAt || todayISO(),
      stage: d.stage || 'Applied',
      notes: d.notes || '',
      resume_slot: snapshot.resume || null,
      job_snapshot: snapshot,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }

  async function uploadResume(slot, file) {
    const user = currentUser();
    if (!user || !file) return;

    const { data: prior, error: priorError } = await cloud.from('resume_metadata').select('storage_path').eq('user_id', user.id).eq('slot', slot).maybeSingle();
    if (priorError) throw priorError;

    const path = `${user.id}/${slot}/${Date.now()}-${safeName(file.name)}`;
    const { error: uploadError } = await cloud.storage.from(cfg.resumeBucket).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined
    });
    if (uploadError) throw uploadError;

    const { error: metadataError } = await cloud.from('resume_metadata').upsert({
      user_id: user.id,
      slot,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size || null,
      updated_at: new Date().toISOString()
    });
    if (metadataError) throw metadataError;
    if (prior?.storage_path && prior.storage_path !== path) {
      const { error: removeError } = await cloud.storage.from(cfg.resumeBucket).remove([prior.storage_path]);
      if (removeError) console.warn('Old Audrey resume cleanup failed', removeError);
    }
  }

  async function removeCloudResume(slot) {
    const user = currentUser();
    if (!user) return;
    const { data, error } = await cloud.from('resume_metadata').select('storage_path').eq('user_id', user.id).eq('slot', slot).maybeSingle();
    if (error) throw error;
    if (data?.storage_path) {
      const { error: removeError } = await cloud.storage.from(cfg.resumeBucket).remove([data.storage_path]);
      if (removeError) throw removeError;
    }
    const { error: metaError } = await cloud.from('resume_metadata').delete().eq('user_id', user.id).eq('slot', slot);
    if (metaError) throw metaError;
  }

  async function syncResumes(user) {
    const { data: metadata, error } = await cloud.from('resume_metadata').select('*').eq('user_id', user.id);
    if (error) throw error;
    const remoteBySlot = Object.fromEntries((metadata || []).map(row => [row.slot, row]));

    for (const slot of ['A','B','C']) {
      const local = await getResume(slot).catch(() => null);
      const remote = remoteBySlot[slot];

      if (local && !remote) {
        const file = local.blob instanceof File ? local.blob : new File([local.blob], local.name, { type: local.type || 'application/octet-stream' });
        await uploadResume(slot, file);
        continue;
      }

      if (!local && remote) {
        const { data: blob, error: downloadError } = await cloud.storage.from(cfg.resumeBucket).download(remote.storage_path);
        if (downloadError) throw downloadError;
        const file = new File([blob], remote.file_name, { type: remote.mime_type || blob.type || 'application/octet-stream' });
        await putResume(slot, file);
        continue;
      }

      if (local && remote) {
        const remoteTime = new Date(remote.updated_at || 0).getTime();
        const localTime = new Date(local.updatedAt || 0).getTime();
        if (remoteTime > localTime) {
          const { data: blob, error: downloadError } = await cloud.storage.from(cfg.resumeBucket).download(remote.storage_path);
          if (downloadError) throw downloadError;
          const file = new File([blob], remote.file_name, { type: remote.mime_type || blob.type || 'application/octet-stream' });
          await putResume(slot, file);
        } else if (localTime > remoteTime) {
          const file = local.blob instanceof File ? local.blob : new File([local.blob], local.name, { type: local.type || 'application/octet-stream' });
          await uploadResume(slot, file);
        }
      }
    }
    await refreshResumeLibrary();
  }

  async function fullSync({ manual = false, firstLogin = false } = {}) {
    if (!cloudSession || syncBusy) return;
    syncBusy = true;
    try {
      setSyncMessage('Syncing…');
      const user = cloudSession.user;
      await ensureProfile(user);
      await syncCriteria(user);
      await syncJobStates(user);
      await syncApplications(user);
      await syncResumes(user);
      localStorage.setItem(PREFIX + 'last_cloud_sync', new Date().toISOString());
      setSyncMessage(manual ? 'Everything is synced.' : firstLogin ? 'This device is synced to Audrey\'s account.' : 'Synced.');
    } catch (err) {
      console.error('Audrey cloud sync failed', err);
      setSyncMessage(`Sync failed: ${err.message}`, true);
    } finally {
      syncBusy = false;
    }
  }

  document.getElementById('saveCriteria')?.addEventListener('click', () => {
    if (cloudSession) setTimeout(() => pushCriteria().catch(err => setSyncMessage(`Sync issue: ${err.message}`, true)), 0);
  });

  document.addEventListener('click', e => {
    const button = e.target.closest?.('[data-job][data-status]');
    if (button && cloudSession) {
      setTimeout(() => pushJobState(button.dataset.job).catch(err => setSyncMessage(`Sync issue: ${err.message}`, true)), 0);
    }
    const remove = e.target.closest?.('.resume-remove[data-resume-slot]');
    if (remove && cloudSession) {
      setTimeout(() => removeCloudResume(remove.dataset.resumeSlot).catch(err => setSyncMessage(`Sync issue: ${err.message}`, true)), 0);
    }
  });

  document.addEventListener('change', e => {
    const card = e.target.closest?.('.application-card[data-application-id]');
    if (card && cloudSession) {
      setTimeout(() => pushApplication(card.dataset.applicationId).catch(err => setSyncMessage(`Sync issue: ${err.message}`, true)), 0);
    }
    if (e.target.matches?.('.resume-file-input[data-resume-slot]') && cloudSession) {
      const file = e.target.files?.[0];
      if (file) uploadResume(e.target.dataset.resumeSlot, file).catch(err => setSyncMessage(`Resume sync issue: ${err.message}`, true));
    }
  });

  document.addEventListener('blur', e => {
    const card = e.target.closest?.('.application-card[data-application-id]');
    if (card && cloudSession) {
      setTimeout(() => pushApplication(card.dataset.applicationId).catch(err => setSyncMessage(`Sync issue: ${err.message}`, true)), 0);
    }
  }, true);

  async function initCloud() {
    injectSyncPanel();
    const { data, error } = await cloud.auth.getSession();
    if (error) console.warn('Audrey session read failed', error);
    cloudSession = data?.session || null;
    renderCloudAuth();

    cloud.auth.onAuthStateChange((_event, session) => {
      cloudSession = session;
      renderCloudAuth();
      if (session && (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION')) {
        setTimeout(() => fullSync(), 0);
      }
    });

    if (cloudSession) await fullSync();
  }

  initCloud();
})();
