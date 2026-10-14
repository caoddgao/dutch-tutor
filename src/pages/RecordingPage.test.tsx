import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { fixtureContent, testServices } from "../test/services";

describe("recording mode", () => {
  it("marks a sentence as unnatural before any recording is made", async () => {
    window.location.hash = "#/settings/recording";
    const { services, db } = testServices({ content: fixtureContent() });
    render(<App services={services} />);
    await screen.findByText("De vis is in de pan.");
    fireEvent.click(screen.getAllByLabelText("这句不自然")[0]);
    await waitFor(async () => {
      const rows = await db.select<{ target_id: string }[]>(
        "SELECT target_id FROM feedback WHERE category = 'unnatural'",
      );
      expect(rows).toEqual([{ target_id: "P01-S01" }]);
    });
  });
});
