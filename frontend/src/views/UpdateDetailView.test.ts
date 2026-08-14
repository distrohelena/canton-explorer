import { cleanup, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import UpdateDetailView from "./UpdateDetailView.vue";
import { fetchNodeUpdateDetail } from "../lib/api";
import type { NodeUpdateDetailResponse } from "../types/updates";
import "../styles.css";

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

function renderUpdateEvents(
  events: NodeUpdateDetailResponse["events"],
): { container: Element } {
  vi.mocked(fetchNodeUpdateDetail).mockResolvedValue({
    nodeId: "participant-1",
    label: "Participant 1",
    eventOffset: "0000000000000001",
    updateId: "update-1",
    recordTime: null,
    parties: [],
    events,
    meta: {},
  });

  return render(UpdateDetailView, {
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
}

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

  it("links a fully identified choice to its encoded template route and hash", async () => {
    renderUpdateEvents([
      {
        eventKind: "non_consuming_exercise",
        eventId: "#0:0",
        contractId: "00asset",
        packageId: "main-package",
        templateId: "Main:Asset",
        choice: "ReceiveSvRewardCoupon",
        witnesses: [],
        raw: {},
      },
    ]);

    expect(
      await screen.findByRole("link", { name: "ReceiveSvRewardCoupon" }),
    ).toHaveAttribute(
      "href",
      "/packages/main-package/templates/Main%3AAsset#choice-ReceiveSvRewardCoupon",
    );
  });

  it("preserves the encoded template path and logical special-character choice hash", async () => {
    renderUpdateEvents([
      {
        eventKind: "non_consuming_exercise",
        eventId: "#0:0",
        contractId: "00asset",
        packageId: "main-package",
        templateId: "Main:Asset",
        choice: "A Choice/With:Symbols",
        witnesses: [],
        raw: {},
      },
    ]);

    expect(
      await screen.findByRole("link", { name: "A Choice/With:Symbols" }),
    ).toHaveAttribute(
      "href",
      "/packages/main-package/templates/Main%3AAsset#choice-A Choice/With:Symbols",
    );
  });

  it("keeps choice values as plain text when any link identifier is missing", async () => {
    const { container } = renderUpdateEvents([
      {
        eventKind: "non_consuming_exercise",
        eventId: "#0:0",
        contractId: "00asset-1",
        packageId: null,
        templateId: "Main:Asset",
        choice: "MissingPackageIdChoice",
        witnesses: [],
        raw: {},
      },
      {
        eventKind: "non_consuming_exercise",
        eventId: "#0:1",
        contractId: "00asset-2",
        packageId: "main-package",
        templateId: null,
        choice: "MissingTemplateIdChoice",
        witnesses: [],
        raw: {},
      },
      {
        eventKind: "non_consuming_exercise",
        eventId: "#0:2",
        contractId: "00asset-3",
        packageId: "main-package",
        templateId: "Main:Asset",
        choice: null,
        witnesses: [],
        raw: {},
      },
    ]);

    const packageMissingChoice = await screen.findByText("MissingPackageIdChoice");
    expect(packageMissingChoice.closest("a")).toBeNull();
    const templateMissingChoice = screen.getByText("MissingTemplateIdChoice");
    expect(templateMissingChoice.closest("a")).toBeNull();

    const choiceItems = container.querySelectorAll(
      ".update-detail__event-item--choice",
    );
    expect(choiceItems).toHaveLength(3);
    expect(choiceItems[2]).toHaveTextContent("n/a");
    expect(choiceItems[2].querySelector("a")).toBeNull();
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
                {
                  label: "optionalTextMap",
                  value: {
                    kind: "text_map",
                    entries: [
                      {
                        key: "entry",
                        value: { kind: "optional", value: null },
                      },
                    ],
                  },
                },
              ],
            },
            type: {
              kind: "record",
              label: "Main:Asset",
              fields: [
                { name: "rewardRound", type: { kind: "builtin", label: "Int64" } },
                { name: "recipientParty", type: { kind: "builtin", label: "Party" } },
                {
                  name: "couponContractId",
                  type: { kind: "builtin", label: "ContractId" },
                },
                {
                  name: "optionalMemo",
                  type: {
                    kind: "builtin",
                    label: "Optional",
                    arguments: [{ kind: "builtin", label: "Text" }],
                  },
                },
                {
                  name: "optionalRewardRound",
                  type: {
                    kind: "builtin",
                    label: "Optional",
                    arguments: [{ kind: "builtin", label: "Text" }],
                  },
                },
                {
                  name: "optionalTextMap",
                  type: {
                    kind: "builtin",
                    label: "TextMap",
                    arguments: [
                      {
                        kind: "builtin",
                        label: "Optional",
                        arguments: [
                          { kind: "builtin", label: "ContractId" },
                        ],
                      },
                    ],
                  },
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
    expect(
      screen.getByRole("button", {
        name: "Copy update ID 1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
      }),
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
      container.querySelector('a[href="/packages/main-package/templates/Main%3AAsset"]'),
    ).not.toBeNull();
    expect(
      screen.queryByText(/"template_id": "Main:Asset"/),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Choice")[0].closest("div")).toHaveClass(
      "update-detail__event-item--choice",
    );
    expect(screen.getByText("Create Data")).toBeInTheDocument();
    expect(screen.getAllByText("Coupon Contract Id")).toHaveLength(2);
    expect(screen.getAllByText("00coupon")).toHaveLength(2);
    expect(screen.queryByText("Exercise Data")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Result" })).toBeInTheDocument();
    expect(screen.getByText("Reward Amount")).toBeInTheDocument();
    expect(screen.getByText("20,000")).toBeInTheDocument();
    expect(screen.getAllByText("Reward Round")).toHaveLength(2);
    expect(screen.getAllByText("258")).toHaveLength(2);
    const createDataTable = screen.getByRole("table", { name: "Create Data" });
    expect(createDataTable).toHaveAttribute(
      "aria-labelledby",
      "update-detail-event-data-heading-0-0",
    );
    expect(
      screen.getByRole("heading", { name: "Create Data" }),
    ).toHaveAttribute("id", "update-detail-event-data-heading-0-0");
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
    expect(within(createDataTable).getAllByText("Optional<Text>")).toHaveLength(
      2,
    );
    expect(
      within(createDataTable).getByText("Optional Reward Round"),
    ).toBeInTheDocument();
    expect(
      within(createDataTable).getByText("Optional Text Map / Entry"),
    ).toBeInTheDocument();
    const emptyTextMapOptionalRow = within(createDataTable)
      .getByText("Optional Text Map / Entry")
      .closest("tr");
    expect(emptyTextMapOptionalRow).not.toBeNull();
    expect(
      within(emptyTextMapOptionalRow as HTMLElement).getByText(
        "Optional<ContractId>",
      ),
    ).toBeInTheDocument();
    const emptyOptionalRow = within(createDataTable)
      .getByText("Optional Reward Round")
      .closest("tr");
    expect(emptyOptionalRow).not.toBeNull();
    expect(within(emptyOptionalRow as HTMLElement).getByText("Optional<Text>"))
      .toBeInTheDocument();
    expect(
      within(createDataTable).getByRole("link", { name: "Alice" }),
    ).toHaveAttribute("href", "/parties/Alice");
    expect(
      within(createDataTable).getByRole("button", {
        name: "Copy party ID Alice",
      }),
    ).toBeInTheDocument();
    expect(
      within(createDataTable).getByRole("link", { name: "Alice" }),
    ).toHaveClass("update-detail__data-table-value-link");
    expect(
      within(createDataTable).getByRole("link", { name: "00coupon" }),
    ).toHaveAttribute("href", "/nodes/participant-1/contracts/00coupon");
    expect(
      within(createDataTable).getByRole("button", {
        name: "Copy contract ID 00coupon",
      }),
    ).toBeInTheDocument();
    const resultTable = screen.getByRole("table", { name: "Result" });
    expect(resultTable).toHaveAttribute(
      "aria-labelledby",
      "update-detail-event-data-heading-1-0",
    );
    expect(
      within(resultTable)
        .getAllByRole("columnheader")
        .map((header) => header.textContent?.trim()),
    ).toEqual(["Field", "Type", "Value"]);
    expect(within(resultTable).getByText("Reward Amount")).toBeInTheDocument();
    expect(within(resultTable).getByText("Numeric")).toBeInTheDocument();
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
      screen.queryByRole("link", { name: "Back to overview" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Debug Offset" })).toHaveAttribute(
      "href",
      "/debugger?updateId=1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
    );
    expect(screen.queryByText("Back to overview")).not.toBeInTheDocument();
  });

  it("does not render a back control when opened from the global updates feed", async () => {
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
      screen.queryByRole("link", { name: "Back to overview" }),
    ).not.toBeInTheDocument();
  });

  it("does not render a back control when opened from a party-scoped updates browser", async () => {
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
      screen.queryByRole("link", { name: "Back to overview" }),
    ).not.toBeInTheDocument();
  });

  it("renders nested decoded exercise data with grouped array fields", async () => {
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
                  {
                    label: "context",
                    value: {
                      kind: "record",
                      fields: [
                        {
                          label: "context",
                          value: {
                            kind: "record",
                            fields: [
                              { label: "validatorRights", value: null },
                            ],
                          },
                        },
                      ],
                    },
                  },
                  {
                    label: "inputs",
                    value: {
                      kind: "list",
                      items: [
                        {
                          kind: "record",
                          fields: [
                            { label: "tag", value: "InputAmulet" },
                            {
                              label: "value",
                              value:
                                "00529caed95939d8b40d6bfaf7e0c26c707afb43f4ff49a4d8d5b554e8c4bf8254ca1212206e915acf6d312d929ae6240c659cb9ecf4add764740a851d3877b2b9bb47f4",
                            },
                          ],
                        },
                        {
                          kind: "record",
                          fields: [
                            {
                              label: "tag",
                              value: "InputValidatorLivenessActivityRecord",
                            },
                            {
                              label: "value",
                              value:
                                "00d628f7400febf4ca4aec4ea4e3129a1bfe1e0cb5c895a93bf86dd110ba6d383bca121220c858d095eef727e73c2e7fe1f1be367eeaa2fd193786db6918bcbbd60a9c402e",
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
              type: {
                kind: "record",
                label: "Splice.Wallet.Payment:AppPaymentRequest_Accept",
                fields: [
                  {
                    name: "context",
                    type: {
                      kind: "type_con",
                      label: "Splice.Wallet.Payment:Context",
                      definition: {
                        kind: "record",
                        label: "Splice.Wallet.Payment:Context",
                        fields: [
                          {
                            name: "context",
                            type: {
                              kind: "type_con",
                              label: "Splice.Wallet.Payment:Context",
                              definition: {
                                kind: "record",
                                label: "Splice.Wallet.Payment:Context",
                                fields: [
                                  {
                                    name: "validatorRights",
                                    type: {
                                      kind: "builtin",
                                      label: "GenMap",
                                      arguments: [
                                        { kind: "builtin", label: "Party" },
                                        {
                                          kind: "builtin",
                                          label: "ContractId",
                                          arguments: [
                                            {
                                              kind: "type_con",
                                              label: "Splice.Amulet:ValidatorRight",
                                            },
                                          ],
                                        },
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                  {
                    name: "inputs",
                    type: {
                      kind: "builtin",
                      label: "List",
                      arguments: [
                        {
                          kind: "record",
                          label: "Input",
                          fields: [
                            {
                              name: "tag",
                              type: { kind: "builtin", label: "Text" },
                            },
                            {
                              name: "value",
                              type: { kind: "builtin", label: "Text" },
                            },
                          ],
                        },
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
    expect(screen.getByRole("heading", { name: "Argument" })).toBeInTheDocument();
    expect(screen.getByText("Report Time")).toBeInTheDocument();
    expect(screen.getByText("2026-07-02T16:28:31.901Z")).toBeInTheDocument();
    expect(screen.getByText("Migration Id")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.queryByText("Context / Context / Validator Rights")).not.toBeInTheDocument();
    const argumentTable = screen.getByRole("table", { name: "Argument" });
    const contextSummary = within(argumentTable)
      .getAllByText("Context")[0]
      .closest("tr");
    expect(contextSummary).not.toBeNull();
    expect(within(contextSummary as HTMLElement).getByText("1 field")).toBeInTheDocument();
    const contextTable = screen.getAllByRole("table", { name: "Context" })[0];
    expect(contextTable).toBeDefined();
    expect(within(contextTable as HTMLElement).getByText("1 field")).toBeInTheDocument();
    const nestedContextSummary = within(contextTable)
      .getByText("Context")
      .closest("tr");
    expect(nestedContextSummary).not.toBeNull();
    const nestedContextTable = screen.getAllByRole("table", { name: "Context" })[1];
    expect(nestedContextTable).toBeDefined();
    expect(nestedContextTable?.closest("td")).toHaveAttribute("colspan", "3");
    expect(within(nestedContextTable as HTMLElement).getByText("Validator Rights")).toBeInTheDocument();
    const longTypeCell = within(nestedContextTable as HTMLElement)
      .getByText("GenMap<Party, ContractId<Splice.Amulet:ValidatorRight>>")
      .closest("td");
    expect(longTypeCell).not.toBeNull();
    expect(longTypeCell).toHaveClass(
      "update-detail__data-table-type--wrappable",
    );
    const inputsSummary = within(argumentTable).getByText("Inputs").closest("tr");
    expect(inputsSummary).not.toBeNull();
    expect(within(inputsSummary as HTMLElement).getByText("2 items")).toBeInTheDocument();
    expect(
      within(inputsSummary as HTMLElement).queryByRole("table", { name: "Inputs" }),
    ).not.toBeInTheDocument();
    expect(
      within(argumentTable).queryByText("Inputs[1] / Tag"),
    ).not.toBeInTheDocument();
    const inputsTable = screen.getByRole("table", { name: "Inputs" });
    const inputsContinuation = inputsTable.closest("td");
    expect(inputsContinuation).not.toBeNull();
    expect(inputsContinuation).toHaveAttribute("colspan", "3");
    expect(inputsContinuation?.parentElement?.previousElementSibling).toBe(
      inputsSummary,
    );
    expect(within(inputsTable).getByText("Field 1")).toBeInTheDocument();
    expect(within(inputsTable).getByText("Field 2")).toBeInTheDocument();
    expect(within(inputsTable).getAllByText("Tag")).toHaveLength(2);
    expect(within(inputsTable).getAllByText("Value")).toHaveLength(3);
    expect(within(inputsTable).getByText("InputAmulet")).toBeInTheDocument();
    expect(
      within(inputsTable).getByText("InputValidatorLivenessActivityRecord"),
    ).toBeInTheDocument();
    expect(
      within(inputsTable).getByText(
        "00529caed95939d8b40d6bfaf7e0c26c707afb43f4ff49a4d8d5b554e8c4bf8254ca1212206e915acf6d312d929ae6240c659cb9ecf4add764740a851d3877b2b9bb47f4",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("GenMap<Party, ContractId<Splice.Amulet:ValidatorRight>>"),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Result" })).toBeInTheDocument();
    expect(screen.getByText("Opt End User Party")).toBeInTheDocument();
    expect(screen.getByText("New Report")).toBeInTheDocument();
    expect(screen.queryByText("Exercise Data")).not.toBeInTheDocument();
    expect(screen.queryByText(/^(Argument|Result) \/\//)).not.toBeInTheDocument();
    expect(
      container.querySelector(`a[href="/parties/${endUserParty}"]`),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: `Copy party ID ${endUserParty}` }),
    ).toBeInTheDocument();
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
