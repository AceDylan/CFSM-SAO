import { describe, expect, it } from "vitest";
import { resolvePriceVisibility } from "@/hooks/usePriceVisibility";

describe("resolvePriceVisibility", () => {
    it("shows prices to logged-in owners by default and follows showPriceForGuests for guests", () => {
    expect(resolvePriceVisibility(false, false, null)).toBe(false);
    expect(resolvePriceVisibility(true, false, null)).toBe(true);

    // 开启向访客公开时，默认均显示
    expect(resolvePriceVisibility(false, true, null)).toBe(true);
    expect(resolvePriceVisibility(true, true, null)).toBe(true);
  });

  it("allows logged-in admin to temporarily reveal prices via override", () => {
    // 管理员在未公开情况下，可一键临时展开查看
    expect(resolvePriceVisibility(true, false, "visible")).toBe(true);
    // 未登录访客在未公开情况下，不可通过 override 越权查看
    expect(resolvePriceVisibility(false, false, "visible")).toBe(false);
  });

  it("respects temporary hidden override", () => {
    // 无论是否公开，用户临时选择隐藏均严格隐藏
    expect(resolvePriceVisibility(true, true, "hidden")).toBe(false);
    expect(resolvePriceVisibility(false, true, "hidden")).toBe(false);
    expect(resolvePriceVisibility(true, false, "hidden")).toBe(false);
    expect(resolvePriceVisibility(false, false, "hidden")).toBe(false);
  });

  it("suppresses node card price tags when price visibility resolves to false", () => {
    const rawPrice = "¥30.00/月";
    // 默认未开放价格，标签必须为 null
    const guestHidden = resolvePriceVisibility(false, false, null);
    expect(guestHidden ? rawPrice : null).toBeNull();

    const ownerDefault = resolvePriceVisibility(true, false, null);
    expect(ownerDefault ? rawPrice : null).toBe(rawPrice);

    // 管理员临时展开
    const adminVisible = resolvePriceVisibility(true, false, "visible");
    expect(adminVisible ? rawPrice : null).toBe(rawPrice);

    // 访客开放价格
    const guestVisible = resolvePriceVisibility(false, true, null);
    expect(guestVisible ? rawPrice : null).toBe(rawPrice);
  });
});
