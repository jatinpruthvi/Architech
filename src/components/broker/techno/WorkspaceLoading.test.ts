import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceLoading } from "./WorkspaceLoading";

describe("WorkspaceLoading", () => {
  it("announces a pending broker transition without exposing decorative blocks", () => {
    const html = renderToStaticMarkup(createElement(WorkspaceLoading));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading broker workspace"');
    expect(html).toContain("Loading your workspace");
    expect(html).toContain('aria-hidden="true"');
  });
});
