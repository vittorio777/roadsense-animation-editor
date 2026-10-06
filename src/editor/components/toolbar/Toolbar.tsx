import { useRef, useState, type ChangeEvent } from "react";

import { downloadAnimationProject } from "../../../persistence/projectDownloader";
import {
  presentProjectLoadFailure,
  type ProjectLoadErrorPresentation,
} from "../../../persistence/projectLoadError";
import { prepareAnimationProjectFile } from "../../../persistence/projectLoader";
import { useEditorStore } from "../../../store/editorStore";
import { ProjectLoadErrorDialog } from "./ProjectLoadErrorDialog";

interface ToolbarFeedback {
  kind: "success" | "error";
  message: string;
  details?: string;
}

export function Toolbar() {
  const project = useEditorStore((state) => state.project);
  const loadProject = useEditorStore((state) => state.loadProject);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadButtonRef = useRef<HTMLButtonElement>(null);
  const [feedback, setFeedback] = useState<ToolbarFeedback | null>(null);
  const [loadError, setLoadError] =
    useState<ProjectLoadErrorPresentation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const saveProject = () => {
    const result = downloadAnimationProject(project);
    if (result.status === "downloaded") {
      setFeedback({
        kind: "success",
        message: `Download started: ${result.filename}`,
      });
      return;
    }

    setFeedback({
      kind: "error",
      message: "Project could not be saved.",
      details:
        result.status === "invalid"
          ? result.errors.join(" ")
          : result.message,
    });
  };

  const chooseProjectFile = () => {
    fileInputRef.current?.click();
  };

  const handleProjectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || isLoading) {
      return;
    }

    setFeedback(null);
    setLoadError(null);
    setIsLoading(true);
    const result = await prepareAnimationProjectFile(file);
    setIsLoading(false);

    if (result.status === "ready") {
      loadProject(result.project);
      setFeedback({
        kind: "success",
        message: `Loaded: ${file.name}`,
      });
      return;
    }

    setFeedback({
      kind: "error",
      message: "Project could not be loaded.",
    });
    setLoadError(presentProjectLoadFailure(result));
  };

  const closeLoadError = () => {
    setLoadError(null);
    loadButtonRef.current?.focus();
  };

  return (
    <>
      <header
        aria-label="Toolbar"
        className="flex min-w-0 items-center justify-between border-b border-neutral-700 bg-neutral-950 px-4 text-neutral-100"
      >
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="shrink-0 text-sm font-semibold">RoadSense</span>
          <span className="truncate text-sm text-neutral-400">
            Animation Editor
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span
            aria-live="polite"
            className={`w-60 truncate text-right text-xs ${feedback?.kind === "error" ? "text-red-300" : "text-emerald-400"}`}
            data-toolbar-feedback={feedback?.kind}
            role={
              feedback
                ? feedback.kind === "error"
                  ? "alert"
                  : "status"
                : undefined
            }
            title={feedback?.details ?? feedback?.message}
          >
            {feedback?.message}
          </span>
          <input
            ref={fileInputRef}
            aria-label="Project JSON file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            type="file"
            onChange={handleProjectFile}
          />
          <button
            ref={loadButtonRef}
            type="button"
            className="h-8 border border-neutral-600 bg-neutral-900 px-3 text-xs font-medium text-neutral-100 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-wait disabled:text-neutral-500"
            disabled={isLoading}
            onClick={chooseProjectFile}
          >
            {isLoading ? "Loading..." : "Load project"}
          </button>
          <button
            type="button"
            className="h-8 border border-neutral-600 bg-neutral-900 px-3 text-xs font-medium text-neutral-100 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            onClick={saveProject}
          >
            Save project
          </button>
        </div>
      </header>
      {loadError ? (
        <ProjectLoadErrorDialog error={loadError} onClose={closeLoadError} />
      ) : null}
    </>
  );
}
