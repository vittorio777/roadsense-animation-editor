import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { TimelinePanel } from "../src/editor/components/timeline/TimelinePanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { advancePreviewTime } from "../src/preview/playback";
import { usePreviewPlaybackClock } from "../src/preview/usePreviewPlaybackClock";
import { useEditorStore } from "../src/store/editorStore";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

function PlaybackHarness() {
  usePreviewPlaybackClock();
  return <TimelinePanel />;
}

describe("F7.8 preview time advancement", () => {
  it("advances by elapsed seconds without snapping", () => {
    expect(advancePreviewTime(1.25, 0.0167)).toEqual({
      time: 1.2667,
      reachedEnd: false,
    });
    const secondAdvance = advancePreviewTime(1.2667, 0.0833);
    expect(secondAdvance.time).toBeCloseTo(1.35);
    expect(secondAdvance.reachedEnd).toBe(false);
  });

  it("clamps invalid inputs and reports the range end", () => {
    expect(advancePreviewTime(-4, -1)).toEqual({
      time: 0,
      reachedEnd: false,
    });
    expect(advancePreviewTime(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      time: 0,
      reachedEnd: false,
    });
    expect(advancePreviewTime(59.9, 0.25)).toEqual({
      time: 60,
      reachedEnd: true,
    });
    expect(advancePreviewTime(60, 0)).toEqual({
      time: 60,
      reachedEnd: true,
    });
  });
});

