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
import { useEditorStore } from "../src/store/editorStore";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

describe("F6.3 Save Project Toolbar", () => {
  let container: HTMLDivElement;
  let root: Root;
  let anchorClick: ReturnType<typeof vi.spyOn>;
  let createObjectUrl: ReturnType<typeof vi.fn>;
  let revokeObjectUrl: ReturnType<typeof vi.fn>;
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
      project: createEmptyAnimationProject("toolbar-project"),
      currentTime: 4.2,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    createObjectUrl = vi.fn(() => "blob:toolbar-project");
    revokeObjectUrl = vi.fn();
    originalCreateObjectUrl = URL.createObjectURL;
    originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
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

  function getSaveButton() {
    return Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Save project",
    )!;
  }

  it("downloads the current Project and reports success without Store mutation", async () => {
    const stateBefore = useEditorStore.getState();
    await renderToolbar();
    const button = getSaveButton();

    await act(async () => button.click());

    expect(button.textContent).toBe("Save project");
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:toolbar-project");
    expect(document.querySelector("a[download]")).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Download started: toolbar-project.json",
    );
    expect(useEditorStore.getState()).toBe(stateBefore);
  });

  it("reports invalid data without attempting a download", async () => {
    const project = createEmptyAnimationProject("invalid-project");
    Object.assign(project, { currentTime: 3 });
    useEditorStore.setState({ project });
    const stateBefore = useEditorStore.getState();
    await renderToolbar();

    await act(async () =>
      getSaveButton().click(),
    );

    expect(anchorClick).not.toHaveBeenCalled();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Project could not be saved.",
    );
    expect(container.querySelector('[role="alert"]')?.getAttribute("title")).toBe(
      "Project contains unknown field currentTime.",
    );
    expect(useEditorStore.getState()).toBe(stateBefore);
  });
});
