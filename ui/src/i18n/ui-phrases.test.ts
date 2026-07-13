import { describe, expect, it } from "vitest";

import { translateUiPhrase } from "./ui-phrases";

describe("UI phrase translations", () => {
  it("translates registered page phrases to Chinese", () => {
    expect(translateUiPhrase("Dashboard", "zh-CN")).toBe("仪表盘");
    expect(translateUiPhrase("Select a company to view projects.", "zh-CN")).toBe("选择公司以查看项目。");
    expect(translateUiPhrase("See all agents", "zh-CN")).toBe("查看全部智能体");
  });

  it("translates common dynamic UI status phrases to Chinese", () => {
    expect(translateUiPhrase("7 tasks planned", "zh-CN")).toBe("7 个任务已计划");
    expect(translateUiPhrase("Finished 17h ago", "zh-CN")).toBe("17h 前完成");
    expect(translateUiPhrase("worked for 13 seconds", "zh-CN")).toBe("工作了 13 秒");
    expect(translateUiPhrase("17h ago", "zh-CN")).toBe("17h 前");
    expect(translateUiPhrase("Tech Lead run c40545a0 succeeded", "zh-CN")).toBe("Tech Lead 运行 c40545a0 成功");
  });

  it("leaves English and unknown phrases to the original React render", () => {
    expect(translateUiPhrase("Dashboard", "en")).toBeNull();
    expect(translateUiPhrase("Project Phoenix", "zh-CN")).toBeNull();
  });
});
