// Fælles Finlytics navbar – injiceres på alle sider

const NAV_HTML = `
<header class="site-header">

  <div class="nav-left">
    <div class="logo">F</div>
    <div class="brand-text">
      <h1>Finlytics</h1>
      <p>Smarter investing. Minimal friction.</p>
    </div>
  </div>

  <div class="nav-center">
    <a href="index.html" class="btn btn-line nav-link">Investeringsberegner</a>
    <a href="tax.html" class="btn btn-line nav-link">Skatteberegner</a>
    <a href="tax-helper.html" class="btn btn-line nav-link">Årsopgørelsesguide</a>
    <a href="debt.html" class="btn btn-line nav-link">Gældsplanlægger</a>
    <a href="mortgage.html" class="btn btn-line nav-link">Boligberegner</a>
    <a href="rental.html" class="btn btn-line nav-link">Udlejningsberegner</a>
  </div>

  <div class="nav-right">
    <a href="about.html" class="btn btn-line nav-link nav-about">Om Finlytics</a>
  </div>

</header>
`;



document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  mount.innerHTML = NAV_HTML;

  const current = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

  mount.querySelectorAll("a.nav-link").forEach((link) => {
    const href = (link.getAttribute("href") || "").toLowerCase();
    if (!href) return;
    if (href === current || (href === "index.html" && (current === "" || current === "/"))) {
      link.classList.add("nav-active");
    }
  });
});
