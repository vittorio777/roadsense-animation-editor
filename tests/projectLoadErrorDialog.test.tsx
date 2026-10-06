import { act } from "react";
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

import { ProjectLoadErrorDialog } from "../src/editor/components/toolbar/ProjectLoadErrorDialog";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

const error = {
  title: "Project could not be loaded" as const,
  summary: "The selected file does not match the RoadSense project format.",
  details: [
    "schemaVersion must be 1.",
    "scene.width must be greater than 0.",
  ],
};

describe("F6.7 Project load error dialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("labels the modal dialog and focuses its Close command", async () => {
    await act(async () =>
      root.render(<ProjectLoadErrorDialog error={error} onClose={vi.fn()} />),
    );

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const close = container.querySelector<HTMLButtonElement>("button")!;
    const labelledBy = dialog.getAttribute("aria-labelledby")!;
    const describedBy = dialog.getAttribute("aria-describedby")!;

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(container.querySelector(`#${CSS.escape(labelledBy)}`)?.textContent).toBe(
      error.title,
    );
    expect(
      container.querySelector(`#${CSS.escape(describedBy)}`)?.textContent,
    ).toBe(error.summary);
    expect(Array.from(container.querySelectorAll("li"), (item) => item.textContent)).toEqual(
      error.details,
    );
    expect(document.activeElement).toBe(close);
  });

  it("contains Tab focus and closes with Escape or Close", async () => {
    const onClose = vi.fn();
    await act(async () =>
      root.render(<ProjectLoadErrorDialog error={error} onClose={onClose} />),
    );
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const close = container.querySelector<HTMLButtonElement>("button")!;

    close.blur();
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(document.activeElement).toBe(close);

    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    close.click();
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
