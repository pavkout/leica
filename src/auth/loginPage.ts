// The login page, served by the gate itself (the app's files stay locked until
// you're in). Plain HTML in the app's black and red; the only scripts carry the
// app's hash route (#/…) through the form and run the password's Show/Hide.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function loginPage({ next, error, configured }: { next: string; error?: string; configured: boolean }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="#121211" />
<title>Sign in · leica.rt</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..700&display=swap" rel="stylesheet" />
<style>
  :root { --bg: #121211; --plate: #191918; --line: #2c2c29; --line-strong: #3b3b37; --text: #ece9e2; --muted: #9a968e; --red: #cf2e25; --red-hover: #dd3a30; color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--text); font-family: "Archivo", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif; }
  body { display: grid; place-items: center; min-height: 100vh; min-height: 100dvh; padding: 24px 16px; }
  main { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 28px; }
  .mark { margin: 0; font-size: 28px; font-weight: 400; letter-spacing: -0.01em; }
  .mark span { color: var(--muted); font-weight: 300; }
  form { display: flex; flex-direction: column; gap: 16px; }
  label { display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--muted); }
  input { width: 100%; min-height: 48px; padding: 0 14px; border: 1px solid var(--line-strong); border-radius: 6px; background: var(--plate); color: var(--text); font: inherit; font-size: 17px; }
  input:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
  .field { display: flex; flex-direction: column; gap: 8px; }
  .field > label { display: block; }
  .secret { position: relative; }
  .secret input { padding-right: 76px; }
  .secret .reveal { position: absolute; top: 4px; right: 4px; bottom: 4px; min-height: 0; margin: 0; padding: 0 14px; border-radius: 4px; background: transparent; color: var(--muted); font-size: 14px; font-weight: 500; }
  .secret .reveal:hover { background: transparent; color: var(--text); }
  .secret .reveal:focus-visible { outline-offset: 0; }
  .secret .reveal[hidden] { display: none; }
  button { min-height: 48px; margin-top: 8px; border: 0; border-radius: 999px; background: var(--red); color: #fff; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; }
  button:hover { background: var(--red-hover); }
  button:focus-visible { outline: 2px solid var(--text); outline-offset: 3px; }
  .error { margin: 0; padding: 12px 14px; border-left: 2px solid var(--red); background: rgba(207, 46, 37, 0.12); font-size: 14px; line-height: 1.45; }
  .foot { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
</style>
</head>
<body>
<main>
  <h1 class="mark">leica<span>.rt</span></h1>
  ${
    configured
      ? `<form method="post" action="/login">
    ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ""}
    <input type="hidden" name="next" value="${esc(next)}" />
    <input type="hidden" name="hash" value="" />
    <label>Username<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus /></label>
    <div class="field">
      <label for="password">Password</label>
      <div class="secret">
        <input id="password" name="password" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required />
        <button type="button" class="reveal" aria-label="Show password" aria-controls="password" aria-pressed="false" hidden>Show</button>
      </div>
    </div>
    <button type="submit">Sign in</button>
  </form>
  <script>
    document.querySelector('input[name="hash"]').value = location.hash;
    (function () {
      var input = document.getElementById("password");
      var toggle = document.querySelector(".reveal");
      var set = function (shown) {
        input.type = shown ? "text" : "password";
        toggle.textContent = shown ? "Hide" : "Show";
        toggle.setAttribute("aria-pressed", String(shown));
      };
      toggle.hidden = false;
      toggle.addEventListener("click", function () { set(input.type === "password"); input.focus(); });
      // Back to a password field before sending, so the browser offers to save it as one.
      input.form.addEventListener("submit", function () { set(false); });
    })();
  </script>`
      : `<p class="error" role="alert">Sign-in isn't set up on this server: AUTH_USERNAME and AUTH_PASSWORD are missing.</p>`
  }
  <p class="foot">Private preview. Independent tool, not affiliated with or endorsed by Leica Camera AG.</p>
</main>
</body>
</html>`;
}
