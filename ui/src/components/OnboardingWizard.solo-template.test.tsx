// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DialogProvider, useDialogActions } from "../context/DialogContext";
import { OnboardingWizard } from "./OnboardingWizard";

const mockSetSelectedCompanyId = vi.hoisted(() => vi.fn());
const mockCompaniesApi = vi.hoisted(() => ({
  create: vi.fn(),
}));
const mockGoalsApi = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
}));
const mockAgentsApi = vi.hoisted(() => ({
  adapterModels: vi.fn(),
  testAdapterEnvironment: vi.fn(),
  hire: vi.fn(),
  instructionsBundle: vi.fn(),
  saveInstructionsFile: vi.fn(),
}));
const mockApprovalsApi = vi.hoisted(() => ({
  approve: vi.fn(),
}));
const mockIssuesApi = vi.hoisted(() => ({
  create: vi.fn(),
}));
const mockProjectsApi = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
}));
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    companies: [],
    setSelectedCompanyId: mockSetSelectedCompanyId,
    loading: false,
  }),
}));

vi.mock("../api/companies", () => ({
  companiesApi: mockCompaniesApi,
}));
vi.mock("../api/goals", () => ({ goalsApi: mockGoalsApi }));
vi.mock("../api/agents", () => ({ agentsApi: mockAgentsApi }));
vi.mock("../api/approvals", () => ({ approvalsApi: mockApprovalsApi }));
vi.mock("../api/issues", () => ({ issuesApi: mockIssuesApi }));
vi.mock("../api/projects", () => ({ projectsApi: mockProjectsApi }));
vi.mock("../adapters", () => ({
  getUIAdapter: () => null,
  listUIAdapters: () => [],
}));
vi.mock("../adapters/use-disabled-adapters", () => ({
  useDisabledAdaptersSync: () => new Set<string>(),
}));
vi.mock("../adapters/use-adapter-capabilities", () => ({
  useAdapterCapabilities: () => () => ({
    supportsInstructionsBundle: false,
    supportsSkills: false,
    supportsLocalAgentJwt: false,
  }),
}));
vi.mock("../adapters/adapter-display-registry", () => ({
  getAdapterDisplay: () => ({
    label: "Adapter",
    description: "Adapter",
    icon: () => <span />,
  }),
  getAdapterLabels: () => ({}),
}));
vi.mock("@/lib/router", () => ({
  useLocation: () => ({ pathname: "/" }),
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
}));
vi.mock("./AsciiArtAnimation", () => ({
  AsciiArtAnimation: () => <div data-testid="ascii-art" />,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function OpenOnboardingButton() {
  const { openOnboarding } = useDialogActions();
  return (
    <button type="button" onClick={() => openOnboarding()}>
      Open onboarding
    </button>
  );
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
  });
}

function getButtonByText(text: string) {
  const button = Array.from(document.body.querySelectorAll("button")).find(
    (entry) => entry.textContent?.includes(text),
  );
  expect(button).toBeTruthy();
  return button as HTMLButtonElement;
}

function setTextFieldValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  valueSetter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderWizard(container: HTMLElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <DialogProvider>
          <OpenOnboardingButton />
          <OnboardingWizard />
        </DialogProvider>
      </QueryClientProvider>,
    );
  });
  return root;
}

describe("OnboardingWizard solo company template", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    mockCompaniesApi.create.mockResolvedValue({
      id: "company-1",
      issuePrefix: "SOL",
      name: "Solo Software Co",
    });
    mockGoalsApi.create.mockResolvedValue({ id: "goal-1" });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
    document.body.innerHTML = "";
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("sends templateId=solo_software_company when the user selects the 1-person software company template", async () => {
    root = renderWizard(container);
    await flushReact();

    await act(async () => {
      getButtonByText("Open onboarding").click();
    });
    await flushReact();
    await act(async () => {
      getButtonByText("Build a new company").click();
    });
    await flushReact();

    const nameInput = document.body.querySelector('input[placeholder="Acme Corp"]') as HTMLInputElement | null;
    expect(nameInput).not.toBeNull();
    await act(async () => {
      setTextFieldValue(nameInput!, "Solo Software Co");
    });
    await act(async () => {
      getButtonByText("Next").click();
    });
    await flushReact();

    await act(async () => {
      getButtonByText("I know my mission").click();
    });
    await flushReact();
    const missionInput = document.body.querySelector('textarea[placeholder="What is your team trying to achieve?"]') as HTMLTextAreaElement | null;
    expect(missionInput).not.toBeNull();
    await act(async () => {
      setTextFieldValue(missionInput!, "Build software with AI employees");
    });

    expect(document.body.textContent).toContain("1-person software company");
    await act(async () => {
      getButtonByText("1-person software company").click();
    });
    await flushReact();
    await act(async () => {
      getButtonByText("Confirm mission").click();
    });
    await flushReact();

    expect(mockCompaniesApi.create).toHaveBeenCalledWith({
      name: "Solo Software Co",
      templateId: "solo_software_company",
      operatingMode: "solo_software_company",
    });
    expect(mockGoalsApi.create).not.toHaveBeenCalled();
  });
});
