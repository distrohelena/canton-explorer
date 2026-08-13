import { cleanup, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import UpdateDetailView from "./UpdateDetailView.vue";
import { fetchNodeUpdateDetail } from "../lib/api";

const routeQuery = {
  from: undefined as string | undefined,
  partyId: undefined as string | undefined,
};

vi.mock("../lib/api", () => ({
  fetchNodeUpdateDetail: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({
    query: routeQuery,
  }),
}));

describe("UpdateDetailView", () => {
  afterEach(() => {
    cleanup();
    routeQuery.from = undefined;
    routeQuery.partyId = undefined;
    vi.restoreAllMocks();
  });

  it("shows a loading state before the update detail resolves", () => {
    vi.mocked(fetchNodeUpdateDetail).mockReturnValue(
      new Promise(() => undefined),
    );

    render(UpdateDetailView, {
      props: {
        id: "participant-1",
        eventOffset: "0000000000000001",
      },
      global: {
        stubs: {
          RouterLink: {
            props: ["to"],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(screen.getByText("Loading update detail...")).toBeInTheDocument();
  });

  it("renders a single update detail without a raw metadata section", async () => {
    routeQuery.from = "node";

    vi.mocked(fetchNodeUpdateDetail).mockResolvedValue({
      nodeId: "participant-1",
      label: "Participant 1",
      eventOffset: "0000000000000001",
      updateId:
        "1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
      recordTime: "2026-07-01T12:00:00.000Z",
      parties: ["Alice", "Bob"],
      estimatedTrafficUsd: "12.34",
      estimatedTrafficUsdGapDays: 1,
      events: [
        {
          eventKind: "create",
          eventId: "#0:0",
          contractId: "00abc",
          packageId: "main-package",
          templateId: "Main:Asset",
          choice: null,
          witnesses: ["Alice", "Bob"],
          createData: {
            status: "decoded",
            value: {
              kind: "record",
              fields: [
                { label: "rewardRound", value: 258 },
                { label: "recipientParty", value: "Alice" },
                {
                  label: "couponContractId",
                  value: { kind: "contract_id", value: "00coupon" },
                },
                {
                  label: "optionalMemo",
                  value: { kind: "optional", value: "memo" },
                },
                {
                  label: "optionalRewardRound",
                  value: { kind: "optional", value: null },
                },
              ],
            },
          },
          raw: {
            event_id: "#0:0",
            contract_id: "00abc",
            template_id: "Main:Asset",
          },
        },
        {
          eventKind: "non_consuming_exercise",
          eventId: "#0:1",
          contractId: "00reward",
          packageId: "splice-dso-rules",
          templateId: "Splice.DsoRules:DsoRules",
          choice: "ReceiveSvRewardCoupon",
          witnesses: ["Alice"],
          exerciseData: {
            argument: { status: "not_available" },
            result: {
              status: "decoded",
              value: {
                kind: "record",
                fields: [
                  { label: "rewardAmount", value: 20000 },
                  { label: "rewardRound", value: 258 },
                  {
                    label: "couponContractId",
                    value: { kind: "contract_id", value: "00coupon" },
                  },
                ],
              },
            },
          },
          raw: {
            event_id: "#0:1",
            contract_id: "00reward",
            template_id: "Splice.DsoRules:DsoRules",
            choice: "ReceiveSvRewardCoupon",
          },
        },
      ],
      meta: {
        update_id:
          "\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
        record_time: 1782907200000000,
        event_offset: "0000000000000001",
      },
    });

    const formatMock = vi
      .fn()
      .mockReturnValueOnce("Jul 1, 2026")
      .mockReturnValueOnce("12:00:00 PM");
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: formatMock,
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container } = render(UpdateDetailView, {
      props: {
        id: "participant-1",
        eventOffset: "0000000000000001",
      },
      global: {
        stubs: {
          RouterLink: {
            props: ["to"],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Participant 1 Update" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Event Offset")).toBeInTheDocument();
    expect(screen.getByText("0000000000000001")).toBeInTheDocument();
    expect(screen.getByText("Canonical Update ID")).toBeInTheDocument();
    expect(screen.getByText("Estimated traffic cost")).toBeInTheDocument();
    expect(screen.getByText("$12.34 (1 day)")).toBeInTheDocument();
    expect(
      Array.from(
        container.querySelectorAll(".update-detail__summary-grid dt"),
      ).map((label) => label.textContent?.trim()),
    ).toEqual([
      "Event Offset",
      "Canonical Update ID",
      "Record Time",
      "Estimated traffic cost",
      "Parties",
    ]);
    expect(
      screen.getByText(
        "1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Jul 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("12:00:00 PM")).toBeInTheDocument();
    expect(screen.queryByText("Alice, Bob")).not.toBeInTheDocument();
    const summaryParties = screen.getByText("Parties").nextElementSibling;
    expect(summaryParties).not.toBeNull();
    expect(summaryParties?.textContent).toContain("Alice");
    expect(summaryParties?.textContent).toContain("Bob");
    expect(
      summaryParties?.querySelectorAll(
        ".package-detail__list-row.parties-page__party-row",
      ),
    ).toHaveLength(2);
    expect(
      summaryParties?.querySelectorAll(".parties-page__party-link"),
    ).toHaveLength(2);
    expect(container.querySelector('a[href="/parties/Alice"]')).not.toBeNull();
    expect(container.querySelector('a[href="/parties/Bob"]')).not.toBeNull();
    expect(
      summaryParties?.querySelector('button[aria-label="Copy party ID Alice"]'),
    ).not.toBeNull();
    expect(
      summaryParties?.querySelector('button[aria-label="Copy party ID Bob"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Summary" }).closest("section"),
    ).toHaveClass("update-detail__section--summary");
    expect(
      screen.queryByRole("heading", { name: "Raw Metadata" }),
    ).not.toBeInTheDocument();
    const eventsHeading = screen.getByRole("heading", { name: "Events" });
    expect(eventsHeading).toBeInTheDocument();
    expect(
      container.querySelector(".update-detail__events-section"),
    ).toBeNull();
    expect(eventsHeading.closest(".node-detail__sections")).toBeNull();
    expect(screen.getByText("Create")).toBeInTheDocument();
    expect(screen.getByText("Non-Consuming Exercise")).toBeInTheDocument();
    expect(screen.getByText("Non-Consuming Exercise")).toHaveClass(
      "update-detail__event-kind",
    );
    expect(screen.getByText("#0:0")).toBeInTheDocument();
    expect(
      container.querySelectorAll(
        ".update-detail__witnesses .package-detail__list-row.parties-page__party-row",
      ),
    ).toHaveLength(3);
    expect(
      container.querySelectorAll(
        ".update-detail__witnesses .copy-to-clipboard-button",
      ),
    ).toHaveLength(3);
    expect(screen.getAllByText("Package ID")).toHaveLength(2);
    expect(screen.getByText("main-package")).toBeInTheDocument();
    expect(screen.getByText("splice-dso-rules")).toBeInTheDocument();
    expect(screen.getByText("00abc")).toBeInTheDocument();
    expect(screen.getByText("Main:Asset")).toBeInTheDocument();
    expect(
      screen.queryByText(/"template_id": "Main:Asset"/),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Choice")[0].closest("div")).toHaveClass(
      "update-detail__event-item--choice",
    );
    expect(screen.getByText("Create Data")).toBeInTheDocument();
    expect(screen.getByText("Coupon Contract Id")).toBeInTheDocument();
    expect(screen.getByText("Result / Coupon Contract Id")).toBeInTheDocument();
    expect(screen.getAllByText("00coupon")).toHaveLength(2);
    expect(screen.getByText("Exercise Data")).toBeInTheDocument();
    expect(screen.getByText("Result / Reward Amount")).toBeInTheDocument();
    expect(screen.getByText("20,000")).toBeInTheDocument();
    expect(screen.getByText("Result / Reward Round")).toBeInTheDocument();
    expect(screen.getAllByText("258")).toHaveLength(2);
    const createDataTable = screen.getByRole("table", { name: "Create Data" });
    expect(createDataTable).toHaveAttribute(
      "aria-labelledby",
      "update-detail-event-data-heading-0",
    );
    expect(
      screen.getByRole("heading", { name: "Create Data" }),
    ).toHaveAttribute("id", "update-detail-event-data-heading-0");
    expect(
      within(createDataTable)
        .getAllByRole("columnheader")
        .map((header) => header.textContent?.trim()),
    ).toEqual(["Field", "Type", "Value"]);
    expect(createDataTable.querySelectorAll("col")).toHaveLength(3);
    expect(
      createDataTable.querySelector(
        "col.update-detail__data-table-col--field",
      ),
    ).not.toBeNull();
    expect(
      createDataTable.querySelector(
        "col.update-detail__data-table-col--type",
      ),
    ).not.toBeNull();
    expect(
      createDataTable.querySelector(
        "col.update-detail__data-table-col--value",
      ),
    ).not.toBeNull();
    expect(
      within(createDataTable).getByText("Reward Round"),
    ).toBeInTheDocument();
    expect(
      within(createDataTable).getByText("Recipient Party"),
    ).toBeInTheDocument();
    expect(within(createDataTable).getByText("Int64")).toBeInTheDocument();
    expect(within(createDataTable).getByText("ContractId")).toBeInTheDocument();
    expect(within(createDataTable).getByText("Party")).toBeInTheDocument();
    expect(
      within(createDataTable).getByText("Optional Memo"),
    ).toBeInTheDocument();
    expect(
      within(createDataTable).getByText("Optional<Text>"),
    ).toBeInTheDocument();
    expect(
      within(createDataTable).getByText("Optional Reward Round"),
    ).toBeInTheDocument();
    expect(
      within(createDataTable).getByText("Optional<Int64>"),
    ).toBeInTheDocument();
    expect(
      within(createDataTable).getByRole("link", { name: "Alice" }),
    ).toHaveAttribute("href", "/parties/Alice");
    expect(
      within(createDataTable).getByRole("link", { name: "00coupon" }),
    ).toHaveAttribute("href", "/nodes/participant-1/contracts/00coupon");
    const exerciseDataTable = screen.getByRole("table", {
      name: "Exercise Data",
    });
    expect(exerciseDataTable).toHaveAttribute(
      "aria-labelledby",
      "update-detail-event-data-heading-1",
    );
    expect(
      within(exerciseDataTable)
        .getAllByRole("columnheader")
        .map((header) => header.textContent?.trim()),
    ).toEqual(["Field", "Type", "Value"]);
    expect(
      within(exerciseDataTable).getByText("Result / Reward Amount"),
    ).toBeInTheDocument();
    expect(within(exerciseDataTable).getByText("Numeric")).toBeInTheDocument();
    expect(
      container.querySelectorAll(".update-detail__event-item--exercise-data"),
    ).toHaveLength(0);
    expect(
      container.querySelector('a[href="/packages/main-package"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href="/packages/splice-dso-rules"]'),
    ).not.toBeNull();
    const eventPackageLink = container.querySelector(
      'a[href="/packages/main-package"]',
    );
    expect(eventPackageLink).toHaveClass("update-detail__event-package-id");
    expect(eventPackageLink).toHaveAttribute("title", "main-package");
    expect(container.querySelector('a[href="/parties/Alice"]')).not.toBeNull();
    expect(container.querySelector('a[href="/parties/Bob"]')).not.toBeNull();
    const eventContractLink = container.querySelector(
      'a[href="/nodes/participant-1/contracts/00abc"]',
    );
    expect(eventContractLink).not.toBeNull();
    expect(eventContractLink).toHaveClass("update-detail__event-contract-id");
    expect(eventContractLink).toHaveAttribute("title", "00abc");
    expect(
      container.querySelector(
        'a[href="/nodes/participant-1/contracts/00coupon"]',
      ),
    ).not.toBeNull();
    expect(screen.queryByText("Update Detail")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to overview" }),
    ).toHaveAttribute("href", "/nodes/participant-1/updates");
    expect(screen.getByRole("link", { name: "Debug Offset" })).toHaveAttribute(
      "href",
      "/debugger?updateId=1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
    );
    expect(screen.queryByText("Back to overview")).not.toBeInTheDocument();
  });

  it("returns to the global updates page when opened from that feed", async () => {
    routeQuery.from = "updates";

    vi.mocked(fetchNodeUpdateDetail).mockResolvedValue({
      nodeId: "participant-1",
      label: "Participant 1",
      eventOffset: "0000000000000001",
      updateId:
        "1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
      recordTime: "2026-07-01T12:00:00.000Z",
      parties: ["Alice"],
      events: [],
      meta: {
        update_id:
          "\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
        record_time: 1782907200000000,
        event_offset: "0000000000000001",
      },
    });

    render(UpdateDetailView, {
      props: {
        id: "participant-1",
        eventOffset: "0000000000000001",
      },
      global: {
        stubs: {
          RouterLink: {
            props: ["to"],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    await screen.findByText("No event rows found for this update.");

    expect(
      screen.getByRole("link", { name: "Back to overview" }),
    ).toHaveAttribute("href", "/");
  });

  it("returns to the party page when opened from a party-scoped updates browser", async () => {
    routeQuery.from = "party";
    routeQuery.partyId = "Alice";

    vi.mocked(fetchNodeUpdateDetail).mockResolvedValue({
      nodeId: "participant-1",
      label: "Participant 1",
      eventOffset: "0000000000000001",
      updateId:
        "1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
      recordTime: "2026-07-01T12:00:00.000Z",
      parties: ["Alice"],
      events: [],
      meta: {
        update_id:
          "\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
        record_time: 1782907200000000,
        event_offset: "0000000000000001",
      },
    });

    render(UpdateDetailView, {
      props: {
        id: "participant-1",
        eventOffset: "0000000000000001",
      },
      global: {
        stubs: {
          RouterLink: {
            props: ["to"],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    await screen.findByText("No event rows found for this update.");

    expect(
      screen.getByRole("link", { name: "Back to overview" }),
    ).toHaveAttribute("href", "/parties/Alice");
  });

  it("renders nested decoded exercise data with flattened labels", async () => {
    const endUserParty =
      "app_user_quickstart-helena-1::122039623d5100d9d3e7570612752bc03420abf158361d66c5694f22ee0f72260339";

    vi.mocked(fetchNodeUpdateDetail).mockResolvedValue({
      nodeId: "cnqs-sv",
      label: "CNQS Super Validator",
      eventOffset: "11327",
      updateId:
        "1220c4d4cb71a7824ad32684cbb91ba37b285cec60a45c94c561531c2b1cfaf689b8",
      recordTime: "2026-07-02T17:20:00.000Z",
      parties: ["sv::party"],
      events: [
        {
          eventKind: "non_consuming_exercise",
          eventId: "#0:0",
          contractId: "00report",
          templateId: "Splice.DsoRules:DsoRules",
          choice: "SubmitStatusReport",
          witnesses: ["sv::party"],
          exerciseData: {
            argument: {
              status: "decoded",
              value: {
                kind: "record",
                fields: [
                  { label: "sv", value: "sv::party" },
                  { label: "openRoundCid", value: "00openround" },
                  {
                    label: "status",
                    value: {
                      kind: "record",
                      fields: [
                        {
                          label: "reportTime",
                          value: "2026-07-02T16:28:31.901Z",
                        },
                        { label: "migrationId", value: -1 },
                      ],
                    },
                  },
                ],
              },
            },
            result: {
              status: "decoded",
              value: {
                kind: "record",
                fields: [
                  {
                    label: "optEndUserParty",
                    value: endUserParty,
                  },
                  {
                    label: "newReport",
                    value: { kind: "contract_id", value: "00newreport" },
                  },
                ],
              },
            },
          },
          raw: {},
        },
      ],
      meta: {
        update_id:
          "\\x1220c4d4cb71a7824ad32684cbb91ba37b285cec60a45c94c561531c2b1cfaf689b8",
        record_time: 1783051200000000,
        event_offset: "11327",
      },
    });

    const { container } = render(UpdateDetailView, {
      props: {
        id: "cnqs-sv",
        eventOffset: "11327",
      },
      global: {
        stubs: {
          RouterLink: {
            props: ["to"],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(
      await screen.findByRole("heading", {
        name: "CNQS Super Validator Update",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Argument / Status / Report Time"),
    ).toBeInTheDocument();
    expect(screen.getByText("2026-07-02T16:28:31.901Z")).toBeInTheDocument();
    expect(
      screen.getByText("Argument / Status / Migration Id"),
    ).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.getByText("Result / Opt End User Party")).toBeInTheDocument();
    expect(screen.getByText("Result / New Report")).toBeInTheDocument();
    expect(
      container.querySelector(`a[href="/parties/${endUserParty}"]`),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href="/parties/sv::party"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href="/nodes/cnqs-sv/contracts/00openround"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href="/nodes/cnqs-sv/contracts/00newreport"]'),
    ).not.toBeNull();
  });

  it("shows an explicit empty state when no event rows are returned", async () => {
    vi.mocked(fetchNodeUpdateDetail).mockResolvedValue({
      nodeId: "participant-1",
      label: "Participant 1",
      eventOffset: "0000000000000001",
      updateId:
        "1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
      recordTime: "2026-07-01T12:00:00.000Z",
      parties: ["Alice"],
      events: [],
      meta: {
        update_id:
          "\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
        record_time: 1782907200000000,
        event_offset: "0000000000000001",
      },
    });

    render(UpdateDetailView, {
      props: {
        id: "participant-1",
        eventOffset: "0000000000000001",
      },
      global: {
        stubs: {
          RouterLink: {
            props: ["to"],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(
      await screen.findByText("No event rows found for this update."),
    ).toBeInTheDocument();
  });

  it("shows a page-level error when the update detail request fails", async () => {
    vi.mocked(fetchNodeUpdateDetail).mockRejectedValue(
      new Error("Request failed: 404"),
    );

    render(UpdateDetailView, {
      props: {
        id: "participant-1",
        eventOffset: "missing-event-offset",
      },
      global: {
        stubs: {
          RouterLink: {
            props: ["to"],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByText("Request failed: 404")).toBeInTheDocument();
  });
});