describe("F7.8 Preview Play", () => {
  let container: HTMLDivElement;
  let root: Root;
  let nextFrameId: number;
  let frames: Map<number, FrameRequestCallback>;
  let cancelAnimationFrameMock: ReturnType<typeof vi.fn>;

  const runNextFrame = async (timestamp: number) => {
    const frame = [...frames.entries()][0];
    expect(frame).toBeDefined();
    frames.delete(frame![0]);
    await act(async () => frame![1](timestamp));
  };

  beforeAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  beforeEach(async () => {
    nextFrameId = 1;
    frames = new Map();
    cancelAnimationFrameMock = vi.fn((frameId: number) => {
      frames.delete(frameId);
    });
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const frameId = nextFrameId;
        nextFrameId += 1;
        frames.set(frameId, callback);
        return frameId;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameMock);

    useEditorStore.setState({
      project: createEmptyAnimationProject(),
      currentTime: 0,
      isPreviewPlaying: false,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
    useEditorStore.getState().addVehicle("car-blue-sedan");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () =>
      root.render(
        <StrictMode>
          <PlaybackHarness />
        </StrictMode>,
      ),
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("starts at the current time and advances the shared Timeline time", async () => {
    await act(async () => useEditorStore.getState().setCurrentTime(12.34));
    const playButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="preview-play-button"]',
    )!;

    expect(playButton.getAttribute("aria-label")).toBe("Play preview");
    await act(async () => playButton.click());

    expect(useEditorStore.getState().isPreviewPlaying).toBe(true);
    expect(useEditorStore.getState().currentTime).toBe(12.34);
    expect(playButton.disabled).toBe(false);
    expect(playButton.getAttribute("aria-label")).toBe("Pause preview");
    expect(playButton.textContent).toContain("Pause");
    expect(frames.size).toBe(1);

    await runNextFrame(1000);
    await runNextFrame(1250);

    expect(useEditorStore.getState().currentTime).toBe(12.59);
    expect(container.textContent).toContain("Current time: 12.59s");
    expect(
      Number.parseFloat(
        container.querySelector<HTMLElement>('[data-testid="timeline-playhead"]')!
          .style.left,
      ),
    ).toBeCloseTo((12.59 / 60) * 100);
  });

  it("disables Play for an empty Preview and enables it after recovery", async () => {
    await act(async () => {
      useEditorStore.setState({ project: createEmptyAnimationProject() });
    });
    const playButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="preview-play-button"]',
    )!;

    expect(playButton.disabled).toBe(true);
    expect(playButton.getAttribute("aria-describedby")).toBe(
      "preview-play-unavailable-reason",
    );
    expect(container.textContent).toContain("No vehicles in scene");

    await act(async () => useEditorStore.getState().addVehicle("car-blue-sedan"));
    expect(playButton.disabled).toBe(false);
    expect(playButton.hasAttribute("aria-describedby")).toBe(false);
  });

  it("stops playback at the last time when Preview becomes unavailable", async () => {
    await act(async () => useEditorStore.getState().setCurrentTime(7.25));
    const playButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="preview-play-button"]',
    )!;
    await act(async () => playButton.click());
    expect(useEditorStore.getState().isPreviewPlaying).toBe(true);
    const timeBeforeFailure = useEditorStore.getState().currentTime;
    const projectBeforeFailure = useEditorStore.getState().project;
    const vehicle = projectBeforeFailure.scene.objects[0]!;

    await act(async () => {
      useEditorStore.setState({
        project: {
          ...projectBeforeFailure,
          scene: {
            ...projectBeforeFailure.scene,
            objects: [
              {
                ...vehicle,
                movement: { points: [], paths: [] },
              },
            ],
          },
        },
      });
    });

    expect(useEditorStore.getState().isPreviewPlaying).toBe(false);
    expect(useEditorStore.getState().currentTime).toBe(timeBeforeFailure);
    expect(frames.size).toBe(0);
    expect(playButton.disabled).toBe(true);

    await act(async () => {
      useEditorStore.setState({ project: projectBeforeFailure });
    });
    expect(playButton.disabled).toBe(false);
  });

  it("pauses at the exact time and resumes without counting the wait", async () => {
    await act(async () => useEditorStore.getState().setCurrentTime(2));
    const transportButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="preview-play-button"]',
    )!;
    transportButton.focus();
    await act(async () => transportButton.click());
    await runNextFrame(1000);
    await runNextFrame(1234.567);

    const pausedTime = useEditorStore.getState().currentTime;
    const pendingFrame = [...frames.values()][0];
    expect(pausedTime).toBeCloseTo(2.234567);
    expect(pendingFrame).toBeDefined();

    await act(async () => transportButton.click());

    expect(useEditorStore.getState().isPreviewPlaying).toBe(false);
    expect(useEditorStore.getState().currentTime).toBe(pausedTime);
    expect(frames.size).toBe(0);
    expect(transportButton.getAttribute("aria-label")).toBe("Play preview");
    expect(transportButton.textContent).toContain("Play");
    expect(document.activeElement).toBe(transportButton);

    await act(async () => pendingFrame!(9000));
    expect(useEditorStore.getState().currentTime).toBe(pausedTime);
    expect(frames.size).toBe(0);

    await act(async () => transportButton.click());
    await runNextFrame(10000);
    expect(useEditorStore.getState().currentTime).toBe(pausedTime);
    await runNextFrame(10050);
    expect(useEditorStore.getState().currentTime).toBeCloseTo(
      pausedTime + 0.05,
    );
  });

  it("keeps one loop across rapid Play Pause Play toggles", async () => {
    const transportButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="preview-play-button"]',
    )!;

    await act(async () => transportButton.click());
    expect(frames.size).toBe(1);
    await act(async () => transportButton.click());
    expect(useEditorStore.getState().isPreviewPlaying).toBe(false);
    expect(frames.size).toBe(0);
    await act(async () => transportButton.click());
    expect(useEditorStore.getState().isPreviewPlaying).toBe(true);
    expect(frames.size).toBe(1);

    await runNextFrame(2000);
    await runNextFrame(2016.7);
    expect(useEditorStore.getState().currentTime).toBeCloseTo(0.0167);
    expect(frames.size).toBe(1);
  });

  it("seeks while paused and resumes from the seek time", async () => {
    const transportButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="preview-play-button"]',
    )!;
    await act(async () => transportButton.click());
    await runNextFrame(1000);
    await runNextFrame(1250);
    await act(async () => transportButton.click());

    const timelineSurface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    )!;
    Object.defineProperty(timelineSurface, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 100,
        height: 100,
        left: 100,
        right: 6100,
        top: 0,
        width: 6000,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    await act(async () =>
      timelineSurface.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 650 }),
      ),
    );

    expect(useEditorStore.getState().currentTime).toBe(5.5);
    expect(useEditorStore.getState().isPreviewPlaying).toBe(false);
    expect(container.textContent).toContain("Current time: 5.50s");

    await act(async () => transportButton.click());
    expect(useEditorStore.getState().currentTime).toBe(5.5);
    expect(useEditorStore.getState().isPreviewPlaying).toBe(true);
    expect(frames.size).toBe(1);
  });

  it("keeps one loop when Play is triggered repeatedly", async () => {
    await act(async () => useEditorStore.getState().startPreviewPlayback());
    const stateAfterStart = useEditorStore.getState();
    expect(frames.size).toBe(1);

    await act(async () => useEditorStore.getState().startPreviewPlayback());

    expect(useEditorStore.getState()).toBe(stateAfterStart);
    expect(frames.size).toBe(1);
    await runNextFrame(2000);
    await runNextFrame(2016.7);
    expect(useEditorStore.getState().currentTime).toBeCloseTo(0.0167);
  });

  it("stops exactly at 60 seconds and restarts from zero", async () => {
    await act(async () => {
      useEditorStore.getState().setCurrentTime(59.9);
      useEditorStore.getState().startPreviewPlayback();
    });
    await runNextFrame(3000);
    await runNextFrame(3250);

    expect(useEditorStore.getState().currentTime).toBe(60);
    expect(useEditorStore.getState().isPreviewPlaying).toBe(false);
    expect(frames.size).toBe(0);
    expect(container.textContent).toContain("Current time: 60.00s");

    const playButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="preview-play-button"]',
    )!;
    expect(playButton.disabled).toBe(false);
    await act(async () => playButton.click());

    expect(useEditorStore.getState().currentTime).toBe(0);
    expect(useEditorStore.getState().isPreviewPlaying).toBe(true);
    expect(frames.size).toBe(1);
  });

  it("does not mutate Animation Data or selection while playing", async () => {
    await act(async () => useEditorStore.getState().addVehicle("car-blue-sedan"));
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    await act(async () => useEditorStore.getState().selectObject(vehicleId));
    const project = useEditorStore.getState().project;
    const selection = useEditorStore.getState().selection;
    const serializedProject = JSON.stringify(project);

    await act(async () => {
      useEditorStore.getState().startPreviewPlayback();
      useEditorStore.getState().advancePreviewPlayback(3.4567);
    });

    expect(useEditorStore.getState().currentTime).toBe(3.4567);
    expect(useEditorStore.getState().project).toBe(project);
    expect(JSON.stringify(useEditorStore.getState().project)).toBe(
      serializedProject,
    );
    expect(useEditorStore.getState().selection).toBe(selection);
  });

  it("cancels playback when a Project is loaded", async () => {
    await act(async () => useEditorStore.getState().startPreviewPlayback());
    expect(frames.size).toBe(1);

    const loadedProject = createEmptyAnimationProject("loaded-project");
    await act(async () => useEditorStore.getState().loadProject(loadedProject));

    expect(useEditorStore.getState()).toMatchObject({
      project: loadedProject,
      currentTime: 0,
      isPreviewPlaying: false,
    });
    expect(frames.size).toBe(0);
    expect(cancelAnimationFrameMock).toHaveBeenCalled();
  });

  it("cancels the frame and clears playing state when unmounted", async () => {
    await act(async () => useEditorStore.getState().startPreviewPlayback());
    expect(frames.size).toBe(1);

    await act(async () => root.unmount());

    expect(frames.size).toBe(0);
    expect(useEditorStore.getState().isPreviewPlaying).toBe(false);
    expect(cancelAnimationFrameMock).toHaveBeenCalled();
    root = createRoot(container);
  });
});
