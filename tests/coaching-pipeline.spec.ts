import { test, expect } from "./helpers/auth";

test.describe("Coaching Pipeline — Reports List", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reports");
    // Wait for Convex subscription to load data
    await page.waitForSelector("table", { timeout: 15000 });
  });

  test("shows all column headers", async ({ page }) => {
    const headers = ["Date", "Client", "Coach", "Student", "Call #", "Score", "Status", "Actions"];
    for (const header of headers) {
      await expect(page.locator("th", { hasText: header })).toBeVisible();
    }
  });

  test("displays seeded reports with correct data", async ({ page }) => {
    // Report #1: Sarah Johnson, Mike Chen, Call #3, score 82
    await expect(page.locator("td", { hasText: "Sarah Johnson" }).first()).toBeVisible();
    await expect(page.locator("td", { hasText: "Mike Chen" })).toBeVisible();
    await expect(page.locator("td", { hasText: "3" }).first()).toBeVisible();

    // Report #2: Sarah Johnson, Alex Rivera, Call #1, score 58
    await expect(page.locator("td", { hasText: "Alex Rivera" })).toBeVisible();
  });

  test("shows correct score badges — green for 82, red for 58", async ({ page }) => {
    // Score 82 should have green badge
    const score82 = page.locator("span", { hasText: "82" });
    await expect(score82).toBeVisible();
    await expect(score82).toHaveCSS("color", "rgb(22, 163, 74)"); // #16a34a

    // Score 58 should have red badge
    const score58 = page.locator("span", { hasText: "58" });
    await expect(score58).toBeVisible();
    await expect(score58).toHaveCSS("color", "rgb(220, 38, 38)"); // #dc2626
  });

  test("flagged report has amber background", async ({ page }) => {
    // Flagged draft report row should have #fffbeb background
    const flaggedRow = page.locator("tr", { hasText: "Alex Rivera" });
    await expect(flaggedRow).toHaveCSS("background-color", "rgb(255, 251, 235)"); // #fffbeb
  });

  test("flagged report sorts first", async ({ page }) => {
    // The flagged report (Alex Rivera, score 58) should appear before the non-flagged one
    const rows = page.locator("tbody tr");
    const firstRowText = await rows.first().textContent();
    expect(firstRowText).toContain("Alex Rivera");
  });

  test("client name column shows tenant business name", async ({ page }) => {
    await expect(
      page.locator("td", { hasText: "Growth Factor Coaching" }).first()
    ).toBeVisible();
  });

  test("status filter shows only flagged reports when filtered", async ({ page }) => {
    // Select "Flagged" from status dropdown
    await page.selectOption("select", "flagged");
    // Wait for data to re-render
    await page.waitForTimeout(1000);

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    // Should show only the flagged report(s)
    expect(count).toBeGreaterThanOrEqual(1);

    // All visible rows should have "Flagged" badge
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).locator("span", { hasText: "Flagged" })).toBeVisible();
    }
  });

  test("Review button navigates to report detail", async ({ page }) => {
    const reviewLink = page.locator("a", { hasText: "Review" }).first();
    await expect(reviewLink).toBeVisible();
    const href = await reviewLink.getAttribute("href");
    expect(href).toMatch(/^\/reports\//);
  });
});

test.describe("Coaching Pipeline — Report Detail", () => {
  // Detail page needs longer timeout — cold Convex subscription can take 30s+ on first load
  test.setTimeout(90000);

  // Navigate to the report detail via its URL extracted from the list
  async function navigateToFirstReport(page: import("@playwright/test").Page) {
    await page.goto("/reports");
    await page.waitForSelector("table", { timeout: 20000 });

    // Get the href from the first review link
    const reviewLink = page.locator("a", { hasText: "Review" }).first();
    const href = await reviewLink.getAttribute("href");

    // Navigate directly to the report URL (avoids click-based navigation issues)
    await page.goto(href!);

    // Wait for report to load — either the scorecard or error message
    /* eslint-disable no-undef */
    await page.waitForFunction(
      () => {
        return (
          document.body.textContent?.includes("Overall Score") ||
          document.body.textContent?.includes("Report not found")
        );
      },
      { timeout: 45000 }
    );
    /* eslint-enable no-undef */
  }

  test("shows scorecard with overall score", async ({ page }) => {
    await navigateToFirstReport(page);
    await expect(page.locator("h2", { hasText: "Scorecard" })).toBeVisible();
    await expect(page.locator("text=Overall Score")).toBeVisible();
    // The flagged report has score 58
    await expect(page.locator("span", { hasText: "58" })).toBeVisible();
  });

  test("renders dimension scores", async ({ page }) => {
    await navigateToFirstReport(page);
    const dimensions = [
      "Curriculum Adherence",
      "Homework",
      "Coaching Technique",
      "Client Progress",
    ];
    for (const dim of dimensions) {
      await expect(page.locator("span", { hasText: dim })).toBeVisible();
    }
  });

  test("shows highlights section", async ({ page }) => {
    await navigateToFirstReport(page);
    await expect(page.locator("h3", { hasText: "Highlights" })).toBeVisible();
    await expect(
      page.locator("li", { hasText: "Attempted to re-engage" })
    ).toBeVisible();
  });

  test("shows concerns section", async ({ page }) => {
    await navigateToFirstReport(page);
    await expect(page.locator("h3", { hasText: "Concerns" })).toBeVisible();
    await expect(
      page.locator("li", { hasText: "Homework was not reviewed" })
    ).toBeVisible();
  });

  test("narrative is editable for draft reports", async ({ page }) => {
    await navigateToFirstReport(page);
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 10000 });
    // Should contain the seeded narrative text
    const value = await textarea.inputValue();
    expect(value).toContain("This session raised several concerns");
  });

  test("displays coach talk percent", async ({ page }) => {
    await navigateToFirstReport(page);
    await expect(page.locator("text=Coach talk: 62%")).toBeVisible();
  });

  test("action buttons are visible for draft reports", async ({ page }) => {
    await navigateToFirstReport(page);
    await expect(page.locator("button", { hasText: "Send to Coach" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Save Draft" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Mark No Action" })).toBeVisible();
  });
});
