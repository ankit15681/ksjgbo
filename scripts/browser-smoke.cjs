const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || undefined,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:8000");
    await page.getByText("24/24 hours matched").waitFor();
    await page
      .getByRole("heading", { name: "How the forecast evolved" })
      .waitFor();
    await page.locator(".run-list button").first().waitFor();
    await page.screenshot({
      path: join(tmpdir(), "wind-desk-desktop.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Hourly data & forecast provenance" })
      .click();
    assert.equal(await page.locator("tbody tr").count(), 24);
    await page.getByLabel("Show actuals").uncheck();
    // Force a slow request; previous data must disappear as soon as settings change.
    await page.route("**/api/day?**", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await page.getByLabel("Decision cutoff").fill("07:00");
    await page
      .getByRole("status")
      .filter({ hasText: "Loading analysis" })
      .first()
      .waitFor();
    assert.equal(
      await page
        .getByRole("heading", { name: "Tomorrow’s wind, in focus" })
        .count(),
      0,
    );
    await page.getByText("07:00 GMT on").waitFor();
    await page.unroute("**/api/day?**");
    await page
      .getByRole("button", { name: "Forecast accuracy", exact: true })
      .click();
    await page.getByText("744/744 hours matched").waitFor();
    await page
      .getByRole("heading", { name: "Error by forecast horizon" })
      .waitFor();
    await page
      .getByRole("button", { name: "EPEX half-hourly", exact: true })
      .click();
    await page.getByText("15:00 GMT", { exact: true }).last().waitFor();
    await page.getByRole("button", { name: "31 Jan", exact: true }).click();
    await page.getByText("1 February 2026", { exact: true }).first().waitFor();
    await page.getByText("24/24 hours matched").waitFor();
    assert.ok(await page.getByLabel("Next decision day").isDisabled());
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export CSV" }).click();
    assert.match(
      (await download).suggestedFilename(),
      /wind-day-2026-01-31-1500/,
    );
    await page.locator(".run-list button.later").last().click();
    await page
      .getByText("This publication was unavailable at the decision cutoff.", {
        exact: false,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Experimental lab", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Correction for 31 Jan’s decision" })
      .waitFor();
    await page
      .getByRole("heading", {
        name: "Historical hourly range around the official forecast",
      })
      .waitFor();
    await page.screenshot({
      path: join(tmpdir(), "wind-desk-experiment.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Methodology", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Designed around the decision time" })
      .waitFor();
    await page
      .getByRole("button", { name: "Decision desk", exact: true })
      .click();
    await page.getByText("24/24 hours matched").waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: join(tmpdir(), "wind-desk-mobile.png"),
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.route("**/api/day?**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Test data unavailable" }),
      }),
    );
    await page.getByLabel("Previous decision day").click();
    await page.getByRole("alert").waitFor();
    assert.equal(
      await page
        .getByRole("heading", { name: "Tomorrow’s wind, in focus" })
        .count(),
      0,
    );
    assert.equal(await page.locator(".metric").count(), 0);
    await page.unroute("**/api/day?**");
    await page.getByRole("button", { name: "Retry data load" }).click();
    await page.getByText("24/24 hours matched").waitFor();
    await page
      .getByRole("button", { name: "Forecast accuracy", exact: true })
      .click();
    await page.getByText("744/744 hours matched").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({
      path: join(tmpdir(), "wind-desk-accuracy.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: auction selection, delayed/failed request isolation, cutoff, monthly diagnostics and drilldown, boundary date, CSV, publication hindsight, experiment, methodology and mobile layouts; no browser exceptions.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
