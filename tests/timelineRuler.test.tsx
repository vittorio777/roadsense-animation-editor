import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { TimelinePanel } from "../src/editor/components/timeline/TimelinePanel";
import {
  createTimelineRulerTicks,
  timeToTimelinePercent,
} from "../src/editor/components/timeline/timelineRuler";
import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

describe("F3.1 Timeline ruler", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject(),
      currentTime: 3.25,
      selection: {
        objectId: "vehicle-selection",
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
  });

  it("creates unique ticks across the full 60-second work range", () => {
    const ticks = createTimelineRulerTicks();

    expect(ticks).toHaveLength(601);
    expect(ticks[0]).toMatchObject({ time: 0, positionPercent: 0 });
    expect(ticks[600]).toMatchObject({ time: 60, positionPercent: 100 });
    expect(new Set(ticks.map((tick) => tick.time)).size).toBe(601);
    expect(ticks.map((tick) => tick.time)).toEqual(
      [...ticks].sort((left, right) => left.time - right.time).map((tick) => tick.time),
    );
  });

  it("classifies major, medium, and minor ticks without overlap", () => {
    const ticks = createTimelineRulerTicks();
    const majorTicks = ticks.filter((tick) => tick.kind === "major");
    const mediumTicks = ticks.filter((tick) => tick.kind === "medium");
    const minorTicks = ticks.filter((tick) => tick.kind === "minor");

    expect(majorTicks).toHaveLength(61);
    expect(majorTicks.map((tick) => tick.label)).toEqual(
      Array.from({ length: 61 }, (_, second) => `${second}s`),
    );
    expect(mediumTicks).toHaveLength(60);
    expect(mediumTicks.map((tick) => tick.time)).toEqual(
      Array.from({ length: 60 }, (_, second) => second + 0.5),
    );
    expect(minorTicks).toHaveLength(480);
    expect(minorTicks.every((tick) => tick.label === undefined)).toBe(true);
  });

  it("maps the start, midpoint, and end linearly", () => {
    expect(timeToTimelinePercent(0)).toBe(0);
    expect(timeToTimelinePercent(30)).toBe(50);
    expect(timeToTimelinePercent(60)).toBe(100);
    expect(timeToTimelinePercent(15)).toBe(25);
  });

  it("reduces visual tick density in the 60-second overview", () => {
    const ticks = createTimelineRulerTicks(60);
    const majorTicks = ticks.filter((tick) => tick.kind === "major");

    expect(ticks).toHaveLength(121);
    expect(majorTicks).toHaveLength(13);
    expect(majorTicks.map((tick) => tick.label)).toEqual(
      Array.from({ length: 13 }, (_, index) => `${index * 5}s`),
    );
  });

  it("renders the accessible Ruler with stable endpoint labels", () => {
    const markup = renderToStaticMarkup(<TimelinePanel />);

    expect(markup).toContain('aria-label="Timeline ruler, 0 to 60 seconds"');
    expect(markup.match(/data-tick-kind=/g)).toHaveLength(601);
    expect(markup.match(/data-time-label=/g)).toHaveLength(61);
    expect(markup).toContain("translateX(0)");
    expect(markup).toContain("translateX(-100%)");
    expect(markup).not.toContain("Timeline editing begins in Phase 3.");
    expect(markup).toContain("Current time: 0.00s");
  });

  it("does not mutate Animation Data or temporary Editor State while rendering", async () => {
    const stateBeforeRender = useEditorStore.getState();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TimelinePanel />);
    });
    const stateAfterInteraction = useEditorStore.getState();
    expect(stateAfterInteraction.project).toBe(stateBeforeRender.project);
    expect(stateAfterInteraction.currentTime).toBe(3.25);
    expect(stateAfterInteraction.selection).toBe(stateBeforeRender.selection);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
