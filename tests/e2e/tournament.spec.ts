import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";
import { seed } from "../../prisma/seed";
import { getEvent, current } from "../../src/lib/query";
import { makeEvent, ready, pools, poolScores } from "../helpers";
import { command } from "../../src/lib/service";
let staffId: string;
const ids: string[] = [];
test.beforeAll(async () => {
  await seed();
  staffId = (
    await db.staff.findUniqueOrThrow({ where: { username: "event.staff" } })
  ).id;
});
test.afterAll(async () => {
  await db.event.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill("event.staff");
  await page.getByLabel("Password", { exact: true }).fill("LabOnly!3x3");
  await page.getByRole("button", { name: "Sign in to operations" }).click();
  await expect(
    page.getByRole("heading", { name: "Your events" }),
  ).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function record(page: Page, code: string, h: number, a: number) {
  const card = page.getByTestId(`game-${code}`);
  await card.locator("input[name=homeScore]").fill(String(h));
  await card.locator("input[name=awayScore]").fill(String(a));
  await card
    .getByRole("button", { name: "Confirm result", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Correct result" }),
  ).toBeVisible();
}
async function correct(
  page: Page,
  code: string,
  h: number,
  a: number,
  reason: string,
) {
  const card = page.getByTestId(`game-${code}`);
  await card.getByRole("button", { name: "Correct result" }).click();
  await card.locator("input[name=homeScore]").fill(String(h));
  await card.locator("input[name=awayScore]").fill(String(a));
  await card.getByLabel("Reason for correction").fill(reason);
  await card
    .getByRole("button", { name: "Save authorized correction" })
    .click();
  return card;
}
test("complete staff workflow: create, CSV review, check-in, scores, correction, knockout and public mobile", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  const browserErrors: string[] = [];
  page.on("pageerror", (e) => browserErrors.push(e.message));
  await login(page);
  await page
    .getByRole("button", { name: "+ Create event", exact: true })
    .click();
  await page.getByLabel("Event name").fill("KHLIM Synthetic Cup");
  await page
    .getByLabel("This event will contain synthetic participants only.")
    .check();
  await page.getByRole("button", { name: "Create synthetic event" }).click();
  await page.waitForURL(/\/ops\/[^?]+\?view=teams/);
  const eventId = page.url().split("/ops/")[1].split("?")[0];
  ids.push(eventId);
  await expect(page.getByText("A fresh team sheet")).toBeVisible();
  await page.getByRole("link", { name: "CSV import", exact: true }).click();
  await expect(page.getByLabel("Upload roster CSV")).toBeEnabled();
  await page
    .getByLabel("Upload roster CSV")
    .setInputFiles("public/samples/benchmark-teams.csv");
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await expect(
    page.getByRole("heading", { name: "Import preview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm & import 8 teams" }),
  ).toBeDisabled();
  expect(await db.teamEntry.count({ where: { eventId } })).toBe(0);
  await page
    .getByLabel(
      "I reviewed this preview and confirm these are synthetic teams and players.",
    )
    .check();
  await page.getByRole("button", { name: "Confirm & import 8 teams" }).click();
  await expect(
    page.getByText("Import committed.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Teams & check-in/ }).click();
  const entries = await db.teamEntry.findMany({
    where: { eventId },
    include: { roster: true },
    orderBy: { seed: "asc" },
  });
  for (const team of entries) {
    const card = page.locator(".team-card").filter({
      has: page.getByRole("heading", { name: team.name, exact: true }),
    });
    await card
      .getByRole("button", { name: "Confirm entry", exact: true })
      .click();
    await expect(
      card.getByRole("button", { name: "Check in team", exact: true }),
    ).toBeEnabled();
    await card
      .getByRole("button", { name: "Check in team", exact: true })
      .click();
    await expect(
      card.getByRole("button", { name: "Team present", exact: true }),
    ).toBeVisible();
    for (const player of team.roster.filter((p) => p.slot <= 3)) {
      await card
        .getByRole("button", { name: `Check in ${player.name}`, exact: true })
        .click();
      await expect(
        card.getByRole("button", {
          name: `Undo check-in ${player.name}`,
          exact: true,
        }),
      ).toBeVisible();
    }
  }
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Team present", exact: true }),
  ).toHaveCount(8);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Game day, under control." }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/qa/operator-desktop.png",
    fullPage: true,
  });
  await noOverflow(page);
  await page.waitForLoadState("networkidle");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Generate fixtures" }).click();
  await expect(
    page.getByText("All 16 fixtures created.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Public event", exact: true })
    .first()
    .click();
  for (const name of [
    "Publish Event overview",
    "Publish Schedule & bracket",
    "Publish Scores & standings",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: name.replace("Publish", "Unpublish"),
        exact: true,
      }),
    ).toBeVisible();
  }
  await page
    .getByLabel("Announcement", { exact: true })
    .fill("Synthetic court update: finals on Court 1.");
  await page
    .getByRole("button", { name: "Publish announcement", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic court update: finals on Court 1."),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Schedule & scores", exact: true })
    .click();
  for (const pool of ["A", "B"])
    for (let n = 1; n <= 6; n++) {
      const code = `${pool}-${n}`;
      await record(page, code, ...(poolScores[code] ?? [21, 10]));
    }
  await page.getByRole("link", { name: "Pool standings", exact: true }).click();
  await expect(
    page.locator(".standings-table").first().locator("tbody tr").nth(1),
  ).toContainText("KHLIM Black");
  await page
    .getByRole("link", { name: "Schedule & scores", exact: true })
    .click();
  const corrected = await correct(
    page,
    "A-5",
    16,
    18,
    "Verified sheet: Black 16, Lime 18.",
  );
  await expect(
    corrected.getByRole("button", { name: "Correct result" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Pool standings", exact: true }).click();
  await expect(
    page.locator(".standings-table").first().locator("tbody tr").nth(1),
  ).toContainText("KHLIM Lime");
  await page
    .getByRole("link", { name: "Knockout & placements", exact: true })
    .click();
  await expect(page.getByTestId("game-SF-2")).toContainText("KHLIM Lime");
  await record(page, "SF-1", 21, 10);
  await record(page, "SF-2", 21, 15);
  await record(page, "THIRD", 0, 1);
  await record(page, "FINAL", 21, 10);
  await page
    .getByRole("button", { name: "Confirm final placements", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Placements confirmed", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".placement-list li")).toHaveCount(8);
  const event = (await getEvent(eventId))!;
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const publicPage = await mobile.newPage();
  publicPage.on("pageerror", (e) => browserErrors.push(e.message));
  await publicPage.goto(`/events/${event.slug}`);
  await expect(
    publicPage.getByRole("heading", { name: "KHLIM Amber", exact: true }),
  ).toBeVisible();
  await publicPage.screenshot({
    path: "docs/qa/public-mobile-overview.png",
    fullPage: true,
  });
  for (const [name, selector] of [
    ["Schedule", ".public-game"],
    ["Standings", ".standings-table"],
    ["Knockout", ".public-bracket"],
    ["Updates", ".public-announcements"],
    ["Final results", ".public-placements"],
  ] as const) {
    await publicPage
      .getByRole("navigation", { name: "Public event" })
      .getByRole("link", { name, exact: true })
      .click();
    await expect(publicPage.locator(selector).first()).toBeVisible();
    await noOverflow(publicPage);
    await publicPage.waitForLoadState("networkidle");
    expect(
      (
        await new AxeBuilder({ page: publicPage })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await publicPage.screenshot({
      path: `docs/qa/mobile-${name.toLowerCase().replace(" ", "-")}.png`,
      fullPage: true,
    });
  }
  await expect(publicPage.locator(".public-placements li")).toHaveCount(8);
  expect(await publicPage.locator("body").innerText()).not.toContain(
    "Synthetic Black 1",
  );
  await mobile.close();
  expect(browserErrors).toEqual([]);
});
test("dangerous browser correction blocks until staff explicitly authorizes replay", async ({
  page,
}) => {
  const e = await makeEvent(staffId, "Browser correction");
  ids.push(e.id);
  await ready(staffId, e.id);
  await pools(staffId, e.id);
  await login(page);
  await page.goto(`/ops/${e.id}?view=knockout`);
  await record(page, "SF-1", 21, 10);
  await record(page, "SF-2", 12, 21);
  await record(page, "FINAL", 21, 10);
  await record(page, "THIRD", 21, 10);
  await page
    .getByRole("button", { name: "Confirm final placements", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Placements confirmed", exact: true }),
  ).toBeVisible();
  await page.goto(`/ops/${e.id}?view=schedule`);
  const card = await correct(
    page,
    "A-5",
    16,
    18,
    "Scorekeeper verified that Lime won this game.",
  );
  await expect(card.getByRole("alert")).toContainText(
    "Nothing has been changed",
  );
  await expect(
    card.getByRole("button", { name: "Save authorized correction" }),
  ).toBeDisabled();
  let state = (await getEvent(e.id))!;
  expect(
    current(state.fixtures.find((f) => f.code === "A-5")!)!.homeScore,
  ).toBe(18);
  expect(state.placements).toHaveLength(8);
  await card.getByRole("checkbox", { name: /I authorize voiding/ }).check();
  await page.screenshot({
    path: "docs/qa/correction-conflict.png",
    fullPage: true,
  });
  await card
    .getByRole("button", { name: "Save authorized correction" })
    .click();
  await expect(
    card.getByRole("button", { name: "Correct result" }),
  ).toBeVisible();
  state = (await getEvent(e.id))!;
  expect(state.placements).toHaveLength(0);
  expect(current(state.fixtures.find((f) => f.code === "SF-2")!)).toBeNull();
  await page.goto(`/ops/${e.id}?view=history`);
  await page.getByText("A-5 · 2 result revisions", { exact: true }).click();
  await expect(
    page
      .getByText("Scorekeeper verified that Lime won this game.", {
        exact: false,
      })
      .first(),
  ).toBeVisible();
});
test("public access, authorization, CSRF, hidden data, failed import and responsive long names", async ({
  page,
  request,
  browser,
}) => {
  const e = await makeEvent(staffId, "Browser access");
  ids.push(e.id);
  const base = process.env.APP_ORIGIN ?? "http://127.0.0.1:3000";
  for (const action of [
    "saveEntry",
    "previewImport",
    "commitImport",
    "confirmEntry",
    "checkIn",
    "generateFixtures",
    "recordResult",
    "confirmPlacements",
    "publish",
    "announce",
    "toggleAnnouncement",
  ]) {
    const response = await request.post(`/api/events/${e.id}/command`, {
      headers: { Origin: base },
      data: { action },
    });
    expect(response.status()).toBe(401);
  }
  expect(
    (
      await request.post("/api/events", { headers: { Origin: base }, data: {} })
    ).status(),
  ).toBe(401);
  await page.goto(`/ops/${e.id}`);
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get(`/api/public/${e.slug}`)).status()).toBe(404);
  await login(page);
  await page.goto(`/ops/${e.id}?view=teams`);
  await page.getByRole("button", { name: "+ Add team" }).click();
  const long =
    "KHLIM Synthetic Very Long Community Basketball Team Name With Eighty Characters";
  await page.getByLabel("Team name", { exact: true }).fill(long);
  for (let slot = 1; slot <= 3; slot++)
    await page
      .getByLabel(`Core player ${slot}`, { exact: true })
      .fill(`Synthetic Long Name ${slot}`);
  await page.getByLabel("These participants are synthetic.").check();
  await page.getByRole("button", { name: "Save team entry" }).click();
  await expect(page.getByRole("heading", { name: long })).toBeVisible();
  await page.setViewportSize({ width: 820, height: 1180 });
  await noOverflow(page);
  await page.screenshot({
    path: "docs/qa/operator-tablet.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: `Edit ${long}` }).click();
  await page
    .getByLabel("Core player 3", { exact: true })
    .fill("Synthetic Long Name 2");
  await page.getByLabel("These participants are synthetic.").check();
  await page.getByRole("button", { name: "Save team entry" }).click();
  await expect(page.locator(".notice.error").first()).toContainText(
    "Duplicate player",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto(`/ops/${e.id}?view=import`);
  await expect(page.getByLabel("Upload roster CSV")).toBeEnabled();
  await page.getByLabel("Upload roster CSV").setInputFiles({
    name: "broken.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("team,player,pool,seed,slot\nMissing,,A,2,1"),
  });
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await expect(page.locator(".notice.error")).toContainText("missing player");
  await expect(
    page.getByRole("button", { name: /Confirm & import/ }),
  ).toHaveCount(0);
  expect(await db.teamEntry.count({ where: { eventId: e.id } })).toBe(1);
  const authenticated = page.request;
  expect(
    (
      await authenticated.post(`/api/events/${e.id}/command`, {
        headers: { Origin: "https://untrusted.example" },
        data: { action: "announce", text: "No" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await authenticated.post(`/api/events/${e.id}/command`, {
        headers: { Origin: base, "Content-Type": "application/json" },
        data: "{",
      })
    ).status(),
  ).toBe(400);
  await command(staffId, e.id, {
    action: "publish",
    field: "public",
    value: true,
  });
  const publicContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
  });
  const visitor = await publicContext.newPage();
  await visitor.goto(`/events/${e.slug}?view=schedule`);
  await expect(
    visitor.getByText("Schedule coming soon", { exact: true }),
  ).toBeVisible();
  await noOverflow(visitor);
  await visitor.goto(`/events/${e.slug}?view=placements`);
  await expect(visitor.getByText("Every game brings us closer")).toBeVisible();
  await publicContext.close();
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  expect(
    await page
      .getByLabel("Password", { exact: true })
      .evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
});

test("an open correction stays stale after refresh and public publication toggles take effect", async ({
  page,
  request,
}) => {
  const e = await makeEvent(staffId, "Browser stale");
  ids.push(e.id);
  await ready(staffId, e.id);
  await pools(staffId, e.id);
  await login(page);
  await page.goto(`/ops/${e.id}?view=schedule`);
  const card = page.getByTestId("game-A-5");
  await card.getByRole("button", { name: "Correct result" }).click();
  await card.locator("input[name=homeScore]").fill("16");
  await card.locator("input[name=awayScore]").fill("18");
  await card
    .getByLabel("Reason for correction")
    .fill("Stale score sheet from the first operator.");
  const before = (await getEvent(e.id))!;
  const f = before.fixtures.find((f) => f.code === "A-5")!;
  await command(staffId, e.id, {
    action: "recordResult",
    fixtureId: f.id,
    homeScore: 19,
    awayScore: 16,
    expectedResultId: current(f)!.id,
    reason: "Another official reviewed the score.",
  });
  await page.getByRole("button", { name: "Refresh event" }).click();
  await page.waitForLoadState("networkidle");
  await card
    .getByRole("button", { name: "Save authorized correction" })
    .click();
  await expect(card.getByRole("alert")).toContainText(
    "changed since you opened",
  );
  expect(
    current((await getEvent(e.id))!.fixtures.find((f) => f.code === "A-5")!)!
      .homeScore,
  ).toBe(19);
  for (const field of ["public", "schedulePublished", "resultsPublished"])
    await command(staffId, e.id, { action: "publish", field, value: true });
  let pub = await (await request.get(`/api/public/${e.slug}`)).json();
  expect(pub.fixtures).toHaveLength(16);
  expect(pub.standings).toHaveLength(2);
  expect(JSON.stringify(pub)).not.toContain("Synthetic Black");
  await command(staffId, e.id, {
    action: "publish",
    field: "schedulePublished",
    value: false,
  });
  pub = await (await request.get(`/api/public/${e.slug}`)).json();
  expect(pub.fixtures).toEqual([]);
  expect(pub.standings).toEqual([]);
  await command(staffId, e.id, {
    action: "publish",
    field: "public",
    value: false,
  });
  expect((await request.get(`/api/public/${e.slug}`)).status()).toBe(404);
});

test("staff maps source columns before import and long team names fit public mobile tables", async ({
  page,
  browser,
}) => {
  const e = await makeEvent(staffId, "Browser mapping");
  ids.push(e.id);
  await login(page);
  await page.goto(`/ops/${e.id}?view=import`);
  const long =
    "KHLIM Synthetic Community Basketball Team With A Deliberately Long Name";
  const { sample } = await import("../helpers");
  const csv = sample
    .replace(
      "team,player,pool,seed,slot",
      "Club,Athlete,Group,Priority,Position",
    )
    .replaceAll("KHLIM Black", long);
  await expect(page.getByLabel("Upload roster CSV")).toBeEnabled();
  await page.getByLabel("Upload roster CSV").setInputFiles({
    name: "mapped.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  for (const [label, column] of [
    ["Team", "Club"],
    ["Player", "Athlete"],
    ["Pool", "Group"],
    ["Seed priority", "Priority"],
    ["Roster slot", "Position"],
  ])
    await page.getByLabel(label, { exact: true }).selectOption(column);
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm & import 8 teams" }),
  ).toBeDisabled();
  await page
    .getByLabel(
      "I reviewed this preview and confirm these are synthetic teams and players.",
    )
    .check();
  await page.getByRole("button", { name: "Confirm & import 8 teams" }).click();
  await expect(
    page.getByText("Import committed.", { exact: false }),
  ).toBeVisible();
  const entries = (await getEvent(e.id))!.entries;
  for (const t of entries) {
    await command(staffId, e.id, { action: "confirmEntry", entryId: t.id });
    await command(staffId, e.id, {
      action: "checkIn",
      entryId: t.id,
      checked: true,
    });
    for (const p of t.roster.filter((p) => p.slot <= 3))
      await command(staffId, e.id, {
        action: "checkIn",
        entryId: t.id,
        playerId: p.id,
        checked: true,
      });
  }
  await command(staffId, e.id, { action: "generateFixtures" });
  await pools(staffId, e.id);
  for (const field of ["public", "schedulePublished", "resultsPublished"])
    await command(staffId, e.id, { action: "publish", field, value: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await context.newPage();
  await mobile.goto(`/events/${e.slug}?view=standings`);
  await expect(
    mobile.getByRole("rowheader", { name: long, exact: false }),
  ).toBeVisible();
  await noOverflow(mobile);
  await mobile.screenshot({
    path: "docs/qa/mobile-long-names.png",
    fullPage: true,
  });
  await mobile.goto(`/events/${e.slug}?view=schedule`);
  await expect(
    mobile.locator(".public-game").filter({ hasText: long }).first(),
  ).toBeVisible();
  await noOverflow(mobile);
  await context.close();
});
