import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CallQueueList, type CallQueueRow } from "./CallQueueList";

const base: CallQueueRow = {
  id: "pending-1",
  premiseName: "Next Heights",
  area: "Thaltej",
  address: "Thaltej, Ahmedabad",
  rentPriceRaw: "₹35,000",
  keyInfo: "3 BHK",
  availabilityRaw: "Immediate",
  ownerName: "Owner One",
  ownerPhone: "9876543210",
  ownerPhoneLast4: "3210",
  revealed: true,
  currentOutcome: null,
  daysAgo: 0,
  note: null,
};

describe("CallQueueList", () => {
  it("keeps the next owner prominent and collapses already logged calls", () => {
    const rows = [
      base,
      { ...base, id: "done-1", premiseName: "Completed House", currentOutcome: "connected" },
    ];
    const html = renderToStaticMarkup(createElement(CallQueueList, { rows }));

    expect(html).toContain("1 of 2 calls logged");
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain("Next to call");
    expect(html).toContain("Next Heights");
    expect(html).toContain("1 completed call");
    expect(html).not.toContain("Completed House");
  });
});
