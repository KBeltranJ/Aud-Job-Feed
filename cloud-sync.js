(() => {
  const cfg = window.AUDREY_SUPABASE;
  const lib = window.supabase;
  const cloudStatus = document.getElementById('cloudStatus');
  const googleBtn = document.getElementById('googleSignInBtn');
  const signOutBtn = document.getElementById('signOutBtn');

  if (!cfg || !lib?.createClient) {
    if (cloudStatus) cloudStatus.textContent = 'Cloud unavailable · local mode only';
    return;
  }

  const client = lib.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.audreySupabase = client;

  const safeName = name => String(name || 'resume').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
  const currentLocalCriteria = () => ({
    min_salary: Number(criteria?.minSalary || 0),
    location_preference: criteria?.location || 'All locations',
    active_tracks: Array.isArray(criteria?.tracks) ? criteria.tracks : ['A','B','C']
  });

  function setCloudStatus(message) {
    if (cloudStatus) cloudStatus.textContent = message;
  }

  async function getUser() {
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return data.user || null;
  }

  async function updateAuthUI() {
    const user = await getUser();
    if (user) {
      googleBtn?.classList.add('hidden');
      signOutBtn?.classList.remove('hidden');
      setCloudStatus(`Private sync on · ${user.email || 'signed in'}`);
    } else {
      googleBtn?.classList.remove('hidden');
      signOutBtn?.classList.add('hidden');
      setCloudStatus('Audrey-only cloud ready · sign in with Google to sync');
    }
    return user;
  }

  async function signInWithGoogle() {
    setCloudStatus('Opening Google sign-in…');
    const redirectTo = window.location.href.split('#')[0].split('?')[0];
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
    if (error) {
      console.error('Audrey Google sign-in failed', error);
      setCloudStatus('Google sign-in is not configured yet');
    }
  }

  async function ensureProfile(user) {
    const displayName = user.user_metadata?.full_name || user.user_metadata?.name || 'Audrey';
    const { error } = await client.from('profiles').upsert({
      user_id: user.id,
      display_name: displayName,
      updated_at: new Date().toISOString()
    });
    if (error) console.warn('Profile sync failed', error);
  }

  async function syncCriteria(user) {
    const { data: remote, error } = await client.from('search_criteria').select('*').eq('user_id', user.id).maybeSingle();
    if (error) { console.warn('Criteria read failed', error); return; }

    if (!remote) {
      const seed = currentLocalCriteria();
      const { error: insertError } = await client.from('search_criteria').insert({ user_id: user.id, ...seed });
      if (insertError) console.warn('Criteria seed failed', insertError);
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
    const user = await getUser();
    if (!user) return;
    const { error } = await client.from('search_criteria').upsert({
      user_id: user.id,
      ...currentLocalCriteria(),
      updated_at: new Date().toISOString()
    });
    if (error) console.warn('Criteria cloud save failed', error);
  }

  async function syncJobStates(user) {
    const { data: remote, error } = await client.from('job_states').select('*').eq('user_id', user.id);
    if (error) { console.warn('Job state read failed', error); return; }

    if (!remote?.length) {
      const rows = Object.entries(statuses).filter(([,status]) => status).map(([jobId,status]) => ({
        user_id: user.id,
        job_id: jobId,
        status,
        job_snapshot: trackedJobs[jobId] || jobById(jobId) || {},
        updated_at: new Date().toISOString()
      }));
      if (rows.length) {
        const { error: upsertError } = await client.from('job_states').upsert(rows);
        if (upsertError) console.warn('Job state seed failed', upsertError);
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
    const user = await getUser();
    if (!user) return;
    const status = statuses[jobId] || '';
    if (!status) {
      await client.from('job_states').delete().eq('user_id', user.id).eq('job_id', jobId);
      return;
    }
    const snapshot = trackedJobs[jobId] || jobById(jobId) || {};
    const { error } = await client.from('job_states').upsert({
      user_id: user.id,
      job_id: jobId,
      status,
      job_snapshot: snapshot,
      updated_at: new Date().toISOString()
    });
    if (error) console.warn('Job state cloud save failed', error);
    if (status === 'applied') await pushApplication(jobId);
  }

  async function syncApplications(user) {
    const { data: remote, error } = await client.from('applications').select('*').eq('user_id', user.id);
    if (error) { console.warn('Applications read failed', error); return; }

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
        const { error: upsertError } = await client.from('applications').upsert(rows);
        if (upsertError) console.warn('Applications seed failed', upsertError);
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
    const user = await getUser();
    if (!user) return;
    const d = applicationDetails[jobId];
    if (!d) return;
    const snapshot = trackedJobs[jobId] || jobById(jobId) || {};
    const { error } = await client.from('applications').upsert({
      user_id: user.id,
      job_id: jobId,
      applied_at: d.appliedAt || todayISO(),
      stage: d.stage || 'Applied',
      notes: d.notes || '',
      resume_slot: snapshot.resume || null,
      job_snapshot: snapshot,
      updated_at: new Date().toISOString()
    });
    if (error) console.warn('Application cloud save failed', error);
  }

  async function uploadResume(slot, file) {
    const user = await getUser();
    if (!user || !file) return;

    const { data: prior } = await client.from('resume_metadata').select('storage_path').eq('user_id', user.id).eq('slot', slot).maybeSingle();
    const path = `${user.id}/${slot}/${Date.now()}-${safeName(file.name)}`;
    const { error: uploadError } = await client.storage.from(cfg.resumeBucket).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined
    });
    if (uploadError) { console.warn('Resume upload failed', uploadError); return; }

    const { error: metadataError } = await client.from('resume_metadata').upsert({
      user_id: user.id,
      slot,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size || null,
      updated_at: new Date().toISOString()
    });
    if (metadataError) console.warn('Resume metadata save failed', metadataError);
    if (prior?.storage_path && prior.storage_path !== path) await client.storage.from(cfg.resumeBucket).remove([prior.storage_path]);
  }

  async function removeCloudResume(slot) {
    const user = await getUser();
    if (!user) return;
    const { data } = await client.from('resume_metadata').select('storage_path').eq('user_id', user.id).eq('slot', slot).maybeSingle();
    if (data?.storage_path) await client.storage.from(cfg.resumeBucket).remove([data.storage_path]);
    await client.from('resume_metadata').delete().eq('user_id', user.id).eq('slot', slot);
  }

  async function hydrateCloudResumes(user) {
    const { data: metadata, error } = await client.from('resume_metadata').select('*').eq('user_id', user.id);
    if (error) { console.warn('Resume metadata read failed', error); return; }

    for (const slot of ['A','B','C']) {
      const remote = metadata?.find(r => r.slot === slot);
      const local = await getResume(slot).catch(() => null);
      if (remote && !local) {
        const { data: blob, error: downloadError } = await client.storage.from(cfg.resumeBucket).download(remote.storage_path);
        if (!downloadError && blob) {
          const file = new File([blob], remote.file_name, { type: remote.mime_type || blob.type || 'application/octet-stream' });
          await putResume(slot, file);
        }
      } else if (!remote && local?.blob) {
        const file = local.blob instanceof File ? local.blob : new File([local.blob], local.name, { type: local.type });
        await uploadResume(slot, file);
      }
    }
    await refreshResumeLibrary();
  }

  async function fullSync() {
    const user = await updateAuthUI();
    if (!user) return;
    setCloudStatus('Private sync in progress…');
    await ensureProfile(user);
    await syncCriteria(user);
    await syncJobStates(user);
    await syncApplications(user);
    await hydrateCloudResumes(user);
    setCloudStatus(`Private sync on · ${user.email || 'signed in'}`);
  }

  googleBtn?.addEventListener('click', signInWithGoogle);
  signOutBtn?.addEventListener('click', async () => {
    await client.auth.signOut();
    await updateAuthUI();
  });

  document.getElementById('saveCriteria')?.addEventListener('click', () => setTimeout(pushCriteria, 0));
  document.addEventListener('click', e => {
    const button = e.target.closest?.('[data-job][data-status]');
    if (button) setTimeout(() => pushJobState(button.dataset.job), 0);
    const remove = e.target.closest?.('.resume-remove[data-resume-slot]');
    if (remove) setTimeout(() => removeCloudResume(remove.dataset.resumeSlot), 0);
  });
  document.addEventListener('change', e => {
    const card = e.target.closest?.('.application-card[data-application-id]');
    if (card) setTimeout(() => pushApplication(card.dataset.applicationId), 0);
    if (e.target.matches?.('.resume-file-input[data-resume-slot]')) {
      const file = e.target.files?.[0];
      if (file) uploadResume(e.target.dataset.resumeSlot, file);
    }
  });
  document.addEventListener('blur', e => {
    const card = e.target.closest?.('.application-card[data-application-id]');
    if (card) setTimeout(() => pushApplication(card.dataset.applicationId), 0);
  }, true);

  client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') fullSync();
    if (event === 'SIGNED_OUT') updateAuthUI();
  });

  updateAuthUI().then(user => { if (user) fullSync(); });
})();
