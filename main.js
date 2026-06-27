/* captKernel — progressive enhancement only.
   Scroll-reveal of sections + active-nav highlighting. Site is fully readable without JS. */
(function () {
  "use strict";

  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Reveal-on-scroll */
  var reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var revObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { revObserver.observe(el); });
  }

  /* Active nav link based on section in view */
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll(".nav__links a")
  );
  var byId = {};
  navLinks.forEach(function (a) {
    var id = a.getAttribute("href").replace("#", "");
    byId[id] = a;
  });

  var sections = navLinks
    .map(function (a) { return document.getElementById(a.getAttribute("href").replace("#", "")); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          navLinks.forEach(function (a) { a.classList.remove("is-active"); });
          var link = byId[entry.target.id];
          if (link) link.classList.add("is-active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    sections.forEach(function (s) { navObserver.observe(s); });
  }
})();
