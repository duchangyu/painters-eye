import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createAdaptiveCalibrationSession } from "../calibration/adaptiveSession";
import {
  assessQuickCheck,
  createQuickCheckTrials,
  quickCheckRequirement,
  toQuickCheckResponse,
  type QuickCheckAssessment,
  type QuickCheckResponse,
} from "../calibration/quickCheck";
import {
  assessScreening,
  createScreeningTrials,
  toScreeningResponse,
  type ScreeningOutcome,
  type ScreeningResponse,
} from "../calibration/screening";
import type { DisplayConditions, TrialResponse } from "../domain/calibration";
import type { CalibrationProfileV1 } from "../domain/profile";
import type { ProfileValidationSummary } from "../domain/profile";
import { buildCompensationLut, generateLut } from "../color/lut";
import { findPreset, getPresetCompensation } from "../color/presets";
import {
  CalibrationScreen,
  type CalibrationAnswer,
  type CalibrationEngine,
} from "../components/calibration/CalibrationScreen";
import { GalleryScreen } from "../components/gallery/GalleryScreen";
import { IntroScreen } from "../components/intro/IntroScreen";
import { ProfileSettings } from "../components/profile/ProfileSettings";
import { ResultsScreen } from "../components/results/ResultsScreen";
import { ScreeningResult } from "../components/screening/ScreeningResult";
import { DisplaySetup } from "../components/setup/DisplaySetup";
import { ArtworkViewer, type ViewerDisplayState } from "../components/viewer/ArtworkViewer";
import { ARTWORKS, findArtwork, toUserArtworkRecord, type ArtworkRecord } from "../data/artworks";
import {
  calculateRepeatConsistency,
  fitProfile,
  type FittedBehavioralProfile,
} from "../profile/fitProfile";
import type { StoredImage } from "../storage/db";
import {
  createImageRepository,
  MAX_IMAGE_BYTES,
} from "../storage/imageRepository";
import {
  createDisplayFingerprint,
  createProfileRepository,
} from "../storage/profileRepository";
import {
  summarizeValidation,
  type ValidationMetrics,
  type ValidationResponse,
} from "../validation/metrics";
import {
  createValidationSession,
  toPublicValidationTrial,
} from "../validation/validationSession";
import {
  CALIBRATION_SCHEDULE_VERSION,
  clearCalibrationDraft,
  loadCalibrationDraft,
  removeLocalStorage,
  saveCalibrationDraft,
  writeLocalStorage,
  type StoredCalibrationDraft,
} from "./calibrationDraft";
import { useAppFlow } from "./useAppFlow";
import { isE2eMode } from "../config/runtime";

const SELECTED_ARTWORK_KEY = "color-master:selected-artwork";
const PRESET_KEY = "painters-eye:preset";
const E2E_ENTRY_KEY = "painters-eye:e2e-entry";

function loadStoredPresetId(): string | null {
  const stored = globalThis.window?.localStorage?.getItem(PRESET_KEY);
  return stored && findPreset(stored) ? stored : null;
}

function profileValidationSummary(
  metrics: ValidationMetrics,
): ProfileValidationSummary {
  return {
    passed: metrics.passed,
    personalizedAccuracy: metrics.byCondition.personalized.accuracy,
    originalAccuracy: metrics.byCondition.original.accuracy,
    genericAccuracy: metrics.byCondition.generic.accuracy,
    medianReactionTimeMs: metrics.byCondition.personalized.medianReactionTimeMs,
    originalMedianReactionTimeMs:
      metrics.byCondition.original.medianReactionTimeMs,
    genericMedianReactionTimeMs:
      metrics.byCondition.generic.medianReactionTimeMs,
    personalizedMedianReactionTimeMs:
      metrics.byCondition.personalized.medianReactionTimeMs,
    originalControlAccuracy: metrics.byCondition.original.controlAccuracy,
    personalizedControlAccuracy:
      metrics.byCondition.personalized.controlAccuracy,
    repeatConsistency: metrics.repeatConsistency,
  };
}

