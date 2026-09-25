import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import type { DesktopBridge } from "@/platform/desktop";

/** A bridge whose update downloads when the test says so. */
function fakeUpdates() {
  let download: (version: string) => void = () => undefined;
  const ready = new Promise<string>((resolve) => (download = resolve));
  const updates: DesktopBridge = {
    updateReady: () => ready,
    installUpdate: vi.fn(() => Promise.resolve())
  };
  return {
    updates,
    download: async (version: string) => {
      await act(async () => {
        download(version);
        await ready;
      });
    }
  };
}

describe("UpdatePrompt", () => {
  it("shows nothing until an update has downloaded", async () => {
    const { updates, download } = fakeUpdates();
    render(<UpdatePrompt updates={updates} />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await download("0.1.300");

    expect(screen.getByRole("dialog", { name: "Update ready" })).toBeTruthy();
    expect(screen.getByText("PTSBLite 0.1.300 is ready to install.")).toBeTruthy();
  });

  it("restarts into the update", async () => {
    const { updates, download } = fakeUpdates();
    render(<UpdatePrompt updates={updates} />);
    await download("0.1.300");

    fireEvent.click(screen.getByRole("button", { name: "Restart now" }));

    expect(updates.installUpdate).toHaveBeenCalledTimes(1);
    // The app is closing; a second press must not start a second install.
    expect(screen.getByRole("button", { name: "Restarting…" })).toHaveProperty("disabled", true);
  });

  it("leaves the update for later without installing it", async () => {
    const { updates, download } = fakeUpdates();
    render(<UpdatePrompt updates={updates} />);
    await download("0.1.300");

    fireEvent.click(screen.getByRole("button", { name: "Later" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(updates.installUpdate).not.toHaveBeenCalled();
  });
});
