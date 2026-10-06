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

import { Toolbar } from "../src/editor/components/toolbar/Toolbar";
import { createEmptyAnimationProject } from "../src/model/animation";
import { serializeAnimationProject } from "../src/persistence/projectSerializer";
import { useEditorStore } from "../src/store/editorStore";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

function findButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label,
  );
  if (!button) {
    throw new Error(`Missing button ${label}`);
  }
  return button;
}

function selectFile(input: HTMLInputElement, file?: File) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: file ? [file] : [],
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function createFile(name: string, text: () => Promise<string>): File {
  return { name, text } as File;
}

async function flushAsyncWork() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("F6.6 Load Project Toolbar", () => {
  let container: HTMLDivElement;
  let root: Root;
  let anchorClick: ReturnType<typeof vi.spyOn>;
  let originalCreateObjectUrl: typeof URL.createObjectURL | undefined;
  let originalRevokeObjectUrl: typeof URL.revokeObjectURL | undefined;

  beforeAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject("old-project"),
      currentTime: 4.2,
      selection: {
        objectId: "old-vehicle",
        movementPointId: "old-point",
        pathId: "old-path",
        stateKeyframeId: "old-keyframe",
      },
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    originalCreateObjectUrl = URL.createObjectURL;
    originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:loaded-project"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    anchorClick.mockRestore();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectUrl,
    });
  });

  async function renderToolbar() {
    await act(async () => root.render(<Toolbar />));
  }

  function validFile(name = "loaded-project.json") {
    const project = createEmptyAnimationProject("loaded-project");
    project.scene.background = { assetId: "intersection-01" };
    const serialization = serializeAnimationProject(project);
    if (serialization.status !== "serialized") {
      throw new Error(serialization.errors.join(" "));
    }
    return createFile(name, vi.fn(async () => serialization.json));
  }

  it("opens a single JSON file input and ignores picker cancellation", async () => {
    await renderToolbar();
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Project JSON file"]',
    )!;
    const click = vi.spyOn(input, "click").mockImplementation(() => undefined);
    const stateBefore = useEditorStore.getState();

    findButton(container, "Load project").click();
    await act(async () => selectFile(input));

    expect(click).toHaveBeenCalledTimes(1);
    expect(input.accept).toBe(".json,application/json");
    expect(input.multiple).toBe(false);
    expect(input.className).toContain("sr-only");
    expect(input.tabIndex).toBe(-1);
    expect(useEditorStore.getState()).toBe(stateBefore);
    click.mockRestore();
  });

  it("loads a valid file, resets Editor State and saves the new Project", async () => {
    await renderToolbar();
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Project JSON file"]',
    )!;

    await act(async () => {
      selectFile(input, validFile());
      await flushAsyncWork();
    });

    expect(useEditorStore.getState()).toMatchObject({
      project: { animationId: "loaded-project" },
      currentTime: 0,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Loaded: loaded-project.json",
    );
    expect(input.value).toBe("");

    await act(async () => findButton(container, "Save project").click());
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(
      (anchorClick.mock.instances[0] as HTMLAnchorElement).download,
    ).toBe("loaded-project.json");
  });

  it("disables Load while reading and allows the same file again", async () => {
    await renderToolbar();
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Project JSON file"]',
    )!;
    const project = createEmptyAnimationProject("repeat-load");
    const serialization = serializeAnimationProject(project);
    if (serialization.status !== "serialized") {
      throw new Error(serialization.errors.join(" "));
    }
    let resolveText: ((text: string) => void) | undefined;
    const text = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveText = resolve;
        }),
    );
    const file = createFile("repeat.json", text);

    await act(async () => {
      selectFile(input, file);
      await Promise.resolve();
    });
    const loadingButton = findButton(container, "Loading...");
    expect(loadingButton.disabled).toBe(true);

    await act(async () => {
      resolveText?.(serialization.json);
      await flushAsyncWork();
    });
    expect(findButton(container, "Load project").disabled).toBe(false);

    await act(async () => {
      selectFile(input, file);
      await Promise.resolve();
      resolveText?.(serialization.json);
      await flushAsyncWork();
    });
    expect(text).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Loaded: repeat.json",
    );
  });

  it("keeps the complete Store unchanged and reports a generic failure", async () => {
    await renderToolbar();
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Project JSON file"]',
    )!;
    const stateBefore = useEditorStore.getState();

    await act(async () => {
      selectFile(input, createFile("broken.json", async () => "not json"));
      await flushAsyncWork();
    });

    expect(useEditorStore.getState()).toBe(stateBefore);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Project could not be loaded.",
    );
    expect(container.querySelector('[role="alert"]')?.getAttribute("title")).toBe(
      "Project could not be loaded.",
    );
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("The selected file is not valid JSON.");
    expect(dialog.textContent).toContain("Project file is not valid JSON.");
    expect(dialog.textContent).not.toContain("SyntaxError");
    expect(document.activeElement?.textContent).toBe("Close");
  });

  it("shows every Validation error and returns focus after Escape", async () => {
    await renderToolbar();
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Project JSON file"]',
    )!;
    const stateBefore = useEditorStore.getState();
    const invalidProject = JSON.stringify({
      schemaVersion: 2,
      animationId: "",
      scene: { width: 0, height: -1, objects: "not-an-array" },
    });

    await act(async () => {
      selectFile(
        input,
        createFile("invalid-project.json", async () => invalidProject),
      );
      await flushAsyncWork();
    });

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain("schemaVersion must be 1.");
    expect(dialog.textContent).toContain(
      "animationId must be a non-empty string.",
    );
    expect(dialog.textContent).toContain("scene.width must be greater than 0.");
    expect(dialog.textContent).toContain("scene.height must be greater than 0.");
    expect(dialog.textContent).toContain("scene.objects must be an array.");
    expect(useEditorStore.getState()).toBe(stateBefore);

    await act(async () =>
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(
      findButton(container, "Load project"),
    );
  });

  it("explains missing Assets and clears the error after a successful retry", async () => {
    await renderToolbar();
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Project JSON file"]',
    )!;
    const missingAssetProject = JSON.stringify({
      schemaVersion: 1,
      animationId: "missing-asset",
      scene: {
        width: 1600,
        height: 900,
        background: { assetId: "missing-background" },
        objects: [],
      },
    });

    await act(async () => {
      selectFile(
        input,
        createFile("missing-asset.json", async () => missingAssetProject),
      );
      await flushAsyncWork();
    });

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Unknown background assetId: missing-background.",
    );

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click();
    });
    expect(document.activeElement).toBe(
      findButton(container, "Load project"),
    );

    await act(async () => {
      selectFile(input, validFile("recovered.json"));
      await flushAsyncWork();
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Loaded: recovered.json",
    );
    expect(useEditorStore.getState().project.animationId).toBe("loaded-project");
  });
});