export function AppFlow() {
  const flow = useAppFlow();
  const [calibrationDraft, setCalibrationDraft] =
    useState<StoredCalibrationDraft | null>(loadCalibrationDraft);
  const responses = useRef<TrialResponse[]>([]);
  const validationResponses = useRef<ValidationResponse[]>([]);
  const quickCheckResponses = useRef<QuickCheckResponse[]>([]);
  const screeningResponses = useRef<ScreeningResponse[]>([]);
  const userImageUrls = useRef(new Map<string, string>());
  const [userImages, setUserImages] = useState<readonly ArtworkRecord[]>([]);
  const [profile, setProfile] = useState<FittedBehavioralProfile | null>(null);
  const [activeProfile, setActiveProfile] =
    useState<CalibrationProfileV1 | null>(null);
  const [metrics, setMetrics] = useState<ValidationMetrics | null>(null);
  const [quickCheckResult, setQuickCheckResult] =
    useState<QuickCheckAssessment | null>(null);
  const [originalOnly, setOriginalOnly] = useState(false);
  const [calibrationRun, setCalibrationRun] = useState(0);
  const [validationRun, setValidationRun] = useState(0);
  const [presetId, setPresetId] = useState<string | null>(loadStoredPresetId);
  const [screeningRun, setScreeningRun] = useState(0);
  const [screeningOutcome, setScreeningOutcome] =
    useState<ScreeningOutcome | null>(null);
  const [selectedArtwork, setSelectedArtwork] = useState<ArtworkRecord | null>(
    null,
  );
  // Display mode carries across artworks so switching paintings never resets
  // the user's enhancement/zoom setup.
  const [viewerDisplay, setViewerDisplay] = useState<ViewerDisplayState>({
    enhanced: false,
    strength: 0,
    split: false,
    zoom: 1,
  });

  // Skip the intro for returning users who have already seen it and have no
  // saved display conditions to restore. If display conditions exist, the
  // restore effect below will route directly to setup/gallery/quick-check; if
  // only a fast-track preset exists, skip straight to the gallery.
  // Runs once per session: `flow` changes identity on every render, so an
  // unguarded effect would keep forcing the phase back to "setup".
  const introSkipHandled = useRef(false);
  useEffect(() => {
    if (introSkipHandled.current) return;
    introSkipHandled.current = true;
    const browserStorage = globalThis.window?.localStorage;
    if (isE2eMode) {
      const e2ePreset = browserStorage?.getItem(PRESET_KEY);
      if (e2ePreset && findPreset(e2ePreset)) {
        flow.openGallery();
      } else if (browserStorage?.getItem(E2E_ENTRY_KEY) === "quick") {
        flow.beginScreening();
      } else {
        flow.beginSetup();
      }
      return;
    }
    if (!browserStorage) return;
    if (browserStorage.getItem("color-master:display-conditions")) return;
    const storedPreset = browserStorage.getItem(PRESET_KEY);
    if (storedPreset && findPreset(storedPreset)) {
      flow.openGallery();
      return;
    }
    if (browserStorage.getItem("painters-eye:seen-intro") === "1") {
      flow.beginSetup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calibrationSeed =
    calibrationRun === 0 && calibrationDraft
      ? calibrationDraft.seed
      : 20260810 + calibrationRun;
  const calibration = useMemo(() => {
    const session = createAdaptiveCalibrationSession({
      seed: calibrationSeed,
      ...(isE2eMode ? { trialsPerAxis: 1, repeatCount: 0 } : {}),
    });
    let replayed: readonly TrialResponse[] | null = null;
    if (calibrationRun === 0 && calibrationDraft) {
      const results = calibrationDraft.responses
        .slice(0, calibrationDraft.completedTrials)
        .map((response) =>
          session.recordAnswer({
            trialId: response.id,
            selectedDirection: response.selectedDirection,
            reactionTimeMs: response.reactionTimeMs,
          }),
        );
      // A mismatch means the schedule drifted from the draft (should not
      // happen past the loader's id/version checks): drop the draft rather
      // than fit on mismatched evidence.
      replayed = results.some((response) => response === undefined)
        ? null
        : (results as TrialResponse[]);
    }
    return { session, replayed };
  }, [calibrationDraft, calibrationRun, calibrationSeed]);
  const calibrationSession = calibration.session;
  // Sync restored responses into the ref after render (refs must not be
  // written during render). Runs before paint, so no answer can precede it.
  useLayoutEffect(() => {
    if (calibration.replayed) {
      responses.current = [...calibration.replayed];
    } else if (calibrationRun === 0 && calibrationDraft) {
      clearCalibrationDraft();
      responses.current = [];
    }
  }, [calibration, calibrationDraft, calibrationRun]);
  const schedule = calibrationSession.scheduledTrials;
  const engine = useMemo<CalibrationEngine>(() => {
    return {
      get trials() {
        return calibrationSession.trials;
      },
      recordAnswer(answer: CalibrationAnswer) {
        const response = calibrationSession.recordAnswer(answer);
        if (response) responses.current.push(response);
      },
      saveDraft(completedTrials: number) {
        saveCalibrationDraft({
          version: CALIBRATION_SCHEDULE_VERSION,
          seed: calibrationSeed,
          completedTrials,
          responses: responses.current,
        });
      },
    };
  }, [calibrationSeed, calibrationSession]);
  const validationTrials = useMemo(
    () =>
      profile
        ? createValidationSession({
            seed: 20260811 + validationRun * 977,
            personalized: profile,
            thresholds: profile.thresholds,
            excludedSeeds: schedule.map((trial) => trial.stimulus.seed),
            ...(isE2eMode ? { trialsPerCondition: 4 } : {}),
          })
        : [],
    [profile, schedule, validationRun],
  );
  const validationEngine = useMemo<CalibrationEngine>(() => {
    const trialsById = new Map(
      validationTrials.map((trial) => [trial.id, trial]),
    );
    return {
      trials: validationTrials.map(toPublicValidationTrial),
      recordAnswer(answer: CalibrationAnswer) {
        const trial = trialsById.get(answer.trialId);
        if (!trial) {
          return;
        }
        validationResponses.current.push({
          condition: trial.condition,
          axis: trial.stimulus.axis,
          correct: answer.selectedDirection === trial.stimulus.direction,
          reactionTimeMs: answer.reactionTimeMs,
        });
      },
      saveDraft(completedTrials: number) {
        writeLocalStorage(
          "color-master:validation-draft",
          JSON.stringify({
            completedTrials,
            responses: validationResponses.current,
          }),
        );
      },
    };
  }, [validationTrials]);
  const validationTestConditions = useMemo(
    () => new Map(validationTrials.map((trial) => [trial.id, trial.condition])),
    [validationTrials],
  );
  const quickCheckTrials = useMemo(
    () =>
      activeProfile ? createQuickCheckTrials(activeProfile, 20260812) : [],
    [activeProfile],
  );
  const quickCheckEngine = useMemo<CalibrationEngine>(() => {
    const trialsById = new Map(
      quickCheckTrials.map((trial) => [trial.id, trial]),
    );
    return {
      trials: quickCheckTrials,
      recordAnswer(answer: CalibrationAnswer) {
        const trial = trialsById.get(answer.trialId);
        if (!trial) return;
        quickCheckResponses.current.push(
          toQuickCheckResponse(trial, {
            selectedDirection: answer.selectedDirection,
          }),
        );
      },
      saveDraft(completedTrials: number) {
        writeLocalStorage(
          "color-master:quick-check-draft",
          JSON.stringify({
            completedTrials,
            responses: quickCheckResponses.current,
          }),
        );
      },
    };
  }, [quickCheckTrials]);
  const screeningTrials = useMemo(
    () => createScreeningTrials(20260813 + screeningRun * 31),
    [screeningRun],
  );
  const screeningEngine = useMemo<CalibrationEngine>(() => {
    const trialsById = new Map(
      screeningTrials.map((trial) => [trial.id, trial]),
    );
    return {
      trials: screeningTrials,
      recordAnswer(answer: CalibrationAnswer) {
        const trial = trialsById.get(answer.trialId);
        if (!trial) return;
        screeningResponses.current.push(toScreeningResponse(trial, answer));
      },
      saveDraft() {
        // The fast track is 8 trials — shorter than the time it takes to
        // decide whether to resume a draft. No draft on purpose.
      },
    };
  }, [screeningTrials]);
  const screeningAxisByTrialId = useMemo(
    () => new Map(screeningTrials.map((trial) => [trial.id, trial.stimulus.axis])),
    [screeningTrials],
  );
  const presetCompensation = useMemo(
    () => (presetId ? getPresetCompensation(presetId) : null),
    [presetId],
  );
  const viewerLut = useMemo(
    () =>
      originalOnly
        ? generateLut(2, (color) => color)
        : activeProfile
          ? buildCompensationLut(activeProfile.compensation)
          : profile
            ? buildCompensationLut(profile)
            : presetCompensation
              ? buildCompensationLut(presetCompensation)
              : generateLut(2, (color) => color),
    [activeProfile, originalOnly, presetCompensation, profile],
  );

  const restoreProfile = flow.restoreProfile;
  const resumeCalibration = flow.resumeCalibration;
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const browserStorage = globalThis.window?.localStorage;
      if (!browserStorage) return;
      const serialized = browserStorage.getItem(
        "color-master:display-conditions",
      );
      if (!serialized) return;
      let conditions: DisplayConditions;
      try {
        conditions = JSON.parse(serialized) as DisplayConditions;
      } catch {
        return;
      }
      const fingerprint = createDisplayFingerprint(conditions);
      const repository = await createProfileRepository();
      try {
        const exact = await repository.loadActiveProfile(fingerprint);
        const candidate = exact ?? (await repository.loadMostRecentProfile());
        if (cancelled) return;
        if (!candidate) {
          if (
            calibrationDraft &&
            calibrationDraft.completedTrials < calibrationSession.trials.length
          ) {
            resumeCalibration(conditions);
          }
          return;
        }
        const requirement = quickCheckRequirement({
          profile: candidate,
          currentDisplayFingerprint: fingerprint,
          lastCheckedAt: browserStorage.getItem(
            `color-master:quick-check:${candidate.id}`,
          ),
        });
        // A saved personal profile always wins over a fast-track preset.
        removeLocalStorage(PRESET_KEY);
        setPresetId(null);
        setActiveProfile(candidate);
        const rememberedArtwork = findArtwork(
          browserStorage.getItem(SELECTED_ARTWORK_KEY) ?? "",
        );
        if (rememberedArtwork) setSelectedArtwork(rememberedArtwork);
        restoreProfile(conditions, requirement !== "not-due");
      } finally {
        repository.close();
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [
    calibrationDraft,
    calibrationSession.trials.length,
    restoreProfile,
    resumeCalibration,
  ]);

  // Loads the user's locally stored images once at startup and restores a
  // remembered personal image if one was open when the page was closed.
  useEffect(() => {
    let cancelled = false;

    async function loadUserImages() {
      const repository = await createImageRepository();
      let stored: readonly StoredImage[];
      try {
        stored = await repository.listImages();
      } finally {
        repository.close();
      }
      if (cancelled) return;
      const records = stored.map(registerUserImage);
      setUserImages(records);
      const rememberedId = globalThis.window?.localStorage.getItem(
        SELECTED_ARTWORK_KEY,
      );
      if (rememberedId?.startsWith("personal-")) {
        const remembered = records.find((record) => record.id === rememberedId);
        if (remembered) setSelectedArtwork(remembered);
      }
    }

    void loadUserImages();
    return () => {
      cancelled = true;
    };
     
  }, []);

  useEffect(
    () => () => {
      for (const url of userImageUrls.current.values()) {
        URL.revokeObjectURL(url);
      }
      userImageUrls.current.clear();
    },
    [],
  );

  function completeCalibration() {
    clearCalibrationDraft();
    setCalibrationDraft(null);
    setProfile(fitProfile(responses.current, calibrationSession.staircases()));
    flow.beginValidation();
  }

  function completeValidation() {
    setMetrics(
      summarizeValidation(
        validationResponses.current,
        calculateRepeatConsistency(responses.current),
      ),
    );
    flow.showResults();
  }

  async function saveProfileAndContinue() {
    if (!profile || !metrics || !flow.displayConditions) {
      return;
    }

    if (metrics.passed) {
      const createdAt = new Date().toISOString();
      const value: CalibrationProfileV1 = {
        schemaVersion: 1,
        id: `profile-${createdAt}`,
        algorithmVersion: "1.1.0-mvp-adaptive",
        createdAt,
        displayFingerprint: createDisplayFingerprint(flow.displayConditions),
        displayConditions: flow.displayConditions,
        sourceSessionId: "local-calibration-session",
        rawTrials: responses.current,
        thresholds: profile.thresholds,
        compensation: profile,
        confidence: profile.confidence,
        validation: profileValidationSummary(metrics),
        lut: buildCompensationLut(profile),
      };
      const repository = await createProfileRepository();
      try {
        await repository.promoteValidatedProfile(value);
        setActiveProfile(value);
        setOriginalOnly(false);
        // The personalized profile replaces any fast-track preset for good.
        removeLocalStorage(PRESET_KEY);
        setPresetId(null);
        writeLocalStorage(`color-master:quick-check:${value.id}`, createdAt);
      } finally {
        repository.close();
      }
    } else {
      setOriginalOnly(true);
    }
    flow.openGallery();
  }

  function handleDisplaySetup(conditions: DisplayConditions) {
    if (!activeProfile) {
      clearCalibrationDraft();
      setCalibrationDraft(null);
      responses.current = [];
      validationResponses.current = [];
      flow.beginCalibration(conditions);
      return;
    }
    quickCheckResponses.current = [];
    setQuickCheckResult(null);
    flow.beginQuickCheck(conditions);
  }

  async function completeQuickCheck() {
    if (!activeProfile || !flow.displayConditions) return;
    const result = assessQuickCheck(activeProfile, quickCheckResponses.current);
    setQuickCheckResult(result);
    if (result.status !== "pass") {
      // Record the attempt even on failure: without a timestamp the next
      // launch forces the same check again forever.
      writeLocalStorage(
        `color-master:quick-check:${activeProfile.id}`,
        new Date().toISOString(),
      );
      flow.showQuickCheckResult();
      return;
    }

    const fingerprint = createDisplayFingerprint(flow.displayConditions);
    const verifiedProfile: CalibrationProfileV1 = {
      ...activeProfile,
      id:
        fingerprint === activeProfile.displayFingerprint
          ? activeProfile.id
          : `${activeProfile.id}-display-${Date.now()}`,
      displayFingerprint: fingerprint,
      displayConditions: flow.displayConditions,
    };
    const checkedAt = new Date().toISOString();
    const repository = await createProfileRepository();
    try {
      await repository.promoteValidatedProfile(verifiedProfile);
      setActiveProfile(verifiedProfile);
      setOriginalOnly(false);
      writeLocalStorage(
        `color-master:quick-check:${verifiedProfile.id}`,
        checkedAt,
      );
    } finally {
      repository.close();
    }
    flow.openGallery();
  }

  function startScreening() {
    screeningResponses.current = [];
    flow.beginScreening();
  }

  function retryScreening() {
    screeningResponses.current = [];
    setScreeningRun((value) => value + 1);
    flow.beginScreening();
  }

  function completeScreening() {
    const outcome = assessScreening(screeningResponses.current);
    setScreeningOutcome(outcome);
    if (outcome.kind === "preset") {
      setPresetId(outcome.presetId);
      writeLocalStorage(PRESET_KEY, outcome.presetId);
      setOriginalOnly(false);
    } else if (outcome.kind === "normal-vision") {
      // Nothing to enhance: keep the gallery in original-only mode so the
      // viewer does not offer a toggle that would do nothing.
      setOriginalOnly(true);
    }
    flow.showScreeningResult();
  }

  function restartCalibration() {
    if (!flow.displayConditions) return;
    responses.current = [];
    validationResponses.current = [];
    quickCheckResponses.current = [];
    setProfile(null);
    setMetrics(null);
    setQuickCheckResult(null);
    clearCalibrationDraft();
    setCalibrationDraft(null);
    setCalibrationRun((value) => value + 1);
    flow.beginCalibration(flow.displayConditions);
  }

  /**
   * Validation failures are usually noise, not a broken fit: the calibrated
   * profile stays, only the blind check is re-run with fresh stimuli (~2
   * minutes instead of a full recalibration).
   */
  function retryValidation() {
    validationResponses.current = [];
    removeLocalStorage("color-master:validation-draft");
    setMetrics(null);
    setValidationRun((value) => value + 1);
    flow.beginValidation();
  }

  async function importProfile(value: CalibrationProfileV1) {
    const repository = await createProfileRepository();
    try {
      await repository.promoteValidatedProfile(value);
    } finally {
      repository.close();
    }
    setActiveProfile(value);
    setOriginalOnly(false);
    // An imported profile must not bypass the display check: compare its
    // fingerprint against the current display and route through a quick
    // check whenever they differ (or the check is otherwise due).
    const currentFingerprint = flow.displayConditions
      ? createDisplayFingerprint(flow.displayConditions)
      : null;
    const requirement = currentFingerprint
      ? quickCheckRequirement({
          profile: value,
          currentDisplayFingerprint: currentFingerprint,
          lastCheckedAt:
            globalThis.window?.localStorage?.getItem(
              `color-master:quick-check:${value.id}`,
            ) ?? null,
        })
      : "display-changed";
    flow.restoreProfile(value.displayConditions, requirement !== "not-due");
  }

  function registerUserImage(stored: StoredImage): ArtworkRecord {
    const url = URL.createObjectURL(stored.blob);
    userImageUrls.current.set(stored.id, url);
    return toUserArtworkRecord(stored.id, stored.name, url);
  }

  async function persistUserImage(name: string, blob: Blob) {
    const stored: StoredImage = {
      id: `personal-${crypto.randomUUID()}`,
      name,
      blob,
      addedAt: new Date().toISOString(),
    };
    const repository = await createImageRepository();
    try {
      await repository.saveImage(stored);
    } finally {
      repository.close();
    }
    const record = registerUserImage(stored);
    setUserImages((current) => [...current, record]);
  }

  /** Returns an error message, or null when every file was accepted. */
  async function addUserFiles(files: readonly File[]): Promise<string | null> {
    const rejected: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        rejected.push(`${file.name}（不是图片）`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        rejected.push(`${file.name}（超过 20MB）`);
        continue;
      }
      await persistUserImage(file.name, file);
    }
    return rejected.length > 0 ? `已跳过：${rejected.join("、")}` : null;
  }

  /** Fetches an image URL into the local library. Returns error text or null. */
  async function addUserImageFromUrl(url: string): Promise<string | null> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return "这个链接看起来不完整，请检查后重试。";
    }
    try {
      const response = await fetch(parsed.href);
      if (!response.ok) {
        return `对方网站返回了错误（${response.status}），可以换个链接或下载后用文件上传。`;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) {
        return "这个链接指向的不是图片，可以下载后改用文件上传。";
      }
      const blob = await response.blob();
      if (blob.size > MAX_IMAGE_BYTES) {
        return "这张图片超过 20MB，建议先压缩再添加。";
      }
      const name =
        parsed.pathname.split("/").filter(Boolean).pop() ?? "网络图片";
      await persistUserImage(decodeURIComponent(name), blob);
      return null;
    } catch {
      return "无法读取这张图片：对方网站可能不允许跨域访问。可以下载后用文件上传。";
    }
  }

  function deleteUserImage(id: string) {
    const url = userImageUrls.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      userImageUrls.current.delete(id);
    }
    setUserImages((current) => current.filter((image) => image.id !== id));
    if (selectedArtwork?.id === id) {
      closeArtwork();
    }
    void createImageRepository().then(async (repository) => {
      try {
        await repository.deleteImage(id);
      } finally {
        repository.close();
      }
    });
  }

  function openArtwork(artwork: ArtworkRecord) {
    writeLocalStorage(SELECTED_ARTWORK_KEY, artwork.id);
    setSelectedArtwork(artwork);
  }

  function closeArtwork() {
    removeLocalStorage(SELECTED_ARTWORK_KEY);
    setSelectedArtwork(null);
  }

  const isPresetMode =
    !originalOnly && !activeProfile && presetCompensation !== null;
  const presetLabel = presetId ? findPreset(presetId)?.labelZh : undefined;

  if (flow.phase === "intro") {
    return (
      <IntroScreen
        onStartQuick={startScreening}
        onStartPrecise={flow.beginSetup}
      />
    );
  }
  if (flow.phase === "screening") {
    return (
      <CalibrationScreen
        key={`screening-${screeningRun}`}
        engine={screeningEngine}
        onComplete={completeScreening}
        eyebrow="快速体验 · 8 题"
        title="辨认开口方向"
        progressName="进度"
        note="看不清就凭第一感觉选。开始前请确认夜览、原彩和护眼滤镜都已关闭。"
        testConditionByTrialId={screeningAxisByTrialId}
      />
    );
  }
  if (flow.phase === "screening-result" && screeningOutcome) {
    return (
      <ScreeningResult
        outcome={screeningOutcome}
        onEnterGallery={flow.openGallery}
        onStartPrecise={flow.beginSetup}
        onRetry={retryScreening}
      />
    );
  }
  if (flow.phase === "setup") {
    return (
      <DisplaySetup
        onComplete={handleDisplaySetup}
        initialConditions={activeProfile?.displayConditions}
        mode={activeProfile ? "review" : "calibrate"}
      />
    );
  }
  if (flow.phase === "calibration") {
    return (
      <CalibrationScreen
        key="calibration"
        engine={engine}
        initialTrialIndex={
          calibrationRun === 0 ? calibrationDraft?.completedTrials : 0
        }
        onComplete={completeCalibration}
      />
    );
  }
  if (flow.phase === "validation") {
    return (
      <CalibrationScreen
        key={`validation-${validationRun}`}
        engine={validationEngine}
        onComplete={completeValidation}
        eyebrow="效果验证 · 条件已隐藏"
        title="再辨认一组新图形"
        progressName="验证进度"
        note="三种显示方式会随机出现；界面不会提示当前条件或正确答案。"
        testConditionByTrialId={validationTestConditions}
      />
    );
  }
  if (flow.phase === "results" && profile && metrics) {
    return (
      <ResultsScreen
        profile={profile}
        metrics={metrics}
        onContinue={saveProfileAndContinue}
        onRecalibrate={restartCalibration}
        onRetryValidation={retryValidation}
      />
    );
  }
  if (flow.phase === "quick-check" && activeProfile) {
    return (
      <CalibrationScreen
        key="quick-check"
        engine={quickCheckEngine}
        onComplete={() => void completeQuickCheck()}
        eyebrow="效果短复核 · 8 题"
        title="确认这套转换仍然合适"
        progressName="复核进度"
        note="请保持与原测试相近的亮度。短复核不会自动删除旧配置。"
      />
    );
  }
  if (
    flow.phase === "quick-check-result" &&
    activeProfile &&
    quickCheckResult
  ) {
    return (
      <main className="calibration-page completion-pause quick-check-result">
        <p className="folio">短复核未通过</p>
        <h1>
          {quickCheckResult.status === "review-display-settings"
            ? "先检查显示设置"
            : "建议重新完整测试"}
        </h1>
        <p>
          目标轴正确率 {Math.round(quickCheckResult.dominantAccuracy * 100)}%，
          控制轴正确率 {Math.round(quickCheckResult.controlAccuracy * 100)}
          %。旧配置仍然保留。
        </p>
        <div className="quick-check-actions">
          <button
            className="primary-button"
            type="button"
            onClick={flow.reviewDisplay}
          >
            检查显示设置
          </button>
          <button
            className="quiet-button"
            type="button"
            onClick={restartCalibration}
          >
            重新完整测试
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setOriginalOnly(true);
              flow.openGallery();
            }}
          >
            暂时只看原图
          </button>
        </div>
      </main>
    );
  }
  if (flow.phase === "profile" && activeProfile) {
    return (
      <ProfileSettings
        profile={activeProfile}
        validation={
          metrics
            ? profileValidationSummary(metrics)
            : (activeProfile.validation ?? { passed: true })
        }
        onClose={flow.openGallery}
        onImport={importProfile}
        onReviewDisplay={flow.reviewDisplay}
        onRecalibrate={restartCalibration}
      />
    );
  }
  if (flow.phase === "gallery") {
    const galleryList: readonly ArtworkRecord[] = [...userImages, ...ARTWORKS];
    if (selectedArtwork) {
      const index = galleryList.findIndex(
        (artwork) => artwork.id === selectedArtwork.id,
      );
      const previous = index > 0 ? galleryList[index - 1] : null;
      const next =
        index >= 0 && index < galleryList.length - 1
          ? galleryList[index + 1]
          : null;
      return (
        <ArtworkViewer
          key={selectedArtwork.id}
          artwork={selectedArtwork}
          lut={viewerLut}
          recommendedStrength={
            originalOnly
              ? 0
              : (activeProfile?.compensation.recommendedStrength ??
                profile?.recommendedStrength ??
                presetCompensation?.recommendedStrength ??
                0)
          }
          enhancementTag={isPresetMode ? "近似模式" : undefined}
          initialDisplay={viewerDisplay}
          onDisplayChange={setViewerDisplay}
          onBack={closeArtwork}
          onPrevious={previous ? () => openArtwork(previous) : null}
          onNext={next ? () => openArtwork(next) : null}
        />
      );
    }
    return (
      <GalleryScreen
        artworks={ARTWORKS}
        userImages={userImages}
        onSelect={openArtwork}
        onAddFiles={addUserFiles}
        onAddUrl={addUserImageFromUrl}
        onDeleteImage={deleteUserImage}
        onOpenProfile={activeProfile ? flow.openProfile : undefined}
        presetBanner={
          isPresetMode && presetLabel
            ? { labelZh: presetLabel, onUpgrade: flow.beginSetup }
            : undefined
        }
      />
    );
  }

  return (
    <main className="calibration-page completion-pause">
      <p className="folio">测试数据已记录</p>
      <h1>下一步：效果验证</h1>
      <p>我们会用一组新图形验证刚才的转换是否真的帮你分辨出了更多颜色。</p>
    </main>
  );
}
