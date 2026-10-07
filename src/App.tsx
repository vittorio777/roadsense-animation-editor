import { Analytics } from "@vercel/analytics/react";

import { Editor } from "./editor/Editor";

export function App() {
  return (
    <>
      <Editor />
      <Analytics />
    </>
  );
}
