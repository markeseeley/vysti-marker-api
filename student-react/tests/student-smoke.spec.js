import { expect, test } from "@playwright/test";

const stubSupabase = (page, { loggedIn }) =>
  page.addInitScript((isLoggedIn) => {
    const session = isLoggedIn
      ? { access_token: "test-token", user: { id: "test-user" } }
      : null;
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session } }),
          onAuthStateChange: () => ({
            data: {
              subscription: {
                unsubscribe() {}
              }
            }
          }),
          signOut: async () => ({})
        }
      })
    };
  }, loggedIn);

test("student_react.html logged out redirects to signin", async ({ page }) => {
  await stubSupabase(page, { loggedIn: false });
  await page.goto("/student_react.html");
  await expect(page).toHaveURL(/\/signin\.html\?redirect=.*student_react\.html/);
});

test("signin.html without redirect goes to index.html when logged in", async ({
  page
}) => {
  await stubSupabase(page, { loggedIn: true });
  await page.goto("/signin.html");
  await expect(page).toHaveURL(/\/index\.html$/);
});

test("techniques panel hidden when header missing", async ({ page }) => {
  await stubSupabase(page, { loggedIn: true });
  await page.goto("/student_react.html");
  await expect(page.locator(".techniques-panel")).toHaveCount(0);
});
